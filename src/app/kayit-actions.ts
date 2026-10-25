"use server";

import { yetkiliGerekli } from "@/lib/yetki";
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
import { dosyaMetniniCikar } from "@/lib/belge-tanima";
import { dogumTarihiAyikla } from "@/lib/dogum-tarihi";
import { bugunIso } from "@/lib/isg";
import { dogumTarihiAdayDosyalari, dosyaIndir } from "@/lib/ozluk-dosya";
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

type GunGirdisi = { tarih: string; kod: string | null; fazlaSaat: number; giris: string | null; cikis: string | null };
type GunSatiri = { kod: string | null; fazla_saat: number; giris_saati: string | null; cikis_saati: string | null };

/** Bir günün elle girişini mevzuata göre denetler ve yazılacak satırı döner.
 *  izinler: o kişinin bu güne değebilecek yıllık izinleri (varsayılan kod için). */
function gunSatiriHazirla(g: GunGirdisi, izinler: PuantajIzni[]): { error: string } | { satir: GunSatiri } {
  const { tarih, kod, giris, cikis } = g;
  if (kod !== null && !(ELLE_KODLAR as readonly string[]).includes(kod)) return { error: "Bilinmeyen kod." };
  if (!giris !== !cikis) return { error: "Giriş ve çıkış saatini birlikte gir." };
  if ((giris && !SAAT_RE.test(giris)) || (cikis && !SAAT_RE.test(cikis))) return { error: "Saat geçersiz (SS:DD)." };

  let fazlaSaat = fazlaCalismaYuvarla(Number(g.fazlaSaat) || 0);
  if (giris || fazlaSaat > 0) {
    const etkin = (kod as PuantajKodu | null) ?? varsayilanKod(tarih, izinler);
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
  return { satir: { kod, fazla_saat: fazlaSaat, giris_saati: giris, cikis_saati: cikis } };
}

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
  await yetkiliGerekli();
  const giris = params.giris || "";
  const cikis = params.cikis || "";
  const r = await puantajTopluKaydet({
    hucreler: [{ kisiId: params.kisiId, tarih: params.tarih }],
    kod: params.kod,
    saat: giris || cikis ? { giris, cikis } : "temizle",
    fazlaSaat: params.fazlaSaat,
  });
  return { error: r.error ?? r.atlanan[0]?.neden ?? null };
}

export type TopluAtlanan = { kisiId: string; tarih: string; neden: string };

/** Birden fazla hücreye aynı ayarı yazar (20 Ekim 2026: tablodan çoklu seçim
 *  ve "bu ayarları başka çalışanlara da uygula"). Her hücre tek gün kaydıyla
 *  aynı kurallardan geçer (kapalı ay, ara dinlenme, 11 saat, çalışılmayan gün).
 *  kod "koru": hücrenin elle girilmiş kodu kalır. saat "koru": mevcut saat ve
 *  fazla çalışma kalır; çalışılmayan bir koda geçen günün saati silinir.
 *  O gün iş dönemi olmayan hücre atlanır; birden fazla hücrede, günü yıllık
 *  izinden gelen hücre de (tek kaynak İzinler). */
