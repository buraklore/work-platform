import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { quickAdd, SHOTS, signup, watchErrors } from "./helpers";

/**
 * One continuous story, the way a new team would use the product on day one:
 * sign up → set up a workspace → capture tasks in Turkish → organise them in a project →
 * invite a teammate who joins and receives a delegated task.
 */
test.describe.serial("ilk gün", () => {
  let ctx: BrowserContext;
  let page: Page;
  let check: () => void;
  let inviteUrl = "";
  let slug = "";
  const stamp = Date.now();

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ locale: "tr-TR", timezoneId: "Europe/Istanbul", viewport: { width: 1360, height: 860 } });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
    page = await ctx.newPage();
    check = watchErrors(page);
  });
  test.afterAll(async () => {
    await ctx.close();
  });
  test.afterEach(() => check());

  test("kayıt ve karşılama akışı", async () => {
    await signup(page, "Ayşe Yılmaz", `ayse.${stamp}@example.com`);
    await expect(page).toHaveURL(/\/baslangic$/);
    await expect(page.getByRole("heading", { name: "Sana nasıl hitap edelim?" })).toBeVisible();
    await expect(page.getByLabel("Ad soyad", { exact: true })).toHaveValue("Ayşe Yılmaz");
    await page.getByRole("button", { name: "Devam et" }).click();

    await expect(page.getByRole("heading", { name: "Ekibine bir isim ver" })).toBeVisible();
    await page.getByLabel("Çalışma alanı adı").fill("Kuzey Ajans");
    await page.getByRole("button", { name: "Ajans" }).click();
    await page.screenshot({ path: `${SHOTS}/01-onboarding.png` });
    await page.getByRole("button", { name: "Devam et" }).click();

    await expect(page.getByRole("heading", { name: "Ekip arkadaşlarını davet et" })).toBeVisible();
    const code = page.locator("code");
    await expect(code).toContainText("/davet/");
    inviteUrl = (await code.textContent())!.trim();
    await page.getByRole("button", { name: "Başla" }).click();

    await expect(page).toHaveURL(/\/w\/kuzey-ajans/);
    slug = new URL(page.url()).pathname.split("/")[2]!;
    await expect(page.getByText("Çalışma alanın hazır.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ayşe");
    await page.screenshot({ path: `${SHOTS}/02-home-empty.png` });
  });

  test("Türkçe hızlı ekleme: tarih, saat, öncelik ayrıştırılır", async () => {
    const input = page.getByRole("textbox", { name: "Hızlı görev ekle" });
    await input.fill("Yarın 14'te raporu bitir !!");
    // Live preview chips
    await expect(page.getByText("Yarın 14:00")).toBeVisible();
    await expect(page.getByText("Yüksek", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-quick-add-preview.png` });
    await input.press("Enter");
    await expect(page.getByText("Görev eklendi")).toBeVisible();
    await expect(input).toHaveValue("");

    await quickAdd(page, "Bugün müşteriyi ara");
    await quickAdd(page, "Faturaları kontrol et");

    const today = page.getByRole("region", { name: "Bugün" });
    await expect(today.getByText("Müşteriyi ara")).toBeVisible();
    const upcoming = page.getByRole("region", { name: "Önümüzdeki günler" });
    await expect(upcoming.getByText("Raporu bitir")).toBeVisible();
    await expect(upcoming.getByText("Yarın 14:00")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-home-tasks.png` });
  });

  test("tamamla ve geri al", async () => {
    const row = page.getByRole("region", { name: "Bugün" }).locator("[data-task-id]").filter({ hasText: "Müşteriyi ara" });
    await row.getByRole("checkbox").click();
    await expect(page.getByText("Görev tamamlandı")).toBeVisible();
    await expect(page.getByRole("region", { name: "Bugün" })).toHaveCount(0);
    await page.getByRole("button", { name: "Geri al" }).click();
    await expect(page.getByRole("region", { name: "Bugün" }).getByText("Müşteriyi ara")).toBeVisible();
  });

  test("proje oluştur, satır içi görev ekle, panelde düzenle", async () => {
    await page.getByRole("button", { name: "Yeni proje" }).first().click();
    await page.getByLabel("Proje adı").fill("Web sitesi");
    await page.getByRole("button", { name: "Projeyi oluştur" }).click();
    await expect(page).toHaveURL(new RegExp(`/w/${slug}/projeler/`));
    await expect(page.getByRole("heading", { name: "Web sitesi" })).toBeVisible();
    await expect(page.getByText("Bu proje henüz boş")).toBeVisible();

    await quickAdd(page, "Ana sayfa tasarımı");
    await quickAdd(page, "İletişim formu cuma");
    await expect(page.getByRole("region", { name: "Yapılacak" }).locator("[data-task-id]")).toHaveCount(2);

    await page.getByText("Ana sayfa tasarımı").click();
    await expect(page).toHaveURL(/gorev=/);
    const panel = page.getByRole("dialog");
    const title = panel.getByRole("textbox", { name: "Görev başlığı" });
    await expect(title).toHaveValue("Ana sayfa tasarımı");
    await title.fill("Ana sayfa tasarımı v2");
    await title.press("Enter");

    await panel.getByPlaceholder("Alt görev ekle").fill("Renk paleti");
    await panel.getByPlaceholder("Alt görev ekle").press("Enter");
    await panel.getByPlaceholder("Madde ekle").fill("Logo dosyaları");
    await panel.getByPlaceholder("Madde ekle").press("Enter");
    await expect(panel.getByText("Renk paleti")).toBeVisible();
    await expect(panel.getByText("Logo dosyaları")).toBeVisible();

    await panel.getByRole("button", { name: "Normal" }).click();
    await page.getByRole("button", { name: "Acil" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/05-task-panel.png` });

    // Survives a reload (URL state + persisted data)
    await page.reload();
    const panel2 = page.getByRole("dialog");
    await expect(panel2.getByRole("textbox", { name: "Görev başlığı" })).toHaveValue("Ana sayfa tasarımı v2");
    await expect(panel2.getByText("Renk paleti")).toBeVisible();
    await expect(panel2.getByText("Logo dosyaları")).toBeVisible();
    await expect(panel2.getByRole("button", { name: "Acil" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/gorev=/);
    const row = page.locator("[data-task-id]").filter({ hasText: "Ana sayfa tasarımı v2" });
    await expect(row).toContainText("0/1");
  });

  test("pano görünümü ve sürükle-bırak ile durum değiştirme", async () => {
    await page.getByRole("tab", { name: "Pano" }).click();
    await expect(page).toHaveURL(/gorunum=pano/);
    const todo = page.getByRole("region", { name: "Yapılacak" });
    const doing = page.getByRole("region", { name: "Devam ediyor" });
    await expect(todo.getByText("İletişim formu")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/06-board.png` });

    const card = todo.locator("[data-task-id]").filter({ hasText: "İletişim formu" });
    const from = (await card.boundingBox())!;
    const to = (await doing.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 4 });
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 12 });
    await page.mouse.up();
    await expect(doing.getByText("İletişim formu")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Devam ediyor" }).getByText("İletişim formu")).toBeVisible();
    await page.getByRole("tab", { name: "Liste" }).click();
  });

  test("filtreler URL'de tutulur", async () => {
    await page.getByRole("button", { name: "Öncelik" }).click();
    await page.getByRole("menuitem", { name: "Yüksek ve acil" }).click();
    await expect(page).toHaveURL(/oncelik=yuksek|oncelik=high/);
    await expect(page.locator("[data-task-id]")).toHaveCount(1);
    await page.getByRole("button", { name: "Filtreleri temizle" }).first().click();
    await expect(page.locator("[data-task-id]")).toHaveCount(2);
  });

  test("komut menüsü ile arama", async () => {
    await page.keyboard.press("Control+k");
    const box = page.getByPlaceholder("Görev, proje veya kişi ara…");
    await box.fill("rapor");
    await expect(page.getByRole("option").filter({ hasText: "Raporu bitir" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/07-command.png` });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/gorev=/);
    await expect(page.getByRole("dialog").getByRole("textbox", { name: "Görev başlığı" })).toHaveValue("Raporu bitir");
    await page.keyboard.press("Escape");
  });

  test("sil ve geri al", async () => {
    await page.goto(`/w/${slug}/gorevlerim?sekme=yaklasan`);
    await page.getByText("Faturaları kontrol et").click();
    await page.getByRole("button", { name: "Görev işlemleri" }).click();
    await page.getByRole("menuitem", { name: "Görevi sil" }).click();
    await expect(page.getByText("Görev silindi")).toBeVisible();
    await expect(page.locator("[data-task-id]").filter({ hasText: "Faturaları kontrol et" })).toHaveCount(0);
    await page.getByRole("button", { name: "Geri al" }).click();
    await expect(page.getByText("Görev geri alındı")).toBeVisible();
    await expect(page.locator("[data-task-id]").filter({ hasText: "Faturaları kontrol et" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/08-my-tasks.png` });
  });

  test("davet edilen ekip arkadaşı katılır ve iş devredilir", async ({ browser }) => {
    const mctx = await browser.newContext({ locale: "tr-TR", timezoneId: "Europe/Istanbul" });
    const mpage = await mctx.newPage();
    const mcheck = watchErrors(mpage);
    const path = new URL(inviteUrl).pathname;
    await mpage.goto(path);
    await expect(mpage.getByText("Daveti kabul etmek için giriş yap")).toBeVisible();
    await mpage.getByRole("link", { name: "Hesap oluştur" }).click();
    await signup(mpage, "Mehmet Kaya", `mehmet.${stamp}@example.com`, path);
    await expect(mpage).toHaveURL(new RegExp(path));
    await expect(mpage.getByRole("heading", { name: "Kuzey Ajans ekibine davet edildin" })).toBeVisible();
    await mpage.screenshot({ path: `${SHOTS}/09-invite.png` });
    await mpage.getByRole("button", { name: "Ekibe katıl" }).click();
    await expect(mpage).toHaveURL(new RegExp(`/w/${slug}$`));
    await expect(mpage.getByRole("complementary").getByRole("link", { name: "Web sitesi" })).toBeVisible();

    // Ayşe delegates with a causative verb: the parser assigns Mehmet and normalises the verb.
    await page.goto(`/w/${slug}`);
    await page.getByRole("textbox", { name: "Hızlı görev ekle" }).fill("Cuma Mehmet'e logoyu tasarlat");
    await expect(page.getByText("Mehmet Kaya")).toBeVisible();
    // Delegation never lands in the private personal project: the only team project is picked.
    await expect(page.getByRole("button", { name: "Web sitesi" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/09b-delegate-preview.png` });
    await page.getByRole("textbox", { name: "Hızlı görev ekle" }).press("Enter");
    await expect(page.getByText("Görev Web sitesi projesine eklendi")).toBeVisible();

    await mpage.goto(`/w/${slug}/gorevlerim?sekme=yaklasan`);
    await expect(mpage.locator("[data-task-id]").filter({ hasText: "Logoyu tasarla" })).toBeVisible();
    await mpage.screenshot({ path: `${SHOTS}/10-teammate-tasks.png` });
    mcheck();
    await mctx.close();
  });

  test("ayarlar: kullanım ve davet linkleri", async () => {
    await page.goto(`/w/${slug}/ayarlar`);
    await expect(page.getByText("2 / 5")).toBeVisible();
    await expect(page.getByText("Mehmet Kaya")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/11-settings.png`, fullPage: true });
  });

  test("koyu tema ve klavye kısayolları", async () => {
    await page.goto(`/w/${slug}/gorevlerim`);
    await page.keyboard.press("?");
    await expect(page.getByRole("heading", { name: "Klavye kısayolları" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("g");
    await page.keyboard.press("p");
    await expect(page).toHaveURL(new RegExp(`/w/${slug}/projeler$`));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`/w/${slug}`);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({ path: `${SHOTS}/12-home-dark.png` });
  });
});

test("oturum yokken korumalı sayfa girişe yönlendirir ve geri döner", async ({ page }) => {
  const check = watchErrors(page);
  await page.goto("/w/kuzey-ajans/gorevlerim");
  await expect(page).toHaveURL(/\/giris\?next=/);
  await page.getByLabel("E-posta", { exact: true }).fill("yok@example.com");
  await page.getByLabel("Şifre", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByText("E-posta ya da şifre hatalı.")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/00-login-error.png` });
  check();
});

test("Google ile gelen kullanıcı koşulları onaylamadan devam edemez (KVKK)", async ({ page }) => {
  const check = watchErrors(page);
  const email = `oauth.${Date.now()}@example.com`;
  // Simulates an OAuth sign-up: the auth user exists without our sign-up form's consent flag.
  const { execSync } = await import("node:child_process");
  execSync(
    `psql postgres://postgres:postgres@127.0.0.1:5432/app_e2e -c "insert into auth.users (email, raw_user_meta_data) values ('${email}', '{\\"name\\":\\"Ece Gür\\"}')"`,
  );
  await page.goto("/giris");
  await page.getByLabel("E-posta", { exact: true }).fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill("herhangi-bir-sifre");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/baslangic$/);
  await expect(page.getByLabel("Ad soyad", { exact: true })).toHaveValue("Ece Gür");
  await page.getByRole("button", { name: "Devam et" }).click();
  await expect(page.getByText("Devam etmek için onay vermen gerekiyor.")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Devam et" }).click();
  await expect(page.getByRole("heading", { name: "Ekibine bir isim ver" })).toBeVisible();
  check();
});

test("arşivlenmiş projede görev paneli salt okunur", async ({ page }) => {
  const check = watchErrors(page);
  await signup(page, "Arşiv Testçi", `arsiv.${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByLabel("Çalışma alanı adı").fill("Arşiv Ekibi");
  await page.getByRole("button", { name: "Devam et" }).click();
  await page.getByRole("button", { name: "Başla" }).click();
  await page.getByRole("button", { name: "Yeni proje" }).first().click();
  await page.getByLabel("Proje adı").fill("Eski kampanya");
  await page.getByRole("button", { name: "Projeyi oluştur" }).click();
  await expect(page.getByRole("heading", { name: "Eski kampanya" })).toBeVisible();
  await quickAdd(page, "Afişi bas");
  await expect(page.locator("[data-task-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "Proje ayarları" }).click();
  await page.getByRole("button", { name: "Projeyi arşivle" }).click();
  await expect(page.getByText("Proje arşivlendi")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Bu proje arşivde. Görevler salt okunur.").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Hızlı görev ekle" })).toHaveCount(0);
  await page.getByText("Afişi bas").click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Bu proje arşivde. Görevler salt okunur.")).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "Görev başlığı" })).toHaveAttribute("readonly", "");
  await expect(panel.getByRole("checkbox").first()).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/13-archived-panel.png` });
  check();
});
