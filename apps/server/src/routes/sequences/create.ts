import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { cutClipItemSchema, subtitleCueSchema, bgmPlacementSchema } from "@/utils/sequences";
import { validationOptions } from "@/lib/i18n";

const inputSchema = z.object({
  directory: z.string().min(1).max(4096),
  sequenceId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),
  title: z.string().max(256).optional(),
  clips: z.array(cutClipItemSchema).max(512).optional(),
  subtitles: z.array(subtitleCueSchema).max(2000).optional(),
  bgm: bgmPlacementSchema.optional(),
  subtitleColor: z.string().regex(/^&H[0-9A-Fa-f]{8}$/).optional(),
});

export default Router().post("/", validateFields(inputSchema.shape), async (req, res) => {
  const input = inputSchema.parse(req.body, validationOptions());
  const cwd = await u.workspace.resolveWorkspace(req, input.directory);
  const { directory: _d, ...doc } = input;
  const document = await u.sequences.createSequence(cwd, doc);
  res.json(success(document));
});
