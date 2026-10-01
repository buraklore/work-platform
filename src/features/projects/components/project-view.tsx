"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckSquare,
  ChevronDown,
  Flag,
  GitBranch,
  Kanban,
  List,
  Lock,
  Plus,
  Settings2,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AvatarStack, ColorDot, Skeleton } from "@/components/ui/misc";
import { matchesFilters, useTaskFilters } from "@/features/tasks/filters";
import {
  newId,
  useCreateTask,
  useProjectTasks,
  useUpdateTask,
} from "@/features/tasks/hooks";
import { FilterBar } from "@/features/tasks/components/filter-bar";
import { DueChip } from "@/features/tasks/components/due-chip";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { TaskCheck } from "@/features/tasks/components/task-check";
import { TaskRow } from "@/features/tasks/components/task-row";
import type { TaskItem } from "@/features/tasks/types";
import { useListKeyboard } from "@/features/tasks/use-list-keyboard";
import { useOpenTask } from "@/features/tasks/use-open-task";
import { useToggleComplete } from "@/features/tasks/use-toggle-complete";
import {
  useMe,
  useMemberMap,
  useMembers,
  useWorkspace,
} from "@/features/workspaces/context";
import type { Member } from "@/features/workspaces/types";
import { parseQuickAdd } from "@/lib/nlp/tr-parser";
import { keyBetween } from "@/lib/positions";
import { cn } from "@/lib/utils";
import { setUrl } from "@/lib/client/url";
import { useStoredView } from "@/lib/client/use-stored-view";
import Link from "next/link";
import { sortStatuses, useProject } from "../hooks";
import type { ProjectDetail, Status } from "../types";
import { GROUP_PREFIX, useTaskDnd, type Group } from "../use-task-dnd";
import { ProjectSettings } from "./project-settings";

type View = "list" | "board";

