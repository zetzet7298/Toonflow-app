# Changelog

All notable changes to this commercial fork of Toonflow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Final cut assembly (Spec 02 Phase 1)

### Added
- **Cut sequence module** (`apps/server/src/utils/sequences/`): `sequences/{id}.json` documents, optimistic concurrency via `expectedRevision` (409 on stale), media probing via ffprobe, timeline builder.
- **REST routes**: `POST /api/sequences/create`, `GET /api/sequences/read`, `POST /api/sequences/patch`, `POST /api/sequences/render`.
- **FFmpeg master render**: concat + xfade (hard_cut, cross_dissolve, fade_black, fade_white), per-clip trim/scale/pad to uniform 30fps, audio concat/acrossfade with silence filler for clips without audio, voiceover attach (adelay to clip start), BGM gain mix, loudnorm -16 LUFS, ASS subtitle burn-in with CJK-aware wrapping. Per-workspace render mutex.
- Verified: 2 clips + Vietnamese subtitle + 0.7s cross_dissolve → 9.3s 720p master mp4, subtitle burns correctly, 409 on stale revision.

## [Unreleased] - Muse.ai integration

### Added
- **Muse.ai media provider** (`packages/providers/src/media/muse.ts`): image generation, image-to-image edit, video generation, and video/audio reference inputs through a local Python sidecar. Cookie auth via provider `apiKey` field, `~/.muse/cookie.txt`, or `MUSE_COOKIE`.
- **Muse sidecar** (`sidecar/muse/`): FastAPI wrapper (`museService.py`, port 19301) around vendored `museClient.py` (Noise XX handshake + WebSocket tunnel + chat/media download). Serialized generation lock, `/health`, `/probe`, `/generate`.
- Verified end-to-end: `/api/ai/media/generate` → image (webp), image edit (i2i), video (mp4) saved to workspace.

## [Unreleased] - Commercial Fork Baseline

### Added
- **Clean-room porting specs** (`C:/Projects/toonflow-port-specs/`): 5 behavior-level specs for porting ArcReel features without AGPL contamination (durable jobs, final cut assembly, episode ledger, typed assets, billing ledger).
- **Commercial readiness checklist** in `AGENTS.md`: telemetry disable, branding, auth, dependency audit, custom-provider sandbox hardening.
- **Durable generation job system** design (SQLite-backed queue, restart-resume for video jobs, queued-only cancellation).
- **Final cut assembly** design (named cut sequences, TTS voiceover, CJK subtitle burn-in, CapCut draft export).
- **Episode ledger & structured script** design (monotonic episodeKey, three content modes, two-step outline → visual prompt fill).
- **Typed asset registry** design (character/scene/prop/product, design-sheet-first admission, artifact currency manifest).
- **Cost estimation & usage ledger** design (metered rate cards, all-or-nothing batch admission, sub-agent spend caps).

### Changed
- **Fork origin**: `zetzet7298/Toonflow-app` forked from `HBAI-Ltd/Toonflow-app` (upstream `d2e94ac`, 2026-10-13).
- **License**: MIT (unchanged from upstream).
- **Branding**: Fork retains `Toonflow` name for development; commercial release must rebrand (see `AGENTS.md` section J).
- **Telemetry**: Upstream telemetry remains enabled by default; must be disabled before commercial redistribution (see `AGENTS.md` section J).
- **AGENTS.md**: Converted to Vietnamese, added clean-room porting rules (section A) and commercial readiness checklist (section J).

### Security
- **Custom provider sandbox**: Upstream `node:vm` provider execution is not a security boundary; commercial builds must sandbox or restrict provider `.ts` imports.
- **No auth**: Upstream server has no authentication; SaaS deployments must add auth layer before public exposure.

---

## Upstream History (for reference)

Upstream `HBAI-Ltd/Toonflow-app` releases are tracked via `git tag` (`v1.0.0` → `v2.0.6`). This fork does not maintain a separate changelog for upstream history; use `git log upstream/master --oneline` for upstream commit history.

### Upstream v2.0.x (canvas + agent rewrite)
- Infinite canvas (Vue Flow), Pi agent SDK, plugin system, MCP server, A2A teams.
- 21 interface languages, Docker + server + desktop + Android deployment.
- Media generation: image/video/audio nodes, grid split, multi-reference video (Seedance/Kling omni).

### Upstream v1.x (fixed pipeline)
- Linear novel → script → assets → storyboard → video workflow (superseded by v2 canvas).
