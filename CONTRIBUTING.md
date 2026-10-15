# Katkı / Contributing

Katkın için teşekkürler. Kısa kurallar:

- **Mevzuat:** bir süre, oran ya da eşik değişecekse önce dayanağını göster (mevzuat.gov.tr
  ya da Resmî Gazete bağlantısı). Kurallar `src/lib/mevzuat.ts` içinde, her biri
  dayanağıyla birlikte durur; değişiklikle birlikte `scripts/mevzuat-testi.ts`'e test ekle
  ve `npm run test:mevzuat` geçsin.
- **Veritabanı:** şema değişikliği yeni bir migration dosyasıyla yapılır
  (`supabase/migrations/00XX_aciklama.sql`). Eski migration'lar değiştirilmez. Yeni tablo
  açarsan RLS'yi aç ve `public.yetkili_mi()` ile koru.
- **Gerçek kişi verisi yok:** örneklerde, testlerde ve ekran görüntülerinde yalnızca kurgu
  isimler ve `99…` ile başlayan sahte TC numaraları kullan (`supabase/seed.sql`).
- **Dil ve ton:** arayüz Türkçe, kullanıcıya "sen" diye hitap eder; sakin, net, ünlemsiz.
  Hata mesajı ne olduğunu ve nasıl düzeleceğini söyler.
- Göndermeden önce: `npm run lint`, `npx tsc --noEmit`, `npm run test:mevzuat`,
  `npm run build`.

*Contributions are welcome. Legal rules live in `src/lib/mevzuat.ts` with their sources;
schema changes go in new migration files; never use real personal data. Run lint, type
check, rule tests and build before opening a pull request.*
