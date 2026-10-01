"use client";

import { useCallback, useSyncExternalStore } from "react";

type View = "list" | "board";
const key = (projectId: string) => `gorunum:${projectId}`;
const listeners = new Set<() => void>();

function read(projectId: string): View | null {
  try {
    const v = window.localStorage.getItem(key(projectId));
    return v === "list" || v === "board" ? v : null;
  } catch {
    return null;
  }
}

/**
 * The list/board choice is personal (kept on this device), so teammates no longer flip
 * each other's view. Server render returns null → the project's default is used, then
 * the stored choice applies after hydration without a mismatch.
 */
export function useStoredView(projectId: string) {
  const stored = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(projectId),
    () => null,
  );
  const set = useCallback(
    (view: View) => {
      try {
        window.localStorage.setItem(key(projectId), view);
      } catch {
        /* private mode: the URL still carries the view */
      }
      listeners.forEach((l) => l());
    },
    [projectId],
  );
  return [stored, set] as const;
}
