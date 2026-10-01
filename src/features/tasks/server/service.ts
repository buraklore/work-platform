import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { limitsFor } from "@/config/plans";
import type { Ctx } from "@/lib/api/handler";
import { ForbiddenError, LimitError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { logActivity, track } from "@/lib/db/audit";
import {
  checklistItems,
  labels,
  profiles,
  projectStatuses,
  taskAssignees,
  taskLabels,
  tasks,
  type TaskPriority,
} from "@/lib/db/schema";
import { iso } from "@/lib/db/time";
import { withUser, type Tx } from "@/lib/db/with-user";
import { freshKeys, keyBetween, needsRebalance } from "@/lib/positions";
import { trCompare } from "@/lib/text/tr";
import { personalProjectIdTx, listStatusesTx, requireProjectTx } from "@/features/projects/server/service";
import { getUsageTx, requireWorkspaceTx } from "@/features/workspaces/server/service";
import type { ChecklistItem, Label, MyTaskItem, MyTasks, TaskDetail, TaskItem, TaskSource } from "../types";

// ── Read models ────────────────────────────────────────────────────────────

const ITEM_COLUMNS = sql`
  t.id, t.project_id as "projectId", t.status_id as "statusId", s.category as "statusCategory",
  t.parent_task_id as "parentTaskId", t.title, t.priority,
  t.due_date::text as "dueDate", to_char(t.due_time, 'HH24:MI') as "dueTime",
  t.position, t.completed_at as "completedAt", t.created_at as "createdAt",
  array(select a.user_id::text from public.task_assignees a where a.task_id = t.id order by a.created_at) as "assigneeIds",
  array(select l.label_id::text from public.task_labels l where l.task_id = t.id) as "labelIds",
  (select count(*)::int from public.tasks c where c.parent_task_id = t.id and c.deleted_at is null) as "subtaskCount",
  (select count(*)::int from public.tasks c where c.parent_task_id = t.id and c.deleted_at is null and c.completed_at is not null) as "subtaskDoneCount",
  (select count(*)::int from public.checklist_items ci where ci.task_id = t.id) as "checklistCount",
  (select count(*)::int from public.checklist_items ci where ci.task_id = t.id and ci.is_done) as "checklistDoneCount"`;

type RawItem = Omit<TaskItem, "completedAt" | "createdAt"> & { completedAt: unknown; createdAt: unknown };
const toItem = <T extends RawItem>(r: T) => ({ ...r, completedAt: iso(r.completedAt), createdAt: iso(r.createdAt)! });

export async function listProjectTasks(ctx: Ctx, projectId: string): Promise<TaskItem[]> {
  return withUser(ctx.claims, async (tx) => {
    await requireProjectTx(tx, projectId);
    const rows = (await tx.execute(sql`
      select ${ITEM_COLUMNS}
        from public.tasks t join public.project_statuses s on s.id = t.status_id
       where t.project_id = ${projectId}::uuid and t.parent_task_id is null and t.deleted_at is null
       order by t.position, t.created_at`)) as unknown as RawItem[];
    return rows.map(toItem);
  });
}

async function listSubtasksTx(tx: Tx, parentId: string): Promise<TaskItem[]> {
  const rows = (await tx.execute(sql`
    select ${ITEM_COLUMNS}
      from public.tasks t join public.project_statuses s on s.id = t.status_id
     where t.parent_task_id = ${parentId}::uuid and t.deleted_at is null
     order by t.position, t.created_at`)) as unknown as RawItem[];
  return rows.map(toItem);
}

async function getItemTx(tx: Tx, taskId: string): Promise<TaskItem> {
  const rows = (await tx.execute(sql`
    select ${ITEM_COLUMNS}
      from public.tasks t join public.project_statuses s on s.id = t.status_id
     where t.id = ${taskId}::uuid`)) as unknown as RawItem[];
  if (!rows[0]) throw new NotFoundError();
  return toItem(rows[0]);
}

/** Open tasks assigned to me + tasks I completed in the last 30 days. Powers Home and My Tasks. */
export async function myTasks(ctx: Ctx, workspaceId: string): Promise<MyTasks> {
  return withUser(ctx.claims, async (tx) => {
    await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    const rows = (await tx.execute(sql`
      select ${ITEM_COLUMNS}, p.name as "projectName", p.color as "projectColor", p.is_personal as "isPersonalProject"
        from public.tasks t
        join public.task_assignees me on me.task_id = t.id and me.user_id = app.uid()
        join public.project_statuses s on s.id = t.status_id
        join public.projects p on p.id = t.project_id
        left join public.tasks parent on parent.id = t.parent_task_id
       where t.workspace_id = ${workspaceId}::uuid
         and t.deleted_at is null and p.deleted_at is null and p.archived_at is null
         and (t.parent_task_id is null or parent.deleted_at is null)
         and (t.completed_at is null or t.completed_at > now() - interval '30 days')
       order by t.due_date nulls last, t.due_time nulls last, t.created_at
       limit 1000`)) as unknown as Array<RawItem & Pick<MyTaskItem, "projectName" | "projectColor" | "isPersonalProject">>;
    const items = rows.map(toItem);
    return {
      open: items.filter((t) => !t.completedAt),
      completed: items
        .filter((t) => t.completedAt)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    };
  });
}

export async function getTask(ctx: Ctx, taskId: string): Promise<TaskDetail> {
  return withUser(ctx.claims, async (tx) => {
    const [row] = await tx
      .select({
        projectId: tasks.projectId,
        description: tasks.description,
        createdBy: tasks.createdBy,
        deletedAt: tasks.deletedAt,
        createdByName: profiles.fullName,
      })
      .from(tasks)
      .leftJoin(profiles, eq(profiles.id, tasks.createdBy))
      .where(eq(tasks.id, taskId));
    if (!row || row.deletedAt) throw new NotFoundError();
    const project = await requireProjectTx(tx, row.projectId);
    const item = await getItemTx(tx, taskId);
    if (item.parentTaskId) {
      // A subtask whose parent was deleted is gone too (they were deleted as one batch).
      const [parent] = await tx.select({ deletedAt: tasks.deletedAt }).from(tasks).where(eq(tasks.id, item.parentTaskId));
      if (!parent || parent.deletedAt) throw new NotFoundError();
    }
    const checklist = await tx
      .select({ id: checklistItems.id, text: checklistItems.text, isDone: checklistItems.isDone, position: checklistItems.position })
      .from(checklistItems)
      .where(eq(checklistItems.taskId, taskId))
      .orderBy(asc(checklistItems.position), asc(checklistItems.createdAt));
    return {
      ...item,
      description: (row.description as TaskDetail["description"]) ?? null,
      createdBy: row.createdBy,
      createdByName: row.createdByName ?? "",
      deletedAt: iso(row.deletedAt),
      subtasks: item.parentTaskId ? [] : await listSubtasksTx(tx, taskId),
      checklist,
      project: {
        id: project.id,
        name: project.name,
        color: project.color,
        isPersonal: project.isPersonal,
        workspaceId: project.workspaceId,
        archived: project.archivedAt !== null,
      },
      statuses: await listStatusesTx(tx, project.id),
      access: project.access,
    };
  });
}

// ── Writes ─────────────────────────────────────────────────────────────────

type TaskRow = typeof tasks.$inferSelect;

async function requireTaskTx(tx: Tx, taskId: string, opts: { includeDeleted?: boolean } = {}) {
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || (!opts.includeDeleted && task.deletedAt)) throw new NotFoundError();
  const project = await requireProjectTx(tx, task.projectId);
  return { task, project };
}

