import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { updateTaskSchema } from "@/features/tasks/schemas";
import { deleteTask, getTask, updateTask } from "@/features/tasks/server/service";

type P = { taskId: string };
export const GET = defineHandler<Record<string, never>, P>({}, ({ ctx, params }) => getTask(ctx, uuidParam(params.taskId)));
export const PATCH = defineHandler<z.infer<typeof updateTaskSchema>, P>({ input: updateTaskSchema }, ({ ctx, input, params }) =>
  updateTask(ctx, uuidParam(params.taskId), input),
);
export const DELETE = defineHandler<Record<string, never>, P>({}, ({ ctx, params }) => deleteTask(ctx, uuidParam(params.taskId)));
