import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { updateWorkspaceSchema } from "@/features/workspaces/schemas";
import { updateWorkspace } from "@/features/workspaces/server/service";

type P = { workspaceId: string };
export const PATCH = defineHandler<{ name: string }, P>({ input: updateWorkspaceSchema }, ({ ctx, input, params }) =>
  updateWorkspace(ctx, uuidParam(params.workspaceId), input),
);