/** A task the caller may change: visible, editor access, project not archived. */
async function requireEditableTaskTx(tx: Tx, taskId: string, opts: { includeDeleted?: boolean } = {}) {
  const found = await requireTaskTx(tx, taskId, opts);
  if (found.project.access === "viewer") throw new ForbiddenError();
  if (found.project.archivedAt) throw new ValidationError("project_archived");
  return found;
}

async function assertActiveTaskLimit(tx: Tx, workspaceId: string, plan: string) {
  const limit = limitsFor(plan).activeTasks;
  if (limit === null) return;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tasks:' || ${workspaceId}))`);
  const usage = await getUsageTx(tx, workspaceId);
  if (usage.activeTasks >= limit) throw new LimitError("active_tasks");
}

async function rebalanceGroupTx(tx: Tx, task: Pick<TaskRow, "projectId" | "statusId" | "parentTaskId">) {
  const siblings = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, task.projectId),
        eq(tasks.statusId, task.statusId),
        task.parentTaskId ? eq(tasks.parentTaskId, task.parentTaskId) : isNull(tasks.parentTaskId),
        isNull(tasks.deletedAt),
      ),
    )
    .orderBy(asc(tasks.position), asc(tasks.createdAt));
  const keys = freshKeys(siblings.length);
  for (let i = 0; i < siblings.length; i++) {
    await tx.update(tasks).set({ position: keys[i]! }).where(eq(tasks.id, siblings[i]!.id));
  }
}

