"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { belgeYukle } from "@/lib/belge-yukle";
import { VARSAYILAN_GECERLILIK_YIL, yilEkle } from "@/lib/isg";
import { ISG_BELGE_ETIKETLERI, ISG_BELGE_TIPLERI, type IsgBelgeTipi } from "@/lib/types";

// İSG paketi (9 Ekim 2026, kullanıcı talebi): beş belge temel eğitim
// sertifikasıyla birlikte, aynı tarihte veriliyor — tek tarih, tek form.
// Dosyalar sırayla, her biri tarayıcıdan doğrudan depoya gönderilir
// (lib/belge-yukle.ts) — boyut sınırı yok.
// Sonradan tek bir belgenin yenisi (ör. 6 ay sonra sağlık raporu) satırdaki
// "Yenisini yükle" ile kendi tarihiyle eklenir.

const TARIH_INPUT =
  "rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground";

type Props = {
  kisiId: string;
  /** Geçerli sertifika yoksa (hiç yok ya da süresi dolmuş) açık başlar. */
  acik: boolean;
};

export function IsgPaketYukleme({ kisiId, acik }: Props) {
  const [alinma, setAlinma] = useState("");
  const [gecerlilik, setGecerlilik] = useState("");
  const [hatalar, setHatalar] = useState<string[]>([]);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [ilerleme, setIlerleme] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setHatalar([]);
    setMesaj(null);
    const secilenler = ISG_BELGE_TIPLERI.map((tip) => ({
      tip,
      dosya: formData.get(`dosya_${tip}`) as File | null,
    })).filter((s): s is { tip: IsgBelgeTipi; dosya: File } => !!s.dosya && s.dosya.size > 0);

    if (!alinma) return setHatalar(["Alınma tarihini gir."]);
    if (secilenler.length === 0) return setHatalar(["En az bir dosya seç."]);

    startTransition(async () => {
      const yeniHatalar: string[] = [];
      let basarili = 0;
      for (const [i, { tip, dosya }] of secilenler.entries()) {
        setIlerleme(`${i + 1}/${secilenler.length}: ${ISG_BELGE_ETIKETLERI[tip]}`);
        const result = await belgeYukle(
          {
            tur: "isg",
            kisiId,
            belgeTipi: tip,
            alinmaTarihi: alinma,
            gecerlilikTarihi: tip === "isg_egitim_sertifikasi" ? gecerlilik : undefined,
          },
          dosya,
          (oran) =>
            setIlerleme(
              `${i + 1}/${secilenler.length}: ${ISG_BELGE_ETIKETLERI[tip]} %${Math.round(oran * 100)}`,
            ),
        );
        if (result.error) yeniHatalar.push(`${ISG_BELGE_ETIKETLERI[tip]}: ${result.error}`);
        else {
          basarili++;
          const input = formRef.current?.elements.namedItem(`dosya_${tip}`);
          if (input instanceof HTMLInputElement) input.value = "";
        }
      }
      setIlerleme(null);
      setHatalar(yeniHatalar);
      if (basarili > 0) setMesaj(`${basarili} belge yüklendi.`);
      if (yeniHatalar.length === 0) {
        setAlinma("");
        setGecerlilik("");
      }
    });
  }

  return (
    <details open={acik} className="mb-3 rounded-lg border border-border bg-card px-4 py-3 text-xs">
      <summary className="cursor-pointer text-[13px] font-semibold">
        İSG paketi yükle (sertifika ve eğitim belgeleri, tek tarih)
      </summary>
      <form ref={formRef} action={handleSubmit} className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-muted-foreground">
            Alınma
            <input
              type="date"
              value={alinma}
              onChange={(e) => {
                setAlinma(e.target.value);
                if (e.target.value) setGecerlilik(yilEkle(e.target.value, VARSAYILAN_GECERLILIK_YIL));
              }}
              className={TARIH_INPUT}
            />
          </label>
          <label className="flex items-center gap-1 text-muted-foreground">
            Sertifika geçerlilik
            <input
              type="date"
              value={gecerlilik}
              onChange={(e) => setGecerlilik(e.target.value)}
              className={TARIH_INPUT}
            />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          {ISG_BELGE_TIPLERI.map((tip) => (
            <label key={tip} className="flex flex-wrap items-center gap-2">
              <span className="w-56 shrink-0 text-[13px]">{ISG_BELGE_ETIKETLERI[tip]}</span>
              <input
                type="file"
                name={`dosya_${tip}`}
                className="min-w-0 flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-transparent file:px-2 file:py-1 file:text-xs file:font-medium"
              />
            </label>
          ))}
        </div>
        <p className="text-muted-foreground">
          Boş bırakılan belge yüklenmez. Sonradan tek bir belgenin yenisi (ör. sağlık raporu)
          aşağıdaki satırdan kendi tarihiyle eklenir.
        </p>
        <div className="flex items-center gap-3">
          <Button type="submit" size="xs" variant="outline" disabled={isPending}>
            {isPending ? "Yükleniyor..." : "Paketi yükle"}
          </Button>
          {ilerleme && <span className="text-muted-foreground">{ilerleme}</span>}
          {mesaj && !isPending && <span className="text-[var(--ok)]">{mesaj}</span>}
        </div>
        {hatalar.map((h) => (
          <p key={h} className="text-red-600">
            {h}
          </p>
        ))}
      </form>
    </details>
  );
}
