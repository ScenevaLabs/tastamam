"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { belgeYukle } from "@/lib/belge-yukle";
import { formatTarih } from "@/lib/utils";

export type ImzaSatiri = {
  kisiId: string;
  adSoyad: string;
  /** Saati girilmemiş çalışılan gün sayısı. */
  saatsizGun: number;
  imzaliAt: string | null;
};

export function PuantajImzaListesi({ ay, satirlar }: { ay: string; satirlar: ImzaSatiri[] }) {
  return (
    <div className="border border-border bg-card">
      {satirlar.map((s) => (
        <Satir key={s.kisiId} ay={ay} s={s} />
      ))}
    </div>
  );
}

function Satir({ ay, s }: { ay: string; s: ImzaSatiri }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dosyaRef = useRef<HTMLInputElement>(null);

  function yukle(dosya: File | undefined) {
    if (!dosya) return;
    setError(null);
    startTransition(async () => {
      const r = await belgeYukle({ tur: "puantaj", kisiId: s.kisiId, ay }, dosya);
      if (r.error) setError(r.error);
    });
    if (dosyaRef.current) dosyaRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5 border-b border-border/60 px-4 py-2.5 last:border-b-0 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="min-w-40 font-bold">{s.adSoyad}</span>
        {s.saatsizGun > 0 ? (
          <span className="text-[13px] font-medium text-[var(--warn)]">{s.saatsizGun} çalışılan günün saati girilmedi</span>
        ) : (
          <span className="text-[13px] text-muted-foreground">Saatler tam</span>
        )}
        <span className={`text-[13.5px] font-bold ${s.imzaliAt ? "text-[var(--ok)]" : "text-[var(--warn)]"}`}>
          {s.imzaliAt ? `İmzalı · ${formatTarih(s.imzaliAt.slice(0, 10), false)}` : "İmzalanmadı"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a
            href={`/api/puantaj/form?ay=${ay}&kisi=${s.kisiId}`}
            className="inline-flex h-6 items-center border border-border px-2 text-xs font-medium hover:bg-accent"
          >
            Formu indir
          </a>
          {/* Depo aynı adlı dosyanın üzerine yazmaz; imzalıysa yeniden yükleme yok. */}
          {!s.imzaliAt && (
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
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
