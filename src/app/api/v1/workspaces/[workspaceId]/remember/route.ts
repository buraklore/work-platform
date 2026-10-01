import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { rememberWorkspace } from "@/features/workspaces/server/service";

export const POST = defineHandler<Record<string, never>, { workspaceId: string }>({}, ({ ctx, params }) =>
  rememberWorkspace(ctx, uuidParam(params.workspaceId)),
);
