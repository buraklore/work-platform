import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { limitsJson } from "@/config/plans";
import { siteConfig } from "@/config/site";
import type { Ctx } from "@/lib/api/handler";
import { ForbiddenError, NotFoundError } from "@/lib/api/errors";
import { track } from "@/lib/db/audit";
import { invitations, profiles, workspaceMembers, type WorkspaceRole } from "@/lib/db/schema";
import { iso } from "@/lib/db/time";
import { withUser } from "@/lib/db/with-user";
import { trCompare } from "@/lib/text/tr";
import { requireWorkspaceTx } from "@/features/workspaces/server/service";
import type { InviteLink, InvitePreview, Member } from "@/features/workspaces/types";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function listMembers(ctx: Ctx, workspaceId: string): Promise<Member[]> {
  return withUser(ctx.claims, async (tx) => {
    await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    const rows = await tx
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        fullName: profiles.fullName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
      })
      .from(workspaceMembers)
      .innerJoin(profiles, eq(profiles.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
    return rows.sort((a, b) => trCompare(a.fullName || a.email, b.fullName || b.email));
  });
}

const EXPIRY_DAYS = { "1": 1, "7": 7, "30": 30 } as const;
export type InviteExpiry = keyof typeof EXPIRY_DAYS;

export async function createInviteLink(
  ctx: Ctx,
  workspaceId: string,
  input: { role: Exclude<WorkspaceRole, "owner">; expiresInDays: InviteExpiry; maxUses: number | null },
): Promise<{ link: InviteLink; url: string }> {
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    if (ws.role !== "owner" && ws.role !== "admin") throw new ForbiddenError();
    if (input.role === "admin" && ws.role !== "owner") throw new ForbiddenError("only the owner can invite admins");

    // 192 bits of entropy; only the hash is stored, the token is shown exactly once.
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS[input.expiresInDays] * 86_400_000).toISOString();
    const [row] = await tx
      .insert(invitations)
      .values({
        workspaceId,
        kind: "link",
        role: input.role,
        tokenHash: hashInviteToken(token),
        invitedBy: ctx.userId,
        expiresAt,
        maxUses: input.maxUses,
      })
      .returning({ id: invitations.id, createdAt: invitations.createdAt });
    const [me] = await tx.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.id, ctx.userId));
    await track(tx, { userId: ctx.userId, workspaceId, name: "invite_sent", props: { kind: "link", role: input.role } });
    return {
      url: `${siteConfig.url}/davet/${token}`,
      link: {
        id: row!.id,
        role: input.role,
        expiresAt: iso(expiresAt)!,
        maxUses: input.maxUses,
        useCount: 0,
        createdAt: iso(row!.createdAt)!,
        invitedByName: me?.fullName ?? "",
      },
    };
  });
}

export async function listInviteLinks(ctx: Ctx, workspaceId: string): Promise<InviteLink[]> {
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    if (ws.role !== "owner" && ws.role !== "admin") throw new ForbiddenError();
    const rows = await tx
      .select({
        id: invitations.id,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        maxUses: invitations.maxUses,
        useCount: invitations.useCount,
        createdAt: invitations.createdAt,
        invitedByName: profiles.fullName,
      })
      .from(invitations)
      .innerJoin(profiles, eq(profiles.id, invitations.invitedBy))
      .where(
        and(
          eq(invitations.workspaceId, workspaceId),
          eq(invitations.kind, "link"),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, sql`now()`),
        ),
      )
      .orderBy(desc(invitations.createdAt));
    return rows
      .filter((r) => r.maxUses === null || r.useCount < r.maxUses)
      .map((r) => ({ ...r, expiresAt: iso(r.expiresAt)!, createdAt: iso(r.createdAt)! }));
  });
}

export async function revokeInviteLink(ctx: Ctx, workspaceId: string, inviteId: string) {
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    if (ws.role !== "owner" && ws.role !== "admin") throw new ForbiddenError();
    const updated = await tx
      .update(invitations)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(invitations.id, inviteId), eq(invitations.workspaceId, workspaceId)))
      .returning({ id: invitations.id });
    if (updated.length === 0) throw new NotFoundError();
  });
}

export async function previewInvite(ctx: Ctx, token: string): Promise<InvitePreview> {
  return withUser(ctx.claims, async (tx) => {
    const rows = (await tx.execute(
      sql`select workspace_name as "workspaceName", workspace_slug as "workspaceSlug", inviter_name as "inviterName",
                 role, state from app.invite_preview(${hashInviteToken(token)})`,
    )) as unknown as InvitePreview[];
    return rows[0] ?? { workspaceName: null, workspaceSlug: null, inviterName: null, role: null, state: "invalid" };
  });
}

export async function acceptInvite(ctx: Ctx, token: string): Promise<{ workspaceId: string; slug: string }> {
  return withUser(ctx.claims, async (tx) => {
    const rows = (await tx.execute(
      sql`select app.accept_invite(${hashInviteToken(token)}, ${JSON.stringify(limitsJson())}::jsonb) as id`,
    )) as unknown as { id: string }[];
    const workspaceId = rows[0]!.id;
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    await track(tx, { userId: ctx.userId, workspaceId, name: "invite_accepted", props: { role: ws.role } });
    return { workspaceId, slug: ws.slug };
  });
}

/** Owner/admin changes someone's role (limits + admin rules enforced in SQL). */
export async function changeMemberRole(ctx: Ctx, workspaceId: string, userId: string, role: Exclude<WorkspaceRole, "owner">) {
  return withUser(ctx.claims, async (tx) => {
    await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    await tx.execute(
      sql`select app.change_member_role(${workspaceId}::uuid, ${userId}::uuid, ${role}::public.workspace_role, ${JSON.stringify(limitsJson())}::jsonb)`,
    );
  });
}

/** Remove a member (owner/admin) or leave the workspace (yourself). The owner cannot leave. */
export async function removeMember(ctx: Ctx, workspaceId: string, userId: string) {
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    const self = userId === ctx.userId;
    if (!self && ws.role !== "owner" && ws.role !== "admin") throw new ForbiddenError();
    const removed = await tx
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .returning({ userId: workspaceMembers.userId });
    if (removed.length === 0) throw new NotFoundError();
    await track(tx, { userId: ctx.userId, workspaceId: self ? null : workspaceId, name: self ? "member_left" : "member_removed" });
  });
}
