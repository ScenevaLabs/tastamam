import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { TopluCikisForm } from "@/components/toplu-cikis-form";
import type { Kisi, IsGirisi } from "@/lib/types";

export default async function IsCikisiSayfasi() {
  const supabase = await createClient();

  const { data: donemler } = await supabase
    .from("is_girisi")
    .select("*")
    .eq("durum", "aktif")
    .order("giris_tarihi", { ascending: false })
    .returns<IsGirisi[]>();

  const kisiIds = [...new Set((donemler ?? []).map((d) => d.kisi_id))];
  const { data: kisiler } = kisiIds.length
    ? await supabase.from("kisi").select("*").in("id", kisiIds).returns<Kisi[]>()
    : { data: [] as Kisi[] };
  const kisiMap = new Map((kisiler ?? []).map((k) => [k.id, k]));

  const satirlar = (donemler ?? [])
    .map((isGirisi) => ({ kisi: kisiMap.get(isGirisi.kisi_id), isGirisi }))
    .filter((s): s is { kisi: Kisi; isGirisi: IsGirisi } => !!s.kisi);

  return (
    <>
    <AppHeader aktif="calisanlar" />
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-8 p-4 sm:p-8">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">İş çıkışı</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bir ya da birden fazla işten ayrılanı seç, onayladıktan sonra tek bir maille muhasebeye
          bildir.
        </p>
      </div>

      <TopluCikisForm satirlar={satirlar} />
    </div>
    </>
  );
}
