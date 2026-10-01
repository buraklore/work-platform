import { z } from "zod";
import { defineHandler } from "@/lib/api/handler";
import { uuidParam } from "@/lib/validation/common";
import { search } from "@/features/search/server/service";

const schema = z.object({ q: z.string().max(200).default("") });
export const GET = defineHandler<z.infer<typeof schema>, { workspaceId: string }>(
  { input: schema, rateLimit: "search" },
  ({ ctx, input, params }) => search(ctx, uuidParam(params.workspaceId), input.q),
);
