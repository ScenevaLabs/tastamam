"use client";

import { useRef, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { donemBelgesiUret, fazlaCalismaGeriAl } from "@/app/sablon-actions";
import { Button } from "@/components/ui/button";
import { TarihInput } from "@/components/tarih-input";
import { belgeYukle } from "@/lib/belge-yukle";
import { base64Indir } from "@/lib/indir-istemci";
import { formatTarih } from "@/lib/utils";

/** Fazla çalışma onayı / çalışma belgesi satırının yanında: belgeyi hazırlar. */
export function DonemBelgesiIndir({
  isGirisiId,
  ad,
}: {
  isGirisiId: string;
  ad: "fazla_calisma_onayi" | "calisma_belgesi";
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <span className="flex flex-col items-end">
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await donemBelgesiUret(isGirisiId, ad);
            if (r.error !== null) return setError(r.error);
            base64Indir(r.base64, r.dosyaAdi);
          })
        }
      >
        <Download />
        {isPending ? "Hazırlanıyor…" : "Belgeyi indir"}
      </Button>
      {error && <span className="mt-1 max-w-56 text-right text-xs text-destructive">{error}</span>}
    </span>
  );
}

/** Bir ayın ücret hesap pusulası (4857 md. 37): imzalı nüsha yüklenir. */
export function PusulaSatiri({
  kisiId,
  ay,
  ayAdi,
  yuklendi,
}: {
  kisiId: string;
  ay: string;
  ayAdi: string;
  yuklendi: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [oran, setOran] = useState(0);
  const [isPending, startTransition] = useTransition();
  const girdi = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[14.5px] font-medium">Ücret pusulası · {ayAdi}</div>
        <span className={`text-[13px] font-bold ${yuklendi ? "text-[var(--ok)]" : "text-[var(--warn)]"}`}>
          {yuklendi ? "Var" : "Eksik"}
        </span>
      </div>
      {!yuklendi && (
        <form
          action={() => {
            const dosya = girdi.current?.files?.[0];
            if (!dosya) return setError("Bir dosya seç.");
            setError(null);
            startTransition(async () => {
              const r = await belgeYukle({ tur: "pusula", kisiId, ay }, dosya, setOran);
              setError(r.error);
            });
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={girdi}
            type="file"
            className="min-w-0 flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-transparent file:px-2 file:py-1 file:text-xs file:font-medium"
          />
          <Button type="submit" size="xs" variant="outline" disabled={isPending}>
            {isPending ? `Yükleniyor… %${Math.round(oran * 100)}` : "Yükle"}
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Fazla çalışma onayının geri alındığı gün (işçinin yazılı bildirimi). */
export function FazlaCalismaGeriAlma({
  kisiId,
  isGirisiId,
  geriAlma,
}: {
  kisiId: string;
  isGirisiId: string;
  geriAlma: string | null;
}) {
  const [acik, setAcik] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const kaydet = (fd: FormData) =>
    startTransition(async () => {
      fd.set("kisi_id", kisiId);
      fd.set("is_girisi_id", isGirisiId);
      const r = await fazlaCalismaGeriAl(fd);
      setError(r.error);
      if (!r.error) setAcik(false);
    });

  if (geriAlma) {
    return (
      <form action={kaydet} className="flex flex-wrap items-center gap-2 pb-3 text-xs">
        <span className="font-medium text-[var(--warn)]">
          Onay {formatTarih(geriAlma)} tarihinde geri alındı; 30 gün sonrasından itibaren fazla çalışma yaptırılamaz.
        </span>
        <input type="hidden" name="tarih" value="" />
        <Button type="submit" size="xs" variant="outline" disabled={isPending}>
          Geri almayı kaldır
        </Button>
        {error && <span className="text-destructive">{error}</span>}
      </form>
    );
  }
  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className="pb-3 text-left text-xs text-primary hover:underline">
        Çalışan onayını geri aldı
      </button>
    );
  }
  return (
    <form action={kaydet} className="flex flex-wrap items-center gap-2 pb-3 text-xs">
      <span>Yazılı bildirimin tarihi</span>
      <TarihInput name="tarih" required className="max-w-[170px]" />
      <Button type="submit" size="xs" disabled={isPending}>
        Kaydet
      </Button>
      {error && <span className="text-destructive">{error}</span>}
    </form>
  );
}
