"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dogumTarihiBelgedenBul } from "@/app/kayit-actions";
import { Button } from "@/components/ui/button";

/** Doğum tarihi boş kişileri sırayla dolaşıp SGK bildirgesinden ya da nüfus
 *  kayıt örneğinden okur. Kişi başına ayrı istek: tek istekte hepsi sunucu
 *  süre sınırını aşar. */
export function DogumTarihiBul({ kisiIdler }: { kisiIdler: string[] }) {
  const router = useRouter();
  const [ilerleme, setIlerleme] = useState<{ bakilan: number; bulunan: number } | null>(null);
  const [bitti, setBitti] = useState<{ bulunan: number; bulunamayan: number; hata: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function basla() {
    setBitti(null);
    startTransition(async () => {
      let bulunan = 0;
      let hata = 0;
      for (let i = 0; i < kisiIdler.length; i++) {
        setIlerleme({ bakilan: i, bulunan });
        try {
          const r = await dogumTarihiBelgedenBul(kisiIdler[i]);
          if (r.error) hata++;
          else if (r.tarih) bulunan++;
        } catch {
          hata++;
        }
      }
      setIlerleme(null);
      setBitti({ bulunan, bulunamayan: kisiIdler.length - bulunan - hata, hata });
      router.refresh();
    });
  }

  if (bitti) {
    return (
      <p className="text-sm">
        {bitti.bulunan} kişinin doğum tarihi belgelerden okundu.
        {bitti.bulunamayan > 0 &&
          ` ${bitti.bulunamayan} kişide okunabilir bir SGK bildirgesi ya da nüfus kayıt örneği yok; kişi sayfasından elle gir.`}
        {bitti.hata > 0 && ` ${bitti.hata} kişinin klasörü okunamadı.`}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {kisiIdler.length} çalışanın doğum tarihi yok. SGK giriş/çıkış bildirgesinden ya da nüfus kayıt örneğinden
        okunabilir; kimlik fotokopisi gibi taranmış belgeler okunmaz.
      </p>
      <Button type="button" size="sm" variant="outline" className="self-start" disabled={isPending} onClick={basla}>
        {ilerleme
          ? `Okunuyor… ${ilerleme.bakilan}/${kisiIdler.length}`
          : "Belgelerden bul"}
      </Button>
    </div>
  );
}
