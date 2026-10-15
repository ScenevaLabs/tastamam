import nodemailer from "nodemailer";
import type { Kisi, IsGirisi } from "@/lib/types";
import { ucretMetni } from "@/lib/utils";

const KISA_TARIH = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function tarihUzun(iso: string): string {
  return KISA_TARIH.format(new Date(iso + "T00:00:00"));
}

function ucretGoster(g: IsGirisi): string {
  return ucretMetni(g.ucret_tutari, g.ucret_periyodu, g.ucret_tipi);
}

function meslekGoster(kisi: Kisi, g: IsGirisi): string {
  const ad = g.meslek_adi ?? kisi.meslek_adi;
  const kod = g.meslek_kodu ?? kisi.meslek_kodu;
  return kod ? `${ad} (${kod})` : ad;
}

// Şirket unvanı Ayarlar'dan gelir; boşsa cümle unvansız kurulur.
function bunyesinde(sirketUnvani: string | null | undefined): string {
  return sirketUnvani ? ` <strong>${sirketUnvani}</strong> bünyesinde` : "";
}

function bunyesinden(sirketUnvani: string | null | undefined): string {
  return sirketUnvani ? ` <strong>${sirketUnvani}</strong> bünyesinden` : " işten";
}

export function iseGirisMailIcerigi(kisi: Kisi, isGirisi: IsGirisi, sirketUnvani?: string | null) {
  const subject = `İş giriş bildirgesi talebi — ${kisi.ad_soyad}`;
  const html = `
    <p>Merhaba,</p>
    <p>Aşağıdaki çalışan için${bunyesinde(sirketUnvani)} işe başlama tarihinden önce iş giriş bildirgesinin hazırlanmasını rica ederim:</p>
    <ul>
      <li><strong>Ad Soyad:</strong> ${kisi.ad_soyad}</li>
      <li><strong>TC Kimlik No:</strong> ${kisi.tc_kimlik_no}</li>
      <li><strong>Meslek:</strong> ${meslekGoster(kisi, isGirisi)}</li>
      <li><strong>İşe giriş tarihi:</strong> ${tarihUzun(isGirisi.giris_tarihi)}</li>
      <li><strong>Ücret:</strong> ${ucretGoster(isGirisi)}</li>
    </ul>
    <p>Teşekkürler.</p>
  `;
  return { subject, html };
}

export function istenAyrilisMailIcerigi(kisi: Kisi, isGirisi: IsGirisi, sirketUnvani?: string | null) {
  const subject = `İşten ayrılış bildirgesi talebi — ${kisi.ad_soyad}`;
  const cikisTarihi = isGirisi.cikis_tarihi ? tarihUzun(isGirisi.cikis_tarihi) : "-";
  const html = `
    <p>Merhaba,</p>
    <p>Aşağıdaki çalışan${bunyesinden(sirketUnvani)} ayrılmıştır. Yasal 10 günlük süre dolmadan işten ayrılış bildirgesinin yapılmasını rica ederim:</p>
    <ul>
      <li><strong>Ad Soyad:</strong> ${kisi.ad_soyad}</li>
      <li><strong>TC Kimlik No:</strong> ${kisi.tc_kimlik_no}</li>
      <li><strong>İşten ayrılış tarihi:</strong> ${cikisTarihi}</li>
      <li><strong>Çıkış nedeni:</strong> ${isGirisi.cikis_nedeni ?? "-"}</li>
    </ul>
    <p>Teşekkürler.</p>
  `;
  return { subject, html };
}

export function topluGirisMailIcerigi(
  satirlar: { kisi: Kisi; isGirisi: IsGirisi }[],
  sirketUnvani?: string | null,
) {
  const tarihler = new Set(satirlar.map((s) => s.isGirisi.giris_tarihi));
  const tekTarih = tarihler.size === 1 ? tarihUzun([...tarihler][0]) : null;
  const subject = tekTarih
    ? `İş giriş bildirgesi talebi — ${satirlar.length} çalışan (${tekTarih})`
    : `İş giriş bildirgesi talebi — ${satirlar.length} çalışan`;

  const satirHtml = satirlar
    .map(
      ({ kisi, isGirisi }) => `
      <tr>
        <td style="padding:4px 16px 4px 0;">${kisi.ad_soyad}</td>
        <td style="padding:4px 16px 4px 0;">${kisi.tc_kimlik_no}</td>
        <td style="padding:4px 16px 4px 0;">${meslekGoster(kisi, isGirisi)}</td>
        <td style="padding:4px 16px 4px 0;">${tarihUzun(isGirisi.giris_tarihi)}</td>
        <td style="padding:4px 0;">${ucretGoster(isGirisi)}</td>
      </tr>`,
    )
    .join("");

  const html = `
    <p>Merhaba,</p>
    <p>Aşağıdaki ${satirlar.length} çalışan için${bunyesinde(sirketUnvani)} işe başlama tarihinden önce iş giriş bildirgelerinin hazırlanmasını rica ederim:</p>
    <table style="border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:4px 16px 4px 0;">Ad Soyad</th>
          <th style="text-align:left;padding:4px 16px 4px 0;">TC Kimlik No</th>
          <th style="text-align:left;padding:4px 16px 4px 0;">Meslek</th>
          <th style="text-align:left;padding:4px 16px 4px 0;">İşe giriş tarihi</th>
          <th style="text-align:left;padding:4px 0;">Ücret</th>
        </tr>
      </thead>
      <tbody>${satirHtml}</tbody>
    </table>
    <p>Teşekkürler.</p>
  `;
  return { subject, html };
}

