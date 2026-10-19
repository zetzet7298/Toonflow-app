import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { validationOptions } from "@/lib/i18n";

const inputSchema = z.object({
  directory: z.string().min(1).max(4096),
  sequenceId: z.string().min(1).max(128),
  expectedRevision: z.number().int().nonnegative().optional(),
  outputPath: z.string().min(1).max(2048).optional(),
  burnSubtitles: z.boolean().optional(),
  width: z.number().int().min(64).max(8192).optional(),
  height: z.number().int().min(64).max(8192).optional(),
  fps: z.number().min(1).max(120).optional(),
});

export default Router().post("/", validateFields(inputSchema.shape), async (req, res) => {
  const input = inputSchema.parse(req.body, validationOptions());
  const cwd = await u.workspace.resolveWorkspace(req, input.directory);
  const result = await u.sequences.renderSequence(cwd, input);
  res.json(success(result));
});
