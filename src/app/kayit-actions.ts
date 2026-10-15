"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CALISMA,
  PUANTAJ_KOD_ADI,
  SAAT_RE,
  calismaSuresi,
  fazlaCalismaYuvarla,
  fazlaSaatSiniri,
  gunEkle,
  izinGunSay,
  saatMetni,
  saattenFazlaCalisma,
  yolIzniGunleri,
  type PuantajKodu,
} from "@/lib/mevzuat";
import { varsayilanKod, type PuantajIzni } from "@/lib/puantaj";
import { AY_RE, ayAdi, puantajExcel, puantajYukle } from "@/lib/puantaj-veri";
import { mailGonder } from "@/lib/mail";
import { MODULLER, type Modul } from "@/lib/types";

// Faz D kayıt modüllerinin (puantaj, yıllık izin) sunucu eylemleri.
// actions.ts zaten çok büyük; yeni modüller burada.

const TARIH_RE = /^\d{4}-\d{2}-\d{2}$/;
const ELLE_KODLAR = ["Ç", "HT", "GT", "R", "Üİ", "D", "Dİ"] as const;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function ayKapaliMi(supabase: Supabase, tarih: string): Promise<boolean> {
  const { data } = await supabase.from("puantaj_ay").select("kapandi_at").eq("ay", `${tarih.slice(0, 7)}-01`).maybeSingle();
  return !!data?.kapandi_at;
}

/** bas–bit aralığına (yol izni dahil) düşen kapanmış ilk ayın adı, yoksa null. */
async function kapaliAyAdi(supabase: Supabase, bas: string, bit: string): Promise<string | null> {
  const { data } = await supabase
    .from("puantaj_ay")
    .select("ay")
    .not("kapandi_at", "is", null)
    .gte("ay", `${bas.slice(0, 7)}-01`)
    .lte("ay", `${bit.slice(0, 7)}-01`)
    .order("ay")
    .limit(1);
  return data?.length ? ayAdi(data[0].ay.slice(0, 7)) : null;
}

// ── Puantaj ─────────────────────────────────────────────────────────

/** Bir günü elle değiştirir. Giriş–çıkış saati girilirse fazla çalışma
 *  saatlerden hesaplanır (elle girilen değer yok sayılır). Kod, saat ve
 *  fazla çalışmanın hepsi boşsa gün varsayılana döner (satır silinir). */
export async function puantajGunKaydet(params: {
  kisiId: string;
  tarih: string;
  kod: string | null;
  fazlaSaat: number;
  giris?: string | null;
  cikis?: string | null;
}): Promise<{ error: string | null }> {
  const { kisiId, tarih, kod } = params;
  const giris = params.giris || null;
  const cikis = params.cikis || null;
  if (!TARIH_RE.test(tarih)) return { error: "Tarih geçersiz." };
  if (kod !== null && !(ELLE_KODLAR as readonly string[]).includes(kod)) return { error: "Bilinmeyen kod." };
  if (!giris !== !cikis) return { error: "Giriş ve çıkış saatini birlikte gir." };
  if ((giris && !SAAT_RE.test(giris)) || (cikis && !SAAT_RE.test(cikis))) return { error: "Saat geçersiz (SS:DD)." };

  const supabase = await createClient();
  if (await ayKapaliMi(supabase, tarih)) return { error: "Bu ay kapandı. Değiştirmek için önce ayı yeniden aç." };

  let fazlaSaat = fazlaCalismaYuvarla(Number(params.fazlaSaat) || 0);
  if (giris || fazlaSaat > 0) {
    const { data: izinler } = await supabase
      .from("yillik_izin")
      .select("baslangic, bitis, yol_izni_gun")
      .eq("kisi_id", kisiId)
      .lte("baslangic", tarih)
      .gte("bitis", gunEkle(tarih, -14))
      .returns<PuantajIzni[]>();
    const etkin = (kod as PuantajKodu | null) ?? varsayilanKod(tarih, izinler ?? []);
    const sinir = fazlaSaatSiniri(etkin);
    if (sinir === 0) {
      const ad = PUANTAJ_KOD_ADI[etkin];
      const Ad = `${ad.charAt(0).toLocaleUpperCase("tr-TR")}${ad.slice(1)}`;
      return { error: giris ? `${Ad} olan güne çalışma saati girilmez.` : `${Ad} olan güne fazla çalışma yazılamaz.` };
    }
    if (giris && cikis) {
      const { netSaat } = calismaSuresi(giris, cikis);
      if (netSaat > CALISMA.gunlukAzamiSaat.deger) {
        return {
          error: `Ara dinlenme düşüldükten sonra ${saatMetni(netSaat)} çalışma çıkıyor; günlük toplam çalışma ${CALISMA.gunlukAzamiSaat.deger} saati geçemez.`,
        };
      }
      fazlaSaat = saattenFazlaCalisma(etkin, netSaat);
    } else if (fazlaSaat > sinir) {
      return {
        error: `Bu gün en çok ${String(sinir).replace(".", ",")} saat fazla çalışma yazılabilir (günlük toplam çalışma ${CALISMA.gunlukAzamiSaat.deger} saati geçemez).`,
      };
    }
  }

  const { error } =
    kod === null && fazlaSaat === 0 && !giris
      ? await supabase.from("puantaj_gun").delete().eq("kisi_id", kisiId).eq("tarih", tarih)
      : await supabase.from("puantaj_gun").upsert({
          kisi_id: kisiId,
          tarih,
          kod,
          fazla_saat: fazlaSaat,
          giris_saati: giris,
          cikis_saati: cikis,
          updated_at: new Date().toISOString(),
        });
  if (error) return { error: error.message };
  revalidatePath("/puantaj");
  return { error: null };
}

