import type { JSONContent } from "@tiptap/react";
import type { StatusCategory, TaskPriority } from "@/lib/db/schema";
import type { ProjectAccess, Status } from "@/features/projects/types";

export type TaskItem = {
  id: string;
  projectId: string;
  statusId: string;
  statusCategory: StatusCategory;
  parentTaskId: string | null;
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  position: string;
  completedAt: string | null;
  createdAt: string;
  assigneeIds: string[];
  labelIds: string[];
  subtaskCount: number;
  subtaskDoneCount: number;
  checklistCount: number;
  checklistDoneCount: number;
};

export type MyTaskItem = TaskItem & {
  projectName: string;
  projectColor: string;
  isPersonalProject: boolean;
};

export type ChecklistItem = { id: string; text: string; isDone: boolean; position: string };

export type TaskDetail = TaskItem & {
  description: JSONContent | null;
  createdBy: string;
  createdByName: string;
  subtasks: TaskItem[];
  checklist: ChecklistItem[];
  project: { id: string; name: string; color: string; isPersonal: boolean; workspaceId: string; archived: boolean };
  statuses: Status[];
  access: ProjectAccess;
  deletedAt: string | null;
};

export type Label = { id: string; name: string; color: string };

export type MyTasks = { open: MyTaskItem[]; completed: MyTaskItem[] };

export type TaskSource = "quick_add" | "list" | "board" | "subtask" | "command" | "home";
