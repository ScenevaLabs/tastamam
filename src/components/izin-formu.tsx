"use client";

import { useState, useTransition } from "react";
import { izinKaydet } from "@/app/kayit-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TarihInput } from "@/components/tarih-input";
import { YILLIK_IZIN, isbasiTarihi, izinGunSay, yolIzniGunleri } from "@/lib/mevzuat";
import { formatTarih } from "@/lib/utils";

export type IzinKisisi = { id: string; adSoyad: string; kalan: number | null };

const GUN_ADI = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "UTC" });

export function IzinFormu({ kisiler }: { kisiler: IzinKisisi[] }) {
  const [kisiId, setKisiId] = useState("");
  const [bas, setBas] = useState("");
  const [bit, setBit] = useState("");
  const [yol, setYol] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [isPending, startTransition] = useTransition();

  const gecerli = bas && bit && bit >= bas;
  const hesap = gecerli ? izinGunSay(bas, bit) : null;
  const yolGunleri = gecerli ? yolIzniGunleri(bit, Number(yol)) : [];
  const isbasi = gecerli ? isbasiTarihi(bit, Number(yol)) : null;
  const kisi = kisiler.find((k) => k.id === kisiId);

  // Bir alan değişince önceki gönderimin hata/başarı mesajı artık geçerli değil.
  function degistir<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setError(null);
      setKaydedildi(false);
    };
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setKaydedildi(false);
    startTransition(async () => {
      const r = await izinKaydet(formData);
      if (r.error) {
        setError(r.error);
        return;
      }
      setKaydedildi(true);
      setBas("");
      setBit("");
      setYol("0");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="kisi_id">Çalışan</Label>
        <select
          id="kisi_id"
          name="kisi_id"
          value={kisiId}
          onChange={(e) => degistir(setKisiId)(e.target.value)}
          className="h-10 border border-input bg-transparent px-2 text-sm"
        >
          <option value="">Seç</option>
          {kisiler.map((k) => (
            <option key={k.id} value={k.id}>
              {k.adSoyad} · {k.kalan === null ? "henüz hak yok" : `${k.kalan} gün kaldı`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="baslangic">İlk gün</Label>
          <TarihInput id="baslangic" name="baslangic" value={bas} onChange={(e) => degistir(setBas)(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bitis">Son gün</Label>
          <TarihInput id="bitis" name="bitis" value={bit} min={bas || undefined} onChange={(e) => degistir(setBit)(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="yol_izni_gun">
          Yol izni <span className="font-normal text-muted-foreground">(ücretsiz, en çok {YILLIK_IZIN.yolIzniEnFazlaGun.deger} gün)</span>
        </Label>
        <select
          id="yol_izni_gun"
          name="yol_izni_gun"
          value={yol}
          onChange={(e) => degistir(setYol)(e.target.value)}
          className="h-10 w-24 border border-input bg-transparent px-2 text-sm"
        >
          {[0, 1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "Yok" : `${n} gün`}
            </option>
          ))}
        </select>
      </div>

      {hesap && isbasi && (
        <p className="border-l-[3px] border-primary bg-accent/50 px-3 py-2 text-sm">
          Bu aralık <strong>{hesap.gun} gün</strong> izinden düşer.
          {hesap.sayilmayan.length > 0 &&
            ` ${hesap.sayilmayan.map((s) => `${formatTarih(s.tarih, false)} ${s.ad}`).join(", ")} olduğu için sayılmadı.`}{" "}
          Pazarlar sayılmaz.
          {yolGunleri.length > 0 &&
            ` Ücretsiz yol izni: ${yolGunleri.map((g) => formatTarih(g, false)).join(", ")} (puantajda Üİ).`}{" "}
          İşbaşı {formatTarih(isbasi)} {GUN_ADI.format(new Date(`${isbasi}T00:00:00Z`))}.
          {kisi && kisi.kalan !== null && hesap.gun > kisi.kalan && (
            <span className="mt-1 block font-medium text-[var(--warn)]">
              Kalan hakkı {kisi.kalan} gün; fazlası avans izin olarak eksiye düşer.
            </span>
          )}
          {hesap.gun < YILLIK_IZIN.bolumEnAzGun.deger && (
            <span className="mt-1 block text-muted-foreground">
              İzin bölünerek kullanılıyorsa parçalardan biri en az {YILLIK_IZIN.bolumEnAzGun.deger} gün olmalı (işçiyle
              anlaşarak).
            </span>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending || !kisiId || !gecerli || hesap?.gun === 0}>
          {isPending ? "Kaydediliyor…" : "İzni kaydet"}
        </Button>
        {kaydedildi && (
          <span className="text-sm font-bold text-[var(--ok)]">Kaydedildi. Formu aşağıdan indirip imzalat.</span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
