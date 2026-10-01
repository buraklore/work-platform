import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { inviteLinkSchema } from "@/features/workspaces/schemas";
import { createInviteLink, listInviteLinks } from "@/features/members/server/service";

type P = { workspaceId: string };
export const GET = defineHandler<Record<string, never>, P>({}, ({ ctx, params }) =>
  listInviteLinks(ctx, uuidParam(params.workspaceId)),
);
export const POST = defineHandler<z.infer<typeof inviteLinkSchema>, P>(
  { input: inviteLinkSchema, rateLimit: "invite" },
  ({ ctx, input, params }) => createInviteLink(ctx, uuidParam(params.workspaceId), input),
);
