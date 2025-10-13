# Calendar Operations Runbook

Bu doküman takvim entegrasyonunu işletirken ihtiyaç duyulacak rutin adımları, gözlem noktalarını ve manuel doğrulamaları özetler.

## 1. Hatırlatma Servisi

- Job Next.js süreçlerinin içerisinde dakikada bir tetiklenir (`lib/events/reminder-worker.ts`). Prod ortamında ayrı bir worker sürecinde koşturmak önerilir.
- Hatırlatan e-postalar MailHog (lokal) veya SMTP sağlayıcısı üzerinden gider. `MAILHOG_URL=http://localhost:8025` ile gelen kutusunu açabilirsiniz.
- `SMTP_FROM` ortam değişkeni varsayılan gönderen adresini belirlemelidir (örn. `Legal CRM <no-reply@legalcrm.local>`); aksi halde SMTP sunucuları 550 hatası döndürebilir.
- Sadece `reminderMinutes` dolmuş ve `reminderSentAt` boş etkinlikler işlenir; etkinlik güncellendiğinde alan sıfırlanır ve sonraki pencere için yeniden planlanır.
- Manuel tetikleme: `node -e "import('./lib/events/reminder-service').then(m=>m.scanAndSendReminders())"` komutu job’u tek seferlik çalıştırır.

## 2. Google Senkronizasyonu

- Senkronizasyon olayları her etkinlik CRUD işleminde tetiklenir, ayrıca `/api/calendar/sync` üzerinden manuel olarak veya webhook’la planlanan importlar çalışır.
- Hata durumlarını `console.error('[sync] ...')` loglarını takip ederek görebilirsiniz; prod ortamında bu loglar merkezi toplanmalıdır.
- Token yenilemesi gerektiğinde kullanıcı tekrar Google OAuth akışına yönlendirilir. Kalıcı hatalar için `Account` tablosundaki access/refresh token alanları kontrol edilmelidir.

## 3. ICS Feed Yönetimi

- Kullanıcılar `/settings/calendar` ekranından ICS bağlantısı oluşturur. Oluşturulan token sadece bir kez gösterilir; kaybedilirse yeni token üretmek gerekir.
- `DELETE /api/calendar/ics/token` çağrısı tüm tokenları iptal eder. Bu işlemden sonra eski linkler HTTP 404 döner.
- ICS dosyası yalnızca görünür etkinlikleri içerir (RBAC filtresi uygulanır) ve ABD formatında UTC timestamp’leri iletilir.

## 4. Smoke Test – ICS

1. Dashboard’da **Settings → Calendar** sayfasına gidin ve “ICS Bağlantısı Oluştur” butonuna tıklayın.
2. Görünen URL’yi kopyalayın ve aşağıdakilerden biriyle test edin:
   - Apple Calendar: Menüden **File → New Calendar Subscription…** diyerek URL’yi girin.
   - Google Calendar (web): **Other calendars → From URL** alanına yapıştırın.
   - Outlook: **Add calendar → From internet** akışını kullanın.
3. Takvim istemcisi etkinlikleri çekiyorsa import başarılıdır. Olası 403/404 hatalarında token’ı yenileyin ve yeniden deneyin.

## 5. Smoke Test – Hatırlatma E-postası (MailHog)

1. `docker compose up -d mailhog` ile MailHog’u çalıştırın.
2. Yeni bir etkinlik oluşturun; `reminderMinutes` değerini düşük bir süre (ör. 5 dakika) olacak şekilde ayarlayın.
3. Hatırlatma penceresi geldiğinde MailHog arayüzünde (http://localhost:8025) e-postanın düştüğünü doğrulayın.
4. E-posta gelmezse Next.js terminal loglarında `[reminder]` ve `Failed to send reminder email` mesajlarını kontrol edin.

## 6. Operasyon Notları

- Ortam değişkenleri:
  - `CALENDAR_SYNC_POLL_INTERVAL_SEC`: Hatırlatma job’unun tetiklenme periyodunu da belirler (min 30 saniye uygulanır).
  - `ICS_SIGNING_SECRET`: Token hash’lerini üretmek için kullanılır; ortamlar arasında farklı tutulmalıdır.
- Prod’da hatırlatma ve senkronizasyon job’larının ayrı süreçlerde çalışması, log’ların merkezi bir yere aktarılması ve hata metriklerinin izlenmesi önerilir.
- Kullanıcı şikâyetlerinde önce etkinliğin `reminderMinutes`, `reminderSentAt` ve `attendees` bilgilerini Prisma üzerinden kontrol edin; ardından `Account` tablosundaki OAuth token durumunu doğrulayın.
