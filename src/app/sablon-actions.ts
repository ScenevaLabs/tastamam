"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bugunIso } from "@/lib/isg";
import {
  SABLON_ADLARI,
  SABLONLAR,
  gecerliSablon,
  ornekSablon,
  sablonDogrula,
  sablonDoldur,
  type SablonAdi,
} from "@/lib/sablon";
import { tarihSlash } from "@/lib/utils";

// Belge şablonları ve KVKK metinleri (15 Ekim 2026, migration 0028).

type Indirme = { error: string } | { error: null; base64: string; dosyaAdi: string };
const AZAMI_BAYT = 2 * 1024 * 1024;

function adGecerli(ad: string): ad is SablonAdi {
  return (SABLON_ADLARI as readonly string[]).includes(ad);
}

/** Çalışanın KVKK aydınlatma metnini ya da açık rıza beyanını doldurup indirir. */
export async function kvkkBelgesiUret(kisiId: string, ad: "kvkk_aydinlatma" | "kvkk_acik_riza"): Promise<Indirme> {
  if (ad !== "kvkk_aydinlatma" && ad !== "kvkk_acik_riza") return { error: "Bilinmeyen belge." };
  const supabase = await createClient();
  const [{ data: kisi }, { data: ayarlar }] = await Promise.all([
    supabase.from("kisi").select("ad_soyad, tc_kimlik_no").eq("id", kisiId).maybeSingle(),
    supabase.from("ayarlar").select("sirket_unvani, sirket_adresi").eq("id", true).maybeSingle(),
  ]);
  if (!kisi) return { error: "Kişi bulunamadı." };
  if (!ayarlar?.sirket_unvani || !ayarlar?.sirket_adresi) {
    return { error: "Önce Ayarlar'da şirket unvanını ve adresini gir; metinde veri sorumlusu olarak geçiyor." };
  }
  try {
    const { icerik } = await gecerliSablon(supabase, ad);
    const buffer = sablonDoldur(icerik, {
      AD_SOYAD: kisi.ad_soyad,
      TC: kisi.tc_kimlik_no ?? "",
      TARIH: tarihSlash(bugunIso()),
      SIRKET_UNVANI: ayarlar.sirket_unvani.toLocaleUpperCase("tr-TR"),
      SIRKET_ADRESI: ayarlar.sirket_adresi,
    });
    const ek = ad === "kvkk_aydinlatma" ? "kvkk_aydinlatma" : "acik_riza";
    return { error: null, base64: buffer.toString("base64"), dosyaAdi: `${kisi.ad_soyad} ${ek}.docx` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Belge hazırlanamadı." };
  }
}

/** Şablonu indirir: `ornek` true ise uygulamayla gelen örnek, değilse kullanımdaki. */
export async function sablonIndir(ad: string, ornek: boolean): Promise<Indirme> {
  if (!adGecerli(ad)) return { error: "Bilinmeyen şablon." };
  const supabase = await createClient();
  const icerik = ornek ? await ornekSablon(ad) : (await gecerliSablon(supabase, ad)).icerik;
  return { error: null, base64: icerik.toString("base64"), dosyaAdi: SABLONLAR[ad].dosya };
}

export async function sablonYukle(
  formData: FormData,
): Promise<{ error: string | null; uyari?: string }> {
  const ad = formData.get("ad") as string;
  const dosya = formData.get("dosya") as File | null;
  if (!adGecerli(ad)) return { error: "Bilinmeyen şablon." };
  if (!dosya || dosya.size === 0) return { error: "Bir .docx dosyası seç." };
  if (!/\.docx$/i.test(dosya.name)) return { error: "Şablon Word (.docx) dosyası olmalı." };
  if (dosya.size > AZAMI_BAYT) return { error: "Şablon 2 MB'tan büyük olamaz." };

  const icerik = Buffer.from(await dosya.arrayBuffer());
  const kontrol = sablonDogrula(icerik, ad);
  if (kontrol.error !== null) return { error: kontrol.error };
  if (kontrol.kullanilan.length === 0) {
    return {
      error: `Şablonda hiç yer tutucu yok. Çalışan ve şirket bilgilerinin geleceği yerlere ${SABLONLAR[ad].alanlar
        .slice(0, 3)
        .map((a) => `{${a}}`)
        .join(", ")} gibi alanlar yaz.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sablon")
    .upsert({ ad, dosya_adi: dosya.name, icerik_b64: icerik.toString("base64"), yuklendi_at: new Date().toISOString() });
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  revalidatePath("/ayarlar");
  return {
    error: null,
    uyari: kontrol.bilinmeyen.length
      ? `Şablon kaydedildi. Tanınmayan alanlar boş kalacak: ${kontrol.bilinmeyen.map((a) => `{${a}}`).join(", ")}.`
      : undefined,
  };
}

export async function sablonSifirla(ad: string): Promise<{ error: string | null }> {
  if (!adGecerli(ad)) return { error: "Bilinmeyen şablon." };
  const supabase = await createClient();
  const { error } = await supabase.from("sablon").delete().eq("ad", ad);
  if (error) return { error: `Kaldırılamadı: ${error.message}` };
  revalidatePath("/ayarlar");
  return { error: null };
}

export async function acikRizaAyari(acik: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("ayarlar").update({ kvkk_acik_riza: acik }).eq("id", true);
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  revalidatePath("/ayarlar");
  revalidatePath("/kisi/[id]", "page");
  return { error: null };
}
