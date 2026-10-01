import { expect, test } from "@playwright/test";
import { emailFor, SHOTS, signup, watchErrors } from "./helpers";

test("mobil: alt menü, FAB ile ekleme, tam ekran panel, kaydırarak tamamlama", async ({ page }) => {
  const check = watchErrors(page);
  await signup(page, "Zeynep Ak", `zeynep.${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByLabel("Çalışma alanı adı").fill("Zeynep Tasarım");
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByRole("button", { name: "Başla" }).click();
  await expect(page).toHaveURL(/\/w\//);

  // Sidebar is hidden, bottom navigation is shown.
  await expect(page.getByRole("complementary")).toBeHidden();
  const nav = page.getByRole("navigation", { name: "Ana gezinme" }).last();
  await expect(nav.getByRole("link", { name: "Görevlerim" })).toBeVisible();

  await nav.getByRole("button", { name: "Yeni görev" }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByRole("textbox", { name: "Hızlı görev ekle" });
  await input.fill("Bugün 18'de ödemeyi yap");
  await expect(dialog.getByText("Bugün 18:00")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/m1-quick-add.png` });
  await input.press("Enter");
  await expect(dialog).toBeHidden();
  const row = page.locator("[data-task-id]").filter({ hasText: "Ödemeyi yap" });
  await expect(row).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/m2-home.png` });

  // Full-screen panel with a back arrow.
  await row.click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("textbox", { name: "Görev başlığı" })).toHaveValue("Ödemeyi yap");
  const box = (await panel.boundingBox())!;
  expect(box.width).toBeGreaterThan(380);
  await page.screenshot({ path: `${SHOTS}/m3-panel.png` });
  await panel.getByRole("button", { name: "Paneli kapat" }).first().click();
  await expect(page).not.toHaveURL(/gorev=/);

  // Swipe right to complete.
  const target = row;
  const b = (await target.boundingBox())!;
  const y = b.y + b.height / 2;
  const at = (x: number) => ({ pointerId: 7, pointerType: "touch", clientX: x, clientY: y, bubbles: true, isPrimary: true });
  await target.dispatchEvent("pointerdown", at(b.x + 20));
  for (let x = 40; x <= 140; x += 20) await target.dispatchEvent("pointermove", at(b.x + x));
  await target.dispatchEvent("pointerup", at(b.x + 140));
  await expect(page.getByText("Görev tamamlandı")).toBeVisible();
  check();
});

test("mobil: üst çubuktan çalışma alanı menüsü açılır", async ({ page }) => {
  const check = watchErrors(page);
  await signup(page, "Mobil Değiştirici", emailFor("Mobil Değiştirici"));
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByLabel("Çalışma alanı adı").fill("Cep Ekibi");
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByRole("button", { name: "Başla" }).click();
  await page.getByRole("banner").getByRole("button", { name: /Cep Ekibi/ }).click();
  await expect(page.getByRole("menuitem", { name: "Yeni çalışma alanı" })).toBeVisible();
  check();
});
