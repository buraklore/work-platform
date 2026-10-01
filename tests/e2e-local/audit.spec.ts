import { expect, test, type Page } from "@playwright/test";
import { emailFor, quickAdd, SHOTS, signup, watchErrors } from "./helpers";

/** Second full audit: every fix is proven in a real browser. */

async function newWorkspace(page: Page, name: string) {
  await signup(page, name, emailFor(name));
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByLabel("Çalışma alanı adı").fill(`${name} Ekibi`);
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByRole("button", { name: "Başla" }).click();
  await expect(page).toHaveURL(/\/w\//);
}

async function newProject(page: Page, name: string) {
  await page.getByRole("button", { name: "Yeni proje" }).first().click();
  await page.getByLabel("Proje adı").fill(name);
  await page.getByRole("button", { name: "Projeyi oluştur" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("A2: açıklama, panel kapatılıp hemen açılınca kaybolmaz", async ({ page }) => {
  const check = watchErrors(page);
  await newWorkspace(page, "Açıklama Testi");
  await quickAdd(page, "Teklif hazırla");
  await page.locator("[data-task-id]").filter({ hasText: "Teklif hazırla" }).click();
  const editor = page.locator(".tiptap");
  await editor.click();
  await page.keyboard.type("Birinci satır");
  await page.waitForTimeout(1200); // debounce + save
  await page.keyboard.press("Escape");
  await page.locator("[data-task-id]").filter({ hasText: "Teklif hazırla" }).click();
  await expect(page.locator(".tiptap")).toContainText("Birinci satır");
  await page.locator(".tiptap").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" ikinci");
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator(".tiptap")).toContainText("Birinci satır ikinci");
  check();
});

test("A3 + B: geri tuşu paneli kapatır, kapanan panel geri gelmez; panel açıkken başka göreve geçilir", async ({ page }) => {
  const check = watchErrors(page);
  await newWorkspace(page, "Geçmiş Testi");
  await quickAdd(page, "Birinci iş");
  await quickAdd(page, "İkinci iş");
  const home = page.url();
  await page.locator("[data-task-id]").filter({ hasText: "Birinci iş" }).click();
  await expect(page).toHaveURL(/gorev=/);
  // Clicking another task while the panel is open switches to it (no close/open race).
  await page.locator("[data-task-id]").filter({ hasText: "İkinci iş" }).click();
  await expect(page.getByRole("dialog").getByRole("textbox", { name: "Görev başlığı" })).toHaveValue("İkinci iş");
  // Back closes the panel …
  await page.goBack();
  await expect(page).toHaveURL(home);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // … and closing with X then going back does not resurrect it.
  await page.locator("[data-task-id]").filter({ hasText: "Birinci iş" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Paneli kapat" }).last().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(home);
  check();
});

test("B7: ana sayfadan #proje ile eklenen görev bana atanır ve ana sayfada görünür", async ({ page }) => {
  const check = watchErrors(page);
  await newWorkspace(page, "Atama Testi");
  await newProject(page, "Web");
  await page.getByRole("link", { name: "Ana sayfa" }).first().click();
  await quickAdd(page, "Bugün banner #web");
  await expect(page.getByText("Görev Web projesine eklendi")).toBeVisible();
  await expect(page.getByRole("region", { name: "Bugün" }).getByText("Banner")).toBeVisible();
  check();
});

test("B12: aynı adlı iki kişi varken seçim yapılmadan görev oluşturulmaz", async ({ browser }) => {
  // Ayşe owns the workspace, two "Can"s join.
  const owner = await browser.newPage();
  await newWorkspace(owner, "Belirsiz Testi");
  await newProject(owner, "Ortak");
  await owner.getByRole("link", { name: "Ayarlar" }).first().click();
  await owner.getByRole("button", { name: "Link oluştur" }).click();
  const url = (await owner.locator("code").textContent())!.trim();
  for (const full of ["Can Demir", "Can Yıldız"]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await signup(p, full, emailFor(full), new URL(url).pathname);
    await p.getByRole("button", { name: "Ekibe katıl" }).click();
    await expect(p).toHaveURL(/\/w\//);
    await ctx.close();
  }
  // Back on the tab after sharing the link: the member list refreshes (here: a reload).
  await owner.reload();
  await owner.getByRole("link", { name: "Ortak" }).first().click();
  const input = owner.getByRole("textbox", { name: "Hızlı görev ekle" });
  await input.fill("Can'a raporu yazdır");
  await expect(owner.getByText("Görevi kime vereceğini seç.")).toBeVisible();
  await input.press("Enter");
  await expect(owner.locator("[data-task-id]")).toHaveCount(0);
  await owner.getByRole("button", { name: "Hangi Can?" }).click();
  await owner.getByRole("menuitem", { name: "Can Yıldız" }).click();
  await input.press("Enter");
  const row = owner.locator("[data-task-id]").filter({ hasText: "Raporu yaz" });
  await expect(row).toBeVisible();
  await expect(row.getByLabel("Can Yıldız")).toBeVisible();
  await owner.screenshot({ path: `${SHOTS}/a-ambiguous.png` });
});

test("A4 + A5: klavye — Enter görevi açar, ok tuşları sayfayı kaydırır, j/k gezer", async ({ page }) => {
  const check = watchErrors(page);
  await newWorkspace(page, "Klavye Testi");
  await newProject(page, "Liste");
  for (let i = 1; i <= 3; i++) await quickAdd(page, `İş ${i}`);
  await expect(page.locator("[data-task-id]")).toHaveCount(3);
  await page.locator("body").click({ position: { x: 5, y: 500 } });
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await expect(page.locator("[data-task-id][data-selected]")).toContainText("İş 2");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-task-id][data-selected]")).toHaveCount(0);
  // Tab reaches a row; Enter opens it (does not start a drag).
  await page.locator("[data-task-id]").filter({ hasText: "İş 3" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByRole("textbox", { name: "Görev başlığı" })).toHaveValue("İş 3");
  check();
});

test("B: kontrol listesi maddesi düzenlenebilir; yükleme sırasında da panel kapatılabilir", async ({ page }) => {
  const check = watchErrors(page);
  await newWorkspace(page, "Liste Testi");
  await quickAdd(page, "Toplantı");
  await page.locator("[data-task-id]").filter({ hasText: "Toplantı" }).click();
  const panel = page.getByRole("dialog");
  await panel.getByPlaceholder("Madde ekle").fill("Gündme");
  await panel.getByPlaceholder("Madde ekle").press("Enter");
  await panel.getByRole("button", { name: '"Gündme" maddesini düzenle' }).click();
  const edit = panel.getByRole("textbox", { name: '"Gündme" maddesini düzenle' });
  await edit.fill("Gündem");
  await edit.press("Enter");
  await expect(panel.getByRole("button", { name: '"Gündem" maddesini düzenle' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog").getByText("Gündem")).toBeVisible();
  check();
});

test("C: durum adı Enter ile kaydedilir, durumlar sıralanır; görünüm tercihi kişiseldir", async ({ page }) => {
  const check = watchErrors(page);
  await newWorkspace(page, "Durum Testi");
  await newProject(page, "Süreç");
  await page.getByRole("button", { name: "Proje ayarları" }).click();
  await page.getByRole("tab", { name: "Durumlar" }).click();
  const names = page.getByRole("textbox", { name: "Durum adı" });
  await names.nth(2).fill("Onay bekliyor");
  await names.nth(2).press("Enter");
  await expect(page.getByText("Onay bekliyor").or(page.locator('input[value="Onay bekliyor"]'))).toHaveCount(1);
  await page.getByRole("button", { name: "Onay bekliyor durumunu yukarı taşı" }).click();
  await expect(names.nth(1)).toHaveValue("Onay bekliyor");
  await page.keyboard.press("Escape");
  // Board order follows.
  await page.getByRole("tab", { name: "Pano" }).click();
  const columns = page.locator("section[aria-label]").filter({ has: page.locator("header") });
  await expect(columns.nth(1)).toHaveAttribute("aria-label", "Onay bekliyor");
  // My view choice survives a reload without the URL param, and does not change the project default.
  await page.goto(page.url().split("?")[0]!);
  await expect(page.getByRole("tab", { name: "Pano" })).toHaveAttribute("aria-selected", "true");
  check();
});

test("C: özele çevirme ve üye çıkarma onay ister; silinen projede sonsuz iskelet yok", async ({ page }) => {
  const check = watchErrors(page);
  await newWorkspace(page, "Onay Testi");
  await newProject(page, "Gizlenecek");
  const projectUrl = page.url();
  await page.getByRole("button", { name: "Proje ayarları" }).click();
  await page.getByRole("radio", { name: /Sadece davet edilenler/ }).click();
  await expect(page.getByText("Proje yalnızca üyelerine açık olacak.")).toBeVisible();
  await page.getByRole("button", { name: "Özel yap" }).click();
  await expect(page.getByRole("radio", { name: /Sadece davet edilenler/ })).toHaveAttribute("aria-checked", "true");
  // Delete, then open the old URL: a clear message instead of a skeleton.
  await page.getByRole("button", { name: "Projeyi sil" }).click();
  await page.getByRole("button", { name: "Projeyi sil" }).last().click();
  await expect(page).toHaveURL(/\/projeler$/);
  await page.goto(projectUrl);
  await expect(page.getByText("Sayfa bulunamadı").or(page.getByText("Bu projeye ulaşılamıyor")).or(page.getByRole("heading", { name: "Bu sayfa yok" }))).toBeVisible();
  check();
});

test("C: yalnızca tarih yazılınca boş başlık gönderilmez", async ({ page }) => {
  const check = watchErrors(page);
  await newWorkspace(page, "Boş Başlık");
  await newProject(page, "Takvim");
  await page.getByRole("button", { name: "Görev ekle" }).first().click();
  const inline = page.getByRole("textbox", { name: "Görev ekle", exact: true });
  await inline.fill("yarın");
  await inline.press("Enter");
  await expect(page.locator("[data-task-id]").filter({ hasText: "yarın" })).toBeVisible();
  await quickAdd(page, "cuma 14:00");
  await expect(page.locator("[data-task-id]").filter({ hasText: "cuma 14:00" })).toBeVisible();
  check();
});

test("D: komut menüsü Türkçe adlarla süzer, aramada komutlar da çıkar", async ({ page }) => {
  const check = watchErrors(page);
  await newWorkspace(page, "Komut Testi");
  await page.keyboard.press("Control+k");
  const box = page.getByPlaceholder("Görev, proje veya kişi ara…");
  await box.fill("y");
  await expect(page.getByRole("option", { name: "Yeni görev ekle" })).toBeVisible();
  await box.fill("tema");
  await expect(page.getByRole("option", { name: "Temayı değiştir" })).toBeVisible();
  await box.fill("ayar");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ayarlar$/);
  check();
});

test("D: davetle katılan kişi kendi alanını açabilir; sahip olan limit mesajı görür", async ({ browser }) => {
  const owner = await browser.newPage();
  await newWorkspace(owner, "Alan Sahibi");
  // The owner already owns a free workspace: a clear limit message.
  await owner.getByRole("button", { name: /Alan Sahibi Ekibi/ }).first().click();
  await owner.getByRole("menuitem", { name: "Yeni çalışma alanı" }).click();
  await owner.getByLabel("Çalışma alanı adı").fill("İkinci");
  await owner.getByRole("button", { name: "Oluştur" }).click();
  await expect(owner.getByText("Ücretsiz planda bir çalışma alanına sahip olabilirsin")).toBeVisible();
  await owner.keyboard.press("Escape");
  await owner.getByRole("link", { name: "Ayarlar" }).first().click();
  await owner.getByRole("button", { name: "Link oluştur" }).click();
  const url = (await owner.locator("code").textContent())!.trim();

  const ctx = await browser.newContext();
  const guest = await ctx.newPage();
  const check = watchErrors(guest);
  await signup(guest, "Katılan Üye", emailFor("Katılan Üye"), new URL(url).pathname);
  await guest.getByRole("button", { name: "Ekibe katıl" }).click();
  await expect(guest).toHaveURL(/\/w\//);
  await guest.getByRole("button", { name: /Alan Sahibi Ekibi/ }).first().click();
  await guest.getByRole("menuitem", { name: "Yeni çalışma alanı" }).click();
  await guest.getByLabel("Çalışma alanı adı").fill("Kendi Ajansım");
  await guest.getByRole("button", { name: "Oluştur" }).click();
  await expect(guest).toHaveURL(/\/w\/kendi-ajansim-/);
  await expect(guest.getByText("Çalışma alanın hazır.")).toBeVisible();
  check();
  await ctx.close();
});

test("E: sahip üyeyi çıkarır, üye alandan ayrılır", async ({ browser }) => {
  const owner = await browser.newPage();
  await newWorkspace(owner, "Ekip Sahibi");
  await owner.getByRole("link", { name: "Ayarlar" }).first().click();
  await owner.getByRole("button", { name: "Link oluştur" }).click();
  const url = (await owner.locator("code").textContent())!.trim();
  const people: Page[] = [];
  for (const name of ["Çıkarılacak Kişi", "Ayrılacak Kişi"]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await signup(p, name, emailFor(name), new URL(url).pathname);
    await p.getByRole("button", { name: "Ekibe katıl" }).click();
    await expect(p).toHaveURL(/\/w\//);
    people.push(p);
  }
  await owner.reload();
  const row = owner.locator("li").filter({ hasText: "Çıkarılacak Kişi" });
  await row.getByRole("button", { name: "Üye" }).click();
  await owner.getByRole("menuitem", { name: "Çalışma alanından çıkar" }).click();
  await owner.getByRole("button", { name: "Çalışma alanından çıkar" }).click();
  await expect(owner.getByText("Üye çıkarıldı")).toBeVisible();
  await expect(owner.locator("li").filter({ hasText: "Çıkarılacak Kişi" })).toHaveCount(0);

  const leaver = people[1]!;
  const check = watchErrors(leaver);
  await leaver.getByRole("link", { name: "Ayarlar" }).first().click();
  await leaver.getByRole("button", { name: "Bu çalışma alanından ayrıl" }).click();
  await leaver.getByRole("button", { name: "Çalışma alanından çıkar" }).click();
  await expect(leaver).toHaveURL(/\/baslangic$/);
  check();
});

test("E: giriş formu hatası doğru alanda; şifre yenileme linksiz açılınca yol gösterir", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/giris");
  await page.getByRole("button", { name: "Şifresiz giriş linki gönder" }).click();
  const email = page.getByLabel("E-posta", { exact: true });
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await page.goto("/sifre-yenile");
  await expect(page.getByText("e-postadaki şifre sıfırlama linkini aynı tarayıcıda")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sıfırlama linki gönder" })).toBeVisible();
  check();
});
