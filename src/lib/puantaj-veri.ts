import type { createClient } from "@/lib/supabase/server";
import { bugunIso } from "@/lib/isg";
import { PUANTAJ_KOD_ADI, gunEkle, haftaGunu } from "@/lib/mevzuat";
import {
  ayinGunleri,
  fazlaCalismaUyarilari,
  puantajSatiri,
  type FazlaCalismaUyarisi,
  type PuantajIzni,
  type PuantajSatiri,
  type PuantajRaporu,
} from "@/lib/puantaj";
import type { PuantajGun } from "@/lib/types";
import { xlsxOlustur, type XlsxHucre } from "@/lib/xlsx";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PuantajVerisi = {
  ay: string;
  satirlar: PuantajSatiri[];
  kapandi: string | null;
  gonderildi: string | null;
  gonderimHatasi: string | null;
  /** kisiId → imzalı çizelgenin yüklendiği an (0024). */
  imzalar: Record<string, string>;
  uyarilar: FazlaCalismaUyarisi[];
  bugun: string;
};

export const AY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** is_kazasi satırlarından bir kişinin istirahat aralıkları. Bitiş boşsa tek gün. */
export function raporSatirlari(
  satirlar: { kisi_id: string; istirahat_bas: string | null; istirahat_bit: string | null }[],
  kisiId: string,
): PuantajRaporu[] {
  return satirlar
    .filter((r) => r.kisi_id === kisiId && r.istirahat_bas)
    .map((r) => ({ baslangic: r.istirahat_bas!, bitis: r.istirahat_bit ?? r.istirahat_bas! }));
}

