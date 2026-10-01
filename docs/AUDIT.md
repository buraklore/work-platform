# Tam sistem denetimi — 2. tur

Her dosya satır satır okunur; her bulgu kanıtlanır (test ya da tarayıcı), düzeltilir ve burada kaydedilir.
Ek olarak: SQL migration'lar (H), tüm kullanıcı akışları tarayıcıda (I).

## Durum

### A. Veri katmanı (istemci) (17 dosya)
- [x] src/features/projects/access.ts
- [x] src/features/projects/hooks.ts
- [x] src/features/projects/use-task-dnd.ts
- [x] src/features/tasks/buckets.ts
- [x] src/features/tasks/filters.ts
- [x] src/features/tasks/hooks.ts
- [x] src/features/tasks/use-list-keyboard.ts
- [x] src/features/tasks/use-open-task.ts
- [x] src/features/tasks/use-toggle-complete.ts
- [x] src/features/workspaces/context.tsx
- [x] src/lib/api/client.ts
- [x] src/lib/client/bus.ts
- [x] src/lib/client/errors.ts
- [x] src/lib/client/keys.ts
- [x] src/lib/client/undo.ts
- [x] src/lib/client/use-mod-key.ts
- [x] src/lib/client/use-persisted-theme.ts

### B. Görev bileşenleri (11 dosya)
- [x] src/features/tasks/components/date-picker.tsx
- [x] src/features/tasks/components/description-editor.tsx
- [x] src/features/tasks/components/due-chip.tsx
- [x] src/features/tasks/components/filter-bar.tsx
- [x] src/features/tasks/components/my-tasks-view.tsx
- [x] src/features/tasks/components/pickers.tsx
- [x] src/features/tasks/components/quick-add.tsx
- [x] src/features/tasks/components/task-check.tsx
- [x] src/features/tasks/components/task-panel.tsx
- [x] src/features/tasks/components/task-row.tsx
- [x] src/features/tasks/components/task-section.tsx

### C. Proje bileşenleri (5 dosya)
- [x] src/features/projects/components/create-project-dialog.tsx
- [x] src/features/projects/components/project-form-fields.tsx
- [x] src/features/projects/components/project-settings.tsx
- [x] src/features/projects/components/project-view.tsx
- [x] src/features/projects/components/projects-view.tsx

### D. Uygulama iskeleti ve UI (9 dosya)
- [x] src/components/app/app-shell.tsx
- [x] src/components/app/command-menu.tsx
- [x] src/components/app/shortcuts.tsx
- [x] src/components/providers/providers.tsx
- [x] src/components/ui/button.tsx
- [x] src/components/ui/dialog.tsx
- [x] src/components/ui/input.tsx
- [x] src/components/ui/menu.tsx
- [x] src/components/ui/misc.tsx

### E. Sayfalar ve diğer özellikler (28 dosya)
- [x] src/app/(auth)/giris/page.tsx
- [x] src/app/(auth)/kayit/page.tsx
- [x] src/app/(auth)/layout.tsx
- [x] src/app/(auth)/sifre-yenile/page.tsx
- [x] src/app/(auth)/sifremi-unuttum/page.tsx
- [x] src/app/auth/callback/route.ts
- [x] src/app/auth/confirm/route.ts
- [x] src/app/auth/google/route.ts
- [x] src/app/baslangic/page.tsx
- [x] src/app/davet/[token]/page.tsx
- [x] src/app/error.tsx
- [x] src/app/global-error.tsx
- [x] src/app/layout.tsx
- [x] src/app/not-found.tsx
- [x] src/app/page.tsx
- [x] src/app/w/[slug]/ayarlar/page.tsx
- [x] src/app/w/[slug]/gorevlerim/page.tsx
- [x] src/app/w/[slug]/layout.tsx
- [x] src/app/w/[slug]/page.tsx
- [x] src/app/w/[slug]/projeler/[projectId]/page.tsx
- [x] src/app/w/[slug]/projeler/page.tsx
- [x] src/app/yasal/[slug]/page.tsx
- [x] src/features/auth/components/auth-forms.tsx
- [x] src/features/auth/components/terms-consent.tsx
- [x] src/features/home/home-view.tsx
- [x] src/features/onboarding/invite-accept.tsx
- [x] src/features/onboarding/onboarding-flow.tsx
- [x] src/features/settings/settings-view.tsx

