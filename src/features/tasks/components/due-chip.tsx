"use client";

import { useTranslations } from "next-intl";
import { formatDue } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

export function DueChip({
  dueDate,
  dueTime,
  completed,
  className,
}: {
  dueDate: string | null;
  dueTime: string | null;
  completed?: boolean;
  className?: string;
}) {
  const t = useTranslations("dates");
  if (!dueDate) return null;
  const { label, tone } = formatDue(dueDate, dueTime, { today: t("today"), tomorrow: t("tomorrow"), yesterday: t("yesterday") }, { completed });
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap text-sm tabular-nums",
        tone === "overdue" && "font-medium text-danger",
        tone === "today" && "font-medium text-accent",
        tone === "soon" && "text-fg",
        (tone === "later" || tone === "none") && "text-muted",
        className,
      )}
    >
      {label}
    </span>
  );
}
