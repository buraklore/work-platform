import { getTableColumns, getTableName, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Ctx } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { closeDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { trNormalize } from "@/lib/text/tr";
import {
  createProject,
  createStatus,
  deleteProject,
  deleteStatus,
  getProject,
  listProjects,
  restoreProject,
  updateProject,
} from "@/features/projects/server/service";
import {
  addChecklistItem,
  createTask,
  deleteChecklistItem,
  deleteTask,
  getTask,
  listProjectTasks,
  myTasks,
  restoreTask,
  updateChecklistItem,
  updateTask,
} from "@/features/tasks/server/service";
import { createWorkspace, getUsage } from "@/features/workspaces/server/service";
import type { WorkspaceSummary } from "@/features/workspaces/types";
import type { ProjectDetail } from "@/features/projects/types";
import { createUser, raw } from "../support/db";

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => err instanceof AppError && err.code === code);
}

let owner: Ctx;
let ws: WorkspaceSummary;
let project: ProjectDetail;
let other: ProjectDetail;

beforeAll(async () => {
  owner = await createUser("Oya Önal");
  ws = await createWorkspace(owner, { name: "Ürün Ekibi" });
  project = await getProject(owner, (await createProject(owner, ws.id, { name: "Lansman", color: "#12998F", visibility: "team" })).id);
  other = await getProject(owner, (await createProject(owner, ws.id, { name: "Destek", color: "#C98A0B", visibility: "team" })).id);
});

afterAll(async () => {
  await closeDb();
});

describe("defaults", () => {
  it("new projects get Yapılacak / Devam Ediyor / İncelemede / Tamamlandı", () => {
    expect(project.statuses.map((s) => [s.name, s.category])).toEqual([
      ["Yapılacak", "todo"],
      ["Devam Ediyor", "in_progress"],
      ["İncelemede", "in_progress"],
      ["Tamamlandı", "done"],
    ]);
  });
  it("a task lands in the first to-do status, appended at the end", async () => {
    const a = await createTask(owner, { workspaceId: ws.id, projectId: project.id, title: "Birinci", source: "list" });
    const b = await createTask(owner, { workspaceId: ws.id, projectId: project.id, title: "İkinci", source: "list" });
    expect(a.statusId).toBe(project.statuses[0]!.id);
    expect(b.position > a.position).toBe(true);
    expect(a.assigneeIds).toEqual([]); // not a personal project → no implicit assignee
  });
  it("tasks without a project go to the personal project and are mine", async () => {
    const t = await createTask(owner, { workspaceId: ws.id, title: "Diş hekimi", dueDate: "2026-10-02", dueTime: "14:30", source: "quick_add" });
    expect(t.assigneeIds).toEqual([owner.userId]);
    expect(t.dueTime).toBe("14:30");
    expect(t.dueDate).toBe("2026-10-02");
    const mine = await myTasks(owner, ws.id);
    expect(mine.open.find((x) => x.id === t.id)?.isPersonalProject).toBe(true);
  });
});

