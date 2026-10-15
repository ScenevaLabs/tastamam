import {
  EKSIK_GUN_KODU,
  FAZLA_CALISMA,
  HAFTA_TATILI_GUNU,
  gunEkle,
  haftaGunu,
  tamGunTatilMi,
  yolIzniGunleri,
  type PuantajKodu,
} from "@/lib/mevzuat";
import type { PuantajGun } from "@/lib/types";

// Aylık puantaj (13 Ekim 2026, MEVZUAT.md §2). Veritabanında yalnızca elle
// değiştirilen günler durur; geri kalanı burada üretilir:
//   iş dönemi dışı → boş · elle girilen kod → o kod · Pazar → HT ·
//   tam gün genel tatil → GT · yıllık izin kaydı → Yİ ·
//   izni izleyen ücretsiz yol izni → Üİ ·
//   iş kazası istirahati → R (15 Ekim 2026; Pazar ve tatil kendi kodunda kalır) ·
//   bugünden sonrası → boş (henüz işlenmedi) · diğer → Ç
// Yarım gün tatiller (arife, 28 Ekim) çalışılmış gün sayılır.

export type PuantajIzni = { baslangic: string; bitis: string; yol_izni_gun: number };
/** İş kazası istirahati (is_kazasi.istirahat_bas/bit). */
export type PuantajRaporu = { baslangic: string; bitis: string };

/** Elle değiştirilmemiş bir günün kodu (gelecek gün ayrımı hariç). */
export function varsayilanKod(tarih: string, izinler: PuantajIzni[], raporlar: PuantajRaporu[] = []): PuantajKodu {
  if (haftaGunu(tarih) === HAFTA_TATILI_GUNU) return "HT";
  if (tamGunTatilMi(tarih)) return "GT";
  if (raporlar.some((r) => r.baslangic <= tarih && r.bitis >= tarih)) return "R";
  if (izinler.some((i) => i.baslangic <= tarih && i.bitis >= tarih)) return "Yİ";
  if (izinler.some((i) => i.yol_izni_gun > 0 && yolIzniGunleri(i.bitis, i.yol_izni_gun).includes(tarih))) return "Üİ";
  return "Ç";
}

export type Hucre = {
  tarih: string;
  /** null: iş dönemi dışında. "": gelecek gün, henüz işlenmedi. */
  kod: PuantajKodu | "" | null;
  elle: boolean;
  fazlaSaat: number;
  /** Elle girilen giriş/çıkış saati ("HH:MM"), imzalı çizelge için. */
  giris: string | null;
  cikis: string | null;
};

export type PuantajSatiri = {
  kisiId: string;
  adSoyad: string;
  hucreler: Hucre[];
  calisilan: number;
  /** Ücretli günler (Ç, HT, GT, Yİ) — SGK prim günü önerisi. */
  ucretliGun: number;
  eksik: { kod: PuantajKodu; sgkKodu: string; ad: string; gun: number }[];
  fazlaSaat: number;
};

/** bas ile bit arasındaki aylar ("YYYY-MM"), iki uç dahil. */
export function aylar(bas: string, bit: string): string[] {
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

export function ayinGunleri(ay: string): string[] {
  // ay: "YYYY-MM"
  const gunler: string[] = [];
  for (let t = `${ay}-01`; t.startsWith(ay); t = gunEkle(t, 1)) gunler.push(t);
  return gunler;
}

export function puantajSatiri(params: {
  kisiId: string;
  adSoyad: string;
  ay: string;
  donemler: { giris_tarihi: string; cikis_tarihi: string | null }[];
  izinler: PuantajIzni[];
  raporlar?: PuantajRaporu[];
  elle: PuantajGun[];
  bugun: string;
  /** Ay kapandıysa gelecek gün kavramı yok. */
  kapali: boolean;
}): PuantajSatiri {
  const elleMap = new Map(params.elle.map((g) => [g.tarih, g]));
  const hucreler: Hucre[] = ayinGunleri(params.ay).map((tarih) => {
    const donemde = params.donemler.some(
      (d) => d.giris_tarihi <= tarih && (!d.cikis_tarihi || d.cikis_tarihi >= tarih),
    );
    if (!donemde) return { tarih, kod: null, elle: false, fazlaSaat: 0, giris: null, cikis: null };
    const e = elleMap.get(tarih);
    const fazlaSaat = Number(e?.fazla_saat ?? 0);
    const giris = e?.giris_saati?.slice(0, 5) ?? null;
    const cikis = e?.cikis_saati?.slice(0, 5) ?? null;
    if (e?.kod) return { tarih, kod: e.kod, elle: true, fazlaSaat, giris, cikis };
    const v = varsayilanKod(tarih, params.izinler, params.raporlar);
    // Saati girilmiş gelecek gün de işlenmiş sayılır.
    const kod: Hucre["kod"] = v === "Ç" && !params.kapali && tarih > params.bugun && !giris ? "" : v;
    return { tarih, kod, elle: false, fazlaSaat, giris, cikis };
  });

  const say = (k: PuantajKodu) => hucreler.filter((h) => h.kod === k).length;
  const eksik = (Object.keys(EKSIK_GUN_KODU) as PuantajKodu[])
    .map((k) => ({ kod: k, sgkKodu: EKSIK_GUN_KODU[k]!.kod, ad: EKSIK_GUN_KODU[k]!.ad, gun: say(k) }))
    .filter((e) => e.gun > 0);

  return {
    kisiId: params.kisiId,
    adSoyad: params.adSoyad,
    hucreler,
    calisilan: say("Ç"),
    ucretliGun: say("Ç") + say("HT") + say("GT") + say("Yİ"),
    eksik,
    fazlaSaat: hucreler.reduce((t, h) => t + h.fazlaSaat, 0),
  };
}

/** Saati girilmemiş çalışılan gün sayısı (imza çizelgesi uyarısı). */
export function saatsizCalisilanGun(satir: PuantajSatiri): number {
  return satir.hucreler.filter((h) => (h.kod === "Ç" || ((h.kod === "HT" || h.kod === "GT") && h.fazlaSaat > 0)) && !h.giris)
    .length;
}

export type FazlaCalismaUyarisi = { kisiId: string; adSoyad: string; yilToplam: number; kalan: number };

/** Yıllık 270 saat sınırına yaklaşanlar (%80 ve üstü). */
export function fazlaCalismaUyarilari(
  yilToplamlari: { kisiId: string; adSoyad: string; saat: number }[],
): FazlaCalismaUyarisi[] {
  const sinir = FAZLA_CALISMA.yillikSinirSaat.deger;
  return yilToplamlari
    .filter((k) => k.saat >= sinir * 0.8)
    .sort((a, b) => b.saat - a.saat)
    .map((k) => ({ kisiId: k.kisiId, adSoyad: k.adSoyad, yilToplam: k.saat, kalan: sinir - k.saat }));
}