async function lastPositionTx(tx: Tx, projectId: string, statusId: string, parentTaskId: string | null) {
  const [last] = await tx
    .select({ position: tasks.position })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.statusId, statusId),
        parentTaskId ? eq(tasks.parentTaskId, parentTaskId) : isNull(tasks.parentTaskId),
        isNull(tasks.deletedAt),
      ),
    )
    .orderBy(desc(tasks.position))
    .limit(1);
  return last?.position ?? null;
}

export type CreateTaskInput = {
  id?: string;
  workspaceId: string;
  projectId?: string | null;
  parentTaskId?: string | null;
  statusId?: string | null;
  title: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
  position?: string | null;
  source: TaskSource;
};

export async function createTask(ctx: Ctx, input: CreateTaskInput): Promise<TaskItem> {
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, input.workspaceId);
    if (ws.role === "guest" && !input.projectId && !input.parentTaskId) throw new ValidationError("project_required");

    let projectId = input.projectId ?? null;
    if (input.parentTaskId) {
      const parent = await requireTaskTx(tx, input.parentTaskId);
      if (parent.task.parentTaskId) throw new ValidationError("subtask_depth");
      projectId = parent.task.projectId;
    }
    if (!projectId) projectId = await personalProjectIdTx(tx, input.workspaceId, ctx.userId);

    const project = await requireProjectTx(tx, projectId);
    if (project.workspaceId !== input.workspaceId) throw new NotFoundError();
    if (project.access === "viewer") throw new ForbiddenError();
    if (project.archivedAt) throw new ValidationError("project_archived");

    const statuses = await listStatusesTx(tx, projectId);
    const status = input.statusId ? statuses.find((s) => s.id === input.statusId) : statuses.find((s) => s.category === "todo");
    if (!status) throw new ValidationError("invalid_status");
    if (status.category !== "done") await assertActiveTaskLimit(tx, input.workspaceId, ws.plan);

    const parentTaskId = input.parentTaskId ?? null;
    const position = input.position ?? keyBetween(await lastPositionTx(tx, projectId, status.id, parentTaskId), null);
    const id = input.id ?? crypto.randomUUID();

    await tx.insert(tasks).values({
      id,
      workspaceId: input.workspaceId,
      projectId,
      statusId: status.id,
      parentTaskId,
      title: input.title.trim(),
      priority: input.priority ?? "normal",
      dueDate: input.dueDate ?? null,
      dueTime: input.dueDate ? (input.dueTime ?? null) : null,
      position,
      createdBy: ctx.userId,
    });

    // Tasks in my personal project are mine unless I said otherwise.
    const assigneeIds = input.assigneeIds ?? (project.isPersonal ? [ctx.userId] : []);
    if (assigneeIds.length > 0) {
      await tx.insert(taskAssignees).values([...new Set(assigneeIds)].map((userId) => ({ taskId: id, userId })));
    }
    if (input.labelIds && input.labelIds.length > 0) {
      await tx.insert(taskLabels).values([...new Set(input.labelIds)].map((labelId) => ({ taskId: id, labelId })));
    }
    if (needsRebalance(position)) await rebalanceGroupTx(tx, { projectId, statusId: status.id, parentTaskId });

    await logActivity(tx, { workspaceId: input.workspaceId, actorId: ctx.userId, verb: "task.created", projectId, taskId: id });
    await track(tx, {
      userId: ctx.userId,
      workspaceId: input.workspaceId,
      name: "task_created",
      props: { source: input.source, hasDue: Boolean(input.dueDate), assigned: assigneeIds.length > 0 },
    });
    return getItemTx(tx, id);
  });
}

