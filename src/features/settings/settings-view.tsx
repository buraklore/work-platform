"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Menu, MenuCheckItem, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Avatar, Skeleton } from "@/components/ui/misc";
import type { PlanLimits } from "@/config/plans";
import { canManage, useMe, useMembers, useWorkspace } from "@/features/workspaces/context";
import type { InviteLink, Me, Member, WorkspaceRole, WorkspaceUsage } from "@/features/workspaces/types";
import { api } from "@/lib/api/client";
import { useErrorToast } from "@/lib/client/errors";
import { qk } from "@/lib/client/keys";
import { formatLongDate } from "@/lib/dates/format";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/client/use-mod-key";
import { usePersistedTheme } from "@/lib/client/use-persisted-theme";

export function SettingsView() {
  const t = useTranslations("settings");
  return (
    <div className="mx-auto w-full max-w-2xl space-y-12 px-4 pb-28 pt-6 md:px-8 md:pt-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <ProfileSection />
      <AppearanceSection />
      <WorkspaceSection />
      <MembersSection />
    </div>
  );
}

function Section({ id, title, children, aside }: { id?: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="scroll-mt-20">
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 id={`${id ?? title}-h`} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ProfileSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const onError = useErrorToast();
  const { data: me } = useMe();
  const [draft, setName] = useState<string | null>(null);
  const name = draft ?? me?.fullName ?? "";
  const save = useMutation({
    mutationFn: (fullName: string) => api<Me>("/me", { method: "PATCH", body: { fullName } }),
    onSuccess: (next) => {
      qc.setQueryData(qk.me, next);
      setName(null);
      void qc.invalidateQueries({ queryKey: ["members"] });
      toast(tc("saved"));
    },
    onError,
  });
  if (!me) return <Skeleton className="h-32 w-full" />;
  return (
    <Section title={t("profile")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate(name.trim());
        }}
      >
        <div className="flex items-center gap-3">
          <Avatar id={me.id} name={me.fullName || me.email} src={me.avatarUrl} size={44} />
          <div className="min-w-0 flex-1 truncate text-sm text-muted">{me.email}</div>
        </div>
        <Field label={t("fullName")} htmlFor="fullName">
          <Input id="fullName" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === me.fullName || save.isPending}>
          {tc("save")}
        </Button>
      </form>
    </Section>
  );
}

