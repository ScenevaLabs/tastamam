"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { donemBelgeYaz, kokBelgeYaz } from "@/lib/ozluk-dosya";
import { gelenPdfEkleriniTara, ekBufferAl, ekTemizle } from "@/lib/imap";
import {
  pdfMetniniCikar,
  pdfSayfalariniCikar,
  pdfSayfasiniAyir,
  tcKimlikNolariAyikla,
} from "@/lib/pdf";
import {
  belgeTipiBul,
  donemSec,
  isimGeciyorMu,
  kokTipiMi,
  isgTipiMi,
  type BelgeTipi,
} from "@/lib/belge-tanima";
import { formatDonemAraligi } from "@/lib/utils";
import {
  DONEM_BELGE_ETIKETLERI,
  type IsGirisiBelgeTipi,
  type KisiBelgeTipi,
  type Kisi,
  type IsGirisi,
} from "@/lib/types";

export type GelenEkAday = {
  isGirisiId: string;
  kisiAdSoyad: string;
  donemOzeti: string;
  tip: "giris" | "cikis";
};

export type GelenEkOnerisi = {
  token: string;
  dosyaAdi: string;
  konu: string;
  gonderenEmail: string;
  tarih: string;
  adaylar: GelenEkAday[];
  eslesmeYontemi: "ref" | "tc" | "yok";
  /** Neden otomatik dosyalanamadığı — kullanıcıya gösterilir. */
  neden?: string;
  /** İçerikten tahmin edilen belge tipi, seçim kutusunda önceden seçili gelir. */
  tahminBelgeTipi?: IsGirisiBelgeTipi | null;
};

export type OtomatikDosyalananSonuc = {
  kisiAdSoyad: string;
  belgeTipi: BelgeTipi;
  dosyaAdi: string;
};

export type OtomatikHataSonuc = {
  dosyaAdi: string;
  hata: string;
};

export type GelenTaramaSonucu = {
  otomatikDosyalanan: OtomatikDosyalananSonuc[];
  otomatikHatali: OtomatikHataSonuc[];
  manuelGerekli: GelenEkOnerisi[];
  error: string | null;
};

