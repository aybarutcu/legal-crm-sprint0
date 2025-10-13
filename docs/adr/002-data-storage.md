# ADR-002: Veri Depolama Stratejisi

## Durum
Kabul edildi – Sprint 0

## Bağlam
Uygulama hem yapılandırılmış CRM verilerini hem de doküman gibi büyük dosyaları saklayacak. Tek bir veritabanı çözümü hem performans hem de bakım açısından yeterli olmalı.

## Karar
İş verisi PostgreSQL üzerinde tutulacak; dokümanlar S3 uyumlu obje depolamada saklanacak (lokalde MinIO, prod’da AWS S3 veya GCS). Doküman metadata’sı Postgres’te tutulacak.

## Gerekçe
- Postgres ACID uyumluluğu ve güçlü sorgu özellikleri sunuyor.
- JSONB alanlarla esnek metadata yönetimi mümkün.
- S3 uyumlu storage büyük dosyalarda ölçeklenebilir ve uygun maliyetli.

## Alternatifler
- **Tamamen obje storage:** İlişkisel sorgular için pahalı ve yavaş.
- **NoSQL (MongoDB):** Transaction ve join ihtiyaçlarında karmaşıklık.

## Sonuçlar
- Prisma şemasında doküman metadata’sı Postgres’te tutulacak.
- Upload işlemleri için signed URL ve MinIO kullanımı planlandı.
- Gelecekte FTS için Postgres uzantıları (`pg_trgm`, `tsvector`) etkinleştirilecek.