export async function puantajTopluKaydet(params: {
  hucreler: { kisiId: string; tarih: string }[];
  kod: string | null | "koru";
  saat: { giris: string; cikis: string } | "koru" | "temizle";
  /** Saat yazılmıyorsa elle fazla çalışma; verilmezse "koru"da mevcut kalır, "temizle"de 0. */
  fazlaSaat?: number;
}): Promise<{ error: string | null; atlanan: TopluAtlanan[] }> {
  await yetkiliGerekli();
  const hucreler = [...new Map(params.hucreler.map((h) => [`${h.kisiId}:${h.tarih}`, h])).values()].slice(0, 2000);
  if (hucreler.length === 0) return { error: null, atlanan: [] };
  if (hucreler.some((h) => !TARIH_RE.test(h.tarih))) return { error: "Tarih geçersiz.", atlanan: [] };
  if (params.kod !== "koru" && params.kod !== null && !(ELLE_KODLAR as readonly string[]).includes(params.kod)) {
    return { error: "Bilinmeyen kod.", atlanan: [] };
  }

  const tarihler = hucreler.map((h) => h.tarih).sort();
  const ilk = tarihler[0];
  const son = tarihler.at(-1)!;
  const kisiIdler = [...new Set(hucreler.map((h) => h.kisiId))];

  const supabase = await createClient();
  const [{ data: kapaliAylar }, { data: donemler }, { data: mevcut }, { data: izinler }] = await Promise.all([
    supabase
      .from("puantaj_ay")
      .select("ay")
      .not("kapandi_at", "is", null)
      .gte("ay", `${ilk.slice(0, 7)}-01`)
      .lte("ay", `${son.slice(0, 7)}-01`),
    supabase
      .from("is_girisi")
      .select("kisi_id, giris_tarihi, cikis_tarihi")
      .in("kisi_id", kisiIdler)
      .lte("giris_tarihi", son)
      .or(`cikis_tarihi.is.null,cikis_tarihi.gte.${ilk}`),
    supabase
      .from("puantaj_gun")
      .select("kisi_id, tarih, kod, fazla_saat, giris_saati, cikis_saati")
      .in("kisi_id", kisiIdler)
      .gte("tarih", ilk)
      .lte("tarih", son),
    supabase
      .from("yillik_izin")
      .select("kisi_id, baslangic, bitis, yol_izni_gun")
      .in("kisi_id", kisiIdler)
      .lte("baslangic", son)
      .gte("bitis", gunEkle(ilk, -14)),
  ]);
  const kapali = new Set((kapaliAylar ?? []).map((a) => (a.ay as string).slice(0, 7)));
  const mevcutMap = new Map((mevcut ?? []).map((m) => [`${m.kisi_id}:${m.tarih}`, m]));
  const izinMap = new Map<string, PuantajIzni[]>();
  for (const i of izinler ?? []) izinMap.set(i.kisi_id, [...(izinMap.get(i.kisi_id) ?? []), i]);

  const atlanan: TopluAtlanan[] = [];
  const yazilacak: (GunSatiri & { kisi_id: string; tarih: string })[] = [];
  const silinecek: { kisiId: string; tarih: string }[] = [];

  for (const { kisiId, tarih } of hucreler) {
    const atla = (neden: string) => atlanan.push({ kisiId, tarih, neden });
    if (kapali.has(tarih.slice(0, 7))) {
      atla("Bu ay kapandı. Değiştirmek için önce ayı yeniden aç.");
      continue;
    }
    const donemde = (donemler ?? []).some(
      (d) => d.kisi_id === kisiId && d.giris_tarihi <= tarih && (!d.cikis_tarihi || d.cikis_tarihi >= tarih),
    );
    if (!donemde) {
      atla("bu gün iş dönemi yok");
      continue;
    }
    const kisiIzinleri = izinMap.get(kisiId) ?? [];
    const m = mevcutMap.get(`${kisiId}:${tarih}`);
    const kod = params.kod === "koru" ? ((m?.kod as string | null) ?? null) : params.kod;
    const varsayilan = varsayilanKod(tarih, kisiIzinleri);
    if (hucreler.length > 1 && kod !== null && !m?.kod && (varsayilan === "Yİ" || varsayilan === "Üİ")) {
      atla("yıllık izin günü, İzinler sayfasından değişir");
      continue;
    }

    let giris: string | null;
    let cikis: string | null;
    let fazla: number;
    if (params.saat === "koru") {
      giris = m?.giris_saati?.slice(0, 5) ?? null;
      cikis = m?.cikis_saati?.slice(0, 5) ?? null;
      fazla = params.fazlaSaat ?? Number(m?.fazla_saat ?? 0);
      if (fazlaSaatSiniri((kod as PuantajKodu | null) ?? varsayilan) === 0) {
        giris = null;
        cikis = null;
        fazla = 0;
      }
    } else if (params.saat === "temizle") {
      giris = null;
      cikis = null;
      fazla = params.fazlaSaat ?? 0;
    } else {
      giris = params.saat.giris || null;
      cikis = params.saat.cikis || null;
      fazla = 0;
    }

    const r = gunSatiriHazirla({ tarih, kod, fazlaSaat: fazla, giris, cikis }, kisiIzinleri);
    if ("error" in r) {
      atla(r.error);
      continue;
    }
    const s = r.satir;
    if (s.kod === null && s.fazla_saat === 0 && !s.giris_saati) silinecek.push({ kisiId, tarih });
    else yazilacak.push({ ...s, kisi_id: kisiId, tarih });
  }

  const updatedAt = new Date().toISOString();
  if (yazilacak.length) {
    const { error } = await supabase.from("puantaj_gun").upsert(yazilacak.map((y) => ({ ...y, updated_at: updatedAt })));
    if (error) return { error: error.message, atlanan };
  }
  for (const kisiId of new Set(silinecek.map((s) => s.kisiId))) {
    const gunler = silinecek.filter((s) => s.kisiId === kisiId).map((s) => s.tarih);
    const { error } = await supabase.from("puantaj_gun").delete().eq("kisi_id", kisiId).in("tarih", gunler);
    if (error) return { error: error.message, atlanan };
  }
  if (yazilacak.length || silinecek.length) revalidatePath("/puantaj");
  return { error: null, atlanan };
}

