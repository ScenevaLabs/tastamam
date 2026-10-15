// Uygulamanın hesapladığı her süre, oran ve eşik buradan gelir. Kaynak
// metin ve gerekçeler: MEVZUAT.md (onay 13 Ekim 2026). Bir kural
// değişirse önce MEVZUAT.md, sonra burası güncellenir; KONTROL tarihi de.
//
// Bu dosya hukuki danışmanlık değildir. Rakamlar mevzuat.gov.tr ve Resmî
// Gazete metinlerinden okundu; mali müşavirinle teyit et.

export const KONTROL = "2026-10-13";

export type Kural<T> = {
  deger: T;
  dayanak: string;
  /** Resmi metinden doğrulanamadı; kullanırken dikkat. */
  dogrulanmadi?: true;
};

// ── SGK bildirim süreleri ───────────────────────────────────────────

export const SGK = {
  /** İşe giriş bildirgesi çalışma başlamadan en geç bir gün önce verilir. */
  iseGirisOnceGun: { deger: 1, dayanak: "5510 md. 8/1" },
  /** İşten ayrılış bildirgesi sözleşmenin bittiği günden itibaren. */
  ayrilisGun: { deger: 10, dayanak: "5510 md. 9" },
  /** İş kazası ve meslek hastalığı bildirimi (iş günü). */
  isKazasiIsGunu: { deger: 3, dayanak: "5510 md. 13, 6331 md. 14" },
  /** MUHSGK: izleyen ayın bu günü. */
  muhsgkGun: { deger: 26, dayanak: "SSİY md. 102/3" },
  /** Belge ve kayıt saklama: ilgili yılı izleyen yılbaşından itibaren. */
  saklamaYil: { deger: 10, dayanak: "5510 md. 86/2" },
} satisfies Record<string, Kural<number>>;

// ── Çalışma süreleri ve puantaj ─────────────────────────────────────

export const CALISMA = {
  haftalikSaat: { deger: 45, dayanak: "4857 md. 63" },
  gunlukAzamiSaat: { deger: 11, dayanak: "4857 md. 63" },
  /** 45 saat Pazartesi–Cumartesi 6 güne eşit dağıtılır (Cumartesi iş günü,
   *  MEVZUAT.md §2). İşyerinde farklı dağılım varsa burası değişir. */
  gunlukNormalSaat: { deger: 7.5, dayanak: "4857 md. 63 (45 saat / 6 gün)" },
  denklestirmeAy: { deger: 2, dayanak: "4857 md. 63" },
  /** Ara dinlenme, çalışma süresinden sayılmaz: 4 saate kadar 15 dk,
   *  4–7,5 saat (dahil) 30 dk, 7,5 saatten fazla 1 saat. */
  araDinlenme: { deger: { dortSaateKadarDk: 15, yediBucugaKadarDk: 30, fazlasiDk: 60 }, dayanak: "4857 md. 68" },
  belgeleme: { deger: "uygun araçlarla belgelenir", dayanak: "Çalışma Süreleri Yön. md. 9" },
} as const;

export const PUANTAJ_KODLARI = ["Ç", "HT", "GT", "Yİ", "R", "Üİ", "D", "Dİ"] as const;
export type PuantajKodu = (typeof PUANTAJ_KODLARI)[number];

export const PUANTAJ_KOD_ADI: Record<PuantajKodu, string> = {
  Ç: "çalıştı",
  HT: "hafta tatili",
  GT: "genel tatil",
  Yİ: "yıllık izin",
  R: "rapor",
  Üİ: "ücretsiz izin",
  D: "devamsızlık",
  Dİ: "ücretsiz doğum izni",
};

/** SGK eksik gün nedeni (APHB). Muhasebeye "öneri" olarak gider; son kararı
 *  mali müşavir verir. Ücretli günlerin kodu yok. Kaynak: SGK e-bildirge
 *  eksik gün listesi (orta güven, MEVZUAT.md §2). */
export const EKSIK_GUN_KODU: Partial<Record<PuantajKodu, { kod: string; ad: string }>> = {
  R: { kod: "01", ad: "İstirahat" },
  D: { kod: "15", ad: "Devamsızlık" },
  Dİ: { kod: "19", ad: "Ücretsiz doğum izni" },
  Üİ: { kod: "21", ad: "Diğer ücretsiz izin" },
};

// ── Genel tatiller (2429 sayılı Kanun) ──────────────────────────────

const SABIT_TATILLER: Record<string, string> = {
  "01-01": "Yılbaşı",
  "04-23": "Ulusal Egemenlik ve Çocuk Bayramı",
  "05-01": "Emek ve Dayanışma Günü",
  "05-19": "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
  "07-15": "Demokrasi ve Millî Birlik Günü",
  "08-30": "Zafer Bayramı",
  "10-29": "Cumhuriyet Bayramı",
};

