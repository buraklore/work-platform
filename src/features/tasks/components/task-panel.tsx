"use client";

import {
  ArrowLeft,
  CheckSquare,
  ChevronRight,
  Ellipsis,
  FolderInput,
  Link2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { ColorDot, Skeleton } from "@/components/ui/misc";
import { eligibleAssignees } from "@/features/projects/access";
import { useProject, useProjects } from "@/features/projects/hooks";
import { useMe, useMembers, useWorkspace } from "@/features/workspaces/context";
import { ApiError } from "@/lib/api/client";
import { formatLongDate } from "@/lib/dates/format";
import { useErrorToast } from "@/lib/client/errors";
import { cn } from "@/lib/utils";
import {
  newId,
  useChecklist,
  useCreateLabel,
  useCreateTask,
  useDeleteTask,
  useLabels,
  useTask,
  useUpdateTask,
} from "../hooks";
import type { TaskDetail, TaskItem } from "../types";
import { useOpenTask } from "../use-open-task";
import { useToggleComplete } from "../use-toggle-complete";
import { DatePicker } from "./date-picker";
import { DueChip } from "./due-chip";
import {
  AssigneePicker,
  LabelPicker,
  PriorityPicker,
  StatusPicker,
} from "./pickers";
import { TaskCheck } from "./task-check";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";

const DescriptionEditor = dynamic(() => import("./description-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-24 w-full" />,
});

export function TaskPanelHost() {
  const { openTaskId, openTask } = useOpenTask();
  const t = useTranslations("task");
  return (
    <Dialog
      open={Boolean(openTaskId)}
      onOpenChange={(o) => !o && openTask(null)}
      modal={false}
    >
      {openTaskId ? (
        <SheetContent title={t("titleLabel")}>
          <TaskPanel
            key={openTaskId}
            taskId={openTaskId}
            onClose={() => openTask(null)}
          />
        </SheetContent>
      ) : null}
    </Dialog>
  );
}

function TaskPanel({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const t = useTranslations("task");
  const tErr = useTranslations("errors");
  const { data: task, isLoading, error } = useTask(taskId);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <PanelBar onClose={onClose} />
        <div className="space-y-4 p-5" aria-busy="true">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }
  if (error || !task) {
    return (
      <div className="flex h-full flex-col">
        <PanelBar onClose={onClose} />
        <p className="p-6 text-muted">
          {error instanceof ApiError && error.status !== 404
            ? tErr("generic")
            : t("notFound")}
        </p>
      </div>
    );
  }
  return <TaskPanelBody task={task} onClose={onClose} />;
}

function PanelBar({
  onClose,
  children,
}: {
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("task");
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-3 pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        onClick={onClose}
        aria-label={t("closePanel")}
        className="rounded-md p-1.5 text-muted hover:bg-raised md:hidden"
      >
        <ArrowLeft className="size-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("closePanel")}
        className="hidden rounded-md p-1.5 text-muted hover:bg-raised md:inline-flex"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function TaskPanelBody({
  task,
  onClose,
}: {
  task: TaskDetail;
  onClose: () => void;
}) {
  const t = useTranslations("task");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const workspace = useWorkspace();
  const { openTask } = useOpenTask();
  const { data: members = [] } = useMembers(workspace.id);
  const { data: labels = [] } = useLabels(workspace.id);
  const { data: projects = [] } = useProjects(workspace.id);
  const { data: me } = useMe();
  const update = useUpdateTask(workspace.id);
  const del = useDeleteTask(workspace.id);
  const toggle = useToggleComplete(workspace.id);
  const onError = useErrorToast();
  const createLabel = useCreateLabel(workspace.id);
  const { data: projectDetail } = useProject(task.projectId);
  const archived = task.project.archived;
  const readOnly = task.access === "viewer" || archived;
  const assignable = eligibleAssignees(projectDetail, members, me?.id);
  const done = Boolean(task.completedAt);

  const save = (
    input: Parameters<typeof update.mutate>[0]["input"],
    optimistic?: Partial<TaskItem>,
  ) =>
    update.mutate({
      id: task.id,
      input,
      optimistic,
      fromProjectId: task.projectId,
    });

  const delegated = task.assigneeIds.some((id) => id !== me?.id);
  // A delegated task cannot go to the private personal project (the server refuses it too);
  // moves into other private projects are checked by the server with a clear message.
  const moveTargets = projects.filter(
    (p) =>
      p.id !== task.project.id &&
      !p.archivedAt &&
      p.access !== "viewer" &&
      !(delegated && p.isPersonal),
  );

  return (
    <div className="flex h-full flex-col">
      <PanelBar onClose={onClose}>
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate px-1 text-sm text-muted">
          <ColorDot color={task.project.color} />
          <span className="truncate">
            {task.project.isPersonal ? tn("personal") : task.project.name}
          </span>
          {task.parentTaskId ? (
            <>
              <ChevronRight className="size-3.5 shrink-0" />
              <button
                type="button"
                onClick={() => openTask(task.parentTaskId)}
                className="truncate hover:text-fg hover:underline"
              >
                {t("parent")}
              </button>
            </>
          ) : null}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={done ? "secondary" : "ghost"}
            size="sm"
            disabled={readOnly}
            onClick={() => toggle(task)}
            className={cn(done && "text-done")}
          >
            <CheckSquare />
            <span className="hidden sm:inline">
              {done ? t("done") : t("markComplete")}
            </span>
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("actions")}>
                <Ellipsis />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem
                onSelect={() => {
                  navigator.clipboard.writeText(window.location.href).then(
                    () => toast(t("linkCopied")),
                    () => toast.error(t("linkCopyFailed")),
                  );
                }}
              >
                <Link2 />
                {t("copyLink")}
              </MenuItem>
              {!readOnly && !task.parentTaskId && moveTargets.length > 0 ? (
                <>
                  <MenuSeparator />
                  <MenuLabel>{t("moveToProject")}</MenuLabel>
                  {moveTargets.map((p) => (
                    <MenuItem
                      key={p.id}
                      onSelect={() => {
                        update.mutate(
                          {
                            id: task.id,
                            input: { projectId: p.id },
                            fromProjectId: task.projectId,
                          },
                          {
                            onSuccess: () => {
                              const back = () =>
                                update.mutate({
                                  id: task.id,
                                  input: { projectId: task.projectId },
                                  fromProjectId: p.id,
                                });
                              toast(
                                t("moved", {
                                  project: p.isPersonal
                                    ? tn("personal")
                                    : p.name,
                                }),
                                {
                                  action: { label: tc("undo"), onClick: back },
                                },
                              );
                            },
                          },
                        );
                      }}
                    >
                      <FolderInput />
                      <ColorDot color={p.color} />
                      <span className="truncate">
                        {p.isPersonal ? tn("personal") : p.name}
                      </span>
                    </MenuItem>
                  ))}
                </>
              ) : null}
              {!readOnly ? (
                <>
                  <MenuSeparator />
                  <MenuItem
                    danger
                    onSelect={() => {
                      del.mutate({
                        id: task.id,
                        projectId: task.projectId,
                        parentTaskId: task.parentTaskId,
                      });
                      if (task.parentTaskId) openTask(task.parentTaskId);
                      else onClose();
                    }}
                  >
                    <Trash2 />
                    {t("delete")}
                  </MenuItem>
                </>
              ) : null}
            </MenuContent>
          </Menu>
        </div>
      </PanelBar>

      <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="space-y-6 px-5 py-5">
          {readOnly ? (
            <p className="rounded-md bg-raised px-3 py-2 text-sm text-muted">
              {archived ? t("archivedNotice") : t("viewerNotice")}
            </p>
          ) : null}

          <div className="flex items-start gap-3">
            <div className="pt-[0.45rem]">
              <TaskCheck
                checked={done}
                onToggle={() => toggle(task)}
                disabled={readOnly}
                size={22}
                label={done ? t("markIncomplete") : t("markComplete")}
              />
            </div>
            <TitleField
              value={task.title}
              readOnly={readOnly}
              onSave={(title) => save({ title }, { title })}
              done={done}
            />
          </div>

          <dl className="grid grid-cols-[6.5rem_1fr] items-center gap-x-2 gap-y-1 text-base">
            <dt className="text-muted">{t("status")}</dt>
            <dd>
              <StatusPicker
                statuses={task.statuses}
                value={task.statusId}
                disabled={readOnly}
                onChange={(s) =>
                  save(
                    { statusId: s.id },
                    {
                      statusId: s.id,
                      statusCategory: s.category,
                      completedAt:
                        s.category === "done"
                          ? (task.completedAt ?? new Date().toISOString())
                          : null,
                    },
                  )
                }
              />
            </dd>
            <dt className="text-muted">{t("assignees")}</dt>
            <dd>
              <AssigneePicker
                members={[
                  ...assignable,
                  ...members.filter(
                    (m) =>
                      task.assigneeIds.includes(m.userId) &&
                      !assignable.includes(m),
                  ),
                ]}
                value={task.assigneeIds}
                disabled={readOnly}
                hint={
                  task.project.isPersonal
                    ? t("personalOnlyYou")
                    : assignable.length < members.length
                      ? t("onlyWithAccess")
                      : undefined
                }
                onChange={(ids) =>
                  save({ assigneeIds: ids }, { assigneeIds: ids })
                }
              />
            </dd>
            <dt className="text-muted">{t("dueDate")}</dt>
            <dd>
              <Popover>
                <PopoverTrigger
                  disabled={readOnly}
                  className="inline-flex min-h-8 items-center rounded-md px-2 hover:bg-raised disabled:hover:bg-transparent"
                >
                  {task.dueDate ? (
                    <DueChip
                      dueDate={task.dueDate}
                      dueTime={task.dueTime}
                      completed={done}
                      className="text-base"
                    />
                  ) : (
                    <span className="text-faint">{t("noDueDate")}</span>
                  )}
                </PopoverTrigger>
                <PopoverContent>
                  <DatePicker
                    date={task.dueDate}
                    time={task.dueTime}
                    onChange={(v) => save(v, v)}
                  />
                </PopoverContent>
              </Popover>
            </dd>
            <dt className="text-muted">{t("priority")}</dt>
            <dd>
              <PriorityPicker
                value={task.priority}
                disabled={readOnly}
                onChange={(priority) => save({ priority }, { priority })}
              />
            </dd>
            <dt className="text-muted">{t("labels")}</dt>
            <dd>
              <LabelPicker
                labels={labels}
                value={task.labelIds}
                disabled={readOnly}
                onChange={(labelIds) => save({ labelIds }, { labelIds })}
                onCreate={(name, color) =>
                  createLabel.mutateAsync({ name, color })
                }
                onError={onError}
              />
            </dd>
          </dl>

          {readOnly && !task.description ? null : (
            <section aria-label={t("description")}>
              <h3 className="mb-1.5 text-sm font-medium text-muted">
                {t("description")}
              </h3>
              <div className="rounded-lg border border-transparent px-0.5 focus-within:border-line">
                <DescriptionEditor
                  value={task.description}
                  editable={!readOnly}
                  placeholder={t("descriptionPlaceholder")}
                  onChange={(doc) =>
                    update.mutate({ id: task.id, input: { description: doc } })
                  }
                />
              </div>
            </section>
          )}

          {!task.parentTaskId ? (
            <Subtasks task={task} readOnly={readOnly} />
          ) : null}
          <Checklist task={task} readOnly={readOnly} />

          <p className="border-t border-line pt-4 text-sm text-faint">
            {t("createdBy", {
              name: task.createdByName || "—",
              date: formatLongDate(task.createdAt),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

function TitleField({
  value,
  readOnly,
  onSave,
  done,
}: {
  value: string;
  readOnly: boolean;
  onSave: (v: string) => void;
  done: boolean;
}) {
  const t = useTranslations("task");
  // null = not editing: show the server value (which may change under us).
  const [editing, setDraft] = useState<string | null>(null);
  const draft = editing ?? value;
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancelled = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);
  const commit = () => {
    const next = draft.replace(/\s+/g, " ").trim();
    if (!cancelled.current && next && next !== value) onSave(next);
    cancelled.current = false;
    setDraft(null);
  };
  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      readOnly={readOnly}
      aria-label={t("titleLabel")}
      maxLength={500}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
          e.stopPropagation();
        }
      }}
      className={cn(
        "w-full resize-none bg-transparent font-display text-xl font-semibold leading-snug tracking-tight focus:outline-none",
        done && "text-muted",
      )}
    />
  );
}

function InlineAdd({
  placeholder,
  onAdd,
  disabled,
}: {
  placeholder: string;
  onAdd: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  if (disabled) return null;
  return (
    <div className="flex items-center gap-2 px-1">
      <Plus className="size-4 text-faint" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim() && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onAdd(value.trim());
            setValue("");
          }
        }}
        placeholder={placeholder}
        className="h-9 flex-1 bg-transparent text-base placeholder:text-faint focus:outline-none"
      />
    </div>
  );
}

