import { addDays, isOverdue, startOfIsoWeek, todayIso } from "@/lib/dates/tz";
import type { MyTaskItem } from "./types";

const byDue = (a: MyTaskItem, b: MyTaskItem) =>
  (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") || a.createdAt.localeCompare(b.createdAt);

/** Splits my open tasks into the buckets Home and My Tasks show (Istanbul calendar). */
export function bucketTasks(open: MyTaskItem[], now = new Date()) {
  const today = todayIso(now);
  const endOfWeek = addDays(startOfIsoWeek(today), 6);
  const endOfNextWeek = addDays(endOfWeek, 7);
  const sorted = [...open].sort(byDue);
  const overdue = sorted.filter((t) => isOverdue(t.dueDate, t.dueTime, false, now));
  const overdueIds = new Set(overdue.map((t) => t.id));
  const todayTasks = sorted.filter((t) => t.dueDate === today && !overdueIds.has(t.id));
  const upcoming = sorted.filter((t) => t.dueDate && t.dueDate > today);
  return {
    overdue,
    today: todayTasks,
    nextSevenDays: upcoming.filter((t) => t.dueDate! <= addDays(today, 7)),
    thisWeek: upcoming.filter((t) => t.dueDate! <= endOfWeek),
    nextWeek: upcoming.filter((t) => t.dueDate! > endOfWeek && t.dueDate! <= endOfNextWeek),
    later: upcoming.filter((t) => t.dueDate! > endOfNextWeek),
    noDate: sorted.filter((t) => !t.dueDate),
    upcoming,
  };
}