/** Dini bayramlar Diyanet takvimine göre her yıl elle eklenir. Arife ve 28
 *  Ekim yarım gündür (13.00'ten itibaren). */
const DINI_BAYRAMLAR: Record<number, { arife: string; gunler: string[]; ad: string }[]> = {
  2026: [
    { ad: "Ramazan Bayramı", arife: "2026-03-19", gunler: ["2026-03-20", "2026-03-21", "2026-03-22"] },
    { ad: "Kurban Bayramı", arife: "2026-05-26", gunler: ["2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30"] },
  ],
  2027: [
    { ad: "Ramazan Bayramı", arife: "2027-03-08", gunler: ["2027-03-09", "2027-03-10", "2027-03-11"] },
    { ad: "Kurban Bayramı", arife: "2027-05-15", gunler: ["2027-05-16", "2027-05-17", "2027-05-18", "2027-05-19"] },
  ],
};

export const TATIL_TAKVIMI_SON_YIL = Math.max(...Object.keys(DINI_BAYRAMLAR).map(Number));

export type Tatil = { ad: string; yarim: boolean };

/** Tarih genel tatil ya da yarım gün mü? Takvimi girilmemiş yıllarda dini
 *  bayramlar bilinmez (yalnızca sabit tatiller döner). */
export function genelTatil(iso: string): Tatil | null {
  const sabit = SABIT_TATILLER[iso.slice(5)];
  if (sabit) return { ad: sabit, yarim: false };
  if (iso.slice(5) === "10-28") return { ad: "Cumhuriyet Bayramı arifesi", yarim: true };
  for (const b of DINI_BAYRAMLAR[Number(iso.slice(0, 4))] ?? []) {
    if (b.arife === iso) return { ad: `${b.ad} arifesi`, yarim: true };
    if (b.gunler.includes(iso)) return { ad: b.ad, yarim: false };
  }
  return null;
}

/** Tam gün genel tatil mi (yarım günler sayılmaz). */
export function tamGunTatilMi(iso: string): boolean {
  const t = genelTatil(iso);
  return !!t && !t.yarim;
}

