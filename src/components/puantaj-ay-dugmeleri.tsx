"use client";

import { useState, useTransition } from "react";
import { puantajAyAc, puantajAyKapat } from "@/app/kayit-actions";
import { Button } from "@/components/ui/button";

export function PuantajAyDugmeleri({
  ay,
  ayAdi,
  kapali,
  gonderildi,
  bos,
}: {
  ay: string;
  ayAdi: string;
  kapali: boolean;
  gonderildi: boolean;
  bos: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  // Mail geri alınamaz: gönderen düğmeler önce sayfa içinde onay ister.
  const [onay, setOnay] = useState(false);
  const [isPending, startTransition] = useTransition();

  function calistir(eylem: (ay: string) => Promise<{ error: string | null }>) {
    setError(null);
    setOnay(false);
    startTransition(async () => {
      const r = await eylem(ay);
      if (r.error) setError(r.error);
    });
  }

  const gonderDugmesi = kapali ? "Muhasebeye tekrar gönder" : "Ayı kapat ve muhasebeye gönder";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {!bos && (
          <a
            href={`/api/puantaj/excel?ay=${ay}`}
            className="inline-flex h-8 items-center border border-border bg-card px-3 text-sm font-medium hover:bg-accent"
          >
            Excel indir
          </a>
        )}
        {onay ? (
          <>
            <Button type="button" disabled={isPending} onClick={() => calistir(puantajAyKapat)}>
              Evet, gönder
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOnay(false)}>
              Vazgeç
            </Button>
          </>
        ) : (
          <>
            {!bos && !(kapali && gonderildi) && (
              <Button type="button" disabled={isPending} onClick={() => setOnay(true)}>
                {isPending ? "Gönderiliyor…" : gonderDugmesi}
              </Button>
            )}
            {kapali && (
              <Button type="button" variant="outline" disabled={isPending} onClick={() => calistir(puantajAyAc)}>
                Ayı yeniden aç
              </Button>
            )}
          </>
        )}
      </div>
      {onay && (
        <p className="max-w-sm text-right text-sm">
          {kapali
            ? `${ayAdi} puantajı mali müşavire yeniden gönderilecek.`
            : `${ayAdi} kilitlenecek ve Excel'i mali müşavire gönderilecek. Mail geri alınamaz.`}
        </p>
      )}
      {error && <p className="max-w-sm text-right text-sm text-destructive">{error}</p>}
    </div>
  );
}
