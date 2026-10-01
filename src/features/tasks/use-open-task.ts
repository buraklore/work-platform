"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { setUrl } from "@/lib/client/url";

export const TASK_PARAM = "gorev";

/**
 * The URL the panel was opened from, when opening it pushed a history entry.
 * Closing then goes BACK to it, so the browser / Android back button and the close
 * button agree: back closes the panel, and a closed panel never comes back on "back".
 */
let openedFrom: string | null = null;

/** The task panel is URL state (?gorev=<id>) so it survives refresh and can be shared. */
export function useOpenTask() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = useCallback(
    (taskId: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (taskId) next.set(TASK_PARAM, taskId);
      else next.delete(TASK_PARAM);
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      const current = params.toString() ? `${pathname}?${params}` : pathname;

      if (!taskId) {
        if (openedFrom === url) {
          openedFrom = null;
          router.back();
        } else {
          openedFrom = null;
          setUrl(url, "replace");
        }
        return;
      }
      if (params.get(TASK_PARAM)) {
        // Switching tasks inside the panel (subtask, parent): one history entry for the panel.
        setUrl(url, "replace");
      } else {
        openedFrom = current;
        setUrl(url, "push");
      }
    },
    [router, pathname, params],
  );
  return { openTask: open, openTaskId: params.get(TASK_PARAM) };
}
