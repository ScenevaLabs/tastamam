"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { puantajGunKaydet, puantajSaatUygula } from "@/app/kayit-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CALISMA,
  HAFTA_TATILI_GUNU,
  PUANTAJ_KOD_ADI,
  SAAT_RE,
  calismaSuresi,
  fazlaSaatSiniri,
  saatMetni,
  saattenFazlaCalisma,
  haftaGunu,
  tamGunTatilMi,
  type PuantajKodu,
} from "@/lib/mevzuat";
import { KOD_STIL } from "@/lib/puantaj-stil";
import type { Hucre, PuantajSatiri } from "@/lib/puantaj";
import { formatTarih } from "@/lib/utils";

const HARF = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
// Yıllık izin buradan girilmez — tek kaynak İzinler sayfası (bakiyeden düşsün diye).
const SECILEBILIR: PuantajKodu[] = ["Ç", "HT", "GT", "R", "Üİ", "D", "Dİ"];

const EKSIK_KISA: Partial<Record<PuantajKodu, string>> = {
  R: "rapor",
  Üİ: "ücretsiz izin",
  D: "devamsızlık",
  Dİ: "doğum izni",
};

type Secim = { satir: PuantajSatiri; hucre: Hucre };

export function PuantajTablosu({
  satirlar,
  bugun,
  kapali,
}: {
  satirlar: PuantajSatiri[];
  bugun: string;
  kapali: boolean;
}) {
  const [secim, setSecim] = useState<Secim | null>(null);
  const gunler = satirlar[0].hucreler.map((h) => h.tarih);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto border border-border bg-card">
        <table className="border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-40 border-b border-border bg-card px-3 py-2 text-left font-medium">
                Çalışan
              </th>
              {gunler.map((g) => {
                const tatil = haftaGunu(g) === 6 || tamGunTatilMi(g);
                return (
                  <th
                    key={g}
                    className={`min-w-[30px] border-b border-border px-0.5 py-1.5 text-center font-medium leading-tight ${
                      g === bugun ? "bg-foreground text-background" : tatil ? "bg-muted text-muted-foreground" : ""
                    }`}
                  >
                    <div className="font-mono">{Number(g.slice(8))}</div>
                    <div className="text-[10.5px] font-normal">{HARF[haftaGunu(g)]}</div>
                  </th>
                );
              })}
              <th className="border-b border-l border-border px-3 py-2 text-right font-medium">Çalışılan</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium">Eksik gün</th>
              <th className="border-b border-border px-3 py-2 text-right font-medium">FM saat</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => (
              <tr key={s.kisiId}>
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-border/60 bg-card px-3 py-1.5 font-medium">
                  <Link href={`/kisi/${s.kisiId}`} className="hover:text-primary hover:underline">
                    {s.adSoyad}
                  </Link>
                </td>
                {s.hucreler.map((h) => {
                  const secili = secim?.satir.kisiId === s.kisiId && secim.hucre.tarih === h.tarih;
                  if (h.kod === null) {
                    return (
                      <td key={h.tarih} className="border-b border-r border-border/40 text-center text-border">
                        ·
                      </td>
                    );
                  }
                  return (
                    <td key={h.tarih} className="border-b border-r border-border/40 p-0">
                      <button
                        type="button"
                        disabled={kapali}
                        onClick={() => setSecim({ satir: s, hucre: h })}
                        aria-label={`${s.adSoyad}, ${formatTarih(h.tarih)}: ${h.kod ? PUANTAJ_KOD_ADI[h.kod] : "işlenmedi"}${h.giris ? `, ${h.giris}–${h.cikis}` : ""}`}
                        title={h.giris ? `${h.giris}–${h.cikis}` : undefined}
                        className={`flex h-[38px] w-full min-w-[30px] flex-col items-center justify-center font-mono text-[12px] leading-none enabled:hover:outline enabled:hover:outline-1 enabled:hover:outline-primary ${
                          h.kod ? KOD_STIL[h.kod] : "text-border"
                        } ${secili ? "outline outline-2 -outline-offset-2 outline-primary" : ""} ${h.elle ? "underline decoration-dotted underline-offset-2" : ""}`}
                      >
                        <span className="relative">
                          {h.kod || "·"}
                          {h.giris && <span className="absolute -right-1.5 -top-0.5 size-1 rounded-full bg-primary" aria-hidden />}
                        </span>
                        {h.fazlaSaat > 0 && <span className="mt-0.5 text-[10px] font-medium text-primary">+{h.fazlaSaat}</span>}
                      </button>
                    </td>
                  );
                })}
                <td className="border-b border-l border-border/60 px-3 text-right font-mono">{s.calisilan}</td>
                <td className="whitespace-nowrap border-b border-border/60 px-3 text-[12.5px]">
                  {s.eksik.length ? (
                    <span className="font-medium text-[var(--warn)]">
                      {s.eksik.map((e) => `${e.gun} ${EKSIK_KISA[e.kod]}`).join(", ")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="border-b border-border/60 px-3 text-right font-mono">{s.fazlaSaat || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {secim && !kapali && (
        <GunDuzenleyici
          key={`${secim.satir.kisiId}:${secim.hucre.tarih}`}
          secim={secim}
          satirlar={satirlar}
          kapat={() => setSecim(null)}
        />
      )}
    </div>
  );
}

/** Saatin kopyalanabileceği diğer çalışanlar: o gün iş dönemi olanlar.
 *  Rapor, izin, devamsızlık gününde olan seçilemez (nedeni gösterilir). */
function kopyaAdaylari(satirlar: PuantajSatiri[], secim: Secim) {
  return satirlar
    .filter((s) => s.kisiId !== secim.satir.kisiId)
    .map((s) => ({ s, h: s.hucreler.find((x) => x.tarih === secim.hucre.tarih)! }))
    .filter(({ h }) => h && h.kod !== null)
    .map(({ s, h }) => {
      const kod: PuantajKodu = h.kod === "" || h.kod === null ? "Ç" : h.kod;
      return {
        kisiId: s.kisiId,
        adSoyad: s.adSoyad,
        uygun: fazlaSaatSiniri(kod) > 0,
        not: fazlaSaatSiniri(kod) > 0 ? (h.giris ? `şu an ${h.giris}–${h.cikis}` : "") : PUANTAJ_KOD_ADI[kod],
      };
    });
}

function GunDuzenleyici({ secim, satirlar, kapat }: { secim: Secim; satirlar: PuantajSatiri[]; kapat: () => void }) {
  const { satir, hucre } = secim;
  const adaylar = kopyaAdaylari(satirlar, secim);
  const [secilen, setSecilen] = useState<Set<string>>(new Set());
  const [kod, setKod] = useState<PuantajKodu | null>(hucre.elle && hucre.kod ? (hucre.kod as PuantajKodu) : null);
  const [fazla, setFazla] = useState(String(hucre.fazlaSaat || ""));
  const [giris, setGiris] = useState(hucre.giris ?? "");
  const [cikis, setCikis] = useState(hucre.cikis ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // "Kendiliğinden" seçiliyken günün varsayılan kodu. Elle değiştirilmiş günde
  // izin bilgisi burada yok; sunucu yine de doğru kodla denetler.
  const varsayilan: PuantajKodu =
    !hucre.elle && hucre.kod
      ? hucre.kod
      : haftaGunu(hucre.tarih) === HAFTA_TATILI_GUNU
        ? "HT"
        : tamGunTatilMi(hucre.tarih)
          ? "GT"
          : "Ç";
  const etkin = kod ?? varsayilan;
  const sinir = fazlaSaatSiniri(etkin);
  const saatli = sinir > 0 && SAAT_RE.test(giris) && SAAT_RE.test(cikis);
  const sure = saatli ? calismaSuresi(giris, cikis) : null;
  const hesaplananFazla = sure ? saattenFazlaCalisma(etkin, sure.netSaat) : 0;

  function kaydet(yeniKod: PuantajKodu | null, yeniFazla: string) {
    setError(null);
    startTransition(async () => {
      const r = await puantajGunKaydet({
        kisiId: satir.kisiId,
        tarih: hucre.tarih,
        kod: yeniKod,
        fazlaSaat: Number(yeniFazla.replace(",", ".")) || 0,
        giris: sinir > 0 ? giris || null : null,
        cikis: sinir > 0 ? cikis || null : null,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      // Aynı saatleri seçilen diğer çalışanlara da yaz.
      if (saatli && secilen.size > 0) {
        const t = await puantajSaatUygula({ tarih: hucre.tarih, kisiIdler: [...secilen], giris, cikis });
        if (t.error) {
          setError(t.error);
          return;
        }
        if (t.atlanan.length > 0) {
          const ad = new Map(adaylar.map((a) => [a.kisiId, a.adSoyad]));
          setError(
            `${secilen.size - t.atlanan.length + 1} kişiye yazıldı. Yazılamayan: ${t.atlanan
              .map((a) => `${ad.get(a.kisiId) ?? "?"} (${a.neden})`)
              .join("; ")}`,
          );
          setSecilen(new Set(t.atlanan.map((a) => a.kisiId)));
          return;
        }
      }
      kapat();
    });
  }

  const uygunlar = adaylar.filter((a) => a.uygun);
  const hepsiSecili = uygunlar.length > 0 && uygunlar.every((a) => secilen.has(a.kisiId));
  function sec(kisiId: string, acik: boolean) {
    setSecilen((onceki) => {
      const yeni = new Set(onceki);
      if (acik) yeni.add(kisiId);
      else yeni.delete(kisiId);
      return yeni;
    });
  }

  return (
    <div className="flex flex-col gap-3 border border-primary bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-bold">
          {satir.adSoyad} · {formatTarih(hucre.tarih)}{" "}
          <span className="font-normal text-muted-foreground">{HARF[haftaGunu(hucre.tarih)]}</span>
        </div>
        <button type="button" onClick={kapat} className="text-sm text-muted-foreground hover:text-foreground">
          Kapat
        </button>
      </div>
      {(hucre.kod === "Yİ" || hucre.kod === "Üİ") && !hucre.elle && (
        <p className="text-sm text-muted-foreground">
          Bu gün yıllık izin kaydından geliyor{hucre.kod === "Üİ" ? " (ücretsiz yol izni)" : ""}. Değiştirmek için izni
          İzinler sayfasından düzelt.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setKod(null)}
          className={`h-8 border px-2.5 text-sm ${kod === null ? "border-primary font-bold text-primary" : "border-border"}`}
        >
          Kendiliğinden
        </button>
        {SECILEBILIR.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKod(k)}
            className={`inline-flex h-8 items-center gap-1.5 border px-2.5 text-sm ${kod === k ? "border-primary font-bold text-primary" : "border-border"}`}
          >
            <span className={`inline-grid h-5 min-w-6 place-items-center px-0.5 font-mono text-[11px] ${KOD_STIL[k]}`}>{k}</span>
            {PUANTAJ_KOD_ADI[k]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Giriş
          <Input
            type="time"
            value={sinir === 0 ? "" : giris}
            onChange={(e) => setGiris(e.target.value)}
            disabled={sinir === 0}
            className="w-28 font-mono"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Çıkış
          <Input
            type="time"
            value={sinir === 0 ? "" : cikis}
            onChange={(e) => setCikis(e.target.value)}
            disabled={sinir === 0}
            className="w-28 font-mono"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fazla çalışma (saat)
          <Input
            inputMode="decimal"
            value={sinir === 0 ? "" : saatli ? String(hesaplananFazla).replace(".", ",") : fazla}
            onChange={(e) => setFazla(e.target.value)}
            disabled={sinir === 0 || saatli}
            placeholder="0"
            className="w-28 font-mono"
          />
        </label>
        <Button type="button" disabled={isPending} onClick={() => kaydet(kod, sinir === 0 ? "" : fazla)}>
          {isPending ? "Kaydediliyor…" : saatli && secilen.size > 0 ? `Kaydet (${secilen.size + 1} kişi)` : "Kaydet"}
        </Button>
        {(giris || cikis) && sinir > 0 && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setGiris("");
              setCikis("");
            }}
          >
            Saatleri temizle
          </Button>
        )}
      </div>
      {sure && (
        <p className="text-sm">
          Çalışma <strong>{saatMetni(sure.netSaat)}</strong>{" "}
          <span className="text-muted-foreground">
            ({saatMetni(sure.brutDk / 60)} − {sure.araDk} dk ara dinlenme)
          </span>
          {hesaplananFazla > 0 ? (
            <>
              {" "}· fazla çalışma <strong>{String(hesaplananFazla).replace(".", ",")} saat</strong>
            </>
          ) : null}
          {sure.netSaat > CALISMA.gunlukAzamiSaat.deger && (
            <span className="block font-medium text-destructive">
              Günlük toplam çalışma {CALISMA.gunlukAzamiSaat.deger} saati geçemez.
            </span>
          )}
        </p>
      )}
      {saatli && adaylar.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-bold">
              Bu saatleri başka çalışanlara da uygula{" "}
              <span className="font-normal text-muted-foreground">
                ({giris}–{cikis}, {formatTarih(hucre.tarih, false)})
              </span>
            </span>
            {uygunlar.length > 1 && (
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => setSecilen(hepsiSecili ? new Set() : new Set(uygunlar.map((a) => a.kisiId)))}
              >
                {hepsiSecili ? "Seçimi kaldır" : "Tümünü seç"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {adaylar.map((a) => (
              <label
                key={a.kisiId}
                className={`flex items-center gap-2 text-sm ${a.uygun ? "cursor-pointer" : "text-muted-foreground"}`}
              >
                <input
                  type="checkbox"
                  disabled={!a.uygun || isPending}
                  checked={secilen.has(a.kisiId)}
                  onChange={(e) => sec(a.kisiId, e.target.checked)}
                  className="size-4 accent-[var(--pen)]"
                />
                {a.adSoyad}
                {a.not && <span className="text-[12px] text-muted-foreground">({a.not})</span>}
              </label>
            ))}
          </div>
          {secilen.size > 0 && (
            <span className="text-[12.5px] text-muted-foreground">
              Kaydet&apos;e basınca {secilen.size + 1} kişiye yazılır. Elle girilmiş kodları korunur; fazla çalışma her biri
              için ayrı hesaplanır.
            </span>
          )}
        </div>
      )}
      <div>
        <span className="text-[12.5px] text-muted-foreground">
          {sinir === 0
            ? "Çalışılmayan güne saat ve fazla çalışma yazılmaz."
            : `Saat girersen fazla çalışma kendiliğinden hesaplanır (ara dinlenme düşülür, ${CALISMA.araDinlenme.dayanak}). Elle girişte en çok ${String(sinir).replace(".", ",")} saat; yarım saatten az süre yarım, fazlası bir saat sayılır.`}
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
