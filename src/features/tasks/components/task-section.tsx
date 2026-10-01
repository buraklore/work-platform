"use client";

import Link from "next/link";
import type { Member } from "@/features/workspaces/types";
import { cn } from "@/lib/utils";
import type { MyTaskItem } from "../types";
import { useOpenTask } from "../use-open-task";
import { useToggleComplete } from "../use-toggle-complete";
import { TaskRow } from "./task-row";

/** A titled block of task rows used by Home and My Tasks. */
export function TaskSection({
  title,
  tasks,
  members,
  workspaceId,
  tone,
  limit,
  moreHref,
  moreLabel,
  selectedId,
}: {
  title: string;
  tasks: MyTaskItem[];
  members: Map<string, Member>;
  workspaceId: string;
  tone?: "danger" | "accent";
  limit?: number;
  moreHref?: string;
  moreLabel?: string;
  selectedId?: string | null;
}) {
  const { openTask, openTaskId } = useOpenTask();
  const toggle = useToggleComplete(workspaceId);
  if (tasks.length === 0) return null;
  const shown = limit ? tasks.slice(0, limit) : tasks;
  return (
    <section aria-label={title}>
      <h2 className={cn("mb-1 flex items-center gap-2 px-3 text-sm font-medium", tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent" : "text-muted")}>
        {title}
        <span className="tabular-nums text-faint">{tasks.length}</span>
      </h2>
      <div className="divide-y divide-line/70">
        {shown.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            members={members}
            showProject
            selected={selectedId === task.id || openTaskId === task.id}
            onOpen={() => openTask(task.id)}
            onToggle={() => toggle(task)}
          />
        ))}
      </div>
      {moreHref && limit && tasks.length > limit ? (
        <Link href={moreHref} className="mt-1 inline-block px-3 text-sm text-accent hover:underline">
          {moreLabel} ({tasks.length})
        </Link>
      ) : null}
    </section>
  );
}
