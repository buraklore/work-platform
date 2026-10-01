"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/client/keys";
import type { Me, Member, WorkspaceSummary } from "./types";

type Value = { workspace: WorkspaceSummary };
const WorkspaceContext = createContext<Value | null>(null);

export function WorkspaceProvider({ workspace, children }: { workspace: WorkspaceSummary; children: React.ReactNode }) {
  return <WorkspaceContext.Provider value={{ workspace }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceSummary {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value.workspace;
}

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: () => api<Me>("/me"), staleTime: 60_000 });
}

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: qk.members(workspaceId),
    queryFn: () => api<Member[]>(`/workspaces/${workspaceId}/members`),
    // New teammates should become assignable quickly (also refetched on window focus).
    staleTime: 30_000,
  });
}

/** Map of userId → member for rendering avatars/names. */
export function useMemberMap(workspaceId: string) {
  const { data } = useMembers(workspaceId);
  return new Map((data ?? []).map((m) => [m.userId, m]));
}

export const canManage = (role: WorkspaceSummary["role"]) => role === "owner" || role === "admin";
