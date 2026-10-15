import {
  KOK_BELGE_TIPLERI,
  DONEM_BELGE_TIPLERI,
  ISG_BELGE_TIPLERI,
  type IsGirisiBelgeTipi,
  type IsgBelgeTipi,
  type KisiBelgeTipi,
} from "@/lib/types";
import { depo, ozlukKoku, type YuklemeOturumu } from "@/lib/depo";

// Özlük klasör düzeni: <kök>/AKTİF|PASİF/<AD SOYAD>/{kök belgeler, dönem
// klasörleri "YYYY.MM.DD[ - YYYY.MM.DD]", İSG/}. Gerçek OneDrive klasör
// yapısından çıkarıldı (Faz 7). Faz C'den (13 Ekim 2026) itibaren dosya
// işlemleri lib/depo üzerinden yapılır: Supabase Storage (varsayılan),
// OneDrive ya da Google Drive — düzen ve adlandırma hepsinde aynı.

const KOK_BELGE_DOSYA_ETIKETI: Record<KisiBelgeTipi, string> = {
  adli_sicil: "adli sicil kaydı",
  askerlik_durum: "askerlik durum belgesi",
  ikametgah: "ikametgah",
  mezuniyet: "mezuniyet belgesi",
  nufus_kayit: "nüfus kayıt örneği",
  kimlik: "kimlik",
  kvkk_aydinlatma: "kvkk aydınlatma metni",
  kvkk_acik_riza: "açık rıza beyanı",
};

// Gerçek dosyalarda görülen kısaltmalar — DONEM_BELGE_ETIKETLERI'ndeki
// (lib/types.ts) görünen adlarla birebir aynı değil, dosya adı bu haliyle kullanılıyor.
const DONEM_BELGE_DOSYA_KODU: Record<IsGirisiBelgeTipi, string> = {
  isegiris_bildirgesi: "isegiris",
  sozlesme: "sozlesme",
  ibraname: "ibraname",
  istenayrilis_bildirgesi: "istenayrilis",
  imzali_ciktisi: "isgirisbelgeleri_imzalı",
  // Bu iki tip 29 Ağustos 2026'da eklendi — eski/farklı isimlendirmeli
  // kişilerde tutarsız gerçek adlarla bulundu ("Tatil İzin Yazısı.pdf"
  // gibi), bu yüzden otomatik eşleşme bunlarda büyük ihtimalle çalışmayacak
  // — asıl yol kişi sayfasındaki "Klasörü tara" ekranındaki elle atama
  // dropdown'u. Buradaki kod, ileride biri bu standart adla kaydederse diye bırakıldı.
  fesih_bildirimi: "fesih_bildirimi",
  yillik_izin_yazisi: "yillik_izin",
  fazla_calisma_onayi: "fazla_calisma_onayi",
  calisma_belgesi: "calisma_belgesi",
};

// İSG belgeleri (8 Ekim 2026) kişi klasörünün altındaki İSG/ klasöründe,
// alınma tarihiyle başlayan adla durur — klasörde ilk alınma sırasıyla
// listelenir: 2026.09.23_aysedemir_isg_egitim_sertifikasi.pdf
export const ISG_KLASOR_ADI = "İSG";

const ISG_BELGE_DOSYA_KODU: Record<IsgBelgeTipi, string> = {
  isg_egitim_sertifikasi: "isg_egitim_sertifikasi",
  egitim_formu: "egitim_formu",
  oryantasyon_formu: "oryantasyon_formu",
  saglik_raporu: "saglik_raporu",
  sinav_sorulari: "sinav_sorulari",
};