export function topluAyrilisMailIcerigi(
  satirlar: { kisi: Kisi; isGirisi: IsGirisi }[],
  not?: string | null,
  sirketUnvani?: string | null,
) {
  const tarihler = new Set(satirlar.map((s) => s.isGirisi.cikis_tarihi));
  const tekTarih = tarihler.size === 1 && satirlar[0].isGirisi.cikis_tarihi
    ? tarihUzun(satirlar[0].isGirisi.cikis_tarihi)
    : null;
  const subject = tekTarih
    ? `İşten ayrılış bildirgesi talebi — ${satirlar.length} çalışan (${tekTarih})`
    : `İşten ayrılış bildirgesi talebi — ${satirlar.length} çalışan`;

  const satirHtml = satirlar
    .map(
      ({ kisi, isGirisi }) => `
      <tr>
        <td style="padding:4px 16px 4px 0;">${kisi.ad_soyad}</td>
        <td style="padding:4px 16px 4px 0;">${kisi.tc_kimlik_no}</td>
        <td style="padding:4px 16px 4px 0;">${isGirisi.cikis_tarihi ? tarihUzun(isGirisi.cikis_tarihi) : "-"}</td>
        <td style="padding:4px 0;">${isGirisi.cikis_nedeni ?? "-"}</td>
      </tr>`,
    )
    .join("");

  const html = `
    <p>Merhaba,</p>
    <p>Aşağıdaki ${satirlar.length} çalışan${bunyesinden(sirketUnvani)} ayrılmıştır. Yasal 10 günlük süre dolmadan işten ayrılış bildirgelerinin yapılmasını rica ederim:</p>
    <table style="border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:4px 16px 4px 0;">Ad Soyad</th>
          <th style="text-align:left;padding:4px 16px 4px 0;">TC Kimlik No</th>
          <th style="text-align:left;padding:4px 16px 4px 0;">İşten ayrılış tarihi</th>
          <th style="text-align:left;padding:4px 0;">Çıkış nedeni</th>
        </tr>
      </thead>
      <tbody>${satirHtml}</tbody>
    </table>
    ${not ? `<p><strong>Not:</strong> ${not}</p>` : ""}
    <p>Teşekkürler.</p>
  `;
  return { subject, html };
}

export async function mailGonder(params: {
  to: string;
  cc?: string;
  from: string;
  subject: string;
  html: string;
  ekler?: { filename: string; content: Buffer; contentType?: string }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return {
      ok: false,
      error: "SMTP ayarları tanımlı değil (.env.local'deki SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS'e bakın).",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: params.from,
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      html: params.html,
      attachments: params.ekler,
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: mailHatasiAcikla(e) };
  }
}

/** nodemailer hatasını kullanıcının anlayacağı cümleye çevirir; teknik metin
 *  parantezde kalır (hosting firmasına iletmek için). */
function mailHatasiAcikla(e: unknown): string {
  if (!(e instanceof Error)) return "Mail gönderilemedi.";
  const kod = (e as Error & { code?: string }).code ?? "";
  const neden =
    kod === "ENOTFOUND" || kod === "EDNS"
      ? "Mail sunucusu bulunamadı; SMTP_HOST adresini kontrol et"
      : kod === "ECONNREFUSED" || kod === "ETIMEDOUT" || kod === "ESOCKET" || kod === "ECONNECTION"
        ? "Mail sunucusuna bağlanılamadı; SMTP_HOST ve SMTP_PORT'u ya da internet bağlantısını kontrol et"
        : kod === "EAUTH"
          ? "Mail sunucusu kullanıcı adı ya da şifreyi kabul etmedi; SMTP_USER ve SMTP_PASS'i kontrol et"
          : kod === "EENVELOPE"
            ? "Alıcı ya da gönderen adresi geçersiz; Ayarlar'daki e-posta adreslerini kontrol et"
            : "Mail gönderilemedi";
  return `${neden}. (${e.message})`;
}
