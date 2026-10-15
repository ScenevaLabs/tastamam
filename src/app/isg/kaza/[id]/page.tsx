import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ModulKapali } from "@/components/modul-kapali";
import {
  KazaBildirildiFormu,
  KazaDosyaYukle,
  KazaFormu,
  KazaHaberVerDugmesi,
} from "@/components/isg-formlari";
import { createClient } from "@/lib/supabase/server";
import { ayarlarSatiri } from "@/lib/istek";
import { acikModuller } from "@/lib/moduller";
import { bugunIso } from "@/lib/isg";
import { kazaSonGun } from "@/lib/isg-takip";
import { gunFarki, isGunuMu, gunEkle } from "@/lib/mevzuat";
import { KAZA_TURU_ADI, type IsKazasi } from "@/lib/types";
import { formatTarih } from "@/lib/utils";

const GUN_ADI = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "UTC" });
const UZUN = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });

function isGunuKalan(bugun: string, son: string): number {
  let n = 0;
  for (let t = gunEkle(bugun, 1); t <= son; t = gunEkle(t, 1)) if (isGunuMu(t)) n++;
  return n;
}

function Madde({ tamam, baslik, not, children }: { tamam: boolean; baslik: string; not?: string | null; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-1 size-3.5 shrink-0 border ${tamam ? "border-[var(--stamp)] bg-[var(--stamp)]" : "border-foreground/50"}`}
        />
        <span className="flex-1">
          <span className={`font-semibold ${tamam ? "text-[var(--stamp)]" : ""}`}>{baslik}</span>
          {not && <span className="block text-[13px] text-muted-foreground">{not}</span>}
        </span>
      </div>
      {!tamam && children && <div className="pl-[26px]">{children}</div>}
    </li>
  );
}

export default async function KazaSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duzenle?: string }>;
}) {
  if (!(await acikModuller()).includes("isg")) return <ModulKapali aktif="isg" ad="İSG" />;
  const [{ id }, { duzenle }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: k }, ayarlar, { data: riskler }] = await Promise.all([
    supabase
      .from("is_kazasi")
      .select("*, kisi:kisi_id(ad_soyad)")
      .eq("id", id)
      .maybeSingle<IsKazasi & { kisi: { ad_soyad: string } | null }>(),
    ayarlarSatiri(),
    supabase
      .from("isyeri_belge")
      .select("yapilma_tarihi")
      .eq("tip", "risk_degerlendirmesi")
      .order("yapilma_tarihi", { ascending: false })
      .limit(1),
  ]);
  if (!k) notFound();

  const adSoyad = k.kisi?.ad_soyad ?? "";
  const bugun = bugunIso();

  if (duzenle) {
    return (
      <>
        <AppHeader aktif="isg" />
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-4 sm:p-8">
          <Link href={`/isg/kaza/${id}`} className="text-sm text-primary hover:underline">
            ← Kayda dön
          </Link>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">Bilgileri düzenle</h1>
          <KazaFormu kisiler={[{ id: k.kisi_id, adSoyad }]} kaza={k} />
        </div>
      </>
    );
  }

  const son = kazaSonGun(k);
  const sonRisk = riskler?.[0]?.yapilma_tarihi as string | undefined;
  const riskYenilendi = sonRisk && sonRisk >= k.olay_tarihi ? sonRisk : null;
  const kalan = son && !k.bildirildi_tarihi ? isGunuKalan(bugun, son) : null;
  const gecti = son && !k.bildirildi_tarihi && son < bugun;
  const olay: [string, string | null][] = [
    ["Kazalı", adSoyad],
    ["Tür", KAZA_TURU_ADI[k.tur]],
    ["Yer", k.yer],
    ["Nasıl oldu", k.aciklama],
    [k.tur === "meslek_hastaligi" ? "Teşhis" : "Yaralanma", k.yaralanma],
    ["Sağlık kuruluşu", k.saglik_kurulusu],
    [
      "İstirahat",
      k.istirahat_bas
        ? `${formatTarih(k.istirahat_bas)} → ${formatTarih(k.istirahat_bit ?? k.istirahat_bas)} (${
            gunFarki(k.istirahat_bas, k.istirahat_bit ?? k.istirahat_bas) + 1
          } gün), puantaja rapor olarak işlendi`
        : null,
    ],
    ["Tanıklar", k.taniklar],
    ["Öğrenildiği gün", k.ogrenme_tarihi ? formatTarih(k.ogrenme_tarihi) : null],
  ];

  return (
    <>
      <AppHeader aktif="isg" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-7 p-4 sm:p-8">
        <Link href="/isg" className="text-sm text-primary hover:underline">
          ← İSG
        </Link>
        <div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">
            {KAZA_TURU_ADI[k.tur]} · {adSoyad}
          </h1>
          <p className="mt-1 font-mono text-[14px] text-muted-foreground">
            {formatTarih(k.olay_tarihi)} {GUN_ADI.format(new Date(`${k.olay_tarihi}T00:00:00Z`))}
            {k.olay_saati && ` ${k.olay_saati}`}
            {k.yer && ` · ${k.yer}`}
          </p>
        </div>

        {son && (
          <section
            className={`flex flex-wrap items-start gap-x-8 gap-y-3 border-l-[3px] bg-card p-5 ${
              k.bildirildi_tarihi ? "border-[var(--stamp)]" : "border-[var(--warn)]"
            }`}
          >
            {k.bildirildi_tarihi ? (
              <div>
                <p className="text-[20px] font-bold text-[var(--stamp)]">SGK&apos;ya bildirildi</p>
                <p className="text-muted-foreground">Bildirim günü {formatTarih(k.bildirildi_tarihi)}.</p>
              </div>
            ) : (
              <>
                <div className="min-w-[140px]">
                  <p className={`font-mono text-[40px] font-medium leading-none ${gecti ? "text-[var(--warn)]" : ""}`}>
                    {gecti ? "!" : son === bugun ? "Bugün" : kalan}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {gecti ? "Süre geçti" : son === bugun ? "SGK bildiriminin son günü" : "iş günü SGK bildirimi için kalan"}
                  </p>
                </div>
                <div className="max-w-xl flex-1">
                  <p>
                    {gecti ? (
                      <>
                        Bildirimin son günü {UZUN.format(new Date(`${son}T00:00:00Z`))} idi. Hâlâ yapılmadıysa bugün
                        e-Bildirge&apos;den bildir; gecikmiş bildirim de bildirimsizlikten iyidir.
                      </>
                    ) : (
                      <>
                        Kazayı en geç{" "}
                        <strong>
                          {UZUN.format(new Date(`${son}T00:00:00Z`))} {GUN_ADI.format(new Date(`${son}T00:00:00Z`))}
                        </strong>{" "}
                        günü SGK&apos;ya bildirmen gerekiyor. Süre{" "}
                        {k.ogrenme_tarihi && (k.isyeri_disinda || k.tur === "meslek_hastaligi")
                          ? "öğrendiğin günden"
                          : "kazadan"}{" "}
                        sonraki üç iş günü; hafta sonu ve resmi tatiller sayılmaz.
                      </>
                    )}{" "}
                    Bildirim e-Bildirge&apos;den yapılır; aşağıdaki bilgiler bildirim formuna hazır.
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-muted-foreground">5510 s.K. md. 13 · 6331 s.K. md. 14</p>
                  <div className="mt-3">
                    <KazaBildirildiFormu id={k.id} bugun={bugun} />
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        <div className="flex flex-wrap items-start gap-6">
          <section className="min-w-0 flex-[1_1_420px]">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-[18px] font-bold">Olay</h2>
              <Link href={`/isg/kaza/${k.id}?duzenle=1`} className="text-sm text-primary hover:underline">
                Bilgileri düzenle
              </Link>
            </div>
            <dl className="border border-border bg-card">
              {olay
                .filter(([, v]) => v)
                .map(([b, v]) => (
                  <div key={b} className="grid grid-cols-[140px_1fr] gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0">
                    <dt className="text-[13px] text-muted-foreground">{b}</dt>
                    <dd className="text-[14px]">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>

          <section className="min-w-0 flex-[1_1_420px]">
            <h2 className="mb-3 text-[18px] font-bold">Yapılacaklar</h2>
            <ul className="border border-border bg-card">
              <Madde
                tamam={!!k.haber_verildi_at}
                baslik="İşyeri hekimine ve İSG uzmanına haber ver"
                not={k.haber_verildi_at ? `${formatTarih(k.haber_verildi_at.slice(0, 10))} mail gönderildi` : null}
              >
                <KazaHaberVerDugmesi id={k.id} isgEmailVar={!!ayarlar?.isg_email} />
              </Madde>
              <Madde
                tamam={!!k.tutanak_dosya}
                baslik="Kaza tutanağını tanıklarla imzala"
                not={k.tutanak_dosya ? "İmzalı tutanak yüklendi" : "İmzalanan tutanağı tarayıp yükle."}
              >
                <KazaDosyaYukle kazaId={k.id} kisiId={k.kisi_id} belge="tutanak" />
              </Madde>
              {k.tur !== "ramak_kala" && (
                <Madde
                  tamam={!!k.rapor_dosya}
                  baslik="İstirahat raporunu dosyaya ekle"
                  not={k.rapor_dosya ? "Rapor yüklendi" : null}
                >
                  <KazaDosyaYukle kazaId={k.id} kisiId={k.kisi_id} belge="rapor" />
                </Madde>
              )}
              {son && (
                <Madde
                  tamam={!!k.bildirildi_tarihi}
                  baslik="SGK'ya iş kazası bildirimi yap"
                  not={k.bildirildi_tarihi ? `${formatTarih(k.bildirildi_tarihi)} bildirildi` : `Son gün ${formatTarih(son)}`}
                />
              )}
              <Madde
                tamam={!!riskYenilendi}
                baslik="Risk değerlendirmesini yenile"
                not={
                  riskYenilendi
                    ? `${formatTarih(riskYenilendi)} yenilendi`
                    : "Kazadan sonra süre beklenmeden yenilenir; İSG uzmanı yapar."
                }
              >
                <Link href="/isg#isyeri" className="text-sm text-primary hover:underline">
                  İşyeri belgelerine git
                </Link>
              </Madde>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              Tastamam bildirimi senin yerine yapmaz; süreyi tutar ve bilgileri hazırlar.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
