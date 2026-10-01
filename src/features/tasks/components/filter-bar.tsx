"use client";

import { Calendar, Flag, Search, User, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Menu, MenuCheckItem, MenuContent, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { useTaskFilters, type TaskFilters } from "../filters";

export function FilterBar({ className }: { className?: string }) {
  const t = useTranslations("filters");
  const { filters, set, active, clear } = useTaskFilters();

  const pill = (on: boolean) =>
    cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm [&_svg]:size-3.5", on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-fg");

  const choice = <K extends keyof TaskFilters>(k: K, icon: React.ReactNode, label: string, options: Array<[TaskFilters[K], string]>) => {
    const current = options.find(([v]) => v === filters[k]);
    return (
      <Menu key={k}>
        <MenuTrigger className={pill(Boolean(filters[k]))}>
          {icon}
          {filters[k] ? current?.[1] : label}
        </MenuTrigger>
        <MenuContent>
          {options.map(([value, text]) => (
            <MenuCheckItem key={String(value)} checked={filters[k] === value} onSelect={() => set({ [k]: value } as Partial<TaskFilters>)}>
              {text}
            </MenuCheckItem>
          ))}
        </MenuContent>
      </Menu>
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="toolbar" aria-label={t("label")}>
      <label className={cn(pill(Boolean(filters.q)), "cursor-text")}>
        <Search />
        <input
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder={t("text")}
          aria-label={t("text")}
          className="w-28 bg-transparent text-fg placeholder:text-muted focus:outline-none sm:w-36"
        />
      </label>
      {choice("assignee", <User />, t("assignee"), [["", t("anyone")], ["me", t("me")], ["none", t("unassigned")]])}
      {choice("due", <Calendar />, t("due"), [["", t("anyDate")], ["overdue", t("overdue")], ["today", t("today")], ["week", t("week")], ["none", t("noDate")]])}
      {choice("priority", <Flag />, t("priority"), [["", t("anyPriority")], ["high", t("highPriority")]])}
      {active ? (
        <button type="button" onClick={clear} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted hover:text-fg">
          <X className="size-3.5" />
          {t("clear")}
        </button>
      ) : null}
    </div>
  );
}
