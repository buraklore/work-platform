"use client";

/** Tiny app-wide event bus for keyboard-driven actions that cross component trees. */
type Events = {
  "quick-add": void;
  "command-menu": void;
  "shortcuts-help": void;
  "new-project": void;
};

const target = typeof window !== "undefined" ? new EventTarget() : null;

export function emit<K extends keyof Events>(name: K) {
  target?.dispatchEvent(new Event(name));
}

export function on<K extends keyof Events>(name: K, fn: () => void): () => void {
  target?.addEventListener(name, fn);
  return () => target?.removeEventListener(name, fn);
}

/** How many inline quick-add bars are on screen; the shortcut focuses one instead of opening a dialog. */
export const inlineQuickAdd = { count: 0 };
