import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { deleteStatusSchema, updateStatusSchema } from "@/features/projects/schemas";
import { deleteStatus, updateStatus } from "@/features/projects/server/service";

type P = { statusId: string };
export const PATCH = defineHandler<z.infer<typeof updateStatusSchema>, P>({ input: updateStatusSchema }, ({ ctx, input, params }) =>
  updateStatus(ctx, uuidParam(params.statusId), input),
);
export const DELETE = defineHandler<z.infer<typeof deleteStatusSchema>, P>({ input: deleteStatusSchema }, ({ ctx, input, params }) =>
  deleteStatus(ctx, uuidParam(params.statusId), input.moveTo),
);
