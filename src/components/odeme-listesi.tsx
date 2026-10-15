"use client";

import { useTransition } from "react";
import { odemeOdendiIsaretle, odemeGorMezdenGel, odemeGeriAl } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { formatPara, formatTarih } from "@/lib/utils";
import type { BelgeDurum } from "@/lib/types";

const DURUM_STIL: Record<BelgeDurum, { label: string; className: string }> = {
  yok: { label: "Ödenmedi", className: "text-[var(--warn)]" },
  var: { label: "Ödendi", className: "text-[var(--ok)]" },
  yoksayildi: {
    label: "Görmezden gel",
    className: "font-medium text-muted-foreground",
  },
};

function tutarMetni(tutar: number): string {
  return formatPara(tutar);
}

export function OdemeSatiri({
  kisiId,
  isGirisiId,
  odemeDurumu,
  odemeTarihi,
  tutar,
}: {
  kisiId: string;
  isGirisiId: string;
  odemeDurumu: BelgeDurum;
  odemeTarihi: string | null;
  tutar: number;
}) {
  const [isPending, startTransition] = useTransition();
  const stil = DURUM_STIL[odemeDurumu];

  function isaretle(action: (formData: FormData) => Promise<{ error: string | null }>) {
    const fd = new FormData();
    fd.set("is_girisi_id", isGirisiId);
    fd.set("kisi_id", kisiId);
    startTransition(async () => {
      await action(fd);
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div>
        <div className="text-[14.5px] font-medium">Ödeme</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {tutarMetni(tutar)}
          {odemeDurumu === "var" && odemeTarihi && ` — ${formatTarih(odemeTarihi)} tarihinde`}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span className={`text-[13px] font-bold ${stil.className}`}>
          {stil.label}
        </span>
        {odemeDurumu === "yok" && (
          <>
            <Button
              type="button"
              size="xs"
              disabled={isPending}
              onClick={() => isaretle(odemeOdendiIsaretle)}
            >
              Ödendi işaretle
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isPending}
              onClick={() => isaretle(odemeGorMezdenGel)}
            >
              Görmezden gel
            </Button>
          </>
        )}
        {(odemeDurumu === "var" || odemeDurumu === "yoksayildi") && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={isPending}
            onClick={() => isaretle(odemeGeriAl)}
          >
            Geri al
          </Button>
        )}
      </div>
    </div>
  );
}
