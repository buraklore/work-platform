import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/** Keys longer than this trigger a rebalance of their group. */
export const REBALANCE_THRESHOLD = 48;
export const POSITION_RE = /^[0-9A-Za-z]{1,64}$/;

export function keyBetween(before: string | null | undefined, after: string | null | undefined): string {
  const a = before ?? null;
  const b = after ?? null;
  if (a !== null && b !== null && a >= b) return generateKeyBetween(a, null);
  return generateKeyBetween(a, b);
}

export function freshKeys(count: number): string[] {
  return generateNKeysBetween(null, null, count);
}

export function needsRebalance(position: string): boolean {
  return position.length > REBALANCE_THRESHOLD;
}
