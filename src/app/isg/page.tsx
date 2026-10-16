import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ModulKapali } from "@/components/modul-kapali";
import { IsyeriBelgeFormu, TehlikeSinifiFormu } from "@/components/isg-formlari";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ayarlarSatiri } from "@/lib/istek";
import { acikModuller } from "@/lib/moduller";
import { bugunIso } from "@/lib/isg";
import { calisanIsgTakibi, isyeriBelgeTakibi, kazaSonGun, ISYERI_BELGE_ADI, type Vade } from "@/lib/isg-takip";
import { ISG, ISG_DAYANAK, TEHLIKE_SINIFI_ADI, gunEkle, type TehlikeSinifi } from "@/lib/mevzuat";
import { KAZA_TURU_ADI, type IsgBelge, type IsKazasi, type IsyeriBelge } from "@/lib/types";
import { formatTarih } from "@/lib/utils";

// İSG periyodik takip (15 Ekim 2026, Faz D paket 1). Onaylı tasarım:
// marka/ekranlar-v1/Isg.dc.html.

function VadeHucresi({ v, tamamMetni }: { v: Vade; tamamMetni?: string }) {
  if (v.durum === "gereksiz") return <span className="text-muted-foreground">Gerekli değil</span>;
  if (!v.sonraki) return <span className="font-medium text-[var(--stamp)]">{tamamMetni ?? "Tamam"}</span>;
  const renk =
    v.durum === "gecikti" || v.durum === "yaklasiyor"
      ? "font-medium text-[var(--warn)]"
      : v.durum === "eksik"
        ? "text-foreground"
        : "text-muted-foreground";
  return (
    <span className={`font-mono text-[13px] ${renk}`}>
      {formatTarih(v.sonraki)}
      {v.durum === "gecikti" && " · gecikti"}
    </span>
  );
}

function SonTarih({ v, yoksa }: { v: Vade; yoksa: string }) {
  if (v.son) return <span className="font-mono text-[13px]">{formatTarih(v.son)}</span>;
  if (v.durum === "gereksiz") return <span className="text-muted-foreground">—</span>;
  return <span className="text-[var(--warn)]">{yoksa}</span>;
}

