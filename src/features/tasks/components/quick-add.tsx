"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AtSign, CalendarDays, CornerDownLeft, Flag, Folder, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, ColorDot } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { canSeeProject } from "@/features/projects/access";
import { useProject, useProjects } from "@/features/projects/hooks";
import type { ProjectDetail } from "@/features/projects/types";
import { useMe, useMembers } from "@/features/workspaces/context";
import { formatDue } from "@/lib/dates/format";
import { qk } from "@/lib/client/keys";
import { inlineQuickAdd, on } from "@/lib/client/bus";
import { parseQuickAdd, type HighlightKind } from "@/lib/nlp/tr-parser";
import { keyBetween } from "@/lib/positions";
import { cn } from "@/lib/utils";
import { newId, useCreateTask } from "../hooks";
import type { TaskItem, TaskSource } from "../types";
import { useOpenTask } from "../use-open-task";

const MARK: Record<HighlightKind, string> = {
  date: "bg-accent-soft text-accent",
  time: "bg-accent-soft text-accent",
  assignee: "bg-done-soft text-done",
  project: "bg-warn-soft text-warn",
  priority: "bg-danger-soft text-danger",
};

type Props = {
  workspaceId: string;
  defaultProjectId?: string | null;
  variant?: "hero" | "inline";
  source: TaskSource;
  autoFocus?: boolean;
  /** Listen for the "q" / "n" shortcut. */
  listenShortcut?: boolean;
  onCreated?: (task: TaskItem) => void;
  className?: string;
};

