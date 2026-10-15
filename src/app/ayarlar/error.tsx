"use client";

import { Button } from "@/components/ui/button";

export default function AyarlarHata({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-3 p-8">
      <h1 className="text-[18px] font-bold">Ayarlar yüklenemedi</h1>
      <p className="text-sm text-muted-foreground">
        Muhtemelen gelen kutusu taraması sırasında bir bağlantı sorunu oldu. Tekrar deneyin.
      </p>
      <Button type="button" onClick={reset}>
        Tekrar dene
      </Button>
    </div>
  );
}