export default async function IsgSayfasi() {
  if (!(await acikModuller()).includes("isg")) return <ModulKapali aktif="isg" ad="İSG" />;
  const supabase = await createClient();
  const bugun = bugunIso();
  const yilOnce = gunEkle(bugun, -365);

  const [ayarlar, { data: donemler }, { data: isgBelgeleri }, { data: isyeri }, { data: kazalar }] = await Promise.all([
    ayarlarSatiri(),
    supabase
      .from("is_girisi")
      .select("kisi_id, giris_tarihi, cikis_tarihi, kisi:kisi_id(ad_soyad)")
      .or(`cikis_tarihi.is.null,cikis_tarihi.gte.${bugun}`)
      .returns<{ kisi_id: string; giris_tarihi: string; cikis_tarihi: string | null; kisi: { ad_soyad: string } | null }[]>(),
    supabase.from("isg_belge").select("*").returns<IsgBelge[]>(),
    supabase.from("isyeri_belge").select("*").order("yapilma_tarihi", { ascending: false }).returns<IsyeriBelge[]>(),
    supabase
      .from("is_kazasi")
      .select("*, kisi:kisi_id(ad_soyad)")
      .order("olay_tarihi", { ascending: false })
      .returns<(IsKazasi & { kisi: { ad_soyad: string } | null })[]>(),
  ]);

  const sinif = (ayarlar?.isg_tehlike_sinifi as TehlikeSinifi | null | undefined) ?? null;

  if (!sinif) {
    return (
      <>
        <AppHeader aktif="isg" />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-8">
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">İş sağlığı ve güvenliği</h1>
          <p className="text-muted-foreground">
            Eğitim ve sağlık muayenesi süreleri işyerinin tehlike sınıfına göre değişir. Önce sınıfını seç, süreleri
            ona göre hesaplayalım.
          </p>
          <section className="border border-border bg-card p-5">
            <TehlikeSinifiFormu sinif={null} />
          </section>
        </div>
      </>
    );
  }

  const k = ISG[sinif];
  // Kişi başına en son başlayan aktif dönem.
  const aktif = new Map<string, { adSoyad: string; giris: string }>();
  for (const d of donemler ?? []) {
    if (d.giris_tarihi > bugun) continue;
    const o = aktif.get(d.kisi_id);
    if (!o || o.giris < d.giris_tarihi) aktif.set(d.kisi_id, { adSoyad: d.kisi?.ad_soyad ?? "", giris: d.giris_tarihi });
  }
  const satirlar = [...aktif.entries()]
    .map(([kisiId, a]) => ({
      kisiId,
      adSoyad: a.adSoyad,
      t: calisanIsgTakibi({
        sinif,
        girisTarihi: a.giris,
        belgeler: (isgBelgeleri ?? []).filter((b) => b.kisi_id === kisiId),
        bugun,
      }),
    }))
    .sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, "tr"));

  const tumKazalar = kazalar ?? [];
  const sonKaza =
    tumKazalar
      .filter((z) => z.tur !== "ramak_kala")
      .map((z) => z.olay_tarihi)
      .sort()
      .at(-1) ?? null;
  const isyeriTakip = isyeriBelgeTakibi({ sinif, belgeler: isyeri ?? [], sonKaza, bugun });
  const gorunenKazalar = tumKazalar.filter((z) => z.olay_tarihi >= yilOnce || (!z.bildirildi_tarihi && z.tur !== "ramak_kala"));

  return (
    <>
      <AppHeader aktif="isg" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-7 p-4 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">İş sağlığı ve güvenliği</h1>
            <p className="mt-1 text-muted-foreground">
              İşyerin {TEHLIKE_SINIFI_ADI[sinif]} sınıfta: temel eğitim {k.temelEgitimSaat} saat ve{" "}
              {k.egitimTekrarYil === 1 ? "yılda bir" : `${k.egitimTekrarYil} yılda bir`} tekrar, sağlık muayenesi{" "}
              {k.saglikMuayeneYil === 1 ? "yılda bir" : `${k.saglikMuayeneYil} yılda bir`}.{" "}
              <a href="#sinif" className="text-primary hover:underline">
                Değiştir
              </a>
            </p>
            <p className="mt-1 font-mono text-[12px] text-muted-foreground">
              6331 s.K. md. 15, 17 · {ISG_DAYANAK.egitim} · {ISG_DAYANAK.muayene}
            </p>
          </div>
          <Link href="/isg/kaza/yeni" className={buttonVariants()}>
            İş kazası kaydet
          </Link>
        </div>

        <section>
          <h2 className="mb-3 text-[18px] font-bold">Çalışanlar</h2>
          {satirlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aktif çalışan yok.</p>
          ) : (
            <div className="overflow-x-auto border border-border bg-card">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="text-left text-[13px] text-muted-foreground">
                    <th className="border-b border-border px-4 py-2.5 font-medium">Çalışan</th>
                    <th className="border-b border-border px-3 py-2.5 font-medium">İşe başlama eğitimi</th>
                    <th className="border-b border-border px-3 py-2.5 font-medium">Temel eğitim</th>
                    <th className="border-b border-border px-3 py-2.5 font-medium">Sonraki eğitim</th>
                    <th className="border-b border-border px-3 py-2.5 font-medium">Sağlık muayenesi</th>
                    <th className="border-b border-border px-4 py-2.5 font-medium">Sonraki muayene</th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map(({ kisiId, adSoyad, t }) => (
                    <tr key={kisiId} className="border-b border-border/60 last:border-b-0">
                      <td className="px-4 py-2.5 font-medium">
                        <Link href={`/kisi/${kisiId}`} className="hover:text-primary">
                          {adSoyad}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3">
                        {t.iseBaslama.durum === "tamam" ? (
                          <span className="font-mono text-[13px] font-medium text-[var(--stamp)]">
                            {formatTarih(t.iseBaslama.son!)}
                          </span>
                        ) : (
                          <SonTarih v={t.iseBaslama} yoksa="Kayıt yok" />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3">
                        <SonTarih v={t.egitim} yoksa="Henüz yok" />
                      </td>
                      <td className="whitespace-nowrap px-3">
                        <VadeHucresi v={t.egitim} />
                      </td>
                      <td className="whitespace-nowrap px-3">
                        <SonTarih v={t.muayene} yoksa="Rapor yok" />
                      </td>
                      <td className="whitespace-nowrap px-4">
                        <VadeHucresi v={t.muayene} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Sertifika, sağlık raporu ve oryantasyon formu çalışanın sayfasındaki İSG bölümünden yüklenir; tarihler
            oradan gelir. Yeni çalışanın temel eğitimi işe girişten sonra en geç 3 ay içinde verilir.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-bold">İş kazaları, son 12 ay</h2>
          {gorunenKazalar.length === 0 ? (
            <p className="border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              Son 12 ayda kayıt yok.
            </p>
          ) : (
            <div className="border border-border bg-card">
              {gorunenKazalar.map((z) => {
                const son = kazaSonGun(z);
                return (
                  <Link
                    key={z.id}
                    href={`/isg/kaza/${z.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/40"
                  >
                    <span className="w-24 font-mono text-[13px]">{formatTarih(z.olay_tarihi)}</span>
                    <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                      <span className="font-medium">{z.kisi?.ad_soyad}</span>
                      <span className="text-muted-foreground"> · {z.aciklama.length > 60 ? `${z.aciklama.slice(0, 60)}…` : z.aciklama}</span>
                    </span>
                    <span className="text-[13px]">
                      {z.tur === "ramak_kala" ? (
                        <span className="text-muted-foreground">{KAZA_TURU_ADI.ramak_kala}</span>
                      ) : z.bildirildi_tarihi ? (
                        <span className="font-medium text-[var(--stamp)]">Bildirildi</span>
                      ) : (
                        <span className="font-medium text-[var(--warn)]">
                          Bildirim bekliyor{son ? `, son gün ${formatTarih(son, false)}` : ""}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section id="isyeri">
          <h2 className="mb-3 text-[18px] font-bold">İşyeri belgeleri</h2>
          <div className="border border-border bg-card">
            <div className="grid divide-y divide-border/60 md:grid-cols-3 md:divide-x md:divide-y-0">
              {isyeriTakip.map((b) => (
                <div key={b.tip} className="flex flex-col gap-1 px-4 py-3">
                  <span className="font-medium">{ISYERI_BELGE_ADI[b.tip]}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {b.son ? `Son: ${formatTarih(b.son)}` : "Kayıt yok"}
                  </span>
                  <span className="text-[13px]">
                    {b.kazaSonrasiYenilenmeli ? (
                      <span className="font-medium text-[var(--warn)]">İş kazasından sonra yenilenmeli</span>
                    ) : b.durum === "eksik" ? (
                      <span className="text-[var(--warn)]">Tarihini aşağıdan gir</span>
                    ) : (
                      <span className={b.durum === "tamam" ? "font-medium text-[var(--stamp)]" : "font-medium text-[var(--warn)]"}>
                        {b.durum === "tamam" ? "Güncel · " : "Yenileme "}
                        <span className="font-mono">{formatTarih(b.sonraki!)}</span>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border bg-muted/30 px-4 py-4">
              <p className="mb-3 text-sm font-bold">Yapıldı olarak kaydet</p>
              <IsyeriBelgeFormu />
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Risk değerlendirmesi ve acil durum planı {k.riskDegerlendirmeYil} yılda bir, tatbikat yılda bir yenilenir.
            İş kazasından sonra risk değerlendirmesi süre beklenmeden yenilenir.{" "}
            <span className="font-mono text-[12px]">
              {ISG_DAYANAK.risk} · {ISG_DAYANAK.acilDurum}
            </span>
          </p>
        </section>

        <section id="sinif">
          <h2 className="mb-3 text-[18px] font-bold">Tehlike sınıfı</h2>
          <div className="border border-border bg-card p-4 sm:p-5">
            <TehlikeSinifiFormu sinif={sinif} />
          </div>
        </section>
      </div>
    </>
  );
}
