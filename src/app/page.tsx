import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { TakvimSatiri } from "@/components/takvim-satiri";
import { DogumTarihiBul } from "@/components/dogum-tarihi-bul";
import { calisanOzetleriYukle } from "@/lib/calisan-ozet";
import { ayarlarSatiri } from "@/lib/istek";
import { acikModuller } from "@/lib/moduller";
import { bugunIso } from "@/lib/isg";
import { gunEkle, gunFarki, tamYil } from "@/lib/mevzuat";
import { takvimOgeleri } from "@/lib/takvim";
import { takvimVerisiYukle } from "@/lib/takvim-veri";
import { ayAdi, ayKaydir } from "@/lib/puantaj-veri";
import { donemOdenecekTutar, formatTarih } from "@/lib/utils";
import { ISG_BELGE_ETIKETLERI, type IsgBelgeTipi } from "@/lib/types";

// Ana sayfa (20 Ekim 2026): genel durum, yaklaşan süreler,
// doğum günleri, son hareketler. Çalışan listesi /calisanlar'a taşındı.

const YAKLASAN_GUN = 14;
const DOGUM_GUNU_GUN = 30;

const UZUN_GUN = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" });
const GUN_AY = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });
const SAAT = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});
const TL = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

/** Bugünden sonraki (ya da bugünkü) ilk doğum günü; 29 Şubat artık olmayan yılda 1 Mart. */
function siradakiDogumGunu(dogum: string, bugun: string): string {
  const ayGun = dogum.slice(5);
  for (const yil of [Number(bugun.slice(0, 4)), Number(bugun.slice(0, 4)) + 1]) {
    let t = `${yil}-${ayGun}`;
    if (ayGun === "02-29" && new Date(`${t}T00:00:00Z`).getUTCMonth() !== 1) t = `${yil}-03-01`;
    if (t >= bugun) return t;
  }
  return `${Number(bugun.slice(0, 4)) + 1}-${ayGun}`;
}

type Hareket = { zaman: string; metin: string; href: string; uyari?: boolean };