### F. Sunucu: servisler, API, auth (59 dosya)
- [x] src/app/api/cron/purge/route.ts
- [x] src/app/api/v1/auth/login/route.ts
- [x] src/app/api/v1/auth/logout/route.ts
- [x] src/app/api/v1/auth/magic-link/route.ts
- [x] src/app/api/v1/auth/password-reset/route.ts
- [x] src/app/api/v1/auth/password-update/route.ts
- [x] src/app/api/v1/auth/signup/route.ts
- [x] src/app/api/v1/checklist/[itemId]/route.ts
- [x] src/app/api/v1/invites/accept/route.ts
- [x] src/app/api/v1/invites/preview/route.ts
- [x] src/app/api/v1/me/route.ts
- [x] src/app/api/v1/projects/[projectId]/members/[userId]/route.ts
- [x] src/app/api/v1/projects/[projectId]/members/route.ts
- [x] src/app/api/v1/projects/[projectId]/restore/route.ts
- [x] src/app/api/v1/projects/[projectId]/route.ts
- [x] src/app/api/v1/projects/[projectId]/statuses/route.ts
- [x] src/app/api/v1/projects/[projectId]/tasks/route.ts
- [x] src/app/api/v1/statuses/[statusId]/route.ts
- [x] src/app/api/v1/tasks/[taskId]/checklist/route.ts
- [x] src/app/api/v1/tasks/[taskId]/restore/route.ts
- [x] src/app/api/v1/tasks/[taskId]/route.ts
- [x] src/app/api/v1/tasks/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/invite-links/[inviteId]/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/invite-links/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/labels/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/members/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/my-tasks/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/projects/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/remember/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/search/route.ts
- [x] src/app/api/v1/workspaces/[workspaceId]/usage/route.ts
- [x] src/app/api/v1/workspaces/route.ts
- [x] src/features/auth/schemas.ts
- [x] src/features/members/server/service.ts
- [x] src/features/profile/server/service.ts
- [x] src/features/projects/schemas.ts
- [x] src/features/projects/server/service.ts
- [x] src/features/search/server/service.ts
- [x] src/features/tasks/schemas.ts
- [x] src/features/tasks/server/service.ts
- [x] src/features/workspaces/schemas.ts
- [x] src/features/workspaces/server/service.ts
- [x] src/instrumentation.ts
- [x] src/lib/api/client.ts
- [x] src/lib/api/errors.ts
- [x] src/lib/api/handler.ts
- [x] src/lib/auth/errors.ts
- [x] src/lib/auth/session.ts
- [x] src/lib/auth/supabase-server.ts
- [x] src/lib/db/admin.ts
- [x] src/lib/db/audit.ts
- [x] src/lib/db/client.ts
- [x] src/lib/db/schema.ts
- [x] src/lib/db/time.ts
- [x] src/lib/db/with-user.ts
- [x] src/lib/env.ts
- [x] src/lib/security/rate-limit.ts
- [x] src/proxy.ts

### G. Yardımcılar, tipler, yapılandırma (14 dosya)
- [x] src/config/plans.ts
- [x] src/config/site.ts
- [x] src/features/projects/types.ts
- [x] src/features/search/types.ts
- [x] src/features/tasks/types.ts
- [x] src/features/workspaces/types.ts
- [x] src/i18n/request.ts
- [x] src/lib/dates/format.ts
- [x] src/lib/dates/tz.ts
- [x] src/lib/nlp/tr-parser.ts
- [x] src/lib/positions.ts
- [x] src/lib/text/tr.ts
- [x] src/lib/utils.ts
- [x] src/lib/validation/common.ts

