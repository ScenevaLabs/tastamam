import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export type GelenPdfEki = {
  token: string;
  dosyaAdi: string;
  konu: string;
  gonderenEmail: string;
  tarih: string;
  referansKodu: string | null;
  /** Gelen kutusunun sunucusu (MAIL_DOGRULAYICI) göndereni DMARC ya da
   *  uyumlu DKIM ile doğruladı mı. From satırı taklit edilebildiği için
   *  doğrulanmamış mail otomatik dosyalanmaz, elle onaya düşer. */
  gonderenDogrulandi: boolean;
};

/** Authentication-Results başlıklarından, yalnızca bizim sunucumuzun
 *  (authserv-id = MAIL_DOGRULAYICI) eklediği ilki okunur: gönderen kendi
 *  başlığını ekleyebilir, sunucular kendi kimliğini taşıyan gelen başlıkları
 *  siler (RFC 8601). Kabul: dmarc=pass ve header.from gönderenin alanı, ya da
 *  dkim=pass ve header.d gönderenin alanı/üst alanı. SPF From'u kanıtlamaz. */
export function gondereniDogrula(sonuc: unknown, gonderenEmail: string, sunucu: string | undefined): boolean {
  const kimlikBeklenen = sunucu?.trim().toLowerCase();
  const alan = gonderenEmail.split("@").at(-1)?.toLowerCase();
  if (!kimlikBeklenen || !alan || !alan.includes(".")) return false;
  const basliklar = (Array.isArray(sonuc) ? sonuc : [sonuc]).filter((b): b is string => typeof b === "string");
  for (const baslik of basliklar) {
    // Yorumları (iç içe parantez) ve tırnaklı değerleri at, sonra ";" ile böl.
    let temiz = baslik.toLowerCase().replace(/"[^"]*"/g, " ");
    for (let once = ""; once !== temiz; ) [once, temiz] = [temiz, temiz.replace(/\([^()]*\)/g, " ")];
    const [kimlikKismi, ...sonuclar] = temiz.split(";").map((p) => p.trim());
    if (kimlikKismi.split(/\s+/)[0] !== kimlikBeklenen) continue;
    const alanUyar = (d: string | undefined) => !!d && d.includes(".") && (d === alan || alan.endsWith("." + d));
    for (const s of sonuclar) {
      const [yontem, ...parcalar] = s.split(/\s+/);
      const ozellik = new Map(parcalar.map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]));
      if (yontem === "dmarc=pass" && ozellik.get("header.from") === alan) return true;
      if (yontem === "dkim=pass" && alanUyar(ozellik.get("header.d"))) return true;
    }
    return false;
  }
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
          // IMAP "from" araması alt dize eşleştirir; tek From başlığı, tek adres
          // ve birebir aynı adres olmalı.
          const fromSayisi = parsed.headerLines.filter((h) => h.key === "from").length;
          const adresler = parsed.from?.value ?? [];
          if (fromSayisi !== 1 || adresler.length !== 1) continue;
          const gonderenEmail = adresler[0].address ?? "";
          if (gonderenEmail.toLowerCase() !== maliMusavirEmail.trim().toLowerCase()) continue;
          const gonderenDogrulandi = gondereniDogrula(
            parsed.headers.get("authentication-results"),
            gonderenEmail,
            process.env.MAIL_DOGRULAYICI,
          );
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