function Subtasks({ task, readOnly }: { task: TaskDetail; readOnly: boolean }) {
  const t = useTranslations("task");
  const workspace = useWorkspace();
  const create = useCreateTask();
  const toggle = useToggleComplete(workspace.id);
  const { openTask } = useOpenTask();
  const todo = task.statuses.find((s) => s.category === "todo");
  if (readOnly && task.subtasks.length === 0) return null;
  return (
    <section aria-label={t("subtasks")}>
      <h3 className="mb-1.5 text-sm font-medium text-muted">
        {t("subtasks")}
        {task.subtasks.length > 0 ? (
          <span className="ml-1.5 tabular-nums text-faint">
            {task.subtasks.filter((s) => s.completedAt).length}/
            {task.subtasks.length}
          </span>
        ) : null}
      </h3>
      <ul className="divide-y divide-line rounded-lg border border-line empty:hidden">
        {task.subtasks.map((s) => (
          <li key={s.id} className="flex min-h-10 items-center gap-2.5 px-3">
            <TaskCheck
              checked={Boolean(s.completedAt)}
              disabled={readOnly}
              onToggle={() => toggle(s)}
              label={s.completedAt ? t("markIncomplete") : t("markComplete")}
            />
            <button
              type="button"
              onClick={() => openTask(s.id)}
              className={cn(
                "flex-1 truncate py-2 text-left",
                s.completedAt && "text-faint line-through",
              )}
            >
              {s.title}
            </button>
            <DueChip
              dueDate={s.dueDate}
              dueTime={s.dueTime}
              completed={Boolean(s.completedAt)}
            />
          </li>
        ))}
      </ul>
      <div className="mt-1">
        <InlineAdd
          disabled={readOnly}
          placeholder={t("addSubtask")}
          onAdd={(title) =>
            create.mutate({
              id: newId(),
              workspaceId: workspace.id,
              parentTaskId: task.id,
              title,
              source: "subtask",
              optimistic: todo
                ? {
                    projectId: task.projectId,
                    statusId: todo.id,
                    statusCategory: "todo",
                    position: "",
                  }
                : undefined,
            })
          }
        />
      </div>
    </section>
  );
}

