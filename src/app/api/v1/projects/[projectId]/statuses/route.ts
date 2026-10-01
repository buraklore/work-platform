import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { createStatusSchema } from "@/features/projects/schemas";
import { createStatus } from "@/features/projects/server/service";

export const POST = defineHandler<z.infer<typeof createStatusSchema>, { projectId: string }>(
  { input: createStatusSchema },
  ({ ctx, input, params }) => createStatus(ctx, uuidParam(params.projectId), input),
);
