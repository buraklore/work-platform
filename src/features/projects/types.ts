import type { ProjectRole, ProjectView, ProjectVisibility, StatusCategory } from "@/lib/db/schema";

export type ProjectAccess = ProjectRole; // admin | member | viewer

export type ProjectSummary = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  visibility: ProjectVisibility;
  isPersonal: boolean;
  isSample: boolean;
  archivedAt: string | null;
  position: string;
  openCount: number;
  doneCount: number;
  access: ProjectAccess;
};

export type Status = { id: string; name: string; category: StatusCategory; color: string; position: string };

export type ProjectMember = {
  userId: string;
  role: ProjectRole;
  fullName: string;
  email: string;
  avatarUrl: string | null;
};

export type ProjectDetail = ProjectSummary & {
  description: string;
  defaultView: ProjectView;
  statuses: Status[];
  members: ProjectMember[];
};

export const PROJECT_COLORS = [
  "#3B4FE4",
  "#12998F",
  "#E0513F",
  "#C98A0B",
  "#8B5CF6",
  "#DB2777",
  "#0EA5E9",
  "#65A30D",
  "#6B6F80",
] as const;
