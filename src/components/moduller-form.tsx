"use client";

import { useState, useTransition } from "react";
import { modulleriKaydet } from "@/app/kayit-actions";
import { Button } from "@/components/ui/button";
import { MODULLER, MODUL_ETIKETLERI, type Modul } from "@/lib/types";

export function ModullerForm({ acik, puantajBaslangic }: { acik: Modul[]; puantajBaslangic: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setKaydedildi(false);
    startTransition(async () => {
      const result = await modulleriKaydet(formData);
      if (result.error) setError(result.error);
      else setKaydedildi(true);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      {MODULLER.map((m) => (
        <label key={m} className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name={`modul_${m}`}
            defaultChecked={acik.includes(m)}
            className="mt-1 size-4 accent-[var(--pen)]"
          />
          <span className="flex flex-col">
            <span className="font-bold">{MODUL_ETIKETLERI[m].ad}</span>
            <span className="text-sm text-muted-foreground">{MODUL_ETIKETLERI[m].aciklama}</span>
          </span>
        </label>
      ))}
      {puantajBaslangic !== null && (
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Puantaj takibi başlangıç ayı{" "}
            <span className="text-muted-foreground">
              (bu aydan itibaren her dönemin evrak listesinde aylık puantaj satırı çıkar; önceki aylar istenmez)
            </span>
          </span>
          <input
            type="month"
            name="puantaj_baslangic"
            defaultValue={puantajBaslangic}
            required
            className="h-9 w-44 border border-input bg-transparent px-2 font-mono text-sm"
          />
        </label>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        {kaydedildi && <span className="text-sm font-bold text-[var(--ok)]">Kaydedildi</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
