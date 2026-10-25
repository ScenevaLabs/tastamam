import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { CalisanListesi } from "@/components/calisan-listesi";
import { calisanOzetleriYukle } from "@/lib/calisan-ozet";
import { IS_ILISKISI, engelliKontenjani } from "@/lib/mevzuat";

export default async function CalisanlarSayfasi() {
  const supabase = await createClient();
  const { error, aktifRows, pasifRows } = await calisanOzetleriYukle(supabase);

  // Engelli istihdamı: 50 ve üzeri işçide %3 (4857 md. 30). Aynı ildeki
  // işyerleri toplanır; uygulama tek işyeri varsayar.
  const engelliGereken = aktifRows.length >= IS_ILISKISI.engelliEsik.deger ? engelliKontenjani(aktifRows.length) : 0;
  const engelliSayisi = aktifRows.filter((r) => r.kisi.engelli).length;

  return (
    <>
      <AppHeader aktif="calisanlar" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-4 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">Çalışanlar</h1>
            <p className="text-muted-foreground">
              {aktifRows.length} aktif, {pasifRows.length} pasif.
            </p>
            {engelliGereken > engelliSayisi && (
              <p className="text-sm font-bold text-[var(--warn)]">
                {aktifRows.length} çalışanla en az {engelliGereken} engelli çalışan istihdam etmen gerekiyor; şu an{" "}
                {engelliSayisi}. <span className="font-mono text-[12px] font-normal">{IS_ILISKISI.engelliOrani.dayanak}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              size="lg"
              className="border-primary px-4 font-bold text-primary"
              render={<Link href="/is-cikisi">İş çıkışı</Link>}
            />
            <Button
              nativeButton={false}
              size="lg"
              className="px-4 font-bold"
              render={<Link href="/is-girisi">İş girişi</Link>}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive">Kayıtlar yüklenemedi: {error.message}</p>
        ) : (
          <CalisanListesi aktifRows={aktifRows} pasifRows={pasifRows} />
        )}
      </div>
    </>
  );
}
