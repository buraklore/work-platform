"use client";

import { Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorDot, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspaces/context";
import { emit } from "@/lib/client/bus";
import { useProjects } from "../hooks";
import type { ProjectSummary } from "../types";

export function ProjectsView() {
  const t = useTranslations("projects");
  const tn = useTranslations("nav");
  const workspace = useWorkspace();
  const { data: projects, isLoading } = useProjects(workspace.id);
  const [showArchived, setShowArchived] = useState(false);
  const active = (projects ?? []).filter((p) => !p.archivedAt);
  const archived = (projects ?? []).filter((p) => p.archivedAt);
  const canCreate = workspace.role !== "guest";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pt-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        {canCreate ? (
          <Button onClick={() => emit("new-project")}>
            <Plus />
            {t("new")}
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {active.map((p) => (
              <ProjectRow key={p.id} project={p} personalLabel={tn("personal")} personalHint={t("personalHint")} />
            ))}
          </ul>
          {active.filter((p) => !p.isPersonal).length === 0 && canCreate ? (
            <div className="mt-8 max-w-md">
              <h2 className="font-display text-lg font-semibold">{t("emptyTitle")}</h2>
              <p className="mt-1.5 text-muted">{t("emptyBody")}</p>
              <Button className="mt-4" variant="secondary" onClick={() => emit("new-project")}>
                <Plus />
                {t("new")}
              </Button>
            </div>
          ) : null}
          {archived.length > 0 ? (
            <div className="mt-8">
              <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-sm text-muted hover:text-fg">
                {showArchived ? t("hideArchived") : t("showArchived", { count: archived.length })}
              </button>
              {showArchived ? (
                <ul className="mt-2 divide-y divide-line border-y border-line opacity-80">
                  {archived.map((p) => (
                    <ProjectRow key={p.id} project={p} personalLabel={tn("personal")} personalHint={t("personalHint")} />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ProjectRow({ project: p, personalLabel, personalHint }: { project: ProjectSummary; personalLabel: string; personalHint: string }) {
  const t = useTranslations("projects");
  const workspace = useWorkspace();
  const total = p.openCount + p.doneCount;
  const pct = total === 0 ? 0 : Math.round((p.doneCount / total) * 100);
  return (
    <li>
      <Link href={`/w/${workspace.slug}/projeler/${p.id}`} className="flex items-center gap-3 px-2 py-3 hover:bg-raised/60">
        <ColorDot color={p.color} className="size-3.5 rounded" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-medium">
            {p.isPersonal ? personalLabel : p.name}
            {p.visibility === "private" && !p.isPersonal ? <Lock className="size-3.5 text-faint" aria-label={t("privateBadge")} /> : null}
          </p>
          <p className="text-sm text-muted">{p.isPersonal ? personalHint : t("openTasks", { count: p.openCount })}</p>
        </div>
        {total > 0 ? (
          <div className="hidden w-32 items-center gap-2 sm:flex" aria-label={`${pct}%`}>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
            </div>
            <span className="w-9 text-right text-sm tabular-nums text-faint">{pct}%</span>
          </div>
        ) : null}
      </Link>
    </li>
  );
}
