"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { isgBelgeYoksay, isgBelgeGeriAl } from "@/app/actions";
import { belgeYukle } from "@/lib/belge-yukle";
import { VARSAYILAN_GECERLILIK_YIL, yilEkle } from "@/lib/isg";
import { formatTarih } from "@/lib/utils";
import type { IsgBelgeTipi } from "@/lib/types";

type Props = {
  kisiId: string;
  tip: IsgBelgeTipi;
  label: string;
  durum: "var" | "eksik" | "yoksayildi";
  /** Bu döngüde sayılan belgenin alınma tarihi. */
  alinmaTarihi: string | null;
  /** Önceki alımlar (eskiden yeniye) — "ilk alınma" bilgisi için. */
  gecmisTarihleri: string[];
  /** Sertifikanın süresi dolduysa eksik etiketi "Yenilenecek" olur. */
  yenilenecek: boolean;
};

const DURUM_STIL = {
  var: { label: "Var", className: "text-[var(--ok)]" },
  eksik: { label: "Eksik", className: "text-[var(--warn)]" },
  yoksayildi: {
    label: "Gerekli değil",
    className: "font-medium text-muted-foreground",
  },
} as const;

const TARIH_INPUT =
  "rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground";

export function IsgBelgeSatiri({
  kisiId,
  tip,
  label,
  durum,
  alinmaTarihi,
  gecmisTarihleri,
  yenilenecek,
}: Props) {
  const sertifika = tip === "isg_egitim_sertifikasi";
  const stil =
    durum === "eksik" && yenilenecek
      ? { ...DURUM_STIL.eksik, label: "Yenilenecek" }
      : DURUM_STIL[durum];
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [oran, setOran] = useState(0);
  const [alinma, setAlinma] = useState("");
  const [gecerlilik, setGecerlilik] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    const dosya = formData.get("dosya") as File | null;
    if (!dosya || dosya.size === 0) return setError("Bir dosya seç.");
    if (!alinma) return setError("Alınma tarihini gir.");
    setOran(0);
    startTransition(async () => {
      const result = await belgeYukle(
        { tur: "isg", kisiId, belgeTipi: tip, alinmaTarihi: alinma, gecerlilikTarihi: gecerlilik },
        dosya,
        setOran,
      );
      if (result.error) return setError(result.error);
      formRef.current?.reset();
      setAlinma("");
      setGecerlilik("");
    });
  }

  const ilkAlinma = gecmisTarihleri[0];
  const altSatir = [
    alinmaTarihi && `Alındı: ${formatTarih(alinmaTarihi)}`,
    ilkAlinma && ilkAlinma !== alinmaTarihi && `İlk: ${formatTarih(ilkAlinma)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const yuklemeFormu = (
    <form ref={formRef} action={handleUpload} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kisi_id" value={kisiId} />
      <input type="hidden" name="belge_tipi" value={tip} />
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Alınma
        <input
          type="date"
          name="alinma_tarihi"
          value={alinma}
          onChange={(e) => {
            setAlinma(e.target.value);
            if (sertifika && e.target.value) {
              setGecerlilik(yilEkle(e.target.value, VARSAYILAN_GECERLILIK_YIL));
            }
          }}
          className={TARIH_INPUT}
        />
      </label>
      {sertifika && (
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Geçerlilik
          <input
            type="date"
            name="gecerlilik_tarihi"
            value={gecerlilik}
            onChange={(e) => setGecerlilik(e.target.value)}
            className={TARIH_INPUT}
          />
        </label>
      )}
      <input
        type="file"
        name="dosya"
        className="min-w-0 flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-transparent file:px-2 file:py-1 file:text-xs file:font-medium"
      />
      <Button type="submit" size="xs" variant="outline" disabled={isPending}>
        {isPending ? `Yükleniyor… %${Math.round(oran * 100)}` : "Yükle"}
      </Button>
    </form>
  );

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14.5px] font-medium">{label}</div>
          {altSatir && <div className="mt-0.5 text-xs text-muted-foreground">{altSatir}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className={`text-[13px] font-bold ${stil.className}`}>
            {stil.label}
          </span>
          {durum !== "var" && (
            <form action={durum === "eksik" ? isgBelgeYoksay : isgBelgeGeriAl}>
              <input type="hidden" name="kisi_id" value={kisiId} />
              <input type="hidden" name="belge_tipi" value={tip} />
              <Button type="submit" size="xs" variant="outline">
                {durum === "eksik" ? "Gerekli değil" : "Geri al"}
              </Button>
            </form>
          )}
        </div>
      </div>
      {durum === "eksik" && yuklemeFormu}
      {durum === "var" && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Yenisini yükle</summary>
          <div className="mt-2">{yuklemeFormu}</div>
        </details>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
