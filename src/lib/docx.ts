import PizZip from "pizzip";

// Kodla üretilen Word belgelerinin ortak parçaları (izin formu, puantaj
// çizelgesi). Şablon dosyası yok; WordprocessingML elle yazılır.

export function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type ParagrafSecenek = { kalin?: boolean; boyut?: number; ortala?: boolean; sag?: boolean; sonra?: number };

export function paragraf(metin: string, opts: ParagrafSecenek = {}): string {
  const rPr = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${opts.kalin ? "<w:b/>" : ""}<w:sz w:val="${(opts.boyut ?? 11) * 2}"/></w:rPr>`;
  const hiza = opts.ortala ? '<w:jc w:val="center"/>' : opts.sag ? '<w:jc w:val="right"/>' : "";
  const pPr = `<w:pPr>${hiza}<w:spacing w:before="0" w:after="${opts.sonra ?? 120}" w:line="240" w:lineRule="auto"/></w:pPr>`;
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${xml(metin)}</w:t></w:r></w:p>`;
}

const KENAR = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"]
  .map((k) => `<w:${k} w:val="single" w:sz="4" w:color="999999"/>`)
  .join("")}</w:tblBorders>`;

export type TabloHucresi = { metin: string } & ParagrafSecenek & { golge?: boolean };

/** Kenarlıklı tablo. genislikler dxa (1 cm ≈ 567). */
export function tablo(genislikler: number[], satirlar: TabloHucresi[][], hucreBosluk = 60): string {
  const toplam = genislikler.reduce((t, g) => t + g, 0);
  const hucre = (h: TabloHucresi, g: number) =>
    `<w:tc><w:tcPr><w:tcW w:w="${g}" w:type="dxa"/>${h.golge ? '<w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/>' : ""}</w:tcPr>${paragraf(h.metin, { ...h, sonra: 0 })}</w:tc>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${toplam}" w:type="dxa"/>${KENAR}<w:tblCellMar><w:top w:w="${hucreBosluk}" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="${hucreBosluk}" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${genislikler
    .map((g) => `<w:gridCol w:w="${g}"/>`)
    .join("")}</w:tblGrid>${satirlar
    .map((s) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${s.map((h, i) => hucre(h, genislikler[i])).join("")}</w:tr>`)
    .join("")}</w:tbl>`;
}

/** İki sütunlu imza alanı. */
export function imzaTablosu(sol: string, sag: string, genislik = 9000, imzaYeri = 900): string {
  const yarim = genislik / 2;
  const hucre = (baslik: string) =>
    `<w:tc><w:tcPr><w:tcW w:w="${yarim}" w:type="dxa"/></w:tcPr>${paragraf(baslik, { kalin: true, ortala: true })}${paragraf("Adı soyadı / imza", { ortala: true, boyut: 9, sonra: imzaYeri })}</w:tc>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${genislik}" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="${yarim}"/><w:gridCol w:w="${yarim}"/></w:tblGrid><w:tr>${hucre(sol)}${hucre(sag)}</w:tr></w:tbl>`;
}

/** A4 dikey .docx paketi. kenarBosluk dxa. */
export function docxPaketle(govde: string, kenarBosluk = 1134): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  // Varsayılanlar açıkça yazılır: styles.xml olmayınca Pages, LibreOffice ve
  // Google Docs kendi satır aralığını koyuyor, tek sayfalık çizelge taşıyordu.
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${govde}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${kenarBosluk}" w:right="${kenarBosluk}" w:bottom="${kenarBosluk}" w:left="${kenarBosluk}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
