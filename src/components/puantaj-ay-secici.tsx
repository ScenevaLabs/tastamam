"use client";

import Link from "next/link";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** Ay başlığı: oklarla bir ay ileri/geri, ada tıklayınca yıl + 12 ay ızgarasından
 *  doğrudan o aya (20 Ekim 2026). */
export function PuantajAySecici({
  ay,
  ayAdi,
  onceki,
  sonraki,
  buAy,
}: {
  ay: string;
  ayAdi: string;
  onceki: string;
  sonraki: string;
  buAy: string;
}) {
  const [acik, setAcik] = useState(false);
  const [yil, setYil] = useState(Number(ay.slice(0, 4)));

  return (
    <>
      <Link
        href={`/puantaj?ay=${onceki}`}
        aria-label="Önceki ay"
        className="px-1.5 text-lg text-muted-foreground hover:text-foreground"
      >
        ‹
      </Link>
      <Popover
        open={acik}
        onOpenChange={(o) => {
          setAcik(o);
          if (o) setYil(Number(ay.slice(0, 4)));
        }}
      >
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`${ayAdi}, ay seç`}
              className="min-w-36 text-center text-[17px] font-bold underline-offset-4 hover:underline"
            >
              {ayAdi}
            </button>
          }
        />
        <PopoverContent align="center" className="w-64">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYil((y) => y - 1)}
              aria-label="Önceki yıl"
              className="px-2 text-lg text-muted-foreground hover:text-foreground"
            >
              ‹
            </button>
            <span className="font-mono font-bold">{yil}</span>
            <button
              type="button"
              onClick={() => setYil((y) => y + 1)}
              aria-label="Sonraki yıl"
              className="px-2 text-lg text-muted-foreground hover:text-foreground"
            >
              ›
            </button>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {AYLAR.map((ad, i) => {
              const hedef = `${yil}-${String(i + 1).padStart(2, "0")}`;
              const secili = hedef === ay;
              return (
                <Link
                  key={hedef}
                  href={`/puantaj?ay=${hedef}`}
                  onClick={() => setAcik(false)}
                  aria-current={secili ? "page" : undefined}
                  className={`h-9 border text-center text-sm leading-9 ${
                    secili
                      ? "border-foreground bg-foreground font-bold text-background"
                      : hedef === buAy
                        ? "border-primary font-bold text-primary"
                        : "border-border hover:border-foreground"
                  }`}
                >
                  {ad}
                </Link>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Link
        href={`/puantaj?ay=${sonraki}`}
        aria-label="Sonraki ay"
        className="px-1.5 text-lg text-muted-foreground hover:text-foreground"
      >
        ›
      </Link>
    </>
  );
}
