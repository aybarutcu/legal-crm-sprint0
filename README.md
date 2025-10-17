# Legal CRM – Sprint 0 Kickoff

Legal CRM, hukuk büroları için müşteri, dava (matter), doküman ve takvim yönetimini tek platformda buluşturur. Sprint 0 paketi; mimari özet, ADR kayıtları, veritabanı şeması, API/OpenAPI başlangıcı, Docker Compose, seed scriptleri, CI ve temel UI iskeletini içerir.

## 📚 Dokümantasyon

**🎯 Ana Dokümantasyon**: [`docs/MASTER-SYSTEM-DOCUMENTATION.md`](./docs/MASTER-SYSTEM-DOCUMENTATION.md)
- Tüm sistem mimarisi
- Veritabanı şeması
- API endpoint'leri
- Workflow sistemi
- Geliştirme rehberi
- Bilinen sorunlar ve çözümler

**📖 Dokümantasyon Rehberi**: [`docs/README.md`](./docs/README.md)
- Tüm dokümanların listesi ve durumu
- Nasıl kullanılır rehberi
- Dokümantasyon standartları

## Mimari Özet
- **UI / App:** Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui.
- **API:** Next.js Route Handlers (`app/api/*`), REST + OpenAPI (`/api/openapi`).
- **ORM / DB:** Prisma + PostgreSQL (lokalde Docker Compose).
- **Auth:** NextAuth (Credentials + Google/Microsoft OAuth).
- **Storage:** MinIO (lokal) / S3 (prod).
- **Mail:** MailHog (lokal) / SES veya SendGrid (prod). `SMTP_FROM` ortam değişkeni varsayılan gönderici adresini belirler.
- **Queue & Cache:** Redis (ileride rate limit & background jobs).
- **Observability:** OpenTelemetry planı, pino logging, Prometheus exporter backlog’da.

Detaylı kararlar için `docs/adr/` klasörüne bakın.

## Kurulum Adımları
```bash
npm install
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Hızlı reset için: `./scripts/dev-reset.sh`

Swagger JSON üretmek için: `node scripts/gen-openapi.js`

## Klasör Yapısı (Özet)
```
app/                    # Next.js App Router (marketing, dashboard, API)
docs/                   # OpenAPI, ADR kayıtları
prisma/                 # Prisma schema + seed
scripts/                # Geliştirici yardımcı scriptleri
tests/e2e/              # Playwright iskeleti
.github/workflows/      # CI pipeline
docker-compose.yml      # Postgres, MinIO, Redis, MailHog
```

## Takvim & Hatırlatmalar
- Takvim ekranı ay/hafta/gün görünümleri, dosya/katılımcı/takvim filtreleri ve Google senkronizasyonu için manuel tetikleyiciler içerir.
- Etkinlik oluşturma/düzenleme modalı katılımcı e-postaları, hatırlatma süresi, dosya ve takvim seçimi destekler; Google takvimine bağlı etkinlikler otomatik olarak dış sisteme itilir.
- Hatırlatma servisi her dakika komut dosyasıyla çalışır, `reminderMinutes` değeri dolan etkinlikler için organizatör ve katılımcılara e-posta gönderir; MailHog üzerinden yerelde takip edilebilir.
- ICS paylaşımlarını `/settings/calendar` ekranından oluşturup yenileyebilirsiniz; tokenlar kullanıcı bazlıdır ve eski bağlantılar yeni token üretildiğinde iptal edilir. Ortaya çıkan URL salt okunurdur ve dış takvim istemcilerine eklenebilir.
- Operasyonel akışlar, hata ayıklama ipuçları ve sık yapılan işler için `docs/runbooks/calendar.md` dosyasına bakın.

## Kalite ve CI
- `npm run lint`, `npm run format`, `npm test`, `npm run e2e`
- Husky + lint-staged (pre-commit) kurulumu backlog’da.
- GitHub Actions pipeline `.github/workflows/ci.yml` dosyasında yer alır.

## Yol Haritası (Sprint 1 İçin)
- Auth & RBAC iskeletini genişletmek.
- Contacts ve Matters akışlarını UI + API’de tamamlamak.
- Upload altyapısı + MinIO entegrasyonu.
- Dashboard metrik kartları ve event/takvim entegrasyonu.
