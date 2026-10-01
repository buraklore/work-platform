import "server-only";
import { activities, analyticsEvents } from "./schema";
import type { Tx } from "./with-user";

export type ActivityVerb =
  | "task.created"
  | "task.completed"
  | "task.reopened"
  | "task.assigned"
  | "task.unassigned"
  | "task.due_changed"
  | "task.moved"
  | "task.renamed"
  | "task.deleted"
  | "task.restored"
  | "project.created"
  | "project.archived"
  | "project.unarchived"
  | "project.deleted"
  | "project.restored"
  | "member.joined";

export async function logActivity(
  tx: Tx,
  entry: {
    workspaceId: string;
    actorId: string;
    verb: ActivityVerb;
    projectId?: string | null;
    taskId?: string | null;
    data?: Record<string, unknown>;
  },
) {
  await tx.insert(activities).values({
    workspaceId: entry.workspaceId,
    actorId: entry.actorId,
    verb: entry.verb,
    projectId: entry.projectId ?? null,
    taskId: entry.taskId ?? null,
    data: entry.data ?? {},
  });
}

export type AnalyticsEvent =
  | "signup"
  | "workspace_created"
  | "project_created"
  | "task_created"
  | "task_completed"
  | "invite_sent"
  | "member_left"
  | "member_removed"
  | "invite_accepted";

/** First-party, cookieless product analytics. Never put PII or task content in props. */
export async function track(
  tx: Tx,
  event: { userId: string; workspaceId?: string | null; name: AnalyticsEvent; props?: Record<string, string | number | boolean> },
) {
  await tx.insert(analyticsEvents).values({
    userId: event.userId,
    workspaceId: event.workspaceId ?? null,
    name: event.name,
    props: event.props ?? {},
  });
}
