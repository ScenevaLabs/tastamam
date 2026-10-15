import PizZip from "pizzip";
import { pdfMetniniCikar, tcKimlikNolariAyikla } from "@/lib/pdf";
import {
  KOK_BELGE_TIPLERI,
  ISG_BELGE_TIPLERI,
  type IsGirisiBelgeTipi,
  type IsgBelgeTipi,
  type KisiBelgeTipi,
} from "@/lib/types";

// Belgenin içeriğinden (ve gerekirse dosya adından) hangi özlük belgesi
// olduğunu ve kime ait olduğunu bulur — 22 Eylül 2026. Kullanıcı kararıyla
// belge içeriği dışarıya (yapay zeka servisine) gönderilmiyor: sadece
// PDF/DOCX'in metin katmanı okunur. Taranmış PDF ve fotoğraflarda metin
// olmadığı için sadece dosya adına bakılabilir; o da yoksa kullanıcıya sorulur.

export type BelgeTipi = KisiBelgeTipi | IsGirisiBelgeTipi | IsgBelgeTipi;

export function kokTipiMi(tip: BelgeTipi): tip is KisiBelgeTipi {
  return (KOK_BELGE_TIPLERI as readonly string[]).includes(tip);
}

export function isgTipiMi(tip: BelgeTipi): tip is IsgBelgeTipi {
  return (ISG_BELGE_TIPLERI as readonly string[]).includes(tip);
}

/** Büyük harf + Türkçe karakterleri ASCII'ye indirger, boşlukları tekler —
 *  "İŞTEN AYRILIŞ" ile "Isten ayrilis" aynı şeye dönüşsün. */
export function normallestir(s: string): string {
  return s
    .toLocaleUpperCase("tr-TR")
    .replace(/[İIŞĞÜÖÇ]/g, (h) => ({ İ: "I", I: "I", Ş: "S", Ğ: "G", Ü: "U", Ö: "O", Ç: "C" })[h]!)
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ");
}

type Kural = {
  tip: BelgeTipi;
  /** Başlık bölgesinde aranan ifadeler. */
  baslik: string[];
  /** Metnin tamamında aranabilecek kadar ayırt edici ifadeler — başka
   *  belgelerin içinde "geçerken" anılmaz (ör. sözleşme metninde "yıllık
   *  izin" geçer, ama "SİGORTALI İŞE GİRİŞ BİLDİRGESİ" geçmez). */
  ayirtEdici?: string[];
  dosyaAdi: string[];
};

