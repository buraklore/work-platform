@AGENTS.md

# Proje kuralları (Claude Code için)

Kullanıcı arayüzü Türkçe, kod ve yorumlar İngilizce. Önce `docs/PROGRESS.md` ve `docs/DECISIONS.md` oku.

## Değişmez kurallar
- **Veritabanı erişimi yalnızca `withUser(claims, fn)` ile.** Her istek `app_user` rolüne geçer ve RLS çalışır.
  `@/lib/db/client` ve `@/lib/db/admin` içe aktarımı ESLint ile yasak (istisna: `src/lib/db`, cron, testler).
- **Türkçe büyük/küçük harf:** `toLowerCase/toUpperCase` yasak. `toLocaleLowerCase("tr-TR")` ya da `src/lib/text/tr.ts`.
  Arama/eşleştirme için `trNormalize` (JS) = `public.tr_normalize` (SQL); eşlikleri testle korunur.
- **Tarihler İstanbul takviminde:** `src/lib/dates/tz.ts`. `dueDate` saf tarih (`YYYY-MM-DD`), saat ayrı alan.
- **Her metin `src/messages/tr.json` + `en.json`'da**, anahtar ve yer tutucular birebir (test: `tests/unit/i18n-parity.test.ts`,
  kullanılan her anahtar: `pnpm check:i18n`).
- **API rotaları `defineHandler`** ile: origin kontrolü → oturum → rate limit → zod → servis. Hata gövdesi `{ error: { code, message, details } }`.
- **Yeni tablo** = migration + RLS politikası + `schema.ts` + drift testi (tasks.test.ts → "no schema drift") güncellenir.
- Migration'lar yalnızca eklenir; yayınlanmış bir migration düzenlenmez. `app` şemasına eklenen ve uygulamanın çağırdığı
  fonksiyonlara `grant execute … to app_user` yazılır (tablolar için varsayılan yetkiler `…0500` ile ayarlı).
- Bir güvenlik/veri kuralı eklerken önce `tests/integration/audit.test.ts` tarzında kırmızı yanan bir test yazılır.
- Tetikleyici adları: `t10_*` workspace_id miras alır, `t20_*` korumalar (Postgres aynı olaydaki tetikleyicileri alfabetik çalıştırır).

## Bitti tanımı
`pnpm verify` yeşil, `pnpm test:integration` yeşil, `pnpm build` başarılı; arayüz değiştiyse
`tests/e2e-local` akışları yeşil ve hiç konsol hatası yok. Yapılan iş `docs/PROGRESS.md`'ye, verilen karar `docs/DECISIONS.md`'ye yazılır.
