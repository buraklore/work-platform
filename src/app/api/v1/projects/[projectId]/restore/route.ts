import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { restoreProject } from "@/features/projects/server/service";

export const POST = defineHandler<Record<string, never>, { projectId: string }>({}, ({ ctx, params }) =>
  restoreProject(ctx, uuidParam(params.projectId)),
);
