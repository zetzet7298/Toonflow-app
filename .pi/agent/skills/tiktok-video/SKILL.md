---
name: tiktok-video
description: Generate a short TikTok/Reel storytelling video for the AI-character channel — faceless or back/silhouette shots, Vietnamese TTS voiceover, yellow burned subtitles. Use when the user asks to create a TikTok clip, a story video, or a new episode for the character. Trigger on phrases like "làm video TikTok", "gen clip", "làm ep mới", "story video".
---

# TikTok video pipeline

End-to-end generation of a 30–60s vertical storytelling video for the Toonflow AI-character channel.

Style reference: `data/workspaces/museTest/character/ep02/final.mp4` — back-view/silhouette character, ambient b-roll, yellow subs, reflective narration.

All steps go through the running Toonflow dev server at `http://localhost:3000` (`bun src/index.ts` in `apps/server`). Every request needs headers:

```
Origin: http://localhost:3000
x-toonflow-workspace: 1
Content-Type: application/json
```

`directory` in every body = absolute workspace path, e.g. `C:\Projects\Toonflow-app\data\workspaces\museTest`.

## Style rules (locked from ep02)

- **Face never fully visible.** Accepted angles: back of head, silhouette, hands-only, extreme profile (<20% face). The character may appear — just not front-on.
- **One location per video** (home office preferred). If location changes, only at the last shot as a deliberate transition.
- **Voiceover tells the story**; the visuals are moody b-roll around it — not "character talking to camera".
- **Subtitles**: yellow (`&H0000D7FF`), burned in, centered, sentence-length lines.
- **Pacing**: 4–6 shots, 6–8s each, hard cuts. Total 30–45s.

## Assets

| Asset | Path / ID | Use |
|---|---|---|
| Default avatar | `character/anhtuan-avatar.jpg` | firstFrame ref when a person must appear |
| Serious variant | `character/avatars/image622aa74f-…webp` | contemplative shots |
| Tired variant | `character/avatars/image44057a63-…webp` | night/burnout mood |
| Office / street / home variants | `character/avatars/*.webp` | outfit/context rotation |
| VN narrator voice | `uQaF7frJAAaUmrw6flbw` | "Anh Tuan" instant clone |
| Library alternates | `ObhtJZSfI8Ps4i8lwyVx` (Minh Son), `YeV2u3R2gzLArVTYTis8` (Tuan Anh) | |

## Steps

### 1. Script — Vietnamese narration (~8–11s per shot)

Write narration first; pick shots to match. Example arc (ep02): setup → price of dreams → examples → turn/insight.

### 2. Generate shots

`POST /api/ai/media/generate`:

```json
{
  "directory": "<abs>",
  "mediaType": "video",
  "providerId": "muse",
  "modelId": "muse-video",
  "prompt": "<scene description, e.g. 'Vietnamese man in black t-shirt sitting at desk seen from behind, home office, window light'> — ambient only, no music, no speech, no dialogue",
  "duration": 8,
  "ratio": "9:16",
  "resolution": "720p",
  "outputDirectory": "character/<epXX>"
}
```

Add `"firstFrame": {"path":"character/anhtuan-avatar.jpg","mimeType":"image/jpeg"}` **only for shots where the person appears** (to keep identity). For pure object/ambient b-roll, omit it.

Prompt rules that matter:

- Always end prompt with `— ambient only, no music, no speech, no dialogue`. Muse generates speech if you mention talking.
- For faceless: `seen from behind`, `back to camera`, `silhouette`, `hands only`, `face out of frame`, `over-the-shoulder`.
- For natural presence: `sits down`, `leans on desk`, `looks out window` — no `smiling at camera`, no `talking`, no `presenting`.
- If muse returns a frame with a face you don't want, retry with a tighter angle prompt (`close-up of hands`, `low angle from desk`) or trim `inSec`/`outSec` to the clean segment — don't accept the face.
- muse serializes; ~60s/shot; timeout `code 23` → retry once.

### 3. Narration

`POST /api/ai/media/generate` audio, `providerId: "elevenLabs"`, `modelId: "eleven_v4"`, `voice: "uQaF7frJAAaUmrw6flbw"`, prompt = the narration line. `eleven_v4` is required for natural Vietnamese (v2 sounds foreign).

Measure each file with `ffprobe` for `outSec` and subtitle timing.

### 4. Assemble

`POST /api/sequences/create` then `POST /api/sequences/render`:

```json
{
  "directory": "<abs>",
  "sequenceId": "epXX",
  "title": "<title>",
  "subtitleColor": "&H0000D7FF",
  "clips": [{"path": "<vid>", "inSec": 0, "outSec": 8.4, "attachVoiceover": "<audio>", "transitionAfter": "hard_cut", "transitionDurationSec": 0}],
  "subtitles": [{"text": "<narration>", "startSec": <clipStart>+0.2, "endSec": <clipEnd>-0.2}]
}
```

Render: `{"outputPath": "character/epXX/final.mp4", "width": 1080, "height": 1920, "fps": 30}`.

`audioGainDb` defaults to −16 dB on clips with voiceover (ambience ducks automatically).

### 5. Verify

Extract 3–4 frames across the video; check:

- no unintended face exposure
- subtitles render yellow
- narration is audible over ambience

### 6. Publish to TikTok

Use browser-skill (`bsk`). Upload the rendered `final.mp4` to `tiktok.com/upload`. Write a casual Vietnamese caption — conversational, first-person, no marketing tone, no "AI" mention. 3–5 hashtags max: mix niche (`#storytime`, `#tamtrang`, `#sukientoi`) + broad (`#xuhuong`). Save as draft unless the user says publish.

## Pitfalls

- `create` returns 409 if sequenceId exists — patch instead with `expectedRevision`.
- Server `--watch` crashes if you edit `apps/server/src` mid-render. Finish renders first.
- Remote device (iPhone/Tailscale) needs `TOONFLOW_ALLOWED_ORIGINS` env on server start.
