/**
 * Rule-based Turkish quick-add parser.
 *
 *   "Yarın saat 14'te Ayşe'ye Instagram postunu hazırlat"
 *   → { title: "Instagram postunu hazırla", dueDate: <tomorrow>, dueTime: "14:00", assignee: Ayşe }
 *
 * Pure and deterministic: no I/O, "now" is injected. Linguistic rule for assignees:
 * a dative name ("Ayşe'ye") marks the *doer* only when the verb is causative
 * ("hazırlat", "kontrol ettir"). With a plain verb the dative is a recipient
 * ("Burak'a mail at" = send mail to Burak) and the name stays in the title.
 * An explicit "@ayşe" always assigns.
 */
import {
  addDays,
  addMonths,
  DEFAULT_TZ,
  endOfMonth,
  isoFromParts,
  isoWeekday,
  isValidDate,
  nowHhMm,
  startOfIsoWeek,
  todayIso,
  type HhMm,
  type IsoDate,
} from "@/lib/dates/tz";
import { firstName, trCapitalize, trLower, trNormalize } from "@/lib/text/tr";

export type ParseMember = { id: string; name: string };
export type ParseProject = { id: string; name: string };
export type HighlightKind = "date" | "time" | "assignee" | "project" | "priority";
export type Highlight = { start: number; end: number; kind: HighlightKind };
export type ParsePriority = "high" | "urgent";

export type ParseContext = {
  now: Date;
  tz?: string;
  members?: ParseMember[];
  projects?: ParseProject[];
  /** Kinds the user dismissed in the UI: their words stay in the title. */
  disable?: HighlightKind[];
};

export type ParseResult = {
  title: string;
  dueDate: IsoDate | null;
  dueTime: HhMm | null;
  assigneeIds: string[];
  projectId: string | null;
  priority: ParsePriority | null;
  highlights: Highlight[];
  ambiguous: { text: string; candidates: ParseMember[] }[];
  /** 0..1 — below 0.7 the M4 AI fallback may offer a suggestion. */
  confidence: number;
};

const L = "\\p{L}\\p{N}";
const B = `(?<![${L}])`; // word start
const E = `(?![${L}])`; // word end

const WEEKDAYS: Record<string, number> = {
  pazartesi: 1,
  salı: 2,
  çarşamba: 3,
  perşembe: 4,
  cuma: 5,
  cumartesi: 6,
  pazar: 7,
};
// Longest first so "pazartesi" wins over "pazar", "cumartesi" over "cuma".
const WD = "(pazartesi|cumartesi|çarşamba|perşembe|salı|cuma|pazar)";
const WD_SUFFIX =
  "(?:(?:ya|ye|a|e)(?:\\s+kadar)?|ndan|nden|dan|den|nda|nde|da|de|ta|te|sına|sine|sı|si|yı|yi|ı|i|\\s+günü(?:ne)?(?:\\s+kadar)?)?";

const MONTHS: Record<string, number> = {
  ocak: 1,
  şubat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  haziran: 6,
  temmuz: 7,
  ağustos: 8,
  eylül: 9,
  ekim: 10,
  kasım: 11,
  aralık: 12,
  // consonant softening before a vowel suffix: "ocağa", "aralığa"
  ocağ: 1,
  aralığ: 12,
};
const MONTH_RE = "(ocak|ocağ|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|aralığ)";
const CASE_SUFFIX = "(?:['’]?(?:ta|te|da|de|ya|ye|a|e|na|ne))?(?:\\s+kadar)?";

const NUMBER_WORDS: Record<string, number> = {
  bir: 1,
  iki: 2,
  üç: 3,
  dört: 4,
  beş: 5,
  altı: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
  on: 10,
};
const NUM = "(\\d{1,2}|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)";

type DayPart = "sabah" | "öğle" | "öğleden sonra" | "akşamüstü" | "akşam" | "gece";
const DAYPART_HOUR: Record<DayPart, number> = {
  sabah: 9,
  öğle: 12,
  "öğleden sonra": 15,
  akşamüstü: 17,
  akşam: 18,
  gece: 21,
};
const PM_PARTS = new Set<DayPart>(["öğleden sonra", "akşamüstü", "akşam", "gece"]);
const DAYPART_RE =
  /^\s+(öğleden\s+sonra|öğlen|öğle|sabah|akşamüstü|akşam|gece)(?:ı|i|leyin|ları|leri|dan|den)?(?![\p{L}\p{N}])/u;

