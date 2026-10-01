import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { listMembers } from "@/features/members/server/service";

export const GET = defineHandler<Record<string, never>, { workspaceId: string }>({}, ({ ctx, params }) =>
  listMembers(ctx, uuidParam(params.workspaceId)),
);
