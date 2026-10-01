import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { myTasks } from "@/features/tasks/server/service";

export const GET = defineHandler<Record<string, never>, { workspaceId: string }>({}, ({ ctx, params }) =>
  myTasks(ctx, uuidParam(params.workspaceId)),
);
