import { defineHandler } from "@/lib/api/handler";
import { inviteTokenSchema } from "@/features/workspaces/schemas";
import { previewInvite } from "@/features/members/server/service";

export const POST = defineHandler({ input: inviteTokenSchema, rateLimit: "invite" }, ({ ctx, input }) =>
  previewInvite(ctx, input.token),
);
