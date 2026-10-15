"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { YuklemeOturumu } from "@/lib/depo";
import { createClient } from "@/lib/supabase/server";
import {
  kisiKlasorTara,
  kisiKlasorunuPasifeTasi,
  belgeyiYerlestir,
  dosyaIndir,
  belgeYuklemeOturumuAc,
  type BelgeHedefParams,
} from "@/lib/ozluk-dosya";
import { VARSAYILAN_GECERLILIK_YIL, yilEkle } from "@/lib/isg";
import { formatDonemAraligi, tarihSlash } from "@/lib/utils";
import { gecerliSablon, sablonDoldur } from "@/lib/sablon";
import {
  iseGirisMailIcerigi,
  istenAyrilisMailIcerigi,
  topluGirisMailIcerigi,
  topluAyrilisMailIcerigi,
  mailGonder,
} from "@/lib/mail";
import {
  KOK_BELGE_TIPLERI,
  DONEM_BELGE_TIPLERI,
  type IsGirisiBelgeTipi,
  type IsgBelgeTipi,
  type KisiBelgeTipi,
  type Kisi,
  type IsGirisi,
  type UcretPeriyodu,
  type UcretTipi,
  KOK_BELGE_ETIKETLERI,
  DONEM_BELGE_ETIKETLERI,
  ISG_BELGE_TIPLERI,
  ISG_BELGE_ETIKETLERI,
} from "@/lib/types";
import {
  belgeTipiBul,
  dosyaMetniniCikar,
  donemSec,
  kisiyeAitMi,
  kokTipiMi,
  isgTipiMi,
  type BelgeTipi,
} from "@/lib/belge-tanima";

export async function kisiBelgeYoksay(formData: FormData) {
  const supabase = await createClient();
  const kisiId = formData.get("kisi_id") as string;
  const belgeTipi = formData.get("belge_tipi") as string;

  // update+insert (upsert değil) — mevcut notu silmeden sadece durumu değiştirir
  const { data: updated } = await supabase
    .from("kisi_belge")
    .update({ durum: "yoksayildi" })
    .eq("kisi_id", kisiId)
    .eq("belge_tipi", belgeTipi)
    .select();

  if (!updated || updated.length === 0) {
    await supabase
      .from("kisi_belge")
      .insert({ kisi_id: kisiId, belge_tipi: belgeTipi, durum: "yoksayildi" });
  }

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
}

export async function kisiBelgeGeriAl(formData: FormData) {
  const supabase = await createClient();
  const kisiId = formData.get("kisi_id") as string;
  const belgeTipi = formData.get("belge_tipi") as string;

  // satırı silmez (notu kaybolmasın diye) — durumu "yok"a (eksik) çevirir
  await supabase
    .from("kisi_belge")
    .update({ durum: "yok" })
    .eq("kisi_id", kisiId)
    .eq("belge_tipi", belgeTipi);

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
}

export async function isGirisiBelgeYoksay(formData: FormData) {
  const supabase = await createClient();
  const kisiId = formData.get("kisi_id") as string;
  const isGirisiId = formData.get("is_girisi_id") as string;
  const belgeTipi = formData.get("belge_tipi") as string;

  // update+insert (upsert değil) — mevcut notu silmeden sadece durumu değiştirir
  const { data: updated } = await supabase
    .from("is_girisi_belge")
    .update({ durum: "yoksayildi" })
    .eq("is_girisi_id", isGirisiId)
    .eq("belge_tipi", belgeTipi)
    .select();

  if (!updated || updated.length === 0) {
    await supabase
      .from("is_girisi_belge")
      .insert({ is_girisi_id: isGirisiId, belge_tipi: belgeTipi, durum: "yoksayildi" });
  }

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
}

