# Yapay zekâ ajanları için / For AI agents

**Kurulum isteniyorsa:** [KURULUM.md](KURULUM.md)'yi oku ve adım adım uygula.
*If the user asks you to install Tastamam, follow KURULUM.md step by step.*

## Bu Next.js bildiğin Next.js değil

Bu sürümde API'ler, kurallar ve dosya yapısı eğitim verindekinden farklı olabilir. Kod
yazmadan önce `node_modules/next/dist/docs/` altındaki ilgili rehberi oku, kullanımdan
kalkma uyarılarına uy.

## Proje

Tastamam: Türk iş ve sosyal güvenlik mevzuatına göre işveren kayıt defteri. Next.js (App
Router, TS) + Tailwind + shadcn/ui + Supabase (Postgres, Auth, Storage).

- `src/lib/mevzuat.ts`: bütün süreler, oranlar, tatil takvimi; her kural dayanağıyla.
  Değişiklik → `scripts/mevzuat-testi.ts`'e test, `npm run test:mevzuat`.
- `src/lib/depo/`: belge deposu arayüzü (`yerel` | `supabase` | `onedrive` | `gdrive`),
  `DEPO_SAGLAYICI` ile seçilir. Özlük klasör düzeni `src/lib/ozluk-dosya.ts`.
- `src/lib/istek.ts`: istek başına tek ayarlar okuması ve oturum (React `cache`).
  Sayfalarda bağımsız sorgular `Promise.all` ile paralel çalışır.
- `src/lib/takvim.ts` + `src/lib/hatirlatma.ts`: yasal süre takvimi ve sabah maili;
  zamanlayıcı `src/instrumentation.ts` (yalnızca `npm start`).
- `supabase/migrations/`: şema; yeni değişiklik yeni dosya. Her tablo RLS'li ve
  `public.yetkili_mi()` ile korunur. Uygulama: `npm run kur`.
- `supabase/seed.sql`: kurgu örnek veri, yalnızca boş test projesinde.

## Kurallar

- Gerçek kişi verisi kodda, testte, örnekte, ekran görüntüsünde yer almaz.
- Arayüz metni Türkçe, "sen" hitabı, sakin ve net; ünlem ve korkutma yok.
- Renk: mor (`--stamp`) yalnızca tamamlanmış durum; turuncu (`--warn`) süre ve eksik;
  mavi (`--pen`) eylem.
- Göndermeden önce: `npm run lint`, `npx tsc --noEmit`, `npm run test:mevzuat`, `npm run build`.
