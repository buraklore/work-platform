"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { addDays, isOverdue, todayIso } from "@/lib/dates/tz";
import { trNormalize } from "@/lib/text/tr";
import { setUrl } from "@/lib/client/url";
import type { TaskItem } from "./types";

export type TaskFilters = {
  assignee: "" | "me" | "none";
  due: "" | "overdue" | "today" | "week" | "none";
  priority: "" | "high";
  q: string;
};

const PARAMS = { assignee: "atanan", due: "tarih", priority: "oncelik", q: "q" } as const;
const ALLOWED: { [K in keyof TaskFilters]?: readonly string[] } = {
  assignee: ["", "me", "none"],
  due: ["", "overdue", "today", "week", "none"],
  priority: ["", "high"],
};

/** Filters live in the URL so a filtered view can be shared and survives refresh. */
export function useTaskFilters() {
  const params = useSearchParams();
  const pathname = usePathname();
  const filters = useMemo<TaskFilters>(() => {
    const read = <K extends keyof TaskFilters>(k: K) => {
      const v = params.get(PARAMS[k]) ?? "";
      const allowed = ALLOWED[k];
      return (allowed && !allowed.includes(v) ? "" : v) as TaskFilters[K];
    };
    return { assignee: read("assignee"), due: read("due"), priority: read("priority"), q: read("q") };
  }, [params]);
  const set = useCallback(
    (patch: Partial<TaskFilters>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        const key = PARAMS[k as keyof TaskFilters];
        if (v) next.set(key, v);
        else next.delete(key);
      }
      setUrl(`${pathname}${next.toString() ? `?${next}` : ""}`);
    },
    [params, pathname],
  );
  const active = Boolean(filters.assignee || filters.due || filters.priority || filters.q);
  return { filters, set, active, clear: () => set({ assignee: "", due: "", priority: "", q: "" }) };
}

export function matchesFilters(task: TaskItem, f: TaskFilters, meId: string | undefined): boolean {
  if (f.assignee === "me" && (!meId || !task.assigneeIds.includes(meId))) return false;
  if (f.assignee === "none" && task.assigneeIds.length > 0) return false;
  if (f.priority === "high" && task.priority !== "high" && task.priority !== "urgent") return false;
  if (f.due) {
    const today = todayIso();
    const done = Boolean(task.completedAt);
    if (f.due === "none" && task.dueDate) return false;
    if (f.due === "overdue" && !isOverdue(task.dueDate, task.dueTime, done)) return false;
    if (f.due === "today" && task.dueDate !== today) return false;
    if (f.due === "week" && (!task.dueDate || task.dueDate < today || task.dueDate > addDays(today, 6))) return false;
  }
  if (f.q && !trNormalize(task.title).includes(trNormalize(f.q))) return false;
  return true;
}