/** Verbs that end like causatives but are lexicalised transitives — dative = recipient. */
const NOT_CAUSATIVE = new Set([
  "anlat",
  "bildir",
  "kaldır",
  "öğret",
  "yarat",
  "uzat",
  "bitir",
  "getir",
  "götür",
  "geçir",
  "düşür",
  "doldur",
  "yatır",
  "öldür",
  "pişir",
  "kaçır",
  "uçur",
  "duyur",
  "indir",
  "sert",
]);
const SHORT_CAUSATIVES: Record<string, string> = {
  okut: "oku",
  arat: "ara",
  taşıt: "taşı",
  yıkat: "yıka",
  boyat: "boya",
  sayt: "say",
  yürüt: "yürü",
};

/** "hazırlat" → "hazırla", "kontrol ettir" (last word "ettir") → "et", "yaptır" → "yap". */
export function decausativize(word: string): string | null {
  const w = trLower(word);
  if (NOT_CAUSATIVE.has(w)) return null;
  if (SHORT_CAUSATIVES[w]) return SHORT_CAUSATIVES[w]!;
  if (w.endsWith("ettirt")) return word.slice(0, -4);
  if (w.endsWith("ettir")) return word.slice(0, -3);
  const dir = /^(.{3,}?)(tır|tir|tur|tür|dır|dir|dur|dür)$/u.exec(w);
  if (dir) {
    const stem = dir[1]!;
    // değiştir, geliştir, yetiştir, yapıştır… are lexicalised: stem ending in "ş".
    if (/[bcçdfgğhjklmnprstvyz]$/u.test(stem)) return word.slice(0, stem.length);
    return null;
  }
  if (/^.{2,}(?:la|le)t$/u.test(w)) return word.slice(0, -1); // hazırlat, temizlet, planlat
  if (/^.{3,}rt$/u.test(w)) return word.slice(0, -1); // göndert, getirt, geçirt, bitirt
  return null;
}

function numberValue(token: string): number {
  return NUMBER_WORDS[token] ?? Number(token);
}

function stripNonAlnum(value: string): string {
  return trNormalize(value).replace(/[^a-z0-9]/g, "");
}