// REF akışı sadece bu iki SGK bildirgesi için var (mail_gonderim_kaydi.tip
// hep "giris"/"cikis") — mali müşavirden başka belge tipi REF ile talep
// edilmiyor, bkz. actions.ts.
const REF_BELGE_TIPI: Record<"giris" | "cikis", IsGirisiBelgeTipi> = {
  giris: "isegiris_bildirgesi",
  cikis: "istenayrilis_bildirgesi",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Bir PDF'i doğru döneme yazar (depoya, açık klasörü gerekirse kapatarak)
 *  ve o dönemin eksik evrak listesinden düşürür. Hem otomatik hem elle
 *  dosyalama akışının ortak son adımı. */
async function donemBelgesiIsle(
  supabase: Supabase,
  isGirisiId: string,
  belgeTipi: IsGirisiBelgeTipi,
  buffer: Buffer,
  dosyaAdi = "belge.pdf",
): Promise<{ kisiAdSoyad: string; kisiId: string } | { error: string }> {
  const { data: donem } = await supabase
    .from("is_girisi")
    .select("giris_tarihi, cikis_tarihi, durum, kisi_id")
    .eq("id", isGirisiId)
    .single();
  if (!donem) {
    return { error: "Kayıt bulunamadı." };
  }

  const { data: kisi } = await supabase
    .from("kisi")
    .select("ad_soyad")
    .eq("id", donem.kisi_id)
    .single();
  if (!kisi) {
    return { error: "Kişi bulunamadı." };
  }

  const dosya = new File([new Uint8Array(buffer)], dosyaAdi, { type: "application/pdf" });

  try {
    await donemBelgeYaz({
      adSoyad: kisi.ad_soyad,
      varsayilanDurum: donem.durum,
      girisTarihi: donem.giris_tarihi,
      cikisTarihi: donem.cikis_tarihi,
      belgeTipi,
      dosya,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dosya yazılamadı." };
  }

  const { data: updated } = await supabase
    .from("is_girisi_belge")
    .update({ durum: "var" })
    .eq("is_girisi_id", isGirisiId)
    .eq("belge_tipi", belgeTipi)
    .select();

  if (!updated || updated.length === 0) {
    await supabase
      .from("is_girisi_belge")
      .insert({ is_girisi_id: isGirisiId, belge_tipi: belgeTipi, durum: "var" });
  }

  return { kisiAdSoyad: kisi.ad_soyad, kisiId: donem.kisi_id };
}

type TaramaVerisi = {
  kisiler: Kisi[];
  donemler: IsGirisi[];
  /** "isGirisiId:tip" — kararı verilmiş (var/yoksayıldı) dönem belgeleri */
  donemKarari: Set<string>;
  /** "kisiId:tip" — kararı verilmiş kök belgeler */
  kokKarari: Set<string>;
};

type Hedef =
  | { tur: "donem"; isGirisiId: string; belgeTipi: IsGirisiBelgeTipi }
  | { tur: "kok"; kisiId: string; belgeTipi: KisiBelgeTipi };

type CozumSonucu =
  | { tamam: true; hedef: Hedef }
  | { tamam: false; neden: string; kisiIds: string[]; tahminTip: IsGirisiBelgeTipi | null };

/** Bir belge metninden hedefi (kişi + belge tipi + dönem) bulmaya çalışır.
 *  `refDonemIds` verilirse (maildeki REF kodundan) aday kişi/dönemler o
 *  kümeyle sınırlanır. `refTip` içerikten tip çıkmazsa yedek olarak kullanılır. */
function belgeyiCoz(
  metin: string,
  dosyaAdi: string,
  veri: TaramaVerisi,
  refDonemIds: string[] | null,
  refTip: IsGirisiBelgeTipi | null,
): CozumSonucu {
  const tahmin = belgeTipiBul(metin, dosyaAdi);
  const tip: BelgeTipi | null = tahmin?.tip ?? refTip;
  const tahminTip = tip && !kokTipiMi(tip) && !isgTipiMi(tip) ? tip : null;

  const refDonemler = refDonemIds ? veri.donemler.filter((d) => refDonemIds.includes(d.id)) : null;
  const adayKisiler = refDonemler
    ? veri.kisiler.filter((k) => refDonemler.some((d) => d.kisi_id === k.id))
    : veri.kisiler;

  const tcler = new Set(tcKimlikNolariAyikla(metin));
  let kisiler = adayKisiler.filter((k) => tcler.has(k.tc_kimlik_no));
  if (kisiler.length === 0) kisiler = adayKisiler.filter((k) => isimGeciyorMu(metin, k.ad_soyad));
  if (kisiler.length === 0 && adayKisiler.length === 1 && refDonemler) kisiler = adayKisiler;

  if (kisiler.length !== 1) {
    return {
      tamam: false,
      neden:
        kisiler.length > 1
          ? "Belgede birden fazla çalışanın bilgisi var."
          : metin.trim()
            ? "Belgenin kime ait olduğu içerikten bulunamadı."
            : "Belge metin içermiyor (taranmış/fotoğraf), kime ait olduğu okunamadı.",
      kisiIds: kisiler.map((k) => k.id),
      tahminTip,
    };
  }
  const kisi = kisiler[0];

  if (!tip) {
    return {
      tamam: false,
      neden: `${kisi.ad_soyad} için olduğu anlaşıldı ama hangi belge olduğu anlaşılamadı.`,
      kisiIds: [kisi.id],
      tahminTip,
    };
  }

  if (isgTipiMi(tip)) {
    // İSG belgesi alınma tarihi istediği için otomatik dosyalanmıyor.
    return {
      tamam: false,
      neden: `${kisi.ad_soyad} — İSG belgesi: alınma tarihiyle kişi sayfasındaki İSG bölümünden yükleyin.`,
      kisiIds: [kisi.id],
      tahminTip,
    };
  }

  if (kokTipiMi(tip)) {
    if (veri.kokKarari.has(`${kisi.id}:${tip}`)) {
      return { tamam: false, neden: "Bu belge kişide zaten var olarak işaretli.", kisiIds: [kisi.id], tahminTip };
    }
    return { tamam: true, hedef: { tur: "kok", kisiId: kisi.id, belgeTipi: tip } };
  }

  const kisininDonemleri = (refDonemler ?? veri.donemler).filter((d) => d.kisi_id === kisi.id);
  const eksikOlanlar = kisininDonemleri.filter((d) => !veri.donemKarari.has(`${d.id}:${tip}`));
  const donem = donemSec(eksikOlanlar, tip, metin);
  if (!donem) {
    return {
      tamam: false,
      neden:
        eksikOlanlar.length === 0
          ? `${kisi.ad_soyad} — ${DONEM_BELGE_ETIKETLERI[tip]} hiçbir dönemde eksik görünmüyor.`
          : `${kisi.ad_soyad} — ${DONEM_BELGE_ETIKETLERI[tip]}: hangi döneme ait olduğu belirlenemedi.`,
      kisiIds: [kisi.id],
      tahminTip,
    };
  }
  return { tamam: true, hedef: { tur: "donem", isGirisiId: donem.id, belgeTipi: tip } };
}

async function hedefeYaz(
  supabase: Supabase,
  veri: TaramaVerisi,
  hedef: Hedef,
  buffer: Buffer,
  dosyaAdi: string,
): Promise<{ kisiAdSoyad: string; kisiId: string } | { error: string }> {
  if (hedef.tur === "donem") {
    const sonuc = await donemBelgesiIsle(supabase, hedef.isGirisiId, hedef.belgeTipi, buffer, dosyaAdi);
    if (!("error" in sonuc)) veri.donemKarari.add(`${hedef.isGirisiId}:${hedef.belgeTipi}`);
    return sonuc;
  }
  const kisi = veri.kisiler.find((k) => k.id === hedef.kisiId);
  if (!kisi) return { error: "Kişi bulunamadı." };
  const aktif = veri.donemler.some((d) => d.kisi_id === kisi.id && d.durum === "aktif");
  try {
    await kokBelgeYaz({
      adSoyad: kisi.ad_soyad,
      varsayilanDurum: aktif ? "aktif" : "pasif",
      belgeTipi: hedef.belgeTipi,
      dosya: new File([new Uint8Array(buffer)], dosyaAdi),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dosya yazılamadı." };
  }
  const { data: updated } = await supabase
    .from("kisi_belge")
    .update({ durum: "var" })
    .eq("kisi_id", kisi.id)
    .eq("belge_tipi", hedef.belgeTipi)
    .select();
  if (!updated || updated.length === 0) {
    await supabase
      .from("kisi_belge")
      .insert({ kisi_id: kisi.id, belge_tipi: hedef.belgeTipi, durum: "var" });
  }
  veri.kokKarari.add(`${kisi.id}:${hedef.belgeTipi}`);
  return { kisiAdSoyad: kisi.ad_soyad, kisiId: kisi.id };
}

function hedefEtiketi(hedef: Hedef): BelgeTipi {
  return hedef.belgeTipi;
}

/** Mali müşavirden gelen PDF eklerini tarar ve içeriğini okuyarak kendisi
 *  dosyalar (22 Eylül 2026'dan itibaren tam otomatik): kişi TC kimlik no
 *  (yoksa ad soyad) ile, belge tipi başlıktan, dönem eksik belgeler ve
 *  metindeki tarihlerle bulunur. Maildeki REF kodu varsa aday kümesini
 *  daraltır. Tek dosyada birden fazla kişinin belgesi varsa sayfa sayfa
 *  bölünür. Sadece karar verilemeyen ekler kullanıcıya sorulur. */
export async function gelenMailleriTara(): Promise<GelenTaramaSonucu> {
  const supabase = await createClient();

  const bosSonuc: GelenTaramaSonucu = {
    otomatikDosyalanan: [],
    otomatikHatali: [],
    manuelGerekli: [],
    error: null,
  };

  const { data: ayarlar } = await supabase.from("ayarlar").select("*").eq("id", true).single();
  if (!ayarlar?.mali_musavir_email) {
    return {
      ...bosSonuc,
      error: "Önce Ayarlar sayfasından mali müşavir e-posta adresini girin.",
    };
  }

  const { ekler: bulunanlar, error } = await gelenPdfEkleriniTara(ayarlar.mali_musavir_email);
  if (error) {
    return { ...bosSonuc, error };
  }
  if (bulunanlar.length === 0) return bosSonuc;

  // Çalışan sayısı küçük (onlarca) — tüm kişi/dönem/belge durumunu bir kez yükle.
  const [{ data: kisiler }, { data: donemler }, { data: donemBelgeleri }, { data: kokBelgeleri }] =
    await Promise.all([
      supabase.from("kisi").select("*").returns<Kisi[]>(),
      supabase.from("is_girisi").select("*").order("giris_tarihi", { ascending: false }).returns<IsGirisi[]>(),
      supabase.from("is_girisi_belge").select("is_girisi_id, belge_tipi, durum"),
      supabase.from("kisi_belge").select("kisi_id, belge_tipi, durum"),
    ]);
  const kararli = (d: string) => d === "var" || d === "yoksayildi";
  const veri: TaramaVerisi = {
    kisiler: kisiler ?? [],
    donemler: donemler ?? [],
    donemKarari: new Set(
      (donemBelgeleri ?? []).filter((b) => kararli(b.durum)).map((b) => `${b.is_girisi_id}:${b.belge_tipi}`),
    ),
    kokKarari: new Set(
      (kokBelgeleri ?? []).filter((b) => kararli(b.durum)).map((b) => `${b.kisi_id}:${b.belge_tipi}`),
    ),
  };
  const kisiById = new Map(veri.kisiler.map((k) => [k.id, k]));

  const referansKodlari = [
    ...new Set(bulunanlar.map((e) => e.referansKodu).filter((r): r is string => !!r)),
  ];
  const kayitMap = new Map<string, { is_girisi_id: string; tip: "giris" | "cikis" }[]>();
  if (referansKodlari.length > 0) {
    const { data: kayitlar } = await supabase
      .from("mail_gonderim_kaydi")
      .select("referans_kodu, is_girisi_id, tip")
      .in("referans_kodu", referansKodlari);
    for (const k of kayitlar ?? []) {
      if (!k.referans_kodu) continue;
      if (!kayitMap.has(k.referans_kodu)) kayitMap.set(k.referans_kodu, []);
      kayitMap.get(k.referans_kodu)!.push({ is_girisi_id: k.is_girisi_id, tip: k.tip });
    }
  }

  const otomatikDosyalanan: OtomatikDosyalananSonuc[] = [];
  const otomatikHatali: OtomatikHataSonuc[] = [];
  const manuelGerekli: GelenEkOnerisi[] = [];
  const etkilenenKisiIds = new Set<string>();

  const adayOlustur = (d: IsGirisi, tip: "giris" | "cikis"): GelenEkAday | null => {
    const kisi = kisiById.get(d.kisi_id);
    if (!kisi) return null;
    return {
      isGirisiId: d.id,
      kisiAdSoyad: kisi.ad_soyad,
      donemOzeti: formatDonemAraligi(d.giris_tarihi, d.cikis_tarihi),
      tip,
    };
  };

  for (const e of bulunanlar) {
    const buffer = ekBufferAl(e.token);
    if (!buffer) {
      otomatikHatali.push({ dosyaAdi: e.dosyaAdi, hata: "Ek artık mevcut değil." });
      continue;
    }

    const refKayitlari = e.referansKodu ? (kayitMap.get(e.referansKodu) ?? []) : [];
    const refDonemIds = refKayitlari.length > 0 ? refKayitlari.map((k) => k.is_girisi_id) : null;
    const refTip = refKayitlari.length > 0 ? REF_BELGE_TIPI[refKayitlari[0].tip] : null;

    let metin = "";
    let sayfalar: string[] = [];
    try {
      metin = await pdfMetniniCikar(buffer);
      sayfalar = await pdfSayfalariniCikar(buffer);
    } catch {
      // metin okunamadı — REF tek kişiyse yine çözülebilir, değilse sorulur
    }

    const kaydet = async (hedef: Hedef, buf: Buffer, etiket: string) => {
      const sonuc = await hedefeYaz(supabase, veri, hedef, buf, e.dosyaAdi);
      if ("error" in sonuc) {
        otomatikHatali.push({ dosyaAdi: etiket, hata: sonuc.error });
      } else {
        otomatikDosyalanan.push({
          kisiAdSoyad: sonuc.kisiAdSoyad,
          belgeTipi: hedefEtiketi(hedef),
          dosyaAdi: etiket,
        });
        etkilenenKisiIds.add(sonuc.kisiId);
      }
    };

    const cozum = belgeyiCoz(metin, e.dosyaAdi, veri, refDonemIds, refTip);
    if (cozum.tamam) {
      await kaydet(cozum.hedef, buffer, e.dosyaAdi);
      ekTemizle(e.token);
      continue;
    }

    // Toplu gönderim: mali müşavir N kişinin belgesini tek PDF'e sayfa sayfa
    // koyabiliyor (ör. 8 kişilik ibraname). Her sayfa ayrı çözülür; hepsi
    // net çözülürse bölünür, biri bile belirsizse tüm ek sorulur.
    if (sayfalar.length > 1) {
      const sayfaHedefleri: Hedef[] = [];
      for (const sayfa of sayfalar) {
        const c = belgeyiCoz(sayfa, e.dosyaAdi, veri, refDonemIds, refTip);
        if (!c.tamam) break;
        sayfaHedefleri.push(c.hedef);
      }
      const hedefAnahtari = (h: Hedef) =>
        h.tur === "donem" ? `${h.isGirisiId}:${h.belgeTipi}` : `${h.kisiId}:${h.belgeTipi}`;
      const tekil = new Set(sayfaHedefleri.map(hedefAnahtari)).size === sayfaHedefleri.length;
      if (sayfaHedefleri.length === sayfalar.length && tekil) {
        for (let i = 0; i < sayfalar.length; i++) {
          const sayfaBufferi = await pdfSayfasiniAyir(buffer, i);
          await kaydet(sayfaHedefleri[i], sayfaBufferi, `${e.dosyaAdi} — sayfa ${i + 1}`);
        }
        ekTemizle(e.token);
        continue;
      }
    }

    // Karar verilemedi — adayları (bulunan kişilerin, yoksa REF'in, o da
    // yoksa herkesin dönemleri) tahmin önceden seçili olarak sun.
    const tahminTip = cozum.tahminTip;
    const cikisTipi = tahminTip === "istenayrilis_bildirgesi" || tahminTip === "ibraname";
    const adayDonemler = cozum.kisiIds.length
      ? veri.donemler.filter(
          (d) => cozum.kisiIds.includes(d.kisi_id) && (!refDonemIds || refDonemIds.includes(d.id)),
        )
      : refDonemIds
        ? veri.donemler.filter((d) => refDonemIds.includes(d.id))
        : veri.donemler;
    const adaylar = adayDonemler
      .map((d) => {
        const refKaydi = refKayitlari.find((k) => k.is_girisi_id === d.id);
        return adayOlustur(d, refKaydi?.tip ?? (cikisTipi ? "cikis" : "giris"));
      })
      .filter((a): a is GelenEkAday => !!a);

    manuelGerekli.push({
      token: e.token,
      dosyaAdi: e.dosyaAdi,
      konu: e.konu,
      gonderenEmail: e.gonderenEmail,
      tarih: e.tarih,
      adaylar,
      eslesmeYontemi: refDonemIds ? "ref" : cozum.kisiIds.length ? "tc" : "yok",
      neden: cozum.neden,
      tahminBelgeTipi: tahminTip,
    });
  }

  for (const kisiId of etkilenenKisiIds) revalidatePath(`/kisi/${kisiId}`);
  if (etkilenenKisiIds.size > 0) {
    revalidatePath("/");
    revalidatePath("/calisanlar");
  }

  return { otomatikDosyalanan, otomatikHatali, manuelGerekli, error: null };
}

export async function gelenEkiDosyala(formData: FormData): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const token = formData.get("token") as string;
  const isGirisiId = formData.get("is_girisi_id") as string;
  const belgeTipi = formData.get("belge_tipi") as IsGirisiBelgeTipi;

  const buffer = ekBufferAl(token);
  if (!buffer) {
    return { error: "Ek artık mevcut değil, listeyi yeniden tarayın." };
  }

  const sonuc = await donemBelgesiIsle(supabase, isGirisiId, belgeTipi, buffer);
  if ("error" in sonuc) {
    return { error: sonuc.error };
  }

  ekTemizle(token);
  revalidatePath(`/kisi/${sonuc.kisiId}`);
  revalidatePath("/");
  revalidatePath("/calisanlar");
  return { error: null };
}

export async function gelenEkiYoksay(token: string): Promise<void> {
  ekTemizle(token);
}
