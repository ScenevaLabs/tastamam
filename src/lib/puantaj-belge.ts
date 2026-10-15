import { ayarlarSatiri } from "@/lib/istek";
import { raporSatirlari } from "@/lib/puantaj-veri";
import type { createClient } from "@/lib/supabase/server";
import { gunEkle } from "@/lib/mevzuat";
import { ayinGunleri, puantajSatiri, type PuantajIzni, type PuantajSatiri } from "@/lib/puantaj";
import type { PuantajGun } from "@/lib/types";

// Puantajın evrak listesindeki yeri (14 Ekim 2026, kullanıcı isteği): her iş
// döneminin kapsadığı her ay için "Puantaj · Ekim 2026" satırı. Saat
// girilmemiş günler ve imzalı çizelgenin yokluğu dönemin eksiği sayılır.
// Ay (ya da dönem) bitmeden eksik sayılmaz, sadece durumu gösterilir.
// Puantajın kullanılmaya başlandığı aydan (ayarlar.puantaj_baslangic, 0025)
// önceki aylar listelenmez — eski dönemler bir anda eksik görünmesin.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PuantajBelgesi = {
  ay: string; // "YYYY-MM"
  /** Dönem içinde saati girilmemiş çalışılan gün. */
  saatsizGun: number;
  imzaliAt: string | null;
  /** Ay ya da dönem bitti mi (bittiyse imzasız / saatsiz hali eksiktir). */
  vadesi: boolean;
  eksik: boolean;
};

export type PuantajBelgeVerisi = {
  acik: boolean;
  baslangicAy: string;
  bugun: string;
  elle: PuantajGun[];
  izinler: ({ kisi_id: string } & PuantajIzni)[];
  imzalar: Map<string, string>; // `${kisiId}:${ay}` → yüklendi_at
  raporlar: { kisi_id: string; istirahat_bas: string | null; istirahat_bit: string | null }[];
  anliklar: Map<string, PuantajSatiri[]>; // kapanmış ay → dondurulmuş satırlar
};

/** kisiIdler verilmezse herkes için yükler (ana sayfa). */
export async function puantajBelgeVerisiYukle(
  supabase: Supabase,
  bugun: string,
  kisiIdler?: string[],
): Promise<PuantajBelgeVerisi> {
  const ayarlar = await ayarlarSatiri();
  const acik = ((ayarlar?.acik_moduller as string[] | null) ?? []).includes("puantaj");
  // 0025 uygulanmadıysa sütun yok: içinde bulunulan aydan başlar.
  const baslangicAy = ((ayarlar?.puantaj_baslangic as string | null | undefined) ?? bugun).slice(0, 7);
  const bos: PuantajBelgeVerisi = {
    acik,
    baslangicAy,
    bugun,
    elle: [],
    izinler: [],
    imzalar: new Map(),
    raporlar: [],
    anliklar: new Map(),
  };
  if (!acik) return bos;

  const ilk = `${baslangicAy}-01`;
  let gunQ = supabase.from("puantaj_gun").select("*").gte("tarih", ilk);
  let izinQ = supabase
    .from("yillik_izin")
    .select("kisi_id, baslangic, bitis, yol_izni_gun")
    .gte("bitis", gunEkle(ilk, -14));
  let imzaQ = supabase.from("puantaj_imza").select("kisi_id, ay, yuklendi_at").gte("ay", ilk);
  if (kisiIdler) {
    gunQ = gunQ.in("kisi_id", kisiIdler);
    izinQ = izinQ.in("kisi_id", kisiIdler);
    imzaQ = imzaQ.in("kisi_id", kisiIdler);
  }
  let raporQ = supabase
    .from("is_kazasi")
    .select("kisi_id, istirahat_bas, istirahat_bit")
    .not("istirahat_bas", "is", null)
    .or(`istirahat_bit.is.null,istirahat_bit.gte.${ilk}`);
  if (kisiIdler) raporQ = raporQ.in("kisi_id", kisiIdler);
  const [{ data: elle }, { data: izinler }, { data: imzalar }, { data: aylar }, { data: raporlar }] = await Promise.all([
    gunQ.returns<PuantajGun[]>(),
    izinQ.returns<({ kisi_id: string } & PuantajIzni)[]>(),
    imzaQ,
    supabase.from("puantaj_ay").select("ay, kapandi_at, anlik").gte("ay", ilk).not("kapandi_at", "is", null),
    raporQ,
  ]);
  return {
    ...bos,
    elle: elle ?? [],
    izinler: izinler ?? [],
    raporlar: raporlar ?? [],
    imzalar: new Map((imzalar ?? []).map((i) => [`${i.kisi_id}:${String(i.ay).slice(0, 7)}`, i.yuklendi_at as string])),
    anliklar: new Map(
      (aylar ?? []).filter((a) => a.anlik).map((a) => [String(a.ay).slice(0, 7), a.anlik as PuantajSatiri[]]),
    ),
  };
}

function aylar(bas: string, bit: string): string[] {
  const sonuc: string[] = [];
  let [y, m] = bas.slice(0, 7).split("-").map(Number);
  const [sy, sm] = bit.slice(0, 7).split("-").map(Number);
  while (y < sy || (y === sy && m <= sm)) {
    sonuc.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m === 13) {
      m = 1;
      y++;
    }
  }
  return sonuc;
}

/** Bir dönemin puantaj satırları (en yeni ay üstte). */
export function donemPuantajlari(params: {
  veri: PuantajBelgeVerisi;
  kisiId: string;
  adSoyad: string;
  donem: { giris_tarihi: string; cikis_tarihi: string | null };
  tumDonemler: { giris_tarihi: string; cikis_tarihi: string | null }[];
}): PuantajBelgesi[] {
  const { veri, kisiId, donem } = params;
  if (!veri.acik) return [];
  const bas = donem.giris_tarihi > `${veri.baslangicAy}-01` ? donem.giris_tarihi : `${veri.baslangicAy}-01`;
  const bit = donem.cikis_tarihi && donem.cikis_tarihi < veri.bugun ? donem.cikis_tarihi : veri.bugun;
  if (bas > bit) return [];

  return aylar(bas, bit)
    .map((ay) => {
      const satir =
        veri.anliklar.get(ay)?.find((s) => s.kisiId === kisiId) ??
        puantajSatiri({
          kisiId,
          adSoyad: params.adSoyad,
          ay,
          donemler: params.tumDonemler,
          izinler: veri.izinler.filter((i) => i.kisi_id === kisiId),
          raporlar: raporSatirlari(veri.raporlar, kisiId),
          elle: veri.elle.filter((g) => g.kisi_id === kisiId && g.tarih.startsWith(ay)),
          bugun: veri.bugun,
          kapali: veri.anliklar.has(ay),
        });
      const donemSonu = donem.cikis_tarihi ?? "9999-12-31";
      const saatsizGun = satir.hucreler.filter(
        (h) =>
          h.tarih >= donem.giris_tarihi &&
          h.tarih <= donemSonu &&
          (h.kod === "Ç" || ((h.kod === "HT" || h.kod === "GT") && h.fazlaSaat > 0)) &&
          !h.giris,
      ).length;
      const aySonu = ayinGunleri(ay).at(-1)!;
      const vadesi = (donemSonu < aySonu ? donemSonu : aySonu) < veri.bugun;
      const imzaliAt = veri.imzalar.get(`${kisiId}:${ay}`) ?? null;
      return { ay, saatsizGun, imzaliAt, vadesi, eksik: vadesi && (!imzaliAt || saatsizGun > 0) };
    })
    .reverse();
}