export type UpdateTaskInput = Partial<{
  title: string;
  description: unknown;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  statusId: string;
  projectId: string;
  position: string;
  assigneeIds: string[];
  labelIds: string[];
  /** Shortcut for list rows: first "done" / first "todo" status of the task's project. */
  completed: boolean;
}>;

export async function updateTask(ctx: Ctx, taskId: string, input: UpdateTaskInput): Promise<TaskItem> {
  return withUser(ctx.claims, async (tx) => {
    const { task } = await requireEditableTaskTx(tx, taskId);
    if (input.completed !== undefined && input.statusId === undefined && input.projectId === undefined) {
      const statuses = await listStatusesTx(tx, task.projectId);
      const current = statuses.find((s) => s.id === task.statusId);
      const isDone = current?.category === "done";
      if (input.completed !== isDone) {
        const next = statuses.find((s) => s.category === (input.completed ? "done" : "todo"));
        if (next) input = { ...input, statusId: next.id };
      }
    }
    const base = { workspaceId: task.workspaceId, actorId: ctx.userId, taskId };
    const patch: Partial<typeof tasks.$inferInsert> = {};

    if (input.title !== undefined && input.title.trim() !== task.title) {
      patch.title = input.title.trim();
      await logActivity(tx, { ...base, projectId: task.projectId, verb: "task.renamed" });
    }
    if (input.description !== undefined) patch.description = input.description;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.dueDate !== undefined || input.dueTime !== undefined) {
      const dueDate = input.dueDate !== undefined ? input.dueDate : task.dueDate;
      const dueTime = dueDate ? (input.dueTime !== undefined ? input.dueTime : task.dueTime) : null;
      patch.dueDate = dueDate;
      patch.dueTime = dueTime;
      await logActivity(tx, { ...base, projectId: task.projectId, verb: "task.due_changed", data: { dueDate, dueTime } });
    }

    let targetProjectId = task.projectId;
    let targetStatusId = input.statusId ?? task.statusId;

    if (input.projectId && input.projectId !== task.projectId) {
      if (task.parentTaskId) throw new ValidationError("move_subtask");
      const target = await requireProjectTx(tx, input.projectId);
      if (target.workspaceId !== task.workspaceId) throw new NotFoundError();
      if (target.access === "viewer") throw new ForbiddenError();
      if (target.archivedAt) throw new ValidationError("project_archived");
      const [currentStatus] = await tx
        .select({ category: projectStatuses.category })
        .from(projectStatuses)
        .where(eq(projectStatuses.id, task.statusId));
      const targetStatuses = await listStatusesTx(tx, target.id);
      const explicit = input.statusId ? targetStatuses.find((s) => s.id === input.statusId) : undefined;
      const sameCategory = targetStatuses.find((s) => s.category === currentStatus?.category);
      const chosen = explicit ?? sameCategory ?? targetStatuses.find((s) => s.category === "todo");
      if (!chosen) throw new ValidationError("invalid_status");
      targetProjectId = target.id;
      targetStatusId = chosen.id;
      patch.projectId = target.id;
      patch.statusId = chosen.id;
      await logActivity(tx, {
        ...base,
        projectId: target.id,
        verb: "task.moved",
        data: { fromProjectId: task.projectId, toProjectId: target.id },
      });
    } else if (input.statusId && input.statusId !== task.statusId) {
      const statuses = await listStatusesTx(tx, task.projectId);
      const next = statuses.find((s) => s.id === input.statusId);
      if (!next) throw new ValidationError("invalid_status");
      const prev = statuses.find((s) => s.id === task.statusId);
      if (prev?.category === "done" && next.category !== "done") {
        const ws = await requireWorkspaceTx(tx, ctx.userId, task.workspaceId);
        await assertActiveTaskLimit(tx, task.workspaceId, ws.plan);
      }
      patch.statusId = next.id;
      if (prev?.category !== "done" && next.category === "done") {
        await logActivity(tx, { ...base, projectId: task.projectId, verb: "task.completed" });
        await track(tx, { userId: ctx.userId, workspaceId: task.workspaceId, name: "task_completed" });
      } else if (prev?.category === "done" && next.category !== "done") {
        await logActivity(tx, { ...base, projectId: task.projectId, verb: "task.reopened" });
      }
    }

    if (input.position !== undefined) patch.position = input.position;
    else if (patch.statusId || patch.projectId) {
      patch.position = keyBetween(await lastPositionTx(tx, targetProjectId, targetStatusId, task.parentTaskId), null);
    }

    if (Object.keys(patch).length > 0) {
      await tx.update(tasks).set(patch).where(eq(tasks.id, taskId));
    }

    if (input.assigneeIds) {
      const next = [...new Set(input.assigneeIds)];
      const current = (
        await tx.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, taskId))
      ).map((r) => r.userId);
      const toAdd = next.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !next.includes(id));
      if (toRemove.length > 0) {
        await tx.delete(taskAssignees).where(and(eq(taskAssignees.taskId, taskId), inArray(taskAssignees.userId, toRemove)));
        await logActivity(tx, { ...base, projectId: targetProjectId, verb: "task.unassigned", data: { userIds: toRemove } });
      }
      if (toAdd.length > 0) {
        await tx.insert(taskAssignees).values(toAdd.map((userId) => ({ taskId, userId })));
        await logActivity(tx, { ...base, projectId: targetProjectId, verb: "task.assigned", data: { userIds: toAdd } });
      }
    }

    if (input.labelIds) {
      const next = [...new Set(input.labelIds)];
      await tx.delete(taskLabels).where(eq(taskLabels.taskId, taskId));
      if (next.length > 0) await tx.insert(taskLabels).values(next.map((labelId) => ({ taskId, labelId })));
    }

    if (patch.position && needsRebalance(patch.position)) {
      await rebalanceGroupTx(tx, { projectId: targetProjectId, statusId: targetStatusId, parentTaskId: task.parentTaskId });
    }
    return getItemTx(tx, taskId);
  });
}

