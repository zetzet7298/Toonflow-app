import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { validationOptions } from "@/lib/i18n";

const inputSchema = z.object({
  directory: z.string().min(1).max(4096),
  sequenceId: z.string().min(1).max(128),
});

export default Router().get("/", validateFields(inputSchema.shape, "query"), async (req, res) => {
  const input = inputSchema.parse(req.query, validationOptions());
  const cwd = await u.workspace.resolveWorkspace(req, input.directory);
  res.json(success(await u.sequences.readSequence(cwd, input.sequenceId)));
});
