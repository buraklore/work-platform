"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { addDays, addMonths, isoWeekday, startOfIsoWeek, todayIso, toUtcDate } from "@/lib/dates/tz";
import { parseQuickAdd } from "@/lib/nlp/tr-parser";
import { cn } from "@/lib/utils";

/** Monday-first short weekday names in the UI language (2026-01-05 was a Monday). */
function weekdayNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2026, 0, 5 + i))));
}

export function DatePicker({
  date,
  time,
  onChange,
}: {
  date: string | null;
  time: string | null;
  onChange: (value: { dueDate: string | null; dueTime: string | null }) => void;
}) {
  const t = useTranslations("dates");
  const locale = useLocale();
  const monthTitle = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const today = todayIso();
  const [month, setMonth] = useState(() => `${(date ?? today).slice(0, 7)}-01`);
  const [typed, setTyped] = useState("");

  const first = month;
  const gridStart = startOfIsoWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const lastRowNeeded = days.slice(35).some((d) => d.slice(0, 7) === month.slice(0, 7));
  const visible = lastRowNeeded ? days : days.slice(0, 35);

  const pick = (d: string | null) => onChange({ dueDate: d, dueTime: d ? time : null });
  const nextMonday = addDays(startOfIsoWeek(today), 7);
  const saturday = isoWeekday(today) >= 6 ? today : addDays(today, 6 - isoWeekday(today));

  const typedResult = typed.trim() ? parseQuickAdd(typed, { now: new Date() }) : null;

  return (
    <div className="w-[17rem] space-y-2">
      <Input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && typedResult?.dueDate) {
            e.preventDefault();
            onChange({ dueDate: typedResult.dueDate, dueTime: typedResult.dueTime ?? time });
            setTyped("");
          }
        }}
        placeholder={t("typePlaceholder")}
        aria-label={t("typeDate")}
        className="h-8 text-sm"
      />
      {typedResult?.dueDate ? (
        <p className="px-1 text-xs text-accent">
          {typedResult.dueDate.split("-").reverse().join(".")}
          {typedResult.dueTime ? ` ${typedResult.dueTime}` : ""} ↵
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-1">
        {[
          [t("today"), today],
          [t("tomorrow"), addDays(today, 1)],
          [t("weekend"), saturday],
          [t("nextWeek"), nextMonday],
        ].map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => pick(value!)}
            className={cn("h-8 rounded-md px-2 text-left text-sm hover:bg-raised", date === value && "bg-accent-soft text-accent")}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-sm font-medium capitalize">{monthTitle.format(toUtcDate(month))}</span>
        <div className="flex gap-0.5">
          <button type="button" aria-label={t("prevMonth")} onClick={() => setMonth(addMonths(month, -1))} className="rounded p-1 text-muted hover:bg-raised">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label={t("nextMonth")} onClick={() => setMonth(addMonths(month, 1))} className="rounded p-1 text-muted hover:bg-raised">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-faint">
        {weekdayNames(locale).map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div role="grid" className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
        {visible.map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const selected = d === date;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={dayLabel.format(toUtcDate(d))}
              onClick={() => pick(d)}
              className={cn(
                "mx-auto inline-flex size-8 items-center justify-center rounded-md tabular-nums hover:bg-raised",
                !inMonth && "text-faint",
                d === today && !selected && "font-semibold text-accent",
                selected && "bg-accent text-accent-fg hover:bg-accent",
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-line pt-2">
        <label className="text-sm text-muted" htmlFor="due-time">
          {t("time")}
        </label>
        <input
          id="due-time"
          type="time"
          value={time ?? ""}
          disabled={!date}
          onChange={(e) => onChange({ dueDate: date, dueTime: e.target.value || null })}
          className="h-8 rounded-md border border-line bg-surface px-2 text-sm disabled:opacity-50"
        />
        {date ? (
          <button type="button" onClick={() => pick(null)} className="ml-auto text-sm text-muted hover:text-danger">
            {t("clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
