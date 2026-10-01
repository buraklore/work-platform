/**
 * Tenant isolation and role enforcement, exercised through the real service layer
 * against a migrated Postgres (RLS on). Two workspaces, every role.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Ctx } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { closeDb } from "@/lib/db/client";
import { withUser } from "@/lib/db/with-user";
import { acceptInvite, createInviteLink, listMembers, previewInvite, revokeInviteLink } from "@/features/members/server/service";
import {
  addProjectMember,
  createProject,
  getProject,
  listProjects,
  updateProject,
} from "@/features/projects/server/service";
import { search } from "@/features/search/server/service";
import {
  createLabel,
  createTask,
  deleteTask,
  getTask,
  listProjectTasks,
  myTasks,
  updateTask,
} from "@/features/tasks/server/service";
import { createWorkspace, getWorkspaceBySlug } from "@/features/workspaces/server/service";
import type { WorkspaceSummary } from "@/features/workspaces/types";
import { createUser, raw } from "../support/db";

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => err instanceof AppError && err.code === code);
}

let alice: Ctx; // owner of ws A
let bob: Ctx; // owner of ws B (the attacker in isolation tests)
let carol: Ctx; // member of ws A
let gina: Ctx; // guest in ws A
let wsA: WorkspaceSummary;
let wsB: WorkspaceSummary;
let teamProjectId: string;
let privateProjectId: string;
let teamTaskId: string;
let privateTaskId: string;
let alicePersonalTaskId: string;

beforeAll(async () => {
  alice = await createUser("Alice Aksoy");
  bob = await createUser("Bora Bulut");
  carol = await createUser("Ceren Çelik");
  gina = await createUser("Gizem Güler");

  wsA = await createWorkspace(alice, { name: "Ajans İstanbul", useCase: "agency" });
  wsB = await createWorkspace(bob, { name: "Başka Şirket", useCase: "startup" });

  const team = await createProject(alice, wsA.id, { name: "Web Sitesi", color: "#3B4FE4", visibility: "team" });
  const priv = await createProject(alice, wsA.id, { name: "Gizli Teklif", color: "#E0513F", visibility: "private" });
  teamProjectId = team.id;
  privateProjectId = priv.id;
  teamTaskId = (await createTask(alice, { workspaceId: wsA.id, projectId: team.id, title: "İstanbul raporu hazırla", source: "list" })).id;
  privateTaskId = (await createTask(alice, { workspaceId: wsA.id, projectId: priv.id, title: "Fiyat teklifi", source: "list" })).id;
  alicePersonalTaskId = (await createTask(alice, { workspaceId: wsA.id, title: "Kişisel not", source: "quick_add" })).id;

  const memberLink = await createInviteLink(alice, wsA.id, { role: "member", expiresInDays: "7", maxUses: null });
  await acceptInvite(carol, memberLink.url.split("/davet/")[1]!);
  const guestLink = await createInviteLink(alice, wsA.id, { role: "guest", expiresInDays: "7", maxUses: 1 });
  await acceptInvite(gina, guestLink.url.split("/davet/")[1]!);
});

afterAll(async () => {
  await closeDb();
});

describe("workspace bootstrap", () => {
  it("creates owner membership, subscription and a personal project", async () => {
    const projects = await listProjects(alice, wsA.id);
    expect(projects.filter((p) => p.isPersonal)).toHaveLength(1);
    const subs = await raw(sql`select plan from public.subscriptions where workspace_id = ${wsA.id}::uuid`);
    expect(subs).toEqual([{ plan: "free" }]);
    expect(wsA.role).toBe("owner");
    expect(wsA.slug).toMatch(/^ajans-istanbul-[0-9a-f]{6}$/);
  });

  it("allows only one owned free workspace", async () => {
    await expectCode(createWorkspace(alice, { name: "İkinci" }), "limit");
  });

  it("personal-project tasks are auto-assigned to their creator", async () => {
    const mine = await myTasks(alice, wsA.id);
    expect(mine.open.map((t) => t.id)).toContain(alicePersonalTaskId);
  });
});

describe("tenant isolation (IDOR)", () => {
  it("hides another workspace entirely", async () => {
    await expectCode(getWorkspaceBySlug(bob, wsA.slug), "not_found");
    await expectCode(listProjects(bob, wsA.id), "not_found");
    await expectCode(listMembers(bob, wsA.id), "not_found");
    await expectCode(search(bob, wsA.id, "rapor"), "not_found");
  });

  it("cannot read or mutate another tenant's project or task by id", async () => {
    await expectCode(getProject(bob, teamProjectId), "not_found");
    await expectCode(listProjectTasks(bob, teamProjectId), "not_found");
    await expectCode(getTask(bob, teamTaskId), "not_found");
    await expectCode(updateTask(bob, teamTaskId, { title: "hacked" }), "not_found");
    await expectCode(deleteTask(bob, teamTaskId), "not_found");
    await expectCode(updateProject(bob, teamProjectId, { name: "hacked" }), "not_found");
  });

  it("cannot plant a task into a foreign project via its own workspace id", async () => {
    await expectCode(createTask(bob, { workspaceId: wsB.id, projectId: teamProjectId, title: "x", source: "list" }), "not_found");
    await expectCode(createTask(bob, { workspaceId: wsA.id, projectId: teamProjectId, title: "x", source: "list" }), "not_found");
  });

  it("cannot move its own task into a foreign project", async () => {
    const own = await createTask(bob, { workspaceId: wsB.id, title: "Benim görevim", source: "list" });
    await expectCode(updateTask(bob, own.id, { projectId: teamProjectId }), "not_found");
  });

  it("raw SQL under app_user is filtered by RLS", async () => {
    const counts = await withUser(bob.claims, async (tx) => {
      const tasks = (await tx.execute(sql`select count(*)::int as n from public.tasks where workspace_id = ${wsA.id}::uuid`)) as unknown as { n: number }[];
      const updated = (await tx.execute(sql`update public.tasks set title = 'hacked' where id = ${teamTaskId}::uuid returning id`)) as unknown as unknown[];
      const profiles = (await tx.execute(sql`select count(*)::int as n from public.profiles where id = ${alice.userId}::uuid`)) as unknown as { n: number }[];
      return { tasks: tasks[0]!.n, updated: updated.length, profiles: profiles[0]!.n };
    });
    expect(counts).toEqual({ tasks: 0, updated: 0, profiles: 0 });
  });

  it("forged workspace_id on insert is overwritten by the parent's", async () => {
    await expect(
      withUser(bob.claims, (tx) =>
        tx.execute(sql`insert into public.tasks (workspace_id, project_id, status_id, title, position, created_by)
          select ${wsB.id}::uuid, ${teamProjectId}::uuid, s.id, 'x', 'a0', ${bob.userId}::uuid
            from public.project_statuses s where s.project_id = ${teamProjectId}::uuid limit 1`),
      ),
    ).resolves.toBeDefined(); // the SELECT sees no statuses (RLS) → inserts nothing
    const leaked = await raw(sql`select count(*)::int as n from public.tasks where title = 'x' and project_id = ${teamProjectId}::uuid`);
    expect(leaked[0]).toEqual({ n: 0 });
  });

  it("REST roles have no table privileges (PostgREST cannot bypass the service layer)", async () => {
    const grants = await raw(sql`select count(*)::int as n from information_schema.role_table_grants
                                  where table_schema = 'public' and grantee in ('anon', 'authenticated')`);
    expect(grants[0]).toEqual({ n: 0 });
  });
});

describe("roles inside a workspace", () => {
  it("member sees team projects but not private or others' personal projects", async () => {
    const visible = (await listProjects(carol, wsA.id)).map((p) => p.id);
    expect(visible).toContain(teamProjectId);
    expect(visible).not.toContain(privateProjectId);
    await expectCode(getTask(carol, privateTaskId), "not_found");
    await expectCode(getTask(carol, alicePersonalTaskId), "not_found");
    await expect(getTask(carol, teamTaskId)).resolves.toMatchObject({ id: teamTaskId });
  });

  it("member cannot manage invites or project settings", async () => {
    await expectCode(createInviteLink(carol, wsA.id, { role: "member", expiresInDays: "7", maxUses: null }), "forbidden");
    await expectCode(updateProject(carol, teamProjectId, { name: "Yeni ad" }), "forbidden");
  });

  it("admin cannot be created by a non-owner, and the owner cannot be demoted", async () => {
    await expect(
      withUser(carol.claims, (tx) =>
        tx.execute(sql`update public.workspace_members set role = 'admin' where user_id = ${carol.userId}::uuid and workspace_id = ${wsA.id}::uuid`),
      ),
    ).resolves.toBeDefined(); // members cannot update membership rows at all (RLS) → no-op
    const [row] = await raw<{ role: string }>(sql`select role from public.workspace_members where user_id = ${carol.userId}::uuid`);
    expect(row!.role).toBe("member");
    await expect(
      withUser(alice.claims, (tx) =>
        tx.execute(sql`update public.workspace_members set role = 'member' where user_id = ${alice.userId}::uuid`),
      ),
    ).rejects.toThrow();
  });

  it("guest sees nothing until added to a project, then only that project", async () => {
    expect(await listProjects(gina, wsA.id)).toEqual([]);
    await expectCode(getTask(gina, teamTaskId), "not_found");
    await addProjectMember(alice, teamProjectId, { userId: gina.userId, role: "viewer" });
    expect((await listProjects(gina, wsA.id)).map((p) => p.id)).toEqual([teamProjectId]);
    await expect(getTask(gina, teamTaskId)).resolves.toMatchObject({ access: "viewer" });
    await expectCode(updateTask(gina, teamTaskId, { title: "x" }), "forbidden");
    await expectCode(createTask(gina, { workspaceId: wsA.id, projectId: teamProjectId, title: "x", source: "list" }), "forbidden");
  });

  it("guest only sees members who share a project", async () => {
    const members = (await listMembers(gina, wsA.id)).map((m) => m.userId).sort();
    expect(members).toEqual([alice.userId, gina.userId].sort());
  });

  it("assignee must belong to the workspace", async () => {
    await expect(updateTask(alice, teamTaskId, { assigneeIds: [bob.userId] })).rejects.toThrow();
    await expect(updateTask(alice, teamTaskId, { assigneeIds: [carol.userId] })).resolves.toMatchObject({
      assigneeIds: [carol.userId],
    });
  });

  it("labels cannot cross workspaces", async () => {
    const foreign = await createLabel(bob, wsB.id, { name: "Acil", color: "#E0513F" });
    await expect(updateTask(alice, teamTaskId, { labelIds: [foreign.id] })).rejects.toThrow();
  });
});

describe("invitations", () => {
  it("previews and rejects revoked / used / invalid tokens", async () => {
    const dave = await createUser("Deniz Demir");
    const link = await createInviteLink(alice, wsA.id, { role: "member", expiresInDays: "1", maxUses: 1 });
    const token = link.url.split("/davet/")[1]!;
    expect(await previewInvite(dave, token)).toMatchObject({ state: "valid", workspaceName: "Ajans İstanbul" });
    await revokeInviteLink(alice, wsA.id, link.link.id);
    expect((await previewInvite(dave, token)).state).toBe("revoked");
    await expectCode(acceptInvite(dave, token), "invite");
    await expectCode(acceptInvite(dave, "not-a-real-token"), "invite");
  });

  it("stores only a hash of the token", async () => {
    const link = await createInviteLink(alice, wsA.id, { role: "member", expiresInDays: "7", maxUses: null });
    const token = link.url.split("/davet/")[1]!;
    const rows = await raw(sql`select count(*)::int as n from public.invitations where token_hash = ${token}`);
    expect(rows[0]).toEqual({ n: 0 });
  });

  it("enforces the 5-member limit (guests counted separately)", async () => {
    const link = await createInviteLink(alice, wsA.id, { role: "member", expiresInDays: "7", maxUses: null });
    const token = link.url.split("/davet/")[1]!;
    // alice + carol are 2 members; three more fit.
    for (const name of ["Ece Er", "Fatih Filiz", "Hakan Han"]) {
      await acceptInvite(await createUser(name), token);
    }
    await expectCode(acceptInvite(await createUser("Irmak Işık"), token), "limit");
    const guestLink = await createInviteLink(alice, wsA.id, { role: "guest", expiresInDays: "7", maxUses: null });
    await expect(acceptInvite(await createUser("Jale Jale"), guestLink.url.split("/davet/")[1]!)).resolves.toMatchObject({
      workspaceId: wsA.id,
    });
  });
});

describe("search", () => {
  it("is Turkish-aware and suffix-tolerant", async () => {
    for (const q of ["istanbul", "İSTANBUL", "ISTANBUL", "rapor", "raporu haz"]) {
      const res = await search(alice, wsA.id, q);
      expect(res.tasks.map((t) => t.id), q).toContain(teamTaskId);
    }
  });
  it("never returns what RLS hides", async () => {
    const res = await search(carol, wsA.id, "teklif");
    expect(res.tasks.map((t) => t.id)).not.toContain(privateTaskId);
    expect(res.projects.map((p) => p.id)).not.toContain(privateProjectId);
  });
});
