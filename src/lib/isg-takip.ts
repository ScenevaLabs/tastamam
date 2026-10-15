import { ISG, ISG_DIGER, gunFarki, isKazasiSonGun, yilEkle, type TehlikeSinifi } from "@/lib/mevzuat";
import type { IsgBelge, IsKazasi, IsyeriBelge, IsyeriBelgeTipi } from "@/lib/types";

// İSG periyodik takip (15 Ekim 2026, MEVZUAT.md §7). Saf hesap: veriyi
// sayfa ya da hatırlatma görevi yükler, burası yalnızca tarih üretir.
//
// Eğitim tekrarı son temel eğitim tarihinden sayılır (yönetmelikte açık
// değil, KONTROL_EDILECEK). Sertifikaya ayrıca geçerlilik tarihi girildiyse
// ikisinden erken olanı alınır. Hiç temel eğitim yoksa işe girişten
// itibaren 3 ay içinde verilmesi gerekir (md. 8).

/** Bu kadar gün kala "yaklaşıyor" sayılır. */
export const YAKLASIYOR_GUN = 30;

export type VadeDurumu = "tamam" | "yaklasiyor" | "gecikti" | "eksik" | "gereksiz";

export type Vade = {
  /** Son yapıldığı gün (yoksa null). */
  son: string | null;
  /** Bir sonraki son gün. "gereksiz"de null. */
  sonraki: string | null;
  durum: VadeDurumu;
};

export function vadeDurumu(sonraki: string, bugun: string, yapildi: boolean): VadeDurumu {
  if (sonraki < bugun) return "gecikti";
  if (gunFarki(bugun, sonraki) <= YAKLASIYOR_GUN) return "yaklasiyor";
  return yapildi ? "tamam" : "eksik";
}

function ayEkle(iso: string, ay: number): string {
  const [y, m, g] = iso.split("-").map(Number);
  const top = y * 12 + (m - 1) + ay;
  const hy = Math.floor(top / 12);
  const hm = (top % 12) + 1;
  const sonGun = new Date(Date.UTC(hy, hm, 0)).getUTCDate();
  return `${hy}-${String(hm).padStart(2, "0")}-${String(Math.min(g, sonGun)).padStart(2, "0")}`;
}

export type CalisanIsg = {
  iseBaslama: Vade;
  egitim: Vade;
  muayene: Vade;
};

function sonAlinan(belgeler: IsgBelge[], tip: IsgBelge["belge_tipi"]): IsgBelge | undefined {
  return belgeler
    .filter((b) => b.belge_tipi === tip && b.durum === "var" && b.alinma_tarihi)
    .sort((a, b) => a.alinma_tarihi!.localeCompare(b.alinma_tarihi!))
    .at(-1);
}

function yoksayildi(belgeler: IsgBelge[], tip: IsgBelge["belge_tipi"]): boolean {
  return belgeler.some((b) => b.belge_tipi === tip && b.durum === "yoksayildi");
}

export function calisanIsgTakibi(params: {
  sinif: TehlikeSinifi;
  /** Aktif dönemin giriş tarihi. */
  girisTarihi: string;
  belgeler: IsgBelge[];
  bugun: string;
}): CalisanIsg {
  const { sinif, girisTarihi, belgeler, bugun } = params;
  const k = ISG[sinif];

  // İşe başlama eğitimi: işe başlamadan önce, bir kez (oryantasyon formu).
  const oryantasyon = sonAlinan(belgeler, "oryantasyon_formu");
  const iseBaslama: Vade = oryantasyon
    ? { son: oryantasyon.alinma_tarihi, sonraki: null, durum: "tamam" }
    : yoksayildi(belgeler, "oryantasyon_formu")
      ? { son: null, sonraki: null, durum: "gereksiz" }
      : { son: null, sonraki: girisTarihi, durum: girisTarihi < bugun ? "gecikti" : "eksik" };

  const sertifika = sonAlinan(belgeler, "isg_egitim_sertifikasi");
  let egitim: Vade;
  if (sertifika) {
    const yasal = yilEkle(sertifika.alinma_tarihi!, k.egitimTekrarYil);
    const g = sertifika.gecerlilik_tarihi;
    const sonraki = g && g < yasal ? g : yasal;
    egitim = { son: sertifika.alinma_tarihi, sonraki, durum: vadeDurumu(sonraki, bugun, true) };
  } else if (yoksayildi(belgeler, "isg_egitim_sertifikasi")) {
    egitim = { son: null, sonraki: null, durum: "gereksiz" };
  } else {
    const sonraki = ayEkle(girisTarihi, ISG_DIGER.temelEgitimIcinAy.deger);
    egitim = { son: null, sonraki, durum: vadeDurumu(sonraki, bugun, false) };
  }

  const rapor = sonAlinan(belgeler, "saglik_raporu");
  let muayene: Vade;
  if (rapor) {
    const sonraki = yilEkle(rapor.alinma_tarihi!, k.saglikMuayeneYil);
    muayene = { son: rapor.alinma_tarihi, sonraki, durum: vadeDurumu(sonraki, bugun, true) };
  } else if (yoksayildi(belgeler, "saglik_raporu")) {
    muayene = { son: null, sonraki: null, durum: "gereksiz" };
  } else {
    // İşe giriş muayenesi işe başlamadan önce yapılır (6331 md. 15).
    muayene = { son: null, sonraki: girisTarihi, durum: girisTarihi < bugun ? "gecikti" : "eksik" };
  }

  return { iseBaslama, egitim, muayene };
}

