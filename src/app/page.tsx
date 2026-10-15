import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { CalisanListesi } from "@/components/calisan-listesi";
import {
  ZORUNLU_KOK_BELGE_TIPLERI,
  DONEM_BELGE_TIPLERI,
  SABIT_DONEM_BELGE_TIPLERI,
  type Kisi,
  type IsGirisi,
  type IsgBelge,
} from "@/lib/types";
import { bugunIso, isgOzeti } from "@/lib/isg";
import { donemPuantajlari, puantajBelgeVerisiYukle } from "@/lib/puantaj-belge";
import { fazlaCalismaVar, kosulluBelgeler, pusulaAylari, takipBaslangici } from "@/lib/donem-belge";
import { ayarlarSatiri } from "@/lib/istek";
import { IS_ILISKISI, engelliKontenjani } from "@/lib/mevzuat";

type Row = {
  kisi: Kisi;
  donemler: IsGirisi[];
  aktif: boolean;
  guncelDonem: IsGirisi;
  eksikToplam: number;
  hicKontrolEdilmedi: boolean;
};

export default async function Home() {
  const supabase = await createClient();

  // Sorgular birbirinden bağımsız: paralel (her biri ~100 ms Atlantik
  // gidiş-dönüşü, bkz. lib/istek.ts).
  // Sadece listede olan tipler sayılır — listeden çıkarılmış tiplerin
  // (referans mektubu, dönem bazlı eski İSG satırları) DB'de kalan
  // satırları sayımı bozmasın.
  const [
    { data: kisiler, error },
    { data: isGirisleri },
    { data: kisiBelgeAll },
    { data: donemBelgeAll },
    { data: isgBelgeAll },
    puantajVeri,
    ayarlar,
    { data: pusulaAll },
  ] = await Promise.all([
    supabase.from("kisi").select("*").returns<Kisi[]>(),
    supabase.from("is_girisi").select("*").order("giris_tarihi", { ascending: false }).returns<IsGirisi[]>(),
    supabase.from("kisi_belge").select("kisi_id, durum").in("belge_tipi", [...ZORUNLU_KOK_BELGE_TIPLERI]),
    supabase.from("is_girisi_belge").select("is_girisi_id, belge_tipi, durum").in("belge_tipi", [...DONEM_BELGE_TIPLERI]),
    supabase.from("isg_belge").select("*").returns<IsgBelge[]>(),
    // Puantaj satırları da dönem eksiği sayılır (14 Ekim 2026).
    puantajBelgeVerisiYukle(supabase, bugunIso()),
    ayarlarSatiri(),
    // Ücret pusulaları (0029; tablo yoksa boş döner).
    supabase.from("ucret_pusulasi").select("kisi_id, ay"),
  ]);
  const bugun = bugunIso();
  const takipBaslangic = takipBaslangici(ayarlar, bugun);
  const pusulaVar = new Set((pusulaAll ?? []).map((p) => `${p.kisi_id}:${String(p.ay).slice(0, 7)}`));
  const isgByKisi = new Map<string, IsgBelge[]>();
  for (const b of isgBelgeAll ?? []) {
    if (!isgByKisi.has(b.kisi_id)) isgByKisi.set(b.kisi_id, []);
    isgByKisi.get(b.kisi_id)!.push(b);
  }

  const donemlerByKisi = new Map<string, IsGirisi[]>();
  for (const g of isGirisleri ?? []) {
    if (!donemlerByKisi.has(g.kisi_id)) donemlerByKisi.set(g.kisi_id, []);
    donemlerByKisi.get(g.kisi_id)!.push(g);
  }

  const kokStats = new Map<string, { var: number; yoksay: number; toplam: number }>();
  for (const b of kisiBelgeAll ?? []) {
    const s = kokStats.get(b.kisi_id) ?? { var: 0, yoksay: 0, toplam: 0 };
    s.toplam++;
    if (b.durum === "var") s.var++;
    if (b.durum === "yoksayildi") s.yoksay++;
    kokStats.set(b.kisi_id, s);
  }

  // Dönem → belge tipi → durum (koşullu belgeler dönemine göre sayılır).
  const donemDurum = new Map<string, Map<string, string>>();
  for (const b of donemBelgeAll ?? []) {
    if (!donemDurum.has(b.is_girisi_id)) donemDurum.set(b.is_girisi_id, new Map());
    donemDurum.get(b.is_girisi_id)!.set(b.belge_tipi, b.durum);
  }


  const rows: Row[] = (kisiler ?? [])
    .map((kisi) => {
      const donemler = donemlerByKisi.get(kisi.id) ?? [];
      if (donemler.length === 0) return null;

      const aktifDonem = donemler.find((d) => d.durum === "aktif");
      const guncelDonem = aktifDonem ?? donemler[0];

      const kok = kokStats.get(kisi.id);
      const kokEksik =
        ZORUNLU_KOK_BELGE_TIPLERI.length -
        (kok?.var ?? 0) -
        (kok?.yoksay ?? 0) +
        isgOzeti(isgByKisi.get(kisi.id) ?? []).eksikSayisi;

      let donemEksikToplam = 0;
      let herhangiDonemKontrolEdildi = false;
      for (const d of donemler) {
        const durumlar = donemDurum.get(d.id);
        if (durumlar) herhangiDonemKontrolEdildi = true;
        const sayilan = [
          ...SABIT_DONEM_BELGE_TIPLERI,
          ...kosulluBelgeler(d, {
            fazlaCalisma: fazlaCalismaVar(puantajVeri.elle, kisi.id, d, takipBaslangic),
            baslangic: takipBaslangic,
          }),
        ];
        const eksik = sayilan.filter((t) => !durumlar?.has(t) || durumlar.get(t) === "yok").length;
        const pusulaEksik = pusulaAylari(d, takipBaslangic, bugun).filter((a) => !pusulaVar.has(`${kisi.id}:${a}`)).length;
        // Ödeme de "eksik" sayısına dahil — belge gibi tek bir kalem (Faz 11 revize).
        const odemeEksik = d.odeme_durumu === "yok" ? 1 : 0;
        const puantajEksik = donemPuantajlari({
          veri: puantajVeri,
          kisiId: kisi.id,
          adSoyad: kisi.ad_soyad,
          donem: d,
          tumDonemler: donemler,
        }).filter((p) => p.eksik).length;
        donemEksikToplam += eksik + odemeEksik + puantajEksik + pusulaEksik;
      }

      const hicKontrolEdilmedi = !kok && !herhangiDonemKontrolEdildi;

      return {
        kisi,
        donemler,
        aktif: !!aktifDonem,
        guncelDonem,
        eksikToplam: kokEksik + donemEksikToplam,
        hicKontrolEdilmedi,
      };
    })
    .filter((r): r is Row => r !== null);

  const aktifRows = rows
    .filter((r) => r.aktif)
    .sort((a, b) => b.guncelDonem.giris_tarihi.localeCompare(a.guncelDonem.giris_tarihi));
  const pasifRows = rows
    .filter((r) => !r.aktif)
    .sort((a, b) => b.guncelDonem.giris_tarihi.localeCompare(a.guncelDonem.giris_tarihi));

  // Engelli istihdamı: 50 ve üzeri işçide %3 (4857 md. 30). Aynı ildeki
  // işyerleri toplanır; uygulama tek işyeri varsayar.
  const engelliGereken = aktifRows.length >= IS_ILISKISI.engelliEsik.deger ? engelliKontenjani(aktifRows.length) : 0;
  const engelliSayisi = aktifRows.filter((r) => r.kisi.engelli).length;

  return (
    <>
      <AppHeader aktif="calisanlar" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-4 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">Çalışanlar</h1>
            <p className="text-muted-foreground">
              {aktifRows.length} aktif, {pasifRows.length} pasif.
            </p>
            {engelliGereken > engelliSayisi && (
              <p className="text-sm font-bold text-[var(--warn)]">
                {aktifRows.length} çalışanla en az {engelliGereken} engelli çalışan istihdam etmen gerekiyor; şu an{" "}
                {engelliSayisi}. <span className="font-mono text-[12px] font-normal">{IS_ILISKISI.engelliOrani.dayanak}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              size="lg"
              className="border-primary px-4 font-bold text-primary"
              render={<Link href="/is-cikisi">İş çıkışı</Link>}
            />
            <Button
              nativeButton={false}
              size="lg"
              className="px-4 font-bold"
              render={<Link href="/is-girisi">İş girişi</Link>}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive">Kayıtlar yüklenemedi: {error.message}</p>
        ) : (
          <CalisanListesi aktifRows={aktifRows} pasifRows={pasifRows} />
        )}
      </div>
    </>
  );
}
