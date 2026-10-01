import { z } from "zod";
import { zColor, zName, zPosition, zUuid } from "@/lib/validation/common";

export const zVisibility = z.enum(["team", "private"]);
export const zCategory = z.enum(["todo", "in_progress", "done"]);

export const createProjectSchema = z.object({
  name: zName(120),
  color: zColor,
  visibility: zVisibility,
  description: z.string().max(2000).optional(),
});

export const updateProjectSchema = z
  .object({
    name: zName(120),
    color: zColor,
    visibility: zVisibility,
    description: z.string().max(2000),
    defaultView: z.enum(["list", "board"]),
    archived: z.boolean(),
  })
  .partial();

export const createStatusSchema = z.object({ name: zName(40), category: zCategory, color: zColor });
export const updateStatusSchema = z
  .object({ name: zName(40), category: zCategory, color: zColor, position: zPosition })
  .partial();
export const deleteStatusSchema = z.object({ moveTo: zUuid });
export const projectMemberSchema = z.object({ userId: zUuid, role: z.enum(["admin", "member", "viewer"]) });
