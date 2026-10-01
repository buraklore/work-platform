/**
 * Calendar-date helpers pinned to a timezone (default Europe/Istanbul).
 * Due dates are plain calendar dates ("YYYY-MM-DD") + optional local time ("HH:MM").
 * Arithmetic happens on UTC-midnight Date objects so it never shifts by timezone.
 */

export const DEFAULT_TZ = "Europe/Istanbul";

export type IsoDate = string; // YYYY-MM-DD
export type HhMm = string; // HH:MM

const pad = (n: number) => String(n).padStart(2, "0");

export function isoFromParts(y: number, m: number, d: number): IsoDate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Calendar date + wall-clock time of an instant in a timezone. */
export function zonedParts(instant: Date, tz: string = DEFAULT_TZ) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

export function todayIso(instant: Date = new Date(), tz: string = DEFAULT_TZ): IsoDate {
  const p = zonedParts(instant, tz);
  return isoFromParts(p.year, p.month, p.day);
}

export function nowHhMm(instant: Date = new Date(), tz: string = DEFAULT_TZ): HhMm {
  const p = zonedParts(instant, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function toUtcDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function fromUtcDate(date: Date): IsoDate {
  return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

export function addMonths(iso: IsoDate, months: number): IsoDate {
  const d = toUtcDate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fromUtcDate(d);
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(iso: IsoDate): number {
  const w = toUtcDate(iso).getUTCDay();
  return w === 0 ? 7 : w;
}

export function startOfIsoWeek(iso: IsoDate): IsoDate {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function endOfMonth(iso: IsoDate): IsoDate {
  const d = toUtcDate(iso);
  return fromUtcDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcDate(a).getTime() - toUtcDate(b).getTime()) / 86_400_000);
}

export function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isOverdue(
  dueDate: IsoDate | null,
  dueTime: HhMm | null,
  completed: boolean,
  instant: Date = new Date(),
  tz: string = DEFAULT_TZ,
): boolean {
  if (!dueDate || completed) return false;
  const today = todayIso(instant, tz);
  if (dueDate < today) return true;
  if (dueDate === today && dueTime) return dueTime.slice(0, 5) < nowHhMm(instant, tz);
  return false;
}
