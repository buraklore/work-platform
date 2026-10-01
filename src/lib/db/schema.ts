/**
 * Typed mirror of supabase/migrations. The SQL files are the source of truth
 * (they carry RLS, triggers and functions); tests/integration/schema-drift.test.ts
 * fails if a column declared here does not exist in the migrated database.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const createdAt = () => ts("created_at").notNull().defaultNow();
/** Filled by a BEFORE trigger from the parent row (tenant integrity) — never trust client input. */
const inheritedWorkspaceId = () => uuid("workspace_id").notNull().default(sql`null`);

export const workspaceRole = pgEnum("workspace_role", ["owner", "admin", "member", "guest"]);
export const projectRole = pgEnum("project_role", ["admin", "member", "viewer"]);
export const projectVisibility = pgEnum("project_visibility", ["team", "private"]);
export const statusCategory = pgEnum("status_category", ["todo", "in_progress", "done"]);
export const taskPriority = pgEnum("task_priority", ["low", "normal", "high", "urgent"]);
export const invitationKind = pgEnum("invitation_kind", ["link", "email"]);
export const projectView = pgEnum("project_view", ["list", "board"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull().default(""),
  avatarUrl: text("avatar_url"),
  locale: text("locale").notNull().default("tr"),
  timezone: text("timezone").notNull().default("Europe/Istanbul"),
  theme: text("theme").notNull().default("system"),
  lastWorkspaceId: uuid("last_workspace_id"),
  marketingConsentAt: ts("marketing_consent_at"),
  onboardingCompletedAt: ts("onboarding_completed_at"),
  termsAcceptedAt: ts("terms_accepted_at"),
  deletedAt: ts("deleted_at"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  logoUrl: text("logo_url"),
  useCase: text("use_case"),
  plan: text("plan").notNull().default("free"),
  createdBy: uuid("created_by").notNull(),
  deletedAt: ts("deleted_at"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: workspaceRole("role").notNull().default("member"),
    joinedAt: ts("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#3B4FE4"),
  visibility: projectVisibility("visibility").notNull().default("team"),
  defaultView: projectView("default_view").notNull().default("list"),
  isSample: boolean("is_sample").notNull().default(false),
  isPersonal: boolean("is_personal").notNull().default(false),
  position: text("position").notNull().default("a0"),
  archivedAt: ts("archived_at"),
  deletedAt: ts("deleted_at"),
  createdBy: uuid("created_by").notNull(),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id").notNull(),
    workspaceId: inheritedWorkspaceId(),
    userId: uuid("user_id").notNull(),
    role: projectRole("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

export const projectStatuses = pgTable("project_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(),
  workspaceId: inheritedWorkspaceId(),
  name: text("name").notNull(),
  category: statusCategory("category").notNull(),
  color: text("color").notNull().default("#8A8FA3"),
  position: text("position").notNull(),
  createdAt: createdAt(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: inheritedWorkspaceId(),
  projectId: uuid("project_id").notNull(),
  statusId: uuid("status_id").notNull(),
  parentTaskId: uuid("parent_task_id"),
  title: text("title").notNull(),
  description: jsonb("description"),
  priority: taskPriority("priority").notNull().default("normal"),
  dueDate: date("due_date", { mode: "string" }),
  dueTime: time("due_time"),
  position: text("position").notNull(),
  createdBy: uuid("created_by").notNull(),
  completedAt: ts("completed_at"),
  deletedAt: ts("deleted_at"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id").notNull(),
    workspaceId: inheritedWorkspaceId(),
    userId: uuid("user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] })],
);

export const labels = pgTable("labels", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8A8FA3"),
  createdAt: createdAt(),
});

export const taskLabels = pgTable(
  "task_labels",
  {
    taskId: uuid("task_id").notNull(),
    labelId: uuid("label_id").notNull(),
    workspaceId: inheritedWorkspaceId(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] })],
);

export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  workspaceId: inheritedWorkspaceId(),
  text: text("text").notNull(),
  isDone: boolean("is_done").notNull().default(false),
  position: text("position").notNull(),
  createdAt: createdAt(),
});

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id"),
  taskId: uuid("task_id"),
  actorId: uuid("actor_id"),
  verb: text("verb").notNull(),
  data: jsonb("data").notNull().default({}),
  createdAt: createdAt(),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  projectId: uuid("project_id"),
  kind: invitationKind("kind").notNull(),
  email: text("email"),
  role: workspaceRole("role").notNull(),
  projectRole: projectRole("project_role"),
  tokenHash: text("token_hash").notNull(),
  invitedBy: uuid("invited_by").notNull(),
  expiresAt: ts("expires_at").notNull(),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  acceptedAt: ts("accepted_at"),
  revokedAt: ts("revoked_at"),
  createdAt: createdAt(),
});

export const subscriptions = pgTable("subscriptions", {
  workspaceId: uuid("workspace_id").primaryKey(),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  currentPeriodEnd: ts("current_period_end"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id"),
  workspaceId: uuid("workspace_id"),
  name: text("name").notNull(),
  props: jsonb("props").notNull().default({}),
  createdAt: createdAt(),
});

export const userViewPrefs = pgTable(
  "user_view_prefs",
  {
    userId: uuid("user_id").notNull(),
    projectId: uuid("project_id").notNull(),
    view: projectView("view").notNull().default("list"),
    filters: jsonb("filters").notNull().default({}),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.projectId] })],
);

export const cronRuns = pgTable("cron_runs", {
  job: text("job").primaryKey(),
  lastRunAt: ts("last_run_at").notNull(),
  lastResult: jsonb("last_result").notNull().default({}),
});

export type WorkspaceRole = (typeof workspaceRole.enumValues)[number];
export type ProjectRole = (typeof projectRole.enumValues)[number];
export type ProjectVisibility = (typeof projectVisibility.enumValues)[number];
export type StatusCategory = (typeof statusCategory.enumValues)[number];
export type TaskPriority = (typeof taskPriority.enumValues)[number];
export type ProjectView = (typeof projectView.enumValues)[number];
