const rules = [
  {
    type: "input",
    field: "apiKey" as const,
    title: "muse.ai Cookie",
    value: "",
    props: { type: "password", showPassword: true, autocomplete: "off", placeholder: "hatch_sess=...; hatch_gw=..." },
  },
  {
    type: "input",
    field: "baseUrl" as const,
    title: "Sidecar 地址",
    value: "http://127.0.0.1:19301",
    props: { placeholder: "http://127.0.0.1:19301" },
  },
  {
    type: "input",
    field: "cookieFile" as const,
    title: "Cookie 文件（可选）",
    value: "",
    props: { placeholder: "~/.muse/cookie.txt（留空按默认路径）" },
  },
] as const;

const version = "1.0.0";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("muse sidecar 响应格式错误");
  return value as Record<string, unknown>;
}

async function inputBytes(context: ProviderContext, input: MediaInput, signal?: AbortSignal): Promise<{ name: string; mimeType: string; dataBase64: string }> {
  signal?.throwIfAborted();
  if (input.type === "base64" || input.type === "binary") {
    const data = input.type === "binary" ? Buffer.from(input.data).toString("base64") : input.data.replace(/^data:[^;,]+;base64,/, "").replace(/\s/g, "");
    return { name: input.name ?? "reference.bin", mimeType: input.mimeType ?? "application/octet-stream", dataBase64: data };
  }
  const response = await context.tool.fetch(input.url, { signal });
  if (!response.ok) throw new Error(`下载参考媒体失败：HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeType = input.mimeType ?? response.headers.get("content-type")?.split(";")[0].trim() ?? "application/octet-stream";
  const name = input.name ?? new URL(input.url).pathname.split("/").pop() ?? "reference.bin";
  return { name, mimeType, dataBase64: Buffer.from(bytes).toString("base64") };
}

async function generate(context: ProviderContext, mediaType: "image" | "video", request: VideoRequest): Promise<MediaAsset[]> {
  const config = context.config;
  const baseUrl = (typeof config.baseUrl === "string" && config.baseUrl.trim() ? config.baseUrl : "http://127.0.0.1:19301").replace(/\/+$/, "");
  const cookie = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
  const cookieFile = typeof config.cookieFile === "string" && config.cookieFile.trim() ? config.cookieFile.trim() : undefined;
  const signal = AbortSignal.any([AbortSignal.timeout(30 * 60_000), ...(context.signal ? [context.signal] : [])]);

  const refs: MediaInput[] = [
    ...(request.images ?? []),
    ...(request.videos ?? []),
    ...(request.audios ?? []),
  ];
  if (request.firstFrame) refs.unshift(request.firstFrame);
  if (request.lastFrame) refs.push(request.lastFrame);
  const images = await Promise.all(refs.map((input) => inputBytes(context, input, signal)));

  const hints: string[] = [];
  if (mediaType === "video") {
    if (request.duration) hints.push(`duration ${request.duration}s`);
    if (request.ratio) hints.push(`aspect ratio ${request.ratio}`);
    if (request.resolution) hints.push(`resolution ${request.resolution}`);
    if (request.firstFrame && request.lastFrame) hints.push("use the first attached image as the starting frame and the last attached image as the ending frame");
    else if (request.firstFrame) hints.push("use the attached image as the starting frame");
    else if (request.lastFrame) hints.push("use the attached image as the ending frame");
  } else if (request.ratio) {
    hints.push(`aspect ratio ${request.ratio}`);
  }
  const prompt = hints.length ? `${request.prompt} (${hints.join(", ")})` : request.prompt;

  const body = {
    kind: mediaType,
    prompt,
    images,
    count: Math.max(1, typeof (request as ImageRequest).n === "number" ? (request as ImageRequest).n! : 1),
    timeoutSec: 1800,
    ...(cookie ? { cookie } : {}),
    ...(cookieFile ? { cookieFile } : {}),
  };

  const response = await context.tool.fetch(`${baseUrl}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    let detail = "";
    try { detail = object(await response.json()).detail as string ?? ""; } catch { /* keep generic */ }
    throw new Error(detail || `muse sidecar 生成失败：HTTP ${response.status}`);
  }
  const data = object(await response.json());
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const results: MediaAsset[] = [];
  for (const item of assets) {
    const record = object(item);
    const mimeType = typeof record.mimeType === "string" ? record.mimeType : "";
    const dataBase64 = typeof record.dataBase64 === "string" ? record.dataBase64 : "";
    if (!dataBase64 || !mimeType.startsWith(`${mediaType}/`)) continue;
    results.push({ mediaType, type: "base64", data: `data:${mimeType};base64,${dataBase64}`, mimeType });
  }
  if (!results.length) throw new Error(`muse.ai 未返回可用的${mediaType === "image" ? "图片" : "视频"}结果`);
  return results;
}

export default {
  id: "muse",
  label: "Muse.ai (本地 sidecar)",
  icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTUiIGZpbGw9IiM2NDU0RkUiLz48cGF0aCBkPSJNMjIgMTBjLTIgMy00IDUtNiA1cy00LTItNi01djExaDR2LTZjMSAyIDIgMyA0IDNzMy0xIDQtM3Y2aDRWMTB6IiBmaWxsPSIjZmZmIi8+PC9zdmc+",
  version,
  readme: `## Muse.ai 本地 sidecar\n\n通过本地 Python sidecar 调用 muse.ai 的图像/视频生成代理。\n\n**使用前提**\n1. 安装依赖：\`pip install -r sidecar/muse/requirements.txt\`\n2. 启动服务：\`python sidecar/muse/museService.py\`（默认监听 127.0.0.1:19301）\n3. Cookie：优先填写上方 Cookie 字段；留空则读取 \`~/.muse/cookie.txt\` 或环境变量 \`MUSE_COOKIE\`。\n\nCookie 过期后需要重新从 muse.ai 浏览器会话复制（hatch_sess + hatch_gw）。`,
  rules,
  models: [
    { id: "muse-imagine", label: "Muse Imagine (图像)", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { id: "muse-video", label: "Muse Video (视频)", type: "video", mode: ["text", "singleImage", "startEndRequired", "endFrameOptional", "startFrameOptional", ["imageReference:9", "videoReference:1", "audioReference:1"]] },
  ] satisfies ProviderModel[],
  async generateImage(request: ImageRequest): Promise<MediaAsset[]> {
    return generate(this, "image", request as VideoRequest);
  },
  async generateVideo(request: VideoRequest): Promise<MediaAsset[]> {
    return generate(this, "video", request);
  },
} satisfies ProviderDefinition<typeof rules>;
