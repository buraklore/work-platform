import { defineHandler } from "@/lib/api/handler";
import { inviteTokenSchema } from "@/features/workspaces/schemas";
import { acceptInvite } from "@/features/members/server/service";

export const POST = defineHandler({ input: inviteTokenSchema, rateLimit: "invite" }, ({ ctx, input }) =>
  acceptInvite(ctx, input.token),
);
