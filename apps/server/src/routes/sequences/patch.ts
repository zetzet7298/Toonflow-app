import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { cutClipItemSchema, subtitleCueSchema, bgmPlacementSchema } from "@/utils/sequences";
import { validationOptions } from "@/lib/i18n";

const inputSchema = z.object({
  directory: z.string().min(1).max(4096),
  sequenceId: z.string().min(1).max(128),
  expectedRevision: z.number().int().nonnegative(),
  updatedBy: z.enum(["user", "agent"]).optional(),
  title: z.string().max(256).optional(),
  clips: z.array(cutClipItemSchema).max(512).optional(),
  subtitles: z.array(subtitleCueSchema).max(2000).optional(),
  bgm: bgmPlacementSchema.nullable().optional(),
});

export default Router().post("/", validateFields(inputSchema.shape), async (req, res) => {
  const input = inputSchema.parse(req.body, validationOptions());
  const cwd = await u.workspace.resolveWorkspace(req, input.directory);
  const { directory: _d, sequenceId, expectedRevision, updatedBy, bgm, ...rest } = input;
  const patch = { ...rest, ...(bgm !== undefined && bgm !== null ? { bgm } : {}) };
  const document = await u.sequences.patchSequence(cwd, sequenceId, expectedRevision, patch, updatedBy);
  res.json(success(document));
});
