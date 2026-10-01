import type { Member } from "@/features/workspaces/types";
import type { ProjectDetail } from "./types";

/**
 * Mirrors app.project_access_of() in SQL: who can see a project, so the UI only offers
 * assignees the database will accept (an assignee must be able to see the task).
 */
export function canSeeProject(
  project: Pick<ProjectDetail, "isPersonal" | "visibility" | "members">,
  member: Pick<Member, "userId" | "role">,
  meId: string | undefined,
): boolean {
  if (project.isPersonal) return member.userId === meId; // only its owner ever opens it
  if (member.role === "owner" || member.role === "admin") return true;
  if (project.members.some((m) => m.userId === member.userId)) return true;
  return project.visibility === "team" && member.role === "member";
}

export function eligibleAssignees(
  project: Pick<ProjectDetail, "isPersonal" | "visibility" | "members"> | undefined,
  members: Member[],
  meId: string | undefined,
): Member[] {
  if (!project) return members;
  return members.filter((m) => canSeeProject(project, m, meId));
}
