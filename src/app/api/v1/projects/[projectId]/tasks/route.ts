import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { listProjectTasks } from "@/features/tasks/server/service";

export const GET = defineHandler<Record<string, never>, { projectId: string }>({}, ({ ctx, params }) =>
  listProjectTasks(ctx, uuidParam(params.projectId)),
);
