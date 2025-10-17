# Sprint 2 – Matter & Relationship Enhancements

## Amaçlar
1. **Matter CRUD (API + UI):** Davalar için tam CRUD akışı, zod doğrulama ve audit log desteği.
2. **Contact ↔ Matter İlişkilendirmesi:** Contact detayında ilişkili taraf yönetimi, Matter tarafında client/party ekleme.
3. **Status & Type Enum’ları:** Matter status/type alanlarını enum olarak merkezileştirip UI filtreleri ile hizalamak.
4. **Dashboard Açık Davalar Kartı:** Dashboard’daki özet kutusunda açık davaların sayısı ve hızlı erişim linki.
5. **Zod, Audit ve RBAC Koruması:** Matter endpoints ve UI işlemlerinde tekrar kullanılabilir guard ve audit util’leri.

## Başarı Kriterleri
- Matter API’leri zod doğrulaması ile 422 döndürür; audit log kayıtları oluşturulur.
- Contact ↔ Matter taraf ilişkileri UI’da eklenip yönetilebilir.
- Enum tanımları tek kaynaktan beslenir; UI filtreleri bu enumları kullanır.
- Dashboard kartı açık dava sayısını ve kısa özetini gösterir.
- RBAC guard ve audit util’leri Matter işlemlerinde yeniden kullanılır.

## Teknik Notlar
- Veri ilişkileri: Matter ↔ Contact bire çok (clientId), ek taraflar `MatterContact` ara tablosu ile yönetilir.
- Arayüz iyileştirme: `clientId` seçiminde contacts listesinden autocomplete kullanılır.
- Tarih alanı: `nextHearingAt` için HTML5 `datetime-local` input tercih edilir.
- Seed verisi: 1–2 örnek matter (ör. “Smith vs. Co.”) eklenerek UI testleri kolaylaştırılır.
- Endpoint dokümantasyonu: `docs/openapi.yaml` dosyasına `/matters` ve `/matters/{id}` ek entry’leri yazılır.

## Issue Listesi
1. `MAT-001` Zod şemaları (`schemas/matter.ts`)
2. `MAT-002` API routes `/api/matters` ve `/api/matters/[id]`
3. `MAT-003` Matter UI – liste + create modal
4. `MAT-004` Matter detay sayfası (readonly)
5. `MAT-005` MatterContact API & UI (party ekleme)
6. `DASH-002` Dashboard kartı “Açık Davalar”
7. `TEST-002` Unit + API + E2E testleri
