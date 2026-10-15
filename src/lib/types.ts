export type Kisi = {
  id: string;
  ad_soyad: string;
  tc_kimlik_no: string;
  meslek_kodu: string;
  meslek_adi: string;
  adres: string | null;
  dogum_tarihi: string | null;
  created_at: string;
};

export type IsGirisi = {
  id: string;
  kisi_id: string;
  durum: "aktif" | "pasif";
  giris_tarihi: string;
  cikis_tarihi: string | null;
  cikis_nedeni: string | null;
  ucret_tutari: number | null;
  ucret_periyodu: UcretPeriyodu | null;
  ucret_tipi: UcretTipi | null;
  meslek_kodu: string | null;
  meslek_adi: string | null;
  odeme_durumu: BelgeDurum;
  odeme_tarihi: string | null;
  /** Çıkışta ödenen yıllık izin ücreti (gün) ve ödenme anı (0023). */
  izin_ucreti_gun?: number | null;
  izin_ucreti_odendi_at?: string | null;
  created_at: string;
};

export type UcretPeriyodu = "gunluk" | "aylik";
export type UcretTipi = "net" | "brut";

export const CIKIS_NEDENLERI = [
  "Proje/sözleşme bitişi",
  "İstifa",
  "İşveren feshi",
  "Diğer",
] as const;

export type IsGirisiWithKisi = IsGirisi & {
  kisi: Kisi;
};

export type BelgeDurum = "var" | "yok" | "yoksayildi";

// Görüntülenen durum: DB satırı yoksa (henüz hiç kontrol edilmemiş) "eksik"
// olarak gösterilir — "yok" ile aynı muameleyi görür, ayrı bir UI durumu değil.
export type GosterilenBelgeDurumu = "var" | "eksik" | "yoksayildi";

export function gosterilenDurum(durum: BelgeDurum | undefined): GosterilenBelgeDurumu {
  if (durum === "var") return "var";
  if (durum === "yoksayildi") return "yoksayildi";
  return "eksik";
}

export const KOK_BELGE_TIPLERI = [
  "adli_sicil",
  "askerlik_durum",
  "ikametgah",
  "mezuniyet",
  "nufus_kayit",
  "kimlik",
  // KVKK (15 Ekim 2026, migration 0028): imzalı aydınlatma metni herkese;
  // açık rıza isteğe bağlı (Ayarlar'da açılır), eksik sayılmaz.
  "kvkk_aydinlatma",
  "kvkk_acik_riza",
] as const;
export type KisiBelgeTipi = (typeof KOK_BELGE_TIPLERI)[number];

/** Eksik sayımına girenler: açık rıza gönüllüdür, verilmemesi eksik değildir. */
export const ZORUNLU_KOK_BELGE_TIPLERI = KOK_BELGE_TIPLERI.filter((t) => t !== "kvkk_acik_riza");

export const KOK_BELGE_ETIKETLERI: Record<KisiBelgeTipi, string> = {
  adli_sicil: "Adli sicil kaydı",
  askerlik_durum: "Askerlik durum belgesi",
  ikametgah: "İkametgah",
  mezuniyet: "Mezuniyet belgesi",
  nufus_kayit: "Nüfus kayıt örneği",
  kimlik: "Kimlik",
  kvkk_aydinlatma: "KVKK aydınlatma metni (imzalı)",
  kvkk_acik_riza: "Açık rıza beyanı (isteğe bağlı)",
};

export const DONEM_BELGE_TIPLERI = [
  "isegiris_bildirgesi",
  "sozlesme",
  "ibraname",
  "istenayrilis_bildirgesi",
  "imzali_ciktisi",
  "fesih_bildirimi",
  "yillik_izin_yazisi",
] as const;
export type IsGirisiBelgeTipi = (typeof DONEM_BELGE_TIPLERI)[number];

export const DONEM_BELGE_ETIKETLERI: Record<IsGirisiBelgeTipi, string> = {
  isegiris_bildirgesi: "İş giriş bildirgesi",
  sozlesme: "Sözleşme",
  ibraname: "İbraname",
  istenayrilis_bildirgesi: "İşten ayrılış bildirgesi",
  imzali_ciktisi: "İmzalı çıktı",
  fesih_bildirimi: "Fesih bildirimi",
  yillik_izin_yazisi: "Yıllık izin yazısı",
};

// 8 Ekim 2026: İSG belgeleri dönemden kişiye taşındı — temel eğitim
// sertifikası geçerli olduğu sürece her dönemde tekrar istenmez
// (bkz. lib/isg.ts, migration 0018).
export const ISG_BELGE_TIPLERI = [
  "isg_egitim_sertifikasi",
  "egitim_formu",
  "oryantasyon_formu",
  "saglik_raporu",
  "sinav_sorulari",
] as const;
export type IsgBelgeTipi = (typeof ISG_BELGE_TIPLERI)[number];

export const ISG_BELGE_ETIKETLERI: Record<IsgBelgeTipi, string> = {
  isg_egitim_sertifikasi: "Temel eğitim sertifikası",
  egitim_formu: "Eğitim katılım formu",
  oryantasyon_formu: "Oryantasyon ve işbaşı eğitimi formu",
  saglik_raporu: "Sağlık raporu",
  sinav_sorulari: "Sınav soruları",
};