export function ProjectView({ projectId }: { projectId: string }) {
  const t = useTranslations("project");
  const tn = useTranslations("nav");
  const tf = useTranslations("filters");
  const tp = useTranslations("projects");
  const workspace = useWorkspace();
  const { data: project, isLoading, error } = useProject(projectId);
  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(projectId);
  const { data: me } = useMe();
  const members = useMemberMap(workspace.id);
  const { filters, active: filtersActive, clear } = useTaskFilters();
  const params = useSearchParams();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storedView, storeView] = useStoredView(projectId);

  // URL (shareable) → my last choice on this device → the project's default.
  const fromUrl =
    params.get("gorunum") === "pano"
      ? "board"
      : params.get("gorunum") === "liste"
        ? "list"
        : null;
  const view: View = fromUrl ?? storedView ?? project?.defaultView ?? "list";
  const setView = (v: View) => {
    const next = new URLSearchParams(params.toString());
    next.set("gorunum", v === "board" ? "pano" : "liste");
    setUrl(`${pathname}?${next}`);
    storeView(v);
  };

  const groups: Group[] = useMemo(() => {
    if (!project || !tasks) return [];
    const visible = tasks.filter((task) =>
      matchesFilters(task, filters, me?.id),
    );
    return sortStatuses(project.statuses).map((status) => ({
      status,
      tasks: visible
        .filter((task) => task.statusId === status.id)
        .sort((a, b) =>
          a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
        ),
    }));
  }, [project, tasks, filters, me?.id]);

  if (error && !project) {
    // Deleted, or access removed while viewing: say so instead of an endless skeleton.
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-xl font-semibold">
          {t("unavailableTitle")}
        </h1>
        <p className="mt-2 text-muted">{t("unavailableBody")}</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href={`/w/${workspace.slug}/projeler`}>{tn("projects")}</Link>
        </Button>
      </div>
    );
  }
  if (isLoading || !project) return <ProjectSkeleton />;

  const readOnly = project.access === "viewer" || Boolean(project.archivedAt);
  const total = tasks?.length ?? 0;
  const memberPeople = project.members.map((m) => ({
    id: m.userId,
    name: m.fullName || m.email,
    avatarUrl: m.avatarUrl,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-line px-4 pb-3 pt-4 md:px-8 md:pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <ColorDot color={project.color} className="size-3.5 rounded" />
          <h1 className="min-w-0 truncate font-display text-2xl font-semibold tracking-tight">
            {project.isPersonal ? tn("personal") : project.name}
          </h1>
          {project.visibility === "private" && !project.isPersonal ? (
            <Lock
              className="size-4 text-faint"
              aria-label={tp("privateBadge")}
            />
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {memberPeople.length > 0 && !project.isPersonal ? (
              <AvatarStack people={memberPeople} max={4} size={24} />
            ) : null}
            <div
              role="tablist"
              aria-label={t("viewLabel")}
              className="inline-flex rounded-md border border-line p-0.5"
            >
              {(["list", "board"] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  type="button"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-sm",
                    view === v
                      ? "bg-raised text-fg"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {v === "list" ? (
                    <List className="size-3.5" />
                  ) : (
                    <Kanban className="size-3.5" />
                  )}
                  {t(v)}
                </button>
              ))}
            </div>
            {project.access === "admin" ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("settings")}
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 />
              </Button>
            ) : null}
          </div>
        </div>
        {project.archivedAt ? (
          <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
            {t("archivedNotice")}
          </p>
        ) : null}
        {!readOnly ? (
          <QuickAdd
            workspaceId={workspace.id}
            defaultProjectId={project.id}
            source="list"
            className="mt-4 max-w-2xl"
          />
        ) : null}
        <FilterBar className="mt-3" />
      </header>

      {tasksLoading ? (
        <div className="space-y-2 p-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : total === 0 && readOnly ? (
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <h2 className="font-display text-lg font-semibold">
            {t("emptyTitle")}
          </h2>
          <p className="mt-2 text-muted">{t("emptyReadOnly")}</p>
        </div>
      ) : filtersActive && groups.every((g) => g.tasks.length === 0) ? (
        <div className="px-6 py-16 text-center text-muted">
          {t("noMatches")}{" "}
          <button
            type="button"
            onClick={clear}
            className="text-accent underline-offset-2 hover:underline"
          >
            {tf("clear")}
          </button>
        </div>
      ) : (
        <>
          {total === 0 ? (
            <div className="mx-4 mt-4 rounded-lg border border-dashed border-line-strong px-4 py-3 md:mx-8">
              <p className="font-medium">{t("emptyTitle")}</p>
              <p className="mt-0.5 text-sm text-muted">{t("emptyBody")}</p>
            </div>
          ) : null}
          {view === "board" ? (
            <BoardView
              project={project}
              groups={groups}
              members={members}
              readOnly={readOnly}
              dragDisabled={filtersActive}
            />
          ) : (
            <ListView
              project={project}
              groups={groups}
              members={members}
              readOnly={readOnly}
              dragDisabled={filtersActive}
            />
          )}
        </>
      )}

      {project.access === "admin" ? (
        <ProjectSettings
          project={project}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      ) : null}
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <div className="space-y-4 p-8">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-11 w-full max-w-2xl" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

type ViewProps = {
  project: ProjectDetail;
  groups: Group[];
  members: Map<string, Member>;
  readOnly: boolean;
  dragDisabled: boolean;
};

function useMoveTask(project: ProjectDetail) {
  const workspace = useWorkspace();
  const update = useUpdateTask(workspace.id);
  return (task: TaskItem, status: Status, position: string) =>
    update.mutate({
      id: task.id,
      input:
        task.statusId === status.id
          ? { position }
          : { statusId: status.id, position },
      optimistic: {
        statusId: status.id,
        position,
        statusCategory: status.category,
        completedAt:
          status.category === "done"
            ? (task.completedAt ?? new Date().toISOString())
            : null,
      },
      fromProjectId: project.id,
    });
}

// ── List ────────────────────────────────────────────────────────────────────

function ListView({
  project,
  groups,
  members,
  readOnly,
  dragDisabled,
}: ViewProps) {
  const t = useTranslations("project");
  const workspace = useWorkspace();
  const { openTask, openTaskId } = useOpenTask();
  const toggle = useToggleComplete(workspace.id);
  const move = useMoveTask(project);
  const dnd = useTaskDnd(groups, move);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      groups
        .filter((g) => g.status.category === "done")
        .map((g) => [g.status.id, true]),
    ),
  );

  const visibleIds = groups
    .filter((g) => !collapsed[g.status.id])
    .flatMap((g) => dnd.tasksIn(g.status.id).map((x) => x.id));
  const byId = new Map(
    groups.flatMap((g) => g.tasks.map((x) => [x.id, x] as const)),
  );
  const selected = useListKeyboard(visibleIds, {
    open: (id) => openTask(id),
    toggle: (id) => {
      const task = byId.get(id);
      if (task && !readOnly) toggle(task);
    },
  });

  return (
    <div className="flex-1 pb-28 md:pb-12">
      <DndContext
        sensors={dnd.sensors}
        collisionDetection={closestCorners}
        {...dnd.handlers}
      >
        {groups.map((g) => {
          const items = dnd.tasksIn(g.status.id);
          const isCollapsed = collapsed[g.status.id] && !dnd.activeTask;
          return (
            <section
              key={g.status.id}
              aria-label={g.status.name}
              className="border-b border-line last:border-b-0"
            >
              <div className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-[1] flex h-10 items-center gap-2 bg-bg/95 px-4 backdrop-blur md:top-0 md:px-8">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({
                      ...c,
                      [g.status.id]: !c[g.status.id],
                    }))
                  }
                  aria-expanded={!isCollapsed}
                  aria-label={
                    isCollapsed
                      ? t("expand", { name: g.status.name })
                      : t("collapse", { name: g.status.name })
                  }
                  className="inline-flex items-center gap-2 rounded-md py-1 pr-2 text-sm font-medium"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 text-faint transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                  <ColorDot color={g.status.color} />
                  {g.status.name}
                  <span className="tabular-nums text-faint">
                    {g.tasks.length}
                  </span>
                </button>
              </div>
              {!isCollapsed ? (
                <DroppableGroup id={g.status.id}>
                  <SortableContext
                    items={items.map((x) => x.id)}
                    strategy={verticalListSortingStrategy}
                    disabled={readOnly || dragDisabled}
                  >
                    <div className="divide-y divide-line/70 md:px-4">
                      {items.map((task) => (
                        <SortableTaskRow
                          key={task.id}
                          dragDisabled={readOnly || dragDisabled}
                          task={task}
                          members={members}
                          selected={
                            selected === task.id || openTaskId === task.id
                          }
                          readOnly={readOnly}
                          onOpen={() => openTask(task.id)}
                          onToggle={() => toggle(task)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  {!readOnly ? (
                    <InlineTaskAdd
                      project={project}
                      status={g.status}
                      lastPosition={items.at(-1)?.position ?? null}
                    />
                  ) : null}
                </DroppableGroup>
              ) : null}
            </section>
          );
        })}
        <DragOverlay>
          {dnd.activeTask ? (
            <div className="rounded-md shadow-pop">
              <TaskRow
                task={dnd.activeTask}
                members={members}
                onOpen={() => {}}
                onToggle={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function DroppableGroup({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${GROUP_PREFIX}${id}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-2 transition-colors",
        isOver && "bg-accent-soft/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Drag wrapper. Its sortable attributes are only applied while dragging is possible:
 * dnd-kit would otherwise mark the row aria-disabled (read as "disabled" by screen
 * readers) and its role="button" would nest a button inside the row's own button.
 */
function useDragProps(id: string, dragDisabled: boolean) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: dragDisabled });
  // The row/card itself is the focus stop; the wrapper only adds the sortable semantics.
  const {
    role: _role,
    "aria-disabled": _disabled,
    tabIndex: _tab,
    ...a11y
  } = attributes;
  const props = dragDisabled ? {} : { ...a11y, ...listeners };
  const style = { transform: CSS.Transform.toString(transform), transition };
  return [setNodeRef, props, style, cn(isDragging && "opacity-30")] as const;
}

function SortableTaskRow({
  dragDisabled,
  ...props
}: Omit<React.ComponentProps<typeof TaskRow>, "style"> & {
  dragDisabled: boolean;
}) {
  const [setNodeRef, dragProps, style, className] = useDragProps(
    props.task.id,
    dragDisabled,
  );
  return (
    <div ref={setNodeRef} {...dragProps} style={style} className={className}>
      <TaskRow {...props} />
    </div>
  );
}

function InlineTaskAdd({
  project,
  status,
  lastPosition,
  compact,
}: {
  project: ProjectDetail;
  status: Status;
  lastPosition: string | null;
  compact?: boolean;
}) {
  const t = useTranslations("project");
  const workspace = useWorkspace();
  const create = useCreateTask();
  const { data: members = [] } = useMembers(workspace.id);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  const submit = () => {
    if (!value.trim()) return;
    const ctx = {
      now: new Date(),
      members: members.map((m) => ({
        id: m.userId,
        name: m.fullName || m.email,
      })),
      // A personal project is private: never parse "Ayşe'ye …" into an assignment there.
      disable: project.isPersonal ? (["assignee"] as const) : ([] as const),
    };
    let parsed = parseQuickAdd(value, { ...ctx, disable: [...ctx.disable] });
    // No preview here to ask "which Ayşe?": keep an ambiguous name in the title instead of dropping it.
    if (parsed.ambiguous.length > 0)
      parsed = parseQuickAdd(value, { ...ctx, disable: ["assignee"] });
    // Only a date was typed ("yarın"): keep the words as the title rather than sending an empty one.
    if (!parsed.title.trim())
      parsed = parseQuickAdd(value, {
        ...ctx,
        disable: ["date", "time", "assignee", "priority", "project"],
      });
    const position = keyBetween(lastPosition, null);
    create.mutate({
      id: newId(),
      workspaceId: workspace.id,
      projectId: project.id,
      statusId: status.id,
      title: parsed.title,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      priority: parsed.priority ?? undefined,
      assigneeIds: parsed.assigneeIds.length ? parsed.assigneeIds : undefined,
      position,
      source: compact ? "board" : "list",
      optimistic: {
        projectId: project.id,
        statusId: status.id,
        statusCategory: status.category,
        position,
      },
    });
    setValue("");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 text-left text-sm text-faint hover:text-fg",
          compact ? "h-9 rounded-md px-2 hover:bg-raised" : "h-10 px-4 md:px-7",
        )}
      >
        <Plus className="size-4" />
        {t("addTask")}
      </button>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compact
          ? "rounded-md border border-accent bg-surface px-2"
          : "px-4 md:px-7",
      )}
    >
      <Plus className="size-4 text-faint" />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => !value && setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        placeholder={t("addTaskPlaceholder")}
        aria-label={t("addTask")}
        className="h-10 flex-1 bg-transparent placeholder:text-faint focus:outline-none"
      />
    </div>
  );
}

