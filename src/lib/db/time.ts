/** Normalise timestamps coming back from Postgres (Date or text) to ISO-8601 strings. */
export function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  const normalised = text.includes("T") ? text : text.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}
