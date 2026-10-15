"use client";

import { useState, useTransition } from "react";
import {
  topluIsGirisiOlustur,
  topluGirisMailiGonder,
  type TopluGirisSatiri,
  type TopluSonuc,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TarihInput } from "@/components/tarih-input";
import { Label } from "@/components/ui/label";
import { KisiCombobox } from "@/components/kisi-combobox";
import { MeslekCombobox } from "@/components/meslek-combobox";
import type { Kisi, UcretPeriyodu, UcretTipi } from "@/lib/types";

type Meslek = { kod: string; isim: string };

type Satir = {
  localId: string;
  mode: "mevcut" | "yeni";
  selectedKisi: Kisi | null;
  adSoyad: string;
  tcKimlikNo: string;
  selectedMeslek: Meslek | null;
  girisTarihi: string;
  ucretTutari: string;
  ucretPeriyodu: UcretPeriyodu;
  ucretTipi: UcretTipi;
};

function bosSatir(kisilerVar: boolean): Satir {
  return {
    localId: crypto.randomUUID(),
    mode: kisilerVar ? "mevcut" : "yeni",
    selectedKisi: null,
    adSoyad: "",
    tcKimlikNo: "",
    selectedMeslek: null,
    girisTarihi: "",
    ucretTutari: "",
    ucretPeriyodu: "gunluk",
    ucretTipi: "net",
  };
}

function satirGecerliMi(s: Satir): boolean {
  if (!s.girisTarihi) return false;
  if (!s.selectedMeslek) return false;
  if (s.mode === "mevcut") return !!s.selectedKisi;
  return !!(s.adSoyad && s.tcKimlikNo.length === 11);
}

export function SecimGrubu<T extends string>({
  secenekler,
  deger,
  onDegistir,
}: {
  secenekler: [T, string][];
  deger: T;
  onDegistir: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {secenekler.map(([v, etiket]) => (
        <Button
          key={v}
          type="button"
          size="xs"
          variant={deger === v ? "default" : "outline"}
          onClick={() => onDegistir(v)}
        >
          {etiket}
        </Button>
      ))}
    </div>
  );
}

