import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { revokeInviteLink } from "@/features/members/server/service";

export const DELETE = defineHandler<Record<string, never>, { workspaceId: string; inviteId: string }>({}, ({ ctx, params }) =>
  revokeInviteLink(ctx, uuidParam(params.workspaceId), uuidParam(params.inviteId)),
);