export const ISYERI_BELGE_TIPLERI = ["risk_degerlendirmesi", "acil_durum_plani", "tatbikat"] as const;

export const ISYERI_BELGE_ADI: Record<IsyeriBelgeTipi, string> = {
  risk_degerlendirmesi: "Risk değerlendirmesi",
  acil_durum_plani: "Acil durum eylem planı",
  tatbikat: "Acil durum tatbikatı",
};

export function isyeriBelgePeriyoduYil(tip: IsyeriBelgeTipi, sinif: TehlikeSinifi): number {
  if (tip === "risk_degerlendirmesi") return ISG[sinif].riskDegerlendirmeYil;
  if (tip === "acil_durum_plani") return ISG[sinif].acilDurumPlaniYil;
  return ISG_DIGER.tatbikatYil.deger;
}

export type IsyeriBelgeTakibi = Vade & {
  tip: IsyeriBelgeTipi;
  /** Risk değerlendirmesinden sonra iş kazası oldu: süre beklenmeden yenilenir. */
  kazaSonrasiYenilenmeli: boolean;
};

export function isyeriBelgeTakibi(params: {
  sinif: TehlikeSinifi;
  belgeler: IsyeriBelge[];
  /** Ramak kala dışındaki en son iş kazası/meslek hastalığı tarihi. */
  sonKaza: string | null;
  bugun: string;
}): IsyeriBelgeTakibi[] {
  const { sinif, belgeler, sonKaza, bugun } = params;
  return ISYERI_BELGE_TIPLERI.map((tip) => {
    const son = belgeler
      .filter((b) => b.tip === tip)
      .map((b) => b.yapilma_tarihi)
      .sort()
      .at(-1);
    if (!son) return { tip, son: null, sonraki: bugun, durum: "eksik", kazaSonrasiYenilenmeli: false };
    const sonraki = yilEkle(son, isyeriBelgePeriyoduYil(tip, sinif));
    const kazaSonrasi = tip === "risk_degerlendirmesi" && !!sonKaza && sonKaza >= son;
    return {
      tip,
      son,
      sonraki: kazaSonrasi ? bugun : sonraki,
      durum: kazaSonrasi ? "gecikti" : vadeDurumu(sonraki, bugun, true),
      kazaSonrasiYenilenmeli: kazaSonrasi,
    };
  });
}

/** SGK bildiriminin son günü; ramak kala bildirilmez (null). Kaza işyeri
 *  dışındaysa ya da meslek hastalığıysa süre öğrenildiği günden işler. */
export function kazaSonGun(k: Pick<IsKazasi, "tur" | "olay_tarihi" | "isyeri_disinda" | "ogrenme_tarihi">): string | null {
  if (k.tur === "ramak_kala") return null;
  const bas = (k.isyeri_disinda || k.tur === "meslek_hastaligi") && k.ogrenme_tarihi ? k.ogrenme_tarihi : k.olay_tarihi;
  return isKazasiSonGun(bas);
}