export function TopluIsGirisiForm({ kisiler }: { kisiler: Kisi[] }) {
  const [satirlar, setSatirlar] = useState<Satir[]>([bosSatir(kisiler.length > 0)]);
  const [asama, setAsama] = useState<"duzenleniyor" | "olusturuldu">("duzenleniyor");
  const [sonuclar, setSonuclar] = useState<TopluSonuc[]>([]);
  const [genelHata, setGenelHata] = useState<string | null>(null);
  const [mailHata, setMailHata] = useState<string | null>(null);
  const [mailGonderildi, setMailGonderildi] = useState(false);
  const [isPending, startTransition] = useTransition();

  function satiriGuncelle(localId: string, patch: Partial<Satir>) {
    setSatirlar((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)));
  }

  function satirEkle() {
    setSatirlar((prev) => [...prev, bosSatir(kisiler.length > 0)]);
  }

  function satirSil(localId: string) {
    setSatirlar((prev) => prev.filter((s) => s.localId !== localId));
  }

  const gecerliSatirlar = satirlar.filter(satirGecerliMi);
  const hepsiGecerli = satirlar.length > 0 && gecerliSatirlar.length === satirlar.length;

  function onayla() {
    setGenelHata(null);
    if (!hepsiGecerli) {
      setGenelHata("Tüm satırları eksiksiz doldur (kişi/bilgiler + meslek + giriş tarihi).");
      return;
    }

    const payload: TopluGirisSatiri[] = satirlar.map((s) => ({
      kisiId: s.mode === "mevcut" ? (s.selectedKisi?.id ?? null) : null,
      adSoyad: s.mode === "yeni" ? s.adSoyad : (s.selectedKisi?.ad_soyad ?? null),
      tcKimlikNo: s.mode === "yeni" ? s.tcKimlikNo : null,
      meslekKodu: s.selectedMeslek?.kod ?? null,
      meslekAdi: s.selectedMeslek?.isim ?? null,
      girisTarihi: s.girisTarihi,
      ucretTutari: s.ucretTutari ? Number(s.ucretTutari) : null,
      ucretPeriyodu: s.ucretPeriyodu,
      ucretTipi: s.ucretTipi,
    }));

    startTransition(async () => {
      const result = await topluIsGirisiOlustur(payload);
      setSonuclar(result.sonuclar);
      setAsama("olusturuldu");
    });
  }

  function mailAt() {
    setMailHata(null);
    const basariliIds = sonuclar.filter((s) => s.ok && s.isGirisiId).map((s) => s.isGirisiId!);
    startTransition(async () => {
      const result = await topluGirisMailiGonder(basariliIds);
      if (result.error) {
        setMailHata(result.error);
        return;
      }
      setMailGonderildi(true);
    });
  }

  if (asama === "olusturuldu") {
    const basarili = sonuclar.filter((s) => s.ok);
    const basarisiz = sonuclar.filter((s) => !s.ok);

    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-sm font-bold">Oluşturulan iş girişleri</h2>
          <ul className="flex flex-col gap-1.5">
            {basarili.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--ok)]">✓</span> {s.adSoyad}
              </li>
            ))}
            {basarisiz.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--warn)]">✕</span> {s.adSoyad}
                <span className="text-xs text-muted-foreground">— {s.hata}</span>
              </li>
            ))}
          </ul>
        </div>

        {basarili.length > 0 && (
          <div className="flex flex-col gap-2">
            <Button onClick={mailAt} disabled={isPending || mailGonderildi} className="self-start">
              {isPending
                ? "Gönderiliyor..."
                : mailGonderildi
                  ? "Mail gönderildi"
                  : `Muhasebeye mail at (${basarili.length} kişi)`}
            </Button>
            {mailHata && <p className="text-sm text-red-600">{mailHata}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {satirlar.map((satir, index) => (
          <div key={satir.localId} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Kişi {index + 1}</span>
              {satirlar.length > 1 && (
                <button
                  type="button"
                  onClick={() => satirSil(satir.localId)}
                  className="text-xs text-muted-foreground hover:text-red-600"
                >
                  Kaldır
                </button>
              )}
            </div>

            <div className="mb-3 flex gap-2">
              <Button
                type="button"
                variant={satir.mode === "mevcut" ? "default" : "outline"}
                size="sm"
                onClick={() => satiriGuncelle(satir.localId, { mode: "mevcut" })}
              >
                Mevcut kişi
              </Button>
              <Button
                type="button"
                variant={satir.mode === "yeni" ? "default" : "outline"}
                size="sm"
                onClick={() => satiriGuncelle(satir.localId, { mode: "yeni" })}
              >
                Yeni kişi
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {satir.mode === "mevcut" ? (
                <div className="flex flex-col gap-2">
                  <Label>Kişi</Label>
                  <KisiCombobox
                    kisiler={kisiler}
                    value={satir.selectedKisi}
                    onChange={(k) =>
                      satiriGuncelle(satir.localId, {
                        selectedKisi: k,
                        // son kullanılan meslekle dolu gelir, istenirse değiştirilir
                        selectedMeslek: k.meslek_kodu ? { kod: k.meslek_kodu, isim: k.meslek_adi } : null,
                      })
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <Label>Ad Soyad</Label>
                    <Input
                      value={satir.adSoyad}
                      onChange={(e) => satiriGuncelle(satir.localId, { adSoyad: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>TC Kimlik No</Label>
                    <Input
                      value={satir.tcKimlikNo}
                      inputMode="numeric"
                      minLength={11}
                      maxLength={11}
                      onChange={(e) => satiriGuncelle(satir.localId, { tcKimlikNo: e.target.value })}
                    />
                  </div>
                </>
              )}
              {(satir.mode === "yeni" || satir.selectedKisi) && (
                <div className="flex flex-col gap-2">
                  <Label>Meslek</Label>
                  <MeslekCombobox
                    value={satir.selectedMeslek}
                    onChange={(m) => satiriGuncelle(satir.localId, { selectedMeslek: m })}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Giriş Tarihi</Label>
                  <TarihInput
                    value={satir.girisTarihi}
                    onChange={(e) => satiriGuncelle(satir.localId, { girisTarihi: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>
                    Ücret{" "}
                    <span className="text-muted-foreground font-normal">(boşsa asgari ücret)</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={satir.ucretTutari}
                    onChange={(e) => satiriGuncelle(satir.localId, { ucretTutari: e.target.value })}
                  />
                </div>
              </div>
              {satir.ucretTutari && (
                <div className="flex flex-wrap gap-4">
                  <SecimGrubu
                    secenekler={[
                      ["gunluk", "Günlük"],
                      ["aylik", "Aylık"],
                    ]}
                    deger={satir.ucretPeriyodu}
                    onDegistir={(v) => satiriGuncelle(satir.localId, { ucretPeriyodu: v })}
                  />
                  <SecimGrubu
                    secenekler={[
                      ["net", "Net"],
                      ["brut", "Brüt"],
                    ]}
                    deger={satir.ucretTipi}
                    onDegistir={(v) => satiriGuncelle(satir.localId, { ucretTipi: v })}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={satirEkle} className="self-start">
        + Kişi ekle
      </Button>

      {genelHata && <p className="text-sm text-red-600">{genelHata}</p>}
      <Button onClick={onayla} disabled={isPending} className="self-start">
        {isPending ? "Kaydediliyor..." : `Onayla (${satirlar.length} kişi)`}
      </Button>
    </div>
  );
}
