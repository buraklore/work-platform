import { expect, type Page } from "@playwright/test";

export const SHOTS = process.env.E2E_SHOTS ?? "/tmp/e2e-shots";

/** Fails the test on any uncaught page error or console error (hydration mismatches included). */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) {
      errors.push(`console: ${m.text()}`);
    }
  });
  return () => expect(errors, errors.join("\n")).toEqual([]);
}

/** A unique ASCII address for a display name ("Can Yıldız" → can.yildiz.<n>@example.com). */
export function emailFor(name: string): string {
  const slug = name
    .replace(/[İIı]/g, "i").replace(/[Ğğ]/g, "g").replace(/[Üü]/g, "u").replace(/[Şş]/g, "s").replace(/[Öö]/g, "o").replace(/[Çç]/g, "c")
    .toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  return `${slug}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function signup(page: Page, name: string, email: string, next?: string) {
  await page.goto(next ? `/kayit?next=${encodeURIComponent(next)}` : "/kayit");
  await page.getByLabel("Ad soyad", { exact: true }).fill(name);
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill("supersecret1");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
}

export async function quickAdd(page: Page, text: string) {
  const input = page.getByRole("textbox", { name: "Hızlı görev ekle" }).first();
  await input.fill(text);
  await input.press("Enter");
}
