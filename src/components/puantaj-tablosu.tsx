"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type MouseEvent } from "react";
import { puantajGunKaydet, puantajTopluKaydet, type TopluAtlanan } from "@/app/kayit-actions";
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

const anahtar = (kisiId: string, tarih: string) => `${kisiId}|${tarih}`;

/** Günü yıllık izin kaydından gelen hücre: tek kaynak İzinler, toplu seçime girmez. */
function izindenMi(h: Hucre) {
  return !h.elle && (h.kod === "Yİ" || h.kod === "Üİ");
}

/** Elle seçilen kod yoksa günün varsayılanı (sunucu yine izin bilgisiyle denetler). */
function varsayilanKodu(h: Hucre): PuantajKodu {
  if (!h.elle && h.kod) return h.kod;
  if (haftaGunu(h.tarih) === HAFTA_TATILI_GUNU) return "HT";
  if (tamGunTatilMi(h.tarih)) return "GT";
  return "Ç";
}

/** Yazılamayan hücrelerin kısa dökümü (en çok 6 satır). */
function atlananMetni(atlanan: TopluAtlanan[], ad: Map<string, string>) {
  const ilk = atlanan
    .slice(0, 6)
    .map((a) => `${ad.get(a.kisiId) ?? "?"} ${formatTarih(a.tarih, false)} (${a.neden})`)
    .join("; ");
  return atlanan.length > 6 ? `${ilk}; ve ${atlanan.length - 6} hücre daha` : ilk;
}

export function PuantajTablosu({
  satirlar,
  bugun,
  kapali,
}: {
  satirlar: PuantajSatiri[];
  bugun: string;
  kapali: boolean;
}) {
  // Seçim (20 Ekim 2026): tıklama tek hücre, Shift ile dikdörtgen aralık,
  // Ctrl/⌘ ya da "Çoklu seçim" açıkken tek tek ekle/çıkar; gün başlığı o
  // günün tüm çalışanlarını seçer.
  const [secim, setSecim] = useState<Set<string>>(new Set());
  const [capa, setCapa] = useState<string | null>(null);
  const [coklu, setCoklu] = useState(false);
  const gunler = satirlar[0].hucreler.map((h) => h.tarih);

  const hucreMap = useMemo(() => {
    const m = new Map<string, Secim>();
    for (const s of satirlar) for (const h of s.hucreler) m.set(anahtar(s.kisiId, h.tarih), { satir: s, hucre: h });
    return m;
  }, [satirlar]);

  function hucreTikla(s: PuantajSatiri, h: Hucre, e: MouseEvent) {
    const k = anahtar(s.kisiId, h.tarih);
    const ekle = coklu || e.ctrlKey || e.metaKey;
    if (e.shiftKey && capa && hucreMap.has(capa)) {
      const [capaKisi, capaTarih] = capa.split("|");
      const r1 = satirlar.findIndex((x) => x.kisiId === capaKisi);
      const r2 = satirlar.findIndex((x) => x.kisiId === s.kisiId);
      const [ilk, son] = capaTarih < h.tarih ? [capaTarih, h.tarih] : [h.tarih, capaTarih];
      const yeni = new Set(ekle ? secim : []);
      for (const satir of satirlar.slice(Math.min(r1, r2), Math.max(r1, r2) + 1)) {
        for (const x of satir.hucreler) {
          if (x.tarih >= ilk && x.tarih <= son && x.kod !== null && !izindenMi(x)) yeni.add(anahtar(satir.kisiId, x.tarih));
        }
      }
      setSecim(yeni);
      return;
    }
    setCapa(k);
    if (ekle) {
      setSecim((onceki) => {
        const yeni = new Set(onceki);
        if (yeni.has(k)) yeni.delete(k);
        else yeni.add(k);
        return yeni;
      });
    } else {
      setSecim(new Set([k]));
    }
  }

  function gunTikla(tarih: string, e: MouseEvent) {
    const sutun = satirlar
      .filter((s) => {
        const h = s.hucreler.find((x) => x.tarih === tarih)!;
        return h.kod !== null && !izindenMi(h);
      })
      .map((s) => anahtar(s.kisiId, tarih));
    if (sutun.length === 0) return;
    const ekle = coklu || e.ctrlKey || e.metaKey || e.shiftKey;
    setSecim((onceki) => {
      if (!ekle) return new Set(sutun);
      const yeni = new Set(onceki);
      const hepsi = sutun.every((k) => yeni.has(k));
      for (const k of sutun) {
        if (hepsi) yeni.delete(k);
        else yeni.add(k);
      }
      return yeni;
    });
    setCapa(sutun[0]);
  }

  const secilenler = [...secim].map((k) => hucreMap.get(k)).filter((x): x is Secim => !!x && x.hucre.kod !== null);
  const temizle = () => {
    setSecim(new Set());
    setCapa(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {!kapali && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
          <button
            type="button"
            onClick={() => setCoklu((c) => !c)}
            aria-pressed={coklu}
            className={`h-8 border px-2.5 text-sm ${coklu ? "border-primary font-bold text-primary" : "border-border text-foreground"}`}
          >
            Çoklu seçim {coklu ? "açık" : "kapalı"}
          </button>
          <span className="hidden sm:inline">
            Shift ile aralık, Ctrl / ⌘ ile tek tek seç; gün başlığına tıklamak o günün herkesini seçer.
          </span>
          {secilenler.length > 1 && (
            <button type="button" onClick={temizle} className="text-sm text-primary hover:underline">
              Seçimi temizle ({secilenler.length})
            </button>
          )}
        </div>
      )}
      <div className="select-none overflow-x-auto border border-border bg-card">
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
                    className={`min-w-[30px] border-b border-border p-0 text-center font-medium leading-tight ${
                      g === bugun ? "bg-foreground text-background" : tatil ? "bg-muted text-muted-foreground" : ""
                    }`}
                  >
                    <button
                      type="button"
                      disabled={kapali}
                      onClick={(e) => gunTikla(g, e)}
                      aria-label={`${formatTarih(g)}: o günün tüm çalışanlarını seç`}
                      className="w-full px-0.5 py-1.5 enabled:hover:underline"
                    >
                      <div className="font-mono">{Number(g.slice(8))}</div>
                      <div className="text-[10.5px] font-normal">{HARF[haftaGunu(g)]}</div>
                    </button>
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
                  const secili = secim.has(anahtar(s.kisiId, h.tarih));
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
                        onClick={(e) => hucreTikla(s, h, e)}
                        aria-pressed={secili}
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
      {!kapali && secilenler.length === 1 && (
        <GunDuzenleyici
          key={anahtar(secilenler[0].satir.kisiId, secilenler[0].hucre.tarih)}
          secim={secilenler[0]}
          satirlar={satirlar}
          kapat={temizle}
        />
      )}
      {!kapali && secilenler.length > 1 && <TopluDuzenleyici secilenler={secilenler} kapat={temizle} />}
    </div>
  );
}

