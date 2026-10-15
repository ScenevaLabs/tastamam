"use client";

import { useState, useTransition } from "react";
import { topluCikisUygula, topluAyrilisMailiGonder } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { TarihInput } from "@/components/tarih-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDonemAraligi } from "@/lib/utils";
import { CIKIS_NEDENLERI, type Kisi, type IsGirisi } from "@/lib/types";

type Satir = { kisi: Kisi; isGirisi: IsGirisi };

export function TopluCikisForm({ satirlar }: { satirlar: Satir[] }) {
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [cikisTarihi, setCikisTarihi] = useState("");
  const [cikisNedeni, setCikisNedeni] = useState("");
  const [asama, setAsama] = useState<"seciliyor" | "uygulandi">("seciliyor");
  const [uygulananIds, setUygulananIds] = useState<string[]>([]);
  // satirlar prop'u onayla sonrası revalidatePath ile yenileniyor — artık
  // pasif olan bu kişiler "aktif dönemler" sorgusunda hiç dönmüyor, bu
  // yüzden gösterim için ayrı bir anlık görüntü (snapshot) tutuluyor.
  const [uygulananSatirlar, setUygulananSatirlar] = useState<Satir[]>([]);
  const [not, setNot] = useState("");
  const [klasorUyarilari, setKlasorUyarilari] = useState<string[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [mailHata, setMailHata] = useState<string | null>(null);
  const [mailGonderildi, setMailGonderildi] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSecili((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onayla() {
    setHata(null);
    if (secili.size === 0) {
      setHata("En az bir kişi seç.");
      return;
    }
    if (!cikisTarihi) {
      setHata("Çıkış tarihi gir.");
      return;
    }
    const ids = [...secili];
    const secilenSatirlar = satirlar.filter((s) => secili.has(s.isGirisi.id));
    startTransition(async () => {
      const result = await topluCikisUygula(ids, cikisTarihi, cikisNedeni || null);
      if (result.error) {
        setHata(result.error);
        return;
      }
      setUygulananIds(ids);
      setUygulananSatirlar(secilenSatirlar);
      setKlasorUyarilari(result.klasorUyarilari ?? []);
      setAsama("uygulandi");
    });
  }

  function mailAt() {
    setMailHata(null);
    startTransition(async () => {
      const result = await topluAyrilisMailiGonder(uygulananIds, not.trim() || null);
      if (result.error) {
        setMailHata(result.error);
        return;
      }
      setMailGonderildi(true);
    });
  }

  if (asama === "uygulandi") {
    const secilenler = uygulananSatirlar;
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-sm font-bold">İşten çıkışı yapılanlar</h2>
          <ul className="flex flex-col gap-1.5">
            {secilenler.map((s) => (
              <li key={s.isGirisi.id} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--ok)]">✓</span> {s.kisi.ad_soyad}
              </li>
            ))}
          </ul>
        </div>
        {klasorUyarilari.length > 0 && (
          <div className="rounded-lg border border-[var(--warn)] bg-[var(--warn-soft)] p-3 text-sm text-[var(--warn)]">
            <p className="font-bold">Klasör PASİF&apos;e taşınamadı:</p>
            <ul className="mt-1 list-disc pl-4">
              {klasorUyarilari.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="cikis_notu">
            Not (mali müşavire gidecek mail&apos;e eklenir — ör. gerçekte kaç gün çalışıldığı)
          </Label>
          <Textarea
            id="cikis_notu"
            value={not}
            onChange={(e) => setNot(e.target.value)}
            disabled={mailGonderildi}
            placeholder="Örn: Bu kişiler dönem içinde sadece 2 gün çalıştı, puantaja göre ücret 2 günlük hesaplanmalı."
            className="max-w-[520px]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={mailAt} disabled={isPending || mailGonderildi} className="self-start">
            {isPending
              ? "Gönderiliyor..."
              : mailGonderildi
                ? "Mail gönderildi"
                : `Muhasebeye mail at (${secilenler.length} kişi)`}
          </Button>
          {mailHata && <p className="text-sm text-red-600">{mailHata}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cikis_tarihi">Çıkış tarihi (seçilen herkes için)</Label>
          <TarihInput
            id="cikis_tarihi"
            value={cikisTarihi}
            onChange={(e) => setCikisTarihi(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cikis_nedeni">Çıkış nedeni (seçilen herkes için)</Label>
          <select
            id="cikis_nedeni"
            value={cikisNedeni}
            onChange={(e) => setCikisNedeni(e.target.value)}
            className="h-9 max-w-[220px] rounded-md border border-border bg-transparent px-2 text-sm"
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

      <div className="rounded-lg border border-border">
        {satirlar.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Aktif dönemi olan çalışan yok.</p>
        )}
        {satirlar.map(({ kisi, isGirisi }) => (
          <label
            key={isGirisi.id}
            className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent/40"
          >
            <input
              type="checkbox"
              checked={secili.has(isGirisi.id)}
              onChange={() => toggle(isGirisi.id)}
            />
            <div>
              <div className="text-sm font-medium">{kisi.ad_soyad}</div>
              <div className="text-xs text-muted-foreground">
                {kisi.meslek_adi} · {formatDonemAraligi(isGirisi.giris_tarihi, isGirisi.cikis_tarihi)}
              </div>
            </div>
          </label>
        ))}
      </div>

      {hata && <p className="text-sm text-red-600">{hata}</p>}
      <Button onClick={onayla} disabled={isPending} className="self-start">
        {isPending ? "Kaydediliyor..." : `Onayla (${secili.size} kişi)`}
      </Button>
    </div>
  );
}
