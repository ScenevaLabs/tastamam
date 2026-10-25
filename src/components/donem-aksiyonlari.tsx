"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIsGirisi, deleteIsGirisi, topluCikisUygula } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TarihInput } from "@/components/tarih-input";
import { Label } from "@/components/ui/label";
import { CIKIS_NEDENLERI, type IsGirisi } from "@/lib/types";

export function DonemAksiyonlari({
  kisiId,
  isGirisi,
  girisBildirgesiVar,
  ayrilisBildirgesiVar,
}: {
  kisiId: string;
  isGirisi: IsGirisi;
  girisBildirgesiVar: boolean;
  ayrilisBildirgesiVar: boolean;
}) {
  const router = useRouter();
  const [mod, setMod] = useState<"kapali" | "duzenle" | "sil-onay">("kapali");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (girisBildirgesiVar) {
    // Giriş bilgileri kilitli, ama çıkış tarihi girilebilmeli (20 Ekim 2026
    // hatası: bildirgesi alınmış ve pasife düşmüş dönemin çıkışı hiçbir yerden
    // girilemiyordu). Ayrılış bildirgesi de alındıysa çıkış da kilitlenir.
    return (
      <div className="flex flex-col gap-2 border-t border-border px-4 py-2">
        {ayrilisBildirgesiVar && !isGirisi.cikis_tarihi && (
          <p className="text-xs font-bold text-[var(--warn)]">
            İşten ayrılış bildirgesi yüklenmiş ama çıkış tarihi girilmemiş. Bildirgedeki çıkış tarihini gir.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          İş giriş bildirgesi alınmış — giriş bilgileri düzenlenemez, dönem silinemez.
        </p>
        {(!isGirisi.cikis_tarihi || !ayrilisBildirgesiVar) && <CikisGir isGirisi={isGirisi} />}
      </div>
    );
  }

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateIsGirisi(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMod("kapali");
    });
  }

  function handleDelete() {
    setError(null);
    const formData = new FormData();
    formData.set("is_girisi_id", isGirisi.id);
    formData.set("kisi_id", kisiId);
    startTransition(async () => {
      const result = await deleteIsGirisi(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.kisiSilindi) {
        router.push("/calisanlar");
        return;
      }
      router.refresh();
    });
  }

  if (mod === "duzenle") {
    return (
      <form action={handleUpdate} className="flex flex-col gap-3 border-t border-border px-4 py-3">
        <input type="hidden" name="is_girisi_id" value={isGirisi.id} />
        <input type="hidden" name="kisi_id" value={kisiId} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Giriş Tarihi</Label>
            <TarihInput name="giris_tarihi" defaultValue={isGirisi.giris_tarihi} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Çıkış Tarihi</Label>
            <TarihInput name="cikis_tarihi" defaultValue={isGirisi.cikis_tarihi ?? ""} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Durum</Label>
            <select
              name="durum"
              defaultValue={isGirisi.durum}
              className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
            >
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Ücret</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              name="ucret_tutari"
              defaultValue={isGirisi.ucret_tutari ?? ""}
              placeholder="Asgari ücret"
            />
            <div className="flex gap-2">
              <select
                name="ucret_periyodu"
                defaultValue={isGirisi.ucret_periyodu ?? ""}
                className="h-8 flex-1 rounded-md border border-border bg-transparent px-2 text-xs"
              >
                <option value="">Toplam</option>
                <option value="gunluk">Günlük</option>
                <option value="aylik">Aylık</option>
              </select>
              <select
                name="ucret_tipi"
                defaultValue={isGirisi.ucret_tipi ?? ""}
                className="h-8 flex-1 rounded-md border border-border bg-transparent px-2 text-xs"
              >
                <option value="">Net/brüt?</option>
                <option value="net">Net</option>
                <option value="brut">Brüt</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">
            Çıkış Nedeni <span className="text-muted-foreground font-normal">(çıkış tarihi girildiyse)</span>
          </Label>
          <select
            name="cikis_nedeni"
            defaultValue={isGirisi.cikis_nedeni ?? ""}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            <option value="">Seçilmedi</option>
            {CIKIS_NEDENLERI.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="xs" disabled={isPending}>
            {isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={() => setMod("kapali")}>
            Vazgeç
          </Button>
        </div>
      </form>
    );
  }

  if (mod === "sil-onay") {
    return (
      <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
        <p className="text-xs text-[var(--warn)]">
          Bu dönem ve tüm evrak kayıtları kalıcı olarak silinecek. Emin misin?
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" size="xs" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Siliniyor..." : "Evet, sil"}
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={() => setMod("kapali")}>
            Vazgeç
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 border-t border-border px-4 py-2">
      <Button type="button" size="xs" variant="outline" onClick={() => setMod("duzenle")}>
        Düzenle
      </Button>
      <Button type="button" size="xs" variant="outline" onClick={() => setMod("sil-onay")}>
        Sil
      </Button>
    </div>
  );
}

/** Yalnızca çıkış tarihi ve nedeni: dönemi pasife alır, kişinin başka aktif
 *  dönemi kalmadıysa klasörünü PASİF'e taşır (İş çıkışı sayfasıyla aynı
 *  eylem). Muhasebeye mail ayrı düğmeyle gider. */
function CikisGir({ isGirisi }: { isGirisi: IsGirisi }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uyari, setUyari] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function kaydet(formData: FormData) {
    const tarih = (formData.get("cikis_tarihi") as string) || "";
    const neden = (formData.get("cikis_nedeni") as string) || null;
    setError(null);
    if (!tarih) {
      setError("Çıkış tarihini gir.");
      return;
    }
    if (tarih < isGirisi.giris_tarihi) {
      setError("Çıkış tarihi giriş tarihinden önce olamaz.");
      return;
    }
    startTransition(async () => {
      const r = await topluCikisUygula([isGirisi.id], tarih, neden);
      if (r.error) {
        setError(r.error);
        return;
      }
      setUyari(r.klasorUyarilari?.length ? r.klasorUyarilari.join(" ") : null);
      setAcik(false);
      router.refresh();
    });
  }

  if (!acik) {
    return (
      <div className="flex flex-col gap-1">
        <Button type="button" size="xs" variant="outline" className="self-start" onClick={() => setAcik(true)}>
          {isGirisi.cikis_tarihi ? "Çıkış tarihini düzelt" : "Çıkış tarihi gir"}
        </Button>
        {uyari && <p className="text-xs text-[var(--warn)]">{uyari}</p>}
      </div>
    );
  }

  return (
    <form action={kaydet} className="flex flex-col gap-3 py-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Çıkış Tarihi</Label>
          <TarihInput name="cikis_tarihi" defaultValue={isGirisi.cikis_tarihi ?? ""} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Çıkış Nedeni</Label>
          <select
            name="cikis_nedeni"
            defaultValue={isGirisi.cikis_nedeni ?? ""}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            <option value="">Seçilmedi</option>
            {CIKIS_NEDENLERI.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="xs" disabled={isPending}>
          {isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button type="button" size="xs" variant="outline" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
