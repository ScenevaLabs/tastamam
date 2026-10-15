// Belge deposu soyutlaması (Faz C, 13 Ekim 2026). Özlük klasör düzeni
// (AKTİF/PASİF, kişi klasörü, dönem klasörleri, İSG/) lib/ozluk-dosya.ts'te
// kalır; buradaki arayüz yalnızca "yol" ile çalışan temel dosya işlemlerini
// tanımlar. Yollar "/" ile ayrılmış, depo köküne göre mutlak ve Türkçe
// karakterli olabilir ("Özlük/AKTİF/AYŞE DEMİR/…").

export type DepoAdi = "supabase" | "onedrive" | "gdrive" | "yerel";

/** Tarayıcının dosyayı sunucudan geçirmeden doğrudan depoya yazması için.
 *  "parcali": Content-Range'li PUT parçaları (OneDrive, Google Drive).
 *  "tek": tek bir PUT (Supabase imzalı yükleme adresi). */
export type YuklemeOturumu = {
  uploadUrl: string;
  yontem: "parcali" | "tek";
  basliklar?: Record<string, string>;
};

export class DosyaZatenVarHatasi extends Error {
  constructor(dosyaAdi: string, depoEtiketi: string) {
    super(`Bu isimde bir dosya zaten var: ${dosyaAdi}. Önce mevcut dosyayı ${depoEtiketi} klasöründen kaldırın.`);
  }
}

export interface Depo {
  ad: DepoAdi;
  /** Kullanıcıya gösterilen ad: "OneDrive", "Google Drive", "Supabase Storage". */
  etiket: string;
  /** Dosya ya da klasör var mı? */
  varMi(yol: string): Promise<boolean>;
  /** Klasördeki dosyaların adları (alt klasörler hariç). Klasör yoksa []. */
  dosyalariListele(klasorYol: string): Promise<string[]>;
  /** Dosyayı yazar; aynı adlı dosya varsa DosyaZatenVarHatasi fırlatır.
   *  Ara klasörler gerekirse oluşturulur. */
  yaz(yol: string, veri: Buffer): Promise<void>;
  indir(yol: string): Promise<Buffer>;
  klasorOlustur(yol: string): Promise<void>;
  /** Dosya ya da klasörü taşır / yeniden adlandırır. Hedefin üst klasörü
   *  yoksa oluşturulur; hedefte aynı ad varsa çağıran önceden kontrol eder. */
  tasi(kaynakYol: string, hedefYol: string): Promise<void>;
  /** Tarayıcıdan doğrudan yükleme için oturum açar. `origin`, CORS isteyen
   *  depolar (Google Drive) için tarayıcının adresidir. */
  yuklemeOturumuAc(yol: string, origin?: string): Promise<YuklemeOturumu>;
}

export function ustKlasor(yol: string): string {
  return yol.split("/").slice(0, -1).join("/");
}

export function sonParca(yol: string): string {
  return yol.split("/").pop() ?? yol;
}

const ICERIK_TURLERI: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

export function icerikTuru(yol: string): string {
  const uzanti = sonParca(yol).split(".").pop()?.toLowerCase() ?? "";
  return ICERIK_TURLERI[uzanti] ?? "application/octet-stream";
}
