"use client";

import { useState, useTransition } from "react";
import { User, LogOut, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfil, signOut } from "@/app/actions";

type ProfilBilgisi = {
  email: string | undefined;
  unvan: string | null;
  iletisim: string | null;
};

export function ProfilMenu(p: ProfilBilgisi) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            aria-label="Profil"
          >
            <User />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72">
        <ProfilIcerik {...p} />
      </PopoverContent>
    </Popover>
  );
}

/** Profil bilgileri + çıkış. Masaüstünde açılır kutuda, mobilde menünün içinde. */
export function ProfilIcerik({ email, unvan: unvanBaslangic, iletisim: iletisimBaslangic }: ProfilBilgisi) {
  const [unvan, setUnvan] = useState(unvanBaslangic ?? "");
  const [iletisim, setIletisim] = useState(iletisimBaslangic ?? "");
  const [duzenleniyor, setDuzenleniyor] = useState(!unvanBaslangic && !iletisimBaslangic);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateProfil(formData);
      setDuzenleniyor(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="truncate text-sm font-semibold">{email}</p>

      <div className="flex flex-col gap-2.5 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Profil bilgileri
          </span>
          {!duzenleniyor && (
            <button
              type="button"
              onClick={() => setDuzenleniyor(true)}
              aria-label="Bilgileri düzenle"
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
        </div>

        {duzenleniyor ? (
          <form action={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profil_unvan">Unvan</Label>
              <Input
                id="profil_unvan"
                name="profil_unvan"
                value={unvan}
                onChange={(e) => setUnvan(e.target.value)}
                placeholder="ör. Kurucu Ortak"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profil_iletisim">İletişim</Label>
              <Input
                id="profil_iletisim"
                name="profil_iletisim"
                value={iletisim}
                onChange={(e) => setIletisim(e.target.value)}
                placeholder="ör. telefon numarası"
              />
            </div>
            <Button type="submit" size="sm" disabled={isPending} className="self-start">
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Unvan</p>
              <p className="font-medium">{unvan || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">İletişim</p>
              <p className="font-medium">{iletisim || "—"}</p>
            </div>
          </div>
        )}
      </div>

      <form action={signOut} className="border-t border-border pt-3">
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="w-full justify-center"
        >
          <LogOut />
          Çıkış yap
        </Button>
      </form>
    </div>
  );
}
