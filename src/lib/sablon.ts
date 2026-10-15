import fs from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { createClient } from "@/lib/supabase/server";

// Belge şablonları (15 Ekim 2026). Not: bu kurulumun belirli süreli sözleşmesi
// kullanıcının kendi metnidir; açık kaynak sürümde public-katman/templates/
// altındaki genel örnek bunun yerine geçer (public-disa-aktar.mjs).
// iş sözleşmesi (belirli / belirsiz süreli),
// KVKK aydınlatma metni, açık rıza beyanı. Uygulama örnek şablonlarla gelir
// (templates/); kullanıcı Ayarlar'dan aynı yer tutucuları içeren kendi .docx
// şablonunu yüklerse o kullanılır (sablon tablosu, migration 0028).

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const SABLON_ADLARI = [
  "sozlesme_belirli",
  "sozlesme_belirsiz",
  "kvkk_aydinlatma",
  "kvkk_acik_riza",
  "fazla_calisma_onayi",
  "calisma_belgesi",
  "zimmet_tutanagi",
] as const;
export type SablonAdi = (typeof SABLON_ADLARI)[number];

const SOZLESME_ALANLARI = [
  "AD_SOYAD",
  "TC",
  "ADRES",
  "MESLEK",
  "UCRET",
  "IMZA_TARIHI",
  "BASLAMA_TARIHI",
  "BITIS_TARIHI",
  "SIRKET_UNVANI",
  "SIRKET_ADRESI",
] as const;
const KVKK_ALANLARI = ["AD_SOYAD", "TC", "TARIH", "SIRKET_UNVANI", "SIRKET_ADRESI"] as const;

export const SABLONLAR: Record<SablonAdi, { etiket: string; dosya: string; alanlar: readonly string[] }> = {
  sozlesme_belirli: { etiket: "Belirli süreli iş sözleşmesi", dosya: "sozlesme-belirli-sureli.docx", alanlar: SOZLESME_ALANLARI },
  sozlesme_belirsiz: {
    etiket: "Belirsiz süreli iş sözleşmesi",
    dosya: "sozlesme-belirsiz-sureli.docx",
    alanlar: SOZLESME_ALANLARI.filter((a) => a !== "BITIS_TARIHI"),
  },
  kvkk_aydinlatma: { etiket: "KVKK aydınlatma metni", dosya: "kvkk-aydinlatma.docx", alanlar: KVKK_ALANLARI },
  kvkk_acik_riza: { etiket: "Açık rıza beyanı", dosya: "kvkk-acik-riza.docx", alanlar: KVKK_ALANLARI },
  fazla_calisma_onayi: { etiket: "Fazla çalışma onay belgesi", dosya: "fazla-calisma-onayi.docx", alanlar: KVKK_ALANLARI },
  calisma_belgesi: {
    etiket: "Çalışma belgesi",
    dosya: "calisma-belgesi.docx",
    alanlar: [...KVKK_ALANLARI, "MESLEK", "BASLAMA_TARIHI", "BITIS_TARIHI"],
  },
  zimmet_tutanagi: {
    etiket: "Zimmet tutanağı",
    dosya: "zimmet-tutanagi.docx",
    // ESYA, SERI_NO, VERILIS {#ESYALAR}…{/ESYALAR} döngüsünün içinde, her eşya için bir satır.
    alanlar: [...KVKK_ALANLARI, "ESYA", "SERI_NO", "VERILIS"],
  },
};

export const ALAN_ACIKLAMASI: Record<string, string> = {
  AD_SOYAD: "çalışanın adı soyadı",
  TC: "T.C. kimlik no",
  ADRES: "çalışanın adresi",
  MESLEK: "meslek / görev",
  UCRET: "ücret (ör. 42.000,00 TL)",
  IMZA_TARIHI: "imza tarihi",
  BASLAMA_TARIHI: "işe başlama tarihi",
  BITIS_TARIHI: "bitiş / çıkış tarihi",
  TARIH: "belgenin tarihi",
  ESYA: "eşya ({#ESYALAR}…{/ESYALAR} içinde)",
  SERI_NO: "seri / demirbaş no",
  VERILIS: "teslim tarihi",
  SIRKET_UNVANI: "şirket unvanı (Ayarlar)",
  SIRKET_ADRESI: "şirket adresi (Ayarlar)",
};

export async function ornekSablon(ad: SablonAdi): Promise<Buffer> {
  return fs.readFile(path.join(process.cwd(), "templates", SABLONLAR[ad].dosya));
}

/** Kullanıcının yüklediği şablon, yoksa örnek. */
export async function gecerliSablon(supabase: Supabase, ad: SablonAdi): Promise<{ icerik: Buffer; ozel: boolean }> {
  const { data } = await supabase.from("sablon").select("icerik_b64").eq("ad", ad).maybeSingle();
  if (data?.icerik_b64) return { icerik: Buffer.from(data.icerik_b64 as string, "base64"), ozel: true };
  return { icerik: await ornekSablon(ad), ozel: false };
}

function docxtemplater(icerik: Buffer): Docxtemplater {
  return new Docxtemplater(new PizZip(icerik), {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{", end: "}" },
    // Şablonda olup veride olmayan alan boş kalır ("undefined" yazılmasın).
    nullGetter: () => "",
  });
}

function hataMetni(e: unknown): string {
  const hatalar = (e as { properties?: { errors?: { properties?: { explanation?: string } }[] } })?.properties?.errors;
  if (hatalar?.length) return hatalar.map((h) => h.properties?.explanation).filter(Boolean).join("; ");
  return e instanceof Error ? e.message : String(e);
}

export function sablonDoldur(icerik: Buffer, veri: Record<string, unknown>): Buffer {
  const doc = (() => {
    try {
      return docxtemplater(icerik);
    } catch (e) {
      throw new Error(`Şablon okunamadı: ${hataMetni(e)}`);
    }
  })();
  try {
    doc.render(veri);
  } catch (e) {
    throw new Error(`Şablon doldurulamadı: ${hataMetni(e)}`);
  }
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

/** Yüklenen şablonu doğrular: .docx açılıyor mu, yer tutucular düzgün mü,
 *  hangileri tanınmıyor. Dönen `bilinmeyen` uyarı içindir, yüklemeyi engellemez. */
export function sablonDogrula(icerik: Buffer, ad: SablonAdi): { error: string } | { error: null; kullanilan: string[]; bilinmeyen: string[] } {
  let metin: string;
  try {
    const doc = docxtemplater(icerik);
    metin = doc.getFullText();
  } catch (e) {
    return { error: `Dosya Word şablonu olarak okunamadı: ${hataMetni(e)}` };
  }
  const kullanilan = [...new Set([...metin.matchAll(/\{([A-Z_]+)\}/g)].map((m) => m[1]))];
  const bilinmeyen = kullanilan.filter((a) => !SABLONLAR[ad].alanlar.includes(a));
  return { error: null, kullanilan, bilinmeyen };
}
