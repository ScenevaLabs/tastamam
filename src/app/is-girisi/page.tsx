import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { TopluIsGirisiForm } from "@/components/toplu-is-girisi-form";
import type { Kisi } from "@/lib/types";

export default async function IsGirisiSayfasi() {
  const supabase = await createClient();
  const { data: kisiler } = await supabase.from("kisi").select("*").returns<Kisi[]>();

  return (
    <>
    <AppHeader aktif="calisanlar" />
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-8 p-4 sm:p-8">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">İş girişi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bir ya da birden fazla kişi ekle, onayladıktan sonra tek bir maille muhasebeye bildir.
        </p>
      </div>

      <TopluIsGirisiForm kisiler={kisiler ?? []} />
    </div>
    </>
  );
}
