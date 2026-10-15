import { gunEkle, gunFarki, izinGunSay, tamYil, yilEkle, yillikIzinGunu } from "@/lib/mevzuat";

// Yıllık izin bakiyesi (13 Ekim 2026, MEVZUAT.md §4).
//
// Kıdem: aynı işverendeki önceki dönemler birleştirilir (4857 md. 54).
// "Etkin başlangıç" = aktif dönemin giriş tarihi − önceki dönemlerin toplam
// günü; hak ediş yıldönümleri buradan sayılır.
//
// Bakiye yalnızca aktif dönemde doğan haklardan oluşur: önceki dönemlerde
// kullanılmayan izin çıkışta ücret olarak ödenir (md. 59), o yüzden yeni
// döneme devretmez. Bu bir varsayım; farklı bir anlaşma varsa izin kaydına
// not düşülür.

export type DonemOzeti = { giris_tarihi: string; cikis_tarihi: string | null };
export type IzinOzeti = { baslangic: string; gun: number };

export type IzinBakiyesi = {
  /** Kıdemin sayıldığı tarih (önceki dönemler eklenmiş). */
  etkinBaslangic: string;
  kidemGun: number;
  /** Son yıldönümünde doğan hak (henüz hak yoksa null). */
  buYilHak: number | null;
  sonHakEdis: string | null;
  devreden: number;
  kullanilan: number;
  kalan: number;
  sonrakiHakEdis: string;
  sonrakiHakGun: number;
};

export function izinBakiyesi(params: {
  donemler: DonemOzeti[];
  dogumTarihi: string | null;
  izinler: IzinOzeti[];
  bugun: string;
}): IzinBakiyesi | null {
  const { donemler, dogumTarihi, izinler, bugun } = params;
  const aktif = donemler
    .filter((d) => !d.cikis_tarihi || d.cikis_tarihi >= bugun)
    .sort((a, b) => b.giris_tarihi.localeCompare(a.giris_tarihi))[0];
  if (!aktif || aktif.giris_tarihi > bugun) return null;

  const oncekiGun = donemler
    .filter((d) => d.cikis_tarihi && d.cikis_tarihi < aktif.giris_tarihi)
    .reduce((t, d) => t + gunFarki(d.giris_tarihi, d.cikis_tarihi!) + 1, 0);
  const etkinBaslangic = gunEkle(aktif.giris_tarihi, -oncekiGun);
  const yas = (tarih: string) => (dogumTarihi ? tamYil(dogumTarihi, tarih) : null);

  // Aktif dönem içinde dolan yıldönümleri ve o yıl doğan haklar.
  const haklar: { tarih: string; gun: number }[] = [];
  let n = 1;
  for (; ; n++) {
    const tarih = yilEkle(etkinBaslangic, n);
    if (tarih > bugun) break;
    if (tarih >= aktif.giris_tarihi) haklar.push({ tarih, gun: yillikIzinGunu(n, yas(tarih)) });
  }
  const sonrakiHakEdis = yilEkle(etkinBaslangic, n);
  const sonrakiHakGun = yillikIzinGunu(n, yas(sonrakiHakEdis));

  const donemIzinleri = izinler.filter((i) => i.baslangic >= aktif.giris_tarihi);
  const son = haklar.at(-1);
  const sonHakEdis = son?.tarih ?? null;
  const oncekiHak = haklar.slice(0, -1).reduce((t, h) => t + h.gun, 0);
  const oncekiKullanim = donemIzinleri
    .filter((i) => !sonHakEdis || i.baslangic < sonHakEdis)
    .reduce((t, i) => t + i.gun, 0);
  const kullanilan = sonHakEdis
    ? donemIzinleri.filter((i) => i.baslangic >= sonHakEdis).reduce((t, i) => t + i.gun, 0)
    : 0;
  // Hak doğmadan kullanılan (avans) izin devredeni eksiye düşürür.
  const devreden = son ? oncekiHak - oncekiKullanim : -oncekiKullanim;
  const buYilHak = son?.gun ?? null;

  return {
    etkinBaslangic,
    kidemGun: gunFarki(etkinBaslangic, bugun) + 1,
    buYilHak,
    sonHakEdis,
    devreden,
    kullanilan,
    kalan: devreden + (buYilHak ?? 0) - kullanilan,
    sonrakiHakEdis,
    sonrakiHakGun,
  };
}

// ── Çıkışta ödenecek izin (4857 md. 59) ────────────────────────────

export type CikisIzinHesabi = {
  /** Çıkış tarihindeki bakiye. Eksiyse avans izin kullanılmış, ödenecek yok. */
  kalan: number;
  /** İş döneminin bitişinden sonraya taşan izin kayıtları (uyarı). */
  tasanlar: { id: string; baslangic: string; bitis: string; tasanGun: number }[];
};

/** Bir dönemin çıkış tarihindeki izin bakiyesi. Çıkıştan sonraya taşan
 *  izinlerin yalnızca çıkışa kadarki günleri kullanılmış sayılır; taşan
 *  kayıt silinmez, uyarı olarak döner (düzeltmeyi kullanıcı yapar). */
export function cikisIzinHesabi(params: {
  donemler: DonemOzeti[];
  cikisTarihi: string;
  dogumTarihi: string | null;
  izinler: { id: string; baslangic: string; bitis: string; gun: number }[];
}): CikisIzinHesabi | null {
  const { cikisTarihi } = params;
  const tasanlar: CikisIzinHesabi["tasanlar"] = [];
  const izinler: IzinOzeti[] = [];
  for (const i of params.izinler) {
    if (i.bitis <= cikisTarihi) {
      izinler.push(i);
      continue;
    }
    const icerdeGun = i.baslangic <= cikisTarihi ? izinGunSay(i.baslangic, cikisTarihi).gun : 0;
    tasanlar.push({ id: i.id, baslangic: i.baslangic, bitis: i.bitis, tasanGun: i.gun - icerdeGun });
    if (icerdeGun > 0) izinler.push({ baslangic: i.baslangic, gun: icerdeGun });
  }
  const b = izinBakiyesi({
    donemler: params.donemler.filter((d) => d.giris_tarihi <= cikisTarihi),
    dogumTarihi: params.dogumTarihi,
    izinler,
    bugun: cikisTarihi,
  });
  if (!b) return null;
  return { kalan: b.kalan, tasanlar };
}

/** Bir günlük ücret. Ücret girilmemişse asgari ücret (aylık / 30); tür
 *  girilmemiş eski kayıtlarda tutar günlük sayılır (aksi söylenmedikçe
 *  ücret günlüktür). */
export function gunlukUcret(
  tutar: number | null,
  periyot: "gunluk" | "aylik" | null,
  asgariUcretAylik: number,
): number {
  if (tutar == null) return asgariUcretAylik / 30;
  return periyot === "aylik" ? tutar / 30 : tutar;
}

/** "4 yıl", "7 ay", "12 gün" */
export function kidemMetni(etkinBaslangic: string, bugun: string): string {
  const yil = tamYil(etkinBaslangic, bugun);
  if (yil >= 1) return `${yil} yıl`;
  let ay = 0;
  while (ay < 12) {
    const [y, m, g] = etkinBaslangic.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + ay + 1, 1));
    const sonGun = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const t = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(g, sonGun)).padStart(2, "0")}`;
    if (t > bugun) break;
    ay++;
  }
  if (ay >= 1) return `${ay} ay`;
  return `${gunFarki(etkinBaslangic, bugun) + 1} gün`;
}
