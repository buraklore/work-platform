import { z } from "zod";
import { zName } from "@/lib/validation/common";
import { USE_CASES } from "./types";

export const createWorkspaceSchema = z.object({ name: zName(80), useCase: z.enum(USE_CASES).nullish() });
export const updateWorkspaceSchema = z.object({ name: zName(80) });
export const inviteLinkSchema = z.object({
  role: z.enum(["admin", "member", "guest"]),
  expiresInDays: z.enum(["1", "7", "30"]),
  maxUses: z.number().int().min(1).max(100).nullable(),
});
export const inviteTokenSchema = z.object({ token: z.string().min(20).max(64).regex(/^[A-Za-z0-9_-]+$/) });
export const profileSchema = z
  .object({
    fullName: zName(120),
    theme: z.enum(["light", "dark", "system"]),
    onboardingCompleted: z.boolean(),
    acceptTerms: z.literal(true),
  })
  .partial();
export const labelSchema = z.object({ name: zName(40), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) });
