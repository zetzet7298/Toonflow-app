/**
 * Cut sequence (final cut assembly) — Spec 02 Phase 1 (MVP).
 *
 * Stores `sequences/{sequenceId}.json` documents inside the workspace and
 * renders a master mp4 via the managed FFmpeg factory. Supported transitions:
 * hard_cut plus cross_dissolve / fade_black / fade_white (xfade + acrossfade).
 * Voiceover & BGM inputs are mixed with adelay+volume+amix. Subtitles burn-in
 * via an ASS file generated from cues (simple CJK-aware wrapping).
 *
 * ACT: render runs on a per-workspace mutex (no durable job queue yet —
 * that is Spec 01). Render input set is snapshotted; edits during render do
 * not corrupt the output, only stale the result.
 */
import { lstat, mkdir, readFile, unlink, writeAtomic } from "@toonflow/file";
import { withFileAccess } from "@toonflow/file";
import { dirname, join, relative, sep } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { z } from "zod";
import { getStatus, createWorkspaceFfmpeg } from "@/utils/ffmpeg";
import { resolveWorkspacePath, writeWorkspaceFile, lockWorkspaceFiles } from "@/utils/workspace/files";

// ---------------------------------------------------------------------------
// document model
// ---------------------------------------------------------------------------

export const transitionKind = z.enum(["hard_cut", "cross_dissolve", "fade_black", "fade_white"]);
export type TransitionKind = z.infer<typeof transitionKind>;

export const cutClipItemSchema = z.strictObject({
  path: z.string().min(1).max(2048),
  inSec: z.number().nonnegative().optional(),
  outSec: z.number().positive().optional(),
  transitionAfter: transitionKind.default("hard_cut"),
  transitionDurationSec: z.number().nonnegative().max(10).default(0),
  attachVoiceover: z.string().max(2048).optional(),
  // dB gain on clip's own audio. Omitted: -16 when voiceover attached (music
  // under narration), else 0.
  audioGainDb: z.number().min(-60).max(12).optional(),
});
export const subtitleCueSchema = z.strictObject({
  text: z.string().min(1).max(10000),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
});
export const bgmPlacementSchema = z.strictObject({
  path: z.string().min(1).max(2048),
  gainDb: z.number().min(-60).max(12).default(-14),
});
export const sequenceDocumentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sequenceId: z.string().min(1).max(128),
  title: z.string().max(256).default(""),
  revision: z.number().int().nonnegative(),
  updatedBy: z.enum(["user", "agent"]).default("user"),
  clips: z.array(cutClipItemSchema).max(512).default([]),
  subtitles: z.array(subtitleCueSchema).max(2000).default([]),
  bgm: bgmPlacementSchema.optional(),
  // ASS hex BGR e.g. "&H0000D7FF" for yellow; default white
  subtitleColor: z.string().regex(/^&H[0-9A-Fa-f]{8}$/).optional(),
});
export type CutSequenceDocument = z.infer<typeof sequenceDocumentSchema>;
export type CutClipItem = z.infer<typeof cutClipItemSchema>;
export type SubtitleCue = z.infer<typeof subtitleCueSchema>;

function invalid(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

function seqFilePath(sequenceId: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sequenceId)) invalid("sequenceId 仅允许字母数字、_、-");
  return `sequences/${sequenceId}.json`;
}

// ---------------------------------------------------------------------------
// storage: create / read / patch with optimistic concurrency
// ---------------------------------------------------------------------------

export async function createSequence(cwd: string, doc: Partial<CutSequenceDocument> & { sequenceId?: string }) {
  const sequenceId = doc.sequenceId ?? randomUUID();
  const { path } = await resolveWorkspacePath(cwd, seqFilePath(sequenceId), true);
  const release = lockWorkspaceFiles([path]);
  try {
    if (await lstat(path).catch(() => null)) invalid(`序列 ${sequenceId} 已存在`, 409);
    const document = sequenceDocumentSchema.parse({ ...doc, schemaVersion: 1, sequenceId, revision: 1 });
    await mkdir(dirname(path), { recursive: true });
    await writeWorkspaceFile(path, JSON.stringify(document, null, 2), true);
    return document;
  } finally { release(); }
}

export async function readSequence(cwd: string, sequenceId: string) {
  const { path } = await resolveWorkspacePath(cwd, seqFilePath(sequenceId)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") invalid("序列不存在", 404);
    throw error;
  });
  const doc = sequenceDocumentSchema.parse(JSON.parse(await readFile(path, "utf8")));
  return { document: doc, readout: buildReadout(doc) };
}

