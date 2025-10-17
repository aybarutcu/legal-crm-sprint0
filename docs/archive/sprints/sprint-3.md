# Sprint 3 – Doküman Yönetimi (DMS)

## Amaç
Davalar ve kişiler için dokümanları hızlı, güvenli ve izlenebilir şekilde yönetmek.

## Hedefler
1. **Dosya Yükleme Akışı:** S3/MinIO signed URL, 100 MB sınırı, MIME doğrulama.
2. **Sürümleme:** Aynı matter + dosya adı kombinasyonunda version++.
3. **Liste/Filtre/Arama:** filename, tags, uploader, matterId, q parametreleri.
4. **Önizleme/İndirme:** PDF/image inline gösterim, imzalı GET URL.
5. **Etiketleme & İlişkilendirme:** Matter’a bağlı veya bağımsız doküman etiketleri ve ilişkileri.
6. **Audit Log & RBAC:** Erişim sadece yetkili kullanıcılar, audit log kayıtları.
7. **Dashboard Entegrasyonu:** “Son Yüklenen Dokümanlar” kartının DMS ile uyumlu hale getirilmesi.

## Şema ve Domain Notları
- `prisma/schema.prisma` üzerinde `Document` modeli contact ilişkilendirmesi (`contactId`) ve sürümlemeyi kolaylaştırmak için indekslerle güncellendi.
- Uygulama tarafında storage key formatı: `documents/{documentId}/v{version}/{filename}`.
- MIME doğrulama için izin verilen içerikler: `application/pdf`, `image/*`, `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Maksimum yükleme boyutu: `MAX_UPLOAD_BYTES` (default 100 MB).

## RBAC & Audit
- Upload/List/Download/Delete işlemleri için owner/admin temelli yetki kontrolü (Matter veya Contact owner + ADMIN istisnası).
- Her `POST /api/documents`, `PUT/PATCH`, `DELETE` çağrısında `auditLog` kaydı (action: `document.create|document.version|document.delete`).

## Depolama ve İmzalı URL Sözleşmeleri
- `POST /api/uploads` → `{ putUrl, storageKey, expiresAt }` döner.
- `GET /api/documents/[id]/download` → `{ getUrl, expiresAt, mime }` döner.
- Signed URL süresi varsayılan 5 dakika (`SIGNED_URL_TTL_SECONDS`).
