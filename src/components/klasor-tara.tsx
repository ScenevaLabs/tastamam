"use client";

import { useState, useTransition } from "react";
import { RefreshCw, FolderInput } from "lucide-react";
import {
  kisiKlasoruTara,
  taramaSecimleriniUygula,
  kisiKlasorunuTasiAction,
  type KlasorTaramaSonucu,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  KOK_BELGE_ETIKETLERI,
  DONEM_BELGE_ETIKETLERI,
  type KisiBelgeTipi,
  type IsGirisiBelgeTipi,
} from "@/lib/types";

/** Kişi pasife geçtiğinde depodaki klasörünü AKTİF'ten PASİF'e taşımak
 *  için — toplu iş çıkışı sonrasında otomatik denenir, ama eski/kaçırılmış
 *  durumları telafi etmek için kişi sayfasında elle de tetiklenebilir
 *  (29 Ağustos 2026). */
export function PasifeTasiButonu({ kisiId }: { kisiId: string }) {
  const [sonuc, setSonuc] = useState<{ error: string | null; mesaj?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function tasi() {
    setSonuc(null);
    startTransition(async () => {
      const r = await kisiKlasorunuTasiAction(kisiId);
      setSonuc(r);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={tasi}
        disabled={isPending}
        className="self-start"
      >
        <FolderInput className={isPending ? "animate-pulse" : undefined} />
        {isPending ? "Taşınıyor..." : "Klasörü PASİF'e taşı"}
      </Button>
      {sonuc?.error && <p className="text-sm text-red-600">{sonuc.error}</p>}
      {sonuc && !sonuc.error && (
        <p className="text-sm text-[var(--ok)]">{sonuc.mesaj}</p>
      )}
    </div>
  );
}

// Seçim değeri: "kok:{tip}" ya da "donem:{isGirisiId}:{tip}". Eski (tarih
// klasörsüz) isimlendirmeli kişilerde dönem belgeleri de kök klasörde
// durabiliyor — bu yüzden sorulan her dosyaya hem kök hem tüm dönem
// seçenekleri birlikte sunuluyor (29 Ağustos 2026).
function AtamaSecimi({
  sonuc,
  deger,
  onDegistir,
}: {
  sonuc: KlasorTaramaSonucu;
  deger: string;
  onDegistir: (deger: string) => void;
}) {
  if (sonuc.kokKalanTipleri.length === 0 && sonuc.donemKalanTipleri.length === 0) return null;
  return (
    <select
      className="max-w-full rounded-md border border-border bg-background px-1.5 py-1 text-xs"
      value={deger}
      onChange={(e) => onDegistir(e.target.value)}
    >
      <option value="">Atlama (dokunma)</option>
      {sonuc.kokKalanTipleri.length > 0 && (
        <optgroup label="Kök belgeler">
          {sonuc.kokKalanTipleri.map((tip) => (
            <option key={tip} value={`kok:${tip}`}>
              {KOK_BELGE_ETIKETLERI[tip as KisiBelgeTipi]}
            </option>
          ))}
        </optgroup>
      )}
      {sonuc.donemKalanTipleri.map((d) => (
        <optgroup key={d.isGirisiId} label={`Dönem: ${d.donemEtiketi}`}>
          {d.tipler.map((tip) => (
            <option key={tip} value={`donem:${d.isGirisiId}:${tip}`}>
              {DONEM_BELGE_ETIKETLERI[tip as IsGirisiBelgeTipi]}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function Baslik({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{children}</p>
  );
}

/** Klasörü tarar; standart adlı ve içeriğinden tanınan belgeler otomatik
 *  adlandırılıp eksik listesinden düşer, sadece emin olunamayanlar sorulur
 *  (22 Eylül 2026). */
export function KlasorTaraButonu({ kisiId }: { kisiId: string }) {
  const [sonuc, setSonuc] = useState<KlasorTaramaSonucu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  // Sorulan her dosya için seçilen atama, dosya yolu → değer.
  const [secimler, setSecimler] = useState<Record<string, string>>({});
  const [uygulaSonucu, setUygulaSonucu] = useState<{ adet: number; hatalar: string[] } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const [uygulaPending, startUygulaTransition] = useTransition();

  function tara() {
    setHata(null);
    setSonuc(null);
    setUygulaSonucu(null);
    startTransition(async () => {
      const r = await kisiKlasoruTara(kisiId);
      if (r.error !== null) {
        setHata(r.error);
        return;
      }
      setSonuc(r.sonuc);
      setSecimler(Object.fromEntries(r.sonuc.sorulacak.map((s) => [s.yol, s.tahmin])));
    });
  }

  const secilenler = Object.entries(secimler)
    .filter(([, atama]) => !!atama)
    .map(([yol, atama]) => ({ yol, atama }));

  function uygula() {
    startUygulaTransition(async () => {
      const r = await taramaSecimleriniUygula(kisiId, secilenler);
      if (r.error) {
        setHata(r.error);
        return;
      }
      setUygulaSonucu({ adet: secilenler.length - r.hatalar.length, hatalar: r.hatalar });
      setSonuc((prev) => (prev ? { ...prev, sorulacak: [] } : prev));
    });
  }

  const hicBirSeyYok =
    sonuc &&
    sonuc.islenen.length === 0 &&
    sonuc.sorulacak.length === 0 &&
    sonuc.zatenVar.length === 0 &&
    sonuc.hatali.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={tara}
        disabled={isPending}
        className="self-start"
      >
        <RefreshCw className={isPending ? "animate-spin" : undefined} />
        {isPending ? "Klasör taranıyor, belgeler okunuyor..." : "Klasörü tara"}
      </Button>

      {hata && <p className="text-sm text-red-600">{hata}</p>}

      {sonuc && hicBirSeyYok && (
        <p className="text-sm text-muted-foreground">Yeni bir şey bulunamadı.</p>
      )}

      {sonuc && !hicBirSeyYok && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          {sonuc.islenen.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Baslik>Otomatik işlendi ({sonuc.islenen.length})</Baslik>
              {sonuc.islenen.map((e, i) => (
                <div key={i} className="text-sm">
                  <span className="text-[var(--ok)]">✓</span>{" "}
                  <span className="font-medium">{e.etiket}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {e.dosyaAdi}
                    {e.yeniAd && e.yeniAd !== e.dosyaAdi ? ` → ${e.yeniAd}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {sonuc.zatenVar.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-border pt-3">
              <Baslik>Zaten var, dokunulmadı</Baslik>
              {sonuc.zatenVar.map((e, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  {e.dosyaAdi} — {e.etiket} olarak tanındı, bu belge zaten işaretli
                </div>
              ))}
            </div>
          )}

          {sonuc.hatali.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-border pt-3">
              <Baslik>İşlenemedi</Baslik>
              {sonuc.hatali.map((e, i) => (
                <div key={i} className="text-xs text-red-600">
                  {e.dosyaAdi}: {e.hata}
                </div>
              ))}
            </div>
          )}

          {sonuc.sorulacak.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <Baslik>Emin olamadıklarım ({sonuc.sorulacak.length})</Baslik>
              {sonuc.sorulacak.map((s) => (
                <div key={s.yol} className="flex flex-col gap-1 text-xs">
                  <span className="font-medium">{s.dosyaAdi}</span>
                  <span className="text-muted-foreground">{s.neden}</span>
                  <AtamaSecimi
                    sonuc={sonuc}
                    deger={secimler[s.yol] ?? ""}
                    onDegistir={(deger) => setSecimler((prev) => ({ ...prev, [s.yol]: deger }))}
                  />
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                onClick={uygula}
                disabled={uygulaPending || secilenler.length === 0}
                className="self-start"
              >
                {uygulaPending
                  ? "Uygulanıyor..."
                  : `Seçilenleri adlandır ve işaretle (${secilenler.length})`}
              </Button>
            </div>
          )}

          {sonuc.kalan > 0 && (
            <p className="text-xs text-muted-foreground">
              {sonuc.kalan} dosya daha var, süre sınırı yüzünden bu turda okunmadı — tekrar tara.
            </p>
          )}
        </div>
      )}

      {uygulaSonucu && (
        <div className="flex flex-col gap-1">
          {uygulaSonucu.adet > 0 && (
            <p className="text-sm text-[var(--ok)]">{uygulaSonucu.adet} dosya işlendi.</p>
          )}
          {uygulaSonucu.hatalar.map((h, i) => (
            <p key={i} className="text-xs text-red-600">
              {h}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