export async function patchSequence(cwd: string, sequenceId: string, expectedRevision: number, patch: Partial<Pick<CutSequenceDocument, "clips" | "subtitles" | "bgm" | "title" | "subtitleColor">>, updatedBy: "user" | "agent" = "user") {
  const { path } = await resolveWorkspacePath(cwd, seqFilePath(sequenceId), true).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") invalid("序列不存在", 404);
    throw error;
  });
  const release = lockWorkspaceFiles([path]);
  try {
    const current = sequenceDocumentSchema.parse(JSON.parse(await readFile(path, "utf8")));
    if (current.revision !== expectedRevision) invalid("序列版本已变更，请重新读取后编辑", 409);
    const next = sequenceDocumentSchema.parse({ ...current, ...patch, revision: current.revision + 1, updatedBy });
    await writeWorkspaceFile(path, JSON.stringify(next, null, 2));
    return next;
  } finally { release(); }
}

function buildReadout(doc: CutSequenceDocument) {
  const clipTimings: { index: number; path: string; startSec: number; durationSec: number }[] = [];
  let cursor = 0;
  doc.clips.forEach((clip, index) => {
    clipTimings.push({ index, path: clip.path, startSec: cursor, durationSec: -1 });
    cursor += Math.max(0, (clip.outSec ?? 0) - (clip.inSec ?? 0)) || -1;
  });
  return { clipTimings, clipCount: doc.clips.length, subtitleCueCount: doc.subtitles.length, hasBgm: Boolean(doc.bgm) };
}

// ---------------------------------------------------------------------------
// probing + timeline computation
// ---------------------------------------------------------------------------

async function ffprobePath(): Promise<string> {
  const { tools } = await getStatus();
  if (!tools.ffprobe.path || tools.ffprobe.error) {
    throw Object.assign(new Error("需要 FFprobe，请先在插件市场安装 FFmpeg"), { name: "FfmpegRequiredError", code: "FFMPEG_REQUIRED", status: 424 });
  }
  return tools.ffprobe.path;
}

export interface ClipProbe { path: string; duration: number; hasAudio: boolean; width?: number; height?: number }

export async function probeMedia(absPath: string, signal?: AbortSignal): Promise<ClipProbe> {
  const executable = await ffprobePath();
  return withFileAccess([absPath], "read", async () => {
    const child = Bun.spawn([executable, "-v", "error", "-protocol_whitelist", "file",
      "-show_entries", "stream=codec_type,width,height,duration:format=duration",
      "-of", "json", absPath], {
      stdin: "ignore", stdout: "pipe", stderr: "ignore", windowsHide: true,
      timeout: 30000, signal,
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== "FFREPORT")),
    });
    const [output, code] = await Promise.all([child.stdout.text(), child.exited]);
    signal?.throwIfAborted();
    if (code !== 0) invalid(`无法探测媒体：${absPath}`);
    const data = JSON.parse(output);
    const streams = Array.isArray(data.streams) ? data.streams : [];
    const video = streams.find((s: Record<string, unknown>) => s.codec_type === "video");
    const audio = streams.find((s: Record<string, unknown>) => s.codec_type === "audio");
    const duration = Number(video?.duration ?? audio?.duration ?? data.format?.duration);
    if (!Number.isFinite(duration) || duration <= 0) invalid(`媒体时长无效：${absPath}`);
    return { path: absPath, duration, hasAudio: Boolean(audio), width: Number(video?.width) || undefined, height: Number(video?.height) || undefined };
  }, signal);
}

export interface TimelineClip extends ClipProbe {
  clipIndex: number;
  inSec: number;
  outSec: number;
  durationSec: number;
  startSec: number;
  transitionAfter: TransitionKind;
  transitionDurationSec: number;
  attachVoiceover?: string;
  audioGainDb?: number;
}

