# Yerel uçtan uca test (Supabase gerekmez)

Üretim derlemesini gerçek Postgres ve **sahte** Supabase Auth/Upstash ile Chromium'da çalıştırır.
Sahte auth (`fake-auth.mjs`) yalnızca supabase-js'in çağırdığı uç noktaları taklit eder; her şifreyi kabul eder.
**Yalnızca yerel test içindir.**

```bash
# 1) Postgres 16 çalışıyor olmalı (postgres/postgres@localhost:5432)
pnpm exec playwright install chromium
# 2) Boş test veritabanı (app_e2e) + migration'lar
pnpm exec tsx tests/e2e-local/reset-db.ts
# 3) Bu ortamla derle ve başlat
. tests/e2e-local/env.sh && pnpm build
sh tests/e2e-local/start.sh
# 4) Çalıştır (ekran görüntüleri: /tmp/e2e-shots)
pnpm exec playwright test -c tests/e2e-local/playwright.config.ts
sh tests/e2e-local/stop.sh
```

Senaryolar: kayıt → karşılama → Türkçe hızlı ekleme → tamamla/geri al → proje + panel düzenleme (yenilemede kalıcı)
→ pano sürükle-bırak → URL filtreleri → Cmd+K → sil/geri al → davetle katılım + iş devretme → ayarlar → koyu tema/kısayollar
→ oturumsuz yönlendirme → mobil (alt menü, FAB, tam ekran panel, kaydırarak tamamlama). Her test konsol hatasında da düşer.