// ── Board ───────────────────────────────────────────────────────────────────

function BoardView({
  project,
  groups,
  members,
  readOnly,
  dragDisabled,
}: ViewProps) {
  const workspace = useWorkspace();
  const { openTask } = useOpenTask();
  const toggle = useToggleComplete(workspace.id);
  const move = useMoveTask(project);
  const dnd = useTaskDnd(groups, move);

  return (
    <div className="flex-1 overflow-x-auto pb-24 md:pb-6">
      <DndContext
        sensors={dnd.sensors}
        collisionDetection={closestCorners}
        {...dnd.handlers}
      >
        <div className="flex min-h-full gap-3 px-4 py-4 md:px-8">
          {groups.map((g) => {
            const items = dnd.tasksIn(g.status.id);
            return (
              <section
                key={g.status.id}
                aria-label={g.status.name}
                className="flex w-[17.5rem] shrink-0 flex-col rounded-xl bg-raised/60 p-2"
              >
                <header className="flex h-8 items-center gap-2 px-1.5 text-sm font-medium">
                  <ColorDot color={g.status.color} />
                  {g.status.name}
                  <span className="tabular-nums text-faint">
                    {g.tasks.length}
                  </span>
                </header>
                <DroppableGroup id={g.status.id} className="flex-1 rounded-lg">
                  <SortableContext
                    items={items.map((x) => x.id)}
                    strategy={verticalListSortingStrategy}
                    disabled={readOnly || dragDisabled}
                  >
                    <div className="flex flex-col gap-1.5 py-1">
                      {items.map((task) => (
                        <SortableCard
                          key={task.id}
                          dragDisabled={readOnly || dragDisabled}
                          task={task}
                          members={members}
                          readOnly={readOnly}
                          onOpen={() => openTask(task.id)}
                          onToggle={() => toggle(task)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  {!readOnly ? (
                    <InlineTaskAdd
                      project={project}
                      status={g.status}
                      lastPosition={items.at(-1)?.position ?? null}
                      compact
                    />
                  ) : null}
                </DroppableGroup>
              </section>
            );
          })}
        </div>
        <DragOverlay>
          {dnd.activeTask ? (
            <TaskCard
              task={dnd.activeTask}
              members={members}
              readOnly
              onOpen={() => {}}
              onToggle={() => {}}
              className="rotate-1 shadow-pop"
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

type CardProps = {
  task: TaskItem;
  members: Map<string, Member>;
  readOnly: boolean;
  onOpen: () => void;
  onToggle: () => void;
  className?: string;
};

function TaskCard({
  task,
  members,
  readOnly,
  onOpen,
  onToggle,
  className,
}: CardProps) {
  const t = useTranslations("task");
  const tp = useTranslations("priority");
  const done = Boolean(task.completedAt);
  const people = task.assigneeIds
    .map((id) => members.get(id))
    .filter((m): m is Member => Boolean(m))
    .map((m) => ({
      id: m.userId,
      name: m.fullName || m.email,
      avatarUrl: m.avatarUrl,
    }));
  return (
    <div
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      className={cn(
        "cursor-default rounded-lg border border-line bg-surface p-2.5 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-accent",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <span className="pt-0.5">
          <TaskCheck
            checked={done}
            disabled={readOnly}
            onToggle={onToggle}
            size={16}
            label={done ? t("markIncomplete") : t("markComplete")}
          />
        </span>
        <p
          className={cn(
            "line-clamp-3 flex-1 text-base leading-snug",
            done && "text-faint line-through",
          )}
        >
          {task.title}
        </p>
      </div>
      {task.dueDate ||
      people.length > 0 ||
      task.subtaskCount > 0 ||
      task.checklistCount > 0 ||
      task.priority === "urgent" ||
      task.priority === "high" ? (
        <div className="mt-2 flex items-center gap-2 pl-6 text-sm">
          {task.priority === "urgent" || task.priority === "high" ? (
            <Flag
              aria-label={tp(task.priority)}
              className={cn(
                "size-3.5",
                task.priority === "urgent"
                  ? "fill-danger text-danger"
                  : "text-warn",
              )}
            />
          ) : null}
          <DueChip
            dueDate={task.dueDate}
            dueTime={task.dueTime}
            completed={done}
          />
          {task.subtaskCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-muted tabular-nums"
              title={t("subtaskProgress", {
                done: task.subtaskDoneCount,
                total: task.subtaskCount,
              })}
            >
              <GitBranch className="size-3.5" />
              {task.subtaskDoneCount}/{task.subtaskCount}
            </span>
          ) : null}
          {task.checklistCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-muted tabular-nums"
              title={t("checklistProgress", {
                done: task.checklistDoneCount,
                total: task.checklistCount,
              })}
            >
              <CheckSquare className="size-3.5" />
              {task.checklistDoneCount}/{task.checklistCount}
            </span>
          ) : null}
          <span className="ml-auto">
            {people.length > 0 ? (
              <AvatarStack people={people} size={20} />
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SortableCard({
  dragDisabled,
  ...props
}: CardProps & { dragDisabled: boolean }) {
  const [setNodeRef, dragProps, style, className] = useDragProps(
    props.task.id,
    dragDisabled,
  );
  return (
    <div ref={setNodeRef} {...dragProps} style={style} className={className}>
      <TaskCard {...props} />
    </div>
  );
}