export async function isGirisiBelgeGeriAl(formData: FormData) {
  const supabase = await createClient();
  const kisiId = formData.get("kisi_id") as string;
  const isGirisiId = formData.get("is_girisi_id") as string;
  const belgeTipi = formData.get("belge_tipi") as string;

  // satırı silmez (notu kaybolmasın diye) — durumu "yok"a (eksik) çevirir
  await supabase
    .from("is_girisi_belge")
    .update({ durum: "yok" })
    .eq("is_girisi_id", isGirisiId)
    .eq("belge_tipi", belgeTipi);

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function kisininVarsayilanDurumu(supabase: Supabase, kisiId: string): Promise<"aktif" | "pasif"> {
  const { data } = await supabase
    .from("is_girisi")
    .select("id")
    .eq("kisi_id", kisiId)
    .eq("durum", "aktif")
    .limit(1);
  return data && data.length > 0 ? "aktif" : "pasif";
}

export type YuklemeIstegi =
  | { tur: "kok"; kisiId: string; belgeTipi: KisiBelgeTipi }
  | { tur: "donem"; kisiId: string; isGirisiId: string; belgeTipi: IsGirisiBelgeTipi }
  | { tur: "izin"; kisiId: string; izinId: string }
  | { tur: "puantaj"; kisiId: string; ay: string }
  | { tur: "kaza"; kisiId: string; kazaId: string; belge: "tutanak" | "rapor" }
  /** İşyeri belgesi kişiye bağlı değil; kisiId boş gelir. */
  | { tur: "isyeri"; kisiId: ""; isyeriBelgeId: string }
  | {
      tur: "isg";
      kisiId: string;
      belgeTipi: IsgBelgeTipi;
      alinmaTarihi: string;
      gecerlilikTarihi?: string;
    };

/** İsteği doğrular, depo hedefinin parametrelerini çıkarır. İSG'de
 *  sertifika geçerliliği boşsa alınma + 3 yıl, diğer İSG tiplerinde boş. */
async function yuklemeBaglami(
  supabase: Supabase,
  istek: YuklemeIstegi,
): Promise<
  { error: string } | { error: null; hedef: BelgeHedefParams; gecerlilikTarihi: string | null }
> {
  if (istek.tur === "isyeri") {
    const { data: b } = await supabase
      .from("isyeri_belge")
      .select("tip, yapilma_tarihi")
      .eq("id", istek.isyeriBelgeId)
      .maybeSingle();
    if (!b) return { error: "Kayıt bulunamadı." };
    const kod = ({ risk_degerlendirmesi: "risk", acil_durum_plani: "acil", tatbikat: "tatbikat" } as Record<string, string>)[b.tip];
    if (!kod) return { error: "Bilinmeyen belge tipi." };
    return { error: null, hedef: { tur: "isyeri", kod, tarih: b.yapilma_tarihi }, gecerlilikTarihi: null };
  }

  const { data: kisi } = await supabase
    .from("kisi")
    .select("ad_soyad")
    .eq("id", istek.kisiId)
    .single();
  if (!kisi) return { error: "Kişi bulunamadı." };
  const ortak = {
    adSoyad: kisi.ad_soyad as string,
    varsayilanDurum: await kisininVarsayilanDurumu(supabase, istek.kisiId),
  };

  if (istek.tur === "kaza") {
    if (istek.belge !== "tutanak" && istek.belge !== "rapor") return { error: "Bilinmeyen belge tipi." };
    const { data: k } = await supabase
      .from("is_kazasi")
      .select("kisi_id, olay_tarihi")
      .eq("id", istek.kazaId)
      .maybeSingle();
    if (!k || k.kisi_id !== istek.kisiId) return { error: "Kaza kaydı bulunamadı." };
    return {
      error: null,
      hedef: { tur: "kaza", ...ortak, belge: istek.belge, olayTarihi: k.olay_tarihi },
      gecerlilikTarihi: null,
    };
  }

  if (istek.tur === "kok") {
    if (!KOK_BELGE_TIPLERI.includes(istek.belgeTipi)) return { error: "Bilinmeyen belge tipi." };
    return {
      error: null,
      hedef: { tur: "kok", ...ortak, belgeTipi: istek.belgeTipi },
      gecerlilikTarihi: null,
    };
  }

  if (istek.tur === "donem") {
    if (!DONEM_BELGE_TIPLERI.includes(istek.belgeTipi)) return { error: "Bilinmeyen belge tipi." };
    const { data: donem } = await supabase
      .from("is_girisi")
      .select("giris_tarihi, cikis_tarihi, kisi_id")
      .eq("id", istek.isGirisiId)
      .single();
    if (!donem || donem.kisi_id !== istek.kisiId) return { error: "Kayıt bulunamadı." };
    return {
      error: null,
      hedef: {
        tur: "donem",
        ...ortak,
        girisTarihi: donem.giris_tarihi,
        cikisTarihi: donem.cikis_tarihi,
        belgeTipi: istek.belgeTipi,
      },
      gecerlilikTarihi: null,
    };
  }

  if (istek.tur === "izin") {
    // İmzalı yıllık izin formu, iznin düştüğü dönemin klasörüne gider.
    const { data: izin } = await supabase
      .from("yillik_izin")
      .select("kisi_id, baslangic")
      .eq("id", istek.izinId)
      .single();
    if (!izin || izin.kisi_id !== istek.kisiId) return { error: "İzin kaydı bulunamadı." };
    const { data: donem } = await supabase
      .from("is_girisi")
      .select("giris_tarihi, cikis_tarihi")
      .eq("kisi_id", istek.kisiId)
      .lte("giris_tarihi", izin.baslangic)
      .or(`cikis_tarihi.is.null,cikis_tarihi.gte.${izin.baslangic}`)
      .limit(1)
      .maybeSingle();
    if (!donem) return { error: "İznin düştüğü iş dönemi bulunamadı." };
    return {
      error: null,
      hedef: {
        tur: "donem",
        ...ortak,
        girisTarihi: donem.giris_tarihi,
        cikisTarihi: donem.cikis_tarihi,
        belgeTipi: "yillik_izin_yazisi",
        dosyaTarihi: izin.baslangic,
      },
      gecerlilikTarihi: null,
    };
  }

  if (istek.tur === "puantaj") {
    // İmzalı aylık çizelge, o aya düşen (en son başlayan) iş döneminin klasörüne gider.
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(istek.ay)) return { error: "Ay geçersiz." };
    const ilk = `${istek.ay}-01`;
    const son = new Date(Date.UTC(Number(istek.ay.slice(0, 4)), Number(istek.ay.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const { data: donem } = await supabase
      .from("is_girisi")
      .select("giris_tarihi, cikis_tarihi")
      .eq("kisi_id", istek.kisiId)
      .lte("giris_tarihi", son)
      .or(`cikis_tarihi.is.null,cikis_tarihi.gte.${ilk}`)
      .order("giris_tarihi", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!donem) return { error: "Bu aya düşen iş dönemi bulunamadı." };
    return {
      error: null,
      hedef: {
        tur: "donem",
        ...ortak,
        girisTarihi: donem.giris_tarihi,
        cikisTarihi: donem.cikis_tarihi,
        belgeTipi: "puantaj_cizelgesi",
        dosyaTarihi: donem.giris_tarihi > ilk ? donem.giris_tarihi : ilk,
      },
      gecerlilikTarihi: null,
    };
  }

  if (!ISG_BELGE_TIPLERI.includes(istek.belgeTipi)) return { error: "Bilinmeyen belge tipi." };
  const alinmaTarihi = istek.alinmaTarihi || "";
  let gecerlilikTarihi = istek.gecerlilikTarihi || "";
  if (!alinmaTarihi) return { error: "Alınma tarihini gir." };
  // Tarih dosya adına giriyor — sadece YYYY-MM-DD kabul (yol enjeksiyonuna karşı).
  const TARIH_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!TARIH_RE.test(alinmaTarihi) || (gecerlilikTarihi && !TARIH_RE.test(gecerlilikTarihi))) {
    return { error: "Tarih biçimi geçersiz." };
  }
  if (istek.belgeTipi === "isg_egitim_sertifikasi") {
    if (!gecerlilikTarihi) gecerlilikTarihi = yilEkle(alinmaTarihi, VARSAYILAN_GECERLILIK_YIL);
    if (gecerlilikTarihi <= alinmaTarihi) {
      return { error: "Geçerlilik tarihi alınma tarihinden sonra olmalı." };
    }
  } else {
    gecerlilikTarihi = "";
  }
  return {
    error: null,
    hedef: { tur: "isg", ...ortak, belgeTipi: istek.belgeTipi, alinmaTarihi },
    gecerlilikTarihi: gecerlilikTarihi || null,
  };
}

/** Belge yüklemenin 1. adımı (9 Ekim 2026): depoda standart adlı
 *  hedef için yükleme oturumu açar, dosyayı tarayıcı doğrudan depoya
 *  gönderir (lib/belge-yukle.ts). Netlify fonksiyonlarının ~6 MB istek
 *  gövdesi sınırı yüzünden büyük taranmış evraklar sunucu üzerinden
 *  yüklenemiyordu (12 MB'lık taranmış evraklar). */
export async function belgeYuklemeBaslat(
  istek: YuklemeIstegi,
  kaynakDosyaAdi: string,
): Promise<{ error: string } | ({ error: null; dosyaAdi: string } & YuklemeOturumu)> {
  const supabase = await createClient();
  const baglam = await yuklemeBaglami(supabase, istek);
  if (baglam.error !== null) return { error: baglam.error };
  try {
    const origin = (await headers()).get("origin") ?? undefined;
    const oturum = await belgeYuklemeOturumuAc(baglam.hedef, kaynakDosyaAdi, origin);
    return { error: null, ...oturum };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Yükleme başlatılamadı." };
  }
}

/** Belge yüklemenin 2. adımı: dosya depoya yazıldıktan sonra kaydı
 *  "var" işaretler (İSG'de geçmişe yeni satır ekler). Bu adım başarısız
 *  olursa dosya standart adıyla klasörde durduğu için "Klasörü tara" onu
 *  yine bulur. */
export async function belgeYuklemeTamamla(
  istek: YuklemeIstegi,
  dosyaAdi: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const baglam = await yuklemeBaglami(supabase, istek);
  if (baglam.error !== null) return { error: baglam.error };

  if (istek.tur === "kok") {
    await kokBelgeVarIsaretle(supabase, istek.kisiId, istek.belgeTipi);
  } else if (istek.tur === "donem") {
    await donemBelgeVarIsaretle(supabase, istek.isGirisiId, istek.belgeTipi);
  } else if (istek.tur === "izin") {
    const { error } = await supabase
      .from("yillik_izin")
      .update({ form_durumu: "var", dosya_adi: dosyaAdi })
      .eq("id", istek.izinId);
    if (error) return { error: `Dosya yazıldı ama kayıt güncellenemedi: ${error.message}` };
    revalidatePath("/izin");
  } else if (istek.tur === "puantaj") {
    const { error } = await supabase
      .from("puantaj_imza")
      .upsert({ ay: `${istek.ay}-01`, kisi_id: istek.kisiId, dosya_adi: dosyaAdi, yuklendi_at: new Date().toISOString() });
    if (error) return { error: `Dosya yazıldı ama kayıt güncellenemedi: ${error.message}` };
    revalidatePath("/puantaj");
    revalidatePath(`/kisi/${istek.kisiId}`);
    revalidatePath("/");
  } else if (istek.tur === "kaza") {
    const { error } = await supabase
      .from("is_kazasi")
      .update(istek.belge === "tutanak" ? { tutanak_dosya: dosyaAdi } : { rapor_dosya: dosyaAdi })
      .eq("id", istek.kazaId);
    if (error) return { error: `Dosya yazıldı ama kayıt güncellenemedi: ${error.message}` };
    revalidatePath(`/isg/kaza/${istek.kazaId}`);
    revalidatePath("/isg");
    return { error: null };
  } else if (istek.tur === "isyeri") {
    const { error } = await supabase.from("isyeri_belge").update({ dosya_adi: dosyaAdi }).eq("id", istek.isyeriBelgeId);
    if (error) return { error: `Dosya yazıldı ama kayıt güncellenemedi: ${error.message}` };
    revalidatePath("/isg");
    return { error: null };
  } else {
    const { error } = await supabase.from("isg_belge").insert({
      kisi_id: istek.kisiId,
      belge_tipi: istek.belgeTipi,
      durum: "var",
      alinma_tarihi: istek.alinmaTarihi,
      gecerlilik_tarihi: baglam.gecerlilikTarihi,
      dosya_adi: dosyaAdi,
    });
    if (error) return { error: `Dosya yazıldı ama kayıt eklenemedi: ${error.message}` };
  }

  revalidatePath(`/kisi/${istek.kisiId}`);
  revalidatePath("/");
  return { error: null };
}

export async function isgBelgeYoksay(formData: FormData) {
  const supabase = await createClient();
  const kisiId = formData.get("kisi_id") as string;
  const belgeTipi = formData.get("belge_tipi") as string;

  const { data: mevcut } = await supabase
    .from("isg_belge")
    .select("id")
    .eq("kisi_id", kisiId)
    .eq("belge_tipi", belgeTipi)
    .eq("durum", "yoksayildi")
    .limit(1);
  if (!mevcut || mevcut.length === 0) {
    await supabase.from("isg_belge").insert({ kisi_id: kisiId, belge_tipi: belgeTipi, durum: "yoksayildi" });
  }

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
}

export async function isgBelgeGeriAl(formData: FormData) {
  const supabase = await createClient();
  const kisiId = formData.get("kisi_id") as string;
  const belgeTipi = formData.get("belge_tipi") as string;

  // "Gerekli değil" işareti ayrı bir satır — geri alınca o satır kalkar,
  // alınmış belgelerin geçmişine dokunulmaz.
  await supabase
    .from("isg_belge")
    .delete()
    .eq("kisi_id", kisiId)
    .eq("belge_tipi", belgeTipi)
    .eq("durum", "yoksayildi");

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
}


async function kokBelgeVarIsaretle(supabase: Supabase, kisiId: string, tip: string) {
  const { data: updated } = await supabase
    .from("kisi_belge")
    .update({ durum: "var" })
    .eq("kisi_id", kisiId)
    .eq("belge_tipi", tip)
    .select();
  if (!updated || updated.length === 0) {
    await supabase.from("kisi_belge").insert({ kisi_id: kisiId, belge_tipi: tip, durum: "var" });
  }
}

async function donemBelgeVarIsaretle(supabase: Supabase, isGirisiId: string, tip: string) {
  const { data: updated } = await supabase
    .from("is_girisi_belge")
    .update({ durum: "var" })
    .eq("is_girisi_id", isGirisiId)
    .eq("belge_tipi", tip)
    .select();
  if (!updated || updated.length === 0) {
    await supabase
      .from("is_girisi_belge")
      .insert({ is_girisi_id: isGirisiId, belge_tipi: tip, durum: "var" });
  }
}

export type KlasorIslenen = { dosyaAdi: string; yeniAd: string | null; etiket: string };
export type KlasorSorulacak = {
  dosyaAdi: string;
  yol: string;
  neden: string;
  /** Sistemin tahmini, seçim kutusunda önceden seçili gelir ("kok:{tip}" / "donem:{isGirisiId}:{tip}"). */
  tahmin: string;
};

export type KlasorTaramaSonucu = {
  islenen: KlasorIslenen[];
  sorulacak: KlasorSorulacak[];
  /** İçeriği tanındı ama o belge zaten "var" — dosyaya dokunulmadı. */
  zatenVar: KlasorIslenen[];
  hatali: { dosyaAdi: string; hata: string }[];
  /** Süre sınırı yüzünden bu taramada okunmayan dosya sayısı. */
  kalan: number;
  kokKalanTipleri: KisiBelgeTipi[];
  donemKalanTipleri: { isGirisiId: string; donemEtiketi: string; tipler: IsGirisiBelgeTipi[] }[];
};

// Netlify fonksiyonları ~26 sn'de kesiliyor — tek taramada içeriği
// okunacak dosya sayısı sınırlı, kalanlar bir sonraki taramaya kalır.
const TARAMA_ICERIK_LIMITI = 12;

function belgeEtiketi(tip: BelgeTipi, donemEtiketi?: string): string {
  if (kokTipiMi(tip)) return KOK_BELGE_ETIKETLERI[tip];
  if (isgTipiMi(tip)) return `İSG — ${ISG_BELGE_ETIKETLERI[tip]}`;
  return `${DONEM_BELGE_ETIKETLERI[tip]}${donemEtiketi ? ` (${donemEtiketi})` : ""}`;
}

async function kisiTaramaBaglami(supabase: Supabase, kisiId: string) {
  const { data: kisi } = await supabase
    .from("kisi")
    .select("ad_soyad, tc_kimlik_no")
    .eq("id", kisiId)
    .single();
  if (!kisi) return null;

  const { data: donemler } = await supabase
    .from("is_girisi")
    .select("id, giris_tarihi, cikis_tarihi, durum")
    .eq("kisi_id", kisiId)
    .order("giris_tarihi", { ascending: false });

  const varsayilanDurum: "aktif" | "pasif" = (donemler ?? []).some((d) => d.durum === "aktif")
    ? "aktif"
    : "pasif";

  const { data: kokBelgeler } = await supabase
    .from("kisi_belge")
    .select("belge_tipi, durum")
    .eq("kisi_id", kisiId);
  const kokKarariVerilmis = new Set<string>(
    (kokBelgeler ?? [])
      .filter((b) => b.durum === "var" || b.durum === "yoksayildi")
      .map((b) => b.belge_tipi),
  );

  const donemIdler = (donemler ?? []).map((d) => d.id);
  const { data: tumDonemBelgeleri } = donemIdler.length
    ? await supabase
        .from("is_girisi_belge")
        .select("is_girisi_id, belge_tipi, durum")
        .in("is_girisi_id", donemIdler)
    : { data: [] as { is_girisi_id: string; belge_tipi: string; durum: string }[] };

  // "isGirisiId:tip" — kararı verilmiş (var ya da yoksayıldı) dönem belgeleri
  const donemKarariVerilmis = new Set<string>(
    (tumDonemBelgeleri ?? [])
      .filter((b) => b.durum === "var" || b.durum === "yoksayildi")
      .map((b) => `${b.is_girisi_id}:${b.belge_tipi}`),
  );

  return {
    kisi,
    donemler: (donemler ?? []).map((d) => ({
      ...d,
      etiket: formatDonemAraligi(d.giris_tarihi, d.cikis_tarihi),
    })),
    varsayilanDurum,
    kokKarariVerilmis,
    donemKarariVerilmis,
  };
}

/** Kişinin depo klasörünü (kök + eksik belgesi olan her dönem) tarar.
 *  22 Eylül 2026'dan itibaren tam otomatik: standart adlı dosyalar direkt
 *  "var" işaretlenir; adı tanınmayan dosyaların içeriği (PDF/DOCX metni)
 *  okunur, belge tipi + kişi + dönem bulunursa dosya standart adla doğru
 *  klasöre taşınıp "var" işaretlenir. Sadece karar verilemeyenler
 *  kullanıcıya sorulur (tahmin önceden seçili). Kapanmış dönemler de dahil
 *  — belgeler dönem kapandıktan sonra da eklenebiliyor (29 Ağustos 2026). */
export async function kisiKlasoruTara(
  kisiId: string,
): Promise<{ error: string } | { error: null; sonuc: KlasorTaramaSonucu }> {
  const supabase = await createClient();
  const baglam = await kisiTaramaBaglami(supabase, kisiId);
  if (!baglam) return { error: "Kişi bulunamadı." };
  const { kisi, donemler, varsayilanDurum, kokKarariVerilmis, donemKarariVerilmis } = baglam;

  const kokEksik = () => KOK_BELGE_TIPLERI.filter((t) => !kokKarariVerilmis.has(t));
  const donemEksik = (id: string) =>
    DONEM_BELGE_TIPLERI.filter((t) => !donemKarariVerilmis.has(`${id}:${t}`));

  const { data: tumKisiler } = await supabase.from("kisi").select("tc_kimlik_no");
  const bilinenTcler = new Set((tumKisiler ?? []).map((k) => k.tc_kimlik_no as string));

  try {
    const tarama = await kisiKlasorTara({
      adSoyad: kisi.ad_soyad,
      varsayilanDurum,
      eksikKokTipleri: [...kokEksik()],
      donemler: donemler.map((d) => ({
        girisTarihi: d.giris_tarihi,
        cikisTarihi: d.cikis_tarihi,
        eksikDonemTipleri: [...donemEksik(d.id)],
      })),
    });

    const islenen: KlasorIslenen[] = [];
    const sorulacak: KlasorSorulacak[] = [];
    const zatenVar: KlasorIslenen[] = [];
    const hatali: { dosyaAdi: string; hata: string }[] = [];

    // 1) Standart adıyla duran dosyalar — doğrudan işaretle.
    for (const e of tarama.kokEslesmeler) {
      await kokBelgeVarIsaretle(supabase, kisiId, e.belgeTipi);
      kokKarariVerilmis.add(e.belgeTipi);
      islenen.push({ dosyaAdi: e.dosyaAdi, yeniAd: null, etiket: belgeEtiketi(e.belgeTipi) });
    }
    for (const e of tarama.donemEslesmeler) {
      const donem = donemler[e.donemIndex];
      await donemBelgeVarIsaretle(supabase, donem.id, e.belgeTipi);
      donemKarariVerilmis.add(`${donem.id}:${e.belgeTipi}`);
      islenen.push({
        dosyaAdi: e.dosyaAdi,
        yeniAd: null,
        etiket: belgeEtiketi(e.belgeTipi, donem.etiket),
      });
    }

    // İSG/ klasöründeki standart adlı dosyalar — kayıtta yoksa ekle.
    // Sertifikanın geçerlilik tarihi dosya adında yok: varsayılan süre
    // yazılır, kişi sayfasında görünür (gerekirse yeniden yüklenir).
    if (tarama.isgDosyalari.length > 0) {
      const { data: kayitliIsg } = await supabase
        .from("isg_belge")
        .select("dosya_adi")
        .eq("kisi_id", kisiId);
      const kayitli = new Set((kayitliIsg ?? []).map((r) => r.dosya_adi as string | null));
      for (const d of tarama.isgDosyalari) {
        if (kayitli.has(d.dosyaAdi)) continue;
        await supabase.from("isg_belge").insert({
          kisi_id: kisiId,
          belge_tipi: d.belgeTipi,
          durum: "var",
          alinma_tarihi: d.alinmaTarihi,
          gecerlilik_tarihi:
            d.belgeTipi === "isg_egitim_sertifikasi"
              ? yilEkle(d.alinmaTarihi, VARSAYILAN_GECERLILIK_YIL)
              : null,
          dosya_adi: d.dosyaAdi,
        });
        islenen.push({ dosyaAdi: d.dosyaAdi, yeniAd: null, etiket: belgeEtiketi(d.belgeTipi) });
      }
    }

    // 2) Adı tanınmayan dosyalar — içeriğinden tanı.
    const taninmayan = [
      ...tarama.kokTaninmayan.map((t) => ({ ...t, donemIndex: null as number | null })),
      ...tarama.donemTaninmayan,
      ...tarama.isgTaninmayan.map((t) => ({ ...t, donemIndex: null as number | null })),
    ];
    const okunacak = taninmayan.slice(0, TARAMA_ICERIK_LIMITI);

    for (const dosya of okunacak) {
      let metin = "";
      try {
        metin = await dosyaMetniniCikar(dosya.dosyaAdi, await dosyaIndir(dosya.yol));
      } catch (e) {
        hatali.push({ dosyaAdi: dosya.dosyaAdi, hata: e instanceof Error ? e.message : "Okunamadı." });
        continue;
      }

      const sor = (neden: string, tahmin = "") =>
        sorulacak.push({ dosyaAdi: dosya.dosyaAdi, yol: dosya.yol, neden, tahmin });

      const tahmin = belgeTipiBul(metin, dosya.dosyaAdi);
      if (!tahmin) {
        sor(
          metin.trim()
            ? "İçeriğinden hangi belge olduğu anlaşılamadı."
            : "Metin içermiyor (taranmış belge ya da fotoğraf), adından da anlaşılamadı.",
        );
        continue;
      }
      if (kisiyeAitMi(metin, kisi, bilinenTcler) === "baska") {
        sor("Belgede başka bir çalışanın TC kimlik numarası geçiyor.");
        continue;
      }

      const { tip } = tahmin;
      if (isgTipiMi(tip)) {
        // Alınma tarihi (ve sertifikada geçerlilik) gerektiği için otomatik
        // yerleştirilmiyor — kişi sayfasındaki İSG bölümünden yüklenir.
        sor(
          `${ISG_BELGE_ETIKETLERI[tip]} (İSG) olduğu anlaşıldı — alınma tarihiyle kişi sayfasındaki İSG bölümünden yükleyin.`,
        );
        continue;
      }
      if (kokTipiMi(tip)) {
        if (kokKarariVerilmis.has(tip)) {
          zatenVar.push({ dosyaAdi: dosya.dosyaAdi, yeniAd: null, etiket: belgeEtiketi(tip) });
          continue;
        }
        try {
          const yeniAd = await belgeyiYerlestir({
            adSoyad: kisi.ad_soyad,
            varsayilanDurum,
            kaynakYol: dosya.yol,
            hedef: { tur: "kok", belgeTipi: tip },
          });
          await kokBelgeVarIsaretle(supabase, kisiId, tip);
          kokKarariVerilmis.add(tip);
          islenen.push({ dosyaAdi: dosya.dosyaAdi, yeniAd, etiket: belgeEtiketi(tip) });
        } catch (e) {
          hatali.push({ dosyaAdi: dosya.dosyaAdi, hata: e instanceof Error ? e.message : "Taşınamadı." });
        }
        continue;
      }

      const adaylar = donemler.filter((d) => !donemKarariVerilmis.has(`${d.id}:${tip}`));
      if (adaylar.length === 0) {
        zatenVar.push({ dosyaAdi: dosya.dosyaAdi, yeniAd: null, etiket: belgeEtiketi(tip) });
        continue;
      }
      // Dosya bir dönem klasöründeyse ve o dönemde bu belge eksikse — o dönem.
      const bulunduguDonem = dosya.donemIndex != null ? donemler[dosya.donemIndex] : null;
      const donem =
        bulunduguDonem && adaylar.some((a) => a.id === bulunduguDonem.id)
          ? bulunduguDonem
          : donemSec(adaylar, tip, metin);
      if (!donem) {
        sor(
          `${DONEM_BELGE_ETIKETLERI[tip]} olduğu anlaşıldı ama hangi döneme ait olduğu belirlenemedi.`,
          `donem:${adaylar[0].id}:${tip}`,
        );
        continue;
      }
      try {
        const yeniAd = await belgeyiYerlestir({
          adSoyad: kisi.ad_soyad,
          varsayilanDurum,
          kaynakYol: dosya.yol,
          hedef: {
            tur: "donem",
            belgeTipi: tip,
            girisTarihi: donem.giris_tarihi,
            cikisTarihi: donem.cikis_tarihi,
          },
        });
        await donemBelgeVarIsaretle(supabase, donem.id, tip);
        donemKarariVerilmis.add(`${donem.id}:${tip}`);
        islenen.push({ dosyaAdi: dosya.dosyaAdi, yeniAd, etiket: belgeEtiketi(tip, donem.etiket) });
      } catch (e) {
        hatali.push({ dosyaAdi: dosya.dosyaAdi, hata: e instanceof Error ? e.message : "Taşınamadı." });
      }
    }

    if (islenen.length > 0) {
      revalidatePath(`/kisi/${kisiId}`);
      revalidatePath("/");
    }

    return {
      error: null,
      sonuc: {
        islenen,
        sorulacak,
        zatenVar,
        hatali,
        kalan: taninmayan.length - okunacak.length,
        kokKalanTipleri: [...kokEksik()],
        donemKalanTipleri: donemler
          .map((d) => ({ isGirisiId: d.id, donemEtiketi: d.etiket, tipler: [...donemEksik(d.id)] }))
          .filter((d) => d.tipler.length > 0),
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Tarama başarısız." };
  }
}

/** Taramada sorulan dosyalar için kullanıcının seçtiği belge tipini
 *  uygular: dosyayı standart adla doğru klasöre taşır ve "var" işaretler.
 *  Atama: "kok:{tip}" ya da "donem:{isGirisiId}:{tip}". */
export async function taramaSecimleriniUygula(
  kisiId: string,
  secimler: { yol: string; atama: string }[],
): Promise<{ error: string | null; hatalar: string[] }> {
  const supabase = await createClient();
  const baglam = await kisiTaramaBaglami(supabase, kisiId);
  if (!baglam) return { error: "Kişi bulunamadı.", hatalar: [] };
  const { kisi, donemler, varsayilanDurum } = baglam;
  const hatalar: string[] = [];

  for (const { yol, atama } of secimler) {
    const dosyaAdi = yol.split("/").pop()!;
    try {
      if (atama.startsWith("kok:")) {
        const tip = atama.slice(4) as KisiBelgeTipi;
        await belgeyiYerlestir({
          adSoyad: kisi.ad_soyad,
          varsayilanDurum,
          kaynakYol: yol,
          hedef: { tur: "kok", belgeTipi: tip },
        });
        await kokBelgeVarIsaretle(supabase, kisiId, tip);
      } else if (atama.startsWith("donem:")) {
        const [, isGirisiId, tip] = atama.split(":") as [string, string, IsGirisiBelgeTipi];
        const donem = donemler.find((d) => d.id === isGirisiId);
        if (!donem) throw new Error("Dönem bulunamadı.");
        await belgeyiYerlestir({
          adSoyad: kisi.ad_soyad,
          varsayilanDurum,
          kaynakYol: yol,
          hedef: {
            tur: "donem",
            belgeTipi: tip,
            girisTarihi: donem.giris_tarihi,
            cikisTarihi: donem.cikis_tarihi,
          },
        });
        await donemBelgeVarIsaretle(supabase, isGirisiId, tip);
      }
    } catch (e) {
      hatalar.push(`${dosyaAdi}: ${e instanceof Error ? e.message : "işlenemedi"}`);
    }
  }

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
  return { error: null, hatalar };
}

/** Kişinin depo klasörünü AKTİF'ten PASİF'e taşır — kişi sayfasındaki
 *  "Klasörü PASİF'e taşı" butonu için (elle, on-demand katılım/telafi
 *  amacıyla; toplu iş çıkışı sonrasında da otomatik best-effort çağrılıyor,
 *  bkz. `topluCikisUygula`). */
export async function kisiKlasorunuTasiAction(
  kisiId: string,
): Promise<{ error: string | null; mesaj?: string }> {
  const supabase = await createClient();
  const { data: kisi } = await supabase.from("kisi").select("ad_soyad").eq("id", kisiId).single();
  if (!kisi) return { error: "Kişi bulunamadı." };

  try {
    const sonuc = await kisiKlasorunuPasifeTasi(kisi.ad_soyad);
    revalidatePath(`/kisi/${kisiId}`);
    return { error: null, mesaj: sonuc.mesaj };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Klasör taşınamadı." };
  }
}

/** İş sözleşmesi şablonunu (belirli ya da belirsiz süreli; kullanıcının
 *  yüklediği şablon, yoksa templates/'teki örnek — lib/sablon.ts) doldurup .docx
 *  olarak üretir — depoya yazmaz, sadece indirme için base64 döner.
 *  Kullanıcı önizleyip kendi yükler (Faz 10 kararı, 29 Ağustos 2026).
 *  Girilen adres, bir dahaki sefere hatırlanması için kişiye kaydedilir. */
export async function sozlesmeUret(
  formData: FormData,
): Promise<{ error: string } | { error: null; base64: string; dosyaAdi: string }> {
  const supabase = await createClient();
  const kisiId = formData.get("kisi_id") as string;
  const adres = ((formData.get("adres") as string) || "").trim();
  const meslek = ((formData.get("meslek") as string) || "").trim();
  const ucret = ((formData.get("ucret") as string) || "").trim();
  const baslamaTarihi = formData.get("baslama_tarihi") as string;
  const bitisTarihi = formData.get("bitis_tarihi") as string;
  const imzaTarihi = formData.get("imza_tarihi") as string;
  const belirsiz = formData.get("tur") === "belirsiz";

  if (!adres) return { error: "Adres boş olamaz." };
  if (!meslek) return { error: "Meslek boş olamaz." };
  if (!ucret) return { error: "Ücret boş olamaz." };
  if (!baslamaTarihi || !imzaTarihi || (!belirsiz && !bitisTarihi)) return { error: "Tarihler eksik." };

  const { data: kisi } = await supabase
    .from("kisi")
    .select("ad_soyad, tc_kimlik_no")
    .eq("id", kisiId)
    .single();
  if (!kisi) return { error: "Kişi bulunamadı." };

  const { data: sirket } = await supabase
    .from("ayarlar")
    .select("sirket_unvani, sirket_adresi")
    .eq("id", true)
    .single();
  if (!sirket?.sirket_unvani || !sirket?.sirket_adresi) {
    return { error: "Önce Ayarlar'da şirket unvanını ve adresini gir — sözleşmede işveren olarak geçiyor." };
  }

  await supabase.from("kisi").update({ adres }).eq("id", kisiId);

  try {
    const { icerik } = await gecerliSablon(supabase, belirsiz ? "sozlesme_belirsiz" : "sozlesme_belirli");
    const buffer = sablonDoldur(icerik, {
      AD_SOYAD: kisi.ad_soyad,
      TC: kisi.tc_kimlik_no,
      ADRES: adres,
      MESLEK: meslek,
      UCRET: ucret,
      IMZA_TARIHI: tarihSlash(imzaTarihi),
      BASLAMA_TARIHI: tarihSlash(baslamaTarihi),
      BITIS_TARIHI: belirsiz ? "" : tarihSlash(bitisTarihi),
      SIRKET_UNVANI: sirket.sirket_unvani.toLocaleUpperCase("tr-TR"),
      SIRKET_ADRESI: sirket.sirket_adresi,
    });
    return {
      error: null,
      base64: buffer.toString("base64"),
      dosyaAdi: `${baslamaTarihi.replaceAll("-", ".")}_sozlesme.docx`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sözleşme oluşturulamadı." };
  }
}

// Faz 11 revize (29 Ağustos 2026): ödeme, dönemin kendi durumu —
// sözleşmedeki tutar bankadan gönderildi mi sorusunun cevabı. Tutar/vade
// takibi kullanıcının kendi ön muhasebe programında yapılıyor, burada
// sadece "yok" (ödenmedi) / "var" (ödendi) / "yoksayildi" (görmezden gel)
// durumu tutuluyor — belge durumu deseniyle birebir aynı.

export async function odemeOdendiIsaretle(formData: FormData): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const isGirisiId = formData.get("is_girisi_id") as string;
  const kisiId = formData.get("kisi_id") as string;

  const { error } = await supabase
    .from("is_girisi")
    .update({ odeme_durumu: "var", odeme_tarihi: new Date().toISOString().slice(0, 10) })
    .eq("id", isGirisiId);
  if (error) return { error: error.message };

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
  revalidatePath("/odemeler");
  return { error: null };
}

export async function odemeGorMezdenGel(formData: FormData): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const isGirisiId = formData.get("is_girisi_id") as string;
  const kisiId = formData.get("kisi_id") as string;

  const { error } = await supabase
    .from("is_girisi")
    .update({ odeme_durumu: "yoksayildi", odeme_tarihi: null })
    .eq("id", isGirisiId);
  if (error) return { error: error.message };

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
  revalidatePath("/odemeler");
  return { error: null };
}

export async function odemeGeriAl(formData: FormData): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const isGirisiId = formData.get("is_girisi_id") as string;
  const kisiId = formData.get("kisi_id") as string;

  const { error } = await supabase
    .from("is_girisi")
    .update({ odeme_durumu: "yok", odeme_tarihi: null })
    .eq("id", isGirisiId);
  if (error) return { error: error.message };

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
  revalidatePath("/odemeler");
  return { error: null };
}

async function girisBildirgesiAlinmisMi(isGirisiId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("is_girisi_belge")
    .select("durum")
    .eq("is_girisi_id", isGirisiId)
    .eq("belge_tipi", "isegiris_bildirgesi")
    .maybeSingle();
  return data?.durum === "var";
}

export async function updateIsGirisi(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const isGirisiId = formData.get("is_girisi_id") as string;
  const kisiId = formData.get("kisi_id") as string;

  if (await girisBildirgesiAlinmisMi(isGirisiId)) {
    return {
      error: "İş giriş bildirgesi zaten alınmış — bu dönem düzenlenemez.",
    };
  }

  const girisTarihi = formData.get("giris_tarihi") as string;
  const cikisTarihiRaw = formData.get("cikis_tarihi") as string;
  const cikisTarihi = cikisTarihiRaw || null;
  const cikisNedeniRaw = formData.get("cikis_nedeni") as string;
  const cikisNedeni = cikisTarihi ? cikisNedeniRaw || null : null;
  const durum = formData.get("durum") as "aktif" | "pasif";
  const ucretTutariRaw = formData.get("ucret_tutari") as string;
  const ucretTutari = ucretTutariRaw ? Number(ucretTutariRaw) : null;
  const ucretPeriyodu = (formData.get("ucret_periyodu") as UcretPeriyodu | "") || null;
  const ucretTipi = (formData.get("ucret_tipi") as UcretTipi | "") || null;

  const { error } = await supabase
    .from("is_girisi")
    .update({
      giris_tarihi: girisTarihi,
      cikis_tarihi: cikisTarihi,
      cikis_nedeni: cikisNedeni,
      durum,
      ucret_tutari: ucretTutari,
      ucret_periyodu: ucretTutari != null ? ucretPeriyodu : null,
      ucret_tipi: ucretTutari != null ? ucretTipi : null,
    })
    .eq("id", isGirisiId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
  return { error: null };
}

export async function deleteIsGirisi(
  formData: FormData,
): Promise<{ error: string | null; kisiSilindi?: boolean }> {
  const supabase = await createClient();
  const isGirisiId = formData.get("is_girisi_id") as string;
  const kisiId = formData.get("kisi_id") as string;

  if (await girisBildirgesiAlinmisMi(isGirisiId)) {
    return {
      error: "İş giriş bildirgesi zaten alınmış — bu dönem silinemez.",
    };
  }

  const { error } = await supabase.from("is_girisi").delete().eq("id", isGirisiId);
  if (error) {
    return { error: error.message };
  }

  // kişinin başka hiç dönemi kalmadıysa (ör. yanlışlıkla oluşturulmuş yeni kişi) kişi kaydını da temizle
  const { data: kalanDonemler } = await supabase
    .from("is_girisi")
    .select("id")
    .eq("kisi_id", kisiId)
    .limit(1);
  if (!kalanDonemler || kalanDonemler.length === 0) {
    await supabase.from("kisi").delete().eq("id", kisiId);
    revalidatePath("/");
    return { error: null, kisiSilindi: true };
  }

  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
  return { error: null, kisiSilindi: false };
}

export async function updateAyarlar(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const sirketUnvani = ((formData.get("sirket_unvani") as string) || "").trim() || null;
  const sirketAdresi = ((formData.get("sirket_adresi") as string) || "").trim() || null;
  const maliMusavirEmail = (formData.get("mali_musavir_email") as string) || null;
  const gonderenEmail = (formData.get("gonderen_email") as string) || null;
  const takipEmail = (formData.get("takip_email") as string) || null;
  const isgEmail = ((formData.get("isg_email") as string) || "").trim() || null;
  const isgCcGiris = formData.get("isg_cc_giris") === "on";
  const asgariUcretAylikRaw = formData.get("asgari_ucret_aylik") as string;
  const asgariUcretAylik = asgariUcretAylikRaw ? Number(asgariUcretAylikRaw) : null;

  if (asgariUcretAylik !== null && (Number.isNaN(asgariUcretAylik) || asgariUcretAylik <= 0)) {
    return { error: "Asgari ücret geçerli bir sayı olmalı." };
  }

  const { error } = await supabase
    .from("ayarlar")
    .update({
      sirket_unvani: sirketUnvani,
      sirket_adresi: sirketAdresi,
      mali_musavir_email: maliMusavirEmail,
      gonderen_email: gonderenEmail,
      takip_email: takipEmail,
      isg_email: isgEmail,
      isg_cc_giris: isgCcGiris,
      ...(asgariUcretAylik !== null ? { asgari_ucret_aylik: asgariUcretAylik } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/ayarlar");
  return { error: null };
}

export async function updateProfil(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const unvan = (formData.get("profil_unvan") as string) || null;
  const iletisim = (formData.get("profil_iletisim") as string) || null;

  const { error } = await supabase
    .from("ayarlar")
    .update({
      profil_unvan: unvan,
      profil_iletisim: iletisim,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { error: null };
}

function ccListesi(
  ayarlar: { takip_email: string | null; isg_email?: string | null; isg_cc_giris?: boolean | null },
  girisMaili: boolean,
): string | undefined {
  // gönderen adresi cc'ye eklenmiyor — IMAP zaten Sent klasörüne yazıyor, tekrar cc'lemeye gerek yok.
  // İş girişi maillerinde İSG uzmanı da bilgiye eklenir (13 Ekim 2026), işe
  // başlama eğitimini planlayabilsin; ayarlardan kapatılabilir.
  const liste = [ayarlar.takip_email];
  if (girisMaili && ayarlar.isg_cc_giris !== false) liste.push(ayarlar.isg_email ?? null);
  const temiz = liste.filter((e): e is string => !!e?.trim());
  return temiz.length ? temiz.join(", ") : undefined;
}

// Mali müşavir "Yanıtla" ile cevap yazınca konu genelde korunur — bu kod
// gelen cevabı doğru kişi/döneme geri eşleştirmek için subject'e eklenir (Faz 6).
function referansKoduUret(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function muhasebeMailiGonderVeKaydet(
  isGirisiId: string,
  kisiId: string,
  tip: "giris" | "cikis",
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: ayarlar } = await supabase.from("ayarlar").select("*").eq("id", true).single();
  if (!ayarlar?.mali_musavir_email || !ayarlar?.gonderen_email) {
    return {
      error: "Önce Ayarlar sayfasından mali müşavir ve gönderen e-posta adresini girin.",
    };
  }

  const { data: kisi } = await supabase
    .from("kisi")
    .select("*")
    .eq("id", kisiId)
    .single<Kisi>();
  const { data: isGirisi } = await supabase
    .from("is_girisi")
    .select("*")
    .eq("id", isGirisiId)
    .single<IsGirisi>();

  if (!kisi || !isGirisi) {
    return { error: "Kayıt bulunamadı." };
  }

  const { subject, html } =
    tip === "giris"
      ? iseGirisMailIcerigi(kisi, isGirisi, ayarlar.sirket_unvani)
      : istenAyrilisMailIcerigi(kisi, isGirisi, ayarlar.sirket_unvani);

  const referansKodu = referansKoduUret();
  const sonuc = await mailGonder({
    to: ayarlar.mali_musavir_email,
    cc: ccListesi(ayarlar, tip === "giris"),
    from: ayarlar.gonderen_email,
    subject: `${subject} [REF:${referansKodu}]`,
    html,
  });

  await supabase.from("mail_gonderim_kaydi").insert({
    is_girisi_id: isGirisiId,
    tip,
    durum: sonuc.ok ? "basarili" : "basarisiz",
    hata_mesaji: sonuc.ok ? null : sonuc.error,
    alici_email: ayarlar.mali_musavir_email,
    referans_kodu: referansKodu,
  });

  revalidatePath(`/kisi/${kisiId}`);

  if (!sonuc.ok) {
    return { error: sonuc.error };
  }
  return { error: null };
}

export async function girisMailiGonder(formData: FormData): Promise<{ error: string | null }> {
  const kisiId = formData.get("kisi_id") as string;
  const isGirisiId = formData.get("is_girisi_id") as string;
  return muhasebeMailiGonderVeKaydet(isGirisiId, kisiId, "giris");
}

export async function cikisMailiGonder(formData: FormData): Promise<{ error: string | null }> {
  const kisiId = formData.get("kisi_id") as string;
  const isGirisiId = formData.get("is_girisi_id") as string;
  return muhasebeMailiGonderVeKaydet(isGirisiId, kisiId, "cikis");
}

export type TopluGirisSatiri = {
  kisiId: string | null;
  adSoyad: string | null;
  tcKimlikNo: string | null;
  meslekKodu: string | null;
  meslekAdi: string | null;
  girisTarihi: string;
  ucretTutari: number | null;
  ucretPeriyodu: UcretPeriyodu | null;
  ucretTipi: UcretTipi | null;
};

export type TopluSonuc = { adSoyad: string; ok: boolean; isGirisiId?: string; hata?: string };

export async function topluIsGirisiOlustur(
  satirlar: TopluGirisSatiri[],
): Promise<{ sonuclar: TopluSonuc[] }> {
  const supabase = await createClient();
  const sonuclar: TopluSonuc[] = [];

  for (const satir of satirlar) {
    let kisiId = satir.kisiId;
    let adSoyad = satir.adSoyad ?? "?";

    if (!satir.meslekKodu || !satir.meslekAdi) {
      sonuclar.push({ adSoyad, ok: false, hata: "Meslek seçilmedi." });
      continue;
    }

    if (!kisiId) {
      if (!satir.adSoyad || !satir.tcKimlikNo) {
        sonuclar.push({ adSoyad, ok: false, hata: "Eksik bilgi (kişi seçilmedi ya da yeni kişi bilgileri tamamlanmadı)." });
        continue;
      }
      const { data: kisi, error } = await supabase
        .from("kisi")
        .insert({
          ad_soyad: satir.adSoyad,
          tc_kimlik_no: satir.tcKimlikNo,
          meslek_kodu: satir.meslekKodu,
          meslek_adi: satir.meslekAdi,
        })
        .select()
        .single();
      if (error) {
        sonuclar.push({ adSoyad, ok: false, hata: error.message });
        continue;
      }
      kisiId = kisi.id;
      adSoyad = kisi.ad_soyad;
    } else {
      // Kişinin kaydındaki meslek "son kullanılan" varsayılandır — bir
      // sonraki girişte form bununla dolu gelsin.
      await supabase
        .from("kisi")
        .update({ meslek_kodu: satir.meslekKodu, meslek_adi: satir.meslekAdi })
        .eq("id", kisiId);
    }

    const { data: girisi, error: girisError } = await supabase
      .from("is_girisi")
      .insert({
        kisi_id: kisiId,
        giris_tarihi: satir.girisTarihi,
        meslek_kodu: satir.meslekKodu,
        meslek_adi: satir.meslekAdi,
        ucret_tutari: satir.ucretTutari,
        ucret_periyodu: satir.ucretTutari != null ? satir.ucretPeriyodu : null,
        ucret_tipi: satir.ucretTutari != null ? satir.ucretTipi : null,
      })
      .select()
      .single();

    if (girisError) {
      sonuclar.push({ adSoyad, ok: false, hata: girisError.message });
      continue;
    }
    sonuclar.push({ adSoyad, ok: true, isGirisiId: girisi.id });
  }

  revalidatePath("/");
  return { sonuclar };
}

export async function topluGirisMailiGonder(
  isGirisiIds: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: ayarlar } = await supabase.from("ayarlar").select("*").eq("id", true).single();
  if (!ayarlar?.mali_musavir_email || !ayarlar?.gonderen_email) {
    return { error: "Önce Ayarlar sayfasından mali müşavir ve gönderen e-posta adresini girin." };
  }

  const { data: donemler } = await supabase
    .from("is_girisi")
    .select("*")
    .in("id", isGirisiIds)
    .returns<IsGirisi[]>();
  if (!donemler || donemler.length === 0) {
    return { error: "Kayıt bulunamadı." };
  }

  const kisiIds = [...new Set(donemler.map((d) => d.kisi_id))];
  const { data: kisiler } = await supabase
    .from("kisi")
    .select("*")
    .in("id", kisiIds)
    .returns<Kisi[]>();
  const kisiMap = new Map((kisiler ?? []).map((k) => [k.id, k]));

  const satirlar = donemler
    .map((d) => ({ kisi: kisiMap.get(d.kisi_id), isGirisi: d }))
    .filter((s): s is { kisi: Kisi; isGirisi: IsGirisi } => !!s.kisi);

  const { subject, html } = topluGirisMailIcerigi(satirlar, ayarlar.sirket_unvani);
  const referansKodu = referansKoduUret();
  const sonuc = await mailGonder({
    to: ayarlar.mali_musavir_email,
    cc: ccListesi(ayarlar, true),
    from: ayarlar.gonderen_email,
    subject: `${subject} [REF:${referansKodu}]`,
    html,
  });

  await supabase.from("mail_gonderim_kaydi").insert(
    isGirisiIds.map((id) => ({
      is_girisi_id: id,
      tip: "giris" as const,
      durum: sonuc.ok ? "basarili" : "basarisiz",
      hata_mesaji: sonuc.ok ? null : sonuc.error,
      alici_email: ayarlar.mali_musavir_email,
      referans_kodu: referansKodu,
    })),
  );

  revalidatePath("/");
  if (!sonuc.ok) return { error: sonuc.error };
  return { error: null };
}

export async function topluCikisUygula(
  isGirisiIds: string[],
  cikisTarihi: string,
  cikisNedeni: string | null,
): Promise<{ error: string | null; klasorUyarilari?: string[] }> {
  const supabase = await createClient();

  const { data: etkilenenler } = await supabase
    .from("is_girisi")
    .select("kisi_id")
    .in("id", isGirisiIds);

  const { error } = await supabase
    .from("is_girisi")
    .update({ durum: "pasif", cikis_tarihi: cikisTarihi, cikis_nedeni: cikisNedeni })
    .in("id", isGirisiIds);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/is-cikisi");

  // Kişi artık tamamen pasifse (başka aktif dönemi kalmadıysa) depodaki
  // klasörünü AKTİF'ten PASİF'e taşımayı dener — en iyi çaba, başarısız
  // olursa çıkışın kendisini engellemez, sadece uyarı olarak döner.
  const kisiIdler = [...new Set((etkilenenler ?? []).map((r) => r.kisi_id))];
  const klasorUyarilari: string[] = [];
  for (const kisiId of kisiIdler) {
    const { data: kalanAktif } = await supabase
      .from("is_girisi")
      .select("id")
      .eq("kisi_id", kisiId)
      .eq("durum", "aktif")
      .limit(1);
    if (kalanAktif && kalanAktif.length > 0) continue;

    const { data: kisi } = await supabase.from("kisi").select("ad_soyad").eq("id", kisiId).single();
    if (!kisi) continue;
    try {
      await kisiKlasorunuPasifeTasi(kisi.ad_soyad);
    } catch (e) {
      klasorUyarilari.push(
        `${kisi.ad_soyad}: ${e instanceof Error ? e.message : "klasör taşınamadı."}`,
      );
    }
  }

  return { error: null, ...(klasorUyarilari.length > 0 ? { klasorUyarilari } : {}) };
}

export async function topluAyrilisMailiGonder(
  isGirisiIds: string[],
  not: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: ayarlar } = await supabase.from("ayarlar").select("*").eq("id", true).single();
  if (!ayarlar?.mali_musavir_email || !ayarlar?.gonderen_email) {
    return { error: "Önce Ayarlar sayfasından mali müşavir ve gönderen e-posta adresini girin." };
  }

  const { data: donemler } = await supabase
    .from("is_girisi")
    .select("*")
    .in("id", isGirisiIds)
    .returns<IsGirisi[]>();
  if (!donemler || donemler.length === 0) {
    return { error: "Kayıt bulunamadı." };
  }

  const kisiIds = [...new Set(donemler.map((d) => d.kisi_id))];
  const { data: kisiler } = await supabase
    .from("kisi")
    .select("*")
    .in("id", kisiIds)
    .returns<Kisi[]>();
  const kisiMap = new Map((kisiler ?? []).map((k) => [k.id, k]));

  const satirlar = donemler
    .map((d) => ({ kisi: kisiMap.get(d.kisi_id), isGirisi: d }))
    .filter((s): s is { kisi: Kisi; isGirisi: IsGirisi } => !!s.kisi);

  const { subject, html } = topluAyrilisMailIcerigi(satirlar, not, ayarlar.sirket_unvani);
  const referansKodu = referansKoduUret();
  const sonuc = await mailGonder({
    to: ayarlar.mali_musavir_email,
    cc: ccListesi(ayarlar, false),
    from: ayarlar.gonderen_email,
    subject: `${subject} [REF:${referansKodu}]`,
    html,
  });

  await supabase.from("mail_gonderim_kaydi").insert(
    isGirisiIds.map((id) => ({
      is_girisi_id: id,
      tip: "cikis" as const,
      durum: sonuc.ok ? "basarili" : "basarisiz",
      hata_mesaji: sonuc.ok ? null : sonuc.error,
      alici_email: ayarlar.mali_musavir_email,
      referans_kodu: referansKodu,
      cikis_notu: not,
    })),
  );

  revalidatePath("/");
  if (!sonuc.ok) return { error: sonuc.error };
  return { error: null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