### H. Veritabanı
- [x] supabase/migrations/*.sql (5 dosya)

### I. Kullanıcı akışları (tarayıcıda)
- [x] her ekran × boş / dolu / hata / yükleniyor durumu
- [x] masaüstü + mobil + koyu tema + klavye

## Bulgular


### A. İstemci veri katmanı
| # | Bulgu | Etki | Düzeltme / kanıt |
|---|---|---|---|
| A1 | İyimser güncelleme öncesi `cancelQueries` verisi olmayan (ilk yüklenen) sorguları da iptal ediyordu → sorgu `pending+idle` kalır | Panel/liste iskelette sonsuza dek asılı kalabilir | Yalnızca verisi olan sorgular iptal ediliyor (`tasks/cache.ts`, `projects/hooks.ts`); `tests/unit/task-cache.test.ts` |
| A2 | Açıklama kaydı önbelleğe yansımıyordu; 30 sn içinde yeniden açılan panel eski metinle başlıyordu | **Veri kaybı**: sonraki tuş vuruşu yeni metni eskisiyle eziyor | Açıklama ayrıntı önbelleğine iyimser yazılıyor; tarayıcı testi (I bölümü) |
| A3 | Panel kapatmak da geçmişe kayıt ekliyordu | "Geri"/Android geri hareketi kapatılan paneli yeniden açıyor | Kapatma, açılışın eklediği kayda geri dönüyor (`use-open-task.ts`) |
| A4 | Ok tuşları liste sayfalarında her zaman yakalanıyordu; menüde gezinmek arkadaki seçimi de kaydırıyordu | Ok tuşlarıyla sayfa kaydırılamıyor | Oklar yalnızca j/k ile gezinme başladıktan sonra; menü/diyalog/ızgara içindeki tuşlar yok sayılıyor; Esc seçimi bırakıyor |
| A5 | Enter, odaklı satırda görevi açmak yerine sürüklemeyi başlatıyordu; sürükleme kapalıyken satırlara Tab ile ulaşılamıyordu | Klavye kullanıcıları görev açamıyor | Enter açar, Space taşır; satır/kart her durumda odaklanabilir |
| A6 | Mobilde uzun basıp sağa sürüklemek sürükleme + kaydırarak tamamlamayı birlikte tetikliyordu | Görev yanlışlıkla tamamlanıyor | 250 ms'den uzun basış kaydırma başlatmıyor |
| A7 | Kart içindeki tamamla düğmesinde Enter hem tamamlıyor hem paneli açıyordu | Beklenmeyen panel | Kart/satır yalnızca kendi odağındaki Enter'ı işliyor |

### B. Görev bileşenleri
| # | Bulgu | Etki | Düzeltme / kanıt |
|---|---|---|---|
| B1 | Ana sayfa / Görevlerim'den proje etiketiyle (#web) eklenen görev atamasız kalıyordu | Görev eklendiği ekranda hiç görünmüyor | Kişisel görünümlerden eklenen iş, kimse anılmadıysa ekleyene atanır; e2e B7 |
| B2 | Uzun metin "Ekle" düğmesinin altına giriyordu | Yazının sonu okunmuyor | Çip görünürken sağ boşluk |
| B3 | Aynı adlı iki kişide ("Hangi Can?") seçim yapılmadan Enter görevi atamasız oluşturuyordu | Niyet sessizce kayboluyor | Seçim yapılana kadar gönderim beklemede + uyarı; e2e B12 |
| B4 | Satır içi eklemede belirsiz ad başlıktan silinip kimseye atanmıyordu | Bilgi kaybı | Belirsiz ad başlıkta kalır |
| B5 | Panel yüklenirken kapatma düğmesi yoktu | Mobilde yavaş ağda tam ekran iskelette kalma | Yükleme durumunda da üst çubuk |
| B6 | Panel açıkken başka göreve / toast'taki "Geri al"a tıklamak paneli "dışarı tıklama" sayıp kapatıyordu | Kapat/aç yarışı, yanlış görev | Dışarı tıklama paneli kapatmaz (X, Esc, geri); e2e A3+B |
| B7 | Geniş ekranda panel listenin sağ yarısını örtüyordu | Tarihler/etiketler görünmüyor, satır tıklanamıyor | ≥1280 px'te içerik panelin yanına kayar |
| B8 | Bağlantı kopyalama başarısız olsa da "kopyalandı" diyordu | Yanıltıcı mesaj | Gerçek sonuca göre mesaj |
| B9 | Kontrol listesi maddesi düzenlenemiyordu | Yazım hatası için sil-yeniden ekle | Tıkla-düzenle (Enter kaydet, Esc vazgeç); e2e |
| B10 | Kontrol listesi silme düğmesi yalnızca hover'da görünüyordu | **Telefonda madde silinemiyor** | Mobilde her zaman görünür |
| B11 | Açıklama editörü açıkken proje arşivlenirse yazılabilir kalıyordu | Reddedilen kayıtlar | Erişim değişince editör kilitlenir |
| B12 | Tarih seçicide Türkçe sabit metinler, yanlış erişilebilir ad ("Saat"), günler "2026-10-02" okunuyordu | i18n / ekran okuyucu | Intl ile dil-bağımsız gün adları, doğru etiketler |
| B13 | Panel açma, filtre yazma, sekme/görünüm değişimi her seferinde sunucu sayfasını yeniden çalıştırıyordu | Her tuşta sunucu isteği; taze sunucu verisi iyimser durumu ezebiliyordu (tamamlama işareti geri dönüyordu) | Yalnızca URL değişir (history API, Next.js resmi yöntemi) |
| B14 | Ana sayfa tarihsiz görevleri göstermiyordu; yalnızca tarihsiz görevi olana "hiç işin yok" boş durumu çıkıyordu | Görev kayboluyor / yanlış boş durum | "Tarihsiz" bölümü; boş durum gerçekten boşken |
| B15 | Kayıt formu Türkçe karakterli e-postayı kabul edip sunucuda genel hatayla düşüyordu | Anlaşılmaz hata | İstemci, sunucuyla aynı e-posta şemasını kullanır |
| B16 | Yeni katılan ekip arkadaşı 60 sn boyunca atanamıyordu | Gecikmeli tanıma | Üye listesi 30 sn + odakta tazelenir |

### C. Proje ekranları
| # | Bulgu | Etki | Düzeltme / kanıt |
|---|---|---|---|
| C1 | Proje silinince / erişim kaldırılınca sayfa iskelette asılı kalıyordu | Ne olduğu anlaşılmıyor | "Bu projeye ulaşılamıyor" + Projeler bağlantısı; e2e |
| C2 | Liste/pano seçimi projenin varsayılanını herkes için değiştiriyordu | Ekip arkadaşları birbirinin görünümünü değiştiriyor | Tercih kişisel (bu cihazda); URL paylaşılabilir kalır; e2e |
| C3 | Salt okunur projede "ilk görevi yukarıya yaz" deniyordu | Var olmayan kutuyu tarif ediyor | Ayrı metin |
| C4 | Boş projede liste/pano hiç gösterilmiyordu | Panoda sütunlar ve sütun içi "Görev ekle" yok; ilk görev doğrudan bir duruma eklenemiyor | Boş durum görünümün üstünde ipucu; e2e |
| C5 | Yalnızca tarih yazılınca ("yarın") başlık boş kalıyordu | Satır içi eklemede boş satır + anlaşılmaz hata; hızlı eklemede Enter hiçbir şey yapmıyor | Metin olduğu gibi başlık olur; e2e |
| C6 | Mobilde yapışkan durum başlıkları üst çubuğun altına giriyordu | Kaydırınca grup başlığı görünmüyor | Mobilde üst çubuğun altına yapışır |
| C7 | Projeyi özele çevirmek tek tıkla, uyarısız | Ekip erişimini ve atamaları sessizce kaldırıyor | Kaç kişinin etkileneceğini söyleyen onay; e2e |
| C8 | Üye çıkarma onaysızdı | Atamalar kayboluyor | Onay |
| C9 | Durum adı: Enter kaydetmiyor, reddedilen ad alanda kalıyordu | Tutarsız görüntü | Enter kaydeder, hata olursa eski ada döner; e2e |
| C10 | Durumlar sıralanamıyordu | Süreç düzenlenemiyor | Yukarı/aşağı taşıma; e2e |
| C11 | Ekran okuyucu: kilit "private", sekme grubu "Liste", renkler "#3B4FE4" okunuyordu | Erişilebilirlik | Türkçe adlar |

### D. Uygulama iskeleti (kısmi)
| # | Bulgu | Etki | Düzeltme / kanıt |
|---|---|---|---|
| D1 | Komut menüsü iç İngilizce anahtarlarla süzüyordu; 2+ harfte komutlar tamamen kayboluyordu | "tema", "ayar" yazınca komut bulunamıyor | Türkçe katlamalı etiket araması, komutlar aramada da görünür; e2e |
| D2 | Arama her tuşta sonuçları silip "Yükleniyor" gösteriyordu | Titreme | Önceki sonuçlar yenisi gelene kadar kalır |
| D3 | Misafire "Yeni proje" komutu görünüyordu | Yetki hatası | Gizlendi |
| D4 | **Davetle katılan kullanıcı kendi çalışma alanını hiç açamıyordu** | Ücretsiz plan hakkı kullanılamıyor | Değiştiricide "Yeni çalışma alanı"; limitte anlaşılır mesaj; e2e |
| D5 | Mobilde çalışma alanı değiştirilemiyordu (üst çubukta düz metin) | Çok ekipli kullanıcı telefonda takılı | Mobil üst çubukta değiştirici menü; e2e |
| D6 | Form hata mesajları girdiye bağlı değildi | Ekran okuyucu hatayı duyurmuyor | `aria-describedby` + `aria-invalid` |

### D. Uygulama iskeleti (devam)
| # | Bulgu | Etki | Düzeltme / kanıt |
|---|---|---|---|
| D7 | Açık menüde harf tuşları genel kısayolları da tetikliyordu | Menüde "n" hızlı ekleme açıyor | Menü/liste kutusu/komut içinde kısayollar devre dışı |
| D8 | Diyalogların yükseklik sınırı yoktu | Küçük ekranda uzun içerik taşıyor, kaydırılamıyor | En fazla %80 yükseklik + kaydırma |
| D9 | Hata bildirimleri başarı bildirimleriyle aynı görünüyordu | Hata fark edilmiyor | Hata bildirimi kırmızı |
| D10 | Süresi dolmuş / Referer engelleyen Google avatarları kırık resim gösteriyordu | Bozuk görünüm | `no-referrer` + yüklenemezse baş harfler |

### E. Sayfalar
| # | Bulgu | Etki | Düzeltme / kanıt |
|---|---|---|---|
| E1 | **Çalışma alanından üye çıkarılamıyor, rol değiştirilemiyor, alandan ayrılınamıyordu** | 5 kişilik ücretsiz alan, ayrılan çalışan yüzünden kalıcı kilitleniyor | Servis + API + arayüz; yönetici atamayı yalnız sahip yapar, terfi üye limitine uyar, sahip ayrılamaz; entegrasyon (3) + e2e |
| E2 | Çıkarılan üyenin kişisel projesi yetim kalıyordu | Görülemeyen görevler 500 limitini sonsuza dek tüketiyor | Üyelik silinince kişisel proje de silinir (migration 0600) |
| E3 | "Şifresiz giriş" hatası şifre alanının altında çıkıyordu; düğmede bekleme durumu yoktu | Yanlış yer / çift e-posta | Doğru alan, bekleme durumu; e2e |
| E4 | "Linki gönderdik" ve "e-postanı kontrol et" ekranları çıkmaz sokaktı | Yanlış yazılan adres düzeltilemiyor | "Farklı bir e-posta kullan" + spam ipucu |
| E5 | Şifre yenileme sayfası oturum olmadan açılınca form gösteriyor, gönderince girişe atıyordu | Kafa karıştırıcı | Durumu açıklar, yeni link isteme düğmesi; e2e |
| E6 | Şifremi unuttum: istemci doğrulaması ve bekleme durumu yoktu | Genel hata / çift gönderim | Eklendi |
| E7 | Alan sayfaları arasında geçişte yükleniyor ekranı yoktu | Yavaş ağda tıklama algılanmamış gibi | `loading.tsx` iskeleti |
| E8 | Karşılama mesajı ilk görev eklendikten sonra da kalıyordu | Tutarsız metin | Yalnızca liste boşken |

### F–H. Sunucu ikinci geçiş, yardımcılar, SQL
Arama (silinmiş üst görevin alt görevleri, misafirin kişi araması), temizlik işi yetkisi, profil güncelleme, davet önizleme,
güvenlik başlıkları, dil/saat dilimi, Türkçe katlama ve tarih yardımcıları yeniden kontrol edildi: yeni bulgu yok.
Migration 0600 (üye yönetimi) entegrasyon testleriyle doğrulandı. Bilinen açık: CSP başlığı yok (nonce altyapısı gerektirir).

### I. Görsel denetim (masaüstü açık tema + mobil koyu tema)
| # | Bulgu | Etki | Düzeltme |
|---|---|---|---|
| I1 | Ayarlar sayfasında uzun e-posta kısaltılmıyordu | Telefonda sayfa yatay taşıyor | Kısaltma |
| I2 | Ana sayfa örnek metni telefonda yarıda kesiliyordu | Yarım cümle | Daha kısa örnek |

## Özet (2. tur)
71 bulgu düzeltildi (A 7, B 16, C 11, D 10, E 8, I 2 + ilk turun 14 güvenlik/veri bulgusu ayrıca `tests/integration/audit.test.ts`).
Doğrulama: birim 105, entegrasyon 57, uçtan uca (gerçek tarayıcı, masaüstü + mobil) 29.