function AppearanceSection() {
  const t = useTranslations("settings");
  const tn = useTranslations("nav");
  const { theme, setTheme } = usePersistedTheme();
  const mounted = useHydrated();
  const options = [
    ["light", tn("themeLight"), Sun],
    ["dark", tn("themeDark"), Moon],
    ["system", tn("themeSystem"), Monitor],
  ] as const;
  return (
    <Section title={t("appearance")}>
      <div role="radiogroup" aria-label={tn("theme")} className="inline-flex rounded-lg border border-line p-1">
        {options.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mounted && theme === value}
            onClick={() => setTheme(value)}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm", mounted && theme === value ? "bg-raised text-fg" : "text-muted hover:text-fg")}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function WorkspaceSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const workspace = useWorkspace();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const manage = canManage(workspace.role);
  const [name, setName] = useState(workspace.name);
  const { data: usage } = useQuery({
    queryKey: qk.usage(workspace.id),
    queryFn: () => api<{ plan: string; usage: WorkspaceUsage; limits: PlanLimits }>(`/workspaces/${workspace.id}/usage`),
  });
  const save = useMutation({
    mutationFn: (value: string) => api(`/workspaces/${workspace.id}`, { method: "PATCH", body: { name: value } }),
    onSuccess: () => {
      toast(tc("saved"));
      void qc.invalidateQueries({ queryKey: qk.me });
      window.location.reload(); // the workspace name is server-provided context
    },
    onError,
  });
  const rows: Array<[string, number, number | null]> = usage
    ? [
        [t("usageMembers"), usage.usage.members, usage.limits.members],
        [t("usageGuests"), usage.usage.guests, usage.limits.guests],
        [t("usageProjects"), usage.usage.projects, usage.limits.projects],
        [t("usageTasks"), usage.usage.activeTasks, usage.limits.activeTasks],
      ]
    : [];
  return (
    <Section title={t("workspace")}>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== workspace.name) save.mutate(name.trim());
        }}
      >
        <div className="flex-1">
          <Field label={t("workspaceName")} htmlFor="ws-name" hint={manage ? undefined : t("ownerOnly")}>
            <Input id="ws-name" value={name} disabled={!manage} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        {manage ? (
          <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === workspace.name}>
            {tc("save")}
          </Button>
        ) : null}
      </form>
      <div className="mt-6">
        <p className="text-sm font-medium">
          {t("plan")}: <span className="text-muted">{t("planFree")}</span>
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {rows.map(([label, used, limit]) => {
            const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            return (
              <div key={label} className="rounded-lg border border-line p-3">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="mt-1 tabular-nums">{limit ? t("usageOf", { used, limit }) : used}</dd>
                {limit ? (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised">
                    <div className={cn("h-full rounded-full", pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warn" : "bg-accent")} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </dl>
      </div>
    </Section>
  );
}

function MembersSection() {
  const t = useTranslations("settings");
  const router = useRouter();
  const tc = useTranslations("common");
  const workspace = useWorkspace();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const { data: me } = useMe();
  const { data: members, isLoading } = useMembers(workspace.id);
  const [removing, setRemoving] = useState<Member | null>(null);
  const roleLabel: Record<WorkspaceRole, string> = { owner: t("roleOwner"), admin: t("roleAdmin"), member: t("roleMember"), guest: t("roleGuest") };
  const manage = canManage(workspace.role);
  const settle = () => {
    void qc.invalidateQueries({ queryKey: qk.members(workspace.id) });
    void qc.invalidateQueries({ queryKey: qk.usage(workspace.id) });
  };
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Exclude<WorkspaceRole, "owner"> }) =>
      api(`/workspaces/${workspace.id}/members/${userId}`, { method: "PATCH", body: { role } }),
    onSuccess: () => toast(tc("saved")),
    onError,
    onSettled: settle,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api(`/workspaces/${workspace.id}/members/${userId}`, { method: "DELETE" }),
    onSuccess: (_d, userId) => {
      if (userId === me?.id) {
        // Left the workspace: drop its cached data and let "/" pick where to go next.
        qc.clear();
        router.replace("/");
        router.refresh();
        return;
      }
      toast(t("memberRemoved"));
    },
    onError,
    onSettled: settle,
  });
  // Only the owner hands out or takes away admin rights (enforced in SQL too).
  const rolesFor = (m: Member): Array<Exclude<WorkspaceRole, "owner">> =>
    workspace.role === "owner" || m.role !== "admin" ? (workspace.role === "owner" ? ["admin", "member", "guest"] : ["member", "guest"]) : [];

  return (
    <Section id="uyeler" title={t("members")} aside={members ? <span className="text-sm text-muted">{t("membersCount", { count: members.length })}</span> : null}>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ul className="divide-y divide-line">
          {(members ?? []).map((m) => {
            const self = m.userId === me?.id;
            const options = manage && !self && m.role !== "owner" ? rolesFor(m) : [];
            return (
              <li key={m.userId} className="flex items-center gap-3 py-2.5">
                <Avatar id={m.userId} name={m.fullName || m.email} src={m.avatarUrl} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {m.fullName || m.email}
                    {self ? <span className="ml-1.5 text-sm text-faint">({tc("you")})</span> : null}
                  </p>
                  <p className="truncate text-sm text-muted">{m.email}</p>
                </div>
                {options.length > 0 ? (
                  <Menu>
                    <MenuTrigger className="h-8 rounded-md border border-line px-2.5 text-sm hover:bg-raised">{roleLabel[m.role]}</MenuTrigger>
                    <MenuContent align="end">
                      {options.map((r) => (
                        <MenuCheckItem key={r} checked={m.role === r} onSelect={() => m.role !== r && changeRole.mutate({ userId: m.userId, role: r })}>
                          {roleLabel[r]}
                        </MenuCheckItem>
                      ))}
                      <MenuSeparator />
                      <MenuItem danger onSelect={() => setRemoving(m)}>
                        {t("removeMember")}
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                ) : (
                  <span className="text-sm text-muted">{roleLabel[m.role]}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {removing ? (
        <div className="mt-3 rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm">
          <p className="text-fg">{t("removeMemberConfirm", { name: removing.fullName || removing.email })}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate(removing.userId);
                setRemoving(null);
              }}
            >
              {t("removeMember")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      {manage ? <InviteLinks /> : null}
      {workspace.role !== "owner" && me ? (
        <div className="mt-8 border-t border-line pt-4">
          <Button
            variant="ghost"
            className="text-danger hover:text-danger"
            onClick={() => setRemoving({ userId: me.id, fullName: t("yourself"), email: me.email, avatarUrl: me.avatarUrl, role: workspace.role })}
          >
            {t("leaveWorkspace")}
          </Button>
        </div>
      ) : null}
    </Section>
  );
}

function InviteLinks() {
  const t = useTranslations("invite");
  const ts = useTranslations("settings");
  const workspace = useWorkspace();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const [role, setRole] = useState<"member" | "guest" | "admin">("member");
  const [expires, setExpires] = useState<"1" | "7" | "30">("7");
  const [oneUse, setOneUse] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const { data: links = [] } = useQuery({ queryKey: qk.inviteLinks(workspace.id), queryFn: () => api<InviteLink[]>(`/workspaces/${workspace.id}/invite-links`) });
  const create = useMutation({
    mutationFn: () =>
      api<{ url: string; link: InviteLink }>(`/workspaces/${workspace.id}/invite-links`, {
        method: "POST",
        body: { role, expiresInDays: expires, maxUses: oneUse ? 1 : null },
      }),
    onSuccess: ({ url }) => {
      setFresh(url);
      toast(t("created"));
      void qc.invalidateQueries({ queryKey: qk.inviteLinks(workspace.id) });
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/workspaces/${workspace.id}/invite-links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast(t("revoked"));
      void qc.invalidateQueries({ queryKey: qk.inviteLinks(workspace.id) });
    },
    onError,
  });
  const roleLabel = { member: ts("roleMember"), guest: ts("roleGuest"), admin: ts("roleAdmin") } as const;
  const roleHint = { member: t("memberHint"), guest: t("guestHint"), admin: t("adminHint") } as const;
  const expiryLabel = { "1": t("expires1"), "7": t("expires7"), "30": t("expires30") } as const;

  return (
    <div className="mt-8 rounded-xl border border-line p-4">
      <h3 className="flex items-center gap-2 font-medium">
        <Link2 className="size-4 text-muted" />
        {t("title")}
      </h3>
      <p className="mt-1 text-sm text-muted">{t("body")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Menu>
          <MenuTrigger className="h-8 rounded-md border border-line px-2.5 text-sm hover:bg-raised">
            {t("role")}: {roleLabel[role]}
          </MenuTrigger>
          <MenuContent className="w-64">
            {(workspace.role === "owner" ? (["member", "guest", "admin"] as const) : (["member", "guest"] as const)).map((r) => (
              <MenuCheckItem key={r} checked={role === r} onSelect={() => setRole(r)}>
                <span className="block">{roleLabel[r]}</span>
                <span className="block whitespace-normal text-xs text-muted">{roleHint[r]}</span>
              </MenuCheckItem>
            ))}
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger className="h-8 rounded-md border border-line px-2.5 text-sm hover:bg-raised">
            {t("expires")}: {expiryLabel[expires]}
          </MenuTrigger>
          <MenuContent>
            {(["1", "7", "30"] as const).map((d) => (
              <MenuCheckItem key={d} checked={expires === d} onSelect={() => setExpires(d)}>
                {expiryLabel[d]}
              </MenuCheckItem>
            ))}
          </MenuContent>
        </Menu>
        <label className="inline-flex h-8 items-center gap-2 rounded-md border border-line px-2.5 text-sm">
          <input type="checkbox" checked={oneUse} onChange={(e) => setOneUse(e.target.checked)} className="accent-[var(--accent)]" />
          {t("oneUse")}
        </label>
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          {t("create")}
        </Button>
      </div>
      {fresh ? (
        <div className="mt-4 rounded-lg bg-accent-soft p-3">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-sm">{fresh}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(fresh);
                toast(t("copied"));
              }}
            >
              <Copy />
              {t("copy")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">{t("onlyOnce")}</p>
        </div>
      ) : null}
      <h4 className="mt-5 text-sm font-medium text-muted">{t("active")}</h4>
      {links.length === 0 ? (
        <p className="mt-1 text-sm text-faint">{t("noActive")}</p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="font-medium">{l.role === "owner" ? ts("roleOwner") : roleLabel[l.role]}</span>
              <span className="text-muted">{t("expiresOn", { date: formatLongDate(l.expiresAt) })}</span>
              <span className="text-muted">{l.maxUses ? t("usesOf", { used: l.useCount, max: l.maxUses }) : t("uses", { used: l.useCount })}</span>
              <button type="button" onClick={() => revoke.mutate(l.id)} className="ml-auto text-danger hover:underline">
                {t("revoke")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
