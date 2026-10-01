import { defineHandler } from "@/lib/api/handler";
import { createTaskSchema } from "@/features/tasks/schemas";
import { createTask } from "@/features/tasks/server/service";

export const POST = defineHandler({ input: createTaskSchema }, ({ ctx, input }) => createTask(ctx, input));
