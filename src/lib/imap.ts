import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export type GelenPdfEki = {
  token: string;
  dosyaAdi: string;
  konu: string;
  gonderenEmail: string;
  tarih: string;
  referansKodu: string | null;
};

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
          const gonderenEmail = parsed.from?.value?.[0]?.address ?? maliMusavirEmail;
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
