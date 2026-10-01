# WorkPlatform

**A fast, Turkish-first task and project management app for teams.**
Capture work in plain Turkish, organise it in projects as a list or a board, share it with your team — and keep everyone's data separated and safe.

[English](#english) · [Türkçe](#türkçe)

---

<a id="english"></a>

## English

### What is it?

WorkPlatform is an open-source web app where a team keeps track of who does what, and by when.
You create a **workspace** for your team, add **projects**, and fill them with **tasks** — each with an owner, a due date, a priority, subtasks and a checklist. Everyone gets a personal **My Tasks** view of what is on their plate today and this week.

What makes it different is the **quick-add bar**: type a sentence the way you would say it, and it becomes a structured task.

> `Yarın 14'te Ayşe'ye raporu hazırlat !!`
> → task **"Raporu hazırla"**, assigned to **Ayşe**, due **tomorrow 14:00**, **high priority**

Dates ("cuma", "haftaya salı", "15 ekim"), times ("14'te", "akşam"), people (including Turkish suffixes like *-ye / -ya*, and causative verbs like *hazırlat* → *hazırla*), projects (`#web`) and priority (`!!`) are recognised and highlighted live while you type. Anything recognised can be dismissed with one click.

The interface is in **Turkish**. An English message file is included and kept in sync, so the app can be translated easily.

### Features

**Capture and organise**
- Natural-language quick add in Turkish, with live highlighting and suggestion chips
- Projects with a **list** view and a **board** view, drag and drop between statuses
- Custom statuses per project (rename, reorder, recolour, choose their type)
- Subtasks, checklists, labels, priority, due date with optional time, rich-text description
- Home page with overdue / today / upcoming / unscheduled work, and a **My Tasks** page with tabs

**Teams**
- Workspaces with roles: owner, admin, member, guest
- Join with an invite link (expiry and single-use options)
- Team-wide or private projects, project-level roles (admin / editor / viewer)
- Remove members, change roles, leave a workspace, create your own workspace
- Free-plan limits are enforced in the database (members, guests, projects, active tasks)

**Everyday comfort**
- Command menu (Ctrl/⌘ + K) to search tasks, projects and people, and to run actions
- Keyboard shortcuts (j/k to move, Enter to open, x to complete, g h / g m / g p to navigate, ? for help)
- Undo for completing, deleting and moving tasks
- Light and dark theme; works on phones (bottom navigation, full-screen task panel, swipe to complete)
- Filters and the open task live in the URL, so a view can be shared or refreshed

**Safety and privacy**
- Every database query runs under PostgreSQL **Row Level Security** as the signed-in user; a bug in the app cannot read another team's data
- Assignees must be able to see the task; rows can never move between workspaces (enforced in the database)
- Terms / privacy-notice consent is recorded at sign-up
- Deleted items can be restored for 30 days, then they are purged by a daily job
- Rate limiting on sign-in, sign-up and the API

### Tech stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Supabase (Auth + PostgreSQL) · Drizzle ORM · TanStack Query · dnd-kit · Tiptap · next-intl · Upstash Redis (rate limiting) · Vitest · Playwright

### Getting started

You need: **Node.js 22**, **pnpm 9**, and free accounts on **Supabase**, **Upstash** and **Vercel**.

#### 1. Supabase

1. Create a project (choose a region close to your users).
2. Open **SQL Editor** and run the files in `supabase/migrations/` **one by one, in filename order** (`…0100` → `…0600`). Each should end with *Success*.
   Do **not** run `tests/setup/supabase-shim.sql` — it only emulates Supabase for local tests.
3. **Authentication → URL Configuration**
   - Site URL: `https://your-domain`
   - Redirect URLs: `https://your-domain/auth/callback` and `https://your-domain/auth/confirm`
4. **Authentication → Email Templates**: paste the three templates from `supabase/templates/` (confirm sign-up, magic link, reset password).
5. Collect:
   - **Project URL**
   - **anon** key (or **publishable** key) — copy it with the copy button in *Project Settings → API Keys*; never use the service-role / secret key
   - the **Transaction pooler** connection string (port **6543**) from *Connect → Connection string*, with your database password filled in

For quick private testing you can turn off *Confirm email*, sign up, then turn off *Allow new users to sign up*.
For real users, configure your own SMTP provider in Supabase — the built-in mailer only sends a few emails per hour.

#### 2. Upstash

Create a Redis database and copy the **REST URL** and the **standard REST token**.
⚠️ Do not use the *read-only* token: rate limiting needs to write, and every sign-in would fail.

#### 3. Environment variables

| Name | Value |
|---|---|
| `NEXT_PUBLIC_PRODUCT_NAME` | The name shown in the app |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
| `DATABASE_URL` | Transaction pooler connection string (port 6543) |
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL (`https://….upstash.io`) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token (not read-only) |
| `CRON_SECRET` | Any random string of 32+ letters and digits |
| `DB_POOL_MAX` | Optional, default `3` |

Enter only the value in each field (no `NAME=` prefix, no quotes). In production the server refuses to start if a required variable is missing.

#### 4. Deploy to Vercel

Import the repository, add the variables above, and deploy. Variables starting with `NEXT_PUBLIC_` are built into the app: after changing any variable, **redeploy**.

#### 5. Daily clean-up (optional but recommended)

Enable the `pg_cron` and `pg_net` extensions in Supabase and schedule the purge endpoint:

```sql
select cron.schedule('purge-daily', '15 3 * * *', $$
  select net.http_post(
    url := 'https://your-domain/api/cron/purge',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
$$);
```

#### Google sign-in (optional)

Create an OAuth client (Web) in Google Cloud with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, then enable Google under **Authentication → Providers** in Supabase.

### Local development

```bash
pnpm install
cp .env.example .env.local   # fill in your values
pnpm dev                     # http://localhost:3000
```

Without Upstash values, rate limiting is off in development.

| Command | What it does |
|---|---|
| `pnpm verify` | Type check, lint, unit tests and translation-key check |
| `pnpm test` | Unit tests (Turkish parser, translations, cache, redirects) |
| `pnpm test:integration` | Security and service tests against a real PostgreSQL 16 (`postgres:postgres@localhost:5432`) |
| `pnpm test:e2e-local` | Browser tests against a production build — see `tests/e2e-local/README.md` (no Supabase needed) |
| `pnpm build` | Production build |
| `pnpm db:migrate` | Apply `supabase/migrations/*.sql` to `DATABASE_URL` |

### Project layout

```
src/app            pages and API routes (/api/v1/…)
src/features       feature modules (tasks, projects, workspaces, members, auth, …)
src/lib            database access, Turkish NLP parser, dates, security, i18n helpers
src/messages       tr.json / en.json
supabase           SQL migrations (schema, RLS policies, triggers) and email templates
tests              unit, integration and end-to-end tests
docs               decisions, progress notes and audit log
```

Contributor rules (database access, Turkish casing, translations, migrations) are in `CLAUDE.md`; design decisions are in `docs/DECISIONS.md`.

### Status

Early stage. The core — accounts, workspaces, invites, projects, tasks, search — is complete and covered by tests. Not included yet: email invitations, comments and mentions, notifications, calendar view, file attachments, recurring tasks, billing. The legal pages (`/yasal/…`) are placeholders and must be replaced with your own texts before you accept real users.

### Contributing

Issues and pull requests are welcome. Please run `pnpm verify` (and the integration tests if you touch the database) before opening a pull request.

### License

See [LICENSE](LICENSE).

---

<a id="türkçe"></a>

## Türkçe

### Bu nedir?

WorkPlatform, bir ekibin kimin neyi ne zamana kadar yapacağını takip ettiği açık kaynaklı bir web uygulamasıdır.
Ekibin için bir **çalışma alanı** açarsın, **projeler** eklersin ve bunları **görevlerle** doldurursun. Her görevin bir sorumlusu, son tarihi, önceliği, alt görevleri ve kontrol listesi olur. Herkes kendi **Görevlerim** ekranında bugün ve bu hafta önünde ne olduğunu görür.

Onu farklı kılan şey **hızlı ekleme çubuğu**: cümleyi konuşur gibi yazarsın, düzenli bir göreve dönüşür.

> `Yarın 14'te Ayşe'ye raporu hazırlat !!`
> → **"Raporu hazırla"** görevi, **Ayşe**'ye atanmış, **yarın 14:00**, **yüksek öncelik**

Tarihler ("cuma", "haftaya salı", "15 ekim"), saatler ("14'te", "akşam"), kişiler (*-ye / -ya* gibi ekler ve *hazırlat* → *hazırla* gibi ettirgen fiillerle birlikte), projeler (`#web`) ve öncelik (`!!`) yazarken tanınır ve renklendirilir. Tanınan her parça tek tıkla yok sayılabilir.

Arayüz **Türkçedir**. İngilizce çeviri dosyası da projede bulunur ve Türkçeyle eşit tutulur; uygulama kolayca başka dile çevrilebilir.

### Özellikler

**Yakala ve düzenle**
- Türkçe doğal dille hızlı ekleme, canlı renklendirme ve öneri çipleri
- **Liste** ve **pano** görünümlü projeler, durumlar arasında sürükle-bırak
- Projeye özel durumlar (yeniden adlandırma, sıralama, renk, tür)
- Alt görevler, kontrol listeleri, etiketler, öncelik, isteğe bağlı saatli son tarih, zengin metin açıklama
- Gecikenler / bugün / yaklaşanlar / tarihsizler ile ana sayfa ve sekmeli **Görevlerim** sayfası

**Ekipler**
- Rollere sahip çalışma alanları: sahip, yönetici, üye, misafir
- Davet linkiyle katılım (süre ve tek kullanımlık seçenekleri)
- Tüm ekibe açık ya da özel projeler, proje düzeyinde roller (yönetici / düzenleyici / görüntüleyici)
- Üye çıkarma, rol değiştirme, alandan ayrılma, kendi alanını açma
- Ücretsiz plan limitleri veritabanında uygulanır (üye, misafir, proje, aktif görev)

**Günlük kullanım**
- Görev, proje ve kişi aramak, komut çalıştırmak için komut menüsü (Ctrl/⌘ + K)
- Klavye kısayolları (j/k ile gezinme, Enter ile açma, x ile tamamlama, g h / g m / g p ile sayfalar arası geçiş, ? ile yardım)
- Tamamlama, silme ve taşımada geri alma
- Açık ve koyu tema; telefonda tam uyumlu (alt menü, tam ekran görev paneli, kaydırarak tamamlama)
- Filtreler ve açık görev URL'de tutulur; görünüm paylaşılabilir, yenilenince kaybolmaz

**Güvenlik ve gizlilik**
- Her veritabanı sorgusu, giriş yapmış kullanıcı adına PostgreSQL **satır düzeyi güvenlik (RLS)** altında çalışır; uygulamadaki bir hata başka bir ekibin verisini okuyamaz
- Atanan kişi görevi görebilmek zorundadır; kayıtlar çalışma alanları arasında taşınamaz (veritabanında zorunlu)
- Kullanım koşulları / KVKK aydınlatma onayı kayıtta saklanır
- Silinenler 30 gün geri alınabilir, sonra günlük bir işle kalıcı olarak silinir
- Giriş, kayıt ve API için hız sınırı

### Kullanılan teknolojiler

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Supabase (Auth + PostgreSQL) · Drizzle ORM · TanStack Query · dnd-kit · Tiptap · next-intl · Upstash Redis (hız sınırı) · Vitest · Playwright

### Kurulum

Gerekenler: **Node.js 22**, **pnpm 9** ve ücretsiz **Supabase**, **Upstash**, **Vercel** hesapları.

#### 1. Supabase

1. Bir proje aç (kullanıcılarına yakın bir bölge seç).
2. **SQL Editor**'ı aç ve `supabase/migrations/` içindeki dosyaları **dosya adı sırasıyla, tek tek** çalıştır (`…0100` → `…0600`). Her biri *Success* ile bitmeli.
   `tests/setup/supabase-shim.sql` dosyasını **çalıştırma** — yalnızca yerel testlerde Supabase'i taklit eder.
3. **Authentication → URL Configuration**
   - Site URL: `https://alan-adin`
   - Redirect URLs: `https://alan-adin/auth/callback` ve `https://alan-adin/auth/confirm`
4. **Authentication → Email Templates**: `supabase/templates/` içindeki üç şablonu yapıştır (kayıt doğrulama, giriş linki, şifre sıfırlama).
5. Şunları topla:
   - **Project URL**
   - **anon** anahtarı (ya da **publishable** anahtar) — *Project Settings → API Keys* sayfasındaki kopyala düğmesiyle al; service-role / secret anahtarı asla kullanma
   - *Connect → Connection string* bölümündeki **Transaction pooler** adresi (port **6543**), veritabanı şifren yerleştirilmiş haliyle

Yalnızca kendin test edeceksen *Confirm email*'i kapatabilir, kayıt olduktan sonra *Allow new users to sign up*'ı kapatabilirsin.
Gerçek kullanıcılar için Supabase'e kendi SMTP sağlayıcını bağla — yerleşik e-posta servisi saatte yalnızca birkaç e-posta gönderir.

#### 2. Upstash

Bir Redis veritabanı aç; **REST URL** ve **standart REST token** değerlerini kopyala.
⚠️ *Read-only* (salt okunur) token'ı kullanma: hız sınırının yazması gerekir, aksi halde her giriş denemesi hata verir.

#### 3. Ortam değişkenleri

| Ad | Değer |
|---|---|
| `NEXT_PUBLIC_PRODUCT_NAME` | Uygulamada görünecek ad |
| `NEXT_PUBLIC_APP_URL` | `https://alan-adin` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable anahtarı |
| `DATABASE_URL` | Transaction pooler bağlantı adresi (port 6543) |
| `UPSTASH_REDIS_REST_URL` | Upstash REST adresi (`https://….upstash.io`) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token'ı (salt okunur olmayan) |
| `CRON_SECRET` | En az 32 harf ve rakamdan oluşan rastgele bir değer |
| `DB_POOL_MAX` | İsteğe bağlı, varsayılan `3` |

Her alana yalnızca değeri yaz (başında `AD=` olmadan, tırnaksız). Üretimde zorunlu bir değişken eksikse sunucu bilerek açılmaz.

#### 4. Vercel'e yayınla

Depoyu içe aktar, yukarıdaki değişkenleri ekle ve yayınla. `NEXT_PUBLIC_` ile başlayan değişkenler derlemeye gömülür: herhangi bir değişkeni değiştirdikten sonra **Redeploy** yap.

#### 5. Günlük temizlik (isteğe bağlı ama önerilir)

Supabase'te `pg_cron` ve `pg_net` eklentilerini aç ve temizlik adresini zamanla:

```sql
select cron.schedule('purge-daily', '15 3 * * *', $$
  select net.http_post(
    url := 'https://alan-adin/api/cron/purge',
    headers := jsonb_build_object('Authorization', 'Bearer CRON_SECRET_DEGERIN')
  );
$$);
```

#### Google ile giriş (isteğe bağlı)

Google Cloud'da yönlendirme adresi `https://<proje-ref>.supabase.co/auth/v1/callback` olan bir OAuth istemcisi (Web) oluştur, ardından Supabase'te **Authentication → Providers** altında Google'ı etkinleştir.

### Yerelde geliştirme

```bash
pnpm install
cp .env.example .env.local   # değerlerini doldur
pnpm dev                     # http://localhost:3000
```

Upstash değerleri boşsa geliştirme modunda hız sınırı kapalıdır.

| Komut | Ne yapar |
|---|---|
| `pnpm verify` | Tip denetimi, lint, birim testleri ve çeviri anahtarı kontrolü |
| `pnpm test` | Birim testleri (Türkçe ayrıştırıcı, çeviriler, önbellek, yönlendirmeler) |
| `pnpm test:integration` | Gerçek PostgreSQL 16'ya karşı güvenlik ve servis testleri (`postgres:postgres@localhost:5432`) |
| `pnpm test:e2e-local` | Üretim derlemesine karşı tarayıcı testleri — bkz. `tests/e2e-local/README.md` (Supabase gerekmez) |
| `pnpm build` | Üretim derlemesi |
| `pnpm db:migrate` | `supabase/migrations/*.sql` dosyalarını `DATABASE_URL`'e uygular |

### Proje yapısı

```
src/app            sayfalar ve API rotaları (/api/v1/…)
src/features       özellik modülleri (görevler, projeler, çalışma alanları, üyeler, giriş, …)
src/lib            veritabanı erişimi, Türkçe dil ayrıştırıcı, tarihler, güvenlik, çeviri yardımcıları
src/messages       tr.json / en.json
supabase           SQL migration'ları (şema, RLS politikaları, tetikleyiciler) ve e-posta şablonları
tests              birim, entegrasyon ve uçtan uca testler
docs               kararlar, ilerleme notları ve denetim kaydı
```

Katkı kuralları (veritabanı erişimi, Türkçe büyük/küçük harf, çeviriler, migration'lar) `CLAUDE.md` içinde; tasarım kararları `docs/DECISIONS.md` içinde.

### Durum

Erken aşama. Çekirdek — hesaplar, çalışma alanları, davetler, projeler, görevler, arama — tamamlandı ve testlerle korunuyor. Henüz olmayanlar: e-postayla davet, yorumlar ve bahsetmeler, bildirimler, takvim görünümü, dosya ekleri, tekrarlayan görevler, ödeme. Yasal sayfalar (`/yasal/…`) yer tutucudur; gerçek kullanıcı kabul etmeden önce kendi metinlerinle değiştirilmelidir.

### Katkıda bulunma

Hata bildirimleri ve pull request'ler memnuniyetle karşılanır. Pull request açmadan önce `pnpm verify` (veritabanına dokunduysan entegrasyon testlerini de) çalıştır.

### Lisans

Bkz. [LICENSE](LICENSE).
