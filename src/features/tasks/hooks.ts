"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { useErrorToast } from "@/lib/client/errors";
import { qk } from "@/lib/client/keys";
import { clearUndo, registerUndo } from "@/lib/client/undo";
import { invalidateTaskViews, patchEverywhere, removeEverywhere, restore, snapshot, type Patch } from "./cache";
import type { ChecklistItem, Label, MyTaskItem, MyTasks, TaskDetail, TaskItem, TaskSource } from "./types";

// ── Queries ────────────────────────────────────────────────────────────────

export function useProjectTasks(projectId: string) {
  return useQuery({ queryKey: qk.projectTasks(projectId), queryFn: () => api<TaskItem[]>(`/projects/${projectId}/tasks`) });
}

export function useMyTasks(workspaceId: string) {
  return useQuery({ queryKey: qk.myTasks(workspaceId), queryFn: () => api<MyTasks>(`/workspaces/${workspaceId}/my-tasks`) });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: qk.task(taskId ?? "none"),
    queryFn: () => api<TaskDetail>(`/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });
}

export function useLabels(workspaceId: string) {
  return useQuery({ queryKey: qk.labels(workspaceId), queryFn: () => api<Label[]>(`/workspaces/${workspaceId}/labels`), staleTime: 60_000 });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export type NewTask = {
  workspaceId: string;
  projectId?: string | null;
  parentTaskId?: string | null;
  statusId?: string | null;
  title: string;
  priority?: TaskItem["priority"];
  dueDate?: string | null;
  dueTime?: string | null;
  assigneeIds?: string[];
  position?: string | null;
  source: TaskSource;
  /** For the optimistic row: what it should look like before the server answers. */
  optimistic?: { projectId: string; statusId: string; statusCategory: TaskItem["statusCategory"]; position: string };
  /** Also show it in Home / My Tasks right away (the task will be assigned to me). */
  optimisticMine?: { projectId: string; projectName: string; projectColor: string; isPersonalProject: boolean };
};

export function useCreateTask() {
  const qc = useQueryClient();
  const onError = useErrorToast();
  return useMutation({
    mutationFn: ({ optimistic: _o, optimisticMine: _m, ...input }: NewTask & { id: string }) =>
      api<TaskItem>("/tasks", { method: "POST", body: input }),
    onMutate: async (input) => {
      const snap = await snapshot(qc);
      const o = input.optimistic;
      const mine = input.optimisticMine;
      if (mine && !input.parentTaskId) {
        const item: MyTaskItem = {
          id: input.id,
          projectId: mine.projectId,
          statusId: o?.statusId ?? "",
          statusCategory: "todo",
          parentTaskId: null,
          title: input.title,
          priority: input.priority ?? "normal",
          dueDate: input.dueDate ?? null,
          dueTime: input.dueTime ?? null,
          position: o?.position ?? "",
          completedAt: null,
          createdAt: new Date().toISOString(),
          assigneeIds: input.assigneeIds ?? [],
          labelIds: [],
          subtaskCount: 0,
          subtaskDoneCount: 0,
          checklistCount: 0,
          checklistDoneCount: 0,
          projectName: mine.projectName,
          projectColor: mine.projectColor,
          isPersonalProject: mine.isPersonalProject,
        };
        qc.setQueryData<MyTasks>(qk.myTasks(input.workspaceId), (old) => (old ? { ...old, open: [...old.open, item] } : old));
      }
      if (o) {
        const item: TaskItem = {
          id: input.id,
          projectId: o.projectId,
          statusId: o.statusId,
          statusCategory: o.statusCategory,
          parentTaskId: input.parentTaskId ?? null,
          title: input.title,
          priority: input.priority ?? "normal",
          dueDate: input.dueDate ?? null,
          dueTime: input.dueTime ?? null,
          position: o.position,
          completedAt: null,
          createdAt: new Date().toISOString(),
          assigneeIds: input.assigneeIds ?? [],
          labelIds: [],
          subtaskCount: 0,
          subtaskDoneCount: 0,
          checklistCount: 0,
          checklistDoneCount: 0,
        };
        if (input.parentTaskId) {
          qc.setQueryData<TaskDetail>(qk.task(input.parentTaskId), (old) =>
            old ? { ...old, subtasks: [...old.subtasks, item], subtaskCount: old.subtaskCount + 1 } : old,
          );
        } else {
          qc.setQueryData<TaskItem[]>(qk.projectTasks(o.projectId), (old) => (old ? [...old, item] : old));
        }
      }
      return { snap };
    },
    onError: (err, _input, ctx) => {
      if (ctx) restore(qc, ctx.snap);
      onError(err);
    },
    onSettled: (task, _err, input) => {
      invalidateTaskViews(qc, input.workspaceId, [task?.projectId, input.projectId], input.parentTaskId ?? undefined);
      void qc.invalidateQueries({ queryKey: qk.usage(input.workspaceId) });
    },
  });
}

export type TaskUpdate = Partial<{
  title: string;
  description: unknown;
  priority: TaskItem["priority"];
  dueDate: string | null;
  dueTime: string | null;
  statusId: string;
  projectId: string;
  position: string;
  assigneeIds: string[];
  labelIds: string[];
  completed: boolean;
}>;

export function useUpdateTask(workspaceId: string) {
  const qc = useQueryClient();
  const onError = useErrorToast();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskUpdate; optimistic?: Patch; fromProjectId?: string }) =>
      api<TaskItem>(`/tasks/${id}`, { method: "PATCH", body: input }),
    onMutate: async ({ id, input, optimistic, fromProjectId }) => {
      const snap = await snapshot(qc);
      const { description, completed: _c, ...plain } = input;
      const moving = input.projectId && fromProjectId && input.projectId !== fromProjectId;
      patchEverywhere(qc, id, { ...(plain as Patch), ...optimistic }, moving ? { removeFromProject: fromProjectId } : {});
      // The description lives only on the detail: keep it current, or a re-opened panel
      // would start from the old text and the next keystroke would save over the edit.
      if (description !== undefined) {
        qc.setQueryData<TaskDetail>(qk.task(id), (old) => (old ? { ...old, description: description as TaskDetail["description"] } : old));
      }
      return { snap };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) restore(qc, ctx.snap);
      onError(err);
    },
    onSuccess: (task) => patchEverywhere(qc, task.id, task),
    onSettled: (task, _err, vars) => {
      const shapeChanged =
        vars.input.statusId || vars.input.projectId || vars.input.assigneeIds || vars.input.dueDate !== undefined || vars.input.completed !== undefined;
      if (shapeChanged || !task) invalidateTaskViews(qc, workspaceId, [vars.fromProjectId, task?.projectId, vars.input.projectId]);
      if (vars.input.description === undefined) void qc.invalidateQueries({ queryKey: qk.task(vars.id) });
    },
  });
}

export function useDeleteTask(workspaceId: string) {
  const qc = useQueryClient();
  const t = useTranslations("task");
  const tc = useTranslations("common");
  const onError = useErrorToast();
  const restoreMutation = useMutation({
    mutationFn: (id: string) => api<TaskItem>(`/tasks/${id}/restore`, { method: "POST" }),
    onSuccess: (task) => {
      toast(t("restored"));
      invalidateTaskViews(qc, workspaceId, [task.projectId], task.parentTaskId ?? undefined);
    },
    onError,
  });
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string; parentTaskId?: string | null }) =>
      api<null>(`/tasks/${id}`, { method: "DELETE" }),
    onMutate: async ({ id }) => {
      const snap = await snapshot(qc);
      removeEverywhere(qc, id);
      return { snap };
    },
    onError: (err, _v, ctx) => {
      if (ctx) restore(qc, ctx.snap);
      onError(err);
    },
    onSuccess: (_d, { id }) => {
      const undo = () => restoreMutation.mutate(id);
      registerUndo(undo);
      toast(t("deleted"), {
        action: {
          label: tc("undo"),
          onClick: () => {
            clearUndo(undo);
            undo();
          },
        },
        duration: 8000,
      });
    },
    onSettled: (_d, _e, { id, projectId, parentTaskId }) => {
      invalidateTaskViews(qc, workspaceId, [projectId], parentTaskId ?? undefined);
      void qc.removeQueries({ queryKey: qk.task(id), exact: true });
    },
  });
}

export function useChecklist(taskId: string) {
  const qc = useQueryClient();
  const onError = useErrorToast();
  const patchDetail = (fn: (list: ChecklistItem[]) => ChecklistItem[]) =>
    qc.setQueryData<TaskDetail>(qk.task(taskId), (old) => {
      if (!old) return old;
      const checklist = fn(old.checklist);
      return { ...old, checklist, checklistCount: checklist.length, checklistDoneCount: checklist.filter((c) => c.isDone).length };
    });
  const settle = () => {
    void qc.invalidateQueries({ queryKey: qk.task(taskId) });
    void qc.invalidateQueries({ queryKey: ["project-tasks"] });
  };
  return {
    add: useMutation({
      mutationFn: (text: string) => api<ChecklistItem>(`/tasks/${taskId}/checklist`, { method: "POST", body: { text } }),
      onSuccess: (item) => patchDetail((list) => [...list, item]),
      onError,
      onSettled: settle,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string } & Partial<Omit<ChecklistItem, "id">>) =>
        api<ChecklistItem>(`/checklist/${id}`, { method: "PATCH", body: input }),
      onMutate: ({ id, ...input }) => patchDetail((list) => list.map((c) => (c.id === id ? { ...c, ...input } : c))),
      onError,
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<null>(`/checklist/${id}`, { method: "DELETE" }),
      onMutate: (id) => patchDetail((list) => list.filter((c) => c.id !== id)),
      onError,
      onSettled: settle,
    }),
  };
}

export function useCreateLabel(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string }) =>
      api<Label>(`/workspaces/${workspaceId}/labels`, { method: "POST", body: input }),
    onSuccess: (label) => qc.setQueryData<Label[]>(qk.labels(workspaceId), (old) => [...(old ?? []), label]),
  });
}

export function newId(): string {
  return crypto.randomUUID();
}
