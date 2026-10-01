import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/nlp/tr-parser";
const NOW = new Date("2026-10-01T09:00:00+03:00");
const weird = ["Ali (Satış)", "C++ Ekibi", "a.b*c?", "[Ops]", "Ayşe\\", "$^|", "Öz Ğül", "İ", "  ", "Emre O'Brien", "x".repeat(200)];
describe("fuzz", () => {
  it("never throws with odd member / project names and inputs", () => {
    const members = weird.map((n, i) => ({ id: `m${i}`, name: n }));
    const projects = weird.map((n, i) => ({ id: `p${i}`, name: n }));
    const inputs = ["@Ali (Satış) raporu", "#C++ Ekibi yarın", "#[Ops] !!! cuma 25:99", "Ayşe\\'ye bak", "$^| @", "#", "@", "!!!!!!", "yarın yarın yarın 14:00 15:00", "31 şubat", "29 şubat 2027", "saat 24'te", "x".repeat(600), "🙂 emoji @Öz Ğül'e yaptır", "İ'ye ilet", ""];
    for (const text of inputs) {
      const r = parseQuickAdd(text, { now: NOW, members, projects });
      expect(typeof r.title).toBe("string");
      if (r.dueDate) expect(r.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (r.dueTime) expect(r.dueTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      for (const h of r.highlights) {
        expect(h.start).toBeGreaterThanOrEqual(0);
        expect(h.end).toBeLessThanOrEqual(text.length);
        expect(h.end).toBeGreaterThan(h.start);
      }
    }
  });
  it("invalid calendar dates are not produced", () => {
    expect(parseQuickAdd("31 şubat toplantı", { now: NOW }).dueDate).toBeNull();
    expect(parseQuickAdd("29 şubat 2027", { now: NOW }).dueDate).toBeNull();
  });
});