const KURALLAR: Kural[] = [
  { tip: "ibraname", baslik: ["IBRANAME"], ayirtEdici: ["IBRANAME"], dosyaAdi: ["IBRANAME"] },
  {
    tip: "istenayrilis_bildirgesi",
    baslik: ["ISTEN AYRILIS BILDIRGESI", "ISTEN AYRILIS"],
    ayirtEdici: ["SIGORTALI ISTEN AYRILIS BILDIRGESI", "ISTEN AYRILIS BILDIRGESI"],
    dosyaAdi: ["ISTEN AYRILIS", "ISTENAYRILIS", "AYRILIS BILDIRGE", "CIKIS BILDIRGE"],
  },
  {
    tip: "isegiris_bildirgesi",
    baslik: ["ISE GIRIS BILDIRGESI", "SIGORTALI ISE GIRIS"],
    ayirtEdici: ["SIGORTALI ISE GIRIS BILDIRGESI", "ISE GIRIS BILDIRGESI"],
    dosyaAdi: ["ISE GIRIS", "ISEGIRIS", "GIRIS BILDIRGE"],
  },
  {
    tip: "fesih_bildirimi",
    baslik: ["FESIH BILDIRIM", "FESIH IHBAR", "FESHI BILDIRIM"],
    dosyaAdi: ["FESIH"],
  },
  {
    tip: "yillik_izin_yazisi",
    baslik: ["YILLIK UCRETLI IZIN", "YILLIK IZIN", "IZIN TALEP", "IZIN FORMU"],
    dosyaAdi: ["YILLIK IZIN", "TATIL IZIN", "IZIN YAZISI"],
  },
  {
    tip: "isg_egitim_sertifikasi",
    baslik: ["SERTIFIKA", "KATILIM BELGESI"],
    dosyaAdi: ["ISG", "SERTIFIKA"],
  },
  // 9 Ekim 2026: "ORYANTASYON VE İŞBAŞI EĞİTİMİ FORMU" başlığında
  // egitim_formu'nun "EGITIMI FORMU"su da geçer — en erken eşleşme
  // kazandığı için "ORYANTASYON" önde olan başlıkta bu tip seçilir.
  {
    tip: "oryantasyon_formu",
    baslik: ["ORYANTASYON", "ISBASI EGITIM"],
    dosyaAdi: ["ORYANTASYON", "ISBASI"],
  },
  {
    tip: "egitim_formu",
    baslik: ["EGITIM KATILIM", "EGITIM FORMU", "EGITIM KAYIT", "EGITIMI FORMU"],
    dosyaAdi: ["EGITIM FORM", "EGITIM"],
  },
  {
    tip: "saglik_raporu",
    baslik: ["SAGLIK RAPORU", "ISE GIRIS MUAYENE", "ISTIRAHAT RAPORU", "SAGLIK KURULU RAPORU"],
    dosyaAdi: ["SAGLIK RAPOR", "ISTIRAHAT", "MUAYENE"],
  },
  {
    tip: "sinav_sorulari",
    baslik: ["SINAV SORULARI", "SINAV FORMU", "DEGERLENDIRME SINAVI", "ON TEST", "SON TEST"],
    dosyaAdi: ["SINAV"],
  },
  {
    tip: "sozlesme",
    baslik: ["IS SOZLESMESI", "HIZMET SOZLESMESI", "SOZLESMESI"],
    dosyaAdi: ["SOZLESME"],
  },
  {
    tip: "kvkk_acik_riza",
    baslik: ["ACIK RIZA BEYANI", "ACIK RIZA"],
    ayirtEdici: ["ACIK RIZA BEYANI"],
    dosyaAdi: ["ACIK RIZA", "RIZA"],
  },
  {
    tip: "kvkk_aydinlatma",
    baslik: ["AYDINLATMA METNI", "KISISEL VERILERIN KORUNMASI"],
    ayirtEdici: ["AYDINLATMA METNI"],
    dosyaAdi: ["AYDINLATMA", "KVKK"],
  },
  {
    tip: "adli_sicil",
    baslik: ["ADLI SICIL"],
    ayirtEdici: ["ADLI SICIL KAYDI", "ADLI SICIL VE ARSIV"],
    dosyaAdi: ["ADLI SICIL", "SABIKA"],
  },
  {
    tip: "askerlik_durum",
    baslik: ["ASKERLIK DURUM", "ASKERLIK"],
    ayirtEdici: ["ASKERLIK DURUM BELGESI"],
    dosyaAdi: ["ASKERLIK"],
  },
  {
    tip: "nufus_kayit",
    baslik: ["NUFUS KAYIT ORNEGI", "VUKUATLI NUFUS", "NUFUS AILE KAYIT"],
    ayirtEdici: ["NUFUS KAYIT ORNEGI", "VUKUATLI NUFUS KAYIT"],
    dosyaAdi: ["NUFUS KAYIT", "VUKUATLI"],
  },
  {
    tip: "ikametgah",
    baslik: ["YERLESIM YERI", "IKAMETGAH", "ADRES BELGESI"],
    ayirtEdici: ["YERLESIM YERI VE DIGER ADRES BELGESI", "YERLESIM YERI (IKAMETGAH)"],
    dosyaAdi: ["IKAMETGAH", "YERLESIM", "ADRES"],
  },
  {
    tip: "mezuniyet",
    baslik: ["MEZUNIYET", "DIPLOMA", "OGRENIM BELGESI", "MEZUN BELGESI"],
    ayirtEdici: ["MEZUNIYET BELGESI", "YUKSEKOGRETIM MEZUN BELGESI"],
    dosyaAdi: ["MEZUNIYET", "DIPLOMA"],
  },
  {
    tip: "kimlik",
    baslik: ["KIMLIK KARTI", "IDENTITY CARD", "NUFUS CUZDANI"],
    dosyaAdi: ["KIMLIK", "NUFUS CUZDAN"],
  },
  { tip: "imzali_ciktisi", baslik: [], dosyaAdi: ["IMZALI"] },
];

const BASLIK_UZUNLUGU = 400;

/** En erken geçen ifadenin kuralını döner; hiç yoksa null. */
function enErkenEslesme(metin: string, secici: (k: Kural) => string[] | undefined) {
  let enIyi: { tip: BelgeTipi; konum: number } | null = null;
  for (const kural of KURALLAR) {
    for (const ifade of secici(kural) ?? []) {
      const konum = metin.indexOf(ifade);
      if (konum >= 0 && (!enIyi || konum < enIyi.konum)) enIyi = { tip: kural.tip, konum };
    }
  }
  return enIyi?.tip ?? null;
}

export type TipTahmini = { tip: BelgeTipi; kaynak: "icerik" | "dosya_adi" } | null;

export function belgeTipiBul(metin: string, dosyaAdi: string): TipTahmini {
  const n = normallestir(metin);
  if (n.trim()) {
    const baslik = enErkenEslesme(n.slice(0, BASLIK_UZUNLUGU), (k) => k.baslik);
    if (baslik) return { tip: baslik, kaynak: "icerik" };

    const bulunanlar = new Set(
      KURALLAR.filter((k) => k.ayirtEdici?.some((i) => n.includes(i))).map((k) => k.tip),
    );
    // İbraname metninde "işten ayrılış" da geçer — ikisi birlikteyse ibraname.
    if (bulunanlar.has("ibraname")) bulunanlar.delete("istenayrilis_bildirgesi");
    if (bulunanlar.size === 1) return { tip: [...bulunanlar][0], kaynak: "icerik" };
    if (bulunanlar.size > 1) return null; // birden fazla belge türü — karışık, sorulsun
  }

  const ad = normallestir(dosyaAdi.replace(/\.[^.]+$/, ""));
  const adTipi = enErkenEslesme(ad, (k) => k.dosyaAdi);
  return adTipi ? { tip: adTipi, kaynak: "dosya_adi" } : null;
}

