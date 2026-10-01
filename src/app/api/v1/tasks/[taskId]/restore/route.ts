import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { restoreTask } from "@/features/tasks/server/service";

export const POST = defineHandler<Record<string, never>, { taskId: string }>({}, ({ ctx, params }) =>
  restoreTask(ctx, uuidParam(params.taskId)),
);
