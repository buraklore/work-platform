/**
 * Turkish-aware text helpers. Never call String#toLowerCase / toUpperCase directly
 * in this codebase (ESLint forbids it) — İ/i and I/ı break with the default locale.
 */

const FOLD_FROM = "İIıĞğÜüŞşÖöÇçÂâÎîÛû";
const FOLD_TO = "iiigguussooccaaiiuu";
const FOLD_MAP = new Map<string, string>();
for (let i = 0; i < FOLD_FROM.length; i++) FOLD_MAP.set(FOLD_FROM[i]!, FOLD_TO[i]!);

export function trLower(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

export function trUpper(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}

/**
 * Search normalisation. Must stay equivalent to the SQL function `public.tr_normalize`
 * (supabase/migrations). Folds Turkish letters to ASCII so "istanbul", "İSTANBUL" and
 * "Istanbul" all match, and "cicek" matches "çiçek". Covered by a JS↔SQL parity test.
 */
export function trNormalize(value: string): string {
  let out = "";
  for (const ch of value) out += FOLD_MAP.get(ch) ?? ch;
  return out.toLocaleLowerCase("en-US");
}

export function trCapitalize(value: string): string {
  if (!value) return value;
  return trUpper(value[0]!) + value.slice(1);
}

export const trCollator = new Intl.Collator("tr", { sensitivity: "base", numeric: true });

export function trCompare(a: string, b: string): number {
  return trCollator.compare(a, b);
}

/** URL-safe slug from Turkish text: "Ajans Ekibi" -> "ajans-ekibi". */
export function trSlugify(value: string): string {
  return trNormalize(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return trUpper(first + last);
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
