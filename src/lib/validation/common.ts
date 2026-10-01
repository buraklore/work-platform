import { z } from "zod";
import { NotFoundError } from "@/lib/api/errors";
import { isValidDate } from "@/lib/dates/tz";
import { POSITION_RE } from "@/lib/positions";

export const zUuid = z.uuid();
export const zColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const zPosition = z.string().regex(POSITION_RE);
export const zIsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    return isValidDate(y!, m!, d!);
  }, "invalid_date");
export const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const zTitle = z.string().trim().min(1).max(500);
export const zName = (max: number) => z.string().trim().min(1).max(max);
/** Tiptap document JSON; rendered only through the editor (never as raw HTML). */
export const zRichText = z
  .object({ type: z.literal("doc") })
  .passthrough()
  .refine((v) => JSON.stringify(v).length <= 100_000, "too_large")
  .nullable();

/** Route params are user input too: a malformed id is simply "not found". */
export function uuidParam(value: string | undefined): string {
  const parsed = zUuid.safeParse(value);
  if (!parsed.success) throw new NotFoundError();
  return parsed.data;
}
