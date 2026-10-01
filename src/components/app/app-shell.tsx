"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  Home,
  Keyboard,
  ListTodo,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  SquareKanban,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useErrorText } from "@/lib/client/errors";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Avatar, ColorDot, Kbd } from "@/components/ui/misc";
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";
import { useProjects } from "@/features/projects/hooks";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { TaskPanelHost } from "@/features/tasks/components/task-panel";
import { TASK_PARAM } from "@/features/tasks/use-open-task";
import { useMe, useWorkspace } from "@/features/workspaces/context";
import { api } from "@/lib/api/client";
import { emit } from "@/lib/client/bus";
import { usePersistedTheme } from "@/lib/client/use-persisted-theme";
import { cn } from "@/lib/utils";
import { useModKey } from "@/lib/client/use-mod-key";
import { CommandMenu } from "./command-menu";
import { ShortcutsDialog, useGlobalShortcuts } from "./shortcuts";

export function AppShell({ children }: { children: React.ReactNode }) {
  const workspace = useWorkspace();
  const t = useTranslations("nav");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const panelOpen = Boolean(useSearchParams().get(TASK_PARAM));
  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);
  useGlobalShortcuts(workspace.slug, openQuickAdd);
  usePersistedTheme(); // applies the profile's theme on a new device

  // Remember the last workspace so "/" lands here next time.
  useEffect(() => {
    void api(`/workspaces/${workspace.id}/remember`, { method: "POST" }).catch(
      () => {},
    );
  }, [workspace.id]);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t("mainNav")}
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        {/* On wide screens the task panel sits beside the content instead of covering it. */}
        <main
          id="main"
          data-panel-open={panelOpen || undefined}
          className="flex min-h-0 flex-1 flex-col bg-surface transition-[padding] duration-200 md:border-l md:border-line xl:data-[panel-open]:pr-[560px]"
        >
          {children}
        </main>
      </div>
      <MobileNav onQuickAdd={openQuickAdd} />
      <TaskPanelHost />
      <CommandMenu onQuickAdd={openQuickAdd} />
      <ShortcutsDialog />
      <CreateProjectDialog />
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent title={t("newTask")} className="top-[18vh] max-w-xl">
          <QuickAdd
            workspaceId={workspace.id}
            source="command"
            autoFocus
            listenShortcut={false}
            onCreated={() => setQuickAddOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useNavItems() {
  const workspace = useWorkspace();
  const t = useTranslations("nav");
  const base = `/w/${workspace.slug}`;
  return [
    { href: base, label: t("home"), icon: Home, exact: true },
    { href: `${base}/gorevlerim`, label: t("myTasks"), icon: ListTodo },
    { href: `${base}/projeler`, label: t("projects"), icon: SquareKanban },
  ];
}

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar() {
  const t = useTranslations("nav");
  const workspace = useWorkspace();
  const pathname = usePathname();
  const items = useNavItems();
  const { data: projects = [] } = useProjects(workspace.id);
  const base = `/w/${workspace.slug}`;
  const active = projects.filter((p) => !p.archivedAt);
  const mod = useModKey();

  return (
    <aside
      aria-label={t("mainNav")}
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col md:flex"
    >
      <div className="p-2">
        <WorkspaceSwitcher />
      </div>
      <button
        type="button"
        onClick={() => emit("command-menu")}
        className="mx-2 flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-raised hover:text-fg"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">{t("search")}</span>
        <span className="flex gap-0.5">
          <Kbd>{mod}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <nav className="mt-2 space-y-0.5 px-2">
        {items.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href, exact) ? "page" : undefined}
            className="flex h-8 items-center gap-2.5 rounded-md px-2 text-base text-muted hover:bg-raised hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:font-medium aria-[current=page]:text-fg"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-5 flex items-center justify-between px-4 text-xs font-medium text-faint">
        <span>{t("projects")}</span>
        {workspace.role !== "guest" ? (
          <button
            type="button"
            onClick={() => emit("new-project")}
            aria-label={t("newProject")}
            className="rounded p-0.5 hover:bg-raised hover:text-fg"
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>
      <nav className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {active.length === 0 ? (
          <p className="px-2 py-1 text-sm text-faint">{t("noProjects")}</p>
        ) : null}
        {active.map((p) => {
          const href = `${base}/projeler/${p.id}`;
          return (
            <Link
              key={p.id}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className="flex h-8 items-center gap-2.5 rounded-md px-2 text-base text-muted hover:bg-raised hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-fg"
            >
              <ColorDot color={p.color} />
              <span className="flex-1 truncate">
                {p.isPersonal ? t("personal") : p.name}
              </span>
              {p.openCount > 0 ? (
                <span className="text-xs tabular-nums text-faint">
                  {p.openCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-0.5 border-t border-line p-2">
        <Link
          href={`${base}/ayarlar`}
          aria-current={
            isActive(pathname, `${base}/ayarlar`) ? "page" : undefined
          }
          className="flex h-8 items-center gap-2.5 rounded-md px-2 text-base text-muted hover:bg-raised hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-fg"
        >
          <Settings className="size-4" />
          {t("settings")}
        </Link>
        <UserMenu />
      </div>
    </aside>
  );
}

function WorkspaceSwitcher({ compact }: { compact?: boolean }) {
  const t = useTranslations("nav");
  const workspace = useWorkspace();
  const { data: me } = useMe();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Menu>
        <MenuTrigger
          className={cn(
            "flex h-10 items-center gap-2.5 rounded-md px-2 text-left hover:bg-raised",
            compact ? "min-w-0 flex-1" : "w-full",
          )}
        >
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-fg font-display text-xs font-bold text-bg">
            {workspace.name.slice(0, 1).toLocaleUpperCase("tr-TR")}
          </span>
          <span className="flex-1 truncate font-medium">{workspace.name}</span>
          <ChevronsUpDown className="size-3.5 text-faint" />
        </MenuTrigger>
        <MenuContent className="w-56">
          <MenuLabel>{t("workspaces")}</MenuLabel>
          {(me?.workspaces ?? []).map((w) => (
            <MenuItem key={w.id} onSelect={() => router.push(`/w/${w.slug}`)}>
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === workspace.id ? (
                <Check className="!text-accent" />
              ) : null}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => setCreating(true)}>
            <Plus />
            {t("newWorkspace")}
          </MenuItem>
        </MenuContent>
      </Menu>
      <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("nav");
  const to = useTranslations("onboarding");
  const ts = useTranslations("settings");
  const errorText = useErrorText();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (value: string) =>
      api<{ slug: string }>("/workspaces", {
        method: "POST",
        body: { name: value },
      }),
    onSuccess: ({ slug }) => {
      onOpenChange(false);
      setName("");
      router.push(`/w/${slug}?hosgeldin=1`);
      router.refresh();
    },
    onError: (err) => setError(errorText(err)),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setError(null);
      }}
    >
      <DialogContent
        title={t("newWorkspace")}
        description={to("workspaceBody")}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
        >
          <Field
            label={ts("workspaceName")}
            htmlFor="new-ws-name"
            error={error}
          >
            <Input
              id="new-ws-name"
              autoFocus
              value={name}
              maxLength={80}
              placeholder={to("workspacePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {t("createWorkspace")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserMenu({ compact }: { compact?: boolean }) {
  const t = useTranslations("nav");
  const { data: me } = useMe();
  const { theme, setTheme } = usePersistedTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSettled: () => {
      qc.clear();
      router.replace("/giris");
      router.refresh();
    },
  });
  const themes = [
    ["light", t("themeLight"), Sun],
    ["dark", t("themeDark"), Moon],
    ["system", t("themeSystem"), Monitor],
  ] as const;
  return (
    <Menu>
      <MenuTrigger
        className={cn(
          "flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-raised",
          compact && "w-auto",
        )}
        aria-label={me?.fullName ?? t("menu")}
      >
        {me ? (
          <Avatar
            id={me.id}
            name={me.fullName || me.email}
            src={me.avatarUrl}
            size={22}
          />
        ) : (
          <span className="size-[22px] rounded-full bg-raised" />
        )}
        {!compact ? (
          <span className="flex-1 truncate text-base">
            {me?.fullName || me?.email}
          </span>
        ) : null}
      </MenuTrigger>
      <MenuContent
        align={compact ? "end" : "start"}
        side={compact ? "bottom" : "top"}
        className="w-56"
      >
        <MenuLabel>{t("theme")}</MenuLabel>
        {themes.map(([value, label, Icon]) => (
          <MenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon />
            <span className="flex-1">{label}</span>
            {theme === value ? <Check className="!text-accent" /> : null}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => emit("shortcuts-help")}>
          <Keyboard />
          {t("shortcuts")}
        </MenuItem>
        <MenuItem onSelect={() => logout.mutate()}>
          <LogOut />
          {t("logout")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function MobileTopBar() {
  const t = useTranslations("nav");
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-bg/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <WorkspaceSwitcher compact />
      <button
        type="button"
        onClick={() => emit("command-menu")}
        aria-label={t("search")}
        className="rounded-md p-2 text-muted hover:bg-raised"
      >
        <Search className="size-5" />
      </button>
      <UserMenu compact />
    </header>
  );
}

function MobileNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const workspace = useWorkspace();
  const items = useNavItems();
  const settings = {
    href: `/w/${workspace.slug}/ayarlar`,
    label: t("settings"),
    icon: Settings,
  };
  const link = (item: {
    href: string;
    label: string;
    icon: typeof Home;
    exact?: boolean;
  }) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={
        isActive(pathname, item.href, item.exact) ? "page" : undefined
      }
      className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-muted aria-[current=page]:text-accent"
    >
      <item.icon className="size-5" />
      {item.label}
    </Link>
  );
  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {link(items[0]!)}
      {link(items[1]!)}
      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label={t("newTask")}
          className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-pop"
        >
          <Plus className="size-6" />
        </button>
      </div>
      {link(items[2]!)}
      {link(settings)}
    </nav>
  );
}