function Checklist({
  task,
  readOnly,
}: {
  task: TaskDetail;
  readOnly: boolean;
}) {
  const t = useTranslations("task");
  const tc = useTranslations("common");
  const { add, update, remove } = useChecklist(task.id);
  if (readOnly && task.checklist.length === 0) return null;
  return (
    <section aria-label={t("checklist")}>
      <h3 className="mb-1.5 text-sm font-medium text-muted">
        {t("checklist")}
        {task.checklist.length > 0 ? (
          <span className="ml-1.5 tabular-nums text-faint">
            {task.checklist.filter((c) => c.isDone).length}/
            {task.checklist.length}
          </span>
        ) : null}
      </h3>
      <ul className="space-y-0.5">
        {task.checklist.map((item) => (
          <li
            key={item.id}
            className="group flex min-h-9 items-center gap-2.5 rounded-md px-1 hover:bg-raised/60"
          >
            <input
              type="checkbox"
              checked={item.isDone}
              disabled={readOnly}
              onChange={(e) =>
                update.mutate({ id: item.id, isDone: e.target.checked })
              }
              className="size-4 rounded accent-[var(--done)]"
              aria-label={item.text}
            />
            <ChecklistText
              text={item.text}
              done={item.isDone}
              readOnly={readOnly}
              onSave={(text) => update.mutate({ id: item.id, text })}
            />
            {!readOnly ? (
              <button
                type="button"
                onClick={() => remove.mutate(item.id)}
                aria-label={tc("remove")}
                className="rounded p-1 text-faint hover:text-danger focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <InlineAdd
        disabled={readOnly}
        placeholder={t("addChecklistItem")}
        onAdd={(text) => add.mutate(text)}
      />
    </section>
  );
}

/** Checklist item text: click to fix a typo, Enter / leaving the field saves, Esc cancels. */
function ChecklistText({
  text,
  done,
  readOnly,
  onSave,
}: {
  text: string;
  done: boolean;
  readOnly: boolean;
  onSave: (text: string) => void;
}) {
  const t = useTranslations("task");
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  if (readOnly || draft === null) {
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => setDraft(text)}
        aria-label={t("editItem", { text })}
        className={cn(
          "min-h-8 flex-1 rounded px-1 text-left disabled:cursor-default",
          !readOnly && "hover:bg-raised",
          done && "text-faint line-through",
        )}
      >
        {text}
      </button>
    );
  }
  const commit = () => {
    const next = draft.replace(/\s+/g, " ").trim();
    if (!cancelled.current && next && next !== text) onSave(next);
    cancelled.current = false;
    setDraft(null);
  };
  return (
    <input
      autoFocus
      value={draft}
      maxLength={500}
      aria-label={t("editItem", { text })}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.stopPropagation();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      className="h-8 flex-1 rounded border border-line bg-surface px-1 focus:border-accent focus:outline-none"
    />
  );
}
