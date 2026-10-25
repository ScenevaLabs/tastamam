import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export type GelenPdfEki = {
  token: string;
  dosyaAdi: string;
  konu: string;
  gonderenEmail: string;
  tarih: string;
  referansKodu: string | null;
  /** Alan sunucu (Authentication-Results) göndereni doğruladı mı: DMARC geçti
   *  ya da DKIM/SPF gönderenin alan adıyla geçti. From satırı taklit edilebildiği
   *  için doğrulanmamış mail REF'siz otomatik dosyalanmaz. */
  gonderenDogrulandi: boolean;
};

/** En üstteki Authentication-Results başlığı (gelen kutusunun sunucusunun
 *  eklediği) gönderenin alan adı için geçiş gösteriyor mu. Alttaki başlıkları
 *  gönderen kendisi yazabileceği için yalnızca ilki okunur. */
export function gondereniDogrula(sonuc: unknown, gonderenEmail: string): boolean {
  const ilk = Array.isArray(sonuc) ? sonuc[0] : sonuc;
  if (typeof ilk !== "string") return false;
  const alan = gonderenEmail.split("@")[1]?.toLowerCase();
  if (!alan) return false;
  const metin = ilk.toLowerCase();
  if (/\bdmarc=pass\b/.test(metin)) return true;
  // İmzalayan alan gönderenin kendisi ya da üst alanı olmalı (tek etiketli "com" sayılmaz).
  const alanUyar = (d: string) => d.includes(".") && (d === alan || alan.endsWith("." + d));
  for (const m of metin.matchAll(/\bdkim=pass\b[^;]*?header\.d=([a-z0-9.-]+)/g)) if (alanUyar(m[1])) return true;
  for (const m of metin.matchAll(/\bspf=pass\b[^;]*?smtp\.mailfrom=(?:[^@\s;]*@)?([a-z0-9.-]+)/g)) if (alanUyar(m[1])) return true;
  return false;
}

// Bulunan PDF ekleri geçici olarak burada tutulur (v1 tek Node süreci
// üzerinde çalışıyor — Faz 8'de Graph API'ye geçilince bu yaklaşım
// gözden geçirilmeli, serverless ortamda süreçler arası paylaşılmaz).
const ekCache = new Map<string, Buffer>();

export async function gelenPdfEkleriniTara(
  maliMusavirEmail: string,
): Promise<{ ekler: GelenPdfEki[]; error: string | null }> {
  const host = process.env.IMAP_HOST;
  const port = process.env.IMAP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return {
      ekler: [],
      error: "IMAP ayarları tanımlı değil (.env.local'deki IMAP_HOST/IMAP_PORT'a bakın).",
    };
  }

  const client = new ImapFlow({
    host,
    port: Number(port),
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const ekler: GelenPdfEki[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const otuzGunOnce = new Date();
      otuzGunOnce.setDate(otuzGunOnce.getDate() - 30);

      const uidler = await client.search(
        { from: maliMusavirEmail, since: otuzGunOnce },
        { uid: true },
      );

      if (uidler && uidler.length > 0) {
        for await (const mesaj of client.fetch(uidler, { source: true }, { uid: true })) {
          if (!mesaj.source) continue;
          const parsed = await simpleParser(mesaj.source);
          const pdfEkler = (parsed.attachments ?? []).filter(
            (a) => a.contentType === "application/pdf",
          );
          if (pdfEkler.length === 0) continue;

          const konu = parsed.subject ?? "(konusuz)";
          const refMatch = konu.match(/\[REF:([A-F0-9]{8})\]/i);
          const referansKodu = refMatch ? refMatch[1].toUpperCase() : null;
          // IMAP "from" araması alt dize eşleştirir; adres birebir aynı olmalı.
          const gonderenEmail = parsed.from?.value?.[0]?.address ?? "";
          if (gonderenEmail.toLowerCase() !== maliMusavirEmail.trim().toLowerCase()) continue;
          const gonderenDogrulandi = gondereniDogrula(parsed.headers.get("authentication-results"), gonderenEmail);
          const tarih = (parsed.date ?? new Date()).toISOString();

          for (const ek of pdfEkler) {
            const token = crypto.randomUUID();
            ekCache.set(token, ek.content as Buffer);
            ekler.push({
              token,
              dosyaAdi: ek.filename ?? "belge.pdf",
              konu,
              gonderenEmail,
              tarih,
              referansKodu,
              gonderenDogrulandi,
            });
          }
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e) {
    return { ekler: [], error: e instanceof Error ? e.message : "IMAP bağlantısı başarısız." };
  }

  return { ekler, error: null };
}

export function ekBufferAl(token: string): Buffer | undefined {
  return ekCache.get(token);
}

export function ekTemizle(token: string): void {
  ekCache.delete(token);
}
