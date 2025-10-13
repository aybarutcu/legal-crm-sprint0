# ADR-005: Rol Tabanlı Yetkilendirme (RBAC)

## Durum
Kabul edildi – Sprint 0

## Bağlam
Farklı kullanıcı grupları (yöneticiler, avukatlar, paralegaller) farklı veri setlerine erişmek zorunda. PII içeren alanların maskelemesi ve hassas aksiyonların sınırlandırılması şart.

## Karar
RBAC katmanı üç temel rol ile başlayacak: `ADMIN`, `LAWYER`, `PARALEGAL`. Yetkilendirme UI ve API düzeyinde policy katmanı ile uygulanacak. Alan bazlı maskeleme Sprint 1’de ayrıntılandırılacak.

## Gerekçe
- RBAC, hukuk kuruluşlarının hiyerarşik yapısına uyuyor.
- Policy tabakası yeni rollerin eklenmesini kolaylaştırıyor.

## Alternatifler
- **ABAC (attribute-based):** Sprint 0 için fazla karmaşık.
- **Sadece endpoint bazlı kontrol:** Field level maskeleme ihtiyaçlarına cevap vermez.

## Sonuçlar
- Prisma `Role` enum’u oluşturuldu.
- `authOptions` rol bilgisi ile genişletilecek.
- Middleware katmanında rol doğrulamaları yapılacak.
