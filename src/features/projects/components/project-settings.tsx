"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Avatar, ColorDot } from "@/components/ui/misc";
import { useMembers, useWorkspace } from "@/features/workspaces/context";
import { api } from "@/lib/api/client";
import { useErrorToast } from "@/lib/client/errors";
import { qk } from "@/lib/client/keys";
import { cn } from "@/lib/utils";
import { keyBetween } from "@/lib/positions";
import { sortStatuses, useStatusMutations, useUpdateProject } from "../hooks";
import { PROJECT_COLORS, type ProjectDetail, type Status } from "../types";
import { ColorPicker, VisibilityPicker } from "./project-form-fields";

type Tab = "general" | "statuses" | "members";

export function ProjectSettings({ project, open, onOpenChange }: { project: ProjectDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("project");
  const [tab, setTab] = useState<Tab>("general");
  const tabs: Array<[Tab, string]> = [
    ["general", t("general")],
    ["statuses", t("statuses")],
    ...(project.isPersonal ? [] : ([["members", t("members")]] as Array<[Tab, string]>)),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("settings")} className="max-w-lg">
        <div role="tablist" className="mb-4 flex gap-1 border-b border-line">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn("-mb-px border-b-2 px-2.5 pb-2 text-sm", tab === id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {tab === "general" ? <GeneralTab project={project} onClose={() => onOpenChange(false)} /> : null}
          {tab === "statuses" ? <StatusesTab project={project} /> : null}
          {tab === "members" ? <MembersTab project={project} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeneralTab({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const t = useTranslations("project");
  const tp = useTranslations("projects");
  const tc = useTranslations("common");
  const workspace = useWorkspace();
  const router = useRouter();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const update = useUpdateProject(project.id, workspace.id);
  const [name, setName] = useState(project.name);
  const [confirming, setConfirming] = useState(false);
  const [confirmPrivate, setConfirmPrivate] = useState(false);
  const { data: wsMembers = [] } = useMembers(workspace.id);
  // Plain members who are not on the project lose access when it becomes private.
  const losing = wsMembers.filter((m) => m.role === "member" && !project.members.some((pm) => pm.userId === m.userId));

  const restore = useMutation({
    mutationFn: () => api(`/projects/${project.id}/restore`, { method: "POST" }),
    onSuccess: () => {
      toast(t("restored"));
      void qc.invalidateQueries({ queryKey: qk.projects(workspace.id) });
      router.push(`/w/${workspace.slug}/projeler/${project.id}`);
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => api(`/projects/${project.id}`, { method: "DELETE" }),
    onSuccess: () => {
      onClose();
      void qc.invalidateQueries({ queryKey: qk.projects(workspace.id) });
      void qc.invalidateQueries({ queryKey: qk.myTasks(workspace.id) });
      router.push(`/w/${workspace.slug}/projeler`);
      toast(t("deleted"), { action: { label: tc("undo"), onClick: () => restore.mutate() }, duration: 10_000 });
    },
    onError,
  });

  return (
    <div className="space-y-5">
      {!project.isPersonal ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name.trim() !== project.name) update.mutate({ name: name.trim() }, { onError, onSuccess: () => toast(tc("saved")) });
          }}
        >
          <div className="flex-1">
            <Field label={tp("name")} htmlFor="ps-name">
              <Input id="ps-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === project.name}>
            {tc("save")}
          </Button>
        </form>
      ) : null}
      <div className="space-y-1.5">
        <span className="text-sm font-medium">{tp("color")}</span>
        <ColorPicker value={PROJECT_COLORS.includes(project.color as (typeof PROJECT_COLORS)[number]) ? project.color : ""} onChange={(color) => update.mutate({ color }, { onError })} />
      </div>
      {!project.isPersonal ? (
        <>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{tp("visibility")}</span>
            <VisibilityPicker
              value={project.visibility}
              onChange={(visibility) => {
                if (visibility === "private" && project.visibility === "team") setConfirmPrivate(true);
                else update.mutate({ visibility }, { onError });
              }}
            />
            {confirmPrivate ? (
              <div className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm">
                <p className="text-fg">{t("makePrivateConfirm", { count: losing.length })}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      update.mutate({ visibility: "private" }, { onError });
                      setConfirmPrivate(false);
                    }}
                  >
                    {t("makePrivate")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmPrivate(false)}>
                    {tc("cancel")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              onClick={() =>
                update.mutate(
                  { archived: !project.archivedAt },
                  { onError, onSuccess: () => toast(project.archivedAt ? tc("saved") : t("archivedToast")) },
                )
              }
            >
              {project.archivedAt ? <ArchiveRestore /> : <Archive />}
              {project.archivedAt ? t("unarchive") : t("archive")}
            </Button>
            {confirming ? (
              <div className="w-full rounded-lg border border-danger/40 bg-danger-soft p-3">
                <p className="font-medium text-danger">{t("deleteConfirmTitle")}</p>
                <p className="mt-1 text-sm text-fg">{t("deleteConfirmBody", { name: project.name })}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="danger" size="sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
                    {t("delete")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    {tc("cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => setConfirming(true)}>
                <Trash2 />
                {t("delete")}
              </Button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

const STATUS_COLORS = ["#8A8FA3", "#3B4FE4", "#C98A0B", "#8B5CF6", "#DB2777", "#0EA5E9", "#12998F", "#E0513F"];

function StatusesTab({ project }: { project: ProjectDetail }) {
  const t = useTranslations("project");
  const tc = useTranslations("common");
  const tcat = useTranslations("statusCategory");
  const onError = useErrorToast();
  const { create, update, remove } = useStatusMutations(project.id);
  const statuses = sortStatuses(project.statuses);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<Status | null>(null);

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {statuses.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <Menu>
              <MenuTrigger className="rounded p-1.5 hover:bg-raised" aria-label={s.name}>
                <ColorDot color={s.color} className="size-3" />
              </MenuTrigger>
              <MenuContent className="grid min-w-0 grid-cols-4 gap-1 p-2">
                {STATUS_COLORS.map((c) => (
                  <MenuItem key={c} className="h-7 w-7 justify-center p-0" onSelect={() => update.mutate({ id: s.id, color: c }, { onError })}>
                    <ColorDot color={c} className="size-4" />
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <StatusNameInput key={`${s.id}:${s.name}`} name={s.name} onSave={(name, revert) => update.mutate({ id: s.id, name }, { onError: (err) => (onError(err), revert()) })} />
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={t("moveStatusUp", { name: s.name })}
                disabled={i === 0}
                onClick={() => update.mutate({ id: s.id, position: keyBetween(statuses[i - 2]?.position ?? null, statuses[i - 1]!.position) }, { onError })}
                className="rounded px-1 text-faint hover:text-fg disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={t("moveStatusDown", { name: s.name })}
                disabled={i === statuses.length - 1}
                onClick={() => update.mutate({ id: s.id, position: keyBetween(statuses[i + 1]!.position, statuses[i + 2]?.position ?? null) }, { onError })}
                className="rounded px-1 text-faint hover:text-fg disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>
            <Menu>
              <MenuTrigger className="h-8 w-32 rounded-md border border-line px-2 text-left text-sm text-muted hover:bg-raised">{tcat(s.category)}</MenuTrigger>
              <MenuContent>
                {(["todo", "in_progress", "done"] as const).map((c) => (
                  <MenuItem key={c} onSelect={() => update.mutate({ id: s.id, category: c }, { onError })}>
                    {tcat(c)}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <button type="button" aria-label={t("deleteStatus")} onClick={() => setDeleting(s)} className="rounded p-1.5 text-faint hover:bg-raised hover:text-danger">
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {deleting ? (
        <div className="rounded-lg border border-line bg-raised/60 p-3 text-sm">
          <p>{t("deleteStatusMoveTo")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {statuses
              .filter((s) => s.id !== deleting.id)
              .map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    remove.mutate({ id: deleting.id, moveTo: s.id }, { onError });
                    setDeleting(null);
                  }}
                >
                  <ColorDot color={s.color} />
                  {s.name}
                </Button>
              ))}
            <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          create.mutate({ name: newName.trim(), category: "in_progress", color: STATUS_COLORS[statuses.length % STATUS_COLORS.length]! }, { onError });
          setNewName("");
        }}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("statusName")} maxLength={40} className="h-8" />
        <Button type="submit" size="sm" variant="secondary" disabled={!newName.trim()}>
          <Plus />
          {t("addStatus")}
        </Button>
      </form>
    </div>
  );
}

function MembersTab({ project }: { project: ProjectDetail }) {
  const t = useTranslations("project");
  const tc = useTranslations("common");
  const workspace = useWorkspace();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const { data: wsMembers = [] } = useMembers(workspace.id);
  const settle = () => void qc.invalidateQueries({ queryKey: qk.project(project.id) });
  const upsert = useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "member" | "viewer" }) =>
      api(`/projects/${project.id}/members`, { method: "POST", body: input }),
    onError,
    onSettled: settle,
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api(`/projects/${project.id}/members/${userId}`, { method: "DELETE" }),
    onError,
    onSettled: settle,
  });
  const roleLabel = { admin: t("roleAdmin"), member: t("roleMember"), viewer: t("roleViewer") } as const;
  const candidates = wsMembers.filter((m) => !project.members.some((pm) => pm.userId === m.userId));
  const wsRole = new Map(wsMembers.map((m) => [m.userId, m.role]));
  const [removing, setRemoving] = useState<ProjectDetail["members"][number] | null>(null);

  return (
    <div className="space-y-3">
      {project.visibility === "team" ? <p className="text-sm text-muted">{t("implicitAccess")}</p> : null}
      <ul className="divide-y divide-line">
        {project.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2.5 py-2">
            <Avatar id={m.userId} name={m.fullName || m.email} src={m.avatarUrl} size={26} />
            <div className="min-w-0 flex-1">
              <p className="truncate">{m.fullName || m.email}</p>
              <p className="truncate text-sm text-muted">{m.email}</p>
            </div>
            <Menu>
              <MenuTrigger className="h-8 rounded-md border border-line px-2 text-sm hover:bg-raised">{roleLabel[m.role]}</MenuTrigger>
              <MenuContent align="end">
                {(wsRole.get(m.userId) === "guest" ? (["member", "viewer"] as const) : (["admin", "member", "viewer"] as const)).map((r) => (
                  <MenuItem key={r} onSelect={() => upsert.mutate({ userId: m.userId, role: r })}>
                    {roleLabel[r]}
                  </MenuItem>
                ))}
                <MenuItem danger onSelect={() => setRemoving(m)}>
                  {tc("remove")}
                </MenuItem>
              </MenuContent>
            </Menu>
          </li>
        ))}
      </ul>
      {removing ? (
        <div className="rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm">
          <p className="text-fg">{t("removeMemberConfirm", { name: removing.fullName || removing.email })}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                removeMember.mutate(removing.userId);
                setRemoving(null);
              }}
            >
              {tc("remove")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      {candidates.length > 0 ? (
        <Menu>
          <MenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <Plus />
              {t("addMember")}
            </Button>
          </MenuTrigger>
          <MenuContent className="max-h-72 overflow-y-auto">
            {candidates.map((m) => (
              <MenuItem key={m.userId} onSelect={() => upsert.mutate({ userId: m.userId, role: m.role === "guest" ? "viewer" : "member" })}>
                <Avatar id={m.userId} name={m.fullName || m.email} size={20} />
                <span className="truncate">{m.fullName || m.email}</span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ) : null}
    </div>
  );
}

/** Status name: Enter or leaving the field saves; a refused rename snaps back. */
function StatusNameInput({ name, onSave }: { name: string; onSave: (name: string, revert: () => void) => void }) {
  const t = useTranslations("project");
  const [value, setValue] = useState(name);
  return (
    <Input
      value={value}
      maxLength={40}
      aria-label={t("statusName")}
      className="h-8 flex-1"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const v = value.trim();
        if (v && v !== name) onSave(v, () => setValue(name));
        else setValue(name);
      }}
    />
  );
}
