"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { izinUcretiGeriAl, izinUcretiOdendi } from "@/app/kayit-actions";
import { Button } from "@/components/ui/button";
import { formatPara, formatTarih } from "@/lib/utils";

export type CikisIzni = {
  isGirisiId: string;
  kisiId: string;
  adSoyad: string;
  cikisTarihi: string;
  /** Çıkış tarihindeki bakiye (eksi: avans izin). */
  kalan: number;
  gunlukUcret: number;
  /** "Günlük net 1.250,00 TL", "Asgari ücret" … */
  ucretAciklama: string;
  odendiGun: number | null;
  odendiAt: string | null;
  tasanlar: { baslangic: string; bitis: string; tasanGun: number }[];
};

export function CikisIzinSatiri({ c, bugun }: { c: CikisIzni; bugun: string }) {
  const [onay, setOnay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function calistir(is: () => Promise<{ error: string | null }>) {
    setError(null);
    setOnay(false);
    startTransition(async () => {
      const r = await is();
      if (r.error) setError(r.error);
    });
  }

  const odendi = !!c.odendiAt;
  const gun = odendi ? (c.odendiGun ?? 0) : Math.max(c.kalan, 0);
  const tutar = gun * c.gunlukUcret;
  const ayrildi = c.cikisTarihi < bugun;

  return (
    <div className="flex flex-col gap-1.5 border-b border-border/60 px-4 py-3 last:border-b-0 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link href={`/kisi/${c.kisiId}`} className="min-w-36 font-bold hover:text-primary">
          {c.adSoyad}
        </Link>
        <span className="font-mono text-[13px] text-muted-foreground">
          {ayrildi ? "Çıkış" : "Çıkacak"} {formatTarih(c.cikisTarihi)}
        </span>
        <span className="text-[14px]">
          {c.kalan < 0 && !odendi ? (
            <span className="text-[var(--warn)]">{-c.kalan} gün avans izin kullanılmış, ödenecek izin yok</span>
          ) : (
            <>
              <strong>{gun} gün</strong> × {formatPara(c.gunlukUcret)} ={" "}
              <strong className="font-mono">{formatPara(tutar)}</strong>{" "}
              <span className="text-[12.5px] text-muted-foreground">({c.ucretAciklama})</span>
            </>
          )}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {odendi ? (
            <>
              <span className="text-[13.5px] font-bold text-[var(--ok)]">
                Ödendi · {formatTarih(c.odendiAt!.slice(0, 10))}
              </span>
              <Button type="button" size="xs" variant="ghost" disabled={isPending} onClick={() => calistir(() => izinUcretiGeriAl(c.isGirisiId))}>
                Geri al
              </Button>
            </>
          ) : gun > 0 ? (
            onay ? (
              <>
                <Button type="button" size="xs" disabled={isPending} onClick={() => calistir(() => izinUcretiOdendi(c.isGirisiId, gun))}>
                  Evet, {gun} gün ödendi
                </Button>
                <Button type="button" size="xs" variant="outline" onClick={() => setOnay(false)}>
                  Vazgeç
                </Button>
              </>
            ) : (
              <Button type="button" size="xs" disabled={isPending} onClick={() => setOnay(true)}>
                Ödendi olarak işaretle
              </Button>
            )
          ) : null}
        </div>
      </div>
      {c.tasanlar.map((t) => (
        <p key={t.baslangic} className="bg-[var(--warn-soft)] px-3 py-1.5 text-sm text-[var(--warn)]">
          {formatTarih(t.baslangic, false)} → {formatTarih(t.bitis)} izni çıkış tarihinden sonraya taşıyor; çıkıştan
          sonraki {t.tasanGun} gün kullanılmış sayılmadı. İzin kaydını aşağıdan düzelt ya da sil.
        </p>
      ))}
      {odendi && c.odendiGun !== Math.max(c.kalan, 0) && (
        <p className="text-sm text-muted-foreground">
          Ödendikten sonra izin kayıtları değişmiş: şu anki hesap {Math.max(c.kalan, 0)} gün. Gerekirse geri alıp yeniden
          işaretle.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
