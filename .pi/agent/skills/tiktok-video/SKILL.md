---
name: tiktok-video
description: Generate a short TikTok/Reel video with an AI character (face or faceless), Vietnamese TTS voiceover, and burned subtitles through Toonflow's /api pipeline. Use when the user asks to create a TikTok clip, a short video for the character channel, or wants a story/narration rendered to video. Trigger also on phrases like "làm video TikTok", "gen clip", "làm ep mới".
---

# TikTok video pipeline

End-to-end generation of a 15–60s vertical video for the Toonflow AI-character channel.

All steps go through the running Toonflow dev server at `http://localhost:3000` (`bun --watch src/index.ts` in `apps/server`). Every request needs headers:

```
Origin: http://localhost:3000
x-toonflow-workspace: 1
Content-Type: application/json
```

`directory` in every body = absolute workspace path, e.g. `C:\Projects\Toonflow-app\data\workspaces\museTest`.

## Assets that already exist

| Asset | Path / ID | Purpose |
|---|---|---|
| Character avatar (default) | `character/anhtuan-avatar.jpg` | firstFrame ref — smiling, black t-shirt, cafe |
| Serious variant | `character/avatars/image622aa74f-…webp` | neutral/concerned mood |
| Tired variant | `character/avatars/image44057a63-…webp` | burnout/night mood |
| Office variant | `character/avatars/image12662f11-…webp` | navy shirt, office |
| Street variant | `character/avatars/image159a790a-…webp` | hoodie, outdoor |
| Home variant | `character/avatars/image12c76837-…webp` | white tee, home |
| Cloned VN voice | `uQaF7frJAAaUmrw6flbw` | "Anh Tuan - Narrator" instant clone |
| VN library voices | `ObhtJZSfI8Ps4i8lwyVx` (Minh Son), `YeV2u3R2gzLArVTYTis8` (Tuan Anh) | alternates |

## Steps

### 1. Write the script (Vietnamese narration + shot list)

Keep total narration ≈ 8–11s per shot. Write narration first, then pick matching shots.

Good narration length per clip: 8–11s spoken (~25–35 words Vietnamese). Get exact duration after TTS with `ffprobe` — narration drives `subtitles` timing and clip `outSec`.

### 2. Generate each shot

`POST /api/ai/media/generate` with:

```json
{
  "directory": "<abs workspace>",
  "mediaType": "video",
  "providerId": "muse",
  "modelId": "muse-video",
  "prompt": "<scene> — ambient only, no music, no speech, no dialogue",
  "duration": 8,
  "ratio": "9:16",
  "resolution": "720p",
  "firstFrame": {"path": "character/anhtuan-avatar.jpg", "mimeType": "image/jpeg"},
  "outputDirectory": "character/<epXX>"
}
```

Rules learned the hard way:

- **Never write "talking/speaking/presenting"** in the prompt — muse will synthesize speech in a random voice. Describe a *silent action*: `sits down`, `types`, `looks out window`, `rests chin on hand`, `writes in notebook`.
- **Face control**: default avatar gives a natural smile. For serious/neutral moods use `character/avatars/image622aa74f-…webp` as firstFrame. Avoid exaggerated emotion prompts (`tired`, `crying`) — muse drifts the face.
- **Skip `firstFrame` for pure b-roll** (books, coffee, hands-only objects) — no need to preserve the face and it saves tokens/time.
- **One location per video.** Mixing cafe → home-office mid-video reads as an AI cut. If the story changes location, put it at the END as a deliberate transition (e.g. last shot = walking out).
- muse.video takes ~60s/shot; if a call times out (`code 23`), retry once — sidecar serializes, heavy load = timeouts.

### 3. Generate narration

`POST /api/ai/media/generate` with:

```json
{
  "directory": "<abs workspace>",
  "mediaType": "audio",
  "providerId": "elevenLabs",
  "modelId": "eleven_v4",
  "prompt": "<Vietnamese narration text>",
  "voice": "uQaF7frJAAaUmrw6flbw",
  "outputDirectory": "character/<epXX>"
}
```

Use `eleven_v4` (or `eleven_v4_turbo`) — `eleven_multilingual_v2` sounds foreign-accented on Vietnamese. The provider auto-sends `language_code: "vi"` for v4 models.

### 4. Assemble

`POST /api/sequences/create` then `POST /api/sequences/render`:

```json
{
  "directory": "<abs>",
  "sequenceId": "epXX",
  "title": "<title>",
  "subtitleColor": "&H0000D7FF",
  "clips": [
    {"path": "character/epXX/vid1.mp4", "inSec": 0, "outSec": 8.4,
     "attachVoiceover": "character/ep02/audio1.mp3",
     "transitionAfter": "hard_cut", "transitionDurationSec": 0}
  ],
  "subtitles": [
    {"text": "<narration line>", "startSec": 0.2, "endSec": 8.2}
  ]
}
```

Render body: `{"directory", "sequenceId", "expectedRevision", "outputPath": "character/epXX/final.mp4", "width": 1080, "height": 1920, "fps": 30}`.

Timing math: clip i starts at `sum(durations[0..i-1])`. Subtitle cues match narration (start+0.2, end−0.2 of that clip's slot). `audioGainDb` on each clip defaults to −16 dB when `attachVoiceover` is set — clip music/ambience ducks under narration automatically. Override per clip with `audioGainDb: -8` if ambience is too quiet, `-24` to nearly mute.

Yellow subs: `subtitleColor: "&H0000D7FF"`. White: omit or `"&H00FFFFFF"`.

### 5. Verify before reporting

After render, extract 2–3 frames (`ffmpeg -ss <t> -i final.mp4 -frames:v 1 x.png`) and check:
- face consistency (matches avatar)
- no unwanted face in "faceless" shots — if a frame leaks a face, trim the clip (`inSec` later / `outSec` earlier) and re-render
- sub color and position
- narration present (duration ≈ expected)

## Common pitfalls

- `POST /api/ai/media/generate` on a still-loading provider → restart sidecar/server if timeouts pile up.
- Server runs `--watch` — editing `apps/server/src` mid-render kills the render. Finish renders before code edits, or run without `--watch` for stable batches.
- `sequences/create` returns 409 if `sequenceId` exists — use `patch` with `expectedRevision` to update instead.
- `curl` to `localhost:3000` from a remote device (Tailscale, phone) gets 403 — needs `TOONFLOW_ALLOWED_ORIGINS` env set on server start (dev only).
