"use client";

import { Check, CheckSquare, Flag, GitBranch } from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef, useRef, useState } from "react";
import { AvatarStack, ColorDot } from "@/components/ui/misc";
import type { Member } from "@/features/workspaces/types";
import { cn } from "@/lib/utils";
import type { MyTaskItem, TaskItem } from "../types";
import { DueChip } from "./due-chip";
import { TaskCheck } from "./task-check";

type Props = {
  task: TaskItem | MyTaskItem;
  members: Map<string, Member>;
  showProject?: boolean;
  selected?: boolean;
  readOnly?: boolean;
  onOpen: () => void;
  onToggle: () => void;
  dragHandle?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

const SWIPE_COMMIT = 72;
const LONG_PRESS_MS = 250;

export const TaskRow = forwardRef<HTMLDivElement, Props>(function TaskRow(
  { task, members, showProject, selected, readOnly, onOpen, onToggle, dragHandle, className, style },
  ref,
) {
  const t = useTranslations("task");
  const done = Boolean(task.completedAt);
  const [dx, setDx] = useState(0);
  const gesture = useRef<{ x: number; y: number; active: boolean; id: number; at: number } | null>(null);

  const people = task.assigneeIds
    .map((id) => members.get(id))
    .filter((m): m is Member => Boolean(m))
    .map((m) => ({ id: m.userId, name: m.fullName || m.email, avatarUrl: m.avatarUrl }));

  // Touch: swipe right to complete. Vertical scrolling is left to the browser (touch-action: pan-y).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || readOnly) return;
    gesture.current = { x: e.clientX, y: e.clientY, active: false, id: e.pointerId, at: e.timeStamp };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (!g.active) {
      if (Math.abs(my) > 10) {
        gesture.current = null;
        return;
      }
      // A long press is the start of a drag (list reordering), never a swipe.
      if (e.timeStamp - g.at > LONG_PRESS_MS) {
        gesture.current = null;
        return;
      }
      if (mx > 10) g.active = true;
    }
    if (g.active) setDx(Math.max(0, Math.min(120, mx)));
  };
  const onPointerEnd = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.active && dx >= SWIPE_COMMIT) onToggle();
    setDx(0);
  };

  const project = "projectName" in task && showProject ? task : null;
  const isMyTask = "projectName" in task;

  return (
    <div ref={ref} style={style} className={cn("relative overflow-hidden", className)}>
      {dx > 0 ? (
        <div
          aria-hidden
          className={cn("absolute inset-y-0 left-0 flex items-center pl-4 text-white", dx >= SWIPE_COMMIT ? "bg-done" : "bg-done/60")}
          style={{ width: dx + 8 }}
        >
          {dx > 24 ? <Check className="size-5" /> : null}
        </div>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        aria-label={task.title}
        data-task-id={task.id}
        data-selected={selected || undefined}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) {
            e.preventDefault();
            onOpen();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        className={cn(
          "group relative flex min-h-11 cursor-default items-center gap-3 bg-surface px-3 py-2 transition-[background-color] md:min-h-10",
          "hover:bg-raised/70 data-[selected]:bg-accent-soft/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
          dx === 0 && "transition-transform duration-200",
        )}
      >
        {dragHandle}
        <TaskCheck checked={done} onToggle={onToggle} disabled={readOnly} label={done ? t("markIncomplete") : t("markComplete")} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn("truncate", done && "text-faint line-through decoration-faint/60")}>{task.title}</span>
          {task.priority === "urgent" || task.priority === "high" ? (
            <Flag
              aria-label={task.priority}
              className={cn("size-3.5 shrink-0", task.priority === "urgent" ? "fill-danger text-danger" : "text-warn")}
            />
          ) : null}
          {task.subtaskCount > 0 ? (
            <span className="hidden shrink-0 items-center gap-1 text-sm text-muted sm:inline-flex" title={t("subtaskProgress", { done: task.subtaskDoneCount, total: task.subtaskCount })}>
              <GitBranch className="size-3.5" />
              {task.subtaskDoneCount}/{task.subtaskCount}
            </span>
          ) : null}
          {task.checklistCount > 0 ? (
            <span className="hidden shrink-0 items-center gap-1 text-sm text-muted sm:inline-flex" title={t("checklistProgress", { done: task.checklistDoneCount, total: task.checklistCount })}>
              <CheckSquare className="size-3.5" />
              {task.checklistDoneCount}/{task.checklistCount}
            </span>
          ) : null}
        </div>
        {project ? (
          <span className="hidden max-w-40 shrink-0 items-center gap-1.5 text-sm text-muted md:inline-flex">
            <ColorDot color={project.projectColor} />
            <span className="truncate">{project.projectName}</span>
          </span>
        ) : null}
        <DueChip dueDate={task.dueDate} dueTime={task.dueTime} completed={done} />
        {people.length > 0 && !(isMyTask && people.length === 1) ? <AvatarStack people={people} /> : null}
      </div>
    </div>
  );
});
