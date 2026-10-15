import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ModulKapali } from "@/components/modul-kapali";
import { KazaFormu } from "@/components/isg-formlari";
import { createClient } from "@/lib/supabase/server";
import { acikModuller } from "@/lib/moduller";
import { bugunIso } from "@/lib/isg";
import { gunEkle } from "@/lib/mevzuat";

export default async function YeniKaza({ searchParams }: { searchParams: Promise<{ kisi?: string }> }) {
  if (!(await acikModuller()).includes("isg")) return <ModulKapali aktif="isg" ad="İSG" />;
  const { kisi: secili } = await searchParams;
  const supabase = await createClient();
  // Son bir yılda çalışmış herkes (kaza geç öğrenilebilir, meslek hastalığı çıkıştan sonra çıkabilir).
  const { data } = await supabase
    .from("is_girisi")
    .select("kisi_id, kisi:kisi_id(ad_soyad)")
    .or(`cikis_tarihi.is.null,cikis_tarihi.gte.${gunEkle(bugunIso(), -365)}`)
    .returns<{ kisi_id: string; kisi: { ad_soyad: string } | null }[]>();
  const kisiler = [...new Map((data ?? []).map((d) => [d.kisi_id, d.kisi?.ad_soyad ?? ""])).entries()]
    .map(([id, adSoyad]) => ({ id, adSoyad }))
    .sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, "tr"));

  return (
    <>
      <AppHeader aktif="isg" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-4 sm:p-8">
        <Link href="/isg" className="text-sm text-primary hover:underline">
          ← İSG
        </Link>
        <div className="max-w-2xl">
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">İş kazası kaydet</h1>
          <p className="mt-1 text-muted-foreground">
            İş kazasını kazadan sonraki üç iş günü içinde SGK&apos;ya bildirmen gerekiyor. Kaydı açınca son günü
            hesaplar, bildirim formuna gereken bilgileri tek yerde toplarız. Yaralanmanın olmadığı ramak kala olayları da
            kaydedilir.
          </p>
          <p className="mt-1 font-mono text-[12px] text-muted-foreground">5510 s.K. md. 13, 14 · 6331 s.K. md. 14</p>
        </div>
        <KazaFormu kisiler={kisiler} varsayilanKisiId={secili} />
      </div>
    </>
  );
}