describe("completion and moves", () => {
  it("done status sets completed_at, reopening clears it", async () => {
    const t = await createTask(owner, { workspaceId: ws.id, projectId: project.id, title: "Bitir", source: "list" });
    const done = project.statuses.find((s) => s.category === "done")!;
    const completed = await updateTask(owner, t.id, { statusId: done.id });
    expect(completed.completedAt).not.toBeNull();
    const reopened = await updateTask(owner, t.id, { statusId: project.statuses[0]!.id });
    expect(reopened.completedAt).toBeNull();
    const verbs = await raw<{ verb: string }>(sql`select verb from public.activities where task_id = ${t.id}::uuid order by created_at`);
    expect(verbs.map((v) => v.verb)).toEqual(["task.created", "task.completed", "task.reopened"]);
  });

  it("completed: true/false picks the first done / todo status", async () => {
    const t = await createTask(owner, { workspaceId: ws.id, projectId: project.id, title: "Hızlı tamamla", source: "list" });
    const done = await updateTask(owner, t.id, { completed: true });
    expect(done.statusCategory).toBe("done");
    expect(done.completedAt).not.toBeNull();
    const open = await updateTask(owner, t.id, { completed: false });
    expect(open.statusCategory).toBe("todo");
  });

  it("moving between projects keeps the status category and carries subtasks", async () => {
    const parent = await createTask(owner, { workspaceId: ws.id, projectId: project.id, title: "Ana görev", source: "list" });
    const inProgress = project.statuses.find((s) => s.name === "Devam Ediyor")!;
    await updateTask(owner, parent.id, { statusId: inProgress.id });
    const child = await createTask(owner, { workspaceId: ws.id, parentTaskId: parent.id, title: "Alt görev", source: "subtask" });
    expect(child.projectId).toBe(project.id);

    const moved = await updateTask(owner, parent.id, { projectId: other.id });
    expect(moved.projectId).toBe(other.id);
    expect(other.statuses.find((s) => s.id === moved.statusId)?.category).toBe("in_progress");
    const detail = await getTask(owner, parent.id);
    expect(detail.subtasks.map((s) => [s.id, s.projectId])).toEqual([[child.id, other.id]]);
  });

  it("personal-project tasks can only be assigned to their owner (no invisible delegation)", async () => {
    const mate = await createUser("Mert Şen");
    await raw(sql`insert into public.workspace_members (workspace_id, user_id, role) values (${ws.id}::uuid, ${mate.userId}::uuid, 'member')`);
    // No project + someone else assigned would land in my private project: refused.
    await expectCode(createTask(owner, { workspaceId: ws.id, title: "Logoyu tasarla", assigneeIds: [mate.userId], source: "home" }), "validation");
    const mine = await createTask(owner, { workspaceId: ws.id, title: "Kendime not", source: "home" });
    await expectCode(updateTask(owner, mine.id, { assigneeIds: [owner.userId, mate.userId] }), "validation");
    // Moving a delegated task into the personal project is refused too.
    const shared = await createTask(owner, { workspaceId: ws.id, projectId: project.id, title: "Ortak iş", assigneeIds: [mate.userId], source: "list" });
    await expectCode(updateTask(owner, shared.id, { projectId: mine.projectId }), "validation");
    // The same task in a team project is visible to the assignee.
    expect((await myTasks(mate, ws.id)).open.map((t) => t.title)).toContain("Ortak iş");
  });

  it("subtasks are one level deep", async () => {
    const parent = await createTask(owner, { workspaceId: ws.id, projectId: project.id, title: "P", source: "list" });
    const child = await createTask(owner, { workspaceId: ws.id, parentTaskId: parent.id, title: "C", source: "subtask" });
    await expectCode(createTask(owner, { workspaceId: ws.id, parentTaskId: child.id, title: "G", source: "subtask" }), "validation");
  });
});

describe("soft delete and undo", () => {
  it("deleting a parent hides its subtasks; undo restores exactly that batch", async () => {
    const parent = await createTask(owner, { workspaceId: ws.id, projectId: project.id, title: "Silinecek", source: "list" });
    const kept = await createTask(owner, { workspaceId: ws.id, parentTaskId: parent.id, title: "Alt 1", source: "subtask" });
    const earlier = await createTask(owner, { workspaceId: ws.id, parentTaskId: parent.id, title: "Alt 2", source: "subtask" });
    await deleteTask(owner, earlier.id);
    await deleteTask(owner, parent.id);
    expect((await listProjectTasks(owner, project.id)).map((t) => t.id)).not.toContain(parent.id);
    await expectCode(getTask(owner, kept.id).then((t) => (t.deletedAt ? Promise.reject(new AppError("not_found", 404)) : t)), "not_found");

    await restoreTask(owner, parent.id);
    const detail = await getTask(owner, parent.id);
    expect(detail.subtasks.map((s) => s.id)).toEqual([kept.id]); // "Alt 2" was deleted separately and stays deleted
  });

  it("deleted projects disappear and can be restored", async () => {
    const temp = await createProject(owner, ws.id, { name: "Geçici", color: "#6B6F80", visibility: "team" });
    await deleteProject(owner, temp.id);
    expect((await listProjects(owner, ws.id)).map((p) => p.id)).not.toContain(temp.id);
    await restoreProject(owner, temp.id);
    expect((await listProjects(owner, ws.id)).map((p) => p.id)).toContain(temp.id);
  });

  it("the personal project cannot be deleted or archived", async () => {
    const personal = (await listProjects(owner, ws.id)).find((p) => p.isPersonal)!;
    await expectCode(deleteProject(owner, personal.id), "validation");
    await expectCode(updateProject(owner, personal.id, { archived: true }), "validation");
  });
});

