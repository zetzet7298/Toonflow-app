<div align="center">

<img src="./docs/images/logo.png" alt="Toonflow Logo" width="120" height="120" />

# Toonflow Fork — Commercial Edition

**Open-source AI short-drama & video creation platform**

MIT License · TypeScript/Vue 3 · Bun · Electrobun · 21 languages

<p>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://github.com/zetzet7298/Toonflow-app"><img src="https://img.shields.io/badge/Fork-zetzet7298%2FToonflow--app-181717?style=for-the-badge&logo=github" alt="Fork" /></a>
  <a href="https://github.com/HBAI-Ltd/Toonflow-app"><img src="https://img.shields.io/badge/Upstream-HBAI--Ltd%2FToonflow--app-orange?style=for-the-badge" alt="Upstream" /></a>
</p>

> **Fork notice**: This repository (`zetzet7298/Toonflow-app`) is an MIT-licensed fork of
> [`HBAI-Ltd/Toonflow-app`](https://github.com/HBAI-Ltd/Toonflow-app) (upstream `master` @ `d2e94ac`).
> It is intended for commercial product development. **Upstream branding, telemetry, and first-party services
> must be replaced before commercial distribution** — see `AGENTS.md` section J (Commercial Readiness Checklist).

</div>

---

## What this fork is for

| Use case | Description |
|----------|-------------|
| **Novel → short drama** | Long-form novel → episode planning → structured script → consistent characters/scenes → shot-by-shot video → final cut (MP4 + CapCut draft). |
| **Agent-driven canvas** | Infinite canvas (Vue Flow) + Pi agent SDK + MCP server + plugin system for custom nodes/tools/skills. |
| **Commercial SaaS/self-host** | MIT license, Docker/server/desktop/Android deployment; fork adds clean-room specs for billing, job queue, artifact versioning, and episode ledger. |

This fork adds **5 clean-room behavioral specs** (`C:/Projects/toonflow-port-specs/`) for porting ArcReel-style production features without AGPL contamination:

1. `01-durable-generation-jobs.md` — SQLite job queue, restart-resume, queued-only cancel.
2. `02-final-cut-assembly.md` — Named cut sequences, TTS voiceover, subtitles, BGM, CapCut export.
3. `03-episode-ledger-structured-script.md` — Episode ledger, monotonic IDs, three content modes.
4. `04-typed-assets-consistency-versioning.md` — Character/scene/prop registry, design-sheet-first admission, artifact currency.
5. `05-cost-estimation-billing-ledger.md` — Metered rate cards, batch admission, usage ledger, spend caps.

**Clean-room rule**: Implement only from the specs above. Do not copy code, prompts, schemas, or file names from ArcReel (AGPL-3.0).

---

## 1. Highlights

| Capability | Status |
|------------|--------|
| 🖼️ Infinite canvas | Vue 3 + Vue Flow, text/image/video/audio/generation nodes, grid split (2×2 → 10×10). |
| 🤖 Agent & MCP | Pi agent SDK, sub-agents, A2A teams, MCP server (HTTP + stdio). |
| 🔌 Plugin system | Node `.umd.js`, tool `.tool.js`, skill `SKILL.md`, provider `.ts`, ext, agent-team; `toonflow://install` deep link. |
| 🎬 Media generation | TF-Router / APIMart / Metaso / Compshare adapters; multi-reference video (up to 30 images / 10 videos / 10 audios). |
| 🏠 Self-hosted | Docker, bare server, Windows/macOS desktop, Android ARM64. |
| 🌐 i18n | 21 interface languages. |
| 📋 Episode ledger | *Spec only* — structured script, three content modes (narration / drama / ad). |
| 🎞️ Final cut | *Spec only* — timeline, TTS, subtitles, BGM, CapCut/Jianying export. |
| 🧾 Job queue | *Spec only* — SQLite-backed, restart-resume, queued-only cancel. |
| 💰 Billing ledger | *Spec only* — metered rate cards, batch admission, usage ledger. |

---

## 2. Quick start

### 2.1 Clone & install

```sh
git clone https://github.com/zetzet7298/Toonflow-app.git
cd Toonflow-app
bun install --frozen-lockfile
```

### 2.2 Development

```sh
# Build & sync built-in plugins to data/
bun run dev:plugins

# Start web (Vite) + business server (Bun) on :5173 / :3000
bun run dev
```

| Command | Purpose |
|---------|---------|
| `bun run dev:web` | Vite only (needs server separately). |
| `bun run dev:server` | Server only. |
| `bun run dev:plugins` | Build nodes/tools → `data/` (one-shot, not watch). |
| `bun run dev:desktop` | Electrobun desktop build + start. |
| `bun run typecheck` | Type-check all workspaces (desktop needs Electrobun SDK prep first). |
| `bun run build` | Build tools, web, server, MCP. |
| `bun run build:server` | Build server + web + MCP for bare-server deploy. |
| `bun run start:server` | Start standalone server on `127.0.0.1:3000`. |

### 2.3 Docker

```sh
docker compose up -d --build
# open http://127.0.0.1:3000
```

Data persists in Docker volume `toonflowData` (`/app/data/`). **Do not** run `docker compose down -v` — it deletes the volume.

### 2.4 Bare server (Ubuntu/Debian)

```sh
sudo apt-get install -y git curl unzip ffmpeg
curl -fsSL https://bun.com/install | bash -s "bun-v1.3.14"
git clone https://github.com/zetzet7298/Toonflow-app.git && cd Toonflow-app
bun install --frozen-lockfile
bun run build:server
mkdir -p data/workspaces/myProject
bun run start:server
```

Server listens on `127.0.0.1:3000`. **No auth built-in** — restrict the port with a firewall or authenticated reverse proxy for public access.

---

## 3. Commercial-readiness checklist

Before shipping a commercial product built on this fork, complete all items in `AGENTS.md` section J:

- [ ] **Rebrand**: Rename app, logo, `api.toonflow.net`, TF-Router, plugin-market endpoints. MIT does not grant rights to the `Toonflow` trademark.
- [ ] **Disable telemetry**: `apps/web/src/lib/anonymousData.ts:146` + `apps/web/src/stores/settings.ts:85`.
- [ ] **Add auth**: Server has no authentication; add session/API-key auth for SaaS.
- [ ] **Audit dependencies**: Check `package.json` + transitive deps for GPL/AGPL (ffmpeg, fonts, media libs).
- [ ] **Harden provider sandbox**: `apps/server/src/utils/media/provider.ts:392` uses `node:vm` — not a real sandbox; restrict or containerize user-supplied `.ts` providers.
- [ ] **Keep LICENSE**: MIT + `HBAI-Ltd` copyright must ship with every distribution.

---

## 4. Development specs

| Spec | Path | Status |
|------|------|--------|
| Gap matrix | `C:/Projects/toonflow-port-specs/00-gap-matrix.md` | ✅ Done |
| Durable generation jobs | `C:/Projects/toonflow-port-specs/01-durable-generation-jobs.md` | ✅ Done |
| Final cut assembly | `C:/Projects/toonflow-port-specs/02-final-cut-assembly.md` | ✅ Done |
| Episode ledger & structured script | `C:/Projects/toonflow-port-specs/03-episode-ledger-structured-script.md` | ✅ Done |
| Typed assets & consistency | `C:/Projects/toonflow-port-specs/04-typed-assets-consistency-versioning.md` | ✅ Done |
| Cost estimation & billing | `C:/Projects/toonflow-port-specs/05-cost-estimation-billing-ledger.md` | ✅ Done |

Implementation order: **01 → 05 → 04 → 03 → 02** (jobs + billing protect money first, then assets/scripts, then final cut).

---

## 5. Repository layout

```
Toonflow-app/
  AGENTS.md              # Dev rules + clean-room + commercial checklist
  CHANGELOG.md           # Fork changelog (see [Unreleased])
  README.md              # This file
  LICENSE                # MIT (HBAI-Ltd copyright)
  CONTRIBUTING.md        # Contribution guide
  apps/
    web/                 # Vue 3 + Vite + Pinia + Element Plus + Vue Flow
    server/              # Bun + Express 5 + Zod + agent runtime
    desktop/             # Electrobun shell (Windows/macOS)
    mobile/              # Android ARM64
    updateServer/        # Self-hosted update server
  packages/
    nodes/               # Canvas nodes (text, image, video, audio, generation, director3d)
    tools/               # Agent tools
    providers/           # LLM & media provider adapters
    skills/              # Markdown workflow skills
    mcp/                 # MCP server
    nodeScaffold/        # Node SDK
    toolScaffold/        # Tool SDK
    ffmpeg/              # FFmpeg wrapper & catalog
    i18n/                # 21 locales
    file/                # File primitives (@toonflow/file)
    nodeShared/          # Shared node UI (@toonflow/node-shared)
    teams/               # Multi-agent teams & A2A
  docs/
    development.md       # Plugin/dev/build guide
    readme.md            # Doc index
    images/              # Screenshots & logos
```

---

## 6. Upstream & attribution

- **Upstream**: [`HBAI-Ltd/Toonflow-app`](https://github.com/HBAI-Ltd/Toonflow-app) — MIT, `master` @ `d2e94ac` (2026-10-13).
- **Upstream authors**: HBAI-Ltd / 北京爱阿科技有限公司.
- **Upstream README translations**: `docs/readme/` contains upstream READMEs in 21 languages; this fork only maintains the root `README.md` for the commercial edition.

For upstream features, issues, and community, see the upstream repository. This fork's scope is commercial product development; upstream bug fixes should be submitted upstream first.

---

## 7. License

This project is licensed under the [MIT License](./LICENSE). Copyright © 2026 北京爱阿科技有限公司.

Third-party dependencies and assets retain their own licenses. Do not commit secrets, personal configs, workspace data, or unauthorized material.

---

## 8. Contact

- Fork owner: `zetzet7298`
- Commercial licensing questions: replace this with your support channel before shipping.
