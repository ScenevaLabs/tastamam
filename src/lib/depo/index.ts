import type { Depo, DepoAdi } from "@/lib/depo/tipler";
import { supabaseDepo } from "@/lib/depo/supabase";
import { onedriveDepo } from "@/lib/depo/onedrive";
import { gdriveDepo } from "@/lib/depo/gdrive";
import { yerelDepo } from "@/lib/depo/yerel";

export * from "@/lib/depo/tipler";

/** Hangi deponun kullanılacağı kurulumda .env'deki DEPO_SAGLAYICI ile
 *  seçilir (supabase | onedrive | gdrive | yerel). Sonradan değiştirilirse eski
 *  belgeler taşınmaz. Tanımlı değilse: eski kurulumlarla uyum için
 *  OZLUK_ONEDRIVE_KOK varsa OneDrive, yoksa Supabase Storage. */
export function depoAdi(): DepoAdi {
  const secim = process.env.DEPO_SAGLAYICI?.trim().toLowerCase();
  if (secim === "supabase" || secim === "onedrive" || secim === "gdrive" || secim === "yerel") return secim;
  if (secim) throw new Error(`DEPO_SAGLAYICI geçersiz: "${secim}" (supabase | onedrive | gdrive | yerel).`);
  return process.env.OZLUK_ONEDRIVE_KOK ? "onedrive" : "supabase";
}

export function depo(): Depo {
  switch (depoAdi()) {
    case "onedrive":
      return onedriveDepo;
    case "gdrive":
      return gdriveDepo;
    case "yerel":
      return yerelDepo;
    default:
      return supabaseDepo;
  }
}

/** Özlük klasörlerinin depodaki kök yolu (AKTİF/ ve PASİF/ bunun altında). */
export function ozlukKoku(): string {
  return (process.env.OZLUK_KOK || process.env.OZLUK_ONEDRIVE_KOK || "Özlük").replace(/^\/+|\/+$/g, "");
}
