"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useWorkspace } from "@/features/workspaces/context";
import { on } from "@/lib/client/bus";
import { useErrorText } from "@/lib/client/errors";
import { useCreateProject } from "../hooks";
import { PROJECT_COLORS } from "../types";
import { ColorPicker, VisibilityPicker } from "./project-form-fields";

/** Mounted once in the app shell; opened from anywhere via the "new-project" bus event. */
export function CreateProjectDialog() {
  const t = useTranslations("projects");
  const workspace = useWorkspace();
  const router = useRouter();
  const errorText = useErrorText();
  const create = useCreateProject(workspace.id);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PROJECT_COLORS[0]);
  const [visibility, setVisibility] = useState<"team" | "private">("team");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => on("new-project", () => setOpen(true)), []);

  const reset = () => {
    setName("");
    setColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]!);
    setVisibility("team");
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogContent title={t("new")}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate(
              { name: name.trim(), color, visibility },
              {
                onSuccess: (project) => {
                  setOpen(false);
                  reset();
                  toast(t("created"));
                  router.push(`/w/${workspace.slug}/projeler/${project.id}`);
                },
                onError: (err) => setError(errorText(err)),
              },
            );
          }}
        >
          <Field label={t("name")} htmlFor="project-name" error={error}>
            <Input id="project-name" autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
          </Field>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("color")}</span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("visibility")}</span>
            <VisibilityPicker value={visibility} onChange={setVisibility} />
          </div>
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {t("createCta")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
