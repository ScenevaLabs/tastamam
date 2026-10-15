"use client";

import { useRef, useState, useTransition } from "react";
import { izinSil } from "@/app/kayit-actions";
import { Button } from "@/components/ui/button";
import { belgeYukle } from "@/lib/belge-yukle";
import type { YillikIzin } from "@/lib/types";
import { formatTarih } from "@/lib/utils";

export function IzinSatiri({
  izin,
  adSoyad,
  cikisTarihi,
}: {
  izin: YillikIzin;
  adSoyad: string;
  /** İzin bu tarihteki çıkıştan sonraya taşıyorsa verilir (uyarı etiketi). */
  cikisTarihi?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [silOnay, setSilOnay] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dosyaRef = useRef<HTMLInputElement>(null);

  function calistir(is: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const r = await is();
      if (r.error) setError(r.error);
    });
  }

  function yukle(dosya: File | undefined) {
    if (!dosya) return;
    calistir(() => belgeYukle({ tur: "izin", kisiId: izin.kisi_id, izinId: izin.id }, dosya));
    if (dosyaRef.current) dosyaRef.current.value = "";
  }

  const imzali = izin.form_durumu === "var";

  return (
    <div className="flex flex-col gap-1.5 border-b border-border/60 px-4 py-3 last:border-b-0 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="min-w-36 font-bold">{adSoyad}</span>
        <span className="font-mono text-[13px]">
          {formatTarih(izin.baslangic, false)} → {formatTarih(izin.bitis)}
        </span>
        {cikisTarihi && (
          <span className="bg-[var(--warn-soft)] px-1.5 py-0.5 text-[12px] font-bold text-[var(--warn)]">
            Çıkıştan ({formatTarih(cikisTarihi, false)}) sonraya taşıyor
          </span>
        )}
        <span className="font-mono text-[13px] text-muted-foreground">
          {izin.gun} gün{izin.yol_izni_gun > 0 && ` + ${izin.yol_izni_gun} yol`}
        </span>
        <span className={`min-w-36 text-[13.5px] font-bold ${imzali ? "text-[var(--ok)]" : "text-[var(--warn)]"}`}>
          {imzali ? "Form imzalı" : "Form imzalanmadı"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a
            href={`/api/izin/${izin.id}/form`}
            className="inline-flex h-6 items-center border border-border px-2 text-xs font-medium hover:bg-accent"
          >
            Formu indir
          </a>
          {!imzali ? (
            <>
              <input
                ref={dosyaRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => yukle(e.target.files?.[0])}
              />
              <Button type="button" size="xs" disabled={isPending} onClick={() => dosyaRef.current?.click()}>
                {isPending ? "Yükleniyor…" : "İmzalı formu yükle"}
              </Button>
            </>
          ) : null}
          {silOnay ? (
            <>
              <Button type="button" size="xs" variant="destructive" disabled={isPending} onClick={() => calistir(() => izinSil(izin.id))}>
                Evet, sil
              </Button>
              <Button type="button" size="xs" variant="outline" onClick={() => setSilOnay(false)}>
                Vazgeç
              </Button>
            </>
          ) : (
            <Button type="button" size="xs" variant="ghost" onClick={() => setSilOnay(true)}>
              Sil
            </Button>
          )}
        </div>
      </div>
      {izin.notu && <div className="text-xs text-muted-foreground">{izin.notu}</div>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
