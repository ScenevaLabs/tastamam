import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// OAuth token'ları `ayarlar` tablosunda şifreli durur (AES-256-GCM, 25 Ekim 2026).
// Anahtar, ilgili sağlayıcının istemci sırrından (MS_CLIENT_SECRET /
// GOOGLE_CLIENT_SECRET) türetilir: veritabanı tek başına sızsa token okunamaz,
// kurulumda yeni bir ortam değişkeni gerekmez. İstemci sırrı değişirse eski
// token çözülemez; Ayarlar'dan yeniden bağlanmak yeter.

const ONEK = "enc:v1:";

function anahtar(sir: string): Buffer {
  return Buffer.from(hkdfSync("sha256", sir, "tastamam", "oauth-token", 32));
}

export function tokenSifrele(duz: string, sir: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", anahtar(sir), iv);
  const govde = Buffer.concat([c.update(duz, "utf8"), c.final()]);
  return ONEK + Buffer.concat([iv, c.getAuthTag(), govde]).toString("base64");
}

/** Şifreli değeri çözer; eski (şifrelenmemiş) kayıtları olduğu gibi döner.
 *  `eski` true ise çağıran değeri şifreleyip yeniden yazmalı. */
export function tokenCoz(deger: string, sir: string): { duz: string; eski: boolean } {
  if (!deger.startsWith(ONEK)) return { duz: deger, eski: true };
  const ham = Buffer.from(deger.slice(ONEK.length), "base64");
  // iv (12) + etiket (16) + en az boş gövde; kısa etiketle doğrulama zayıflamasın.
  if (ham.length < 28) {
    throw new Error("Kayıtlı bağlantı bozuk. Ayarlar sayfasından yeniden bağlanın.");
  }
  const d = createDecipheriv("aes-256-gcm", anahtar(sir), ham.subarray(0, 12), { authTagLength: 16 });
  d.setAuthTag(ham.subarray(12, 28));
  try {
    return { duz: Buffer.concat([d.update(ham.subarray(28)), d.final()]).toString("utf8"), eski: false };
  } catch {
    throw new Error("Kayıtlı bağlantı çözülemedi (istemci sırrı değişmiş olabilir). Ayarlar sayfasından yeniden bağlanın.");
  }
}
