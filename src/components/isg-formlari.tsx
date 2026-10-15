"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  hatirlatmaGunuKaydet,
  isyeriBelgeKaydet,
  kazaBildirildi,
  kazaHaberVer,
  kazaKaydet,
  tehlikeSinifiKaydet,
} from "@/app/isg-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TarihInput } from "@/components/tarih-input";
import { belgeYukle } from "@/lib/belge-yukle";
import { ISYERI_BELGE_ADI, ISYERI_BELGE_TIPLERI } from "@/lib/isg-takip";
import { ISG, TEHLIKE_SINIFI_ADI, type TehlikeSinifi } from "@/lib/mevzuat";
import type { IsKazasi } from "@/lib/types";

const SECIM = "h-10 border border-input bg-transparent px-2 text-sm";

function Mesaj({ error, ok }: { error: string | null; ok?: string | null }) {
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (ok) return <span className="text-sm font-bold text-[var(--ok)]">{ok}</span>;
  return null;
}

export function TehlikeSinifiFormu({ sinif }: { sinif: TehlikeSinifi | null }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const r = await tehlikeSinifiKaydet(fd);
          setError(r.error);
        })
      }
      className="flex flex-col gap-3"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-muted-foreground">
          Sınıf SGK işyeri sicil numarasındaki NACE koduna göre belirlenir; bilmiyorsan İSG uzmanına sor.
        </legend>
        {(Object.keys(ISG) as TehlikeSinifi[]).map((s) => (
          <label key={s} className="flex cursor-pointer items-start gap-3">
            <input type="radio" name="sinif" value={s} defaultChecked={sinif === s} className="mt-1 size-4 accent-[var(--pen)]" />
            <span>
              <span className="font-bold">{TEHLIKE_SINIFI_ADI[s][0].toLocaleUpperCase("tr") + TEHLIKE_SINIFI_ADI[s].slice(1)}</span>
              <span className="block text-sm text-muted-foreground">
                Eğitim {ISG[s].egitimTekrarYil} yılda bir, sağlık muayenesi {ISG[s].saglikMuayeneYil} yılda bir, risk
                değerlendirmesi {ISG[s].riskDegerlendirmeYil} yılda bir.
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
      <Mesaj error={error} />
    </form>
  );
}

export function IsyeriBelgeFormu() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [dosya, setDosya] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          setOk(null);
          const r = await isyeriBelgeKaydet(fd);
          if (r.error || !r.id) return setError(r.error ?? "Kaydedilemedi.");
          if (dosya) {
            const y = await belgeYukle({ tur: "isyeri", kisiId: "", isyeriBelgeId: r.id }, dosya);
            if (y.error) return setError(`Kayıt eklendi ama dosya yüklenemedi: ${y.error}`);
          }
          setOk("Kaydedildi.");
          setDosya(null);
        })
      }
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tip">Belge</Label>
          <select id="tip" name="tip" className={SECIM} defaultValue="risk_degerlendirmesi">
            {ISYERI_BELGE_TIPLERI.map((t) => (
              <option key={t} value={t}>
                {ISYERI_BELGE_ADI[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="yapilma_tarihi">Yapıldığı gün</Label>
          <TarihInput id="yapilma_tarihi" name="yapilma_tarihi" required />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="isyeri_dosya">
          Dosya <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
        </Label>
        <Input id="isyeri_dosya" type="file" onChange={(e) => setDosya(e.target.files?.[0] ?? null)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Mesaj error={error} ok={ok} />
      </div>
    </form>
  );
}

export type KazaKisisi = { id: string; adSoyad: string };

export function KazaFormu({
  kisiler,
  kaza,
  varsayilanKisiId,
}: {
  kisiler: KazaKisisi[];
  kaza?: IsKazasi;
  varsayilanKisiId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [tur, setTur] = useState(kaza?.tur ?? "is_kazasi");
  const [disinda, setDisinda] = useState(kaza?.isyeri_disinda ?? false);
  const [isPending, startTransition] = useTransition();
  const ogrenmeGerekli = disinda || tur === "meslek_hastaligi";

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const r = await kazaKaydet(fd);
          if (r.error || !r.id) return setError(r.error ?? "Kaydedilemedi.");
          router.push(`/isg/kaza/${r.id}`);
        })
      }
      className="flex max-w-2xl flex-col gap-4"
    >
      {kaza && <input type="hidden" name="id" value={kaza.id} />}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="kisi_id">Çalışan</Label>
          <select id="kisi_id" name="kisi_id" defaultValue={kaza?.kisi_id ?? varsayilanKisiId ?? ""} className={SECIM} required>
            <option value="">Seç</option>
            {kisiler.map((k) => (
              <option key={k.id} value={k.id}>
                {k.adSoyad}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tur">Tür</Label>
          <select id="tur" name="tur" value={tur} onChange={(e) => setTur(e.target.value as IsKazasi["tur"])} className={SECIM}>
            <option value="is_kazasi">İş kazası</option>
            <option value="meslek_hastaligi">Meslek hastalığı</option>
            <option value="ramak_kala">Ramak kala (yaralanma yok)</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="olay_tarihi">{tur === "meslek_hastaligi" ? "Teşhis tarihi" : "Olay tarihi"}</Label>
          <TarihInput id="olay_tarihi" name="olay_tarihi" defaultValue={kaza?.olay_tarihi} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="olay_saati">
            Saat <span className="font-normal text-muted-foreground">(SS:DD)</span>
          </Label>
          <Input id="olay_saati" name="olay_saati" defaultValue={kaza?.olay_saati ?? ""} placeholder="14:20" className="w-28 font-mono" />
        </div>
      </div>
      {tur !== "meslek_hastaligi" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isyeri_disinda"
            checked={disinda}
            onChange={(e) => setDisinda(e.target.checked)}
            className="size-4 accent-[var(--pen)]"
          />
          İşyeri dışında oldu (görevle gidilen yer, servis aracı)
        </label>
      )}
      {ogrenmeGerekli && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="ogrenme_tarihi">
            Öğrendiğin gün <span className="font-normal text-muted-foreground">(bildirim süresi bu günden işler)</span>
          </Label>
          <TarihInput id="ogrenme_tarihi" name="ogrenme_tarihi" defaultValue={kaza?.ogrenme_tarihi ?? undefined} />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="yer">Yer</Label>
        <Input id="yer" name="yer" defaultValue={kaza?.yer ?? ""} placeholder="Stüdyo 2, ışık iskelesi" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="aciklama">Nasıl oldu</Label>
        <Textarea id="aciklama" name="aciklama" defaultValue={kaza?.aciklama ?? ""} rows={3} required />
      </div>
      {tur !== "ramak_kala" && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="yaralanma">{tur === "meslek_hastaligi" ? "Teşhis" : "Yaralanma"}</Label>
            <Input id="yaralanma" name="yaralanma" defaultValue={kaza?.yaralanma ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="saglik_kurulusu">Sağlık kuruluşu</Label>
            <Input id="saglik_kurulusu" name="saglik_kurulusu" defaultValue={kaza?.saglik_kurulusu ?? ""} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="istirahat_bas">İstirahat ilk gün</Label>
              <TarihInput id="istirahat_bas" name="istirahat_bas" defaultValue={kaza?.istirahat_bas ?? undefined} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="istirahat_bit">İstirahat son gün</Label>
              <TarihInput id="istirahat_bit" name="istirahat_bit" defaultValue={kaza?.istirahat_bit ?? undefined} />
            </div>
          </div>
          <p className="-mt-2 text-sm text-muted-foreground">İstirahat günleri puantaja rapor (R) olarak işlenir.</p>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="taniklar">Tanıklar</Label>
        <Input id="taniklar" name="taniklar" defaultValue={kaza?.taniklar ?? ""} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Kaydediliyor…" : kaza ? "Değişiklikleri kaydet" : "Kaydı aç"}
        </Button>
        <Mesaj error={error} />
      </div>
    </form>
  );
}

/** İş kazası sayfasındaki yapılacaklar düğmeleri. */
export function KazaHaberVerDugmesi({ id, isgEmailVar }: { id: string; isgEmailVar: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (!isgEmailVar) {
    return <span className="text-sm text-muted-foreground">Ayarlar&apos;a İSG uzmanının e-postasını girersen buradan mail atabilirsin.</span>;
  }
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const r = await kazaHaberVer(fd);
          setError(r.error);
        })
      }
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Gönderiliyor…" : "İSG uzmanına mail at"}
      </Button>
      <Mesaj error={error} />
    </form>
  );
}

export function KazaDosyaYukle({ kazaId, kisiId, belge }: { kazaId: string; kisiId: string; belge: "tutanak" | "rapor" }) {
  const [error, setError] = useState<string | null>(null);
  const [oran, setOran] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex w-fit cursor-pointer items-center border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted">
        {oran !== null ? `Yükleniyor %${Math.round(oran * 100)}` : "Dosya yükle"}
        <input
          type="file"
          className="sr-only"
          onChange={async (e) => {
            const dosya = e.target.files?.[0];
            if (!dosya) return;
            setError(null);
            setOran(0);
            const r = await belgeYukle({ tur: "kaza", kisiId, kazaId, belge }, dosya, setOran);
            setOran(null);
            setError(r.error);
          }}
        />
      </label>
      <Mesaj error={error} />
    </div>
  );
}

export function KazaBildirildiFormu({ id, bugun }: { id: string; bugun: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const r = await kazaBildirildi(fd);
          setError(r.error);
        })
      }
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="bildirildi_tarihi" className="text-[13px] font-normal text-muted-foreground">
          Bildirim günü
        </Label>
        <TarihInput id="bildirildi_tarihi" name="bildirildi_tarihi" defaultValue={bugun} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Kaydediliyor…" : "Bildirildi olarak işaretle"}
      </Button>
      <Mesaj error={error} />
    </form>
  );
}

export function HatirlatmaFormu({ gun, alici }: { gun: number; alici: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setOk(null);
          const r = await hatirlatmaGunuKaydet(fd);
          setError(r.error);
          if (!r.error) setOk("Kaydedildi.");
        })
      }
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-muted-foreground">
        Her sabah 08.00&apos;de, süresi dolmasına bu kadar gün kalan işler{" "}
        {alici ? (
          <>
            <span className="font-medium text-foreground">{alici}</span> adresine
          </>
        ) : (
          "takip adresine (Ayarlar’da boş)"
        )}{" "}
        mail olarak gelir. Son günü bugün olanlar da hatırlatılır.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Input name="hatirlatma_gun" type="number" min={0} max={30} defaultValue={gun} className="w-20 font-mono" />
        <span className="text-sm">gün önce</span>
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Mesaj error={error} ok={ok} />
      </div>
    </form>
  );
}