export function buildTimeline(doc: CutSequenceDocument, probes: ClipProbe[]): { clips: TimelineClip[]; totalDuration: number; warnings: string[] } {
  const warnings: string[] = [];
  let cursor = 0;
  const clips: TimelineClip[] = doc.clips.map((clip, index) => {
    const probe = probes[index];
    if (!probe) invalid(`片段 ${index + 1} 缺少媒体探测结果`);
    const inSec = Math.min(Math.max(0, clip.inSec ?? 0), probe.duration);
    const outSec = clip.outSec != null ? Math.min(clip.outSec, probe.duration) : probe.duration;
    if (outSec <= inSec) invalid(`片段 ${index + 1}（${clip.path}）裁剪区间为空`);
    const durationSec = outSec - inSec;
    const next = doc.clips[index + 1];
    if (clip.transitionDurationSec > 0) {
      if (clip.transitionDurationSec > durationSec) warnings.push(`片段 ${index + 1} 转场时长超过自身时长，按硬切处理`);
      if (next) {
        const nextDuration = Math.min(next.outSec ?? probes[index + 1].duration, probes[index + 1].duration) - Math.min(Math.max(0, next.inSec ?? 0), probes[index + 1].duration);
        if (clip.transitionDurationSec > nextDuration) warnings.push(`片段 ${index + 1} 转场时长超过下一片段，可能无法完全融合`);
      }
    }
    const result: TimelineClip = {
      ...probe, clipIndex: index, inSec, outSec, durationSec, startSec: cursor,
      transitionAfter: clip.transitionAfter, transitionDurationSec: clip.transitionDurationSec,
      attachVoiceover: clip.attachVoiceover,
      audioGainDb: clip.audioGainDb,
    };
    cursor += durationSec;
    return result;
  });
  return { clips, totalDuration: cursor, warnings };
}

// ---------------------------------------------------------------------------
// ASS subtitle generation (simple CJK wrapping)
// ---------------------------------------------------------------------------

function assEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\n/g, "\\N");
}

function assTime(sec: number) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function wrapCue(text: string, maxCharsPerLine = 22) {
  // ACT: naive CJK-aware wrap — break on punctuation first, else hard-wrap.
  if (text.length <= maxCharsPerLine) return [text];
  const lines: string[] = [];
  let rest = text;
  while (rest.length > maxCharsPerLine) {
    let cut = maxCharsPerLine;
    const window = rest.slice(0, maxCharsPerLine + 1);
    const punct = Math.max(window.lastIndexOf("，"), window.lastIndexOf("。"), window.lastIndexOf("！"), window.lastIndexOf("？"), window.lastIndexOf("、"),
      window.lastIndexOf(","), window.lastIndexOf(" "), window.lastIndexOf("!"), window.lastIndexOf("?"));
    if (punct > Math.floor(maxCharsPerLine * 0.4)) cut = punct + 1;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) lines.push(rest);
  return lines;
}

