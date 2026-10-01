import type { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { projectMemberSchema } from "@/features/projects/schemas";
import { addProjectMember } from "@/features/projects/server/service";

export const POST = defineHandler<z.infer<typeof projectMemberSchema>, { projectId: string }>(
  { input: projectMemberSchema },
  ({ ctx, input, params }) => addProjectMember(ctx, uuidParam(params.projectId), input),
);
