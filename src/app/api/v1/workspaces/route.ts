import { defineHandler } from "@/lib/api/handler";
import { createWorkspaceSchema } from "@/features/workspaces/schemas";
import { createWorkspace, getMe } from "@/features/workspaces/server/service";

export const GET = defineHandler({}, async ({ ctx }) => (await getMe(ctx)).workspaces);
export const POST = defineHandler({ input: createWorkspaceSchema }, ({ ctx, input }) => createWorkspace(ctx, input));
