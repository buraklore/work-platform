import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { updateProjectSchema } from "@/features/projects/schemas";
import { deleteProject, getProject, updateProject } from "@/features/projects/server/service";

type P = { projectId: string };
export const GET = defineHandler<Record<string, never>, P>({}, ({ ctx, params }) => getProject(ctx, uuidParam(params.projectId)));
export const PATCH = defineHandler<z.infer<typeof updateProjectSchema>, P>({ input: updateProjectSchema }, ({ ctx, input, params }) =>
  updateProject(ctx, uuidParam(params.projectId), input),
);
export const DELETE = defineHandler<Record<string, never>, P>({}, ({ ctx, params }) =>
  deleteProject(ctx, uuidParam(params.projectId)),
);
