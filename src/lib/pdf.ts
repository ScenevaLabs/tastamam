import { PDFParse } from "pdf-parse";
import { PDFDocument } from "pdf-lib";

// Bu belgeler taranmış/fotoğraflanmış değil, SGK sisteminin ürettiği
// gerçek PDF'ler — seçilebilir metin katmanı içeriyorlar (Faz 1.5'te
// aynı yöntemle TC/meslek/tarih okunmuştu). Bu OCR değil, düz metin
// çıkarma. TC kimlik no formda genelde tek tek boşluklu kutularda
// basılı oluyor (ör. "1 3 9 3 9 6 6 0 6 5 8"), bitişik de olabiliyor.
export async function pdfMetniniCikar(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

// Toplu gönderimlerde mali müşavir bazen N kişinin belgesini tek PDF'e
// sayfa sayfa koyuyor (ör. 8 kişilik ibraname tek dosyada, her sayfa bir
// kişi) — bu durumda kişi eşleştirmesi sayfa bazında yapılmalı.
export async function pdfSayfalariniCikar(buffer: Buffer): Promise<string[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => p.text);
  } finally {
    await parser.destroy();
  }
}

/** PDF'in tek bir sayfasını ayrı bir PDF buffer'ı olarak döner (0-indeksli). */
export async function pdfSayfasiniAyir(buffer: Buffer, sayfaIndex: number): Promise<Buffer> {
  const kaynak = await PDFDocument.load(buffer);
  const yeni = await PDFDocument.create();
  const [sayfa] = await yeni.copyPages(kaynak, [sayfaIndex]);
  yeni.addPage(sayfa);
  return Buffer.from(await yeni.save());
}

export function tcKimlikNolariAyikla(metin: string): string[] {
  const bulunan = new Set<string>();
  for (const m of metin.matchAll(/\b\d{11}\b/g)) {
    bulunan.add(m[0]);
  }
  // Boşluk/satır sonuyla ayrılmış tek tek rakam dizileri (form kutuları) —
  // TC'nin gerçek başlangıcı bitişik başka bir alandan (ör. boş kutu
  // "0"ları) sızan rakamlarla kayabildiği için, her uzun rakam dizisinden
  // kayan pencereyle tüm 11'li aday alt dizileri çıkarılır; asıl filtre
  // (bilinen bir kişinin TC'siyle eşleşme) çağıran tarafta yapılıyor.
  for (const m of metin.matchAll(/\b(?:\d\s+){3,}\d\b/g)) {
    const rakamlar = m[0].replace(/\s+/g, "");
    for (let i = 0; i + 11 <= rakamlar.length; i++) {
      bulunan.add(rakamlar.slice(i, i + 11));
    }
  }
  return [...bulunan];
}
