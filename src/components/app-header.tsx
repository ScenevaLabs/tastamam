import Link from "next/link";
import { ayarlarSatiri, oturumEposta } from "@/lib/istek";
import { ProfilMenu } from "@/components/profil-menu";
import { MobilMenu } from "@/components/mobil-menu";
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

/** Defter çift çizgisi: logonun altındaki işaretle aynı; seçili sekmenin altında durur. */
function CiftCizgi() {
  return <span aria-hidden className="absolute inset-x-3 bottom-0 h-[7px] border-y-2 border-foreground" />;
}

function sekmeSinifi(secili: boolean) {
  return cn(
    "relative shrink-0 whitespace-nowrap px-3 pt-2 pb-[9px] text-[15px] transition-colors",
    secili ? "font-bold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
  );
}

/** Oturum açılmış her sayfanın üst menüsü. Geniş ekranda sekmeler; dar ekranda
 *  (lg altı) sağ üstte tek menü düğmesi, Ayarlar ve profil de onun içinde. */
export async function AppHeader({ aktif }: { aktif?: MenuAnahtari }) {
  const [email, ayarlar] = await Promise.all([oturumEposta(), ayarlarSatiri()]);
  const menu = MENU.filter((m) => !m.modul || (ayarlar?.acik_moduller ?? []).includes(m.modul));
  const profil = {
    email: email ?? undefined,
    unvan: (ayarlar?.profil_unvan as string | null | undefined) ?? null,
    iletisim: (ayarlar?.profil_iletisim as string | null | undefined) ?? null,
  };

  return (
    <header className="w-full border-b border-border bg-card [--ust-menu-h:64px]">
      {/* Logonun çift çizgisi ile seçili sekmenin çift çizgisi aynı alt hizada (items-end). */}
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-x-6 px-4 sm:px-8 lg:h-[76px] lg:items-end lg:pb-3">
        <Link href="/" aria-label="Tastamam ana sayfa" className="shrink-0">
          <Wordmark />
        </Link>
        <nav aria-label="Ana menü" className="hidden flex-1 lg:flex">
          {menu.map((m) => (
            <Link
              key={m.anahtar}
              href={m.href}
              aria-current={aktif === m.anahtar ? "page" : undefined}
              className={sekmeSinifi(aktif === m.anahtar)}
            >
              {m.etiket}
              {aktif === m.anahtar && <CiftCizgi />}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-end gap-2 text-sm lg:flex">
          {ayarlar?.sirket_unvani && (
            <span className="hidden max-w-[260px] truncate pb-[9px] text-muted-foreground xl:inline">
              {ayarlar.sirket_unvani}
            </span>
          )}
          <Link
            href="/ayarlar"
            aria-current={aktif === "ayarlar" ? "page" : undefined}
            className={sekmeSinifi(aktif === "ayarlar")}
          >
            Ayarlar
            {aktif === "ayarlar" && <CiftCizgi />}
          </Link>
          <div className="mb-[7px]">
            <ProfilMenu {...profil} />
          </div>
        </div>
        <div className="ml-auto lg:hidden">
          <MobilMenu
            ogeler={[...menu, { anahtar: "ayarlar", etiket: "Ayarlar", href: "/ayarlar" }]}
            aktif={aktif}
            sirket={(ayarlar?.sirket_unvani as string | null | undefined) ?? null}
            {...profil}
          />
        </div>
      </div>
    </header>
  );
}
