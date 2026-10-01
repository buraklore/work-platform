"use client";

import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import { keyBetween } from "@/lib/positions";
import type { TaskItem } from "@/features/tasks/types";
import type { Status } from "./types";

export type Group = { status: Status; tasks: TaskItem[] };
export const GROUP_PREFIX = "group:";

/**
 * Multi-container sortable state shared by List and Board. While dragging we keep a
 * local id order per status; on drop we compute a fractional position between the
 * new neighbours and hand it to `onMove` (which updates optimistically).
 */
export function useTaskDnd(groups: Group[], onMove: (task: TaskItem, status: Status, position: string) => void) {
  const [order, setOrder] = useState<Record<string, string[]> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const base = useMemo(() => Object.fromEntries(groups.map((g) => [g.status.id, g.tasks.map((t) => t.id)])), [groups]);
  const byId = useMemo(() => new Map(groups.flatMap((g) => g.tasks.map((t) => [t.id, t] as const))), [groups]);
  const view = order ?? base;

  const containerOf = (id: string, map = view): string | undefined => {
    if (id.startsWith(GROUP_PREFIX)) return id.slice(GROUP_PREFIX.length);
    return Object.keys(map).find((k) => map[k]!.includes(id));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 6 } }),
    // Space picks a task up (Enter is reserved for opening it).
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setOrder(base);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !order) return;
    const from = containerOf(String(active.id), order);
    const to = containerOf(String(over.id), order);
    if (!from || !to || from === to) return;
    setOrder((prev) => {
      if (!prev) return prev;
      const source = prev[from]!.filter((id) => id !== active.id);
      const target = [...prev[to]!];
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, String(active.id));
      return { ...prev, [from]: source, [to]: target };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const current = order;
    setOrder(null);
    setActiveId(null);
    if (!over || !current) return;
    const id = String(active.id);
    const container = containerOf(id, current);
    if (!container) return;
    let ids = current[container]!;
    const overId = String(over.id);
    if (!overId.startsWith(GROUP_PREFIX) && ids.includes(overId)) {
      ids = arrayMove(ids, ids.indexOf(id), ids.indexOf(overId));
    }
    const index = ids.indexOf(id);
    const task = byId.get(id);
    const status = groups.find((g) => g.status.id === container)?.status;
    if (!task || !status) return;
    const unchanged = task.statusId === container && (base[container] ?? []).join() === ids.join();
    if (unchanged) return;
    const prev = index > 0 ? byId.get(ids[index - 1]!)?.position : null;
    const next = index < ids.length - 1 ? byId.get(ids[index + 1]!)?.position : null;
    onMove(task, status, keyBetween(prev ?? null, next ?? null));
  };

  return {
    sensors,
    view,
    activeTask: activeId ? (byId.get(activeId) ?? null) : null,
    handlers: {
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel: () => {
        setOrder(null);
        setActiveId(null);
      },
    },
    tasksIn: (statusId: string) => (view[statusId] ?? []).map((id) => byId.get(id)).filter((t): t is TaskItem => Boolean(t)),
  };
}
