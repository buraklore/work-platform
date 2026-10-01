import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(path, v);
    else for (const [p, s] of leaves(v, path)) out.set(p, s);
  }
  return out;
}

/** ICU placeholders ({name}, {count, plural, …}) and rich tags (<terms>) must match across locales. */
function placeholders(s: string): string[] {
  const names = [...s.matchAll(/\{(\w+)(?:,|\})/g)].map((m) => m[1]!);
  const tags = [...s.matchAll(/<(\w+)>/g)].map((m) => `<${m[1]}>`);
  return [...new Set([...names, ...tags])].sort();
}

describe("i18n", () => {
  const trKeys = leaves(tr as Tree);
  const enKeys = leaves(en as Tree);

  it("tr and en have exactly the same keys", () => {
    expect([...enKeys.keys()].filter((k) => !trKeys.has(k))).toEqual([]);
    expect([...trKeys.keys()].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("placeholders match for every key", () => {
    const mismatched = [...trKeys].filter(([k, v]) => placeholders(v).join() !== placeholders(enKeys.get(k) ?? "").join()).map(([k]) => k);
    expect(mismatched).toEqual([]);
  });

  it("no empty strings", () => {
    expect([...trKeys, ...enKeys].filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });
});
