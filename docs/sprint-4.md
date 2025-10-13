# Sprint 4 – Calendar & Meetings Özeti

## Öne Çıkan Özellikler
- Ay/hafta/gün görünümlerine sahip interaktif takvim sayfası, dosya/katılımcı/takvim filtreleri ve manuel Google senkronizasyon tetikleyicisi.
- Etkinlik modalı ile katılımcı listesi, hatırlatma süresi ve Google takvimi seçimi; CRUD işlemleri sırasında iki yönlü senkronizasyon.
- Hatırlatma servisi dakikada bir tarama yaparak yaklaşan etkinlikler için e-posta gönderiyor; MailHog ile yerelde gözlemlenebilir.
- ICS token üretimi ve iptali: kullanıcılar salt okunur feed oluşturup dış takvim istemcilerine ekleyebiliyor.

## Operasyonel Notlar
- Hatırlatma job’u Next.js sürecinde singleton olarak başlıyor; prod ortamında bağımsız worker önerilir.
- Google OAuth token’ları NextAuth `Account` tablosunda tutulur; 401/403 hatalarında token yenileme akışı tetiklenir.
- ICS token’ları `calendar.icsTokenHash` alanında SHA-256 hash olarak saklanır; yeni token yaratmak eski feed’i geçersiz kılar.

## Doğrulama & Test
- `npm run test` komutu; özellikle `tests/unit/event-reminder.spec.ts` ve `tests/unit/ics.spec.ts` ile hatırlatma/ICS yardımcıları güvence altına alındı.
- Manuel smoke test adımları için `docs/runbooks/calendar.md` dokümanına bakın (ICS feed ve MailHog üzerinden hatırlatma doğrulaması).
