const rules = [
  {
    type: "input",
    field: "apiKey" as const,
    title: "API Key",
    value: "",
    props: { type: "password", showPassword: true, autocomplete: "off", placeholder: "sk_..." },
  },
] as const;

const apiUrl = "https://api.elevenlabs.io";
const version = "1.0.0";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ElevenLabs 响应格式错误");
  return value as Record<string, unknown>;
}

const mimeByFormat: Record<string, { outputFormat: string; mimeType: string }> = {
  mp3: { outputFormat: "mp3_44100_128", mimeType: "audio/mpeg" },
  wav: { outputFormat: "pcm_44100", mimeType: "audio/wav" },
  pcm: { outputFormat: "pcm_24000", mimeType: "audio/pcm" },
  ogg_opus: { outputFormat: "opus_48000_128", mimeType: "audio/ogg" },
};

export default {
  id: "elevenLabs",
  label: "ElevenLabs",
  icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNiIgZmlsbD0iIzExMTEzMSIvPjxwYXRoIGQ9Ik03IDZoNHYxMkg3ek0xMyA2aDR2MTJoLTR6IiBmaWxsPSIjZmZmIi8+PC9zdmc+",
  version,
  readme: `## ElevenLabs TTS\n\n通过官方 REST API 合成语音。\n\n- 在 [ElevenLabs Developers → API Keys](https://elevenlabs.io/app/developers/api-keys) 创建密钥并粘贴到 API Key 字段。\n- 模型：\`eleven_multilingual_v2\`（多语言，适合中文/越南语）与 \`eleven_turbo_v2_5\`（低延迟）。\n- 支持参考音色 \`voice\`：填写 ElevenLabs voice_id（如 \`21m00Tcm4TlvDq8ikWAM\` = Rachel）。\n\n### Giọng tiếng Việt hay (Voice Library đã add sẵn)\n\n- \`ObhtJZSfI8Ps4i8lwyVx\` — **Minh Son**: giọng nam Bắc, kiểu commentary/quảng cáo/explainer.\n- \`YeV2u3R2gzLArVTYTis8\` — **Tuan Anh**: giọng nam Bắc trầm ấm, kể chuyện.\n- \`ueSxRO0nLF1bj93J2hVt\` — **Trung Caha**: giọng nam Bắc rõ ràng, informative (public library, add qua \`POST /v1/voices/add/{public_id}/{voice_id}\`).\n\nĐể add giọng Voice Library khác: \`POST /v1/voices/add/{public_user_id}/{voice_id}\` body \`{\\"new_name\\":\\"...\\"}\`.\n\n### Voice đã clone sẵn\n\n- \`uQaF7frJAAaUmrw6flbw\` — **Anh Tuan - Narrator**: Instant Voice Clone từ 5 mẫu narration tiếng Việt (trim 60s/file, 96kbps mono). Dùng ngay không cần verify.\n- \`8LsBfdJhBaJ1EM9QD6lf\` — **Best voice Nam**: Professional Voice Clone, chưa fine-tune xong nên API báo \"not fine-tuned\" — cần hoàn tất training trên Voice Lab.\n\nInstant clone qua API: \`POST /v1/voices/add\` multipart \`name\` + \`files[]\` (mỗi file ≤11MB) — trả \`voice_id\` dùng luôn.`,
  rules,
  models: [
    {
      id: "eleven_v4",
      label: "Eleven v4 (94 ngôn ngữ, VN tốt)",
      type: "audio",
      voices: [
        { title: "Anh Tuan - Narrator (clone)", voice: "uQaF7frJAAaUmrw6flbw" },
        { title: "Minh Son - Ads (VN Bắc)", voice: "ObhtJZSfI8Ps4i8lwyVx" },
        { title: "Tuan Anh - Story (VN Bắc)", voice: "YeV2u3R2gzLArVTYTis8" },
        { title: "Rachel (EN default)", voice: "21m00Tcm4TlvDq8ikWAM" },
      ],
    },
    {
      id: "eleven_v4_turbo",
      label: "Eleven v4 Turbo (nhanh, VN tốt)",
      type: "audio",
      voices: [
        { title: "Anh Tuan - Narrator (clone)", voice: "uQaF7frJAAaUmrw6flbw" },
        { title: "Minh Son - Ads (VN Bắc)", voice: "ObhtJZSfI8Ps4i8lwyVx" },
        { title: "Rachel (EN default)", voice: "21m00Tcm4TlvDq8ikWAM" },
      ],
    },
    {
      id: "eleven_multilingual_v2",
      label: "Eleven Multilingual v2 (cũ)",
      type: "audio",
      voices: [
        { title: "Rachel (default)", voice: "21m00Tcm4TlvDq8ikWAM" },
        { title: "Adam", voice: "pNInz6obpgDQGcFmaJgB" },
        { title: "Bella", voice: "EXAVITQu4vr4xnSDxMaL" },
        { title: "Domi", voice: "AZnzlk1XvdvUeBnXmlld" },
      ],
    },
    {
      id: "eleven_turbo_v2_5",
      label: "Eleven Turbo v2.5",
      type: "audio",
      voices: [
        { title: "Rachel (default)", voice: "21m00Tcm4TlvDq8ikWAM" },
        { title: "Adam", voice: "pNInz6obpgDQGcFmaJgB" },
        { title: "Bella", voice: "EXAVITQu4vr4xnSDxMaL" },
      ],
    },
  ] satisfies ProviderModel[],
  async generateAudio(request: AudioRequest): Promise<MediaAsset[]> {
    const apiKey = this.config.apiKey?.trim();
    if (!apiKey) throw new Error("请填写 API Key");
    const text = (request.text ?? request.prompt ?? "").trim();
    if (!text) throw new Error("请输入音频生成文本");
    const voice = request.voice?.trim() || "21m00Tcm4TlvDq8ikWAM";
    const format = request.format ?? "mp3";
    const target = mimeByFormat[format];
    if (!target) throw new Error(`ElevenLabs 暂不支持格式 ${format}（可用：mp3、wav、pcm、ogg_opus）`);
    const signal = AbortSignal.any([AbortSignal.timeout(5 * 60_000), ...(this.signal ? [this.signal] : [])]);

    const body: Record<string, unknown> = {
      text,
      model_id: request.model,
      output_format: target.outputFormat,
    };
    // eleven_v4 hỗ trợ language_code; VN voice trên v4 cần hint vi để phát âm chuẩn
    if (typeof request.model === "string" && request.model.startsWith("eleven_v4")) {
      body.language_code = "vi";
    }
    const voiceSettings: Record<string, number> = {};
    if (request.speed !== undefined) {
      if (request.speed < 0.7 || request.speed > 1.2) throw new Error("ElevenLabs 语速须在 0.7 到 1.2 倍之间");
      voiceSettings.speed = request.speed;
    }
    if (Object.keys(voiceSettings).length) body.voice_settings = voiceSettings;

    const response = await this.tool.fetch(`${apiUrl}/v1/text-to-speech/${encodeURIComponent(voice)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: target.mimeType,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      let detail = "";
      try { detail = JSON.stringify(await response.json()).slice(0, 400); } catch { /* keep generic */ }
      throw new Error(detail || `ElevenLabs 请求失败：HTTP ${response.status}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error("ElevenLabs 返回空音频");
    return [{ mediaType: "audio", type: "binary", data: bytes, mimeType: target.mimeType }];
  },
} satisfies ProviderDefinition<typeof rules>;
