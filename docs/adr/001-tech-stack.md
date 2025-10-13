# ADR-001: Tech Stack Seçimi

## Durum
Kabul edildi – Sprint 0

## Bağlam
Legal CRM uygulaması hızlıca üretime alınabilir tek bir full-stack repo üzerinde geliştiriliyor. UI, API, auth ve veri erişimi için birbirine uyumlu teknolojiler gerekli.

## Karar
Next.js 15 (App Router) + TypeScript + Prisma + PostgreSQL + NextAuth kullanılacak. UI katmanında TailwindCSS ve shadcn/ui bileşenleri tercih edilecek.

## Gerekçe
- Next.js App Router aynı repo içinde SSR/SSG ve API route handler’larını yönetiyor.
- Prisma Postgres ile uyumlu, tip güvenli sorgular sağlıyor.
- NextAuth hem credentials hem de OAuth sağlayıcıları ile hızlı doğrulama sunuyor.
- Tek deploy hedefi ve Vercel/Node ekosistemiyle uyumlu.

## Alternatifler
- **NestJS + ayrı React:** İki ayrı repo, fazladan CI/CD ve auth entegrasyon maliyeti.
- **FastAPI + React/Next:** Tip ve ekosistem bütünlüğü zayıf, Node odaklı ekip için ek öğrenme maliyeti.

## Sonuçlar
- Next.js App Router yapısına göre klasörleme yapılacak.
- Prisma Client Node 20 runtime’ı ile paylaşılacak.
- NextAuth veri tabanı oturumları için Prisma adapter seçeneği saklı tutulacak.