function turkceKucukHarf(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

function turkceBuyukHarf(s: string): string {
  return s.toLocaleUpperCase("tr-TR");
}

const TURKCE_ASCII: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

// Dönem belge dosya adlarında (ör. aysedemir_sozlesme.pdf) Türkçe karakterler
// ASCII'ye çevrilir — gerçek dosyalarda görülen kalıp bu (kök belgelerde ise
// Türkçe karakterler korunuyor, bkz. KOK_BELGE_DOSYA_ETIKETI kullanımı).
function isimBitisik(adSoyad: string): string {
  return turkceKucukHarf(adSoyad)
    .replace(/[çğıöşü]/g, (harf) => TURKCE_ASCII[harf])
    .replace(/\s+/g, "");
}

function tarihNoktali(isoTarih: string): string {
  return isoTarih.replaceAll("-", ".");
}

/** Kişinin AKTİF ya da PASİF altında var olan klasörünü bulur; yoksa
 *  `varsayilanDurum`a göre oluşturulacak yolu döner (henüz oluşturmaz —
 *  depo ilk dosya yazımında ara klasörleri kendisi açar). */
async function kisiKlasoruYolu(adSoyad: string, varsayilanDurum: "aktif" | "pasif"): Promise<string> {
  const kok = ozlukKoku();
  const klasorAdi = turkceBuyukHarf(adSoyad);

  const aktifYol = `${kok}/AKTİF/${klasorAdi}`;
  if (await depo().varMi(aktifYol)) return aktifYol;

  const pasifYol = `${kok}/PASİF/${klasorAdi}`;
  if (await depo().varMi(pasifYol)) return pasifYol;

  return varsayilanDurum === "aktif" ? aktifYol : pasifYol;
}

/** Kişinin AKTİF/{AD} klasörünü PASİF/{AD} altına taşır — kişinin son
 *  dönemi de kapanıp tamamen pasife geçtiğinde çağrılır (hem elle
 *  "Klasörü PASİF'e taşı" butonundan hem toplu iş çıkışı sonrasında
 *  otomatik). AKTİF'te klasör yoksa ya da PASİF'te zaten (çakışma
 *  riskiyle) varsa hiçbir şey yapmadan bilgilendirici bir sonuç döner. */
export async function kisiKlasorunuPasifeTasi(
  adSoyad: string,
): Promise<{ tasindi: boolean; mesaj: string }> {
  const d = depo();
  const kok = ozlukKoku();
  const klasorAdi = turkceBuyukHarf(adSoyad);
  const aktifYol = `${kok}/AKTİF/${klasorAdi}`;
  const pasifYol = `${kok}/PASİF/${klasorAdi}`;

  if (!(await d.varMi(aktifYol))) {
    return { tasindi: false, mesaj: "AKTİF klasöründe bulunamadı, taşınacak bir şey yok." };
  }
  if (await d.varMi(pasifYol)) {
    return {
      tasindi: false,
      mesaj: "PASİF klasöründe aynı isimde bir klasör zaten var, çakışma riski nedeniyle taşınmadı.",
    };
  }

  await d.tasi(aktifYol, pasifYol);
  return { tasindi: true, mesaj: `AKTİF/${klasorAdi} → PASİF/${klasorAdi} taşındı.` };
}

function dosyaUzantisi(dosyaAdi: string): string {
  const parca = dosyaAdi.split(".");
  return parca.length > 1 ? parca[parca.length - 1] : "pdf";
}

export async function kokBelgeYaz(params: {
  adSoyad: string;
  varsayilanDurum: "aktif" | "pasif";
  belgeTipi: KisiBelgeTipi;
  dosya: File;
}): Promise<void> {
  const { yol } = await belgeHedefi({ tur: "kok", ...params }, params.dosya.name);
  await depo().yaz(yol, Buffer.from(await params.dosya.arrayBuffer()));
}

function isgDosyaAdi(adSoyad: string, tip: IsgBelgeTipi, alinmaTarihi: string, uzanti: string): string {
  return `${tarihNoktali(alinmaTarihi)}_${isimBitisik(adSoyad)}_${ISG_BELGE_DOSYA_KODU[tip]}.${uzanti}`;
}

/** İSG/ klasöründeki standart adlı dosyayı (tarih_isim_kod[_ek].uzanti)
 *  çözer — "_arka" gibi ekli parçalar da aynı belgeye sayılır. */
function isgDosyasiniCoz(
  dosyaAdi: string,
  adSoyad: string,
): { belgeTipi: IsgBelgeTipi; alinmaTarihi: string } | null {
  const taban = dosyaAdiTabani(dosyaAdi);
  const m = taban.match(/^(\d{4})\.(\d{2})\.(\d{2})_([^_]+)_(.+)$/);
  if (!m || m[4] !== isimBitisik(adSoyad)) return null;
  const tip = ISG_BELGE_TIPLERI.find(
    (t) => m[5] === ISG_BELGE_DOSYA_KODU[t] || m[5].startsWith(`${ISG_BELGE_DOSYA_KODU[t]}_`),
  );
  return tip ? { belgeTipi: tip, alinmaTarihi: `${m[1]}-${m[2]}-${m[3]}` } : null;
}

function dosyaAdiTabani(dosyaAdi: string): string {
  const parca = dosyaAdi.split(".");
  const uzantisiz = parca.length > 1 ? parca.slice(0, -1).join(".") : dosyaAdi;
  return turkceKucukHarf(uzantisiz.trim());
}

export type KlasorTaramaSonucu = {
  kokEslesmeler: { belgeTipi: KisiBelgeTipi; dosyaAdi: string }[];
  kokTaninmayan: { dosyaAdi: string; yol: string }[];
  donemEslesmeler: { donemIndex: number; belgeTipi: IsGirisiBelgeTipi; dosyaAdi: string }[];
  donemTaninmayan: { donemIndex: number; dosyaAdi: string; yol: string }[];
  /** İSG/ klasöründeki standart adlı dosyalar (DB'de olup olmadığına çağıran bakar). */
  isgDosyalari: { dosyaAdi: string; belgeTipi: IsgBelgeTipi; alinmaTarihi: string }[];
  isgTaninmayan: { dosyaAdi: string; yol: string }[];
};

/** Kişinin kök klasörünü ve eksik belgesi olan her dönemin klasörünü
 *  depodan listeler, dosya adlarını beklenen isimlendirme kalıbıyla
 *  eşleştirir (kapanmış dönemler de dahil — belgeler dönem kapandıktan
 *  sonra da eklenebiliyor, 29 Ağustos 2026'da netleşti). Eşleştirme tüm
 *  belge tipleri için yapılır (zaten "var" olan bir belgeye karşılık gelen
 *  dosya "tanınmayan" gibi görünmesin diye) — ama sadece `eksikKokTipleri`/
 *  `donemler[].eksikDonemTipleri` içindeki (henüz "var" olmayan) tipler
 *  eşleşme olarak raporlanır; zaten var olan bir belgeye karşılık gelen
 *  dosyalar sessizce yoksayılır (ne eşleşme ne tanınmayan). */
export async function kisiKlasorTara(params: {
  adSoyad: string;
  varsayilanDurum: "aktif" | "pasif";
  eksikKokTipleri: KisiBelgeTipi[];
  donemler: {
    girisTarihi: string;
    cikisTarihi: string | null;
    eksikDonemTipleri: IsGirisiBelgeTipi[];
  }[];
}): Promise<KlasorTaramaSonucu> {
  const { adSoyad, varsayilanDurum, eksikKokTipleri, donemler } = params;
  const d = depo();
  const kisiYol = await kisiKlasoruYolu(adSoyad, varsayilanDurum);

  const eksikKokSet = new Set<KisiBelgeTipi>(eksikKokTipleri);
  const kokBilinen = new Map(
    KOK_BELGE_TIPLERI.map((tip) => [
      turkceKucukHarf(`${adSoyad} ${KOK_BELGE_DOSYA_ETIKETI[tip]}`),
      tip,
    ]),
  );
  const kokDosyalar = await d.dosyalariListele(kisiYol);
  const kokEslesmeler: { belgeTipi: KisiBelgeTipi; dosyaAdi: string }[] = [];
  const kokTaninmayan: { dosyaAdi: string; yol: string }[] = [];
  for (const dosyaAdi of kokDosyalar) {
    const tip = kokBilinen.get(dosyaAdiTabani(dosyaAdi));
    if (tip && eksikKokSet.has(tip)) kokEslesmeler.push({ belgeTipi: tip, dosyaAdi });
    else if (!tip) kokTaninmayan.push({ dosyaAdi, yol: `${kisiYol}/${dosyaAdi}` });
    // tip biliniyor ama zaten "var" ise sessizce yoksayılır
  }

  const donemEslesmeler: { donemIndex: number; belgeTipi: IsGirisiBelgeTipi; dosyaAdi: string }[] =
    [];
  const donemTaninmayan: { donemIndex: number; dosyaAdi: string; yol: string }[] = [];

  for (let donemIndex = 0; donemIndex < donemler.length; donemIndex++) {
    const donem = donemler[donemIndex];
    if (donem.eksikDonemTipleri.length === 0) continue;

    const eksikDonemSet = new Set<IsGirisiBelgeTipi>(donem.eksikDonemTipleri);
    // Çıkış tarihi DB'ye sonradan eklenip klasör aralığa yeniden
    // adlandırılmamış olabilir (gerçek bir örnekte görüldü) — hem aralıklı
    // hem tek tarihli klasör adını dener, hangisi varsa onu kullanır.
    const donemKlasorAdaylari = donem.cikisTarihi
      ? [
          `${tarihNoktali(donem.girisTarihi)} - ${tarihNoktali(donem.cikisTarihi)}`,
          tarihNoktali(donem.girisTarihi),
        ]
      : [tarihNoktali(donem.girisTarihi)];
    const donemBilinen = new Map<string, IsGirisiBelgeTipi>();
    for (const tip of DONEM_BELGE_TIPLERI) {
      // giriş bildirgesi/sözleşme giriş tarihini, diğerleri çıkış tarihini
      // (yoksa giriş tarihini) taşır — donemBelgeYaz ile aynı kural.
      const dosyaTarihi =
        tip === "isegiris_bildirgesi" || tip === "sozlesme"
          ? donem.girisTarihi
          : (donem.cikisTarihi ?? donem.girisTarihi);
      donemBilinen.set(
        turkceKucukHarf(
          `${tarihNoktali(dosyaTarihi)}_${isimBitisik(adSoyad)}_${DONEM_BELGE_DOSYA_KODU[tip]}`,
        ),
        tip,
      );
    }
    const donemDosyalari = new Map<string, string>(); // dosya adı → tam yol
    for (const aday of donemKlasorAdaylari) {
      for (const dosyaAdi of await d.dosyalariListele(`${kisiYol}/${aday}`)) {
        if (!donemDosyalari.has(dosyaAdi)) donemDosyalari.set(dosyaAdi, `${kisiYol}/${aday}/${dosyaAdi}`);
      }
    }
    for (const [dosyaAdi, yol] of donemDosyalari) {
      const tip = donemBilinen.get(dosyaAdiTabani(dosyaAdi));
      if (tip && eksikDonemSet.has(tip)) donemEslesmeler.push({ donemIndex, belgeTipi: tip, dosyaAdi });
      else if (!tip) donemTaninmayan.push({ donemIndex, dosyaAdi, yol });
    }
  }

  const isgDosyalari: KlasorTaramaSonucu["isgDosyalari"] = [];
  const isgTaninmayan: KlasorTaramaSonucu["isgTaninmayan"] = [];
  const isgYol = `${kisiYol}/${ISG_KLASOR_ADI}`;
  for (const dosyaAdi of await d.dosyalariListele(isgYol)) {
    const cozum = isgDosyasiniCoz(dosyaAdi, adSoyad);
    if (cozum) isgDosyalari.push({ dosyaAdi, ...cozum });
    else isgTaninmayan.push({ dosyaAdi, yol: `${isgYol}/${dosyaAdi}` });
  }

  return { kokEslesmeler, kokTaninmayan, donemEslesmeler, donemTaninmayan, isgDosyalari, isgTaninmayan };
}

/** Dönem klasörünün gerçek yolunu döner. `cikisTarihi` bilinmiyorsa hep
 *  "açık" isim (sadece giriş tarihi). Biliniyorsa ve depoda hâlâ açık
 *  isimli bir klasör varsa (giriş bildirgesi/sözleşme zamanında, çıkış
 *  tarihi belli olmadan önce oluşturulmuş olabilir) — içindeki dosyaları
 *  korumak için yeni bir klasör açmak yerine **yeniden adlandırarak
 *  kapatır** ("kapalı" isme: giriş - çıkış). Kapalı isimli klasör zaten
 *  varsa (önceden kapatılmış) dokunmaz. */
async function donemKlasoruYolu(
  kisiYol: string,
  girisTarihi: string,
  cikisTarihi: string | null,
): Promise<string> {
  const acikYol = `${kisiYol}/${tarihNoktali(girisTarihi)}`;
  if (!cikisTarihi) return acikYol;

  const kapaliAd = `${tarihNoktali(girisTarihi)} - ${tarihNoktali(cikisTarihi)}`;
  const kapaliYol = `${kisiYol}/${kapaliAd}`;
  const d = depo();
  if (await d.varMi(kapaliYol)) return kapaliYol;
  if (!(await d.varMi(acikYol))) return kapaliYol;

  try {
    await d.tasi(acikYol, kapaliYol);
  } catch (e) {
    throw new Error(
      `Dönem klasörü kapatılamadı (${acikYol} → ${kapaliAd}): ${e instanceof Error ? e.message : e}`,
    );
  }
  return kapaliYol;
}

export async function donemBelgeYaz(params: {
  adSoyad: string;
  varsayilanDurum: "aktif" | "pasif";
  girisTarihi: string;
  cikisTarihi: string | null;
  belgeTipi: IsGirisiBelgeTipi;
  dosya: File;
}): Promise<void> {
  const { yol } = await belgeHedefi({ tur: "donem", ...params }, params.dosya.name);
  await depo().yaz(yol, Buffer.from(await params.dosya.arrayBuffer()));
}

export type BelgeHedefParams =
  | { tur: "kok"; adSoyad: string; varsayilanDurum: "aktif" | "pasif"; belgeTipi: KisiBelgeTipi }
  | {
      tur: "donem";
      adSoyad: string;
      varsayilanDurum: "aktif" | "pasif";
      girisTarihi: string;
      cikisTarihi: string | null;
      /** "puantaj_cizelgesi": aylık imzalı çalışma çizelgesi (0024); dönem
       *  evrak listesinde yer almaz, dosyası dönem klasörüne gider. */
      belgeTipi: IsGirisiBelgeTipi | "puantaj_cizelgesi" | "ucret_pusulasi";
      /** Dosya adındaki tarih; verilmezse tipe göre giriş ya da çıkış
       *  tarihi (yıllık izin formunda iznin ilk günü verilir). */
      dosyaTarihi?: string;
    }
  | {
      tur: "isg";
      adSoyad: string;
      varsayilanDurum: "aktif" | "pasif";
      belgeTipi: IsgBelgeTipi;
      alinmaTarihi: string;
    }
  /** İş kazası tutanağı ya da istirahat raporu (15 Ekim 2026): kişinin İSG/ klasörü. */
  | {
      tur: "kaza";
      adSoyad: string;
      varsayilanDurum: "aktif" | "pasif";
      belge: "tutanak" | "rapor";
      olayTarihi: string;
    }
  /** İşyeri belgesi (risk değerlendirmesi, acil durum planı, tatbikat): kişiye
   *  bağlı değil, özlük kökünün altında "İSG İşyeri" klasörü. */
  | { tur: "isyeri"; kod: string; tarih: string }
  /** Durum kaydının belgesi (0030): kişi klasörünün kökünde, tarih_isim_tür adıyla. */
  | { tur: "durum"; adSoyad: string; varsayilanDurum: "aktif" | "pasif"; kod: string; tarih: string };

export const ISYERI_KLASOR_ADI = "İSG İşyeri";

/** Belgenin depodaki standart adını ve tam yolunu bulur — sunucu tarafı
 *  yazım ile tarayıcıdan doğrudan yükleme aynı kuralı kullanır. */
async function belgeHedefi(
  h: BelgeHedefParams,
  kaynakDosyaAdi: string,
): Promise<{ yol: string; dosyaAdi: string }> {
  const uzanti = dosyaUzantisi(kaynakDosyaAdi);
  if (h.tur === "isyeri") {
    const dosyaAdi = `${tarihNoktali(h.tarih)}_${h.kod}.${uzanti}`;
    return { yol: `${ozlukKoku()}/${ISYERI_KLASOR_ADI}/${dosyaAdi}`, dosyaAdi };
  }
  const kisiYol = await kisiKlasoruYolu(h.adSoyad, h.varsayilanDurum);
  if (h.tur === "durum") {
    const dosyaAdi = `${tarihNoktali(h.tarih)}_${isimBitisik(h.adSoyad)}_${h.kod}.${uzanti}`;
    return { yol: `${kisiYol}/${dosyaAdi}`, dosyaAdi };
  }
  if (h.tur === "kaza") {
    const dosyaAdi = `${tarihNoktali(h.olayTarihi)}_${isimBitisik(h.adSoyad)}_kaza_${h.belge}.${uzanti}`;
    return { yol: `${kisiYol}/${ISG_KLASOR_ADI}/${dosyaAdi}`, dosyaAdi };
  }
  if (h.tur === "kok") {
    const dosyaAdi = `${turkceKucukHarf(h.adSoyad)} ${KOK_BELGE_DOSYA_ETIKETI[h.belgeTipi]}.${uzanti}`;
    return { yol: `${kisiYol}/${dosyaAdi}`, dosyaAdi };
  }
  if (h.tur === "isg") {
    const dosyaAdi = isgDosyaAdi(h.adSoyad, h.belgeTipi, h.alinmaTarihi, uzanti);
    return { yol: `${kisiYol}/${ISG_KLASOR_ADI}/${dosyaAdi}`, dosyaAdi };
  }
  const donemYol = await donemKlasoruYolu(kisiYol, h.girisTarihi, h.cikisTarihi);
  // giriş bildirgesi/sözleşme giriş tarihini, diğerleri çıkış tarihini
  // (yoksa giriş tarihini) taşır — gerçek dosyalardaki kalıp bu.
  const dosyaTarihi =
    h.dosyaTarihi ??
    (h.belgeTipi === "isegiris_bildirgesi" || h.belgeTipi === "sozlesme"
      ? h.girisTarihi
      : (h.cikisTarihi ?? h.girisTarihi));
  const kod =
    h.belgeTipi === "puantaj_cizelgesi"
      ? "puantaj"
      : h.belgeTipi === "ucret_pusulasi"
        ? "ucret_pusulasi"
        : DONEM_BELGE_DOSYA_KODU[h.belgeTipi];
  const dosyaAdi = `${tarihNoktali(dosyaTarihi)}_${isimBitisik(h.adSoyad)}_${kod}.${uzanti}`;
  return { yol: `${donemYol}/${dosyaAdi}`, dosyaAdi };
}

/** Tarayıcıdan doğrudan yükleme için oturum açar (9 Ekim 2026): dosya
 *  sunucudan geçmez, Netlify'ın ~6 MB istek gövdesi sınırına takılmaz.
 *  Dönen `uploadUrl` ön-yetkili ve yalnızca bu tek dosyaya yazar. */
export async function belgeYuklemeOturumuAc(
  h: BelgeHedefParams,
  kaynakDosyaAdi: string,
  origin?: string,
): Promise<YuklemeOturumu & { dosyaAdi: string }> {
  const { yol, dosyaAdi } = await belgeHedefi(h, kaynakDosyaAdi);
  return { ...(await depo().yuklemeOturumuAc(yol, origin)), dosyaAdi };
}

/** Depodaki bir dosyanın içeriğini indirir (içerik okuyarak tanıma için). */
export async function dosyaIndir(yol: string): Promise<Buffer> {
  return depo().indir(yol);
}

/** Kişi klasöründe bulunmuş (standart dışı adlı) bir dosyayı, içeriğinden
 *  tanınan belge tipinin standart adıyla ve doğru klasöre (kök ya da dönem)
 *  taşır — dosya yeniden yüklenmez, depoda yerinde taşınıp yeniden
 *  adlandırılır. Hedefte aynı adlı dosya varsa dokunmaz, hata fırlatır.
 *  Dönen değer dosyanın yeni adı. */
export async function belgeyiYerlestir(params: {
  adSoyad: string;
  varsayilanDurum: "aktif" | "pasif";
  kaynakYol: string;
  hedef:
    | { tur: "kok"; belgeTipi: KisiBelgeTipi }
    | { tur: "isg"; belgeTipi: IsgBelgeTipi; alinmaTarihi: string }
    | {
        tur: "donem";
        belgeTipi: IsGirisiBelgeTipi;
        girisTarihi: string;
        cikisTarihi: string | null;
      };
}): Promise<string> {
  const { adSoyad, varsayilanDurum, kaynakYol, hedef } = params;
  const d = depo();
  const kisiYol = await kisiKlasoruYolu(adSoyad, varsayilanDurum);
  const uzanti = dosyaUzantisi(kaynakYol.split("/").pop()!).toLowerCase();

  let klasorYol: string;
  let dosyaAdi: string;
  if (hedef.tur === "kok") {
    klasorYol = kisiYol;
    dosyaAdi = `${turkceKucukHarf(adSoyad)} ${KOK_BELGE_DOSYA_ETIKETI[hedef.belgeTipi]}.${uzanti}`;
  } else if (hedef.tur === "isg") {
    klasorYol = `${kisiYol}/${ISG_KLASOR_ADI}`;
    dosyaAdi = isgDosyaAdi(adSoyad, hedef.belgeTipi, hedef.alinmaTarihi, uzanti);
  } else {
    klasorYol = await donemKlasoruYolu(kisiYol, hedef.girisTarihi, hedef.cikisTarihi);
    const dosyaTarihi =
      hedef.belgeTipi === "isegiris_bildirgesi" || hedef.belgeTipi === "sozlesme"
        ? hedef.girisTarihi
        : (hedef.cikisTarihi ?? hedef.girisTarihi);
    dosyaAdi = `${tarihNoktali(dosyaTarihi)}_${isimBitisik(adSoyad)}_${DONEM_BELGE_DOSYA_KODU[hedef.belgeTipi]}.${uzanti}`;
  }

  // Dönem klasörü kapatılırken (açık → aralıklı ad) kaynak dosyanın yolu
  // da değişmiş olabilir — ad üzerinden yeniden kur.
  let kaynak = kaynakYol;
  if (!(await d.varMi(kaynak))) {
    const kaynakAdi = kaynakYol.split("/").pop()!;
    const aday = `${klasorYol}/${kaynakAdi}`;
    if (await d.varMi(aday)) kaynak = aday;
    else throw new Error(`Dosya artık yerinde değil: ${kaynakAdi}`);
  }

  const hedefYol = `${klasorYol}/${dosyaAdi}`;
  if (kaynak === hedefYol) return dosyaAdi;
  if (await d.varMi(hedefYol)) {
    throw new Error(`Hedefte aynı adlı dosya zaten var: ${dosyaAdi}`);
  }

  await d.tasi(kaynak, hedefYol);
  return dosyaAdi;
}
