# PROJECT — Türkçe iş ve proje yönetimi

Türk ekipleri için Asana/Trello alternatifi. İsim henüz belli değil (`NEXT_PUBLIC_PRODUCT_NAME`).
Bu depo **M1** aşamasını içerir: hesaplar, çalışma alanları, davet linki, projeler, görevler
(liste + pano), Türkçe doğal dil ile hızlı ekleme, Görevlerim, arama, ayarlar.

**Yığın:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind 4 ·
Supabase (Auth + Postgres, RLS) · Drizzle · TanStack Query · dnd-kit · Tiptap · next-intl · Upstash.

## Hızlı başlangıç (yerel)

```bash
pnpm install
cp .env.example .env.local          # değerleri doldur
pnpm db:migrate                     # migration'ları DATABASE_URL'e uygular
pnpm dev
```

Supabase olmadan tüm uygulamayı yerelde uçtan uca çalıştırmak için `tests/e2e-local/README.md`.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `pnpm verify` | typecheck + lint + birim testleri + i18n anahtar kontrolü |
| `pnpm test` | birim testleri (Türkçe ayrıştırıcı, i18n eşliği, yönlendirme güvenliği) |
| `pnpm test:integration` | gerçek Postgres'e karşı RLS / servis testleri (yerel PG gerekir) |
| `pnpm build` | üretim derlemesi |
| `pnpm db:migrate` | `supabase/migrations/*.sql` dosyalarını sırayla uygular |

## Üretime alma

### 1. Supabase
1. Yeni proje aç (bölge: Frankfurt `eu-central-1`, KVKK için AB'de kalsın).
2. Migration'ları uygula: `supabase link` + `supabase db push` (ya da SQL Editor'da sırayla çalıştır).
3. **Authentication → URL Configuration:** Site URL = `NEXT_PUBLIC_APP_URL`;
   Redirect URL'lere `https://ALANADI/auth/callback` ve `https://ALANADI/auth/confirm` ekle.
4. **Authentication → Email Templates:** `supabase/templates/` altındaki üç şablonu yapıştır
   (doğrulama, magic link, şifre sıfırlama). Bunlar `token_hash` kullanır; link farklı cihazda açılsa da çalışır.
5. **Authentication → Providers → Google:** Google Cloud Console'da OAuth istemcisi oluştur,
   yetkili yönlendirme URI'si `https://<proje>.supabase.co/auth/v1/callback`. Client ID/secret'ı Supabase'e gir.
6. Ayarlar → Database → Connection string → **Transaction pooler (6543)** adresini `DATABASE_URL` yap.

### 2. Upstash
Redis veritabanı aç (bölge Frankfurt), REST URL ve token'ı env'e koy. Üretim sunucusu bunlar olmadan açılmaz.

### 3. Vercel
Depoyu bağla, env değişkenlerini gir (Production + Preview), bölge `fra1`. `CRON_SECRET` üret: `openssl rand -hex 32`.

### 4. Günlük temizlik (30 gün sonra kalıcı silme)
Supabase SQL Editor'da (pg_cron + pg_net eklentilerini aç):

```sql
select cron.schedule('purge-daily', '15 3 * * *', $$
  select net.http_post(
    url := 'https://ALANADI/api/cron/purge',
    headers := jsonb_build_object('Authorization', 'Bearer CRON_SECRET_DEGERI')
  );
$$);
```

## Yasal
`/yasal/kvkk` ve `/yasal/kullanim-kosullari` sayfaları şimdilik "hazırlanıyor" der. Yayından önce
bir hukukçunun metni yazması gerekir (M3). Uydurma hukuki metin bilerek konmadı.
