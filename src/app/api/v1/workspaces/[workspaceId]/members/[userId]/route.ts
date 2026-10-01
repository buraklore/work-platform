import { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { changeMemberRole, removeMember } from "@/features/members/server/service";

type P = { workspaceId: string; userId: string };
const roleSchema = z.object({ role: z.enum(["admin", "member", "guest"]) });

export const PATCH = defineHandler<z.infer<typeof roleSchema>, P>({ input: roleSchema }, ({ ctx, input, params }) =>
  changeMemberRole(ctx, uuidParam(params.workspaceId), uuidParam(params.userId), input.role),
);
export const DELETE = defineHandler<Record<string, never>, P>({}, ({ ctx, params }) =>
  removeMember(ctx, uuidParam(params.workspaceId), uuidParam(params.userId)),
);
