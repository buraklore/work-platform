import { z } from "zod";
import { zIsoDate, zPosition, zRichText, zTime, zTitle, zUuid } from "@/lib/validation/common";

export const zPriority = z.enum(["low", "normal", "high", "urgent"]);
export const zTaskSource = z.enum(["quick_add", "list", "board", "subtask", "command", "home"]);

export const createTaskSchema = z.object({
  id: zUuid.optional(),
  workspaceId: zUuid,
  projectId: zUuid.nullish(),
  parentTaskId: zUuid.nullish(),
  statusId: zUuid.nullish(),
  title: zTitle,
  priority: zPriority.optional(),
  dueDate: zIsoDate.nullish(),
  dueTime: zTime.nullish(),
  assigneeIds: z.array(zUuid).max(20).optional(),
  labelIds: z.array(zUuid).max(20).optional(),
  position: zPosition.nullish(),
  source: zTaskSource,
});

export const updateTaskSchema = z
  .object({
    title: zTitle,
    description: zRichText,
    priority: zPriority,
    dueDate: zIsoDate.nullable(),
    dueTime: zTime.nullable(),
    statusId: zUuid,
    projectId: zUuid,
    position: zPosition,
    assigneeIds: z.array(zUuid).max(20),
    labelIds: z.array(zUuid).max(20),
    completed: z.boolean(),
  })
  .partial();

export const checklistCreateSchema = z.object({ text: z.string().trim().min(1).max(500) });
export const checklistUpdateSchema = z
  .object({ text: z.string().trim().min(1).max(500), isDone: z.boolean(), position: zPosition })
  .partial();
