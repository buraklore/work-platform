"use client";

import { useSyncExternalStore } from "react";
import { isMac } from "@/lib/utils";

const subscribe = () => () => {};

/** "⌘" on Apple devices, "Ctrl" elsewhere. The server snapshot is "Ctrl", so hydration stays consistent. */
export function useModKey() {
  return useSyncExternalStore(subscribe, () => (isMac() ? "⌘" : "Ctrl"), () => "Ctrl");
}

/** false during SSR and hydration, true afterwards (for values only the browser knows, like the theme). */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
