# ADR-003: Kimlik Doğrulama Yaklaşımı

## Durum
Kabul edildi – Sprint 0

## Bağlam
Legal CRM hassas müşteri verisi içeriyor ve hem firma içi hem de harici kullanıcıları destekleyebilir. Kurumsal OAuth sağlayıcılarıyla entegre olmak ve klasik e-posta/şifre akışını desteklemek gerekiyor.

## Karar
NextAuth Credentials sağlayıcısı ve OAuth (Google ve Microsoft) desteği kullanılacak. Oturum stratejisi JWT olacak, ancak ileride veritabanı oturumları için Prisma adapter’ı devreye alınabilecek. Hassas işlemler için ek “step-up” doğrulama Sprint 2 sonrası değerlendirilecek.

## Gerekçe
- NextAuth Next.js ekosistemiyle yerleşik.
- OAuth sağlayıcıları kurumsal müşterilerin tekil giriş ihtiyaçlarını karşılıyor.
- JWT stratejisi hızlı kurulum ve serverless uyumluluğu sağlıyor.

## Alternatifler
- **Auth0 / Cognito:** Ekip içi uzmanlığın dışında, maliyetli.
- **Kendi auth servisi:** Bakımı zor ve yüksek güvenlik riski.

## Sonuçlar
- `app/api/auth/[...nextauth]/route.ts` üzerinden konfigürasyon sağlanacak.
- Kullanıcı rolleri ve durumları Prisma şemasında saklanacak.
- Parola saklama stratejisi için zxcvbn/zod doğrulamaları Sprint 1’de eklenecek.
