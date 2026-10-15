"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { belgeYukle } from "@/lib/belge-yukle";
import { formatTarih } from "@/lib/utils";

/** Dönemin evrak listesinde bir ayın puantaj satırı (BelgeSatiri görünümünde). */
export function PuantajBelgeSatiri({
  kisiId,
  ay,
  ayAdi,
  saatsizGun,
  imzaliAt,
  vadesi,
}: {
  kisiId: string;
  ay: string;
  ayAdi: string;
  saatsizGun: number;
  imzaliAt: string | null;
  vadesi: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [oran, setOran] = useState(0);
  const dosyaRef = useRef<HTMLInputElement>(null);

  function yukle(formData: FormData) {
    setError(null);
    const dosya = formData.get("dosya") as File | null;
    if (!dosya || dosya.size === 0) {
      setError("Bir dosya seç.");
      return;
    }
    setOran(0);
    startTransition(async () => {
      const r = await belgeYukle({ tur: "puantaj", kisiId, ay }, dosya, setOran);
      if (r.error) setError(r.error);
      else if (dosyaRef.current) dosyaRef.current.value = "";
    });
  }

  const durum = saatsizGun > 0
    ? { metin: "Saat eksik", stil: vadesi ? "text-[var(--warn)]" : "text-muted-foreground font-medium" }
    : imzaliAt
      ? { metin: "İmzalı", stil: "text-[var(--ok)]" }
      : { metin: vadesi ? "İmzalanmadı" : "Ay sürüyor", stil: vadesi ? "text-[var(--warn)]" : "text-muted-foreground font-medium" };

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14.5px] font-medium">Puantaj · {ayAdi}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {saatsizGun > 0
              ? `${saatsizGun} çalışılan günün giriş–çıkış saati girilmedi`
              : imzaliAt
                ? `İmzalı çizelge ${formatTarih(imzaliAt.slice(0, 10), false)} tarihinde yüklendi`
                : "Saatler tam, çizelge imzaya hazır"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className={`text-[13px] font-bold ${durum.stil}`}>{durum.metin}</span>
          {saatsizGun > 0 ? (
            <Link
              href={`/puantaj?ay=${ay}`}
              className="inline-flex h-6 items-center border border-border px-2 text-xs font-medium hover:bg-accent"
            >
              Puantaja git
            </Link>
          ) : (
            <a
              href={`/api/puantaj/form?ay=${ay}&kisi=${kisiId}`}
              className="inline-flex h-6 items-center border border-border px-2 text-xs font-medium hover:bg-accent"
            >
              Formu indir
            </a>
          )}
        </div>
      </div>
      {saatsizGun === 0 && !imzaliAt && (
        <form action={yukle} className="flex items-center gap-2">
          <input
            ref={dosyaRef}
            type="file"
            name="dosya"
            accept=".pdf,.jpg,.jpeg,.png"
            className="min-w-0 flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-transparent file:px-2 file:py-1 file:text-xs file:font-medium"
          />
          <Button type="submit" size="xs" variant="outline" disabled={isPending}>
            {isPending ? `Yükleniyor… %${Math.round(oran * 100)}` : "İmzalıyı yükle"}
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
