import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { qk } from "@/lib/client/keys";
import type { MyTasks, TaskDetail, TaskItem } from "./types";

/** Cache plumbing for optimistic task updates (pure: unit-tested in tests/unit/task-cache.test.ts). */
const TASK_CACHES: QueryKey[] = [["project-tasks"], ["my-tasks"], ["task"]];
export type Snapshot = Array<[QueryKey, unknown]>;

/**
 * Before an optimistic write: stop in-flight refetches so they cannot overwrite it, and
 * remember the data for rollback. Only queries that already HAVE data are cancelled —
 * cancelling a first load reverts it to "pending + idle", leaving a skeleton forever.
 */
export async function snapshot(qc: QueryClient): Promise<Snapshot> {
  await Promise.all(
    TASK_CACHES.map((queryKey) => qc.cancelQueries({ queryKey, predicate: (q) => q.state.data !== undefined })),
  );
  return TASK_CACHES.flatMap((queryKey) => qc.getQueriesData({ queryKey }));
}

export function restore(qc: QueryClient, snap: Snapshot) {
  for (const [key, data] of snap) qc.setQueryData(key, data);
}

export type Patch = Partial<TaskItem> & { projectName?: string; projectColor?: string };

/** Apply a patch to every cached copy of a task, keeping My Tasks' open/completed split right. */
export function patchEverywhere(qc: QueryClient, taskId: string, patch: Patch, opts: { removeFromProject?: string } = {}) {
  for (const [key, data] of qc.getQueriesData<TaskItem[]>({ queryKey: ["project-tasks"] })) {
    if (!data) continue;
    if (opts.removeFromProject && key[1] === opts.removeFromProject) {
      qc.setQueryData(key, data.filter((t) => t.id !== taskId));
    } else if (data.some((t) => t.id === taskId)) {
      qc.setQueryData(key, data.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    }
  }
  for (const [key, data] of qc.getQueriesData<MyTasks>({ queryKey: ["my-tasks"] })) {
    if (!data) continue;
    const all = [...data.open, ...data.completed];
    const found = all.find((t) => t.id === taskId);
    if (!found) continue;
    const next = { ...found, ...patch };
    const rest = all.filter((t) => t.id !== taskId);
    const merged = [...rest, next];
    qc.setQueryData<MyTasks>(key, {
      open: merged.filter((t) => !t.completedAt),
      completed: merged.filter((t) => t.completedAt).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    });
  }
  for (const [key, data] of qc.getQueriesData<TaskDetail>({ queryKey: ["task"] })) {
    if (!data) continue;
    if (data.id === taskId) qc.setQueryData(key, { ...data, ...patch });
    else if (data.subtasks.some((s) => s.id === taskId)) {
      qc.setQueryData(key, { ...data, subtasks: data.subtasks.map((s) => (s.id === taskId ? { ...s, ...patch } : s)) });
    }
  }
}

export function removeEverywhere(qc: QueryClient, taskId: string) {
  for (const [key, data] of qc.getQueriesData<TaskItem[]>({ queryKey: ["project-tasks"] })) {
    if (data?.some((t) => t.id === taskId)) qc.setQueryData(key, data.filter((t) => t.id !== taskId));
  }
  for (const [key, data] of qc.getQueriesData<MyTasks>({ queryKey: ["my-tasks"] })) {
    if (!data) continue;
    qc.setQueryData<MyTasks>(key, {
      open: data.open.filter((t) => t.id !== taskId),
      completed: data.completed.filter((t) => t.id !== taskId),
    });
  }
  for (const [key, data] of qc.getQueriesData<TaskDetail>({ queryKey: ["task"] })) {
    if (data?.subtasks.some((s) => s.id === taskId)) {
      qc.setQueryData(key, { ...data, subtasks: data.subtasks.filter((s) => s.id !== taskId), subtaskCount: data.subtaskCount - 1 });
    }
  }
}

export function invalidateTaskViews(qc: QueryClient, workspaceId: string, projectIds: Array<string | null | undefined>, taskId?: string) {
  void qc.invalidateQueries({ queryKey: qk.myTasks(workspaceId) });
  for (const id of new Set(projectIds.filter(Boolean) as string[])) {
    void qc.invalidateQueries({ queryKey: qk.projectTasks(id) });
  }
  void qc.invalidateQueries({ queryKey: qk.projects(workspaceId) });
  if (taskId) void qc.invalidateQueries({ queryKey: qk.task(taskId) });
}
