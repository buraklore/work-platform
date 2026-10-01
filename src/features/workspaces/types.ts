import type { WorkspaceRole } from "@/lib/db/schema";
export type { WorkspaceRole };

export type WorkspaceSummary = { id: string; name: string; slug: string; role: WorkspaceRole; plan: string };

export type Me = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  theme: "light" | "dark" | "system";
  lastWorkspaceId: string | null;
  /** Accepted the terms of use + KVKK notice (always true for password sign-ups). */
  termsAccepted: boolean;
  workspaces: WorkspaceSummary[];
};

export type WorkspaceUsage = { members: number; guests: number; projects: number; activeTasks: number };

export type Member = {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
};

export type InviteLink = {
  id: string;
  role: WorkspaceRole;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  createdAt: string;
  invitedByName: string;
};

export type InvitePreview = {
  workspaceName: string | null;
  workspaceSlug: string | null;
  inviterName: string | null;
  role: WorkspaceRole | null;
  state: "valid" | "invalid" | "expired" | "revoked" | "used" | "already_member";
};

export const USE_CASES = ["personal", "startup", "agency", "marketing", "software", "team", "other"] as const;
export type UseCase = (typeof USE_CASES)[number];