// ── Tarih yardımcıları (saat dilimi bağımsız, YYYY-MM-DD) ──────────

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function gunEkle(iso: string, gun: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

/** 0 = Pazartesi … 6 = Pazar. */
export function haftaGunu(iso: string): number {
  return (utc(iso).getUTCDay() + 6) % 7;
}

export function gunFarki(bas: string, bit: string): number {
  return Math.round((utc(bit).getTime() - utc(bas).getTime()) / 86400000);
}

/** Yıl ekler; 29 Şubat artık olmayan yılda 28 Şubat olur. */
export function yilEkle(iso: string, yil: number): string {
  const [y, m, g] = iso.split("-").map(Number);
  const hedefYil = y + yil;
  const sonGun = new Date(Date.UTC(hedefYil, m, 0)).getUTCDate();
  return `${hedefYil}-${String(m).padStart(2, "0")}-${String(Math.min(g, sonGun)).padStart(2, "0")}`;
}

/** Tamamlanmış yıl sayısı (yaş, kıdem). */
export function tamYil(bas: string, bit: string): number {
  let yil = Number(bit.slice(0, 4)) - Number(bas.slice(0, 4));
  if (yilEkle(bas, yil) > bit) yil--;
  return yil;
}

/** Hafta tatili Pazar kabul edilir (işyerinde farklıysa puantajda elle değiştirilir). */
export const HAFTA_TATILI_GUNU = 6;

// ── Yıllık ücretli izin ─────────────────────────────────────────────

export const YILLIK_IZIN = {
  hakKazanmaYil: { deger: 1, dayanak: "4857 md. 53" },
  kademeler: {
    // [kıdem üst sınırı (dahil), gün]
    deger: [
      [5, 14],
      [14, 20],
      [Infinity, 26],
    ] as [number, number][],
    dayanak: "4857 md. 53",
  },
  yasAltSinir: { deger: { gencYasEnFazla: 18, yasliYasEnAz: 50, gun: 20 }, dayanak: "4857 md. 53" },
  bolumEnAzGun: { deger: 10, dayanak: "4857 md. 56" },
  yolIzniEnFazlaGun: { deger: 4, dayanak: "4857 md. 56" },
  kayitBelgesi: { deger: "izin kayıt belgesi", dayanak: "Yıllık Ücretli İzin Yön. md. 20 + EK-I" },
  kidemBirlestirme: { deger: "aynı işverendeki dönemler birleştirilir", dayanak: "4857 md. 54" },
} as const;

/** Bir hak ediş yılı için yıllık izin günü. kidemYil: o yıl dolan kıdem (1, 2, …).
 *  yas: hak ediş günündeki yaş (bilinmiyorsa null). Yer altı işleri (+4) kapsam dışı. */
export function yillikIzinGunu(kidemYil: number, yas: number | null): number {
  if (kidemYil < YILLIK_IZIN.hakKazanmaYil.deger) return 0;
  const gun = YILLIK_IZIN.kademeler.deger.find(([ust]) => kidemYil <= ust)![1];
  const s = YILLIK_IZIN.yasAltSinir.deger;
  if (yas !== null && (yas <= s.gencYasEnFazla || yas >= s.yasliYasEnAz)) return Math.max(gun, s.gun);
  return gun;
}

/** İzin aralığında izinden düşen gün sayısı. Pazar (hafta tatili) ve tam gün
 *  genel tatiller düşülmez; Cumartesi ve yarım gün tatiller iş günü sayılır. */
export function izinGunSay(bas: string, bit: string): { gun: number; sayilmayan: { tarih: string; ad: string }[] } {
  let gun = 0;
  const sayilmayan: { tarih: string; ad: string }[] = [];
  for (let t = bas; t <= bit; t = gunEkle(t, 1)) {
    const tatil = genelTatil(t);
    if (tatil && !tatil.yarim) sayilmayan.push({ tarih: t, ad: tatil.ad });
    else if (haftaGunu(t) !== HAFTA_TATILI_GUNU) gun++;
  }
  return { gun, sayilmayan };
}

function sonrakiIsGunu(t: string): string {
  while (haftaGunu(t) === HAFTA_TATILI_GUNU || tamGunTatilMi(t)) t = gunEkle(t, 1);
  return t;
}

/** Ücretsiz yol izni günleri: izin bitişinden sonraki ilk `yol` iş günü
 *  (Pazar ve tam gün tatiller zaten çalışılmayan gün, atlanır). */
export function yolIzniGunleri(bit: string, yol: number): string[] {
  const gunler: string[] = [];
  let t = gunEkle(bit, 1);
  for (let i = 0; i < yol; i++) {
    t = sonrakiIsGunu(t);
    gunler.push(t);
    t = gunEkle(t, 1);
  }
  return gunler;
}

/** İzin (ve varsa yol izni) bitişinden sonraki ilk çalışma günü. */
export function isbasiTarihi(bit: string, yol = 0): string {
  const yolGunleri = yolIzniGunleri(bit, yol);
  return sonrakiIsGunu(gunEkle(yolGunleri.at(-1) ?? bit, 1));
}

// ── Fazla çalışma ───────────────────────────────────────────────────

export const FAZLA_CALISMA = {
  yillikSinirSaat: { deger: 270, dayanak: "4857 md. 41, Fazla Çalışma Yön. md. 5" },
  zamOrani: { deger: 0.5, dayanak: "4857 md. 41" },
  fazlaSurelerZamOrani: { deger: 0.25, dayanak: "4857 md. 41" },
  serbestZamanCarpani: { deger: 1.5, dayanak: "4857 md. 41" },
  serbestZamanAy: { deger: 6, dayanak: "4857 md. 41" },
  onayGeriAlmaGun: { deger: 30, dayanak: "Fazla Çalışma Yön. md. 9" },
  yasakliYasAlti: { deger: 18, dayanak: "Fazla Çalışma Yön. md. 8" },
} as const;

export const SAAT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function dakika(saat: string): number {
  const [s, d] = saat.split(":").map(Number);
  return s * 60 + d;
}

/** Giriş–çıkış saatinden çalışma süresi (14 Ekim 2026). Çıkış girişten
 *  önceyse gece yarısını geçen vardiya sayılır. Ara dinlenme en az yasal
 *  süre kadar düşülür. Eşik işyerinde geçen (brüt) süreye göre seçilir:
 *  net süreye göre seçmek sınırda kendini çürütüyor (4s20'de 15 dk düşülürse
 *  net 4 saati aşar, 30 dk düşülürse altına iner); brüt okuma işçi lehine. */
export function calismaSuresi(giris: string, cikis: string): { brutDk: number; araDk: number; netSaat: number } {
  let brutDk = dakika(cikis) - dakika(giris);
  if (brutDk <= 0) brutDk += 24 * 60;
  const a = CALISMA.araDinlenme.deger;
  const araDk = brutDk > 7.5 * 60 ? a.fazlasiDk : brutDk > 4 * 60 ? a.yediBucugaKadarDk : a.dortSaateKadarDk;
  return { brutDk, araDk: Math.min(araDk, brutDk), netSaat: Math.max(brutDk - araDk, 0) / 60 };
}

/** 9.5 → "9 saat 30 dk", 7 → "7 saat", 0.25 → "15 dk". */
export function saatMetni(saat: number): string {
  const toplamDk = Math.round(saat * 60);
  const s = Math.floor(toplamDk / 60);
  const d = toplamDk % 60;
  return [s ? `${s} saat` : "", d ? `${d} dk` : ""].filter(Boolean).join(" ") || "0 saat";
}

/** Saatleri girilmiş bir günün fazla çalışması: çalışılan günde normal
 *  günlük sürenin üstü, hafta tatili / genel tatilde çalışılan sürenin
 *  tamamı; yarım saat kuralıyla yuvarlanır. */
export function saattenFazlaCalisma(kod: PuantajKodu, netSaat: number): number {
  if (kod === "HT" || kod === "GT") return fazlaCalismaYuvarla(netSaat);
  if (kod === "Ç") return fazlaCalismaYuvarla(Math.max(netSaat - CALISMA.gunlukNormalSaat.deger, 0));
  return 0;
}

/** O gün yazılabilecek en çok fazla çalışma saati. Günlük toplam çalışma 11
 *  saati geçemez (md. 63): çalışılan günde 11 − normal süre; hafta tatili ya
 *  da genel tatilde çalışılmışsa 11. Rapor, izin, devamsızlık günlerinde
 *  çalışma yok; raporluya fazla çalışma yasağı da var (Yön. md. 8). */
export function fazlaSaatSiniri(kod: PuantajKodu): number {
  if (kod === "Ç") return CALISMA.gunlukAzamiSaat.deger - CALISMA.gunlukNormalSaat.deger;
  if (kod === "HT" || kod === "GT") return CALISMA.gunlukAzamiSaat.deger;
  return 0;
}

/** Yarım saatten az süre yarım saat, yarım saati aşan süre bir saat sayılır
 *  (Fazla Çalışma Yön. md. 5). */
export function fazlaCalismaYuvarla(saat: number): number {
  if (saat <= 0) return 0;
  const tam = Math.floor(saat);
  const kalan = saat - tam;
  if (kalan === 0) return tam;
  return kalan <= 0.5 ? tam + 0.5 : tam + 1;
}

// ── İş ilişkisi ─────────────────────────────────────────────────────

/** İhbar süresi (hafta), kıdeme göre. 4857 md. 17. */
export function ihbarSuresiHafta(kidemGun: number): number {
  const ay = kidemGun / 30;
  if (ay < 6) return 2;
  if (ay < 18) return 4;
  if (ay < 36) return 6;
  return 8;
}

export const IS_ILISKISI = {
  esasliDegisiklikIsGunu: { deger: 6, dayanak: "4857 md. 22" },
  engelliOrani: { deger: 0.03, dayanak: "4857 md. 30" },
  engelliEsik: { deger: 50, dayanak: "4857 md. 30" },
} as const;

/** 50+ çalışanda %3 engelli kontenjanı: yarımdan az kesir atılır, yarım ve
 *  üzeri tama yuvarlanır. */
export function engelliKontenjani(calisanSayisi: number): number {
  if (calisanSayisi < IS_ILISKISI.engelliEsik.deger) return 0;
  return Math.round(calisanSayisi * IS_ILISKISI.engelliOrani.deger);
}

// ── İSG ─────────────────────────────────────────────────────────────

export type TehlikeSinifi = "az" | "tehlikeli" | "cok";

export const ISG: Record<TehlikeSinifi, {
  temelEgitimSaat: number;
  egitimTekrarYil: number;
  saglikMuayeneYil: number;
  riskDegerlendirmeYil: number;
  acilDurumPlaniYil: number;
}> = {
  az: { temelEgitimSaat: 8, egitimTekrarYil: 3, saglikMuayeneYil: 5, riskDegerlendirmeYil: 6, acilDurumPlaniYil: 6 },
  tehlikeli: { temelEgitimSaat: 12, egitimTekrarYil: 2, saglikMuayeneYil: 3, riskDegerlendirmeYil: 4, acilDurumPlaniYil: 4 },
  cok: { temelEgitimSaat: 16, egitimTekrarYil: 1, saglikMuayeneYil: 1, riskDegerlendirmeYil: 2, acilDurumPlaniYil: 2 },
};

export const TEHLIKE_SINIFI_ADI: Record<TehlikeSinifi, string> = {
  az: "az tehlikeli",
  tehlikeli: "tehlikeli",
  cok: "çok tehlikeli",
};

/** İş günü: Cumartesi, Pazar ve tam gün genel tatil sayılmaz (onaylı
 *  iş kazası ekranı, 13 Ekim 2026). Arife (yarım gün) iş günüdür. */
export function isGunuMu(iso: string): boolean {
  return haftaGunu(iso) < 5 && !tamGunTatilMi(iso);
}

/** Verilen günden sonraki n'inci iş günü. */
export function isGunuEkle(iso: string, n: number): string {
  let t = iso;
  let sayilan = 0;
  while (sayilan < n) {
    t = gunEkle(t, 1);
    if (isGunuMu(t)) sayilan++;
  }
  return t;
}

/** İş kazası ve meslek hastalığında SGK bildiriminin son günü: kazadan
 *  (işyeri dışındaysa ya da meslek hastalığındaysa öğrenildiği günden)
 *  sonraki 3. iş günü. */
export function isKazasiSonGun(baslangic: string): string {
  return isGunuEkle(baslangic, SGK.isKazasiIsGunu.deger);
}

export const ISG_DAYANAK = {
  egitim: "İSG Eğitimleri Yön. (RG 2.4.2026, 33212) md. 7, 8, 13, 14",
  muayene: "İşyeri Hekimi Yön. md. 9",
  risk: "Risk Değerlendirmesi Yön. md. 12",
  acilDurum: "Acil Durumlar Yön. md. 14",
  isKazasi: "6331 md. 14",
} as const;

export const ISG_DIGER = {
  iseBaslamaEgitimiSaat: { deger: 2, dayanak: "İSG Eğitimleri Yön. md. 7" },
  temelEgitimIcinAy: { deger: 3, dayanak: "İSG Eğitimleri Yön. md. 8" },
  tekrarEgitimiEnAzSaat: { deger: 8, dayanak: "İSG Eğitimleri Yön. md. 14/2" },
  bilgiYenilemeAraAy: { deger: 6, dayanak: "İSG Eğitimleri Yön. md. 18" },
  gencGebeMuayeneAy: { deger: 6, dayanak: "İşyeri Hekimi Yön." },
  tatbikatYil: { deger: 1, dayanak: "Acil Durumlar Yön." },
  /** Tekrar periyodunun başlangıcı yönetmelikte açık değil; son eğitim
   *  tarihinden sayıyoruz. */
  tekrarBaslangici: { deger: "son eğitim tarihi", dayanak: "İSG Eğitimleri Yön. md. 14", dogrulanmadi: true },
} as const;

// ── KVKK ────────────────────────────────────────────────────────────

export const KVKK = {
  periyodikImhaAy: { deger: 6, dayanak: "Silme Yön. md. 11" },
  talepSilmeGun: { deger: 30, dayanak: "Silme Yön. md. 12" },
  imhaKaydiYil: { deger: 3, dayanak: "Silme Yön. md. 7" },
  aydinlatmaRizaAyri: { deger: true, dayanak: "KVK Kurulu İlke Kararı 2026/347 (RG 24.3.2026)" },
  verbisCalisanEsik: { deger: 50, dayanak: "Kurul kararları 2018/87, 2025/1572" },
} as const;

// ── BES otomatik katılım ────────────────────────────────────────────

export const BES = {
  yasSiniri: { deger: 45, dayanak: "4632 ek md. 2" },
  katkiOrani: { deger: 0.03, dayanak: "4632 ek md. 2" },
  caymaAy: { deger: 2, dayanak: "4632 ek md. 2" },
} as const;

// ── Yıllık sayılar ──────────────────────────────────────────────────

export const YILLIK_SAYILAR: Record<number, { brutAsgari: number; netAsgari: number; pekUst: number }> = {
  2026: { brutAsgari: 33030, netAsgari: 28075.5, pekUst: 297270 },
};

/** Doğrulanamayan maddeler (MEVZUAT.md sonu). Uygulamada kullanılmıyorlar
 *  ya da kullanıldıkları yerde not düşüldü. */
export const KONTROL_EDILECEK = [
  "SGK 'Diğer' eksik gün kodu 13 mü 14 mü (kullanılmıyor)",
  "23–29 arası eksik gün kodları ve 2026 doğum izni değişikliği",
  "Yıllık izin yönetmeliği EK-I alanlarında 2004 sonrası değişiklik",
  "Gece çalışan kadın işçi yönetmeliği md. 7",
  "İSG eğitim tekrar periyodunun başlangıç tarihi",
  "BES yönetmeliğinin güncel birleştirilmiş metni",
] as const;
