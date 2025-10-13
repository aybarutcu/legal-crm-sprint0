# ADR-004: Takvim Entegrasyonu

## Durum
Kabul edildi – Sprint 0

## Bağlam
Avukatların müşteri toplantıları ve duruşmaları kurum içi takvimleriyle uyumlu tutulmalı. İlk versiyonda Google Workspace kullanımı yaygın, Microsoft 365 entegrasyonu ise pipeline’da.

## Karar
İlk sürümde Google Calendar entegrasyonu yapılacak. OAuth 2.0 ile yetkilendirme sağlanacak, etkinlikler için iki yönlü senkron (webhook + periodik polling) altyapısı planlanacak. Microsoft 365 desteği v2’de eklenecek.

Hatırlatıcılarda uygulama içi e-posta motoru kullanılacak; `reminderMinutes` alanı etkinlik bazında ayarlanacak ve arka planda çalışan job yalnızca bir kez bildirim gönderecek. Kullanıcılar salt okunur paylaşımlar için token bazlı ICS linkleri oluşturabilecek. Tokenlar ayarlar ekranından yenilenebilir veya iptal edilebilir.

## Gerekçe
- Google Calendar yaygın ve API dokümantasyonu olgun.
- Hibrit webhook/polling yaklaşımı güvenilirlik sağlıyor.
- Kademeli rollout maliyeti düşürüyor.
- ICS token’ları kullanıcı bazlı yöneterek erişim kontrolü kolaylaşıyor; token yenilendiğinde eski feed otomatik olarak geçersiz hale geliyor.
- Hatırlatıcıların e-posta olarak gitmesi (MailHog/SMTP) duruşma öncesi unutma riskini azaltıyor ve ileride push bildirimleri eklemek için temel sağlıyor.

## Alternatifler
- **Sadece iCal feed:** Tek yönlü ve durum güncellemelerinde gecikmeli.
- **Üçüncü parti takvim entegrasyonu (Cronofy vb.):** Maliyetli ve vendor lock-in.
- **Kuyruk tabanlı hatırlatıcı servisleri:** Bu sprint’te in-process job yeterli, ileri aşamada Redis tabanlı kuyruk planlanabilir.

## Sonuçlar
- OAuth token’ları NextAuth Account tablosunda saklanacak.
- Senkronizasyon job’ları için Redis tabanlı queue planlandı.
- Etkinlik kayıtlarında `externalCalId` alanı bulunuyor.
- Hatırlatma job’u Next.js sürecinde singleton olarak çalışıyor; prod ortamda ayrı worker sürecine taşınmalı.
- ICS token hash’i Prisma `Calendar` tablosunda saklanıyor ve yeni token üretimi eski feed’leri iptal ediyor.
