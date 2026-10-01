"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { clearUndo, registerUndo } from "@/lib/client/undo";
import { useUpdateTask } from "./hooks";
import type { TaskItem } from "./types";

/** Complete / reopen from anywhere, optimistic, with an undo toast. */
export function useToggleComplete(workspaceId: string) {
  const update = useUpdateTask(workspaceId);
  const t = useTranslations("task");
  const tc = useTranslations("common");
  return useCallback(
    (task: Pick<TaskItem, "id" | "completedAt">) => {
      const completing = !task.completedAt;
      const apply = (done: boolean) =>
        update.mutate({
          id: task.id,
          input: { completed: done },
          optimistic: {
            completedAt: done ? new Date().toISOString() : null,
            statusCategory: done ? "done" : "todo",
          },
        });
      apply(completing);
      if (completing) {
        const undo = () => apply(false);
        registerUndo(undo);
        toast(t("completed"), {
          action: {
            label: tc("undo"),
            onClick: () => {
              clearUndo(undo);
              undo();
            },
          },
        });
      }
    },
    [update, t, tc],
  );
}
