"""muse.ai generation sidecar for Toonflow.

Wraps the vendored muse_client.py as a tiny local HTTP service so the
TypeScript provider adapter can generate images/videos without knowing the
Noise handshake. Runs single-node, single-user: generation calls are
serialized behind an asyncio lock because the cookie account is shared.

Run:
    pip install -r requirements.txt
    uvicorn museService:app --host 127.0.0.1 --port 19301
"""

from __future__ import annotations

import asyncio
import base64
import os
import sys
import tempfile
import threading
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent))
import museClient  # noqa: E402

app = FastAPI(title="toonflow-muse-sidecar", version="1.0.0")

# ACT: muse.ai agent runs are serialized behind one lock; the account cookie is
# shared and parallel streams on one cookie are not supported by the protocol.
_generationLock = threading.Lock()

STATE_DIR = Path(os.environ.get("MUSE_STATE_DIR", Path.home() / ".muse"))
DEFAULT_COOKIE_FILE = Path(os.environ.get("MUSE_COOKIE_FILE", STATE_DIR / "cookie.txt"))


class GenRequest(BaseModel):
    kind: str = Field(default="image", pattern="^(image|video)$")
    prompt: str = ""
    images: list[dict] = Field(default_factory=list)   # [{name, mimeType, dataBase64}]
    count: int = 1
    timeoutSec: float = 1800.0
    session: str | None = None
    cookie: str | None = None
    cookieFile: str | None = None


def resolveCookie(body: GenRequest | None) -> str:
    raw = (body.cookie or "").strip()
    if not raw:
        env = os.environ.get("MUSE_COOKIE")
        if env:
            raw = env.strip()
    if not raw:
        path = Path(body.cookieFile) if body.cookieFile else DEFAULT_COOKIE_FILE
        if path.exists():
            raw = path.read_text(encoding="utf-8").strip()
    if raw.lower().startswith("cookie:"):
        raw = raw.split(":", 1)[1].strip()
    raw = raw.replace("\n", "").strip()
    if not raw:
        raise HTTPException(401, "muse.ai cookie not configured (pass cookie in request, "
                                 "set MUSE_COOKIE, or create ~/.muse/cookie.txt)")
    return raw


def writeTempImage(item: dict, directory: Path) -> Path:
    data = item.get("dataBase64") or ""
    blob = base64.b64decode(data)
    name = item.get("name") or "ref.png"
    suffix = Path(name).suffix or ".png"
    fd, tmp = tempfile.mkstemp(prefix="muse_ref_", suffix=suffix, dir=directory)
    with os.fdopen(fd, "wb") as fh:
        fh.write(blob)
    return Path(tmp)


def runGeneration(body: GenRequest) -> dict:
    """Blocking pipeline: open gateway -> chat turn -> download media.

    Executed in a thread (sync FastAPI handler) so the ws.recv loop does not
    block the event loop. Caller must hold _generationLock.
    """
    cookie = resolveCookie(body)
    rest = museClient.MuseRest(cookie)
    gw = ws = None
    workdir = Path(tempfile.mkdtemp(prefix="muse_gen_"))
    tmp_files: list[Path] = []
    try:
        gw, ws = museClient.open_gateway(rest)
        cs = museClient.ChatSession(rest, gw, ws)
        cs.subscribe(body.session)
        session, baseline = cs.drain_baseline(3.0)
        if body.session:
            session = body.session

        images = [writeTempImage(item, workdir) for item in body.images]
        tmp_files.extend(images)
        prompt = body.prompt
        sid = cs.send(prompt, session_id=session, images=images)
        cs.wait_ack(sid)

        events = cs.wait_turn(
            baseline_seq=baseline,
            max_seconds=body.timeoutSec,
            expected_media=max(1, body.count),
        )
        media = museClient.collect_media(events, baseline)
        if not media:
            raise HTTPException(504, "muse.ai turn finished without returning media files")

        assets: list[dict] = []
        for index, (path, meta) in enumerate(media.items()):
            dest = workdir / (Path(path).name or f"file_{index}.bin")
            try:
                _status, ctype, nbytes = cs.download(path, dest)
            except Exception as exc:  # noqa: BLE001 - media may still be rendering server-side
                raise HTTPException(502, f"download failed for {path}: {exc}") from exc
            blob = dest.read_bytes()
            if not blob:
                continue
            assets.append({
                "path": path,
                "mimeType": ctype or meta.get("mime") or "application/octet-stream",
                "label": meta.get("label") or "",
                "byteLength": nbytes,
                "dataBase64": base64.b64encode(blob).decode(),
            })
        if not assets:
            raise HTTPException(502, "muse.ai returned media paths but all downloads were empty")
        return {"session": session, "assets": assets}
    except HTTPException:
        raise
    except museClient.GatewayError as exc:
        raise HTTPException(502, f"gateway error: {exc}") from exc
    finally:
        if ws is not None:
            try:
                ws.close()
            except Exception:
                pass
        for tmp in tmp_files:
            try:
                tmp.unlink(missing_ok=True)
            except Exception:
                pass


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "toonflow-muse-sidecar",
        "cookieFile": str(DEFAULT_COOKIE_FILE),
        "cookieFileExists": DEFAULT_COOKIE_FILE.exists(),
        "envCookie": bool(os.environ.get("MUSE_COOKIE")),
    }


@app.post("/probe")
def probe(body: GenRequest | None = None):
    cookie = resolveCookie(body or GenRequest(prompt=""))
    rest = museClient.MuseRest(cookie)
    try:
        gw, ws = museClient.open_gateway(rest)
        info = {
            "ok": True,
            "observedType": gw.handshake.observed_type,
            "serverStaticPub": gw.handshake.remote_static.hex(),
        }
        ws.close()
        return info
    except museClient.GatewayError as exc:
        raise HTTPException(502, f"gateway error: {exc}") from exc


@app.post("/generate")
def generate(body: GenRequest):
    with _generationLock:
        return runGeneration(body)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("MUSE_SIDECAR_PORT", "19301")))
