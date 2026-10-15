import { BES, IS_ILISKISI, isGunuEkle } from "@/lib/mevzuat";

// Duruma bağlı kayıtlar (15 Ekim 2026, migration 0030). Uygulama yalnızca
// kaydı ve tarihleri tutar; süreleri doğrulanamayan konularda (2026 doğum izni
// değişikliği, gece raporu periyodu) hesap yapmaz, bitiş tarihini kullanıcı girer.

export const DURUM_TURLERI = [
  "gebelik",
  "dogum_izni",
  "sut_izni",
  "gece_raporu",
  "calisma_izni",
  "kosul_degisikligi",
  "savunma",
] as const;
export type DurumTuru = (typeof DURUM_TURLERI)[number];

export type KisiDurum = {
  id: string;
  kisi_id: string;
  tur: DurumTuru;
  baslangic: string;
  bitis: string | null;
  tamamlandi: string | null;
  notu: string | null;
  dosya_adi: string | null;
  created_at: string;
};

export const DURUM_BILGI: Record<
  DurumTuru,
  { etiket: string; baslangic: string; bitis?: string; aciklama: string; dayanak: string }
> = {
  gebelik: {
    etiket: "Gebelik",
    baslangic: "Bildirildiği gün",
    bitis: "Doğum (tahmini)",
    aciklama: "Fazla çalışma ve gece çalışması yaptırılmaz; sağlık muayenesi en geç 6 ayda bir.",
    dayanak: "Fazla Çalışma Yön. md. 8 · İşyeri Hekimi Yön.",
  },
  dogum_izni: {
    etiket: "Doğum izni",
    baslangic: "İznin ilk günü",
    bitis: "İşbaşı",
    aciklama: "İzin günlerini puantajda doğum izni olarak işaretle.",
    dayanak: "4857 md. 74",
  },
  sut_izni: {
    etiket: "Süt izni (emzirme)",
    baslangic: "Başlangıç",
    bitis: "Bitiş",
    aciklama: "Günde bir buçuk saat; bu dönemde fazla çalışma ve gece çalışması yaptırılmaz.",
    dayanak: "4857 md. 74 · Fazla Çalışma Yön. md. 8",
  },
  gece_raporu: {
    etiket: "Gece çalışma sağlık raporu",
    baslangic: "Rapor tarihi",
    bitis: "Geçerlilik bitişi",
    aciklama: "Gece çalışacak işçide işe başlamadan önce alınır, süresinde yenilenir.",
    dayanak: "4857 md. 69",
  },
  calisma_izni: {
    etiket: "Çalışma izni (yabancı çalışan)",
    baslangic: "İznin başlangıcı",
    bitis: "İznin bitişi",
    aciklama: "Süre dolmadan uzatma başvurusu yapılır.",
    dayanak: "6735 sayılı Uluslararası İşgücü Kanunu",
  },
  kosul_degisikligi: {
    etiket: "Çalışma koşulu değişikliği",
    baslangic: "Yazılı bildirim günü",
    aciklama: "İşçi 6 iş günü içinde yazılı kabul etmezse değişiklik onu bağlamaz.",
    dayanak: "4857 md. 22",
  },
  savunma: {
    etiket: "Savunma tutanağı",
    baslangic: "Savunma günü",
    aciklama: "Davranış ya da verim nedeniyle fesihten önce savunma alınır.",
    dayanak: "4857 md. 19",
  },
};

export function durumAktif(d: Pick<KisiDurum, "baslangic" | "bitis">, tarih: string): boolean {
  return d.baslangic <= tarih && (!d.bitis || d.bitis >= tarih);
}

/** Çalışma koşulu değişikliğine yazılı kabulün son günü (6 iş günü). */
export function kosulKabulSonGun(bildirim: string): string {
  return isGunuEkle(bildirim, IS_ILISKISI.esasliDegisiklikIsGunu.deger);
}

function ayEkle(iso: string, ay: number): string {
  const [y, m, g] = iso.split("-").map(Number);
  const top = y * 12 + (m - 1) + ay;
  const hy = Math.floor(top / 12);
  const hm = (top % 12) + 1;
  const sonGun = new Date(Date.UTC(hy, hm, 0)).getUTCDate();
  return `${hy}-${String(hm).padStart(2, "0")}-${String(Math.min(g, sonGun)).padStart(2, "0")}`;
}

/** BES'ten cayma süresinin son günü: dahil edilmeden itibaren 2 ay. */
export function besCaymaSonGun(katilim: string): string {
  return ayEkle(katilim, BES.caymaAy.deger);
}
