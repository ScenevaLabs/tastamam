import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ModulKapali } from "@/components/modul-kapali";
import { PuantajTablosu } from "@/components/puantaj-tablosu";
import { PuantajAyDugmeleri } from "@/components/puantaj-ay-dugmeleri";
import { PuantajImzaListesi } from "@/components/puantaj-imza-listesi";
import { saatsizCalisilanGun } from "@/lib/puantaj";
import { createClient } from "@/lib/supabase/server";
import { acikModuller } from "@/lib/moduller";
import { CALISMA, FAZLA_CALISMA, PUANTAJ_KOD_ADI, TATIL_TAKVIMI_SON_YIL, type PuantajKodu } from "@/lib/mevzuat";
import { AY_RE, ayAdi, ayKaydir, puantajYukle } from "@/lib/puantaj-veri";
import { bugunIso } from "@/lib/isg";
import { formatTarih } from "@/lib/utils";
import { KOD_STIL } from "@/lib/puantaj-stil";

export default async function PuantajSayfasi({ searchParams }: { searchParams: Promise<{ ay?: string }> }) {
  const supabase = await createClient();
  if (!(await acikModuller()).includes("puantaj")) {
    return <ModulKapali aktif="puantaj" ad="Puantaj" />;
  }

  const istenen = (await searchParams).ay;
  const ay = istenen && AY_RE.test(istenen) ? istenen : bugunIso().slice(0, 7);
  const v = await puantajYukle(supabase, ay);
  const buAy = v.bugun.slice(0, 7);
  const durum = v.kapandi
    ? v.gonderildi
      ? `Ay kapandı, ${formatTarih(v.gonderildi.slice(0, 10))} tarihinde muhasebeye gönderildi`
      : "Ay kapandı, muhasebeye gönderilemedi"
    : v.gonderildi
      ? `Ay yeniden açıldı · önceki hali ${formatTarih(v.gonderildi.slice(0, 10))} tarihinde gönderilmişti, düzeltmeden sonra tekrar kapat`
      : ay === buAy
        ? `Ay açık · ${formatTarih(v.bugun, false)} tarihine kadar işlendi`
        : ay < buAy
          ? "Ay açık · kapatılmadı"
          : "Henüz başlamadı";

  return (
    <>
      <AppHeader aktif="puantaj" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-4 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">Puantaj</h1>
            <div className="mt-2 flex items-center gap-3">
              <Link
                href={`/puantaj?ay=${ayKaydir(ay, -1)}`}
                aria-label="Önceki ay"
                className="px-1.5 text-lg text-muted-foreground hover:text-foreground"
              >
                ‹
              </Link>
              <span className="min-w-36 text-center text-[17px] font-bold">{ayAdi(ay)}</span>
              <Link
                href={`/puantaj?ay=${ayKaydir(ay, 1)}`}
                aria-label="Sonraki ay"
                className="px-1.5 text-lg text-muted-foreground hover:text-foreground"
              >
                ›
              </Link>
              <span
                className={`text-[13px] ${v.kapandi && !v.gonderildi ? "font-bold text-[var(--warn)]" : "text-muted-foreground"}`}
              >
                {durum}
              </span>
            </div>
          </div>
          <PuantajAyDugmeleri
            ay={ay}
            ayAdi={ayAdi(ay)}
            kapali={!!v.kapandi}
            gonderildi={!!v.kapandi && !!v.gonderildi}
            bos={v.satirlar.length === 0}
          />
        </div>

        {v.kapandi && v.gonderimHatasi && !v.gonderildi && (
          <p className="bg-[var(--warn-soft)] px-3 py-2 text-sm text-[var(--warn)]">Mail hatası: {v.gonderimHatasi}</p>
        )}

        {Number(ay.slice(0, 4)) > TATIL_TAKVIMI_SON_YIL && (
          <p className="bg-[var(--warn-soft)] px-3 py-2 text-sm text-[var(--warn)]">
            {ay.slice(0, 4)} yılının dini bayram tarihleri henüz girilmedi; bayram günlerini elle GT yap.
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
          {(Object.keys(PUANTAJ_KOD_ADI) as PuantajKodu[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`inline-grid h-[22px] min-w-7 place-items-center px-1 font-mono text-[11px] ${KOD_STIL[k]}`}>{k}</span>
              {PUANTAJ_KOD_ADI[k]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-medium text-primary">+2</span>
            fazla çalışma saati
          </span>
        </div>

        {v.satirlar.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu ay iş dönemi olan çalışan yok.</p>
        ) : (
          <PuantajTablosu satirlar={v.satirlar} bugun={v.bugun} kapali={!!v.kapandi} />
        )}

        <p className="max-w-3xl text-sm text-muted-foreground">
          Pazar günleri, genel tatiller, yıllık izinler, izni izleyen ücretsiz yol izni (Üİ) ve iş dönemi dışındaki
          günler kendiliğinden doldu. Cumartesi çalışma günü sayılır. Bir hücreye tıklayıp kodu ya da fazla çalışma
          saatini değiştirebilirsin; günlük toplam çalışma {CALISMA.gunlukAzamiSaat.deger} saati geçemez. Rapor, ücretsiz
          izin ve devamsızlık SGK eksik gün olarak muhasebeye gider. Kapanan ay, kapandığı haliyle saklanır.
        </p>

        {v.satirlar.length > 0 && (
          <section>
            <h2 className="mb-1 text-[18px] font-bold">Çalışana imzalatılacak çizelgeler</h2>
            <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
              Her çalışanın aylık çizelgesini indir, imzalat, taranmış halini yükle; dosya o ayın iş dönemi klasörüne gider.
              Giriş–çıkış saatlerini hücreye tıklayarak gir. İmzalı çizelge fazla çalışma uyuşmazlığında yazılı delildir.{" "}
              <span className="font-mono text-[12px]">Çalışma Süreleri Yön. md. 9</span>
            </p>
            <PuantajImzaListesi
              ay={ay}
              satirlar={v.satirlar.map((s) => ({
                kisiId: s.kisiId,
                adSoyad: s.adSoyad,
                saatsizGun: saatsizCalisilanGun(s),
                imzaliAt: v.imzalar[s.kisiId] ?? null,
              }))}
            />
          </section>
        )}

        {v.uyarilar.map((u) => (
          <div key={u.kisiId} className="border-l-[3px] border-[var(--warn)] bg-card px-4 py-3">
            <div className="font-bold">
              {u.adSoyad} bu yıl {u.yilToplam} saat fazla çalıştı
            </div>
            <div className="text-sm text-muted-foreground">
              Yıllık sınır {FAZLA_CALISMA.yillikSinirSaat.deger} saat.{" "}
              {u.kalan > 0 ? `Kalan ${u.kalan} saat.` : `Sınır ${-u.kalan} saat aşıldı.`}{" "}
              <span className="font-mono text-[12px]">{FAZLA_CALISMA.yillikSinirSaat.dayanak}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
