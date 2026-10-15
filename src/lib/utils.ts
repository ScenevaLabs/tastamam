import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const KISA_TARIH = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
const KISA_TARIH_YIL = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatTarih(iso: string, yilIle = true): string {
  const d = new Date(iso + "T00:00:00");
  return (yilIle ? KISA_TARIH_YIL : KISA_TARIH).format(d);
}

export function formatDonemAraligi(giris: string, cikis: string | null): string {
  if (!cikis) return `${formatTarih(giris)} itibarıyla`;
  return `${formatTarih(giris, false)} – ${formatTarih(cikis)}`;
}

/** ISO (YYYY-MM-DD) tarihi resmi belge formatına (DD/MM/YYYY) çevirir. */
export function tarihSlash(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Bir ISO tarihten bir gün öncesini döner — sözleşme imza tarihi kuralı
 *  (imza, işe başlama tarihinden bir gün önce olmalı). */
export function birGunOnce(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Bir dönemin kaç gün sürdüğünü döner (giriş ve çıkış dahil). Çıkış yoksa
 *  (devam eden dönem) bugüne kadar sayılır. */
export function donemGunSayisi(girisTarihi: string, cikisTarihi: string | null): number {
  const giris = new Date(girisTarihi + "T00:00:00");
  const bitis = cikisTarihi ? new Date(cikisTarihi + "T00:00:00") : new Date(new Date().toDateString());
  const fark = Math.round((bitis.getTime() - giris.getTime()) / 86400000) + 1;
  return Math.max(1, fark);
}

/** Bir dönem için ödenmesi gereken tutar. Eski kayıtlarda (periyot
 *  girilmemiş) `ucretTutari` sözleşmedeki nihai/toplam tutardır —
 *  giriş/çıkış tarih aralığı sadece SGK kaydı için olabilir, gerçek
 *  çalışılan gün sayısıyla birebir örtüşmeyebilir (29 Ağustos 2026).
 *  22 Eylül 2026'dan itibaren ücret günlük/aylık girilebiliyor: günlükse
 *  tutar × gün, aylıksa tutar / 30 × gün. Tutar girilmemişse (asgari
 *  ücret) aylık asgari ücret gün sayısına göre oranlanır. */
export function donemOdenecekTutar(
  girisTarihi: string,
  cikisTarihi: string | null,
  ucretTutari: number | null,
  asgariUcretAylik: number,
  ucretPeriyodu: "gunluk" | "aylik" | null = null,
): number {
  const gun = donemGunSayisi(girisTarihi, cikisTarihi);
  if (ucretTutari === null) return (asgariUcretAylik / 30) * gun;
  if (ucretPeriyodu === "gunluk") return ucretTutari * gun;
  if (ucretPeriyodu === "aylik") return (ucretTutari / 30) * gun;
  return ucretTutari;
}

// "₺" simgesi arayüzün mono yazı tipinde yok; yedek yazı tipinde sterline
// benziyordu (14 Ekim 2026). Tutarlar "1.250,00 TL" biçiminde yazılır.
const SAYI = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatPara(tutar: number): string {
  return `${SAYI.format(tutar)} TL`;
}

/** Ücreti türüyle birlikte yazar: "Günlük net 2.500,00 TL", "Aylık brüt
 *  45.000,00 TL". Tutar yoksa "Asgari ücret"; eski kayıtlarda (tür
 *  girilmemiş) sadece tutar. */
export function ucretMetni(
  tutar: number | null,
  periyot: "gunluk" | "aylik" | null,
  tip: "net" | "brut" | null,
): string {
  if (tutar == null) return "Asgari ücret";
  const onEk = [
    periyot === "gunluk" ? "Günlük" : periyot === "aylik" ? "Aylık" : null,
    tip === "net" ? "net" : tip === "brut" ? "brüt" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const metin = onEk ? `${onEk} ${formatPara(tutar)}` : formatPara(tutar);
  return metin.charAt(0).toLocaleUpperCase("tr-TR") + metin.slice(1);
}