/** Aynı günün giriş–çıkış saatini birden fazla çalışana yazar (14 Ekim 2026).
 *  Her kişi tek tek puantajGunKaydet'ten geçer (kapalı ay, ara dinlenme,
 *  11 saat, çalışılmayan gün kuralları aynen); elle girilmiş kod korunur,
 *  yalnızca saat (ve ondan hesaplanan fazla çalışma) değişir. O gün iş
 *  dönemi olmayan kişi atlanır. */
export async function puantajSaatUygula(params: {
  tarih: string;
  kisiIdler: string[];
  giris: string;
  cikis: string;
}): Promise<{ error: string | null; atlanan: { kisiId: string; neden: string }[] }> {
  const { tarih, giris, cikis } = params;
  const kisiIdler = [...new Set(params.kisiIdler)].slice(0, 200);
  if (!TARIH_RE.test(tarih)) return { error: "Tarih geçersiz.", atlanan: [] };
  if (!SAAT_RE.test(giris) || !SAAT_RE.test(cikis)) return { error: "Saat geçersiz (SS:DD).", atlanan: [] };
  if (kisiIdler.length === 0) return { error: null, atlanan: [] };

  const supabase = await createClient();
  const [{ data: donemler }, { data: mevcut }] = await Promise.all([
    supabase
      .from("is_girisi")
      .select("kisi_id")
      .in("kisi_id", kisiIdler)
      .lte("giris_tarihi", tarih)
      .or(`cikis_tarihi.is.null,cikis_tarihi.gte.${tarih}`),
    supabase.from("puantaj_gun").select("kisi_id, kod").in("kisi_id", kisiIdler).eq("tarih", tarih),
  ]);
  const donemde = new Set((donemler ?? []).map((d) => d.kisi_id as string));
  const elleKod = new Map((mevcut ?? []).map((m) => [m.kisi_id as string, m.kod as string | null]));

  const atlanan: { kisiId: string; neden: string }[] = [];
  for (const kisiId of kisiIdler) {
    if (!donemde.has(kisiId)) {
      atlanan.push({ kisiId, neden: "bu gün iş dönemi yok" });
      continue;
    }
    const r = await puantajGunKaydet({ kisiId, tarih, kod: elleKod.get(kisiId) ?? null, fazlaSaat: 0, giris, cikis });
    if (r.error) atlanan.push({ kisiId, neden: r.error });
  }
  revalidatePath("/puantaj");
  return { error: null, atlanan };
}

/** Ayı kapatır, o anki halini dondurur ve Excel'i mali müşavire gönderir.
 *  Gönderim başarısız olsa da ay kapalı kalır; hata sayfada görünür, tekrar
 *  gönderilebilir. Ay zaten kapalıysa (tekrar gönderim) dondurulan hal
 *  değişmez, yalnızca mail yeniden denenir. */