/** PDF ve DOCX'in metin katmanını döner; diğer türlerde (fotoğraf vb.) ya
 *  da okunamazsa boş string. */
export async function dosyaMetniniCikar(dosyaAdi: string, buffer: Buffer): Promise<string> {
  const uzanti = dosyaAdi.split(".").pop()?.toLowerCase();
  try {
    if (uzanti === "pdf") return await pdfMetniniCikar(buffer);
    if (uzanti === "docx") {
      const xml = new PizZip(buffer).file("word/document.xml")?.asText() ?? "";
      return xml
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&");
    }
  } catch {
    // bozuk/şifreli dosya — metinsiz kabul edilir
  }
  return "";
}

/** Metin bu kişiye mi ait? TC varsa TC belirleyici; yoksa ad soyad aranır.
 *  "baska": metinde bilinen başka bir kişinin TC'si var, bu kişininki yok. */
export function kisiyeAitMi(
  metin: string,
  kisi: { ad_soyad: string; tc_kimlik_no: string },
  bilinenTcler: Set<string>,
): "evet" | "baska" | "bilinmiyor" {
  if (!metin.trim()) return "bilinmiyor";
  const tcler = tcKimlikNolariAyikla(metin);
  if (tcler.includes(kisi.tc_kimlik_no)) return "evet";
  if (isimGeciyorMu(metin, kisi.ad_soyad)) return "evet";
  if (tcler.some((tc) => tc !== kisi.tc_kimlik_no && bilinenTcler.has(tc))) return "baska";
  return "bilinmiyor";
}

export function isimGeciyorMu(metin: string, adSoyad: string): boolean {
  const n = normallestir(metin);
  const isim = normallestir(adSoyad).trim();
  if (!isim) return false;
  if (n.includes(isim)) return true;
  // Formlarda ad ve soyad ayrı kutularda olabiliyor — tüm parçalar geçiyorsa kabul.
  const parcalar = isim.split(" ").filter((p) => p.length >= 2);
  return parcalar.length >= 2 && parcalar.every((p) => new RegExp(`\\b${p}\\b`).test(n));
}

/** Metindeki tarihleri ISO (YYYY-MM-DD) olarak döner — dönem eşleştirmede
 *  giriş/çıkış tarihiyle karşılaştırmak için. */
export function tarihleriAyikla(metin: string): Set<string> {
  const sonuc = new Set<string>();
  for (const m of metin.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) {
    sonuc.add(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  }
  for (const m of metin.matchAll(/\b(\d{4})[-.](\d{2})[-.](\d{2})\b/g)) {
    sonuc.add(`${m[1]}-${m[2]}-${m[3]}`);
  }
  return sonuc;
}

/** Dönem belgesinin hangi tarihle ilişkili olduğu — giriş belgeleri giriş,
 *  diğerleri çıkış (yoksa giriş) tarihini taşır (ozluk-dosya.ts ile aynı kural). */
export function belgeninDonemTarihi(
  tip: IsGirisiBelgeTipi,
  donem: { giris_tarihi: string; cikis_tarihi: string | null },
): string {
  return tip === "isegiris_bildirgesi" || tip === "sozlesme"
    ? donem.giris_tarihi
    : (donem.cikis_tarihi ?? donem.giris_tarihi);
}

/** Aday dönemler arasından belgeye ait olanı seçer: tek aday varsa o;
 *  birden fazlaysa metindeki tarihlerden ilgili dönem tarihi geçen tek
 *  dönem. Karar verilemezse null. */
export function donemSec<T extends { giris_tarihi: string; cikis_tarihi: string | null }>(
  adaylar: T[],
  tip: IsGirisiBelgeTipi,
  metin: string,
): T | null {
  if (adaylar.length === 1) return adaylar[0];
  if (adaylar.length === 0) return null;
  const tarihler = tarihleriAyikla(metin);
  const eslesen = adaylar.filter((d) => tarihler.has(belgeninDonemTarihi(tip, d)));
  if (eslesen.length === 1) return eslesen[0];
  // İlgili tarih yoksa dönemin herhangi bir tarihi (giriş ya da çıkış) geçen tek dönem
  const genis = adaylar.filter(
    (d) => tarihler.has(d.giris_tarihi) || (d.cikis_tarihi != null && tarihler.has(d.cikis_tarihi)),
  );
  return genis.length === 1 ? genis[0] : null;
}
