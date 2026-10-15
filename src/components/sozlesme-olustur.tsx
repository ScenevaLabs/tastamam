"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { sozlesmeUret } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { birGunOnce, donemGunSayisi } from "@/lib/utils";
import { base64Indir } from "@/lib/indir-istemci";

function ucretMetni(tutar: number | null): string {
  if (tutar == null) return "";
  return (
    tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL"
  );
}

/** Sözleşmeye yazılacak varsayılan ücret: günlük ücretli dönemde günlük
 *  tutar × çalışılan gün (başlama-bitiş dahil) — sözleşme dönemin toplam
 *  net ücretini yazar (9 Ekim 2026, kullanıcı kuralı). Aylık ya da eski
 *  "toplam" kayıtlarda tutar olduğu gibi. Bitiş tarihi yoksa günlük tutar. */
function varsayilanUcret(
  tutar: number | null,
  periyot: "gunluk" | "aylik" | null,
  baslama: string,
  bitis: string,
): string {
  if (tutar == null) return "";
  if (periyot === "gunluk" && baslama && bitis) {
    return ucretMetni(tutar * donemGunSayisi(baslama, bitis));
  }
  return ucretMetni(tutar);
}

export function SozlesmeOlustur({
  kisiId,
  meslekAdi,
  adresBaslangic,
  ucretBaslangic,
  ucretPeriyodu,
  girisTarihi,
  cikisTarihi,
}: {
  kisiId: string;
  meslekAdi: string;
  adresBaslangic: string | null;
  ucretBaslangic: number | null;
  ucretPeriyodu: "gunluk" | "aylik" | null;
  girisTarihi: string;
  cikisTarihi: string | null;
}) {
  const [acik, setAcik] = useState(false);
  // Çıkış tarihi girilmiş dönem için belirli, açık dönem için belirsiz süreli önerilir.
  const [tur, setTur] = useState<"belirli" | "belirsiz">(cikisTarihi ? "belirli" : "belirsiz");
  const [adres, setAdres] = useState(adresBaslangic ?? "");
  const [meslek, setMeslek] = useState(meslekAdi);
  const [baslamaTarihi, setBaslamaTarihi] = useState(girisTarihi);
  const [bitisTarihi, setBitisTarihi] = useState(cikisTarihi ?? "");
  // Elle düzenlenene kadar ücret tarihlerle birlikte yeniden hesaplanır.
  const [ucretElle, setUcretElle] = useState<string | null>(null);
  const ucret =
    ucretElle ?? varsayilanUcret(ucretBaslangic, ucretPeriyodu, baslamaTarihi, bitisTarihi);
  const [imzaTarihi, setImzaTarihi] = useState(birGunOnce(girisTarihi));
  const [error, setError] = useState<string | null>(null);
  const [tamamlandi, setTamamlandi] = useState(false);
  const [isPending, startTransition] = useTransition();

  function olustur() {
    setError(null);
    setTamamlandi(false);
    const fd = new FormData();
    fd.set("kisi_id", kisiId);
    fd.set("adres", adres);
    fd.set("meslek", meslek);
    fd.set("ucret", ucret);
    fd.set("baslama_tarihi", baslamaTarihi);
    fd.set("bitis_tarihi", bitisTarihi);
    fd.set("imza_tarihi", imzaTarihi);
    fd.set("tur", tur);
    startTransition(async () => {
      const sonuc = await sozlesmeUret(fd);
      if (sonuc.error !== null) {
        setError(sonuc.error);
        return;
      }
      base64Indir(sonuc.base64, sonuc.dosyaAdi);
      setTamamlandi(true);
    });
  }

  if (!acik) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setAcik(true)}
        className="self-start"
      >
        <FileText />
        Sözleşme oluştur
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sozlesme-tur">Sözleşme türü</Label>
        <select
          id="sozlesme-tur"
          value={tur}
          onChange={(e) => setTur(e.target.value as "belirli" | "belirsiz")}
          className="h-9 border border-input bg-transparent px-2 text-sm"
        >
          <option value="belirli">Belirli süreli (bitiş tarihi var)</option>
          <option value="belirsiz">Belirsiz süreli</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sozlesme-meslek">Meslek</Label>
          <Input id="sozlesme-meslek" value={meslek} onChange={(e) => setMeslek(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sozlesme-ucret">Ücret</Label>
          <Input
            id="sozlesme-ucret"
            value={ucret}
            onChange={(e) => setUcretElle(e.target.value)}
            placeholder="ör. 25.000,00 TL"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sozlesme-adres">Adres</Label>
        <Input
          id="sozlesme-adres"
          value={adres}
          onChange={(e) => setAdres(e.target.value)}
          placeholder="İkametgah adresi"
        />
      </div>
      <div className={`grid gap-3 ${tur === "belirli" ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sozlesme-imza">İmza tarihi</Label>
          <Input
            id="sozlesme-imza"
            type="date"
            value={imzaTarihi}
            onChange={(e) => setImzaTarihi(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sozlesme-baslama">Başlama</Label>
          <Input
            id="sozlesme-baslama"
            type="date"
            value={baslamaTarihi}
            onChange={(e) => setBaslamaTarihi(e.target.value)}
          />
        </div>
        {tur === "belirli" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sozlesme-bitis">Bitiş</Label>
            <Input
              id="sozlesme-bitis"
              type="date"
              value={bitisTarihi}
              onChange={(e) => setBitisTarihi(e.target.value)}
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {tamamlandi && !error && (
        <p className="text-sm text-[var(--ok)]">
          Oluşturuldu ve indirildi. Kontrol edip imzalat, imzalı halini kişinin dosyasına yükle.
        </p>
      )}

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={olustur} disabled={isPending}>
          {isPending ? "Oluşturuluyor..." : "Oluştur ve indir"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}
