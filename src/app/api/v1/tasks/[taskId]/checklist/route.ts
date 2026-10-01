import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { checklistCreateSchema } from "@/features/tasks/schemas";
import { addChecklistItem } from "@/features/tasks/server/service";

export const POST = defineHandler<z.infer<typeof checklistCreateSchema>, { taskId: string }>(
  { input: checklistCreateSchema },
  ({ ctx, input, params }) => addChecklistItem(ctx, uuidParam(params.taskId), input),
);
