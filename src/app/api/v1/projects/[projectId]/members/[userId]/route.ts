import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { removeProjectMember } from "@/features/projects/server/service";

export const DELETE = defineHandler<Record<string, never>, { projectId: string; userId: string }>({}, ({ ctx, params }) =>
  removeProjectMember(ctx, uuidParam(params.projectId), uuidParam(params.userId)),
);
