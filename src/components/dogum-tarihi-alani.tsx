"use client";

import { useState, useTransition } from "react";
import { dogumTarihiKaydet } from "@/app/kayit-actions";
import { Button } from "@/components/ui/button";
import { TarihInput } from "@/components/tarih-input";
import { formatTarih } from "@/lib/utils";

/** Yıllık izinde yaş kuralı (18 altı, 50 üstü en az 20 gün) için. */
export function DogumTarihiAlani({ kisiId, dogumTarihi }: { kisiId: string; dogumTarihi: string | null }) {
  const [duzenle, setDuzenle] = useState(false);
  const [deger, setDeger] = useState(dogumTarihi ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!duzenle) {
    return (
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Doğum tarihi:</span>
        {dogumTarihi ? (
          <span className="font-mono text-[13.5px]">{formatTarih(dogumTarihi)}</span>
        ) : (
          <span className="text-muted-foreground">girilmedi</span>
        )}
        <button type="button" onClick={() => setDuzenle(true)} className="text-primary hover:underline">
          {dogumTarihi ? "Değiştir" : "Gir"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <TarihInput aria-label="Doğum tarihi" value={deger} onChange={(e) => setDeger(e.target.value)} />
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await dogumTarihiKaydet(kisiId, deger);
            if (r.error) setError(r.error);
            else setDuzenle(false);
          })
        }
      >
        Kaydet
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setDuzenle(false)}>
        Vazgeç
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
