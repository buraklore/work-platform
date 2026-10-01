import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { checklistUpdateSchema } from "@/features/tasks/schemas";
import { deleteChecklistItem, updateChecklistItem } from "@/features/tasks/server/service";

type P = { itemId: string };
export const PATCH = defineHandler<z.infer<typeof checklistUpdateSchema>, P>(
  { input: checklistUpdateSchema },
  ({ ctx, input, params }) => updateChecklistItem(ctx, uuidParam(params.itemId), input),
);
export const DELETE = defineHandler<Record<string, never>, P>({}, ({ ctx, params }) =>
  deleteChecklistItem(ctx, uuidParam(params.itemId)),
);
