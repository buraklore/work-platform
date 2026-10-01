import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { labelSchema } from "@/features/workspaces/schemas";
import { createLabel, listLabels } from "@/features/tasks/server/service";

type P = { workspaceId: string };
export const GET = defineHandler<Record<string, never>, P>({}, ({ ctx, params }) => listLabels(ctx, uuidParam(params.workspaceId)));
export const POST = defineHandler<z.infer<typeof labelSchema>, P>({ input: labelSchema }, ({ ctx, input, params }) =>
  createLabel(ctx, uuidParam(params.workspaceId), input),
);