/** Ayı kapatır, o anki halini dondurur ve Excel'i mali müşavire gönderir.
 *  Gönderim başarısız olsa da ay kapalı kalır; hata sayfada görünür, tekrar
 *  gönderilebilir. Ay zaten kapalıysa (tekrar gönderim) dondurulan hal
 *  değişmez, yalnızca mail yeniden denenir. */
export async function puantajAyKapat(ay: string): Promise<{ error: string | null }> {
  await yetkiliGerekli();
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
  await yetkiliGerekli();
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
  await yetkiliGerekli();
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
  await yetkiliGerekli();
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
  await yetkiliGerekli();
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
  await yetkiliGerekli();
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
  await yetkiliGerekli();
  if (tarih && !TARIH_RE.test(tarih)) return { error: "Tarih geçersiz." };
  const supabase = await createClient();
  const { error } = await supabase.from("kisi").update({ dogum_tarihi: tarih || null }).eq("id", kisiId);
  if (error) return { error: error.message };
  revalidatePath(`/kisi/${kisiId}`);
  revalidatePath("/izin");
  return { error: null };
}

/** Doğum tarihi boşsa kişinin SGK bildirgelerinden ya da nüfus kayıt
 *  örneğinden okur ve yazar (20 Ekim 2026). Elle girilmiş tarihe dokunmaz.
 *  Kişi başına çağrılır: ana sayfadaki toplu düğme kişileri sırayla dolaşır
 *  (tek istekte hepsi sunucu süre sınırını aşar). */
export async function dogumTarihiBelgedenBul(
  kisiId: string,
): Promise<{ error: string | null; tarih: string | null; kaynak?: string }> {
  await yetkiliGerekli();
  const supabase = await createClient();
  const { data: kisi } = await supabase
    .from("kisi")
    .select("ad_soyad, tc_kimlik_no, dogum_tarihi, is_girisi(giris_tarihi, cikis_tarihi, durum)")
    .eq("id", kisiId)
    .single<{
      ad_soyad: string;
      tc_kimlik_no: string;
      dogum_tarihi: string | null;
      is_girisi: { giris_tarihi: string; cikis_tarihi: string | null; durum: string }[];
    }>();
  if (!kisi) return { error: "Kişi bulunamadı.", tarih: null };
  if (kisi.dogum_tarihi) return { error: null, tarih: kisi.dogum_tarihi };

  let dosyalar: Awaited<ReturnType<typeof dogumTarihiAdayDosyalari>>;
  try {
    dosyalar = await dogumTarihiAdayDosyalari({
      adSoyad: kisi.ad_soyad,
      varsayilanDurum: kisi.is_girisi.some((d) => d.durum === "aktif") ? "aktif" : "pasif",
      donemler: kisi.is_girisi.map((d) => ({ girisTarihi: d.giris_tarihi, cikisTarihi: d.cikis_tarihi })),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Klasör okunamadı.", tarih: null };
  }
  const bugun = bugunIso();
  for (const dosya of dosyalar.slice(0, 6)) {
    let metin = "";
    try {
      metin = await dosyaMetniniCikar(dosya.dosyaAdi, await dosyaIndir(dosya.yol));
    } catch {
      continue;
    }
    const tarih = dogumTarihiAyikla(metin, dosya.kaynak, kisi.tc_kimlik_no, bugun);
    if (!tarih) continue;
    const { error } = await supabase.from("kisi").update({ dogum_tarihi: tarih }).eq("id", kisiId).is("dogum_tarihi", null);
    if (error) return { error: error.message, tarih: null };
    revalidatePath(`/kisi/${kisiId}`);
    revalidatePath("/izin");
    revalidatePath("/");
    revalidatePath("/calisanlar");
    return { error: null, tarih, kaynak: dosya.dosyaAdi };
  }
  return { error: null, tarih: null };
}

export async function modulleriKaydet(formData: FormData): Promise<{ error: string | null }> {
  await yetkiliGerekli();
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
