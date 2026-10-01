"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { ColorDot, Skeleton } from "@/components/ui/misc";
import { useProjects } from "@/features/projects/hooks";
import { bucketTasks } from "@/features/tasks/buckets";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { TaskSection } from "@/features/tasks/components/task-section";
import { useMyTasks } from "@/features/tasks/hooks";
import { useMe, useMemberMap, useWorkspace } from "@/features/workspaces/context";
import { hourOfDay } from "@/lib/dates/format";
import { firstName } from "@/lib/text/tr";

export function HomeView({ welcome }: { welcome: boolean }) {
  const t = useTranslations("home");
  const tn = useTranslations("nav");
  const workspace = useWorkspace();
  const { data: me } = useMe();
  const { data, isLoading } = useMyTasks(workspace.id);
  const { data: projects = [] } = useProjects(workspace.id);
  const members = useMemberMap(workspace.id);
  const buckets = useMemo(() => bucketTasks(data?.open ?? []), [data]);

  const hour = hourOfDay();
  const name = firstName(me?.fullName || "");
  const greeting = hour < 11 ? t("morning", { name }) : hour < 18 ? t("day", { name }) : t("evening", { name });
  const summary = [
    buckets.today.length > 0 ? t("summaryToday", { count: buckets.today.length }) : null,
    buckets.overdue.length > 0 ? t("summaryOverdue", { count: buckets.overdue.length }) : null,
  ].filter(Boolean);
  const upcoming = buckets.nextSevenDays;
  const empty = !isLoading && (data?.open.length ?? 0) === 0;
  const recent = projects.filter((p) => !p.archivedAt && !p.isPersonal).slice(0, 6);
  const base = `/w/${workspace.slug}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-8 md:px-8 md:pt-14">
      <h1 suppressHydrationWarning className="font-display text-[2rem] font-semibold leading-tight tracking-tight md:text-[2.75rem]">{greeting.replace(/,\s*$/, "")}</h1>
      <p className="mt-2 text-lg text-muted">{welcome && empty ? t("welcome") : summary.length > 0 ? summary.join(" ") : t("summaryNone")}</p>

      <QuickAdd workspaceId={workspace.id} variant="hero" source="home" className="mt-7" />

      <div className="mt-10 space-y-8">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : empty ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-8">
            <h2 className="font-display text-lg font-semibold">{t("emptyTitle")}</h2>
            <p className="mt-1.5 max-w-prose text-muted">{t("emptyBody")}</p>
            <p className="mt-4 text-sm text-faint">{t("tryExamples")}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {[t("example1"), t("example2"), t("example3")].map((ex) => (
                <li key={ex} className="rounded-md bg-raised px-2.5 py-1 text-sm text-fg">
                  {ex}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <TaskSection title={t("overdue")} tone="danger" tasks={buckets.overdue} members={members} workspaceId={workspace.id} limit={8} moreHref={`${base}/gorevlerim?sekme=geciken`} moreLabel={t("allTasks")} />
            <TaskSection title={t("today")} tone="accent" tasks={buckets.today} members={members} workspaceId={workspace.id} limit={12} moreHref={`${base}/gorevlerim`} moreLabel={t("allTasks")} />
            <TaskSection title={t("upcoming")} tasks={upcoming} members={members} workspaceId={workspace.id} limit={8} moreHref={`${base}/gorevlerim?sekme=yaklasan`} moreLabel={t("allTasks")} />
            {/* Undated tasks typed here must stay visible here (they are mine, just not scheduled). */}
            <TaskSection title={t("noDate")} tasks={buckets.noDate} members={members} workspaceId={workspace.id} limit={8} moreHref={`${base}/gorevlerim?sekme=yaklasan`} moreLabel={t("allTasks")} />
          </>
        )}

        {recent.length > 0 ? (
          <section aria-label={t("recentProjects")}>
            <h2 className="mb-2 px-3 text-sm font-medium text-muted">{t("recentProjects")}</h2>
            <ul className="grid gap-1 sm:grid-cols-2">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link href={`${base}/projeler/${p.id}`} className="flex h-10 items-center gap-2.5 rounded-md px-3 hover:bg-raised">
                    <ColorDot color={p.color} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-sm tabular-nums text-faint">{p.openCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {projects.length === 0 ? <p className="px-3 text-sm text-faint">{tn("noProjects")}</p> : null}
      </div>
    </div>
  );
}
