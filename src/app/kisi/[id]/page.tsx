import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { kazaSonGun } from "@/lib/isg-takip";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ayarlarSatiri } from "@/lib/istek";
import {
  kisiBelgeYoksay,
  kisiBelgeGeriAl,
  isGirisiBelgeYoksay,
  isGirisiBelgeGeriAl,
  girisMailiGonder,
  cikisMailiGonder,
} from "@/app/actions";
import { BelgeSatiri } from "@/components/belge-satiri";
import { KvkkIndirDugmesi } from "@/components/sablon-formlari";
import { IsgBelgeSatiri } from "@/components/isg-belge-satiri";
import { IsgPaketYukleme } from "@/components/isg-paket-yukleme";
import { bugunIso, isgOzeti } from "@/lib/isg";
import { KlasorTaraButonu, PasifeTasiButonu } from "@/components/klasor-tara";
import { SozlesmeOlustur } from "@/components/sozlesme-olustur";
import { MailGonderButonu } from "@/components/mail-gonder-butonu";
import { DonemAksiyonlari } from "@/components/donem-aksiyonlari";
import { OdemeSatiri } from "@/components/odeme-listesi";
import { DogumTarihiAlani } from "@/components/dogum-tarihi-alani";
import { PuantajBelgeSatiri } from "@/components/puantaj-belge-satiri";
import { donemPuantajlari, puantajBelgeVerisiYukle } from "@/lib/puantaj-belge";
import { ayAdi } from "@/lib/puantaj-veri";
import { formatDonemAraligi, donemOdenecekTutar, formatPara, formatTarih } from "@/lib/utils";
import {
  KOK_BELGE_TIPLERI,
  KOK_BELGE_ETIKETLERI,
  DONEM_BELGE_TIPLERI,
  DONEM_BELGE_ETIKETLERI,
  ISG_BELGE_TIPLERI,
  ISG_BELGE_ETIKETLERI,
  type Kisi,
  type IsGirisi,
  type KisiBelge,
  type IsGirisiBelge,
  type IsgBelge,
  type MailGonderimKaydi,
  KAZA_TURU_ADI,
  type IsKazasi,
} from "@/lib/types";

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function KisiDetay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Bağımsız sorgular paralel (her biri ~100 ms Atlantik gidiş-dönüşü,
  // bkz. lib/istek.ts).
  const [
    { data: kisi },
    ayarlarSatiri_,
    { data: kisiBelgeleri },
    { data: isgBelgeleri },
    { data: donemler },
    puantajVeri,
    { data: kazalar },
  ] = await Promise.all([
    supabase.from("kisi").select("*").eq("id", id).maybeSingle<Kisi>(),
    ayarlarSatiri(),
    supabase.from("kisi_belge").select("*").eq("kisi_id", id).returns<KisiBelge[]>(),
    supabase.from("isg_belge").select("*").eq("kisi_id", id).returns<IsgBelge[]>(),
    supabase
      .from("is_girisi")
      .select("*")
      .eq("kisi_id", id)
      .order("giris_tarihi", { ascending: false })
      .returns<IsGirisi[]>(),
    // Puantaj modülü açıksa her dönemin her ayı evrak listesinde bir satır.
    puantajBelgeVerisiYukle(supabase, bugunIso(), [id]),
    // İş kazası kayıtları (İSG modülü, 0026; tablo yoksa boş döner).
    supabase.from("is_kazasi").select("*").eq("kisi_id", id).order("olay_tarihi", { ascending: false }).returns<IsKazasi[]>(),
  ]);

  if (!kisi) notFound();

  const asgariUcretAylik = ayarlarSatiri_?.asgari_ucret_aylik ?? 28075.5;
  const isgModulu = ((ayarlarSatiri_?.acik_moduller as string[] | null) ?? []).includes("isg");
  const isg = isgOzeti(isgBelgeleri ?? []);
  const isgYenilenecek = !!isg.sertifika && !isg.sertifika.gecerli;

  const donemIds = (donemler ?? []).map((d) => d.id);
  const [{ data: donemBelgeleri }, { data: mailKayitlari }] = donemIds.length
    ? await Promise.all([
        supabase.from("is_girisi_belge").select("*").in("is_girisi_id", donemIds).returns<IsGirisiBelge[]>(),
        supabase
          .from("mail_gonderim_kaydi")
          .select("*")
          .in("is_girisi_id", donemIds)
          .order("created_at", { ascending: true })
          .returns<MailGonderimKaydi[]>(),
      ])
    : [{ data: [] as IsGirisiBelge[] }, { data: [] as MailGonderimKaydi[] }];

  // en son kayıt üstteki değeri ezer (created_at artan sırayla geliyor)
  const sonMailMap = new Map<string, MailGonderimKaydi>();
  for (const kayit of mailKayitlari ?? []) {
    sonMailMap.set(`${kayit.is_girisi_id}:${kayit.tip}`, kayit);
  }

  const kokBelgeMap = new Map((kisiBelgeleri ?? []).map((b) => [b.belge_tipi, b]));

  const donemBelgeMap = new Map<string, Map<string, IsGirisiBelge>>();
  for (const b of donemBelgeleri ?? []) {
    if (!donemBelgeMap.has(b.is_girisi_id)) {
      donemBelgeMap.set(b.is_girisi_id, new Map());
    }
    donemBelgeMap.get(b.is_girisi_id)!.set(b.belge_tipi, b);
  }

  const aktifDonem = (donemler ?? []).find((d) => d.durum === "aktif");

  const puantajByDonem = new Map(
    (donemler ?? []).map((d) => [
      d.id,
      donemPuantajlari({ veri: puantajVeri, kisiId: id, adSoyad: kisi.ad_soyad, donem: d, tumDonemler: donemler ?? [] }),
    ]),
  );

  const odenecekToplam = (donemler ?? [])
    .filter((d) => d.odeme_durumu === "yok")
    .reduce(
      (acc, d) => acc + donemOdenecekTutar(d.giris_tarihi, d.cikis_tarihi, d.ucret_tutari, asgariUcretAylik, d.ucret_periyodu),
      0,
    );

  return (
    <>
    <AppHeader aktif="calisanlar" />
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-7 p-4 sm:p-8">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">{kisi.ad_soyad}</h1>
        <div className="mt-1 text-muted-foreground">
          {kisi.meslek_adi}
          {kisi.meslek_adi ? " · " : ""}
          {aktifDonem ? (
            <>
              Aktif, <span className="font-mono text-[14px]">{formatTarih(aktifDonem.giris_tarihi)}</span>
              {"'den beri"}
            </>
          ) : (
            "Pasif"
          )}
        </div>
        <DogumTarihiAlani kisiId={kisi.id} dogumTarihi={kisi.dogum_tarihi} />
        {odenecekToplam > 0 && (
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground">Ödenecek tutar: </span>
            <span className="font-mono font-medium text-[var(--warn)]">
              {formatPara(odenecekToplam)}
            </span>
          </div>
        )}
        {(kazalar ?? [])
          .filter((z) => z.tur !== "ramak_kala" && !z.bildirildi_tarihi)
          .map((z) => {
            const son = kazaSonGun(z);
            return (
              <Link
                key={z.id}
                href={`/isg/kaza/${z.id}`}
                className="mt-3 block w-fit border-l-[3px] border-[var(--warn)] bg-card px-3 py-2 text-sm hover:bg-muted/40"
              >
                <span className="font-bold text-[var(--warn)]">
                  {formatTarih(z.olay_tarihi)} tarihli {KAZA_TURU_ADI[z.tur].toLocaleLowerCase("tr")} SGK&apos;ya
                  bildirilmedi.
                </span>{" "}
                {son && <>Son gün {formatTarih(son)}. </>}
                <span className="text-primary">Kayda git</span>
              </Link>
            );
          })}
      </div>

      <div className="flex flex-wrap gap-3">
        <KlasorTaraButonu kisiId={kisi.id} />
        {!aktifDonem && <PasifeTasiButonu kisiId={kisi.id} />}
      </div>

      <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-6">
        <div className="border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3.5 text-[18px] font-bold sm:px-5">Özlük evrakı</h2>
        <div className="px-4 sm:px-5">
          {KOK_BELGE_TIPLERI.map((tip) => {
            const row = kokBelgeMap.get(tip);
            // Açık rıza yalnızca Ayarlar'da açıksa (ya da daha önce kaydı varsa) görünür.
            if (tip === "kvkk_acik_riza" && !ayarlarSatiri_?.kvkk_acik_riza && !row) return null;
            const kvkk = tip === "kvkk_aydinlatma" || tip === "kvkk_acik_riza";
            return (
              <BelgeSatiri
                ek={kvkk && row?.durum !== "var" ? <KvkkIndirDugmesi kisiId={kisi.id} ad={tip} /> : undefined}
                key={tip}
                label={KOK_BELGE_ETIKETLERI[tip]}
                durum={row?.durum}
                notu={row?.notu}
                yoksayAction={kisiBelgeYoksay}
                geriAlAction={kisiBelgeGeriAl}
                yuklemeIstegi={{ tur: "kok", kisiId: kisi.id, belgeTipi: tip }}
                hiddenFields={{ kisi_id: kisi.id, belge_tipi: tip }}
              />
            );
          })}
        </div>
        </div>

        <div className="border border-border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          <h2 className="text-[18px] font-bold">İSG</h2>
          <span
            className={`text-[12.5px] ${
              isg.sertifika?.gecerli
                ? "text-muted-foreground"
                : "font-bold text-[var(--warn)]"
            }`}
          >
            {!isg.sertifika
              ? "Temel eğitim sertifikası yok"
              : isg.sertifika.gecerli
                ? isg.sertifika.gecerlilikTarihi
                  ? `Sertifika geçerli: ${formatTarih(isg.sertifika.gecerlilikTarihi)} tarihine kadar`
                  : "Sertifika geçerli (geçerlilik tarihi girilmemiş)"
                : `Sertifikanın süresi doldu (${formatTarih(isg.sertifika.gecerlilikTarihi!)}) — yenilenecek`}
          </span>
        </div>
        <div className="px-4 pt-3 sm:px-5">
          <IsgPaketYukleme kisiId={kisi.id} acik={!isg.sertifika?.gecerli} />
        </div>
        <div className="px-4 sm:px-5">
          {ISG_BELGE_TIPLERI.map((tip) => {
            const d = isg.tipler[tip];
            return (
              <IsgBelgeSatiri
                key={tip}
                kisiId={kisi.id}
                tip={tip}
                label={ISG_BELGE_ETIKETLERI[tip]}
                durum={d.durum}
                alinmaTarihi={d.alinmaTarihi}
                gecmisTarihleri={d.gecmis.map((g) => g.alinma_tarihi!)}
                yenilenecek={isgYenilenecek}
              />
            );
          })}
        </div>
        </div>

        {(isgModulu || (kazalar ?? []).length > 0) && (
          <div className="border border-border bg-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
              <h2 className="text-[18px] font-bold">İş kazaları</h2>
              {isgModulu && (
                <Link href={`/isg/kaza/yeni?kisi=${kisi.id}`} className="text-[13px] text-primary hover:underline">
                  İş kazası kaydet
                </Link>
              )}
            </div>
            {(kazalar ?? []).length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">Kayıt yok.</p>
            ) : (
              (kazalar ?? []).map((z) => {
                const son = kazaSonGun(z);
                return (
                  <Link
                    key={z.id}
                    href={`/isg/kaza/${z.id}`}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/40 sm:px-5"
                  >
                    <span className="font-mono text-[13px]">{formatTarih(z.olay_tarihi)}</span>
                    <span className="min-w-0 flex-1 text-[14px]">
                      <span className="font-medium">{KAZA_TURU_ADI[z.tur]}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {z.aciklama.length > 50 ? `${z.aciklama.slice(0, 50)}…` : z.aciklama}
                      </span>
                    </span>
                    <span className="text-[12.5px]">
                      {z.tur === "ramak_kala" ? (
                        <span className="text-muted-foreground">Bildirim gerekmez</span>
                      ) : z.bildirildi_tarihi ? (
                        <span className="font-medium text-[var(--stamp)]">SGK&apos;ya bildirildi</span>
                      ) : (
                        <span className="font-bold text-[var(--warn)]">
                          Bildirim bekliyor{son ? `, son gün ${formatTarih(son, false)}` : ""}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </section>

      <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
        <h2 className="text-[18px] font-bold">İş dönemleri</h2>
        {(donemler ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Henüz iş girişi yok.</p>
        )}
        <div className="flex flex-col gap-2.5">
          {(donemler ?? []).map((donem) => {
            const belgeMap = donemBelgeMap.get(donem.id) ?? new Map();
            let variSayisi = 0;
            let yoksaySayisi = 0;
            for (const tip of DONEM_BELGE_TIPLERI) {
              const durum = belgeMap.get(tip)?.durum;
              if (durum === "var") variSayisi++;
              if (durum === "yoksayildi") yoksaySayisi++;
            }
            // Ödeme de "eksik" sayısına dahil — belge gibi tek bir kalem (Faz 11 revize).
            if (donem.odeme_durumu === "var") variSayisi++;
            if (donem.odeme_durumu === "yoksayildi") yoksaySayisi++;
            const puantajlar = puantajByDonem.get(donem.id) ?? [];
            const eksikSayisi =
              DONEM_BELGE_TIPLERI.length + 1 - variSayisi - yoksaySayisi + puantajlar.filter((p) => p.eksik).length;
            const acik = donem.durum === "aktif" && !donem.cikis_tarihi;

            return (
              <details key={donem.id} className="group border border-border bg-card" open={acik}>
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3">
                    <ChevronIcon />
                    <span className="font-mono text-[14px] font-medium">
                      {formatDonemAraligi(donem.giris_tarihi, donem.cikis_tarihi)}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {donem.durum === "aktif" ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  {acik ? (
                    <span className="text-[12.5px] text-muted-foreground">Devam ediyor</span>
                  ) : eksikSayisi === 0 ? (
                    <span className="text-[13px] font-bold text-[var(--ok)]">Tastamam</span>
                  ) : (
                    <span className="text-[12.5px] font-bold text-[var(--warn)]">
                      {eksikSayisi} eksik
                    </span>
                  )}
                </summary>
                <div className="border-t border-border px-4">
                  {DONEM_BELGE_TIPLERI.map((tip) => {
                    const row = belgeMap.get(tip);
                    return (
                      <BelgeSatiri
                        key={tip}
                        label={DONEM_BELGE_ETIKETLERI[tip]}
                        durum={row?.durum}
                        notu={row?.notu}
                        yoksayAction={isGirisiBelgeYoksay}
                        geriAlAction={isGirisiBelgeGeriAl}
                        yuklemeIstegi={{
                          tur: "donem",
                          kisiId: kisi.id,
                          isGirisiId: donem.id,
                          belgeTipi: tip,
                        }}
                        hiddenFields={{
                          kisi_id: kisi.id,
                          is_girisi_id: donem.id,
                          belge_tipi: tip,
                        }}
                      />
                    );
                  })}
                  {puantajlar.map((p) => (
                    <PuantajBelgeSatiri
                      key={p.ay}
                      kisiId={kisi.id}
                      ay={p.ay}
                      ayAdi={ayAdi(p.ay)}
                      saatsizGun={p.saatsizGun}
                      imzaliAt={p.imzaliAt}
                      vadesi={p.vadesi}
                    />
                  ))}
                  <OdemeSatiri
                    kisiId={kisi.id}
                    isGirisiId={donem.id}
                    odemeDurumu={donem.odeme_durumu}
                    odemeTarihi={donem.odeme_tarihi}
                    tutar={donemOdenecekTutar(
                      donem.giris_tarihi,
                      donem.cikis_tarihi,
                      donem.ucret_tutari,
                      asgariUcretAylik,
                      donem.ucret_periyodu,
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1 border-t border-border px-4 py-2">
                  <MailGonderButonu
                    label="Muhasebeye giriş bildirgesi maili gönder"
                    action={girisMailiGonder}
                    hiddenFields={{ kisi_id: kisi.id, is_girisi_id: donem.id }}
                    sonKayit={sonMailMap.get(`${donem.id}:giris`)}
                  />
                  {donem.cikis_tarihi && (
                    <MailGonderButonu
                      label="Muhasebeye ayrılış bildirgesi maili gönder"
                      action={cikisMailiGonder}
                      hiddenFields={{ kisi_id: kisi.id, is_girisi_id: donem.id }}
                      sonKayit={sonMailMap.get(`${donem.id}:cikis`)}
                    />
                  )}
                </div>
                <div className="border-t border-border px-4 py-3">
                  <SozlesmeOlustur
                    kisiId={kisi.id}
                    meslekAdi={donem.meslek_adi ?? kisi.meslek_adi}
                    adresBaslangic={kisi.adres}
                    ucretBaslangic={donem.ucret_tutari}
                    ucretPeriyodu={donem.ucret_periyodu}
                    girisTarihi={donem.giris_tarihi}
                    cikisTarihi={donem.cikis_tarihi}
                  />
                </div>
                <DonemAksiyonlari
                  kisiId={kisi.id}
                  isGirisi={donem}
                  girisBildirgesiVar={belgeMap.get("isegiris_bildirgesi")?.durum === "var"}
                />
              </details>
            );
          })}
        </div>
      </section>
      </div>
    </div>
    </>
  );
}