export async function puantajAyKapat(ay: string): Promise<{ error: string | null }> {
  if (!AY_RE.test(ay)) return { error: "Ay geçersiz." };
  const supabase = await createClient();
  const { data: ayarlar } = await supabase
    .from("ayarlar")
    .select("mali_musavir_email, gonderen_email, takip_email, sirket_unvani")
    .eq("id", true)
    .single();
  if (!ayarlar?.mali_musavir_email || !ayarlar?.gonderen_email) {
    return { error: "Önce Ayarlar'dan mali müşavir ve gönderen e-posta adresini gir." };
  }

  const zatenKapali = await ayKapaliMi(supabase, `${ay}-01`);
  if (!zatenKapali) {
    // Önceki (yeniden açılmadan önceki) gönderimin izi silinir: bu kapanışın
    // maili başarısız olursa sayfa eski tarihi "gönderildi" diye göstermesin.
    const { error: kapatmaHatasi } = await supabase.from("puantaj_ay").upsert({
      ay: `${ay}-01`,
      kapandi_at: new Date().toISOString(),
      gonderildi_at: null,
      gonderim_hatasi: null,
      anlik: null,
    });
    if (kapatmaHatasi) return { error: kapatmaHatasi.message };
  }

  const veri = await puantajYukle(supabase, ay);
  if (!zatenKapali) {
    const { error: anlikHatasi } = await supabase
      .from("puantaj_ay")
      .update({ anlik: veri.satirlar })
      .eq("ay", `${ay}-01`);
    if (anlikHatasi) return { error: anlikHatasi.message };
  }
  const ad = ayAdi(ay);
  const sirket = ayarlar.sirket_unvani ? `${ayarlar.sirket_unvani} ` : "";
  const sonuc = await mailGonder({
    to: ayarlar.mali_musavir_email,
    cc: ayarlar.takip_email?.trim() || undefined,
    from: ayarlar.gonderen_email,
    subject: `${sirket}${ad} puantajı`,
    html: `
      <p>Merhaba,</p>
      <p>${ad} puantajı ekte (${veri.satirlar.length} çalışan). Eksik gün nedenlerinin yanındaki SGK kodları öneridir; bordroda son karar sizde.</p>
      <p>Teşekkürler.</p>
    `,
    ekler: [{ filename: `puantaj-${ay}.xlsx`, content: puantajExcel(veri) }],
  });

  await supabase
    .from("puantaj_ay")
    .update(sonuc.ok ? { gonderildi_at: new Date().toISOString(), gonderim_hatasi: null } : { gonderim_hatasi: sonuc.error })
    .eq("ay", `${ay}-01`);

  revalidatePath("/puantaj");
  return { error: sonuc.ok ? null : `Ay kapandı ama mail gönderilemedi: ${sonuc.error}` };
}

export async function puantajAyAc(ay: string): Promise<{ error: string | null }> {
  if (!AY_RE.test(ay)) return { error: "Ay geçersiz." };
  const supabase = await createClient();
  // gonderildi_at kalır: sayfa "önceki gönderim" olarak gösterir.
  const { error } = await supabase.from("puantaj_ay").update({ kapandi_at: null, anlik: null }).eq("ay", `${ay}-01`);
  if (error) return { error: error.message };
  revalidatePath("/puantaj");
  return { error: null };
}

// ── Yıllık izin ─────────────────────────────────────────────────────

