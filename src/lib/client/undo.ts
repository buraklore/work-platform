"use client";

/** The last undoable action (Cmd/Ctrl+Z and the toast's "Geri al" button share it). */
type Entry = { run: () => void; at: number };
let last: Entry | null = null;
const WINDOW_MS = 15_000;

export function registerUndo(run: () => void) {
  last = { run, at: Date.now() };
}

export function runLastUndo(): boolean {
  if (!last || Date.now() - last.at > WINDOW_MS) return false;
  const entry = last;
  last = null;
  entry.run();
  return true;
}

export function clearUndo(run: () => void) {
  if (last?.run === run) last = null;
}