export default async function AnaSayfa() {
  const supabase = await createClient();
  const bugun = bugunIso();
  const buAy = bugun.slice(0, 7);
  const gecenAy = ayKaydir(buAy, -1);

  const [ozet, ayarlar, moduller, { data: aylar }, { data: odemeler }, mailler, girisler, isgler, imzalar, izinler] =
    await Promise.all([
      calisanOzetleriYukle(supabase),
      ayarlarSatiri(),
      acikModuller(),
      supabase.from("puantaj_ay").select("ay, kapandi_at, gonderildi_at").in("ay", [`${gecenAy}-01`, `${buAy}-01`]),
      supabase
        .from("is_girisi")
        .select("giris_tarihi, cikis_tarihi, ucret_tutari, ucret_periyodu")
        .eq("odeme_durumu", "yok"),
      supabase
        .from("mail_gonderim_kaydi")
        .select("created_at, tip, durum, is_girisi(kisi_id, kisi(ad_soyad))")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("is_girisi")
        .select("created_at, giris_tarihi, kisi_id, kisi(ad_soyad)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("isg_belge")
        .select("created_at, belge_tipi, kisi_id, kisi(ad_soyad)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("puantaj_imza")
        .select("yuklendi_at, ay, kisi_id, kisi(ad_soyad)")
        .order("yuklendi_at", { ascending: false })
        .limit(8),
      supabase
        .from("yillik_izin")
        .select("created_at, gun, kisi_id, kisi(ad_soyad)")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
  const girdi = await takvimVerisiYukle(supabase, bugun, ayarlar);

  const { aktifRows, pasifRows } = ozet;
  const tumRows = [...aktifRows, ...pasifRows];
  const eksikToplam = tumRows.reduce((t, r) => t + r.eksikToplam, 0);
  const eksikliler = tumRows
    .filter((r) => r.eksikToplam > 0)
    .sort((a, b) => b.eksikToplam - a.eksikToplam)
    .slice(0, 5);

  const asgari = (ayarlar?.asgari_ucret_aylik as number | undefined) ?? 28075.5;
  const odenmemis = odemeler ?? [];
  const odenmemisTutar = odenmemis.reduce(
    (t, d) => t + donemOdenecekTutar(d.giris_tarihi, d.cikis_tarihi, d.ucret_tutari, asgari, d.ucret_periyodu),
    0,
  );

  const puantajAcik = moduller.includes("puantaj");
  const ayKaydi = (ay: string) => (aylar ?? []).find((a) => String(a.ay).startsWith(ay));
  const gecenKapandi = !!ayKaydi(gecenAy)?.kapandi_at;

  const yaklasan = takvimOgeleri(girdi)
    .filter((o) => o.tarih <= gunEkle(bugun, YAKLASAN_GUN))
    .sort((a, b) => a.tarih.localeCompare(b.tarih));

  const dogumGunleri = aktifRows
    .filter((r) => r.kisi.dogum_tarihi)
    .map((r) => {
      const gun = siradakiDogumGunu(r.kisi.dogum_tarihi!, bugun);
      return { kisi: r.kisi, gun, yas: tamYil(r.kisi.dogum_tarihi!, gun) };
    })
    .filter((d) => gunFarki(bugun, d.gun) <= DOGUM_GUNU_GUN)
    .sort((a, b) => a.gun.localeCompare(b.gun));
  const dogumsuz = tumRows.filter((r) => !r.kisi.dogum_tarihi).map((r) => r.kisi.id);

  type Ad = { kisi: { ad_soyad: string } | null };
  const ad = (x: Ad) => x.kisi?.ad_soyad ?? "?";
  const hareketler: Hareket[] = [
    ...((mailler.data ?? []) as unknown as {
      created_at: string;
      tip: string;
      durum: string;
      is_girisi: { kisi_id: string; kisi: { ad_soyad: string } | null } | null;
    }[]).map((m) => ({
      zaman: m.created_at,
      metin:
        m.durum === "basarili"
          ? `${m.is_girisi?.kisi?.ad_soyad ?? "?"} için muhasebeye ${m.tip === "giris" ? "giriş" : "çıkış"} maili gitti`
          : `${m.is_girisi?.kisi?.ad_soyad ?? "?"} için ${m.tip === "giris" ? "giriş" : "çıkış"} maili gönderilemedi`,
      href: `/kisi/${m.is_girisi?.kisi_id ?? ""}`,
      uyari: m.durum !== "basarili",
    })),
    ...((girisler.data ?? []) as unknown as (Ad & { created_at: string; giris_tarihi: string; kisi_id: string })[]).map(
      (g) => ({
        zaman: g.created_at,
        metin: `${ad(g)} için iş dönemi açıldı, giriş ${formatTarih(g.giris_tarihi)}`,
        href: `/kisi/${g.kisi_id}`,
      }),
    ),
    ...((isgler.data ?? []) as unknown as (Ad & { created_at: string; belge_tipi: IsgBelgeTipi; kisi_id: string })[]).map(
      (b) => ({
        zaman: b.created_at,
        metin: `${ad(b)}: ${ISG_BELGE_ETIKETLERI[b.belge_tipi] ?? "İSG belgesi"} eklendi`,
        href: `/kisi/${b.kisi_id}`,
      }),
    ),
    ...((imzalar.data ?? []) as unknown as (Ad & { yuklendi_at: string; ay: string; kisi_id: string })[]).map((p) => ({
      zaman: p.yuklendi_at,
      metin: `${ad(p)}: ${ayAdi(String(p.ay).slice(0, 7))} imzalı puantajı yüklendi`,
      href: `/puantaj?ay=${String(p.ay).slice(0, 7)}`,
    })),
    ...((izinler.data ?? []) as unknown as (Ad & { created_at: string; gun: number; kisi_id: string })[]).map((i) => ({
      zaman: i.created_at,
      metin: `${ad(i)} için ${i.gun} gün yıllık izin girildi`,
      href: "/izin",
    })),
  ]
    .filter((h) => h.zaman)
    .sort((a, b) => b.zaman.localeCompare(a.zaman))
    .slice(0, 8);

  const gecikmis = yaklasan.filter((o) => o.tarih < bugun).length;
  const ozetCumlesi = [
    eksikToplam ? `Dosyalarda ${eksikToplam} eksik var` : "Dosyalarda eksik yok",
    yaklasan.length
      ? `önümüzdeki iki haftada ${yaklasan.length - gecikmis} süre doluyor${gecikmis ? `, ${gecikmis} süre geçti` : ""}`
      : "önümüzdeki iki haftada dolan süre yok",
  ].join(", ");

  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8 p-4 sm:p-8">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em] first-letter:uppercase sm:text-[34px]">
            {UZUN_GUN.format(new Date(`${bugun}T00:00:00Z`))}
          </h1>
          <p className="mt-1 text-muted-foreground">{ozetCumlesi}.</p>
        </div>

        <section aria-label="Genel durum" className="grid grid-cols-2 border border-border bg-card lg:grid-cols-4">
          <Rakam
            href="/calisanlar"
            deger={String(aktifRows.length)}
            etiket="aktif çalışan"
            alt={`${pasifRows.length} pasif`}
          />
          <Rakam
            href="/calisanlar"
            deger={eksikToplam ? String(eksikToplam) : "Tastamam"}
            etiket={eksikToplam ? "eksik evrak ve kayıt" : "tüm dosyalar tam"}
            alt={eksikToplam ? `${tumRows.filter((r) => r.eksikToplam > 0).length} kişide` : undefined}
            renk={eksikToplam ? "warn" : "stamp"}
          />
          {puantajAcik ? (
            <Rakam
              href={`/puantaj?ay=${gecenKapandi ? buAy : gecenAy}`}
              deger={gecenKapandi ? "Açık" : "Kapanmadı"}
              etiket={gecenKapandi ? `${ayAdi(buAy)} puantajı` : `${ayAdi(gecenAy)} puantajı`}
              alt={
                gecenKapandi
                  ? ayKaydi(gecenAy)?.gonderildi_at
                    ? `${ayAdi(gecenAy)} muhasebeye gitti`
                    : `${ayAdi(gecenAy)} kapandı, mail gitmedi`
                  : "kapatıp muhasebeye gönder"
              }
              renk={gecenKapandi ? undefined : "warn"}
            />
          ) : (
            <Rakam href="/izin" deger="—" etiket="puantaj kapalı" alt="Ayarlar'dan açılır" />
          )}
          <Rakam
            href="/odemeler"
            deger={String(odenmemis.length)}
            etiket="ödenmemiş iş dönemi"
            alt={odenmemis.length ? `${TL.format(odenmemisTutar)} TL` : "hepsi ödendi"}
            renk={odenmemis.length ? "warn" : undefined}
          />
        </section>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-8">
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <h2 className="text-[18px] font-bold">Yaklaşan süreler</h2>
                {moduller.includes("takvim") && (
                  <Link href="/takvim" className="text-sm text-primary hover:underline">
                    Takvim
                  </Link>
                )}
              </div>
              {yaklasan.length === 0 ? (
                <p className="border border-border bg-card px-4 py-6">
                  Önümüzdeki iki haftada dolan bir süre yok. Her şey tastamam.
                </p>
              ) : (
                <div className="border border-border bg-card">
                  {yaklasan.map((o) => (
                    <TakvimSatiri key={`${o.tarih}${o.metin}`} o={o} bugun={bugun} />
                  ))}
                </div>
              )}
            </section>

            {eksikliler.length > 0 && (
              <section>
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <h2 className="text-[18px] font-bold">En çok eksiği olan dosyalar</h2>
                  <Link href="/calisanlar" className="text-sm text-primary hover:underline">
                    Tüm çalışanlar
                  </Link>
                </div>
                <div className="border border-border bg-card">
                  {eksikliler.map((r) => (
                    <Link
                      key={r.kisi.id}
                      href={`/kisi/${r.kisi.id}`}
                      className="flex items-baseline justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/40"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {r.kisi.ad_soyad}
                        <span className="ml-2 text-[13px] font-normal text-muted-foreground">
                          {r.aktif ? "aktif" : "pasif"}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-bold text-[var(--warn)]">{r.eksikToplam} eksik</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-8">
            <section>
              <h2 className="mb-2 text-[18px] font-bold">Doğum günleri</h2>
              <div className="border border-border bg-card">
                {dogumGunleri.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">Önümüzdeki 30 günde doğum günü yok.</p>
                ) : (
                  dogumGunleri.map((d) => {
                    const f = gunFarki(bugun, d.gun);
                    return (
                      <Link
                        key={d.kisi.id}
                        href={`/kisi/${d.kisi.id}`}
                        className="flex items-baseline justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{d.kisi.ad_soyad}</span>
                          <span className="text-[13px] text-muted-foreground">{d.yas} yaşına giriyor</span>
                        </span>
                        <span
                          className={`shrink-0 text-right font-mono text-[13px] ${f === 0 ? "font-bold text-[var(--pen)]" : ""}`}
                        >
                          {f === 0 ? "bugün" : f === 1 ? "yarın" : GUN_AY.format(new Date(`${d.gun}T00:00:00Z`))}
                        </span>
                      </Link>
                    );
                  })
                )}
                {dogumsuz.length > 0 && (
                  <div className="border-t border-border px-4 py-3">
                    <DogumTarihiBul kisiIdler={dogumsuz} />
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[18px] font-bold">Son hareketler</h2>
              <div className="border border-border bg-card">
                {hareketler.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">Henüz bir hareket yok.</p>
                ) : (
                  hareketler.map((h, i) => (
                    <Link
                      key={`${h.zaman}${i}`}
                      href={h.href}
                      className="block border-b border-border/60 px-4 py-2.5 last:border-b-0 hover:bg-muted/40"
                    >
                      <span className="block font-mono text-[12px] text-muted-foreground">
                        {SAAT.format(new Date(h.zaman))}
                      </span>
                      <span className={`text-[14px] ${h.uyari ? "font-medium text-[var(--warn)]" : ""}`}>{h.metin}</span>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

/** Genel durum şeridinin bir hücresi: büyük rakam, altında ne olduğu. */
function Rakam({
  href,
  deger,
  etiket,
  alt,
  renk,
}: {
  href: string;
  deger: string;
  etiket: string;
  alt?: string;
  renk?: "warn" | "stamp";
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col gap-0.5 border-border px-4 py-4 hover:bg-muted/40 max-lg:[&:nth-child(-n+2)]:border-b [&:not(:last-child)]:border-r max-lg:[&:nth-child(2)]:border-r-0 sm:px-5"
    >
      <span
        className={`font-mono text-[26px] font-medium leading-tight tracking-[-0.02em] sm:text-[30px] ${
          renk === "warn" ? "text-[var(--warn)]" : renk === "stamp" ? "text-[var(--stamp)]" : ""
        }`}
      >
        {deger}
      </span>
      <span className="text-[14px] font-medium">{etiket}</span>
      {alt && <span className="truncate text-[13px] text-muted-foreground">{alt}</span>}
    </Link>
  );
}
