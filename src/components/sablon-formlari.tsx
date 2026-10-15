"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { acikRizaAyari, kvkkBelgesiUret, sablonIndir, sablonSifirla, sablonYukle } from "@/app/sablon-actions";
import { Button } from "@/components/ui/button";
import { base64Indir } from "@/lib/indir-istemci";

/** Kişi sayfasında KVKK satırının yanında: metni çalışanın bilgileriyle indirir. */
export function KvkkIndirDugmesi({ kisiId, ad }: { kisiId: string; ad: "kvkk_aydinlatma" | "kvkk_acik_riza" }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <span className="flex flex-col items-end">
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await kvkkBelgesiUret(kisiId, ad);
            if (r.error !== null) return setError(r.error);
            base64Indir(r.base64, r.dosyaAdi);
          })
        }
      >
        <Download />
        {isPending ? "Hazırlanıyor…" : "Metni indir"}
      </Button>
      {error && <span className="mt-1 max-w-56 text-right text-xs text-destructive">{error}</span>}
    </span>
  );
}

export type SablonDurumu = {
  ad: string;
  etiket: string;
  alanlar: { ad: string; aciklama: string }[];
  ozel: { dosyaAdi: string; yuklendi: string } | null;
};

function SablonSatiri({ s }: { s: SablonDurumu }) {
  const [error, setError] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const indir = (ornek: boolean) =>
    startTransition(async () => {
      setError(null);
      const r = await sablonIndir(s.ad, ornek);
      if (r.error !== null) return setError(r.error);
      base64Indir(r.base64, ornek ? `ornek-${r.dosyaAdi}` : (s.ozel?.dosyaAdi ?? r.dosyaAdi));
    });

  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold">{s.etiket}</span>
        <span className="text-[13px] text-muted-foreground">
          {s.ozel ? (
            <>
              Kendi şablonun: <span className="text-foreground">{s.ozel.dosyaAdi}</span> ({s.ozel.yuklendi})
            </>
          ) : (
            "Örnek şablon kullanılıyor"
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="xs" variant="outline" disabled={isPending} onClick={() => indir(true)}>
          <Download />
          Örneği indir
        </Button>
        {s.ozel && (
          <>
            <Button type="button" size="xs" variant="outline" disabled={isPending} onClick={() => indir(false)}>
              <Download />
              Kendi şablonunu indir
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setMesaj(null);
                  const r = await sablonSifirla(s.ad);
                  setError(r.error);
                  if (!r.error) setMesaj("Örnek şablona dönüldü.");
                })
              }
            >
              Örneğe dön
            </Button>
          </>
        )}
      </div>
      <form
        action={(fd) =>
          startTransition(async () => {
            setError(null);
            setMesaj(null);
            fd.set("ad", s.ad);
            const r = await sablonYukle(fd);
            setError(r.error);
            if (!r.error) setMesaj(r.uyari ?? "Şablon kaydedildi; bundan sonra bu şablon kullanılır.");
          })
        }
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="file"
          name="dosya"
          accept=".docx"
          className="min-w-0 flex-1 text-xs text-muted-foreground file:mr-2 file:border file:border-border file:bg-transparent file:px-2 file:py-1 file:text-xs file:font-medium"
        />
        <Button type="submit" size="xs" variant="outline" disabled={isPending}>
          {isPending ? "Bekle…" : "Kendi şablonunu yükle"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Kullanılabilen alanlar:{" "}
        {s.alanlar.map((a, i) => (
          <span key={a.ad}>
            {i > 0 && " · "}
            <code className="font-mono">{`{${a.ad}}`}</code> {a.aciklama}
          </span>
        ))}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {mesaj && <p className="text-xs font-medium text-[var(--ok)]">{mesaj}</p>}
    </div>
  );
}

export function SablonAyarlari({ sablonlar, acikRiza }: { sablonlar: SablonDurumu[]; acikRiza: boolean }) {
  const [riza, setRiza] = useState(acikRiza);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer items-start gap-3 border-b border-border pb-4">
        <input
          type="checkbox"
          checked={riza}
          disabled={isPending}
          onChange={(e) => {
            const yeni = e.target.checked;
            setRiza(yeni);
            startTransition(async () => {
              const r = await acikRizaAyari(yeni);
              setError(r.error);
              if (r.error) setRiza(!yeni);
            });
          }}
          className="mt-1 size-4 accent-[var(--pen)]"
        />
        <span className="flex flex-col">
          <span className="font-bold">Açık rıza beyanı kullan</span>
          <span className="text-sm text-muted-foreground">
            Çalışanların fotoğraf, görüntü ve ses kayıtlarını tanıtım ya da yayın için kullanıyorsan aç. Çalışan
            dosyasında isteğe bağlı bir satır olarak görünür, eksik sayılmaz. Bordro, SGK ve İSG işlemleri için
            açık rıza gerekmez; onlar aydınlatma metniyle karşılanır.
          </span>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </span>
      </label>
      {sablonlar.map((s) => (
        <SablonSatiri key={s.ad} s={s} />
      ))}
    </div>
  );
}
