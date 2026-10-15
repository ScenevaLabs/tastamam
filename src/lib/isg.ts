import { ISG_BELGE_TIPLERI, type IsgBelge, type IsgBelgeTipi } from "@/lib/types";

// İSG belgelerinin durumu (8 Ekim 2026, kullanıcı kuralı): temel eğitim
// sertifikasının geçerlilik tarihine kadar beş belge bir kez alınmışsa
// yeter; süre dolunca hepsi "yenilenecek" olarak tekrar eksik görünür.
//
// "Bu döngüde alınmış" sayılma kuralı:
// - Geçerli sertifika varsa: sertifikanın alınma tarihinden en fazla
//   DONGU_TOLERANSI_GUN önce ya da sonra alınmış belge (sağlık raporu
//   genelde eğitimden 1-2 gün önce alınıyor).
// - Sertifikanın süresi dolmuşsa: süre dolduktan sonra alınmış belge
//   (yeni döngü başlamış, sertifika henüz gelmemiş olabilir).
// - Hiç sertifika yoksa: alınmış herhangi bir belge.
export const DONGU_TOLERANSI_GUN = 30;

/** Sertifika geçerlilik tarihi girilmezse önerilen süre (yıl). Gerçek
 *  belgelerde 2 ve 3 yıllık sertifikalar görüldü — form alanı düzenlenebilir. */
export const VARSAYILAN_GECERLILIK_YIL = 3;

export type IsgTipDurumu = {
  durum: "var" | "eksik" | "yoksayildi";
  /** Bu döngüde sayılan belgenin alınma tarihi (durum "var" ise). */
  alinmaTarihi: string | null;
  /** Tüm geçmiş (alınma tarihine göre eskiden yeniye). */
  gecmis: IsgBelge[];
};

export type IsgOzeti = {
  sertifika: { alinmaTarihi: string; gecerlilikTarihi: string | null; gecerli: boolean } | null;
  tipler: Record<IsgBelgeTipi, IsgTipDurumu>;
  eksikSayisi: number;
};

function gunEkle(iso: string, gun: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

export function yilEkle(iso: string, yil: number): string {
  const [y, m, g] = iso.split("-");
  return `${Number(y) + yil}-${m}-${g}`;
}

export function bugunIso(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}

export function isgOzeti(satirlar: IsgBelge[], bugun = bugunIso()): IsgOzeti {
  const alinanlar = satirlar
    .filter((s) => s.durum === "var" && s.alinma_tarihi)
    .sort((a, b) => a.alinma_tarihi!.localeCompare(b.alinma_tarihi!));
  const yoksayilan = new Set(
    satirlar.filter((s) => s.durum === "yoksayildi").map((s) => s.belge_tipi),
  );

  const sonSertifika = alinanlar.filter((s) => s.belge_tipi === "isg_egitim_sertifikasi").at(-1);
  const sertifika = sonSertifika
    ? {
        alinmaTarihi: sonSertifika.alinma_tarihi!,
        gecerlilikTarihi: sonSertifika.gecerlilik_tarihi,
        // Geçerlilik tarihi girilmemişse süresiz kabul edilir.
        gecerli: !sonSertifika.gecerlilik_tarihi || sonSertifika.gecerlilik_tarihi >= bugun,
      }
    : null;

  const donguBaslangici = !sertifika
    ? null
    : sertifika.gecerli
      ? gunEkle(sertifika.alinmaTarihi, -DONGU_TOLERANSI_GUN)
      : gunEkle(sertifika.gecerlilikTarihi!, 1);

  const tipler = {} as Record<IsgBelgeTipi, IsgTipDurumu>;
  let eksikSayisi = 0;
  for (const tip of ISG_BELGE_TIPLERI) {
    const gecmis = alinanlar.filter((s) => s.belge_tipi === tip);
    let sayilan: IsgBelge | undefined;
    if (tip === "isg_egitim_sertifikasi") {
      sayilan = sertifika?.gecerli ? sonSertifika : undefined;
    } else {
      sayilan = gecmis.filter((s) => !donguBaslangici || s.alinma_tarihi! >= donguBaslangici).at(-1);
    }

    let durum: IsgTipDurumu["durum"];
    if (sayilan) durum = "var";
    else if (yoksayilan.has(tip)) durum = "yoksayildi";
    else durum = "eksik";
    if (durum === "eksik") eksikSayisi++;

    tipler[tip] = { durum, alinmaTarihi: sayilan?.alinma_tarihi ?? null, gecmis };
  }

  return { sertifika, tipler, eksikSayisi };
}
