# İlerleme

## M1 — tamamlandı (1 Ekim 2026)

**Doğrulama durumu (tam sistem denetiminden sonra)**
- TypeScript strict: 0 hata · ESLint: 0 bulgu · kullanılan her çeviri anahtarı mevcut
- Birim: 105/105 (ayrıştırıcı + fuzz, i18n eşliği, yönlendirme güvenliği, iyimser önbellek)
- Entegrasyon (gerçek Postgres 16 + RLS): 57/57
- `next build`: başarılı
- Yerel uçtan uca (üretim derlemesi + Postgres + sahte Supabase Auth + Chromium, masaüstü + mobil): 29/29, hiç konsol hatası yok

**Uçtan uca bulunup düzeltilenler**
- Başkasına verilen görev, gönderenin özel "Kişisel" projesine düşüyor ve atanan kişi göremiyordu →
  migration `…0400_personal_assignees.sql` (DB kuralı) + hızlı eklemede ekip projesi seçimi.
- E-posta doğrulamalı kayıtta davet linki kayboluyordu (`{{ .RedirectTo }}` tam URL) → `nextFromRedirect`.
- Kök sayfa derlemede statik üretilmeye çalışılıyordu; giriş formları sunucuda render edilmiyordu;
  başlıkta Escape ile iptal edince yine kaydediliyordu; seçili satırda görünür kaydırma şeridi; panoda öncelik bayrağı yoktu.

**Tam sistem denetimi (1 Ekim 2026) — bulunan ve düzeltilenler** (`tests/integration/audit.test.ts`, migration `…0500_audit_fixes.sql`)
- Kiracı izolasyonu: görevin `workspace_id`'si doğrudan SQL ile başka alana yazılabiliyordu → veritabanı artık hiçbir satırın alan değiştirmesine izin vermiyor.
- Görünmez atamalar: atanan kişi görevi göremiyorsa (özel proje, misafir) atama artık reddediliyor; erişim kaybında (projeden çıkarma, özele çekme, rol düşürme) atamalar temizleniyor.
- Misafir proje yöneticisi olamıyor; misafir ortak projesi olmayan üyelerin profilini/e-postasını göremiyor.
- KVKK: koşul kabulü `profiles.terms_accepted_at` olarak kaydediliyor; magic link artık hesap açmıyor; Google kullanıcıları karşılamada/davette onay veriyor.
- Plan limitleri: arşivden çıkarma, proje geri alma ve görev geri alma limitlere tabi.
- Arşivlenmiş proje gerçekten salt okunur (sunucu + panel); silinmiş görev açılmıyor.
- Giriş limiti: IP başına 30/dk + e-posta başına 5/dk (ofis ağları kilitlenmesin); çıkış limitsiz.
- Google profil fotoğrafı ve e-posta değişikliği profile yansıyor; tema tercihi cihazlar arası taşınıyor.
- 7 hata kodunun eksik Türkçe metni; sürükleme kapalıyken satırların ekran okuyucuda "devre dışı" okunması; boş durum metni.

**İkinci tam denetim (satır satır, 142 dosya)** — 57 ek bulgu düzeltildi; ayrıntı ve kanıtlar `docs/AUDIT.md`.
Öne çıkanlar: açıklama kaybı, sonsuz iskelet, geri tuşunun paneli yeniden açması, eklendiği ekranda görünmeyen görevler,
çalışma alanından üye çıkarma / ayrılma / rol değiştirme (yeni), davetle katılanın kendi alanını açabilmesi (yeni),
mobilde alan değiştirme, boş projede pano, özele çevirme onayı, komut menüsünde Türkçe arama, klavye ve ekran okuyucu düzeltmeleri.

**Doğrulanmamış (gerçek Supabase projesi gerektirir)**
- Google OAuth, gerçek e-posta gönderimi ve şablonlar, Supabase'in gerçek JWT (JWKS) doğrulaması,
  pooler (6543) altında performans, pg_cron çağrısı, Vercel dağıtımı. Sahte auth yalnızca HTTP sözleşmesini taklit eder.
