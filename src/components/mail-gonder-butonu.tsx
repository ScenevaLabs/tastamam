"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { MailGonderimKaydi } from "@/lib/types";

const KISA_TARIH_SAAT = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type MailGonderButonuProps = {
  label: string;
  action: (formData: FormData) => Promise<{ error: string | null }>;
  hiddenFields: Record<string, string>;
  sonKayit: MailGonderimKaydi | undefined;
};

export function MailGonderButonu({
  label,
  action,
  hiddenFields,
  sonKayit,
}: MailGonderButonuProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1 py-1.5">
      <div className="flex items-center justify-between gap-3">
        <form action={handleSubmit}>
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Button type="submit" size="xs" variant="outline" disabled={isPending}>
            {isPending ? "Gönderiliyor..." : label}
          </Button>
        </form>
        {sonKayit && (
          <span
            className={`text-xs font-medium ${
              sonKayit.durum === "basarili" ? "text-[var(--ok)]" : "text-[var(--warn)]"
            }`}
          >
            {sonKayit.durum === "basarili" ? "Gönderildi" : "Başarısız"} ·{" "}
            {KISA_TARIH_SAAT.format(new Date(sonKayit.created_at))}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && sonKayit?.durum === "basarisiz" && sonKayit.hata_mesaji && (
        <p className="text-xs text-[var(--warn)]">{sonKayit.hata_mesaji}</p>
      )}
    </div>
  );
}
