import { defineHandler } from "@/lib/api/handler";
import { profileSchema } from "@/features/workspaces/schemas";
import { updateProfile } from "@/features/profile/server/service";
import { getMe } from "@/features/workspaces/server/service";

export const GET = defineHandler({}, ({ ctx }) => getMe(ctx));
export const PATCH = defineHandler({ input: profileSchema }, ({ ctx, input }) => updateProfile(ctx, input));