/** Soft delete; subtasks share the parent's deleted_at so undo restores exactly this batch. */
export async function deleteTask(ctx: Ctx, taskId: string) {
  return withUser(ctx.claims, async (tx) => {
    const { task } = await requireEditableTaskTx(tx, taskId);
    const now = new Date().toISOString();
    await tx.execute(sql`update public.tasks set deleted_at = ${now}::timestamptz
                          where (id = ${taskId}::uuid or parent_task_id = ${taskId}::uuid) and deleted_at is null`);
    await logActivity(tx, {
      workspaceId: task.workspaceId,
      actorId: ctx.userId,
      verb: "task.deleted",
      projectId: task.projectId,
      taskId,
    });
  });
}

export async function restoreTask(ctx: Ctx, taskId: string): Promise<TaskItem> {
  return withUser(ctx.claims, async (tx) => {
    const { task } = await requireEditableTaskTx(tx, taskId, { includeDeleted: true });
    if (task.deletedAt) {
      if (task.parentTaskId) {
        const [parent] = await tx.select({ deletedAt: tasks.deletedAt }).from(tasks).where(eq(tasks.id, task.parentTaskId));
        if (parent?.deletedAt) throw new ValidationError("parent_deleted");
      }
      // Restoring brings open tasks back: they count against the active task limit.
      const ws = await requireWorkspaceTx(tx, ctx.userId, task.workspaceId);
      const limit = limitsFor(ws.plan).activeTasks;
      if (limit !== null) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tasks:' || ${task.workspaceId}))`);
        const [batch] = (await tx.execute(sql`
          select count(*)::int as n from public.tasks
           where (id = ${taskId}::uuid or parent_task_id = ${taskId}::uuid)
             and deleted_at = ${task.deletedAt}::timestamptz and completed_at is null`)) as unknown as Array<{ n: number }>;
        const usage = await getUsageTx(tx, task.workspaceId);
        if ((batch?.n ?? 0) > 0 && usage.activeTasks + batch!.n > limit) throw new LimitError("active_tasks");
      }
      await tx.execute(sql`update public.tasks set deleted_at = null
                            where (id = ${taskId}::uuid or parent_task_id = ${taskId}::uuid)
                              and deleted_at = ${task.deletedAt}::timestamptz`);
      await logActivity(tx, {
        workspaceId: task.workspaceId,
        actorId: ctx.userId,
        verb: "task.restored",
        projectId: task.projectId,
        taskId,
      });
    }
    return getItemTx(tx, taskId);
  });
}

