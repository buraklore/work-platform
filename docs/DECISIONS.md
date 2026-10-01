# Kararlar

1. **RLS rolü `app_user`, `authenticated` değil.** Uygulama Supabase'in Data API'sini kullanmaz; doğrudan Postgres'e
   bağlanır ve her istekte `set_config('role','app_user')` + `request.jwt.claims` ayarlar. `anon`/`authenticated`
   rollerinin public şemadaki yetkileri kaldırıldı, böylece anon anahtarla REST üzerinden veri sızamaz.
   `app.uid()` claim'i `request.jwt.claims`'ten okur.
2. **Yumuşak silme RLS'te filtrelenmez.** Silinen satırlar sorgularda `deleted_at is null` ile gizlenir; böylece
   "Geri al" aynı yetkiyle çalışır. 30 gün sonra cron kalıcı siler.
3. **Arama:** `pg_trgm` + `tr_normalize` (Türkçe harf katlama) ile alt dizgi araması. Tam metin arama M2+ (Türkçe kök bulma sorunlu).
4. **Tetikleyici sırası:** aynı olaydaki tetikleyiciler alfabetik çalışır → `t10_*` (workspace_id miras), `t20_*` (korumalar).
5. **Rate limit:** Upstash sliding window. Üretim sunucusu Upstash olmadan açılmaz; geliştirmede limit kapalıdır ve bir kez uyarılır.
6. **Migration'lar `supabase db push` ile;** yerelde/CI'da `scripts/db-migrate.ts` + `tests/setup/supabase-shim.sql`.
7. **Pozisyonlar** fractional-indexing anahtarı (`collate "C"`); anahtar çok uzarsa grup yeniden dengelenir.
8. **Atanan kişi görevi görebilmelidir** (DB tetikleyicisi, `app.project_access_of`). Kişisel proje yalnızca sahibine,
   özel proje yalnızca erişimi olanlara atanabilir. Erişim kaybedilince atamalar silinir. Hızlı ekleme başkasına iş verilince
   ekip projesi seçer/seçtirir ve projeyi göremeyen kişiyi önceden uyarır. Gerekçe: atanmış ama görünmeyen iş, kayıp iştir.
9. **Görev paneli URL durumudur** (`?gorev=<id>`), filtreler de URL'de (`atanan`, `tarih`, `oncelik`, `q`), görünüm `gorunum=liste|pano`.
10. **E-posta linkleri `token_hash`** ile `/auth/confirm`'e gider (PKCE değil): link başka cihazda açılsa da çalışır.
11. **Yasal metinler uydurulmadı.** Sayfalar "hazırlanıyor" der; hukukçu metni M3'te.
12. **Satırlar çalışma alanı değiştiremez** — görev, durum, üye, etiket, kontrol listesi; hem doğrudan `workspace_id` güncellemesi
    hem de başka alandaki projeye taşıma veritabanında reddedilir (uygulama hatası olsa bile kiracı sızıntısı olmaz).
13. **Misafirler** bir projede en fazla düzenleyici olur; yalnızca ortak projede çalıştıkları kişilerin profilini görür.
14. **KVKK onayı** kayıt formunda Supabase meta verisiyle (`terms_accepted`) atomik olarak `terms_accepted_at`'e yazılır;
    OAuth kullanıcıları ilk karşılamada ya da davet kabulünde onaylar. Magic link yalnızca mevcut hesaplar içindir.
15. **Arşivlenmiş proje salt okunurdur**; geri getirmek (arşivden çıkarma / silmeyi geri alma) plan limitine tabidir.
16. **Auth rate limit iki katmanlı:** IP başına 30/dk (ofisler tek IP paylaşır) + e-posta başına 5/dk (asıl kaba kuvvet koruması).
