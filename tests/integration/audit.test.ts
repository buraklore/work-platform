/**
 * Findings from the full-system audit (1 Oct 2026). Each test states the correct
 * behaviour; they were written red first, then the code was fixed.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Ctx } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { closeDb } from "@/lib/db/client";
import { withUser } from "@/lib/db/with-user";
import { acceptInvite, changeMemberRole, createInviteLink, listMembers, removeMember } from "@/features/members/server/service";
import {
  addProjectMember,
  createProject,
  deleteProject,
  getProject,
  removeProjectMember,
  restoreProject,
  updateProject,
} from "@/features/projects/server/service";
import { addChecklistItem, createTask, deleteTask, getTask, myTasks, restoreTask, updateTask } from "@/features/tasks/server/service";
import { createWorkspace, getMe, getUsage } from "@/features/workspaces/server/service";
import { updateProfile } from "@/features/profile/server/service";
import type { WorkspaceSummary } from "@/features/workspaces/types";
import { createUser, raw } from "../support/db";

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => err instanceof AppError && err.code === code);
}

async function join(owner: Ctx, ws: WorkspaceSummary, user: Ctx, role: "member" | "guest" | "admin" = "member") {
  const { url } = await createInviteLink(owner, ws.id, { role, expiresInDays: "7", maxUses: 1 });
  await acceptInvite(user, url.split("/davet/")[1]!);
}

let owner: Ctx;
let member: Ctx;
let guest: Ctx;
let ws: WorkspaceSummary;
let otherWs: WorkspaceSummary;

beforeAll(async () => {
  owner = await createUser("Deniz Aksoy");
  member = await createUser("Cem Tan");
  guest = await createUser("Gül Er");
  ws = await createWorkspace(owner, { name: "Denetim" });
  await join(owner, ws, member);
  await join(owner, ws, guest, "guest");
  // The owner also belongs to a second workspace (as a member there).
  const stranger = await createUser("Sena Yurt");
  otherWs = await createWorkspace(stranger, { name: "Başka Şirket" });
  await join(stranger, otherWs, owner);
});

afterAll(async () => {
  await closeDb();
});

describe("assignees must be able to see the task", () => {
  it("refuses assigning someone without access to a private project", async () => {
    const secret = await createProject(owner, ws.id, { name: "Gizli", color: "#E0513F", visibility: "private" });
    await expectCode(
      createTask(owner, { workspaceId: ws.id, projectId: secret.id, title: "Gizli iş", assigneeIds: [member.userId], source: "list" }),
      "validation",
    );
    // Once they are a project member it works and they see it.
    await addProjectMember(owner, secret.id, { userId: member.userId, role: "member" });
    await createTask(owner, { workspaceId: ws.id, projectId: secret.id, title: "Gizli iş", assigneeIds: [member.userId], source: "list" });
    expect((await myTasks(member, ws.id)).open.map((t) => t.title)).toContain("Gizli iş");
  });

  it("refuses assigning a guest to a team project they are not part of", async () => {
    const team = await createProject(owner, ws.id, { name: "Ekip işi", color: "#12998F", visibility: "team" });
    await expectCode(
      createTask(owner, { workspaceId: ws.id, projectId: team.id, title: "Misafire", assigneeIds: [guest.userId], source: "list" }),
      "validation",
    );
  });

  it("losing project access drops the person's assignments there (no invisible tasks)", async () => {
    const p = await createProject(owner, ws.id, { name: "Dönem", color: "#8B5CF6", visibility: "private" });
    await addProjectMember(owner, p.id, { userId: member.userId, role: "member" });
    await createTask(owner, { workspaceId: ws.id, projectId: p.id, title: "Geçici", assigneeIds: [member.userId], source: "list" });
    await removeProjectMember(owner, p.id, member.userId);
    const rows = await raw<{ n: number }>(sql`select count(*)::int as n from public.task_assignees a join public.tasks t on t.id = a.task_id
                                              where t.project_id = ${p.id}::uuid and a.user_id = ${member.userId}::uuid`);
    expect(rows[0]!.n).toBe(0);
  });

  it("team → private visibility also drops assignments of people who lose access", async () => {
    const p = await createProject(owner, ws.id, { name: "Açık", color: "#0EA5E9", visibility: "team" });
    await createTask(owner, { workspaceId: ws.id, projectId: p.id, title: "Herkese", assigneeIds: [member.userId], source: "list" });
    await updateProject(owner, p.id, { visibility: "private" });
    expect((await myTasks(member, ws.id)).open.map((t) => t.title)).not.toContain("Herkese");
    const rows = await raw<{ n: number }>(sql`select count(*)::int as n from public.task_assignees a join public.tasks t on t.id = a.task_id
                                              where t.project_id = ${p.id}::uuid and a.user_id = ${member.userId}::uuid`);
    expect(rows[0]!.n).toBe(0);
  });
});

describe("tenant integrity at the database level", () => {
  it("a task can never move to another workspace, even with direct SQL as app_user", async () => {
    const mine = await createTask(owner, { workspaceId: ws.id, title: "Burada kalmalı", source: "home" });
    const foreignPersonal = (await raw<{ id: string; status: string }>(
      sql`select p.id, (select s.id from public.project_statuses s where s.project_id = p.id limit 1) as status
            from public.projects p where p.workspace_id = ${otherWs.id}::uuid and p.created_by = ${owner.userId}::uuid and p.is_personal`,
    ))[0]!;
    await expect(
      withUser(owner.claims, (tx) =>
        tx.execute(sql`update public.tasks set project_id = ${foreignPersonal.id}::uuid, status_id = ${foreignPersonal.status}::uuid
                        where id = ${mine.id}::uuid`),
      ),
    ).rejects.toBeTruthy();
    const after = await raw<{ workspace_id: string }>(sql`select workspace_id from public.tasks where id = ${mine.id}::uuid`);
    expect(after[0]!.workspace_id).toBe(ws.id);
  });

  it("workspace_id on a task cannot be rewritten directly", async () => {
    const t = await createTask(owner, { workspaceId: ws.id, title: "Sabit", source: "home" });
    await expect(
      withUser(owner.claims, (tx) => tx.execute(sql`update public.tasks set workspace_id = ${otherWs.id}::uuid where id = ${t.id}::uuid`)),
    ).rejects.toBeTruthy();
  });
});

describe("archived projects are read-only", () => {
  it("refuses edits, deletes, checklist changes and moves into an archived project", async () => {
    const p = await createProject(owner, ws.id, { name: "Arşivlik", color: "#65A30D", visibility: "team" });
    const t = await createTask(owner, { workspaceId: ws.id, projectId: p.id, title: "Eski iş", source: "list" });
    const outside = await createTask(owner, { workspaceId: ws.id, title: "Dışarıdaki", source: "home" });
    const teamP = await createProject(owner, ws.id, { name: "Hedef", color: "#DB2777", visibility: "team" });
    const movable = await createTask(owner, { workspaceId: ws.id, projectId: teamP.id, title: "Taşınacak", source: "list" });
    await updateProject(owner, p.id, { archived: true });
    await expectCode(updateTask(owner, t.id, { title: "Yeni ad" }), "validation");
    await expectCode(deleteTask(owner, t.id), "validation");
    await expectCode(addChecklistItem(owner, t.id, { text: "madde" }), "validation");
    await expectCode(updateTask(owner, movable.id, { projectId: p.id }), "validation");
    expect(outside.id).toBeTruthy();
    // The panel knows it is read-only.
    expect((await getTask(owner, t.id)).project.archived).toBe(true);
  });
});

describe("plan limits cannot be bypassed", () => {
  it("unarchiving or restoring a project respects the active project limit", async () => {
    const owner2 = await createUser("Limit Testçi");
    const w = await createWorkspace(owner2, { name: "Limitli" });
    const archived = await createProject(owner2, w.id, { name: "Arşivde", color: "#3B4FE4", visibility: "team" });
    await updateProject(owner2, archived.id, { archived: true });
    const deleted = await createProject(owner2, w.id, { name: "Silinen", color: "#3B4FE4", visibility: "team" });
    await deleteProject(owner2, deleted.id);
    for (let i = 0; i < 10; i++) await createProject(owner2, w.id, { name: `P${i}`, color: "#3B4FE4", visibility: "team" });
    await expectCode(updateProject(owner2, archived.id, { archived: false }), "limit");
    await expectCode(restoreProject(owner2, deleted.id), "limit");
  });

  it("restoring a deleted open task respects the active task limit", async () => {
    const owner3 = await createUser("Görev Limit");
    const w = await createWorkspace(owner3, { name: "Görev Limitli" });
    const victim = await createTask(owner3, { workspaceId: w.id, title: "Silinecek", source: "home" });
    await deleteTask(owner3, victim.id);
    const personal = victim.projectId;
    const status = (await raw<{ id: string }>(sql`select id from public.project_statuses where project_id = ${personal}::uuid and category = 'todo' limit 1`))[0]!.id;
    await raw(sql`insert into public.tasks (workspace_id, project_id, status_id, title, position, created_by)
                  select ${w.id}::uuid, ${personal}::uuid, ${status}::uuid, 'dolgu ' || g, 'a' || lpad(g::text, 4, '0'), ${owner3.userId}::uuid
                    from generate_series(1, 500) g`);
    await expectCode(restoreTask(owner3, victim.id), "limit");
  });
});

describe("roles", () => {
  it("a guest can be at most an editor of a project, never its admin", async () => {
    const p = await createProject(owner, ws.id, { name: "Müşteri", color: "#C98A0B", visibility: "private" });
    await expectCode(addProjectMember(owner, p.id, { userId: guest.userId, role: "admin" }), "validation");
    await addProjectMember(owner, p.id, { userId: guest.userId, role: "member" });
    expect((await getProject(guest, p.id)).access).toBe("member");
  });

  it("a guest cannot read the profiles (emails) of workspace members they share no project with", async () => {
    const other = await createUser("Uzak Üye");
    await join(owner, ws, other);
    const seen = await withUser(guest.claims, (tx) =>
      tx.execute(sql`select id from public.profiles where id = ${other.userId}::uuid`),
    );
    expect((seen as unknown as unknown[]).length).toBe(0);
  });
});

describe("deleted tasks", () => {
  it("are not served by getTask (the panel shows 'not found' instead of an editable ghost)", async () => {
    const t = await createTask(owner, { workspaceId: ws.id, title: "Hayalet", source: "home" });
    await deleteTask(owner, t.id);
    await expectCode(getTask(owner, t.id), "not_found");
  });
});

describe("consent", () => {
  it("records acceptance of the terms (KVKK) for password sign-ups and via the profile for OAuth users", async () => {
    const rows = await raw<{ id: string }>(
      sql`insert into auth.users (email, raw_user_meta_data) values ('kvkk.${sql.raw(String(Date.now()))}@example.com', '{"full_name":"Kvkk Test","terms_accepted":true}'::jsonb) returning id`,
    );
    const viaSignup: Ctx = { userId: rows[0]!.id, claims: { sub: rows[0]!.id } };
    expect((await getMe(viaSignup)).termsAccepted).toBe(true);

    const oauth = await createUser("Google Kullanıcı");
    expect((await getMe(oauth)).termsAccepted).toBe(false);
    expect((await updateProfile(oauth, { acceptTerms: true })).termsAccepted).toBe(true);
  });

  it("OAuth users get their avatar and name from the provider", async () => {
    const rows = await raw<{ id: string }>(
      sql`insert into auth.users (email, raw_user_meta_data) values ('g.${sql.raw(String(Date.now()))}@example.com', '{"name":"Ece Gür","avatar_url":"https://lh3.googleusercontent.com/a/x"}'::jsonb) returning id`,
    );
    const me = await getMe({ userId: rows[0]!.id, claims: { sub: rows[0]!.id } });
    expect(me.fullName).toBe("Ece Gür");
    expect(me.avatarUrl).toBe("https://lh3.googleusercontent.com/a/x");
  });
});

describe("workspace member management (2nd audit)", () => {
  it("owner removes a member: the seat is freed and their personal project goes with them", async () => {
    const o = await createUser("Yönetici Sahip");
    const w = await createWorkspace(o, { name: "Koltuk" });
    const leaver = await createUser("Ayrılan Kişi");
    await join(o, w, leaver);
    const personal = await createTask(leaver, { workspaceId: w.id, title: "Kişisel not", source: "home" });
    await removeMember(o, w.id, leaver.userId);
    const left = await raw<{ n: number }>(sql`select count(*)::int as n from public.projects where id = ${personal.projectId}::uuid`);
    expect(left[0]!.n).toBe(0);
    expect((await getUsage(o, w.id)).usage.members).toBe(1);
    expect((await getUsage(o, w.id)).usage.activeTasks).toBe(0);
  });

  it("a member can leave; the owner cannot", async () => {
    const o = await createUser("Kalan Sahip");
    const w = await createWorkspace(o, { name: "Ayrılık" });
    const m = await createUser("Giden Üye");
    await join(o, w, m);
    await removeMember(m, w.id, m.userId);
    await expectCode(listMembers(m, w.id), "not_found");
    await expectCode(removeMember(o, w.id, o.userId), "forbidden");
  });

  it("only the owner grants admin; members cannot change roles; promotion respects the member limit", async () => {
    const o = await createUser("Rol Sahip");
    const w = await createWorkspace(o, { name: "Roller" });
    const a = await createUser("Rol Admin");
    const g = await createUser("Rol Misafir");
    await join(o, w, a, "admin");
    await join(o, w, g, "guest");
    await expectCode(changeMemberRole(a, w.id, g.userId, "admin"), "forbidden");
    await changeMemberRole(a, w.id, g.userId, "member");
    expect((await listMembers(o, w.id)).find((x) => x.userId === g.userId)!.role).toBe("member");
    // The promoted guest now has a personal project.
    await createTask(g, { workspaceId: w.id, title: "Artık üyeyim", source: "home" });
    for (let i = 0; i < 2; i++) await join(o, w, await createUser(`Dolgu ${i}`));
    const extraGuest = await createUser("Fazla Misafir");
    await join(o, w, extraGuest, "guest");
    await expectCode(changeMemberRole(o, w.id, extraGuest.userId, "member"), "limit");
    const plain = await createUser("Düz Üye");
    await expectCode(changeMemberRole(plain, w.id, g.userId, "guest"), "not_found");
  });
});