// ── Checklist ──────────────────────────────────────────────────────────────

async function requireWritableTaskTx(tx: Tx, taskId: string) {
  return requireEditableTaskTx(tx, taskId);
}

export async function addChecklistItem(ctx: Ctx, taskId: string, input: { text: string }): Promise<ChecklistItem> {
  return withUser(ctx.claims, async (tx) => {
    await requireWritableTaskTx(tx, taskId);
    const [last] = await tx
      .select({ position: checklistItems.position })
      .from(checklistItems)
      .where(eq(checklistItems.taskId, taskId))
      .orderBy(desc(checklistItems.position))
      .limit(1);
    const [row] = await tx
      .insert(checklistItems)
      .values({ taskId, text: input.text.trim(), position: keyBetween(last?.position ?? null, null) })
      .returning({ id: checklistItems.id, text: checklistItems.text, isDone: checklistItems.isDone, position: checklistItems.position });
    return row!;
  });
}

async function requireChecklistItemTx(tx: Tx, itemId: string) {
  const [item] = await tx.select().from(checklistItems).where(eq(checklistItems.id, itemId));
  if (!item) throw new NotFoundError();
  await requireWritableTaskTx(tx, item.taskId);
  return item;
}

export async function updateChecklistItem(
  ctx: Ctx,
  itemId: string,
  input: Partial<{ text: string; isDone: boolean; position: string }>,
): Promise<ChecklistItem> {
  return withUser(ctx.claims, async (tx) => {
    await requireChecklistItemTx(tx, itemId);
    const patch: Partial<typeof checklistItems.$inferInsert> = {};
    if (input.text !== undefined) patch.text = input.text.trim();
    if (input.isDone !== undefined) patch.isDone = input.isDone;
    if (input.position !== undefined) patch.position = input.position;
    const [row] = await tx
      .update(checklistItems)
      .set(patch)
      .where(eq(checklistItems.id, itemId))
      .returning({ id: checklistItems.id, text: checklistItems.text, isDone: checklistItems.isDone, position: checklistItems.position });
    return row!;
  });
}

export async function deleteChecklistItem(ctx: Ctx, itemId: string) {
  return withUser(ctx.claims, async (tx) => {
    await requireChecklistItemTx(tx, itemId);
    await tx.delete(checklistItems).where(eq(checklistItems.id, itemId));
  });
}

// ── Labels ─────────────────────────────────────────────────────────────────

export async function listLabels(ctx: Ctx, workspaceId: string): Promise<Label[]> {
  return withUser(ctx.claims, async (tx) => {
    await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    const rows = await tx
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(labels)
      .where(eq(labels.workspaceId, workspaceId));
    return rows.sort((a, b) => trCompare(a.name, b.name));
  });
}

export async function createLabel(ctx: Ctx, workspaceId: string, input: { name: string; color: string }): Promise<Label> {
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    if (ws.role === "guest") throw new ForbiddenError();
    const [row] = await tx
      .insert(labels)
      .values({ workspaceId, name: input.name.trim(), color: input.color })
      .returning({ id: labels.id, name: labels.name, color: labels.color });
    return row!;
  });
}