/** Ayarların kopyalanabileceği diğer çalışanlar: o gün iş dönemi olanlar.
 *  Günü yıllık izinden gelen seçilemez (tek kaynak İzinler). */
function kopyaAdaylari(satirlar: PuantajSatiri[], secim: Secim) {
  return satirlar
    .filter((s) => s.kisiId !== secim.satir.kisiId)
    .map((s) => ({ s, h: s.hucreler.find((x) => x.tarih === secim.hucre.tarih)! }))
    .filter(({ h }) => h && h.kod !== null)
    .map(({ s, h }) => {
      const izin = izindenMi(h);
      return {
        kisiId: s.kisiId,
        adSoyad: s.adSoyad,
        uygun: !izin,
        not: izin
          ? "yıllık izinde"
          : `şu an ${h.kod ? PUANTAJ_KOD_ADI[h.kod] : "işlenmedi"}${h.giris ? `, ${h.giris}–${h.cikis}` : ""}`,
      };
    });
}

/** Giriş–çıkış alanları ve hesaplanan süre; tekli ve toplu düzenleyicide ortak. */
function SaatAlanlari({
  giris,
  cikis,
  setGiris,
  setCikis,
  kapali,
}: {
  giris: string;
  cikis: string;
  setGiris: (v: string) => void;
  setCikis: (v: string) => void;
  kapali: boolean;
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        Giriş
        <Input
          type="time"
          value={kapali ? "" : giris}
          onChange={(e) => setGiris(e.target.value)}
          disabled={kapali}
          className="w-28 font-mono"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Çıkış
        <Input
          type="time"
          value={kapali ? "" : cikis}
          onChange={(e) => setCikis(e.target.value)}
          disabled={kapali}
          className="w-28 font-mono"
        />
      </label>
    </>
  );
}

