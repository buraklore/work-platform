"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/client/keys";
import type { ProjectDetail, ProjectSummary, Status } from "./types";

export function useProjects(workspaceId: string) {
  return useQuery({
    queryKey: qk.projects(workspaceId),
    queryFn: () => api<ProjectSummary[]>(`/workspaces/${workspaceId}/projects`),
  });
}

export function useProject(projectId: string | null | undefined) {
  return useQuery({
    queryKey: qk.project(projectId ?? "none"),
    queryFn: () => api<ProjectDetail>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string; visibility: "team" | "private"; description?: string }) =>
      api<ProjectSummary>(`/workspaces/${workspaceId}/projects`, { method: "POST", body: input }),
    onSuccess: (project) => {
      qc.setQueryData<ProjectSummary[]>(qk.projects(workspaceId), (old) => (old ? [...old, project] : [project]));
      void qc.invalidateQueries({ queryKey: qk.usage(workspaceId) });
    },
  });
}

export function useUpdateProject(projectId: string, workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{ name: string; color: string; visibility: "team" | "private"; description: string; defaultView: "list" | "board"; archived: boolean }>) =>
      api<ProjectSummary>(`/projects/${projectId}`, { method: "PATCH", body: input }),
    onMutate: async (input) => {
      // Only cancel a refetch of loaded data; cancelling a first load would leave it stuck pending.
      await qc.cancelQueries({ queryKey: qk.project(projectId), predicate: (q) => q.state.data !== undefined });
      const prev = qc.getQueryData<ProjectDetail>(qk.project(projectId));
      if (prev) {
        const { archived, ...rest } = input;
        qc.setQueryData<ProjectDetail>(qk.project(projectId), {
          ...prev,
          ...rest,
          ...(archived !== undefined ? { archivedAt: archived ? new Date().toISOString() : null } : {}),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.project(projectId), ctx.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.project(projectId) });
      void qc.invalidateQueries({ queryKey: qk.projects(workspaceId) });
      void qc.invalidateQueries({ queryKey: qk.myTasks(workspaceId) });
    },
  });
}

export function useStatusMutations(projectId: string) {
  const qc = useQueryClient();
  const settle = () => {
    void qc.invalidateQueries({ queryKey: qk.project(projectId) });
    void qc.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
  };
  return {
    create: useMutation({
      mutationFn: (input: { name: string; category: Status["category"]; color: string }) =>
        api<Status>(`/projects/${projectId}/statuses`, { method: "POST", body: input }),
      onSettled: settle,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string } & Partial<Omit<Status, "id">>) =>
        api<Status[]>(`/statuses/${id}`, { method: "PATCH", body: input }),
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: ({ id, moveTo }: { id: string; moveTo: string }) =>
        api<Status[]>(`/statuses/${id}?moveTo=${moveTo}`, { method: "DELETE" }),
      onSettled: settle,
    }),
  };
}

export function sortStatuses(statuses: Status[]) {
  return [...statuses].sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
}
