"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  CheckCircle2,
  Circle,
  FolderPlus,
  Home,
  Keyboard,
  ListTodo,
  Moon,
  Plus,
  Settings,
  SquareKanban,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Dialog as D } from "radix-ui";
import { useDeferredValue, useEffect, useState } from "react";
import { Avatar, ColorDot } from "@/components/ui/misc";
import type { SearchResults } from "@/features/search/types";
import { useOpenTask } from "@/features/tasks/use-open-task";
import { useWorkspace } from "@/features/workspaces/context";
import { api } from "@/lib/api/client";
import { emit, on } from "@/lib/client/bus";
import { qk } from "@/lib/client/keys";
import { trNormalize } from "@/lib/text/tr";
import { usePersistedTheme } from "@/lib/client/use-persisted-theme";

export function CommandMenu({ onQuickAdd }: { onQuickAdd: () => void }) {
  const t = useTranslations("command");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const workspace = useWorkspace();
  const router = useRouter();
  const { openTask } = useOpenTask();
  const { resolvedTheme } = useTheme();
  const { setTheme } = usePersistedTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q.trim());

  useEffect(() => on("command-menu", () => setOpen(true)), []);

  const { data, isFetching } = useQuery({
    queryKey: qk.search(workspace.id, deferred),
    queryFn: ({ signal }) =>
      api<SearchResults>(
        `/workspaces/${workspace.id}/search?q=${encodeURIComponent(deferred)}`,
        { signal },
      ),
    enabled: open && deferred.length >= 2,
    staleTime: 10_000,
    placeholderData: keepPreviousData, // no "Yükleniyor" flash between keystrokes
  });

  const run = (fn: () => void) => {
    setOpen(false);
    setQ("");
    fn();
  };
  const base = `/w/${workspace.slug}`;
  type Action = {
    id: string;
    label: string;
    icon: typeof Plus;
    run: () => void;
  };
  const actions: Action[] = [
    { id: "new-task", label: t("newTask"), icon: Plus, run: onQuickAdd },
    ...(workspace.role !== "guest"
      ? [
          {
            id: "new-project",
            label: t("newProject"),
            icon: FolderPlus,
            run: () => emit("new-project"),
          },
        ]
      : []),
    {
      id: "theme",
      label: t("toggleTheme"),
      icon: Moon,
      run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
    {
      id: "shortcuts",
      label: t("showShortcuts"),
      icon: Keyboard,
      run: () => emit("shortcuts-help"),
    },
  ];
  const navigation: Action[] = [
    { id: "home", label: tn("home"), icon: Home, run: () => router.push(base) },
    {
      id: "my-tasks",
      label: tn("myTasks"),
      icon: ListTodo,
      run: () => router.push(`${base}/gorevlerim`),
    },
    {
      id: "projects",
      label: tn("projects"),
      icon: SquareKanban,
      run: () => router.push(`${base}/projeler`),
    },
    {
      id: "settings",
      label: tn("settings"),
      icon: Settings,
      run: () => router.push(`${base}/ayarlar`),
    },
  ];
  const needle = trNormalize(deferred);
  const match = (a: Action) => !needle || trNormalize(a.label).includes(needle);
  const groups: Array<[string, Action[]]> = [
    [t("actions"), actions.filter(match)],
    [t("navigation"), navigation.filter(match)],
  ];
  const showResults = Boolean(deferred.length >= 2 && data && trNormalize(q.trim()).length >= 2);
  // We filter ourselves, so cmdk cannot re-pick the highlighted row when async results
  // replace the list: keep the highlight on an item that exists (first one by default).
  const rendered = [
    ...(showResults && data
      ? [...data.tasks.map((x) => `task-${x.id}`), ...data.projects.map((x) => `project-${x.id}`), ...data.people.map((x) => `person-${x.userId}`)]
      : []),
    ...groups.flatMap(([, items]) => items.map((a) => a.id)),
  ];
  const [highlight, setHighlight] = useState("");
  const active = rendered.includes(highlight) ? highlight : (rendered[0] ?? "");
  const item =
    "flex h-10 cursor-default items-center gap-2.5 rounded-md px-2.5 text-base data-[selected=true]:bg-raised [&>svg]:size-4 [&>svg]:text-muted";
  const heading =
    "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-faint";

  return (
    <D.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgb(16_18_25/0.45)]" />
        <D.Content className="fixed left-1/2 top-[10vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop focus:outline-none">
          <D.Title className="sr-only">{tn("searchHint")}</D.Title>
          <D.Description className="sr-only">{t("placeholder")}</D.Description>
          {/* Filtering is ours: Turkish-aware, on the visible labels (cmdk would match internal ids). */}
          <Command shouldFilter={false} loop label={tn("searchHint")} value={active} onValueChange={setHighlight}>
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder={t("placeholder")}
              className="h-12 w-full border-b border-line bg-transparent px-4 text-base placeholder:text-faint focus:outline-none"
            />
            <Command.List
              className={`max-h-[60vh] overflow-y-auto p-1.5 ${heading}`}
            >
              <Command.Empty className="px-3 py-6 text-center text-muted">
                {isFetching
                  ? tc("loading")
                  : deferred.length < 2
                    ? t("minChars")
                    : tc("noResults")}
              </Command.Empty>
              {showResults && data ? (
                <>
                  {data.tasks.length > 0 ? (
                    <Command.Group heading={t("tasks")}>
                      {data.tasks.map((task) => (
                        <Command.Item
                          key={task.id}
                          value={`task-${task.id}`}
                          onSelect={() => run(() => openTask(task.id))}
                          className={item}
                        >
                          {task.completed ? (
                            <CheckCircle2 className="!text-done" />
                          ) : (
                            <Circle />
                          )}
                          <span className="flex-1 truncate">{task.title}</span>
                          <span className="inline-flex max-w-36 items-center gap-1.5 truncate text-sm text-muted">
                            <ColorDot color={task.projectColor} />
                            <span className="truncate">{task.projectName}</span>
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {data.projects.length > 0 ? (
                    <Command.Group heading={t("projects")}>
                      {data.projects.map((p) => (
                        <Command.Item
                          key={p.id}
                          value={`project-${p.id}`}
                          onSelect={() =>
                            run(() => router.push(`${base}/projeler/${p.id}`))
                          }
                          className={item}
                        >
                          <ColorDot color={p.color} />
                          {p.isPersonal ? tn("personal") : p.name}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                  {data.people.length > 0 ? (
                    <Command.Group heading={t("people")}>
                      {data.people.map((p) => (
                        <Command.Item
                          key={p.userId}
                          value={`person-${p.userId}`}
                          onSelect={() =>
                            run(() => router.push(`${base}/ayarlar#uyeler`))
                          }
                          className={item}
                        >
                          <Avatar
                            id={p.userId}
                            name={p.fullName || p.email}
                            src={p.avatarUrl}
                            size={20}
                          />
                          <span className="truncate">{p.fullName}</span>
                          <span className="truncate text-sm text-muted">
                            {p.email}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                </>
              ) : null}
              {groups.map(([heading, items]) =>
                items.length > 0 ? (
                  <Command.Group key={heading} heading={heading}>
                    {items.map((a) => (
                      <Command.Item
                        key={a.id}
                        value={a.id}
                        onSelect={() => run(a.run)}
                        className={item}
                      >
                        <a.icon />
                        {a.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null,
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