function KodDugmeleri({
  kod,
  setKod,
  koruVar,
}: {
  kod: PuantajKodu | null | "koru";
  setKod: (k: PuantajKodu | null | "koru") => void;
  koruVar?: boolean;
}) {
  const dugme = (secili: boolean) =>
    `inline-flex h-8 items-center gap-1.5 border px-2.5 text-sm ${secili ? "border-primary font-bold text-primary" : "border-border"}`;
  return (
    <div className="flex flex-wrap gap-1.5">
      {koruVar && (
        <button type="button" onClick={() => setKod("koru")} className={dugme(kod === "koru")}>
          Kodu değiştirme
        </button>
      )}
      <button type="button" onClick={() => setKod(null)} className={dugme(kod === null)}>
        Kendiliğinden
      </button>
      {SECILEBILIR.map((k) => (
        <button key={k} type="button" onClick={() => setKod(k)} className={dugme(kod === k)}>
          <span className={`inline-grid h-5 min-w-6 place-items-center px-0.5 font-mono text-[11px] ${KOD_STIL[k]}`}>{k}</span>
          {PUANTAJ_KOD_ADI[k]}
        </button>
      ))}
    </div>
  );
}

function SureNotu({ giris, cikis, kod }: { giris: string; cikis: string; kod: PuantajKodu | null }) {
  if (!SAAT_RE.test(giris) || !SAAT_RE.test(cikis)) return null;
  const sure = calismaSuresi(giris, cikis);
  const fazla = kod ? saattenFazlaCalisma(kod, sure.netSaat) : 0;
  return (
    <p className="text-sm">
      Çalışma <strong>{saatMetni(sure.netSaat)}</strong>{" "}
      <span className="text-muted-foreground">
        ({saatMetni(sure.brutDk / 60)} − {sure.araDk} dk ara dinlenme)
      </span>
      {fazla > 0 ? (
        <>
          {" "}· fazla çalışma <strong>{String(fazla).replace(".", ",")} saat</strong>
        </>
      ) : null}
      {sure.netSaat > CALISMA.gunlukAzamiSaat.deger && (
        <span className="block font-medium text-destructive">
          Günlük toplam çalışma {CALISMA.gunlukAzamiSaat.deger} saati geçemez.
        </span>
      )}
    </p>
  );
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

  const etkin = kod ?? varsayilanKodu(hucre);
  const sinir = fazlaSaatSiniri(etkin);
  const saatli = sinir > 0 && SAAT_RE.test(giris) && SAAT_RE.test(cikis);
  const hesaplananFazla = saatli ? saattenFazlaCalisma(etkin, calismaSuresi(giris, cikis).netSaat) : 0;

  function kaydet() {
    setError(null);
    const yeniFazla = sinir === 0 ? 0 : Number(fazla.replace(",", ".")) || 0;
    const g = sinir > 0 ? giris : "";
    const c = sinir > 0 ? cikis : "";
    startTransition(async () => {
      const r = await puantajGunKaydet({
        kisiId: satir.kisiId,
        tarih: hucre.tarih,
        kod,
        fazlaSaat: yeniFazla,
        giris: g || null,
        cikis: c || null,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      // Aynı ayarları (kod + saat ya da elle fazla çalışma) seçilen diğer çalışanlara da yaz.
      if (secilen.size > 0) {
        const t = await puantajTopluKaydet({
          hucreler: [...secilen].map((kisiId) => ({ kisiId, tarih: hucre.tarih })),
          kod,
          saat: g && c ? { giris: g, cikis: c } : "temizle",
          fazlaSaat: g && c ? undefined : yeniFazla,
        });
        if (t.error) {
          setError(t.error);
          return;
        }
        if (t.atlanan.length > 0) {
          const ad = new Map(adaylar.map((a) => [a.kisiId, a.adSoyad]));
          setError(`${secilen.size - t.atlanan.length + 1} kişiye yazıldı. Yazılamayan: ${atlananMetni(t.atlanan, ad)}`);
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

  const ozet = [
    kod ? PUANTAJ_KOD_ADI[kod] : "kendiliğinden",
    saatli ? `${giris}–${cikis}` : sinir > 0 && Number(fazla.replace(",", ".")) > 0 ? `+${fazla} saat` : null,
  ]
    .filter(Boolean)
    .join(", ");

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
      {izindenMi(hucre) && (
        <p className="text-sm text-muted-foreground">
          Bu gün yıllık izin kaydından geliyor{hucre.kod === "Üİ" ? " (ücretsiz yol izni)" : ""}. Değiştirmek için izni
          İzinler sayfasından düzelt.
        </p>
      )}
      <KodDugmeleri kod={kod} setKod={(k) => setKod(k === "koru" ? null : k)} />
      <div className="flex flex-wrap items-end gap-3">
        <SaatAlanlari giris={giris} cikis={cikis} setGiris={setGiris} setCikis={setCikis} kapali={sinir === 0} />
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
        <Button type="button" disabled={isPending} onClick={kaydet}>
          {isPending ? "Kaydediliyor…" : secilen.size > 0 ? `Kaydet (${secilen.size + 1} kişi)` : "Kaydet"}
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
      {sinir > 0 && <SureNotu giris={giris} cikis={cikis} kod={etkin} />}
      {adaylar.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-bold">
              Bu ayarları başka çalışanlara da uygula{" "}
              <span className="font-normal text-muted-foreground">
                ({ozet}, {formatTarih(hucre.tarih, false)})
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
                <span className="text-[12px] text-muted-foreground">({a.not})</span>
              </label>
            ))}
          </div>
          {secilen.size > 0 && (
            <span className="text-[12.5px] text-muted-foreground">
              Kaydet&apos;e basınca durum ve saatler {secilen.size + 1} kişiye aynen yazılır; fazla çalışma her biri için
              ayrı hesaplanır.
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

/** Birden fazla hücre seçiliyken: kodu ve/veya saati hepsine birden yazar. */
function TopluDuzenleyici({ secilenler, kapat }: { secilenler: Secim[]; kapat: () => void }) {
  const [kod, setKod] = useState<PuantajKodu | null | "koru">("koru");
  const [giris, setGiris] = useState("");
  const [cikis, setCikis] = useState("");
  const [saatSil, setSaatSil] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const kisiSayisi = new Set(secilenler.map((s) => s.satir.kisiId)).size;
  const calisilmayan = kod !== "koru" && kod !== null && fazlaSaatSiniri(kod) === 0;
  const saatYaz = !calisilmayan && !saatSil && SAAT_RE.test(giris) && SAAT_RE.test(cikis);
  const degisiklikYok = kod === "koru" && !saatYaz && !saatSil;

  function kaydet() {
    setError(null);
    if (!calisilmayan && !saatSil && !giris !== !cikis) {
      setError("Giriş ve çıkış saatini birlikte gir.");
      return;
    }
    startTransition(async () => {
      const r = await puantajTopluKaydet({
        hucreler: secilenler.map((s) => ({ kisiId: s.satir.kisiId, tarih: s.hucre.tarih })),
        kod,
        saat: saatYaz ? { giris, cikis } : saatSil ? "temizle" : "koru",
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      if (r.atlanan.length > 0) {
        const ad = new Map(secilenler.map((s) => [s.satir.kisiId, s.satir.adSoyad]));
        setError(
          `${secilenler.length - r.atlanan.length} hücreye yazıldı. Yazılamayan ${r.atlanan.length}: ${atlananMetni(r.atlanan, ad)}`,
        );
        return;
      }
      kapat();
    });
  }

  return (
    <div className="flex flex-col gap-3 border border-primary bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-bold">
          {secilenler.length} gün seçili{" "}
          <span className="font-normal text-muted-foreground">· {kisiSayisi} kişi</span>
        </div>
        <button type="button" onClick={kapat} className="text-sm text-muted-foreground hover:text-foreground">
          Kapat
        </button>
      </div>
      <KodDugmeleri kod={kod} setKod={setKod} koruVar />
      <div className="flex flex-wrap items-end gap-3">
        <SaatAlanlari
          giris={giris}
          cikis={cikis}
          setGiris={(v) => {
            setGiris(v);
            setSaatSil(false);
          }}
          setCikis={(v) => {
            setCikis(v);
            setSaatSil(false);
          }}
          kapali={calisilmayan}
        />
        <Button type="button" disabled={isPending || degisiklikYok} onClick={kaydet}>
          {isPending ? "Kaydediliyor…" : `${secilenler.length} güne uygula`}
        </Button>
        {!calisilmayan && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            aria-pressed={saatSil}
            onClick={() => {
              setSaatSil((s) => !s);
              setGiris("");
              setCikis("");
            }}
          >
            {saatSil ? "Saatler silinecek" : "Saatleri sil"}
          </Button>
        )}
      </div>
      {saatYaz && <SureNotu giris={giris} cikis={cikis} kod={kod === "koru" ? null : kod} />}
      <span className="text-[12.5px] text-muted-foreground">
        {calisilmayan
          ? "Seçilen günlerin saatleri ve fazla çalışması silinir."
          : saatYaz
            ? "Saatler seçilen her güne yazılır; fazla çalışma her gün için ayrı hesaplanır (hafta tatili ve genel tatilde tamamı)."
            : "Saat boş bırakılırsa günlerin mevcut saati korunur."}{" "}
        Yıllık izin günleri seçime girmez; o gün iş dönemi olmayan ya da kurala uymayan hücreler atlanıp listelenir.
      </span>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
