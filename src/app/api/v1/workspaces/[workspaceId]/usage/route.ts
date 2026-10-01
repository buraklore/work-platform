import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { getUsage } from "@/features/workspaces/server/service";

export const GET = defineHandler<Record<string, never>, { workspaceId: string }>({}, ({ ctx, params }) =>
  getUsage(ctx, uuidParam(params.workspaceId)),
);