export function ayAdi(ay: string): string {
  return new Date(`${ay}-01T00:00:00Z`).toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function ayKaydir(ay: string, fark: number): string {
  const [y, m] = ay.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + fark, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function puantajYukle(supabase: Supabase, ay: string): Promise<PuantajVerisi> {
  const bugun = bugunIso();
  const gunler = ayinGunleri(ay);
  const ilk = gunler[0];
  const son = gunler.at(-1)!;

  const [
    { data: donemler },
    { data: elle },
    { data: izinler },
    { data: kapanis },
    { data: yilFm },
    { data: imzalar },
    { data: raporlar },
  ] = await Promise.all([
      supabase
        .from("is_girisi")
        .select("kisi_id, giris_tarihi, cikis_tarihi, kisi:kisi_id(ad_soyad)")
        .lte("giris_tarihi", son)
        .or(`cikis_tarihi.is.null,cikis_tarihi.gte.${ilk}`)
        .returns<{ kisi_id: string; giris_tarihi: string; cikis_tarihi: string | null; kisi: { ad_soyad: string } | null }[]>(),
      supabase.from("puantaj_gun").select("*").gte("tarih", ilk).lte("tarih", son).returns<PuantajGun[]>(),
      // Yol izni bitişten sonraki iş günlerine taşar; önceki aydan gelebilir.
      supabase
        .from("yillik_izin")
        .select("kisi_id, baslangic, bitis, yol_izni_gun")
        .lte("baslangic", son)
        .gte("bitis", gunEkle(ilk, -14))
        .returns<({ kisi_id: string } & PuantajIzni)[]>(),
      supabase.from("puantaj_ay").select("*").eq("ay", ilk).maybeSingle(),
      supabase
        .from("puantaj_gun")
        .select("kisi_id, fazla_saat, kisi:kisi_id(ad_soyad)")
        .gte("tarih", `${ay.slice(0, 4)}-01-01`)
        .lte("tarih", `${ay.slice(0, 4)}-12-31`)
        .gt("fazla_saat", 0)
        .returns<{ kisi_id: string; fazla_saat: number; kisi: { ad_soyad: string } | null }[]>(),
      supabase.from("puantaj_imza").select("kisi_id, yuklendi_at").eq("ay", ilk),
      // İş kazası istirahati (0026 yoksa sorgu boş döner).
      supabase
        .from("is_kazasi")
        .select("kisi_id, istirahat_bas, istirahat_bit")
        .not("istirahat_bas", "is", null)
        .lte("istirahat_bas", son)
        .or(`istirahat_bit.is.null,istirahat_bit.gte.${ilk}`),
    ]);

  const kapali = !!kapanis?.kapandi_at;
  const kisiler = new Map<string, string>();
  for (const d of donemler ?? []) kisiler.set(d.kisi_id, d.kisi?.ad_soyad ?? "Bilinmeyen kişi");

  // Kapanmış ay, kapanış anındaki haliyle gösterilir (muhasebeye giden Excel
  // sonradan eklenen kişi ya da izinle değişmesin). Anlık kopyası olmayan eski
  // kapanışlar canlı hesaplanır.
  const anlik = kapali ? (kapanis?.anlik as PuantajSatiri[] | null) : null;
  const satirlar = anlik ?? [...kisiler.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "tr"))
    .map(([kisiId, adSoyad]) =>
      puantajSatiri({
        kisiId,
        adSoyad,
        ay,
        donemler: (donemler ?? []).filter((d) => d.kisi_id === kisiId),
        izinler: (izinler ?? []).filter((i) => i.kisi_id === kisiId),
        raporlar: raporSatirlari(raporlar ?? [], kisiId),
        elle: (elle ?? []).filter((g) => g.kisi_id === kisiId),
        bugun,
        kapali,
      }),
    );

  const toplam = new Map<string, { kisiId: string; adSoyad: string; saat: number }>();
  for (const r of yilFm ?? []) {
    const t = toplam.get(r.kisi_id) ?? { kisiId: r.kisi_id, adSoyad: r.kisi?.ad_soyad ?? "", saat: 0 };
    t.saat += Number(r.fazla_saat);
    toplam.set(r.kisi_id, t);
  }

  return {
    ay,
    satirlar,
    kapandi: kapanis?.kapandi_at ?? null,
    gonderildi: kapanis?.gonderildi_at ?? null,
    gonderimHatasi: kapanis?.gonderim_hatasi ?? null,
    imzalar: Object.fromEntries((imzalar ?? []).map((i) => [i.kisi_id, i.yuklendi_at])),
    uyarilar: fazlaCalismaUyarilari([...toplam.values()]),
    bugun,
  };
}

const HARF = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

/** Muhasebeye giden Excel: kişi × gün kodları, çalışılan, ücretli gün, SGK
 *  eksik gün (öneri) ve fazla çalışma saati. */
export function puantajExcel(v: PuantajVerisi): Buffer {
  const gunler = ayinGunleri(v.ay);
  const baslik: XlsxHucre[] = [
    "Çalışan",
    ...gunler.map((g) => `${Number(g.slice(8))} ${HARF[haftaGunu(g)]}`),
    "Çalışılan",
    "Ücretli gün",
    "Eksik gün",
    "Eksik gün nedeni (SGK kodu, öneri)",
    "Fazla çalışma (saat)",
  ];
  const satirlar: XlsxHucre[][] = [baslik];
  for (const s of v.satirlar) {
    satirlar.push([
      s.adSoyad,
      ...s.hucreler.map((h) => (h.kod ? h.kod + (h.fazlaSaat ? ` +${h.fazlaSaat}` : "") : "")),
      s.calisilan,
      s.ucretliGun,
      s.eksik.reduce((t, e) => t + e.gun, 0),
      s.eksik.map((e) => `${e.sgkKodu} ${e.ad} (${e.gun})`).join(", "),
      s.fazlaSaat,
    ]);
  }
  satirlar.push([]);
  satirlar.push([
    "Kodlar: " +
      Object.entries(PUANTAJ_KOD_ADI)
        .map(([k, a]) => `${k} ${a}`)
        .join(", ") +
      ". Eksik gün kodları öneridir, son karar mali müşavirindir.",
  ]);
  return xlsxOlustur(`Puantaj ${v.ay}`, satirlar, [24, ...gunler.map(() => 6), 10, 11, 10, 34, 12]);
}
