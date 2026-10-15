import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bugunIso } from "@/lib/isg";
import { ayinGunleri } from "@/lib/puantaj";
import { puantajFormuDocx } from "@/lib/puantaj-formu-docx";
import { AY_RE, ayAdi, puantajYukle } from "@/lib/puantaj-veri";
import { tarihSlash } from "@/lib/utils";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Bir çalışanın aylık çalışma çizelgesi (imzalatmak için .docx). Kapanmış
 *  ayda kapanıştaki hal kullanılır (puantajYukle). */
export async function GET(request: NextRequest) {
  const ay = request.nextUrl.searchParams.get("ay") ?? "";
  const kisiId = request.nextUrl.searchParams.get("kisi") ?? "";
  if (!AY_RE.test(ay) || !UUID_RE.test(kisiId)) return new Response("İstek geçersiz.", { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum yok.", { status: 401 });

  const [veri, { data: kisi }, { data: ayarlar }, { data: donem }] = await Promise.all([
    puantajYukle(supabase, ay),
    supabase.from("kisi").select("ad_soyad, tc_kimlik_no, meslek_adi").eq("id", kisiId).single(),
    supabase.from("ayarlar").select("sirket_unvani").eq("id", true).single(),
    // Dönem bazlı meslek (0017): ayın son günü itibarıyla geçerli dönem.
    supabase
      .from("is_girisi")
      .select("meslek_adi")
      .eq("kisi_id", kisiId)
      .lte("giris_tarihi", ayinGunleri(ay).at(-1)!)
      .order("giris_tarihi", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const satir = veri.satirlar.find((s) => s.kisiId === kisiId);
  if (!kisi || !satir) return new Response("Bu ay bu çalışanın puantajı yok.", { status: 404 });

  const dosya = puantajFormuDocx({
    sirketUnvani: ayarlar?.sirket_unvani ?? "",
    adSoyad: kisi.ad_soyad,
    tcKimlikNo: kisi.tc_kimlik_no,
    meslek: donem?.meslek_adi ?? kisi.meslek_adi ?? "",
    ayAdi: ayAdi(ay),
    satir,
    duzenlemeTarihi: tarihSlash(bugunIso()),
  });

  const ad = `puantaj-${ay}-${kisi.ad_soyad}.docx`;
  return new Response(new Uint8Array(dosya), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="puantaj-${ay}.docx"; filename*=UTF-8''${encodeURIComponent(ad)}`,
    },
  });
}