export function QuickAdd({
  workspaceId,
  defaultProjectId,
  variant = "inline",
  source,
  autoFocus,
  listenShortcut = true,
  onCreated,
  className,
}: Props) {
  const t = useTranslations("quickAdd");
  const td = useTranslations("dates");
  const tp = useTranslations("priority");
  const qc = useQueryClient();
  const { openTask } = useOpenTask();
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [disabled, setDisabled] = useState<HighlightKind[]>([]);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(null);

  const { data: me } = useMe();
  const { data: members = [] } = useMembers(workspaceId);
  const { data: projects = [] } = useProjects(workspaceId);
  const create = useCreateTask();

  const writable = projects.filter((p) => !p.archivedAt && p.access !== "viewer");
  const personal = projects.find((p) => p.isPersonal) ?? null;

  const parsed = useMemo(() => {
    const ctx = {
      now: new Date(),
      members: members.map((m) => ({ id: m.userId, name: m.fullName || m.email })),
      projects: writable.filter((p) => !p.isPersonal).map((p) => ({ id: p.id, name: p.name })),
    };
    const result = parseQuickAdd(text, { ...ctx, disable: disabled });
    // Only tokens typed ("yarın 14:00"): use the words as the title instead of doing nothing.
    if (!result.title.trim() && text.trim()) {
      return parseQuickAdd(text, { ...ctx, disable: ["date", "time", "assignee", "priority", "project"] });
    }
    return result;
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- projects/members identity changes only on refetch
  [text, disabled, members, projects]);

  const ambiguousIds = parsed.ambiguous.map((a) => resolved[a.text]).filter((id): id is string => Boolean(id));
  const unresolved = parsed.ambiguous.some((a) => !resolved[a.text]);
  const named = [...new Set([...parsed.assigneeIds, ...ambiguousIds])];
  // Captured from a personal view (Home, My Tasks): the task is mine unless I named someone,
  // otherwise it would vanish from the very screen it was typed on.
  const assigneeIds = named.length === 0 && !defaultProjectId && me ? [me.id] : named;
  const teamProjects = writable.filter((p) => !p.isPersonal);
  const delegates = Boolean(me) && assigneeIds.some((id) => id !== me?.id);
  // Giving work to someone else needs a project they can see: the personal project is private.
  const preferred = chosenProjectId ?? parsed.projectId ?? defaultProjectId ?? null;
  const preferredProject = projects.find((p) => p.id === preferred) ?? null;
  const targetProject =
    delegates && (!preferredProject || preferredProject.isPersonal)
      ? (teamProjects.length === 1 ? teamProjects[0]! : null)
      : (preferredProject ?? personal);
  const targetProjectId = targetProject?.id ?? null;
  // No target at all: a guest (no personal project) must pick one of their projects.
  const needsProject = !targetProject;
  // Everyone assigned must be able to see the target project (the database enforces it).
  const { data: targetDetail } = useProject(targetProject && !targetProject.isPersonal ? targetProject.id : null);
  const blockedAssignees =
    targetDetail && me
      ? members.filter((m) => assigneeIds.includes(m.userId) && !canSeeProject(targetDetail, m, me.id))
      : [];
  const blocked = needsProject || blockedAssignees.length > 0 || unresolved;

  useEffect(() => {
    if (!listenShortcut) return;
    inlineQuickAdd.count += 1;
    const off = on("quick-add", () => inputRef.current?.focus());
    return () => {
      inlineQuickAdd.count -= 1;
      off();
    };
  }, [listenShortcut]);

  const syncScroll = () => {
    if (overlayRef.current && inputRef.current) overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
  };

  const reset = () => {
    setText("");
    setDisabled([]);
    setResolved({});
    setChosenProjectId(null);
  };

  const submit = () => {
    const title = parsed.title.trim();
    if (!title || !text.trim() || blocked) return;
    const id = newId();
    const willBeMine = me && (assigneeIds.includes(me.id) || (assigneeIds.length === 0 && (targetProject?.isPersonal ?? true)));

    let optimistic: Parameters<typeof create.mutate>[0]["optimistic"];
    if (targetProjectId) {
      const detail = qc.getQueryData<ProjectDetail>(qk.project(targetProjectId));
      const status = detail?.statuses.find((s) => s.category === "todo");
      if (status) {
        const siblings = (qc.getQueryData<TaskItem[]>(qk.projectTasks(targetProjectId)) ?? []).filter((x) => x.statusId === status.id);
        const last = siblings.reduce<string | null>((max, x) => (max === null || x.position > max ? x.position : max), null);
        optimistic = { projectId: targetProjectId, statusId: status.id, statusCategory: "todo", position: keyBetween(last, null) };
      }
    }

    create.mutate(
      {
        id,
        workspaceId,
        projectId: targetProject?.isPersonal ? null : targetProjectId,
        title,
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        priority: parsed.priority ?? undefined,
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
        position: optimistic?.position ?? null,
        source,
        optimistic,
        optimisticMine:
          willBeMine && targetProject
            ? {
                projectId: targetProject.id,
                projectName: targetProject.isPersonal ? t("personal") : targetProject.name,
                projectColor: targetProject.color,
                isPersonalProject: targetProject.isPersonal,
              }
            : undefined,
      },
      {
        onSuccess: (task) => {
          onCreated?.(task);
          const inOtherProject = targetProject && !targetProject.isPersonal && targetProjectId !== defaultProjectId;
          toast(inOtherProject ? t("createdIn", { project: targetProject.name }) : t("created"), {
            action: { label: t("open"), onClick: () => openTask(task.id) },
          });
        },
      },
    );
    reset();
  };

  // Overlay: same text, transparent, with tinted spans under recognised tokens.
  const segments: Array<{ text: string; kind?: HighlightKind }> = [];
  let cursor = 0;
  for (const h of parsed.highlights) {
    if (h.start > cursor) segments.push({ text: text.slice(cursor, h.start) });
    segments.push({ text: text.slice(h.start, h.end), kind: h.kind });
    cursor = h.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  const hero = variant === "hero";
  const due = parsed.dueDate
    ? formatDue(parsed.dueDate, parsed.dueTime, { today: td("today"), tomorrow: td("tomorrow"), yesterday: td("yesterday") }).label
    : null;
  const dismiss = (kind: HighlightKind) => setDisabled((d) => [...d, ...(kind === "date" ? (["date", "time"] as const) : [kind])]);
  const showChips = text.trim().length > 0;

  // Right padding keeps the end of a long line clear of the "Ekle" button.
  const fieldClass = cn(
    "w-full whitespace-pre font-sans",
    hero ? "h-14 pl-5 text-lg" : "h-11 pl-3.5 text-base",
    showChips ? (hero ? "pr-24" : "pr-12 sm:pr-20") : hero ? "pr-5" : "pr-3.5",
  );

  return (
    <div className={className}>
      <div
        className={cn(
          "relative overflow-hidden border border-line bg-surface transition-[border-color,box-shadow] focus-within:border-accent",
          hero ? "rounded-xl focus-within:shadow-pop" : "rounded-lg",
        )}
      >
        <div ref={overlayRef} aria-hidden className={cn(fieldClass, "pointer-events-none absolute inset-0 flex items-center overflow-hidden text-transparent")}>
          <span>
            {segments.map((s, i) =>
              s.kind ? (
                <mark key={i} className={cn("parse-mark rounded-[3px]", MARK[s.kind], "!text-transparent")}>
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </span>
        </div>
        <input
          ref={inputRef}
          value={text}
          autoFocus={autoFocus}
          aria-label={t("label")}
          placeholder={hero ? t("placeholderExample") : t("placeholder")}
          onChange={(e) => {
            setText(e.target.value);
            if (!e.target.value) {
              setDisabled([]);
              setResolved({});
              setChosenProjectId(null);
            }
          }}
          onScroll={syncScroll}
          onKeyUp={syncScroll}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              if (text) reset();
              else inputRef.current?.blur();
            }
          }}
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          className={cn(fieldClass, "relative bg-transparent text-fg caret-accent placeholder:text-faint focus:outline-none focus-visible:outline-none")}
        />
        {showChips ? (
          <button
            type="button"
            onClick={submit}
            disabled={blocked}
            aria-label={t("submit")}
            className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md bg-accent px-2 py-1 text-sm font-medium text-accent-fg disabled:opacity-40"
          >
            <CornerDownLeft className="size-3.5" />
            <span className="hidden sm:inline">{t("submit")}</span>
          </button>
        ) : null}
      </div>

      {showChips ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm" aria-live="polite">
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2 [&>svg]:size-3.5",
                  needsProject ? "border border-dashed border-warn text-warn" : "bg-raised text-fg hover:bg-line",
                )}
              >
                <Folder />
                {targetProject ? (
                  <>
                    <ColorDot color={targetProject.color} />
                    {targetProject.isPersonal ? t("personal") : targetProject.name}
                  </>
                ) : (
                  t("pickProject")
                )}
              </button>
            </MenuTrigger>
            <MenuContent className="max-h-72 overflow-y-auto">
              {writable
                .filter((p) => !(delegates && p.isPersonal))
                .map((p) => (
                  <MenuItem key={p.id} onSelect={() => setChosenProjectId(p.id)}>
                    <ColorDot color={p.color} />
                    <span className="truncate">{p.isPersonal ? t("personal") : p.name}</span>
                  </MenuItem>
                ))}
              {delegates && teamProjects.length === 0 ? <p className="max-w-56 px-2 py-1.5 text-sm text-muted">{t("noTeamProject")}</p> : null}
            </MenuContent>
          </Menu>
          {due ? (
            <Chip icon={<CalendarDays />} tone="accent" onDismiss={() => dismiss("date")} dismissLabel={t("removeToken", { token: due })}>
              {due}
            </Chip>
          ) : null}
          {parsed.assigneeIds.map((id) => {
            const m = members.find((x) => x.userId === id);
            if (!m) return null;
            return (
              <Chip key={id} icon={<Avatar id={m.userId} name={m.fullName || m.email} size={16} />} tone="done" onDismiss={() => dismiss("assignee")} dismissLabel={t("removeToken", { token: m.fullName })}>
                {m.fullName || m.email}
              </Chip>
            );
          })}
          {parsed.ambiguous.map((a) => {
            const chosen = members.find((m) => m.userId === resolved[a.text]);
            return (
              <Menu key={a.text}>
                <MenuTrigger asChild>
                  <button type="button" className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-done px-2 text-done">
                    <AtSign className="size-3.5" />
                    {chosen ? chosen.fullName : t("whichPerson", { name: a.text.replace(/['’].*$/, "").replace(/^@/, "") })}
                  </button>
                </MenuTrigger>
                <MenuContent>
                  {a.candidates.map((c) => (
                    <MenuItem key={c.id} onSelect={() => setResolved((r) => ({ ...r, [a.text]: c.id }))}>
                      <Avatar id={c.id} name={c.name} size={18} />
                      {c.name}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            );
          })}
          {parsed.priority ? (
            <Chip icon={<Flag />} tone="danger" onDismiss={() => dismiss("priority")} dismissLabel={t("removeToken", { token: tp(parsed.priority) })}>
              {tp(parsed.priority)}
            </Chip>
          ) : null}
          {needsProject ? (
            <span role="status" className="text-sm text-warn">
              {!delegates
                ? writable.length === 0
                  ? t("guestNoProject")
                  : t("pickProject")
                : teamProjects.length === 0
                  ? t("noTeamProject")
                  : t("delegateNeedsProject")}
            </span>
          ) : unresolved ? (
            <span role="status" className="text-sm text-done">
              {t("pickPerson")}
            </span>
          ) : blockedAssignees.length > 0 ? (
            <span role="status" className="text-sm text-warn">
              {t("assigneeNoAccess", { names: blockedAssignees.map((m) => m.fullName || m.email).join(", ") })}
            </span>
          ) : (
            <span className="ml-auto hidden text-xs text-faint sm:inline">{t("hint")}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  icon,
  tone,
  children,
  onDismiss,
  dismissLabel,
}: {
  icon: React.ReactNode;
  tone: "neutral" | "accent" | "done" | "danger";
  children: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md pl-2 [&>svg]:size-3.5",
        onDismiss ? "pr-1" : "pr-2",
        tone === "neutral" && "bg-raised text-fg",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "done" && "bg-done-soft text-done",
        tone === "danger" && "bg-danger-soft text-danger",
      )}
    >
      {icon}
      {children}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label={dismissLabel} className="rounded p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10">
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
