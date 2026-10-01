"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import { emit, inlineQuickAdd, on } from "@/lib/client/bus";
import { runLastUndo } from "@/lib/client/undo";
import { cn, isEditableTarget } from "@/lib/utils";
import { useModKey } from "@/lib/client/use-mod-key";

/** Global keyboard layer. Single keys never fire while typing in a field. */
export function useGlobalShortcuts(slug: string, openQuickAddDialog: () => void) {
  const router = useRouter();
  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLocaleLowerCase("en-US") === "k") {
        e.preventDefault();
        emit("command-menu");
        return;
      }
      if (mod && !e.shiftKey && e.key.toLocaleLowerCase("en-US") === "z" && !isEditableTarget(e.target)) {
        if (runLastUndo()) e.preventDefault();
        return;
      }
      if (mod || e.altKey || isEditableTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      // Open menus / pickers use letters for type-ahead.
      if (e.target instanceof Element && e.target.closest('[role="menu"],[role="listbox"],[cmdk-root]')) return;

      if (pendingG && Date.now() - pendingG < 900) {
        pendingG = 0;
        const target = { h: "", m: "/gorevlerim", p: "/projeler" }[e.key];
        if (target !== undefined) {
          e.preventDefault();
          router.push(`/w/${slug}${target}`);
        }
        return;
      }
      switch (e.key) {
        case "g":
          pendingG = Date.now();
          break;
        case "/":
          e.preventDefault();
          emit("command-menu");
          break;
        case "?":
          e.preventDefault();
          emit("shortcuts-help");
          break;
        case "q":
        case "n":
          e.preventDefault();
          if (inlineQuickAdd.count > 0) emit("quick-add");
          else openQuickAddDialog();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, slug, openQuickAddDialog]);
}

export function ShortcutsDialog() {
  const t = useTranslations("shortcuts");
  const [open, setOpen] = useState(false);
  useEffect(() => on("shortcuts-help", () => setOpen(true)), []);
  const mod = useModKey();
  const groups: Array<[string, Array<[React.ReactNode, string]>]> = [
    [
      t("general"),
      [
        [<><Kbd>{mod}</Kbd><Kbd>K</Kbd></>, t("commandMenu")],
        [<Kbd key="s">/</Kbd>, t("search")],
        [<><Kbd>Q</Kbd> / <Kbd>N</Kbd></>, t("quickAdd")],
        [<><Kbd>{mod}</Kbd><Kbd>Z</Kbd></>, t("undo")],
        [<Kbd key="q">?</Kbd>, t("help")],
      ],
    ],
    [
      t("navigation"),
      [
        [<><Kbd>G</Kbd> <span className="text-faint">{t("then")}</span> <Kbd>H</Kbd></>, t("goHome")],
        [<><Kbd>G</Kbd> <span className="text-faint">{t("then")}</span> <Kbd>M</Kbd></>, t("goMyTasks")],
        [<><Kbd>G</Kbd> <span className="text-faint">{t("then")}</span> <Kbd>P</Kbd></>, t("goProjects")],
      ],
    ],
    [
      t("tasks"),
      [
        [<><Kbd>J</Kbd> / <Kbd>K</Kbd></>, `${t("nextTask")} / ${t("prevTask")}`],
        [<Kbd key="e">Enter</Kbd>, t("openTask")],
        [<Kbd key="x">X</Kbd>, t("completeTask")],
        [<Kbd key="esc">Esc</Kbd>, t("closePanel")],
      ],
    ],
  ];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title={t("title")} className="max-w-lg">
        <div className="grid gap-5 sm:grid-cols-2">
          {groups.map(([title, rows]) => (
            <section key={title} className={cn(title === t("tasks") && "sm:col-span-2")}>
              <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
              <dl className="space-y-1.5">
                {rows.map(([keys, label]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-base">{label}</dt>
                    <dd className="flex shrink-0 items-center gap-1 text-sm">{keys}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