describe("statuses", () => {
  it("deleting a status moves its tasks; the last done status cannot go", async () => {
    const extra = await createStatus(owner, project.id, { name: "Beklemede", category: "in_progress", color: "#8B5CF6" });
    const statuses = (await getProject(owner, project.id)).statuses;
    expect(statuses.at(-1)!.category).toBe("done"); // new statuses are inserted before "done"
    const t = await createTask(owner, { workspaceId: ws.id, projectId: project.id, statusId: extra.id, title: "Bekleyen", source: "board" });
    await deleteStatus(owner, extra.id, project.statuses[0]!.id);
    expect((await getTask(owner, t.id)).statusId).toBe(project.statuses[0]!.id);
    const done = project.statuses.find((s) => s.category === "done")!;
    await expectCode(deleteStatus(owner, done.id, project.statuses[0]!.id), "validation");
  });
});

describe("checklist", () => {
  it("adds, toggles and removes items", async () => {
    const t = await createTask(owner, { workspaceId: ws.id, projectId: project.id, title: "Kontrol listesi", source: "list" });
    const a = await addChecklistItem(owner, t.id, { text: "Logo" });
    const b = await addChecklistItem(owner, t.id, { text: "Renkler" });
    expect(b.position > a.position).toBe(true);
    await updateChecklistItem(owner, a.id, { isDone: true });
    let detail = await getTask(owner, t.id);
    expect([detail.checklistCount, detail.checklistDoneCount]).toEqual([2, 1]);
    await deleteChecklistItem(owner, b.id);
    detail = await getTask(owner, t.id);
    expect(detail.checklist.map((c) => c.text)).toEqual(["Logo"]);
  });
});

describe("ordering", () => {
  it("rebalances a group when keys grow too long", async () => {
    const base = await createTask(owner, { workspaceId: ws.id, projectId: other.id, title: "Sıra 1", source: "list" });
    const long = `${base.position}${"V".repeat(60)}`.slice(0, 64);
    const t = await updateTask(owner, base.id, { position: long });
    expect(t.position.length).toBeLessThan(10);
  });
});

describe("plan limits", () => {
  it("counts active tasks across projects the user cannot see and blocks at 500", async () => {
    const limitOwner = await createUser("Limit Test");
    const lws = await createWorkspace(limitOwner, { name: "Limit" });
    const p = await createProject(limitOwner, lws.id, { name: "Dolu", color: "#3B4FE4", visibility: "team" });
    await raw(sql`insert into public.tasks (workspace_id, project_id, status_id, title, position, created_by)
      select ${lws.id}::uuid, ${p.id}::uuid, s.id, 'dolgu ' || g, 'a' || lpad(g::text, 4, '0'), ${limitOwner.userId}::uuid
        from generate_series(1, 499) g,
             lateral (select id from public.project_statuses where project_id = ${p.id}::uuid and category = 'todo' limit 1) s`);
    const usage = await getUsage(limitOwner, lws.id);
    expect(usage.usage.activeTasks).toBe(499);
    await createTask(limitOwner, { workspaceId: lws.id, projectId: p.id, title: "500.", source: "list" });
    await expectCode(createTask(limitOwner, { workspaceId: lws.id, projectId: p.id, title: "501.", source: "list" }), "limit");
  });

  it("blocks the 11th project", async () => {
    const u = await createUser("Proje Limiti");
    const w = await createWorkspace(u, { name: "Projeler" });
    for (let i = 1; i <= 10; i++) await createProject(u, w.id, { name: `P${i}`, color: "#3B4FE4", visibility: "team" });
    await expectCode(createProject(u, w.id, { name: "P11", color: "#3B4FE4", visibility: "team" }), "limit");
  });
});

describe("contracts", () => {
  it("JS trNormalize and SQL tr_normalize agree", async () => {
    const samples = ["İstanbul", "ISPARTA", "ılık", "ÇAĞRI", "şöyle Böyle", "Ünlü Ölçüm", "Âşık Îmar Ûmit", "Hello WORLD 123"];
    for (const s of samples) {
      const [row] = await raw<{ v: string }>(sql`select public.tr_normalize(${s}) as v`);
      expect(row!.v, s).toBe(trNormalize(s));
    }
  });

  it("every Drizzle column exists in the migrated database (no schema drift)", async () => {
    const cols = await raw<{ table_name: string; column_name: string }>(
      sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`,
    );
    const present = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));
    const missing: string[] = [];
    let tablesChecked = 0;
    for (const value of Object.values(schema)) {
      if (value && typeof value === "object" && Symbol.for("drizzle:IsDrizzleTable") in value) {
        tablesChecked += 1;
        const table = value as Parameters<typeof getTableName>[0];
        for (const col of Object.values(getTableColumns(table))) {
          const key = `${getTableName(table)}.${col.name}`;
          if (!present.has(key)) missing.push(key);
        }
      }
    }
    expect(tablesChecked).toBe(17);
    expect(missing).toEqual([]);
  });
});
