# Contributing — Commercial Fork of Toonflow

Welcome to the `zetzet7298/Toonflow-app` fork. This document covers how to contribute to this fork, upstream contribution policy, and the clean-room rules for porting features from ArcReel.

---

## 1. Before you contribute

1. **Read `AGENTS.md` first** — it contains the dev rules, clean-room porting rules (section A), and the commercial-readiness checklist (section J).
2. **This fork targets commercial use** under MIT. Upstream branding (`Toonflow` name, `api.toonflow.net`, TF-Router, plugin market) must be replaced before distribution.
3. **Upstream first**: If you fix a bug that also affects `HBAI-Ltd/Toonflow-app`, submit it upstream first. This fork only tracks commercial-fork-specific changes (branding, telemetry disable, clean-room feature ports, commercial readiness).
4. **ArcReel is AGPL-3.0**: Never copy code, prompts, schemas, file names, or i18n strings from ArcReel into this repo. Port only from `C:/Projects/toonflow-port-specs/*.md` (behavioral specs written clean-room).

---

## 2. Where to start

| Change type | Entry point |
|-------------|-------------|
| Canvas UI, nodes, settings | `apps/web/src/` |
| HTTP API, agent runtime, tools | `apps/server/src/` |
| Desktop shell, native | `apps/desktop/` |
| Canvas nodes | `packages/nodes/` + `packages/nodeScaffold/readme.md` |
| Agent tools | `packages/tools/` + `packages/toolScaffold/readme.md` |
| Providers & skills | `packages/providers/src/`, `packages/skills/` |
| Clean-room specs | `C:/Projects/toonflow-port-specs/` |

---

## 3. Dev setup

```sh
git clone https://github.com/zetzet7298/Toonflow-app.git
cd Toonflow-app
bun install --frozen-lockfile
bun run dev:plugins
bun run dev
```

- **Bun version**: `1.3.14` (see `package.json` `engines`).
- **Package manager**: Bun workspaces only — do not mix npm/yarn/pnpm.
- **Data directory**: `data/` at repo root (Git-ignored). Desktop dev scripts also use this path.
- **No tests**: This repo intentionally has no test files (upstream policy). Verify changes with `typecheck`, `build`, and manual HTTP/UI checks — report only what you actually ran.

---

## 4. Pull request rules

1. **One PR, one problem** — no unrelated refactors, formatting, or dependency bumps.
2. **Branch from `master`**, keep commits focused.
3. **No secrets or workspace data** in commits.
4. **Clean-room check**: If your PR ports a feature from ArcReel, add a note that implementation was done from `toonflow-port-specs/*.md` and contains no copied expression.
5. **Commercial checklist**: If your PR touches telemetry, branding, auth, or provider sandbox, link to the relevant item in `AGENTS.md` section J.
6. **Diff review**: Run `git diff` before pushing; remove `console.log`, debug comments, and unrelated changes.

### PR body template

```markdown
## Problem
<what was broken / what feature is being ported>

## Clean-room check
- [ ] Implemented from `toonflow-port-specs/XX-*.md` (spec name)
- [ ] No ArcReel code, prompts, schemas, or identifiers copied
- [ ] Names follow Toonflow lowerCamelCase convention

## Verification
- [ ] `bun run typecheck` (or scoped workspace)
- [ ] `bun run build` (or scoped workspace)
- [ ] Manual: <describe what you ran>

## Commercial impact
- [ ] Telemetry disabled / not touched
- [ ] Branding replaced / not touched
- [ ] Auth added / not touched
```

---

## 5. Upstream contribution policy

- **Bug fixes that affect upstream**: submit to `HBAI-Ltd/Toonflow-app` first, then cherry-pick into this fork.
- **Features that are commercial-fork-specific**: open an issue in this fork first to discuss scope.
- **Do not** submit upstream PRs that add commercial-fork branding, telemetry changes, or ArcReel-derived specs.

---

## 6. License & attribution

- This fork is **MIT** licensed. Keep `LICENSE` and `HBAI-Ltd` copyright notice in all distributions.
- If you add third-party code, fonts, or assets, ensure they are MIT-compatible and preserve their copyright/license headers.
- Do not commit API keys, workspace data, or upstream sponsor materials.

---

## 7. Code of conduct

This fork inherits the upstream [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Be respectful, stay on-topic, and do not post secrets or personal data.
