"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ISYERI_BELGE_ADI, ISYERI_BELGE_TIPLERI, kazaSonGun } from "@/lib/isg-takip";
import { SAAT_RE } from "@/lib/mevzuat";
import { mailGonder } from "@/lib/mail";
import { KAZA_TURU_ADI, type IsKazasi, type IsyeriBelgeTipi, type KazaTuru } from "@/lib/types";
import { formatTarih } from "@/lib/utils";

// Faz D paket 1 (15 Ekim 2026): İSG periyodik takip, iş kazası kaydı,
// takvim hatırlatma ayarı.

const TARIH_RE = /^\d{4}-\d{2}-\d{2}$/;
const KAZA_TURLERI: KazaTuru[] = ["is_kazasi", "meslek_hastaligi", "ramak_kala"];

function metin(formData: FormData, ad: string): string | null {
  const v = (formData.get(ad) as string | null)?.trim();
  return v ? v : null;
}

function tarih(formData: FormData, ad: string): string | null {
  const v = metin(formData, ad);
  return v && TARIH_RE.test(v) ? v : null;
}

export async function tehlikeSinifiKaydet(formData: FormData): Promise<{ error: string | null }> {
  const sinif = formData.get("sinif") as string;
  if (!["az", "tehlikeli", "cok"].includes(sinif)) return { error: "Tehlike sınıfını seç." };
  const supabase = await createClient();
  const { error } = await supabase.from("ayarlar").update({ isg_tehlike_sinifi: sinif }).eq("id", true);
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  revalidatePath("/isg");
  revalidatePath("/takvim");
  return { error: null };
}

/** Yeni işyeri belgesi kaydı (yapıldığı gün); dosya ayrıca yüklenir. Dönen
 *  id ile tarayıcı dosyayı yükler (lib/belge-yukle.ts, tur "isyeri"). */