export function parseQuickAdd(text: string, ctx: ParseContext): ParseResult {
  const tz = ctx.tz ?? DEFAULT_TZ;
  const today = todayIso(ctx.now, tz);
  const members = ctx.members ?? [];
  const projects = ctx.projects ?? [];

  const lowered = trLower(text);
  // Turkish lowercasing is length-preserving for Turkish letters; if some exotic
  // character changes length we fall back to matching on the raw text.
  const lower = lowered.length === text.length ? lowered : text;

  const consumed = new Array<boolean>(text.length).fill(false);
  const highlights: Highlight[] = [];
  const ambiguous: ParseResult["ambiguous"] = [];

  const free = (start: number, end: number) => {
    for (let i = start; i < end; i++) if (consumed[i]) return false;
    return true;
  };
  const off = new Set(ctx.disable ?? []);
  const take = (start: number, end: number, kind: HighlightKind) => {
    for (let i = start; i < end; i++) consumed[i] = true;
    highlights.push({ start, end, kind });
  };
  const each = (pattern: string) => lower.matchAll(new RegExp(pattern, "gu"));

  // Held in an object: closures below mutate them and TS narrowing would otherwise lie.
  const st: { dueDate: IsoDate | null; dueTime: HhMm | null; dayPart: DayPart | null } = {
    dueDate: null,
    dueTime: null,
    dayPart: null,
  };
  let priority: ParsePriority | null = null;
  let projectId: string | null = null;
  const assigneeIds: string[] = [];

  // ── Priority ──────────────────────────────────────────────────────────────
  for (const m of each("(?<!\\S)(!!!|!!)(?!\\S)")) {
    if (off.has("priority") || priority || !free(m.index, m.index + m[0].length)) continue;
    priority = m[1] === "!!!" ? "urgent" : "high";
    take(m.index, m.index + m[0].length, "priority");
  }

  // ── Project (#tag) ────────────────────────────────────────────────────────
  for (const m of each(`#([${L}_-]{2,})`)) {
    if (projectId || off.has("project")) break;
    const tag = stripNonAlnum(m[1]!);
    const exact = projects.filter((p) => stripNonAlnum(p.name) === tag);
    const prefix = projects.filter((p) => stripNonAlnum(p.name).startsWith(tag));
    const hit = exact.length === 1 ? exact[0] : prefix.length === 1 ? prefix[0] : undefined;
    if (hit) {
      projectId = hit.id;
      take(m.index, m.index + m[0].length, "project");
    }
  }

  // ── Explicit mentions (@isim) ─────────────────────────────────────────────
  for (const m of each(`@([${L}._-]+)(?:['’][\\p{L}]+)?`)) {
    if (off.has("assignee")) break;
    const token = trNormalize(m[1]!);
    const byFirst = members.filter((u) => trNormalize(firstName(u.name)) === token);
    const byFull = members.filter((u) => stripNonAlnum(u.name).startsWith(stripNonAlnum(token)));
    const pool = byFirst.length > 0 ? byFirst : byFull;
    if (pool.length === 0) continue;
    if (pool.length === 1) {
      if (!assigneeIds.includes(pool[0]!.id)) assigneeIds.push(pool[0]!.id);
    } else {
      ambiguous.push({ text: text.slice(m.index, m.index + m[0].length), candidates: pool });
    }
    take(m.index, m.index + m[0].length, "assignee");
  }

  // ── Dates ─────────────────────────────────────────────────────────────────
  const setDate = (value: IsoDate, start: number, end: number) => {
    if (off.has("date") || st.dueDate || !free(start, end)) return false;
    st.dueDate = value;
    let finalEnd = end;
    const dp = DAYPART_RE.exec(lower.slice(end));
    if (dp) {
      const raw = dp[1]!.replace(/\s+/g, " ");
      st.dayPart = (raw === "öğlen" ? "öğle" : raw) as DayPart;
      finalEnd = end + dp[0].length;
    }
    take(start, finalEnd, "date");
    return true;
  };

  const weekdayDate = (target: number, mode: "upcoming" | "strict" | "this-week" | "next-week") => {
    if (mode === "next-week") return addDays(startOfIsoWeek(today), 7 + target - 1);
    if (mode === "this-week") {
      const d = addDays(startOfIsoWeek(today), target - 1);
      return d < today ? addDays(d, 7) : d;
    }
    const current = isoWeekday(today);
    let delta = (target - current + 7) % 7;
    if (delta === 0 && mode === "strict") delta = 7;
    return addDays(today, delta);
  };

  // 15.10 / 15.10.2026 / 15/10
  for (const m of each(`${B}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?${CASE_SUFFIX}${E}`)) {
    if (lower.slice(Math.max(0, m.index - 5), m.index) === "saat ") continue; // "saat 10.05" is a time
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
    if (m[3] && m[3].length === 2) y += 2000;
    if (!isValidDate(y, mo, d)) continue;
    let iso = isoFromParts(y, mo, d);
    if (!m[3] && iso < today) iso = isoFromParts(y + 1, mo, d);
    setDate(iso, m.index, m.index + m[0].length);
  }

  // 15 ekim / 15 ekim 2026 / 3 marta kadar
  for (const m of each(`${B}(\\d{1,2})\\s+${MONTH_RE}(?:\\s+(\\d{4}))?${CASE_SUFFIX}${E}`)) {
    const d = Number(m[1]);
    const mo = MONTHS[m[2]!]!;
    let y = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
    if (!isValidDate(y, mo, d)) continue;
    let iso = isoFromParts(y, mo, d);
    if (!m[3] && iso < today) {
      y += 1;
      if (!isValidDate(y, mo, d)) continue;
      iso = isoFromParts(y, mo, d);
    }
    setDate(iso, m.index, m.index + m[0].length);
  }

  // 3 gün sonra / bir hafta sonra / 2 ay içinde
  for (const m of each(`${B}${NUM}\\s+(gün|hafta|ay)\\s+(?:sonra(?:ya|sı|ki)?|içinde)${E}`)) {
    const n = numberValue(m[1]!);
    const unit = m[2]!;
    const iso = unit === "gün" ? addDays(today, n) : unit === "hafta" ? addDays(today, n * 7) : addMonths(today, n);
    setDate(iso, m.index, m.index + m[0].length);
  }

  // haftaya cuma / gelecek haftanın salısı / önümüzdeki pazartesi / bu perşembe
  for (const m of each(
    `${B}(haftaya|gelecek\\s+haftanın|gelecek\\s+hafta|gelecek|önümüzdeki\\s+haftanın|önümüzdeki\\s+hafta|önümüzdeki|bu\\s+haftanın|bu\\s+hafta|bu)\\s+${WD}${WD_SUFFIX}${E}`,
  )) {
    const prefix = m[1]!.replace(/\s+/g, " ");
    const target = WEEKDAYS[m[2]!]!;
    const mode = prefix.startsWith("bu")
      ? "this-week"
      : prefix === "gelecek" || prefix === "önümüzdeki"
        ? "strict"
        : "next-week";
    setDate(weekdayDate(target, mode), m.index, m.index + m[0].length);
  }

  // öbür gün / ertesi gün
  for (const m of each(`${B}(?:öbür\\s?gün|ertesi\\s+gün)(?:e|ü|ne)?(?:\\s+kadar)?${E}`)) {
    setDate(addDays(today, 2), m.index, m.index + m[0].length);
  }

  // bugün / yarın / dün
  for (const m of each(`${B}(bugün|yarın|dün)(?:e|a|den|dan|kü|ki)?(?:\\s+kadar)?${E}`)) {
    const offset = m[1] === "bugün" ? 0 : m[1] === "yarın" ? 1 : -1;
    setDate(addDays(today, offset), m.index, m.index + m[0].length);
  }

  // hafta sonu
  for (const m of each(`${B}(?:bu\\s+)?hafta\\s?sonu(?:na|nda)?(?:\\s+kadar)?${E}`)) {
    const wd = isoWeekday(today);
    setDate(wd >= 6 ? today : addDays(today, 6 - wd), m.index, m.index + m[0].length);
  }

  // ay sonu / ay başı / gelecek ay
  for (const m of each(`${B}(?:bu\\s+)?ay\\s?sonu(?:na|nda)?(?:\\s+kadar)?${E}`)) {
    setDate(endOfMonth(today), m.index, m.index + m[0].length);
  }
  for (const m of each(`${B}(?:(?:gelecek|önümüzdeki)\\s+ay(?:ın)?\\s+başı|ay\\s?başı)(?:na|nda)?(?:\\s+kadar)?${E}`)) {
    setDate(addDays(endOfMonth(today), 1), m.index, m.index + m[0].length);
  }
  for (const m of each(`${B}(?:gelecek|önümüzdeki)\\s+ay${E}`)) {
    setDate(addDays(endOfMonth(today), 1), m.index, m.index + m[0].length);
  }

  // bu hafta / gelecek hafta / haftaya (without a weekday — those were consumed above)
  for (const m of each(`${B}(bu\\s+hafta(?:\\s+içinde)?|gelecek\\s+hafta(?:ya)?|önümüzdeki\\s+hafta|haftaya)${E}`)) {
    const phrase = m[1]!;
    let iso: IsoDate;
    if (phrase.startsWith("bu")) {
      const friday = addDays(startOfIsoWeek(today), 4);
      iso = friday < today ? today : friday;
    } else if (phrase === "haftaya") {
      iso = addDays(today, 7);
    } else {
      iso = addDays(startOfIsoWeek(today), 7);
    }
    setDate(iso, m.index, m.index + m[0].length);
  }

  // Plain weekday: "cuma", "salıya kadar", "perşembe günü"
  for (const m of each(`${B}${WD}${WD_SUFFIX}${E}`)) {
    setDate(weekdayDate(WEEKDAYS[m[1]!]!, "upcoming"), m.index, m.index + m[0].length);
  }

  // ── Times ─────────────────────────────────────────────────────────────────
  const setTime = (hourRaw: number, minute: number, start: number, end: number, part: DayPart | null) => {
    if (off.has("time") || off.has("date") || st.dueTime || !free(start, end)) return;
    if (hourRaw > 23 || minute > 59) return;
    let hour = hourRaw;
    const effectivePart = part ?? st.dayPart;
    if (effectivePart && PM_PARTS.has(effectivePart) && hour < 12) hour += 12;
    else if (!effectivePart && hour >= 1 && hour <= 7) hour += 12; // "saat 3" in a work context
    st.dueTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    take(start, end, "time");
  };

  const TIME_SUFFIX = "(?:['’]?(?:te|ta|de|da|ten|tan|den|dan|ye|ya|e|a))?(?:\\s+kadar)?";
  const PART = "(?:(öğleden\\s+sonra|öğlen|öğle|sabah|akşamüstü|akşam|gece)\\s+)?";
  const partOf = (raw: string | undefined): DayPart | null =>
    raw ? ((raw === "öğlen" ? "öğle" : raw.replace(/\s+/g, " ")) as DayPart) : null;
  /** If the leading day-part was already eaten by a date ("yarın akşam"), retry from the number. */
  const applyTime = (m: RegExpMatchArray, hour: string, minute: string | undefined) => {
    const idx = m.index!;
    const end = idx + m[0].length;
    let start = idx;
    let part = partOf(m[1]);
    if (!free(start, end) && m[1]) {
      start = idx + m[0].search(/(?:saat\s+)?\d/u);
      part = null;
    }
    setTime(Number(hour), minute ? Number(minute) : 0, start, end, part);
  };
  // [akşam] saat 7 / saat 14:30'da
  for (const m of each(`${B}${PART}saat\\s+(\\d{1,2})(?:[:.](\\d{2}))?${TIME_SUFFIX}${E}`)) {
    applyTime(m, m[2]!, m[3]);
  }
  // [akşam] 14:30
  for (const m of each(`${B}${PART}(\\d{1,2}):(\\d{2})${TIME_SUFFIX}${E}`)) {
    applyTime(m, m[2]!, m[3]);
  }
  // [akşam] 7'de / 14'te — dative ("5'e") only with "kadar" so "3'e böl" stays text
  for (const m of each(`${B}${PART}(\\d{1,2})['’](?:te|ta|de|da|(?:ye|ya|e|a)\\s+kadar)${E}`)) {
    applyTime(m, m[2]!, undefined);
  }

  if (!off.has("time") && !st.dueTime && st.dayPart) st.dueTime = `${String(DAYPART_HOUR[st.dayPart]).padStart(2, "0")}:00`;
  if (st.dueTime && !st.dueDate) {
    st.dueDate = st.dueTime > nowHhMm(ctx.now, tz) ? today : addDays(today, 1);
  }

  // ── Dative names (Ayşe'ye) — decided after the title is known ─────────────
  type DativeCandidate = { start: number; end: number; member: ParseMember | null; pool: ParseMember[] };
  const datives: DativeCandidate[] = [];
  for (const m of text.matchAll(/['’](?:ya|ye|na|ne|a|e)(?![\p{L}\p{N}])/gu)) {
    const apostrophe = m.index;
    const before = text.slice(0, apostrophe);
    const words = /(?:^|\s)(\S+)(?:\s+(\S+))?$/u.exec(before);
    if (!words) continue;
    const lastWord = words[2] ?? words[1]!;
    const prevWord = words[2] ? words[1]! : null;
    const end = apostrophe + m[0].length;
    const lastStart = apostrophe - lastWord.length;
    if (prevWord) {
      const full = stripNonAlnum(`${prevWord}${lastWord}`);
      const hit = members.filter((u) => stripNonAlnum(u.name) === full);
      if (hit.length === 1) {
        datives.push({ start: lastStart - 1 - prevWord.length, end, member: hit[0]!, pool: hit });
        continue;
      }
    }
    const token = trNormalize(lastWord);
    const pool = members.filter((u) => trNormalize(firstName(u.name)) === token);
    if (pool.length === 0) continue;
    datives.push({ start: lastStart, end, member: pool.length === 1 ? pool[0]! : null, pool });
  }

  const buildTitle = (extraConsumed: Array<[number, number]>) => {
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const hidden = consumed[i] || extraConsumed.some(([s, e]) => i >= s && i < e);
      out += hidden ? " " : text[i];
    }
    return out
      .replace(/\s+/g, " ")
      .replace(/(^|\s)saat(?=\s|$)/giu, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/^[\s,.;:–-]+|[\s,;:–-]+$/g, "")
      .trim();
  };

  let title = buildTitle([]);
  const words = title.split(" ");
  const lastWord = words[words.length - 1] ?? "";
  const base = lastWord ? decausativize(lastWord) : null;
  const usableDatives = off.has("assignee") ? [] : datives.filter((d) => free(d.start, d.end));

  const delegated = !off.has("assignee") && base !== null && (usableDatives.length > 0 || assigneeIds.length > 0);
  if (base && usableDatives.length > 0) {
    for (const d of usableDatives) {
      if (d.member) {
        if (!assigneeIds.includes(d.member.id)) assigneeIds.push(d.member.id);
      } else {
        ambiguous.push({ text: text.slice(d.start, d.end), candidates: d.pool });
      }
      take(d.start, d.end, "assignee");
    }
    title = buildTitle([]);
  }
  if (delegated) {
    const parts = title.split(" ");
    const last = parts[parts.length - 1]!;
    const replaced = decausativize(last);
    if (replaced) parts[parts.length - 1] = replaced;
    title = parts.join(" ");
  }

  if (!title) title = text.trim();
  title = trCapitalize(title);

  let confidence = 1;
  if (ambiguous.length > 0) confidence = 0.4;
  else if (/(?:^|\s)(saat|gün|hafta|ay|sabah|akşam|öğlen|yarın|bugün)(?=\s|$)/iu.test(title)) confidence = 0.6;

  highlights.sort((a, b) => a.start - b.start);

  return { title, dueDate: st.dueDate, dueTime: st.dueTime, assigneeIds, projectId, priority, highlights, ambiguous, confidence };
}
