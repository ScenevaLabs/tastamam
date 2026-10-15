"use client";

import { useRef, useState, useTransition } from "react";
import { Download } from "lucide-react";
import {
  durumGuncelle,
  durumKaydet,
  durumSil,
  kisiAyrintiKaydet,
  zimmetEkle,
  zimmetIade,
  zimmetTutanagiUret,
} from "@/app/durum-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TarihInput } from "@/components/tarih-input";
import { belgeYukle } from "@/lib/belge-yukle";
import { base64Indir } from "@/lib/indir-istemci";
import { DURUM_BILGI, DURUM_TURLERI, type DurumTuru, type KisiDurum } from "@/lib/durum";
import { formatTarih } from "@/lib/utils";

const SECIM = "h-9 border border-input bg-transparent px-2 text-sm";

function useEylem() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const calistir = (f: () => Promise<{ error: string | null }>, sonra?: () => void) =>
    startTransition(async () => {
      const r = await f();
      setError(r.error);
      if (!r.error) sonra?.();
    });
  return { error, isPending, calistir };
}

export function KisiAyrintiFormu({
  kisiId,
  engelli,
  kismiSureli,
  besKatilim,
  besCayma,
  besCaymaSonGun,
  besGerekli,
}: {
  kisiId: string;
  engelli: boolean;
  kismiSureli: boolean;
  besKatilim: string | null;
  besCayma: string | null;
  besCaymaSonGun: string | null;
  besGerekli: boolean;
}) {
  const { error, isPending, calistir } = useEylem();
  const [kaydedildi, setKaydedildi] = useState(false);
  return (
    <form
      action={(fd) => {
        fd.set("kisi_id", kisiId);
        setKaydedildi(false);
        calistir(() => kisiAyrintiKaydet(fd), () => setKaydedildi(true));
      }}
      className="flex flex-col gap-3 px-4 py-3 sm:px-5"
    >
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="engelli" defaultChecked={engelli} className="size-4 accent-[var(--pen)]" />
          Engelli çalışan <span className="text-muted-foreground">(kontenjan, md. 30)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="kismi_sureli" defaultChecked={kismiSureli} className="size-4 accent-[var(--pen)]" />
          Kısmi süreli <span className="text-muted-foreground">(fazla çalışma yaptırılmaz)</span>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span>BES&apos;e dahil edildiği gün</span>
          <TarihInput name="bes_katilim" defaultValue={besKatilim ?? undefined} className="max-w-[170px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Caydığı gün</span>
          <TarihInput name="bes_cayma" defaultValue={besCayma ?? undefined} className="max-w-[170px]" />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        {kaydedildi && !error && <span className="text-sm font-bold text-[var(--ok)]">Kaydedildi</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        {besGerekli && !besKatilim
          ? "45 yaşından küçük çalışan işe başlayınca BES'e otomatik dahil edilir; dahil edildiği günü gir. "
          : ""}
        {besCaymaSonGun && !besCayma ? `Cayma süresi ${formatTarih(besCaymaSonGun)} tarihinde biter. ` : ""}
        Kesinti bordroda yapılır. <span className="font-mono">4632 ek md. 2</span>
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function DurumSatiri({ d, kisiId }: { d: KisiDurum; kisiId: string }) {
  const bilgi = DURUM_BILGI[d.tur];
  const { error, isPending, calistir } = useEylem();
  const [oran, setOran] = useState(0);
  const girdi = useRef<HTMLInputElement>(null);
  const kapatilabilir = d.tur === "kosul_degisikligi" ? !d.tamamlandi : !!bilgi.bitis && !d.bitis;
  return (
    <div className="flex flex-col gap-1.5 border-b border-border/60 px-4 py-3 last:border-b-0 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{bilgi.etiket}</span>
        <span className="font-mono text-[13px] text-muted-foreground">
          {formatTarih(d.baslangic)}
          {d.bitis && ` → ${formatTarih(d.bitis)}`}
          {d.tamamlandi && ` · kabul ${formatTarih(d.tamamlandi)}`}
        </span>
      </div>
      {d.notu && <p className="text-[13px] text-muted-foreground">{d.notu}</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {d.dosya_adi ? (
          <span className="font-medium text-[var(--ok)]">Belge yüklendi</span>
        ) : (
          <>
            <input ref={girdi} type="file" className="min-w-0 max-w-56 text-xs text-muted-foreground file:mr-2 file:border file:border-border file:bg-transparent file:px-2 file:py-1 file:text-xs" />
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                const dosya = girdi.current?.files?.[0];
                if (!dosya) return;
                calistir(() => belgeYukle({ tur: "durum", kisiId, durumId: d.id }, dosya, setOran));
              }}
            >
              {isPending ? `%${Math.round(oran * 100)}` : "Belgeyi yükle"}
            </Button>
          </>
        )}
        {kapatilabilir && (
          <form
            action={(fd) => {
              fd.set("id", d.id);
              fd.set("kisi_id", kisiId);
              fd.set("alan", d.tur === "kosul_degisikligi" ? "tamamlandi" : "bitis");
              calistir(() => durumGuncelle(fd));
            }}
            className="flex items-center gap-1.5"
          >
            <span>{d.tur === "kosul_degisikligi" ? "Yazılı kabul günü" : bilgi.bitis}</span>
            <TarihInput name="tarih" className="max-w-[160px]" />
            <Button type="submit" size="xs" variant="outline" disabled={isPending}>
              Kaydet
            </Button>
          </form>
        )}
        <form
          action={(fd) => {
            fd.set("id", d.id);
            fd.set("kisi_id", kisiId);
            calistir(() => durumSil(fd));
          }}
        >
          <Button type="submit" size="xs" variant="ghost" disabled={isPending}>
            Kaydı sil
          </Button>
        </form>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function DurumBolumu({ kisiId, durumlar }: { kisiId: string; durumlar: KisiDurum[] }) {
  const [tur, setTur] = useState<DurumTuru>("gebelik");
  const [acik, setAcik] = useState(false);
  const { error, isPending, calistir } = useEylem();
  const bilgi = DURUM_BILGI[tur];
  return (
    <>
      {durumlar.map((d) => (
        <DurumSatiri key={d.id} d={d} kisiId={kisiId} />
      ))}
      {durumlar.length === 0 && !acik && (
        <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">Kayıt yok.</p>
      )}
      <div className="px-4 py-3 sm:px-5">
        {!acik ? (
          <button type="button" onClick={() => setAcik(true)} className="text-[13px] text-primary hover:underline">
            Durum ekle
          </button>
        ) : (
          <form
            action={(fd) => {
              fd.set("kisi_id", kisiId);
              calistir(() => durumKaydet(fd), () => setAcik(false));
            }}
            className="flex flex-col gap-2 text-sm"
          >
            <select name="tur" value={tur} onChange={(e) => setTur(e.target.value as DurumTuru)} className={SECIM}>
              {DURUM_TURLERI.map((t) => (
                <option key={t} value={t}>
                  {DURUM_BILGI[t].etiket}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {bilgi.aciklama} <span className="font-mono">{bilgi.dayanak}</span>
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span>{bilgi.baslangic}</span>
                <TarihInput name="baslangic" required className="max-w-[170px]" />
              </label>
              {bilgi.bitis && (
                <label className="flex flex-col gap-1">
                  <span>{bilgi.bitis}</span>
                  <TarihInput name="bitis" className="max-w-[170px]" />
                </label>
              )}
            </div>
            <Input name="notu" placeholder="Not (isteğe bağlı)" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAcik(false)}>
                Vazgeç
              </Button>
            </div>
          </form>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </>
  );
}

export type ZimmetSatiri = {
  id: string;
  esya: string;
  seri_no: string | null;
  verilis: string;
  iade: string | null;
};

export function ZimmetBolumu({ kisiId, zimmetler }: { kisiId: string; zimmetler: ZimmetSatiri[] }) {
  const { error, isPending, calistir } = useEylem();
  const [acik, setAcik] = useState(false);
  const iadeEdilmemis = zimmetler.filter((z) => !z.iade);
  return (
    <>
      {zimmetler.length === 0 && !acik && <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">Zimmet yok.</p>}
      {zimmetler.map((z) => (
        <div key={z.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 text-sm sm:px-5">
          <span>
            <span className="font-medium">{z.esya}</span>
            {z.seri_no && <span className="font-mono text-[12px] text-muted-foreground"> · {z.seri_no}</span>}
            <span className="font-mono text-[12px] text-muted-foreground"> · {formatTarih(z.verilis)}</span>
          </span>
          {z.iade ? (
            <span className="text-[13px] font-medium text-[var(--ok)]">İade {formatTarih(z.iade)}</span>
          ) : (
            <form
              action={(fd) => {
                fd.set("id", z.id);
                fd.set("kisi_id", kisiId);
                calistir(() => zimmetIade(fd));
              }}
              className="flex items-center gap-1.5"
            >
              <TarihInput name="iade" className="max-w-[150px]" />
              <Button type="submit" size="xs" variant="outline" disabled={isPending}>
                İade alındı
              </Button>
            </form>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        {!acik && (
          <button type="button" onClick={() => setAcik(true)} className="text-[13px] text-primary hover:underline">
            Zimmet ekle
          </button>
        )}
        {iadeEdilmemis.length > 0 && !acik && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              calistir(async () => {
                const r = await zimmetTutanagiUret(kisiId);
                if (r.error !== null) return { error: r.error };
                base64Indir(r.base64, r.dosyaAdi);
                return { error: null };
              })
            }
          >
            <Download />
            Zimmet tutanağını indir
          </Button>
        )}
        {acik && (
          <form
            action={(fd) => {
              fd.set("kisi_id", kisiId);
              calistir(() => zimmetEkle(fd), () => setAcik(false));
            }}
            className="flex w-full flex-col gap-2 text-sm"
          >
            <div className="flex flex-wrap gap-2">
              <Input name="esya" placeholder="Eşya (ör. dizüstü bilgisayar)" required className="min-w-0 flex-[2_1_200px]" />
              <Input name="seri_no" placeholder="Seri / demirbaş no" className="min-w-0 flex-[1_1_140px]" />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span>Teslim günü</span>
                <TarihInput name="verilis" required className="max-w-[170px]" />
              </label>
              <Button type="submit" size="sm" disabled={isPending}>
                Kaydet
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAcik(false)}>
                Vazgeç
              </Button>
            </div>
          </form>
        )}
      </div>
      {error && <p className="px-4 pb-3 text-xs text-destructive sm:px-5">{error}</p>}
    </>
  );
}
