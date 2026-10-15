"use client";

import { useState, useTransition } from "react";
import { updateAyarlar } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Ayarlar } from "@/lib/types";

export function AyarlarForm({ ayarlar }: { ayarlar: Ayarlar | null }) {
  const [sirketUnvani, setSirketUnvani] = useState(ayarlar?.sirket_unvani ?? "");
  const [sirketAdresi, setSirketAdresi] = useState(ayarlar?.sirket_adresi ?? "");
  const [maliMusavirEmail, setMaliMusavirEmail] = useState(ayarlar?.mali_musavir_email ?? "");
  const [gonderenEmail, setGonderenEmail] = useState(ayarlar?.gonderen_email ?? "");
  const [takipEmail, setTakipEmail] = useState(ayarlar?.takip_email ?? "");
  const [isgEmail, setIsgEmail] = useState(ayarlar?.isg_email ?? "");
  const [isgCcGiris, setIsgCcGiris] = useState(ayarlar?.isg_cc_giris ?? true);
  const [asgariUcret, setAsgariUcret] = useState(
    ayarlar ? String(ayarlar.asgari_ucret_aylik) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setKaydedildi(false);
    startTransition(async () => {
      const result = await updateAyarlar(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setKaydedildi(true);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="sirket_unvani">
          Şirket unvanı{" "}
          <span className="text-muted-foreground font-normal">(muhasebe maillerinde ve sözleşmede geçer)</span>
        </Label>
        <Input
          id="sirket_unvani"
          name="sirket_unvani"
          value={sirketUnvani}
          onChange={(e) => setSirketUnvani(e.target.value)}
          placeholder="Örnek Yapım Ltd. Şti."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="sirket_adresi">
          Şirket adresi{" "}
          <span className="text-muted-foreground font-normal">(iş sözleşmesinde işveren adresi)</span>
        </Label>
        <Input
          id="sirket_adresi"
          name="sirket_adresi"
          value={sirketAdresi}
          onChange={(e) => setSirketAdresi(e.target.value)}
          placeholder="Örnek Mah. Örnek Sok. No:1 Kadıköy / İstanbul"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="mali_musavir_email">Mali müşavir e-posta adresi</Label>
        <Input
          id="mali_musavir_email"
          name="mali_musavir_email"
          type="email"
          value={maliMusavirEmail}
          onChange={(e) => setMaliMusavirEmail(e.target.value)}
          placeholder="ornek@muhasebe.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="isg_email">İSG uzmanının e-posta adresi</Label>
        <Input
          id="isg_email"
          name="isg_email"
          type="email"
          value={isgEmail}
          onChange={(e) => setIsgEmail(e.target.value)}
          placeholder="isg@osgb.com"
        />
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isg_cc_giris"
            checked={isgCcGiris}
            onChange={(e) => setIsgCcGiris(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--pen)]"
          />
          İş girişi maillerinde İSG uzmanını bilgiye (CC) ekle
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="gonderen_email">
          Gönderen e-posta adresi{" "}
          <span className="text-muted-foreground font-normal">
            (mail sunucunda tanımlı gerçek bir kutu olmalı, SMTP_USER ile aynı)
          </span>
        </Label>
        <Input
          id="gonderen_email"
          name="gonderen_email"
          type="email"
          value={gonderenEmail}
          onChange={(e) => setGonderenEmail(e.target.value)}
          placeholder="ik@sirketin.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="takip_email">
          Takip (CC) e-posta adresi{" "}
          <span className="text-muted-foreground font-normal">
            (gönderilen her mailin kopyası bu adrese de gider)
          </span>
        </Label>
        <Input
          id="takip_email"
          name="takip_email"
          type="email"
          value={takipEmail}
          onChange={(e) => setTakipEmail(e.target.value)}
          placeholder="ad@sirketin.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="asgari_ucret_aylik">
          Net aylık asgari ücret{" "}
          <span className="text-muted-foreground font-normal">
            (ücreti belirtilmemiş dönemlerin ödeme tutarı bundan hesaplanır)
          </span>
        </Label>
        <Input
          id="asgari_ucret_aylik"
          name="asgari_ucret_aylik"
          type="number"
          step="0.01"
          min="0"
          value={asgariUcret}
          onChange={(e) => setAsgariUcret(e.target.value)}
          placeholder="28075.50"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {kaydedildi && !error && (
        <p className="text-sm text-[var(--ok)]">Kaydedildi.</p>
      )}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </form>
  );
}
