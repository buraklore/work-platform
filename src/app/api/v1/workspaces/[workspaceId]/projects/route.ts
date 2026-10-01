import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { createProjectSchema } from "@/features/projects/schemas";
import { createProject, listProjects } from "@/features/projects/server/service";

type P = { workspaceId: string };
export const GET = defineHandler<Record<string, never>, P>({}, ({ ctx, params }) =>
  listProjects(ctx, uuidParam(params.workspaceId)),
);
export const POST = defineHandler<z.infer<typeof createProjectSchema>, P>({ input: createProjectSchema }, ({ ctx, input, params }) =>
  createProject(ctx, uuidParam(params.workspaceId), input),
);
