"use client";

import { Check, Flag, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, ColorDot } from "@/components/ui/misc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import type { Status } from "@/features/projects/types";
import type { Member } from "@/features/workspaces/types";
import { trNormalize } from "@/lib/text/tr";
import { cn } from "@/lib/utils";
import type { Label, TaskItem } from "../types";

const trigger =
  "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md px-2 text-left text-base hover:bg-raised disabled:cursor-default disabled:hover:bg-transparent";

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 rounded-md border border-line px-2">
      <Search className="size-3.5 text-faint" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full bg-transparent text-sm focus:outline-none"
      />
    </div>
  );
}

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-raised">
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">{children}</span>
      {selected ? <Check className="size-4 text-accent" /> : null}
    </button>
  );
}

export function StatusPicker({ statuses, value, onChange, disabled }: { statuses: Status[]; value: string; onChange: (s: Status) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = statuses.find((s) => s.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={trigger} disabled={disabled}>
        <ColorDot color={current?.color ?? "#8A8FA3"} />
        {current?.name}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1">
        {statuses.map((s) => (
          <Option key={s.id} selected={s.id === value} onClick={() => {
            onChange(s);
            setOpen(false);
          }}>
            <ColorDot color={s.color} />
            {s.name}
          </Option>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function AssigneePicker({
  members,
  value,
  onChange,
  disabled,
  hint,
}: {
  members: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const t = useTranslations("task");
  const tc = useTranslations("common");
  const [q, setQ] = useState("");
  const selected = members.filter((m) => value.includes(m.userId));
  const filtered = members.filter((m) => trNormalize(`${m.fullName} ${m.email}`).includes(trNormalize(q)));
  return (
    <Popover>
      <PopoverTrigger className={trigger} disabled={disabled}>
        {selected.length === 0 ? (
          <span className="text-faint">{t("unassigned")}</span>
        ) : (
          selected.map((m) => (
            <span key={m.userId} className="inline-flex items-center gap-1.5">
              <Avatar id={m.userId} name={m.fullName || m.email} src={m.avatarUrl} size={20} />
              <span className="truncate">{m.fullName || m.email}</span>
            </span>
          ))
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5">
        <SearchBox value={q} onChange={setQ} placeholder={tc("search")} />
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((m) => {
            const on = value.includes(m.userId);
            return (
              <Option key={m.userId} selected={on} onClick={() => onChange(on ? value.filter((id) => id !== m.userId) : [...value, m.userId])}>
                <Avatar id={m.userId} name={m.fullName || m.email} src={m.avatarUrl} size={20} />
                <span className="truncate">{m.fullName || m.email}</span>
              </Option>
            );
          })}
        </div>
        {hint ? <p className="px-2 pt-1.5 text-xs text-muted">{hint}</p> : null}
      </PopoverContent>
    </Popover>
  );
}

const PRIORITIES: TaskItem["priority"][] = ["urgent", "high", "normal", "low"];
const PRIORITY_CLASS: Record<TaskItem["priority"], string> = {
  urgent: "fill-danger text-danger",
  high: "text-warn",
  normal: "text-faint",
  low: "text-faint opacity-60",
};

export function PriorityPicker({ value, onChange, disabled }: { value: TaskItem["priority"]; onChange: (p: TaskItem["priority"]) => void; disabled?: boolean }) {
  const t = useTranslations("priority");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={trigger} disabled={disabled}>
        <Flag className={cn("size-4", PRIORITY_CLASS[value])} />
        {t(value)}
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1">
        {PRIORITIES.map((p) => (
          <Option key={p} selected={p === value} onClick={() => {
            onChange(p);
            setOpen(false);
          }}>
            <Flag className={cn("size-4", PRIORITY_CLASS[p])} />
            {t(p)}
          </Option>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const LABEL_COLORS = ["#3B4FE4", "#12998F", "#E0513F", "#C98A0B", "#8B5CF6", "#DB2777", "#0EA5E9", "#65A30D"];

export function LabelPicker({
  labels,
  value,
  onChange,
  onCreate,
  onError,
  disabled,
}: {
  labels: Label[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCreate: (name: string, color: string) => Promise<Label>;
  onError?: (err: unknown) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("task");
  const tc = useTranslations("common");
  const [q, setQ] = useState("");
  const selected = labels.filter((l) => value.includes(l.id));
  const filtered = labels.filter((l) => trNormalize(l.name).includes(trNormalize(q)));
  const exact = labels.some((l) => trNormalize(l.name) === trNormalize(q.trim()));
  return (
    <Popover>
      <PopoverTrigger className={cn(trigger, "flex-wrap py-1")} disabled={disabled}>
        {selected.length === 0 ? (
          <span className="text-faint">{t("addLabel")}</span>
        ) : (
          selected.map((l) => (
            <span key={l.id} className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-sm" style={{ backgroundColor: `${l.color}1f`, color: l.color }}>
              {l.name}
            </span>
          ))
        )}
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1.5">
        <SearchBox value={q} onChange={setQ} placeholder={tc("search")} />
        <div className="max-h-56 overflow-y-auto">
          {filtered.map((l) => {
            const on = value.includes(l.id);
            return (
              <Option key={l.id} selected={on} onClick={() => onChange(on ? value.filter((id) => id !== l.id) : [...value, l.id])}>
                <ColorDot color={l.color} />
                {l.name}
              </Option>
            );
          })}
          {q.trim() && !exact ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  const label = await onCreate(q.trim(), LABEL_COLORS[labels.length % LABEL_COLORS.length]!);
                  onChange([...value, label.id]);
                  setQ("");
                } catch (err) {
                  onError?.(err);
                }
              }}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-accent hover:bg-raised"
            >
              <Plus className="size-4" />
              {t("createLabel", { name: q.trim() })}
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
