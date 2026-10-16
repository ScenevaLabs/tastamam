"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ProfilIcerik } from "@/components/profil-menu";
import { cn } from "@/lib/utils";

export type MobilMenuOgesi = { anahtar: string; etiket: string; href: string };

/** Dar ekranda sağ üstteki menü düğmesi: sekmeler, Ayarlar ve profil tek listede. */
export function MobilMenu({
  ogeler,
  aktif,
  sirket,
  email,
  unvan,
  iletisim,
}: {
  ogeler: MobilMenuOgesi[];
  aktif?: string;
  sirket: string | null;
  email: string | undefined;
  unvan: string | null;
  iletisim: string | null;
}) {
  // Menü açıldığı sayfaya bağlı: sayfa değişince kendiliğinden kapanır.
  const yol = usePathname();
  const [acikYol, setAcikYol] = useState<string | null>(null);
  const acik = acikYol === yol;
  const setAcik = (a: boolean) => setAcikYol(a ? yol : null);

  useEffect(() => {
    if (!acik) return;
    const kapat = (e: KeyboardEvent) => e.key === "Escape" && setAcikYol(null);
    document.addEventListener("keydown", kapat);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", kapat);
      document.body.style.overflow = "";
    };
  }, [acik]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(!acik)}
        aria-expanded={acik}
        aria-controls="mobil-menu"
        aria-label={acik ? "Menüyü kapat" : "Menüyü aç"}
        className="-mr-2 flex size-10 items-center justify-center text-foreground"
      >
        {acik ? <X className="size-6" /> : <Menu className="size-6" />}
      </button>
      {acik && (
        <div
          id="mobil-menu"
          className="fixed inset-x-0 top-[var(--ust-menu-h)] bottom-0 z-50 overflow-y-auto border-t border-border bg-card"
        >
          <nav aria-label="Ana menü" className="flex flex-col px-4 py-2">
            {ogeler.map((m) => (
              <Link
                key={m.anahtar}
                href={m.href}
                onClick={() => setAcik(false)}
                aria-current={aktif === m.anahtar ? "page" : undefined}
                className={cn(
                  "flex items-center border-b border-border/60 py-3.5 text-[17px]",
                  aktif === m.anahtar ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                )}
              >
                {aktif === m.anahtar && <span aria-hidden className="mr-3 h-5 w-[3px] bg-foreground" />}
                {m.etiket}
              </Link>
            ))}
          </nav>
          <div className="mx-4 mt-4 mb-8 border border-border p-4">
            {sirket && <p className="mb-3 text-sm text-muted-foreground">{sirket}</p>}
            <ProfilIcerik email={email} unvan={unvan} iletisim={iletisim} />
          </div>
        </div>
      )}
    </>
  );
}