export type IsgBelge = {
  id: string;
  kisi_id: string;
  belge_tipi: IsgBelgeTipi;
  durum: "var" | "yoksayildi";
  alinma_tarihi: string | null;
  gecerlilik_tarihi: string | null;
  dosya_adi: string | null;
  notu: string | null;
  created_at: string;
};

export type KisiBelge = {
  id: string;
  kisi_id: string;
  belge_tipi: KisiBelgeTipi;
  durum: BelgeDurum;
  notu: string | null;
  created_at: string;
};

export type IsGirisiBelge = {
  id: string;
  is_girisi_id: string;
  belge_tipi: IsGirisiBelgeTipi;
  durum: BelgeDurum;
  notu: string | null;
  created_at: string;
};

export type Ayarlar = {
  id: true;
  mali_musavir_email: string | null;
  gonderen_email: string | null;
  takip_email: string | null;
  profil_unvan: string | null;
  profil_iletisim: string | null;
  asgari_ucret_aylik: number;
  sirket_unvani: string | null;
  sirket_adresi: string | null;
  isg_email: string | null;
  isg_cc_giris: boolean;
  acik_moduller: Modul[];
  isg_tehlike_sinifi?: "az" | "tehlikeli" | "cok" | null;
  hatirlatma_gun?: number;
  created_at: string;
  updated_at: string;
};

export type MailTipi = "giris" | "cikis";
export type MailDurum = "basarili" | "basarisiz";

export type MailGonderimKaydi = {
  id: string;
  is_girisi_id: string;
  tip: MailTipi;
  durum: MailDurum;
  hata_mesaji: string | null;
  alici_email: string;
  referans_kodu: string | null;
  cikis_notu: string | null;
  created_at: string;
};

// Faz D modülleri (13 Ekim 2026). Mevcut kurulumda kapalı başlar,
// Ayarlar'dan açılır (migration 0021).
export const MODULLER = ["puantaj", "izin", "isg", "takvim"] as const;
export type Modul = (typeof MODULLER)[number];

export const MODUL_ETIKETLERI: Record<Modul, { ad: string; aciklama: string }> = {
  puantaj: { ad: "Puantaj", aciklama: "Aylık çalışma çizelgesi, SGK eksik gün ve fazla çalışma saatleri" },
  izin: { ad: "Yıllık izin", aciklama: "Kıdeme göre hak ediş, izin kayıt belgesi ve imzalı formlar" },
  isg: {
    ad: "İSG ve iş kazası",
    aciklama: "Tehlike sınıfına göre eğitim ve sağlık muayenesi takibi, işyeri belgeleri, iş kazası kaydı",
  },
  takvim: { ad: "Takvim", aciklama: "Bütün yasal süreler tek listede, yaklaşınca sabah maili" },
};

// İSG periyodik takip ve iş kazası (15 Ekim 2026, migration 0026).
export type IsyeriBelgeTipi = "risk_degerlendirmesi" | "acil_durum_plani" | "tatbikat";

export type IsyeriBelge = {
  id: string;
  tip: IsyeriBelgeTipi;
  yapilma_tarihi: string;
  dosya_adi: string | null;
  notu: string | null;
  created_at: string;
};

export type KazaTuru = "is_kazasi" | "meslek_hastaligi" | "ramak_kala";

export const KAZA_TURU_ADI: Record<KazaTuru, string> = {
  is_kazasi: "İş kazası",
  meslek_hastaligi: "Meslek hastalığı",
  ramak_kala: "Ramak kala",
};

export type IsKazasi = {
  id: string;
  kisi_id: string;
  tur: KazaTuru;
  olay_tarihi: string;
  olay_saati: string | null;
  /** İşyeri dışında olduysa süre öğrenildiği günden işler. */
  isyeri_disinda: boolean;
  ogrenme_tarihi: string | null;
  yer: string | null;
  aciklama: string;
  yaralanma: string | null;
  saglik_kurulusu: string | null;
  istirahat_bas: string | null;
  istirahat_bit: string | null;
  taniklar: string | null;
  haber_verildi_at: string | null;
  tutanak_dosya: string | null;
  rapor_dosya: string | null;
  bildirildi_tarihi: string | null;
  created_at: string;
};

export type PuantajGun = {
  kisi_id: string;
  tarih: string;
  kod: "Ç" | "HT" | "GT" | "R" | "Üİ" | "D" | "Dİ" | null;
  fazla_saat: number;
  notu: string | null;
  /** "HH:MM:SS" (Postgres time); ikisi birlikte girilir (0024). */
  giris_saati?: string | null;
  cikis_saati?: string | null;
};

export type YillikIzin = {
  id: string;
  kisi_id: string;
  baslangic: string;
  bitis: string;
  gun: number;
  yol_izni_gun: number;
  form_durumu: "yok" | "var";
  dosya_adi: string | null;
  notu: string | null;
  created_at: string;
};