export async function isyeriBelgeKaydet(formData: FormData): Promise<{ error: string | null; id?: string }> {
  const tip = formData.get("tip") as IsyeriBelgeTipi;
  const yapilma = tarih(formData, "yapilma_tarihi");
  if (!ISYERI_BELGE_TIPLERI.includes(tip)) return { error: "Belge tipini seç." };
  if (!yapilma) return { error: "Yapıldığı günü gir." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("isyeri_belge")
    .insert({ tip, yapilma_tarihi: yapilma, notu: metin(formData, "notu") })
    .select("id")
    .single();
  if (error) return { error: `${ISYERI_BELGE_ADI[tip]} kaydedilemedi: ${error.message}` };
  revalidatePath("/isg");
  revalidatePath("/takvim");
  return { error: null, id: data.id };
}

export async function kazaKaydet(formData: FormData): Promise<{ error: string | null; id?: string }> {
  const id = metin(formData, "id");
  const kisiId = metin(formData, "kisi_id");
  const tur = formData.get("tur") as KazaTuru;
  const olayTarihi = tarih(formData, "olay_tarihi");
  const olaySaati = metin(formData, "olay_saati");
  const aciklama = metin(formData, "aciklama");
  const isyeriDisinda = formData.get("isyeri_disinda") === "on";
  const ogrenme = tarih(formData, "ogrenme_tarihi");
  const istirahatBas = tarih(formData, "istirahat_bas");
  const istirahatBit = tarih(formData, "istirahat_bit");

  if (!kisiId) return { error: "Çalışanı seç." };
  if (!KAZA_TURLERI.includes(tur)) return { error: "Olayın türünü seç." };
  if (!olayTarihi) return { error: "Olay tarihini gir." };
  if (olaySaati && !SAAT_RE.test(olaySaati)) return { error: "Saati SS:DD biçiminde yaz (ör. 14:20)." };
  if (!aciklama) return { error: "Olayın nasıl olduğunu kısaca yaz." };
  if (ogrenme && ogrenme < olayTarihi) return { error: "Öğrenilme tarihi olaydan önce olamaz." };
  if (istirahatBit && !istirahatBas) return { error: "İstirahatin ilk gününü de gir." };
  if (istirahatBas && istirahatBit && istirahatBit < istirahatBas) {
    return { error: "İstirahatin son günü ilk gününden önce olamaz." };
  }

  const kayit = {
    kisi_id: kisiId,
    tur,
    olay_tarihi: olayTarihi,
    olay_saati: olaySaati,
    isyeri_disinda: isyeriDisinda,
    ogrenme_tarihi: ogrenme,
    yer: metin(formData, "yer"),
    aciklama,
    yaralanma: metin(formData, "yaralanma"),
    saglik_kurulusu: metin(formData, "saglik_kurulusu"),
    istirahat_bas: istirahatBas,
    istirahat_bit: istirahatBas ? (istirahatBit ?? istirahatBas) : null,
    taniklar: metin(formData, "taniklar"),
  };

  const supabase = await createClient();
  const sonuc = id
    ? await supabase.from("is_kazasi").update(kayit).eq("id", id).select("id").single()
    : await supabase.from("is_kazasi").insert(kayit).select("id").single();
  if (sonuc.error) return { error: `Kaydedilemedi: ${sonuc.error.message}` };

  revalidatePath("/isg");
  revalidatePath("/takvim");
  revalidatePath("/puantaj");
  revalidatePath(`/isg/kaza/${sonuc.data.id}`);
  return { error: null, id: sonuc.data.id };
}

export async function kazaBildirildi(formData: FormData): Promise<{ error: string | null }> {
  const id = metin(formData, "id");
  const gun = tarih(formData, "bildirildi_tarihi");
  if (!id) return { error: "Kayıt bulunamadı." };
  if (!gun) return { error: "Bildirim gününü gir." };
  const supabase = await createClient();
  const { error } = await supabase.from("is_kazasi").update({ bildirildi_tarihi: gun }).eq("id", id);
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  revalidatePath(`/isg/kaza/${id}`);
  revalidatePath("/isg");
  revalidatePath("/takvim");
  return { error: null };
}

/** İSG uzmanına (ayarlardaki İSG e-postası) olayın özetini gönderir;
 *  işyeri hekimine iletmesi istenir. */
export async function kazaHaberVer(formData: FormData): Promise<{ error: string | null }> {
  const id = metin(formData, "id");
  if (!id) return { error: "Kayıt bulunamadı." };
  const supabase = await createClient();
  const [{ data: k }, { data: ayarlar }] = await Promise.all([
    supabase.from("is_kazasi").select("*, kisi:kisi_id(ad_soyad)").eq("id", id).maybeSingle(),
    supabase.from("ayarlar").select("isg_email, gonderen_email, takip_email, sirket_unvani").eq("id", true).maybeSingle(),
  ]);
  if (!k) return { error: "Kayıt bulunamadı." };
  if (!ayarlar?.isg_email) return { error: "Ayarlar'da İSG uzmanının e-postası yok. Önce onu gir." };
  if (!ayarlar.gonderen_email) return { error: "Ayarlar'da gönderen e-posta adresi yok." };

  const kaza = k as IsKazasi & { kisi: { ad_soyad: string } | null };
  const adSoyad = kaza.kisi?.ad_soyad ?? "";
  const tur = KAZA_TURU_ADI[kaza.tur];
  const satir = (b: string, v: string | null) => (v ? `<tr><td style="padding:2px 12px 2px 0;color:#5D665F">${b}</td><td>${v}</td></tr>` : "");
  const sonGun = kazaSonGun(kaza);
  const html = `
    <p>Merhaba,</p>
    <p>${ayarlar.sirket_unvani ? `${ayarlar.sirket_unvani} bünyesinde ` : ""}${formatTarih(kaza.olay_tarihi)} tarihinde bir ${tur.toLocaleLowerCase("tr")} kaydı açıldı. Bilgiler aşağıda. İşyeri hekimine de iletmeni rica ederim.</p>
    <table style="border-collapse:collapse">
      ${satir("Çalışan", adSoyad)}
      ${satir("Tarih", `${formatTarih(kaza.olay_tarihi)}${kaza.olay_saati ? ` ${kaza.olay_saati}` : ""}`)}
      ${satir("Yer", kaza.yer)}
      ${satir("Nasıl oldu", kaza.aciklama)}
      ${satir("Yaralanma", kaza.yaralanma)}
      ${satir("Sağlık kuruluşu", kaza.saglik_kurulusu)}
      ${satir("İstirahat", kaza.istirahat_bas ? `${formatTarih(kaza.istirahat_bas)} – ${formatTarih(kaza.istirahat_bit ?? kaza.istirahat_bas)}` : null)}
      ${satir("Tanıklar", kaza.taniklar)}
      ${satir("SGK bildirimi son gün", sonGun ? formatTarih(sonGun) : null)}
    </table>
    <p>Teşekkürler.</p>`;

  const sonuc = await mailGonder({
    to: ayarlar.isg_email,
    cc: ayarlar.takip_email ?? undefined,
    from: ayarlar.gonderen_email,
    subject: `${tur}: ${adSoyad}, ${formatTarih(kaza.olay_tarihi)}`,
    html,
  });
  if (!sonuc.ok) return { error: sonuc.error };
  await supabase.from("is_kazasi").update({ haber_verildi_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(`/isg/kaza/${id}`);
  return { error: null };
}

export async function hatirlatmaGunuKaydet(formData: FormData): Promise<{ error: string | null }> {
  const gun = Number(formData.get("hatirlatma_gun"));
  if (!Number.isInteger(gun) || gun < 0 || gun > 30) return { error: "0 ile 30 arasında bir gün sayısı gir." };
  const supabase = await createClient();
  const { error } = await supabase.from("ayarlar").update({ hatirlatma_gun: gun }).eq("id", true);
  if (error) return { error: `Kaydedilemedi: ${error.message}` };
  revalidatePath("/takvim");
  return { error: null };
}
