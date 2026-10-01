import { diffDays, isOverdue, todayIso, toUtcDate, type IsoDate } from "./tz";

export type DueTone = "overdue" | "today" | "soon" | "later" | "none";

type DateWords = { today: string; tomorrow: string; yesterday: string };

const dayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const dayMonthYear = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function formatDue(
  dueDate: IsoDate | null,
  dueTime: string | null,
  words: DateWords,
  opts: { completed?: boolean; now?: Date } = {},
): { label: string; tone: DueTone } {
  if (!dueDate) return { label: "", tone: "none" };
  const now = opts.now ?? new Date();
  const today = todayIso(now);
  const diff = diffDays(dueDate, today);
  let label: string;
  if (diff === 0) label = words.today;
  else if (diff === 1) label = words.tomorrow;
  else if (diff === -1) label = words.yesterday;
  else if (diff > 1 && diff < 7) label = weekday.format(toUtcDate(dueDate));
  else if (dueDate.slice(0, 4) === today.slice(0, 4)) label = dayMonth.format(toUtcDate(dueDate));
  else label = dayMonthYear.format(toUtcDate(dueDate));
  if (dueTime) label += ` ${dueTime.slice(0, 5)}`;
  const tone: DueTone = opts.completed
    ? "later"
    : isOverdue(dueDate, dueTime, false, now)
      ? "overdue"
      : diff === 0
        ? "today"
        : diff > 0 && diff < 7
          ? "soon"
          : "later";
  return { label, tone };
}

export function formatLongDate(iso: string): string {
  return longDate.format(new Date(iso));
}

export function hourOfDay(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Istanbul" }).format(now));
}
