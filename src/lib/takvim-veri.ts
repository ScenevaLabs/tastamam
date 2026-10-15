import type { SupabaseClient } from "@supabase/supabase-js";
import type { TehlikeSinifi } from "@/lib/mevzuat";
import type { TakvimGirdisi } from "@/lib/takvim";
import type { IsgBelge, IsKazasi, IsyeriBelge, Modul } from "@/lib/types";

/** Takvimin bütün verisi tek seferde, paralel (bkz. lib/istek.ts). Oturumlu
 *  istemciyle (sayfa) ya da gizli anahtarlı istemciyle (hatırlatma görevi)
 *  çağrılır. 0026 uygulanmadıysa yeni tablolar boş döner. */
export async function takvimVerisiYukle(
  supabase: SupabaseClient,
  bugun: string,
  ayarlar: Record<string, unknown> | null,
): Promise<TakvimGirdisi> {
  const [kisiler, donemler, donemBelgeleri, isgBelgeleri, isyeriBelgeleri, kazalar, izinler, aylar] = await Promise.all([
    supabase.from("kisi").select("id, ad_soyad, dogum_tarihi"),
    supabase.from("is_girisi").select("id, kisi_id, giris_tarihi, cikis_tarihi"),
    supabase
      .from("is_girisi_belge")
      .select("is_girisi_id, belge_tipi, durum")
      .in("belge_tipi", ["isegiris_bildirgesi", "istenayrilis_bildirgesi"]),
    supabase.from("isg_belge").select("*"),
    supabase.from("isyeri_belge").select("*"),
    supabase.from("is_kazasi").select("*"),
    supabase.from("yillik_izin").select("kisi_id, baslangic, gun"),
    supabase.from("puantaj_ay").select("ay").not("kapandi_at", "is", null),
  ]);
  const baslangic = ayarlar?.puantaj_baslangic as string | null | undefined;
  return {
    bugun,
    moduller: ((ayarlar?.acik_moduller as Modul[] | null) ?? []) as Modul[],
    sinif: (ayarlar?.isg_tehlike_sinifi as TehlikeSinifi | null | undefined) ?? null,
    puantajBaslangicAy: baslangic ? baslangic.slice(0, 7) : null,
    kisiler: kisiler.data ?? [],
    donemler: donemler.data ?? [],
    donemBelgeleri: donemBelgeleri.data ?? [],
    isgBelgeleri: (isgBelgeleri.data ?? []) as IsgBelge[],
    isyeriBelgeleri: (isyeriBelgeleri.data ?? []) as IsyeriBelge[],
    kazalar: (kazalar.data ?? []) as IsKazasi[],
    izinler: izinler.data ?? [],
    kapaliAylar: (aylar.data ?? []).map((a) => String(a.ay).slice(0, 7)),
  };
}
