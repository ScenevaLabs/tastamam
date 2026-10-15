import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { izinBakiyesi, kidemMetni } from "@/lib/izin";
import { izinFormuDocx } from "@/lib/izin-formu-docx";
import { bugunIso } from "@/lib/isg";
import { isbasiTarihi } from "@/lib/mevzuat";
import type { YillikIzin } from "@/lib/types";
import { tarihSlash } from "@/lib/utils";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum yok.", { status: 401 });

  const { data: izin } = await supabase.from("yillik_izin").select("*").eq("id", id).single<YillikIzin>();
  if (!izin) return new Response("İzin kaydı bulunamadı.", { status: 404 });

  const [{ data: kisi }, { data: donemler }, { data: izinler }, { data: ayarlar }] = await Promise.all([
    supabase.from("kisi").select("ad_soyad, tc_kimlik_no, dogum_tarihi").eq("id", izin.kisi_id).single(),
    supabase.from("is_girisi").select("giris_tarihi, cikis_tarihi").eq("kisi_id", izin.kisi_id),
    supabase.from("yillik_izin").select("baslangic, gun").eq("kisi_id", izin.kisi_id).lte("baslangic", izin.baslangic),
    supabase.from("ayarlar").select("sirket_unvani").eq("id", true).single(),
  ]);
  if (!kisi) return new Response("Kişi bulunamadı.", { status: 404 });

  // Bakiye iznin ilk günü itibarıyla, bu izin düşülmüş hâliyle.
  const b = izinBakiyesi({
    donemler: donemler ?? [],
    dogumTarihi: kisi.dogum_tarihi,
    izinler: izinler ?? [],
    bugun: izin.baslangic,
  });

  const dosya = izinFormuDocx({
    sirketUnvani: ayarlar?.sirket_unvani ?? "",
    adSoyad: kisi.ad_soyad,
    tcKimlikNo: kisi.tc_kimlik_no,
    iseGirisTarihi: b ? tarihSlash(b.etkinBaslangic) : "",
    kidem: b ? kidemMetni(b.etkinBaslangic, izin.baslangic) : "",
    hakKazanmaTarihi: b?.sonHakEdis ? tarihSlash(b.sonHakEdis) : "Henüz hak kazanılmadı (avans izin)",
    hakEdilenGun: b?.buYilHak ? `${b.buYilHak} gün` : "",
    baslangic: tarihSlash(izin.baslangic),
    bitis: tarihSlash(izin.bitis),
    isbasi: tarihSlash(isbasiTarihi(izin.bitis, izin.yol_izni_gun)),
    gun: izin.gun,
    yolIzniGun: izin.yol_izni_gun,
    kalanGun: b ? `${b.kalan} gün` : "",
    duzenlemeTarihi: tarihSlash(bugunIso()),
  });

  const dosyaAdi = `yillik-izin-${kisi.ad_soyad}-${izin.baslangic}.docx`;
  return new Response(new Uint8Array(dosya), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="yillik-izin-${izin.baslangic}.docx"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
    },
  });
}