export function buildAss(cues: SubtitleCue[], width = 1920, height = 1080, primaryColour = "&H00FFFFFF") {
  const fontSize = Math.max(24, Math.round(height / 22));
  const marginV = Math.round(height / 12);
  const body = cues.map(cue => {
    const text = wrapCue(cue.text.trim()).map(assEscape).join("\\N");
    return `Dialogue: 0,${assTime(cue.startSec)},${assTime(cue.endSec)},Default,,0,0,0,,${text}`;
  }).join("\n");
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK SC,${fontSize},${primaryColour},${primaryColour},&H80000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${body}
`;
}

// ---------------------------------------------------------------------------
// render (concurrency-1 per workspace mutex)
// ---------------------------------------------------------------------------

const renderLocks = new Set<string>();

const xfadeByKind: Record<Exclude<TransitionKind, "hard_cut">, string> = {
  cross_dissolve: "fade",
  fade_black: "fadeblack",
  fade_white: "fadewhite",
};

export interface RenderRequest {
  sequenceId: string;
  expectedRevision?: number;
  outputPath?: string;
  burnSubtitles?: boolean;
  width?: number;
  height?: number;
  fps?: number;
}

export async function renderSequence(cwd: string, request: RenderRequest, signal?: AbortSignal) {
  if (renderLocks.has(cwd)) invalid("当前工作区已有渲染任务在执行", 409);
  renderLocks.add(cwd);
  let assFile: string | undefined;
  try {
    const doc = await readSequence(cwd, request.sequenceId).then(r => r.document);
    if (request.expectedRevision !== undefined && doc.revision !== request.expectedRevision) {
      invalid("序列版本已变更，请重新读取后渲染", 409);
    }
    if (!doc.clips.length) invalid("序列没有片段");

    // resolve + probe every referenced file
    const resolvedClips = await Promise.all(doc.clips.map(async clip => (await resolveWorkspacePath(cwd, clip.path)).path));
    const voiceoverEntries = doc.clips.map((clip, index) => ({ rel: clip.attachVoiceover, index })).filter((entry): entry is { rel: string; index: number } => Boolean(entry.rel));
    const voiceoverAbs = await Promise.all(voiceoverEntries.map(entry => resolveWorkspacePath(cwd, entry.rel).then(r => r.path)));
    const bgmAbs = doc.bgm ? (await resolveWorkspacePath(cwd, doc.bgm.path)).path : undefined;
    const probes = await Promise.all(resolvedClips.map(p => probeMedia(p, signal)));

    const { clips, totalDuration, warnings } = buildTimeline(doc, probes);
    const width = request.width ?? 1920;
    const height = request.height ?? 1080;
    const fps = request.fps ?? 30;

    const outputPath = request.outputPath ?? `sequences/${doc.sequenceId}-render-${doc.revision}-${createHash("sha1").update(JSON.stringify(doc.clips)).digest("hex").slice(0, 8)}.mp4`;
    const { path: outAbs } = await resolveWorkspacePath(cwd, outputPath, true);

    const ffmpeg = await createWorkspaceFfmpeg(cwd, signal);
    const cmd = ffmpeg();
    resolvedClips.forEach(p => cmd.input(p));
    voiceoverAbs.forEach(p => cmd.input(p));
    if (bgmAbs) cmd.input(bgmAbs);
    const voiceoverInputIndex = resolvedClips.length;
    const bgmInputIndex = resolvedClips.length + voiceoverAbs.length;

    const filters: { filter: string; options?: Record<string, unknown> | string; inputs?: string[] | string; outputs?: string | string[] }[] = [];
    const videoLabels: string[] = [];
    const audioLabels: string[] = [];

    clips.forEach((clip, i) => {
      const label = `v${i}`;
      videoLabels.push(label);
      filters.push({ filter: "trim", options: { start: clip.inSec, end: clip.outSec }, inputs: `${i}:v`, outputs: `${label}t` });
      filters.push({ filter: "setpts", options: "PTS-STARTPTS", inputs: `${label}t`, outputs: `${label}s` });
      filters.push({ filter: "scale", options: { w: width, h: height, force_original_aspect_ratio: "decrease" }, inputs: `${label}s`, outputs: `${label}sc` });
      filters.push({ filter: "pad", options: { w: width, h: height, x: "(ow-iw)/2", y: "(oh-ih)/2", color: "black" }, inputs: `${label}sc`, outputs: `${label}p` });
      filters.push({ filter: "setsar", options: "1", inputs: `${label}p`, outputs: `${label}r` });
      filters.push({ filter: "fps", options: { fps }, inputs: `${label}r`, outputs: `${label}f` });
      filters.push({ filter: "format", options: { pix_fmts: "yuv420p" }, inputs: `${label}f`, outputs: label });
    });

    let videoOut = videoLabels[0];
    let accumulated = clips[0].durationSec;
    for (let i = 1; i < clips.length; i++) {
      const prev = clips[i - 1];
      const kind = prev.transitionAfter;
      const dur = prev.transitionDurationSec;
      const label = `vx${i}`;
      if (kind !== "hard_cut" && dur > 0 && dur <= prev.durationSec) {
        const offset = Math.max(0, accumulated - dur);
        filters.push({ filter: "xfade", options: { transition: xfadeByKind[kind as Exclude<TransitionKind, "hard_cut">], duration: dur, offset }, inputs: [videoOut, videoLabels[i]], outputs: label });
        accumulated = accumulated - dur + clips[i].durationSec;
      } else {
        filters.push({ filter: "concat", options: { n: 2, v: 1, a: 0 }, inputs: [videoOut, videoLabels[i]], outputs: label });
        accumulated += clips[i].durationSec;
      }
      videoOut = label;
    }

    clips.forEach((clip, i) => {
      const label = `a${i}`;
      if (clip.hasAudio) {
        filters.push({ filter: "atrim", options: { start: clip.inSec, end: clip.outSec }, inputs: `${i}:a`, outputs: `${label}t` });
        filters.push({ filter: "asetpts", options: "PTS-STARTPTS", inputs: `${label}t`, outputs: `${label}s` });
        filters.push({ filter: "aresample", options: "48000", inputs: `${label}s`, outputs: `${label}r` });
        // ACT: constant gain (ducking MVP) — clip audio sits under voiceover.
        // Upgrade path: sidechaincompress keyed on the voiceover bus.
        const gain = clip.audioGainDb ?? (clip.attachVoiceover ? -16 : 0);
        const src = gain !== 0 ? `${label}g` : `${label}r`;
        if (gain !== 0) filters.push({ filter: "volume", options: { volume: `${gain}dB` }, inputs: `${label}r`, outputs: `${label}g` });
        filters.push({ filter: "aformat", options: { channel_layouts: "stereo", sample_rates: "48000" }, inputs: src, outputs: label });
      } else {
        filters.push({ filter: "anullsrc", options: { r: "48000", cl: "stereo" }, outputs: `${label}n` });
        filters.push({ filter: "atrim", options: { duration: clip.durationSec }, inputs: `${label}n`, outputs: `${label}s` });
        filters.push({ filter: "asetpts", options: "PTS-STARTPTS", inputs: `${label}s`, outputs: label });
      }
      audioLabels.push(label);
    });

    let audioOut = audioLabels[0];
    let accumulatedAudio = clips[0].durationSec;
    for (let i = 1; i < clips.length; i++) {
      const prev = clips[i - 1];
      const kind = prev.transitionAfter;
      const dur = prev.transitionDurationSec;
      const label = `ax${i}`;
      if (kind !== "hard_cut" && dur > 0 && dur <= prev.durationSec) {
        filters.push({ filter: "acrossfade", options: { d: dur }, inputs: [audioOut, audioLabels[i]], outputs: label });
        accumulatedAudio = accumulatedAudio - dur + clips[i].durationSec;
      } else {
        filters.push({ filter: "concat", options: { n: 2, v: 0, a: 1 }, inputs: [audioOut, audioLabels[i]], outputs: label });
        accumulatedAudio += clips[i].durationSec;
      }
      audioOut = label;
    }

    const mixInputs: string[] = [audioOut];
    voiceoverEntries.forEach((entry, i) => {
      const clip = clips[entry.index];
      const delayMs = Math.round(clip.startSec * 1000);
      const label = `vo${i}`;
      filters.push({ filter: "aresample", options: "48000", inputs: `${voiceoverInputIndex + i}:a`, outputs: `${label}r` });
      filters.push({ filter: "adelay", options: { delays: `${delayMs}`, all: "1" }, inputs: `${label}r`, outputs: label });
      mixInputs.push(label);
    });
    if (bgmAbs) {
      filters.push({ filter: "aresample", options: "48000", inputs: `${bgmInputIndex}:a`, outputs: "bgmR" });
      filters.push({ filter: "atrim", options: { duration: totalDuration }, inputs: "bgmR", outputs: "bgmT" });
      filters.push({ filter: "asetpts", options: "PTS-STARTPTS", inputs: "bgmT", outputs: "bgmS" });
      filters.push({ filter: "volume", options: { volume: `${doc.bgm!.gainDb}dB` }, inputs: "bgmS", outputs: "bgmV" });
      mixInputs.push("bgmV");
    }
    if (mixInputs.length > 1) {
      filters.push({ filter: "amix", options: { inputs: mixInputs.length, duration: "longest", normalize: "0" }, inputs: mixInputs, outputs: "amixed" });
      filters.push({ filter: "loudnorm", options: { I: "-16", TP: "-1.5", LRA: "11" }, inputs: "amixed", outputs: "aout" });
    } else {
      filters.push({ filter: "loudnorm", options: { I: "-16", TP: "-1.5", LRA: "11" }, inputs: audioOut, outputs: "aout" });
    }

    let finalVideo = videoOut;
    if (request.burnSubtitles !== false && doc.subtitles.length) {
      assFile = join(tmpdir(), `toonflow-sub-${randomUUID()}.ass`);
      await writeAtomic(assFile, buildAss(doc.subtitles, width, height, doc.subtitleColor ?? "&H00FFFFFF"));
      const escaped = assFile.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
      filters.push({ filter: "ass", options: `filename='${escaped}'`, inputs: videoOut, outputs: "vsub" });
      finalVideo = "vsub";
    }

    cmd.complexFilter(filters);
    cmd.outputOptions([
      "-map", `[${finalVideo}]`, "-map", "[aout]",
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
    ]);
    cmd.output(outAbs);

    await new Promise<void>((resolvePromise, reject) => {
      cmd.on("error", err => reject(err)).on("end", () => resolvePromise());
      cmd.run();
    });

    return { outputPath: relative(cwd, outAbs).split(sep).join("/"), durationSec: accumulated, revision: doc.revision, warnings };
  } finally {
    renderLocks.delete(cwd);
    if (assFile) await unlink(assFile).catch(() => {});
  }
}

const sequences = {
  createSequence,
  readSequence,
  patchSequence,
  renderSequence,
  probeMedia,
  buildTimeline,
  buildAss,
};
export default sequences;
