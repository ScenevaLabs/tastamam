"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { gosterilenDurum, type BelgeDurum } from "@/lib/types";
import { belgeYukle } from "@/lib/belge-yukle";
import type { YuklemeIstegi } from "@/app/actions";

type BelgeSatiriProps = {
  label: string;
  durum: BelgeDurum | undefined;
  notu: string | null | undefined;
  yoksayAction: (formData: FormData) => void;
  geriAlAction: (formData: FormData) => void;
  yuklemeIstegi: YuklemeIstegi;
  hiddenFields: Record<string, string>;
  /** Satırın sağında duruma ek düğme (ör. KVKK metnini indir). */
  ek?: React.ReactNode;
};

const DURUM_STIL = {
  var: { label: "Var", className: "text-[var(--ok)]" },
  eksik: { label: "Eksik", className: "text-[var(--warn)]" },
  yoksayildi: {
    label: "Gerekli değil",
    className: "font-medium text-muted-foreground",
  },
} as const;

export function BelgeSatiri({
  label,
  durum,
  notu,
  yoksayAction,
  geriAlAction,
  yuklemeIstegi,
  hiddenFields,
  ek,
}: BelgeSatiriProps) {
  const gosterilen = gosterilenDurum(durum);
  const stil = DURUM_STIL[gosterilen];
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [oran, setOran] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    const dosya = formData.get("dosya") as File | null;
    if (!dosya || dosya.size === 0) {
      setError("Bir dosya seç.");
      return;
    }
    setOran(0);
    startTransition(async () => {
      const result = await belgeYukle(yuklemeIstegi, dosya, setOran);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14.5px] font-medium">{label}</div>
          {notu && <div className="mt-0.5 text-xs text-muted-foreground">{notu}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {ek}
          <span
            className={`text-[13px] font-bold ${stil.className}`}
          >
            {stil.label}
          </span>
          {gosterilen === "eksik" && (
            <form action={yoksayAction}>
              {Object.entries(hiddenFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Button type="submit" size="xs" variant="outline">
                Gerekli değil
              </Button>
            </form>
          )}
          {gosterilen === "yoksayildi" && (
            <form action={geriAlAction}>
              {Object.entries(hiddenFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Button type="submit" size="xs" variant="outline">
                Geri al
              </Button>
            </form>
          )}
        </div>
      </div>
      {gosterilen === "eksik" && (
        <form action={handleUpload} className="flex items-center gap-2">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input
            ref={fileInputRef}
            type="file"
            name="dosya"
            className="min-w-0 flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-transparent file:px-2 file:py-1 file:text-xs file:font-medium"
          />
          <Button type="submit" size="xs" variant="outline" disabled={isPending}>
            {isPending ? `Yükleniyor… %${Math.round(oran * 100)}` : "Yükle"}
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