export async function izinKaydet(formData: FormData): Promise<{ error: string | null }> {
  const kisiId = (formData.get("kisi_id") as string) || "";
  const baslangic = (formData.get("baslangic") as string) || "";
  const bitis = (formData.get("bitis") as string) || "";
  const yolIzniGun = Number(formData.get("yol_izni_gun") || 0);
  const notu = ((formData.get("notu") as string) || "").trim() || null;

  if (!kisiId) return { error: "Çalışanı seç." };
  if (!TARIH_RE.test(baslangic) || !TARIH_RE.test(bitis)) return { error: "İlk ve son günü gir." };
  if (bitis < baslangic) return { error: "Son gün ilk günden önce olamaz." };
  if (!Number.isInteger(yolIzniGun) || yolIzniGun < 0 || yolIzniGun > 4) {
    return { error: "Yol izni 0 ile 4 gün arasında olur." };
  }

  const supabase = await createClient();
  const { data: donem } = await supabase
    .from("is_girisi")
    .select("id")
    .eq("kisi_id", kisiId)
    .lte("giris_tarihi", baslangic)
    .or(`cikis_tarihi.is.null,cikis_tarihi.gte.${bitis}`)
    .limit(1);
  if (!donem?.length) return { error: "İzin tarihleri bu kişinin bir iş dönemine düşmüyor." };

  const kapali = await kapaliAyAdi(supabase, baslangic, yolIzniGunleri(bitis, yolIzniGun).at(-1) ?? bitis);
  if (kapali) return { error: `${kapali} puantajı kapandı. Bu izni girmek için önce o ayı Puantaj'dan yeniden aç.` };

  const { data: cakisan } = await supabase
    .from("yillik_izin")
    .select("id")
    .eq("kisi_id", kisiId)
    .lte("baslangic", bitis)
    .gte("bitis", baslangic)
    .limit(1);
  if (cakisan?.length) return { error: "Bu tarihlerle çakışan bir izin kaydı var." };

  const { gun } = izinGunSay(baslangic, bitis);
  if (gun === 0) return { error: "Bu aralıkta izinden düşecek gün yok (hepsi tatil)." };

  const { error } = await supabase
    .from("yillik_izin")
    .insert({ kisi_id: kisiId, baslangic, bitis, gun, yol_izni_gun: yolIzniGun, notu });
  if (error) return { error: error.message };

  revalidatePath("/izin");
  revalidatePath("/puantaj");
  return { error: null };
}

export async function izinSil(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: izin } = await supabase
    .from("yillik_izin")
    .select("baslangic, bitis, yol_izni_gun")
    .eq("id", id)
    .maybeSingle<PuantajIzni>();
  if (izin) {
    const kapali = await kapaliAyAdi(
      supabase,
      izin.baslangic,
      yolIzniGunleri(izin.bitis, izin.yol_izni_gun).at(-1) ?? izin.bitis,
    );
    if (kapali) return { error: `${kapali} puantajı kapandı. Bu izni silmek için önce o ayı Puantaj'dan yeniden aç.` };
  }
  const { error } = await supabase.from("yillik_izin").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/izin");
  revalidatePath("/puantaj");
  return { error: null };
}

/** Çıkışta ödenen izin ücretini işaretler. Gün, ödendiği anki bakiyeyle
 *  saklanır; sonradan izin kaydı değişse de ödenen gün sabit kalır. */
export async function izinUcretiOdendi(isGirisiId: string, gun: number): Promise<{ error: string | null }> {
  if (!Number.isInteger(gun) || gun < 0) return { error: "Gün geçersiz." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("is_girisi")
    .update({ izin_ucreti_gun: gun, izin_ucreti_odendi_at: new Date().toISOString() })
    .eq("id", isGirisiId)
    .not("cikis_tarihi", "is", null);
  if (error) return { error: error.message };
  revalidatePath("/izin");
  return { error: null };
}

export async function izinUcretiGeriAl(isGirisiId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("is_girisi")
    .update({ izin_ucreti_gun: null, izin_ucreti_odendi_at: null })
    .eq("id", isGirisiId);
  if (error) return { error: error.message };
  revalidatePath("/izin");
  return { error: null };
}

// ── Kişi ve ayarlar ─────────────────────────────────────────────────

export async function dogumTarihiKaydet(kisiId: string, tarih: string): Promise<{ error: string | null }> {
  if (tarih && !TARIH_RE.test(tarih)) return { error: "Tarih geçersiz." };
  const supabase = await createClient();
  const { error } = await supabase.from("kisi").update({ dogum_tarihi: tarih || null }).eq("id", kisiId);
  if (error) return { error: error.message };
  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/izin");
  return { error: null };
}

export async function modulleriKaydet(formData: FormData): Promise<{ error: string | null }> {
  const acik = MODULLER.filter((m) => formData.get(`modul_${m}`) === "on") as Modul[];
  // Alan yalnızca 0025 uygulanmışsa formda var.
  const baslangic = formData.get("puantaj_baslangic");
  if (baslangic !== null && !AY_RE.test(String(baslangic))) return { error: "Puantaj başlangıç ayını seç." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("ayarlar")
    .update({
      acik_moduller: acik,
      ...(baslangic !== null ? { puantaj_baslangic: `${baslangic}-01` } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null };
}
