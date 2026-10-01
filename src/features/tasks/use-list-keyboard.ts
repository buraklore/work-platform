"use client";

import { useEffect, useState } from "react";
import { isEditableTarget } from "@/lib/utils";

const INTERACTIVE = '[role="menu"],[role="listbox"],[role="dialog"],[role="tablist"],[role="radiogroup"],[role="grid"],[cmdk-root]';

/** j/k to move, Enter to open, x to complete, Esc to leave — for any visible list of tasks. */
export function useListKeyboard(ids: string[], handlers: { open: (id: string) => void; toggle: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return; // a modal owns the keyboard
      // Menus, pickers and the task panel handle their own keys.
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      if (ids.length === 0) return;
      if (e.key === "Escape" && selected) {
        setSelected(null);
        return;
      }
      // Arrow keys keep scrolling the page until list navigation has started with j/k.
      const arrows = selected !== null;
      const index = selected ? ids.indexOf(selected) : -1;
      if (e.key === "j" || (arrows && e.key === "ArrowDown")) {
        e.preventDefault();
        setSelected(ids[Math.min(ids.length - 1, index + 1)] ?? null);
      } else if (e.key === "k" || (arrows && e.key === "ArrowUp")) {
        e.preventDefault();
        setSelected(ids[Math.max(0, index - 1)] ?? null);
      } else if (e.key === "Enter" && selected) {
        e.preventDefault();
        handlers.open(selected);
      } else if (e.key === "x" && selected) {
        e.preventDefault();
        handlers.toggle(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids, selected, handlers]);

  useEffect(() => {
    if (selected) document.querySelector(`[data-task-id="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return selected;
}
