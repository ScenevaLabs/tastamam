"use server";

import { yetkiliGerekli } from "@/lib/yetki";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bugunIso } from "@/lib/isg";
import { DURUM_TURLERI, type DurumTuru } from "@/lib/durum";
import { gecerliSablon, sablonDoldur } from "@/lib/sablon";
import { tarihSlash } from "@/lib/utils";

// Faz D paket 3 (15 Ekim 2026, migration 0030): kişi işaretleri, duruma bağlı
// kayıtlar ve zimmet.

const TARIH_RE = /^\d{4}-\d{2}-\d{2}$/;

function tarih(fd: FormData, ad: string): string | null {
  const v = ((fd.get(ad) as string | null) ?? "").trim();
  return TARIH_RE.test(v) ? v : null;
}
function metin(fd: FormData, ad: string): string | null {
  const v = ((fd.get(ad) as string | null) ?? "").trim();
  return v || null;
}

function yenile(kisiId: string) {
  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/");
  revalidatePath("/calisanlar");
  revalidatePath("/takvim");
  revalidatePath("/puantaj");
}

export async function kisiAyrintiKaydet(fd: FormData): Promise<{ error: string | null }> {
  await yetkiliGerekli();
  const kisiId = fd.get("kisi_id") as string;
  const besKatilim = tarih(fd, "bes_katilim");
  const besCayma = tarih(fd, "bes_cayma");
  if (besCayma && !besKatilim) return { error: "Cayma için önce BES'e dahil edildiği günü gir." };
  if (besCayma && besKatilim && besCayma < besKatilim) return { error: "Cayma, katılımdan önce olamaz." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("kisi")
    .update({
      engelli: fd.get("engelli") === "on",
      kismi_sureli: fd.get("kismi_sureli") === "on",
      bes_katilim: besKatilim,
      bes_cayma: besCayma,
    })
    .eq("id", kisiId);
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  yenile(kisiId);
  return { error: null };
}

export async function durumKaydet(fd: FormData): Promise<{ error: string | null; id?: string }> {
  await yetkiliGerekli();
  const kisiId = fd.get("kisi_id") as string;
  const tur = fd.get("tur") as DurumTuru;
  const baslangic = tarih(fd, "baslangic");
  const bitis = tarih(fd, "bitis");
  if (!DURUM_TURLERI.includes(tur)) return { error: "Türü seç." };
  if (!baslangic) return { error: "Tarihi gir." };
  if (bitis && bitis < baslangic) return { error: "Bitiş başlangıçtan önce olamaz." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kisi_durum")
    .insert({ kisi_id: kisiId, tur, baslangic, bitis, notu: metin(fd, "notu") })
    .select("id")
    .single();
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  yenile(kisiId);
  return { error: null, id: data.id };
}

/** Kaydı kapatır: bitiş tarihi (izin bitti) ya da yazılı kabul (koşul değişikliği). */
export async function durumGuncelle(fd: FormData): Promise<{ error: string | null }> {
  await yetkiliGerekli();
  const id = fd.get("id") as string;
  const kisiId = fd.get("kisi_id") as string;
  const alan = fd.get("alan") as string;
  if (alan !== "bitis" && alan !== "tamamlandi") return { error: "Geçersiz alan." };
  const deger = tarih(fd, "tarih");
  if (!deger) return { error: "Tarihi gir." };
  const supabase = await createClient();
  const { error } = await supabase.from("kisi_durum").update({ [alan]: deger }).eq("id", id);
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  yenile(kisiId);
  return { error: null };
}

export async function durumSil(fd: FormData): Promise<{ error: string | null }> {
  await yetkiliGerekli();
  const id = fd.get("id") as string;
  const kisiId = fd.get("kisi_id") as string;
  const supabase = await createClient();
  const { error } = await supabase.from("kisi_durum").delete().eq("id", id);
  if (error) return { error: `Silinemedi: ${error.message}` };
  yenile(kisiId);
  return { error: null };
}

export async function zimmetEkle(fd: FormData): Promise<{ error: string | null }> {
  await yetkiliGerekli();
  const kisiId = fd.get("kisi_id") as string;
  const esya = metin(fd, "esya");
  const verilis = tarih(fd, "verilis");
  if (!esya) return { error: "Eşyayı yaz (ör. laptop, giriş kartı, anahtar)." };
  if (!verilis) return { error: "Teslim gününü gir." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("zimmet")
    .insert({ kisi_id: kisiId, esya, seri_no: metin(fd, "seri_no"), verilis, notu: metin(fd, "notu") });
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  yenile(kisiId);
  return { error: null };
}

export async function zimmetIade(fd: FormData): Promise<{ error: string | null }> {
  await yetkiliGerekli();
  const id = fd.get("id") as string;
  const kisiId = fd.get("kisi_id") as string;
  const iade = tarih(fd, "iade");
  if (!iade) return { error: "İade gününü gir." };
  const supabase = await createClient();
  const { error } = await supabase.from("zimmet").update({ iade }).eq("id", id);
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  yenile(kisiId);
  return { error: null };
}

/** İade edilmemiş eşyalarla zimmet tutanağı (şablon: zimmet_tutanagi). */
export async function zimmetTutanagiUret(
  kisiId: string,
): Promise<{ error: string } | { error: null; base64: string; dosyaAdi: string }> {
  await yetkiliGerekli();
  const supabase = await createClient();
  const [{ data: kisi }, { data: esyalar }, { data: ayarlar }] = await Promise.all([
    supabase.from("kisi").select("ad_soyad, tc_kimlik_no").eq("id", kisiId).maybeSingle(),
    supabase.from("zimmet").select("esya, seri_no, verilis").eq("kisi_id", kisiId).is("iade", null).order("verilis"),
    supabase.from("ayarlar").select("sirket_unvani, sirket_adresi").eq("id", true).maybeSingle(),
  ]);
  if (!kisi) return { error: "Kişi bulunamadı." };
  if (!esyalar?.length) return { error: "Bu kişide iade edilmemiş zimmet yok." };
  if (!ayarlar?.sirket_unvani || !ayarlar?.sirket_adresi) return { error: "Önce Ayarlar'da şirket unvanını ve adresini gir." };
  try {
    const { icerik } = await gecerliSablon(supabase, "zimmet_tutanagi");
    const buffer = sablonDoldur(icerik, {
      AD_SOYAD: kisi.ad_soyad,
      TC: kisi.tc_kimlik_no ?? "",
      TARIH: tarihSlash(bugunIso()),
      SIRKET_UNVANI: ayarlar.sirket_unvani.toLocaleUpperCase("tr-TR"),
      SIRKET_ADRESI: ayarlar.sirket_adresi,
      ESYALAR: esyalar.map((e) => ({ ESYA: e.esya, SERI_NO: e.seri_no ?? "", VERILIS: tarihSlash(e.verilis) })),
    });
    return { error: null, base64: buffer.toString("base64"), dosyaAdi: `${kisi.ad_soyad} zimmet_tutanagi.docx` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Tutanak hazırlanamadı." };
  }
}
