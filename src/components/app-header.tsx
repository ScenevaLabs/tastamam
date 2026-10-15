import Link from "next/link";
import { ayarlarSatiri, oturumEposta } from "@/lib/istek";
import { ProfilMenu } from "@/components/profil-menu";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

import type { Modul } from "@/lib/types";

export type MenuAnahtari = "calisanlar" | "odemeler" | "ayarlar" | Modul;

// Modül sekmeleri yalnızca Ayarlar'da açıksa görünür (Faz D).
const MENU: { anahtar: MenuAnahtari; etiket: string; href: string; modul?: Modul }[] = [
  { anahtar: "calisanlar", etiket: "Çalışanlar", href: "/" },
  { anahtar: "takvim", etiket: "Takvim", href: "/takvim", modul: "takvim" },
  { anahtar: "puantaj", etiket: "Puantaj", href: "/puantaj", modul: "puantaj" },
  { anahtar: "izin", etiket: "İzinler", href: "/izin", modul: "izin" },
  { anahtar: "isg", etiket: "İSG", href: "/isg", modul: "isg" },
  { anahtar: "odemeler", etiket: "Ödemeler", href: "/odemeler" },
];

/** Oturum açılmış her sayfanın üst menüsü. */
export async function AppHeader({ aktif }: { aktif?: MenuAnahtari }) {
  const [email, ayarlar] = await Promise.all([oturumEposta(), ayarlarSatiri()]);

  return (
    <header className="w-full border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-8">
        <Link href="/" aria-label="Tastamam ana sayfa" className="shrink-0">
          <Wordmark />
        </Link>
        <nav aria-label="Ana menü" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
          {MENU.filter((m) => !m.modul || (ayarlar?.acik_moduller ?? []).includes(m.modul)).map((m) => (
            <Link
              key={m.anahtar}
              href={m.href}
              aria-current={aktif === m.anahtar ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-[15px] transition-colors",
                aktif === m.anahtar
                  ? "border-foreground font-bold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {m.etiket}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {ayarlar?.sirket_unvani && (
            <span className="hidden text-muted-foreground md:inline">{ayarlar.sirket_unvani}</span>
          )}
          <Link
            href="/ayarlar"
            aria-current={aktif === "ayarlar" ? "page" : undefined}
            className={cn(
              aktif === "ayarlar" ? "font-bold text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Ayarlar
          </Link>
          <ProfilMenu
            email={email ?? undefined}
            unvan={ayarlar?.profil_unvan ?? null}
            iletisim={ayarlar?.profil_iletisim ?? null}
          />
        </div>
      </div>
    </header>
  );
}
