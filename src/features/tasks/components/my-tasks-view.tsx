"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/misc";
import { useMemberMap, useWorkspace } from "@/features/workspaces/context";
import { cn } from "@/lib/utils";
import { setUrl } from "@/lib/client/url";
import { bucketTasks } from "../buckets";
import { useMyTasks } from "../hooks";
import { useListKeyboard } from "../use-list-keyboard";
import { useOpenTask } from "../use-open-task";
import { useToggleComplete } from "../use-toggle-complete";
import { QuickAdd } from "./quick-add";
import { TaskSection } from "./task-section";

const TABS = [
  ["bugun", "today"],
  ["yaklasan", "upcoming"],
  ["geciken", "overdue"],
  ["tamamlanan", "completed"],
] as const;
type Tab = (typeof TABS)[number][1];

export function MyTasksView() {
  const t = useTranslations("myTasks");
  const workspace = useWorkspace();
  const members = useMemberMap(workspace.id);
  const { data, isLoading } = useMyTasks(workspace.id);
  const params = useSearchParams();
  const pathname = usePathname();
  const { openTask } = useOpenTask();
  const toggle = useToggleComplete(workspace.id);

  const tab: Tab = TABS.find(([slug]) => slug === params.get("sekme"))?.[1] ?? "today";
  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params.toString());
    p.set("sekme", TABS.find(([, id]) => id === next)![0]);
    setUrl(`${pathname}?${p}`);
  };

  const buckets = useMemo(() => bucketTasks(data?.open ?? []), [data]);
  const completed = data?.completed ?? [];
  const counts: Record<Tab, number> = { today: buckets.today.length, upcoming: buckets.upcoming.length + buckets.noDate.length, overdue: buckets.overdue.length, completed: completed.length };

  const sections: Array<{ title: string; tasks: typeof completed; tone?: "danger" | "accent" }> =
    tab === "today"
      ? [{ title: t("today"), tasks: buckets.today, tone: "accent" }]
      : tab === "overdue"
        ? [{ title: t("overdue"), tasks: buckets.overdue, tone: "danger" }]
        : tab === "completed"
          ? [{ title: t("completed"), tasks: completed }]
          : [
              { title: t("thisWeek"), tasks: buckets.thisWeek },
              { title: t("nextWeek"), tasks: buckets.nextWeek },
              { title: t("later"), tasks: buckets.later },
              { title: t("noDate"), tasks: buckets.noDate },
            ];
  const ids = sections.flatMap((s) => s.tasks.map((x) => x.id));
  const all = new Map([...(data?.open ?? []), ...completed].map((x) => [x.id, x]));
  const selected = useListKeyboard(ids, { open: openTask, toggle: (id) => all.get(id) && toggle(all.get(id)!) });
  const emptyText = { today: t("emptyToday"), upcoming: t("emptyUpcoming"), overdue: t("emptyOverdue"), completed: t("emptyCompleted") }[tab];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pt-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <QuickAdd workspaceId={workspace.id} source="list" className="mt-5 max-w-2xl" />
      <div role="tablist" aria-label={t("title")} className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([, id]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 text-base", tab === id ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {t(id)}
            {counts[id] > 0 ? <span className={cn("tabular-nums text-sm", id === "overdue" ? "text-danger" : "text-faint")}>{counts[id]}</span> : null}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-6">
        {isLoading ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : ids.length === 0 ? (
          <p className="px-3 py-10 text-center text-muted">{emptyText}</p>
        ) : (
          sections.map((s) => (
            <TaskSection key={s.title} title={s.title} tone={s.tone} tasks={s.tasks} members={members} workspaceId={workspace.id} selectedId={selected} />
          ))
        )}
      </div>
    </div>
  );
}
