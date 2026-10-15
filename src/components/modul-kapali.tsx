import Link from "next/link";
import { AppHeader, type MenuAnahtari } from "@/components/app-header";

export function ModulKapali({ aktif, ad }: { aktif: MenuAnahtari; ad: string }) {
  return (
    <>
      <AppHeader aktif={aktif} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4 sm:p-8">
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">{ad}</h1>
        <p className="text-muted-foreground">
          Bu modül kapalı. Açmak için{" "}
          <Link href="/ayarlar" className="font-medium text-primary underline-offset-2 hover:underline">
            Ayarlar
          </Link>
          {"'daki Modüller bölümüne bak."}
        </p>
      </div>
    </>
  );
}
