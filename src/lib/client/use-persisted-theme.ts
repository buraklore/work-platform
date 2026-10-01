"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect } from "react";
import { api } from "@/lib/api/client";
import { useMe } from "@/features/workspaces/context";

type Theme = "light" | "dark" | "system";

/**
 * The theme lives in two places: next-themes (this device, instant) and the profile
 * (follows the user to new devices). Setting it writes both; on a device that never
 * chose a theme, the profile's choice is applied once.
 */
export function usePersistedTheme() {
  const { theme, setTheme } = useTheme();
  const { data: me } = useMe();

  useEffect(() => {
    if (!me) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem("theme");
    } catch {
      return;
    }
    if (!stored && me.theme !== "system") setTheme(me.theme);
  }, [me, setTheme]);

  const set = useCallback(
    (value: Theme) => {
      setTheme(value);
      void api("/me", { method: "PATCH", body: { theme: value } }).catch(() => {});
    },
    [setTheme],
  );
  return { theme: theme as Theme | undefined, setTheme: set };
}
