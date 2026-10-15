import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { ayarlarSatiri } from "@/lib/istek";
import { formatDonemAraligi, formatPara, formatTarih, donemOdenecekTutar } from "@/lib/utils";

type DonemSatiri = {
  id: string;
  giris_tarihi: string;
  cikis_tarihi: string | null;
  ucret_tutari: number | null;
  ucret_periyodu: "gunluk" | "aylik" | null;
  odeme_durumu: "yok" | "var" | "yoksayildi";
  odeme_tarihi: string | null;
  kisi: { id: string; ad_soyad: string } | null;
};

/** Bir kişinin aynı durumdaki (ödenmedi / ödendi / görmezden gelinen) işleri. */
type KisiGrubu = {
  kisiId: string;
  adSoyad: string;
  donemler: (DonemSatiri & { tutar: number })[];
  toplam: number;
  sonOdeme: string | null;
};

// Kişi başına tek satır (14 Ekim 2026): aynı çalışanın birden fazla işi
// listede ayrı ayrı görünüyordu; artık toplanır, ayrıntı satır açılınca.
function grupla(satirlar: DonemSatiri[], asgariUcretAylik: number): KisiGrubu[] {
  const gruplar = new Map<string, KisiGrubu>();
  for (const d of satirlar) {
    const kisiId = d.kisi?.id ?? `?${d.id}`;
    const g = gruplar.get(kisiId) ?? {
      kisiId,
      adSoyad: d.kisi?.ad_soyad ?? "Bilinmeyen kişi",
      donemler: [],
      toplam: 0,
      sonOdeme: null,
    };
    const tutar = donemOdenecekTutar(d.giris_tarihi, d.cikis_tarihi, d.ucret_tutari, asgariUcretAylik, d.ucret_periyodu);
    g.donemler.push({ ...d, tutar });
    g.toplam += tutar;
    if (d.odeme_tarihi && (!g.sonOdeme || d.odeme_tarihi > g.sonOdeme)) g.sonOdeme = d.odeme_tarihi;
    gruplar.set(kisiId, g);
  }
  return [...gruplar.values()];
}

function DonemBilgisi({ d }: { d: KisiGrubu["donemler"][number] }) {
  return (
    <>
      <span className="font-mono text-[13px] text-muted-foreground">{formatDonemAraligi(d.giris_tarihi, d.cikis_tarihi)}</span>
      <span className="text-right">
        <span className="block font-mono text-[14px]">{formatPara(d.tutar)}</span>
        {d.odeme_durumu === "var" && d.odeme_tarihi && (
          <span className="block text-[12.5px] font-bold text-[var(--ok)]">{formatTarih(d.odeme_tarihi)} tarihinde ödendi</span>
        )}
      </span>
    </>
  );
}

function Grup({ g }: { g: KisiGrubu }) {
  const href = g.kisiId.startsWith("?") ? "#" : `/kisi/${g.kisiId}`;
  if (g.donemler.length === 1) {
    const d = g.donemler[0];
    return (
      <Link
        href={href}
        className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3.5 last:border-b-0 hover:bg-accent/50 sm:px-5"
      >
        <div>
          <div className="text-[15px] font-bold">{g.adSoyad}</div>
          <div className="font-mono text-[13px] text-muted-foreground">{formatDonemAraligi(d.giris_tarihi, d.cikis_tarihi)}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[15px]">{formatPara(d.tutar)}</div>
          {d.odeme_durumu === "var" && d.odeme_tarihi && (
            <div className="text-[13px] font-bold text-[var(--ok)]">{formatTarih(d.odeme_tarihi)} tarihinde ödendi</div>
          )}
        </div>
      </Link>
    );
  }
  return (
    <details className="group border-b border-border/60 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 hover:bg-accent/50 sm:px-5">
        <div>
          <div className="text-[15px] font-bold">
            {g.adSoyad} <span className="font-normal text-muted-foreground">· {g.donemler.length} iş</span>
          </div>
          <div className="text-[13px] text-muted-foreground">
            <span className="group-open:hidden">Ayrıntı için tıkla</span>
            <span className="hidden group-open:inline">Gizlemek için tıkla</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[15px] font-medium">{formatPara(g.toplam)}</div>
          {g.sonOdeme && <div className="text-[13px] font-bold text-[var(--ok)]">Son ödeme {formatTarih(g.sonOdeme)}</div>}
        </div>
      </summary>
      <div className="flex flex-col border-t border-border/60 bg-background/40">
        {g.donemler.map((d) => (
          <Link
            key={d.id}
            href={href}
            className="flex items-center justify-between gap-4 px-4 py-2.5 pl-8 hover:bg-accent/50 sm:px-5 sm:pl-10"
          >
            <DonemBilgisi d={d} />
          </Link>
        ))}
      </div>
    </details>
  );
}

function Bolum({
  baslik,
  gruplar,
  bos,
  toplam,
}: {
  baslik: string;
  gruplar: KisiGrubu[];
  bos: string;
  toplam?: number;
}) {
  const isSayisi = gruplar.reduce((t, g) => t + g.donemler.length, 0);
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[18px] font-bold">{baslik}</h2>
        <span className="font-mono text-[13px] text-muted-foreground">
          {gruplar.length} kişi{isSayisi !== gruplar.length ? `, ${isSayisi} iş` : ""}
        </span>
      </div>
      {gruplar.length === 0 ? (
        <p className="text-sm text-muted-foreground">{bos}</p>
      ) : (
        <div className="border border-border bg-card">
          {gruplar.map((g) => (
            <Grup key={g.kisiId} g={g} />
          ))}
          {toplam !== undefined && (
            <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-4 sm:px-5">
              <span className="font-bold">Toplam bekleyen</span>
              <span className="border-b-[4px] border-double border-foreground pb-0.5 font-mono text-[16px] font-medium">
                {formatPara(toplam)}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default async function OdemelerSayfasi() {
  const supabase = await createClient();

  const [{ data, error }, ayarlar] = await Promise.all([
    supabase
      .from("is_girisi")
      .select(
        "id, giris_tarihi, cikis_tarihi, ucret_tutari, ucret_periyodu, odeme_durumu, odeme_tarihi, kisi:kisi_id(id, ad_soyad)",
      )
      .order("giris_tarihi", { ascending: false })
      .returns<DonemSatiri[]>(),
    ayarlarSatiri(),
  ]);
  const asgariUcretAylik = ayarlar?.asgari_ucret_aylik ?? 28075.5;

  const satirlar = data ?? [];
  const odenmedi = grupla(
    satirlar.filter((d) => d.odeme_durumu === "yok"),
    asgariUcretAylik,
  );
  const odendi = grupla(
    satirlar.filter((d) => d.odeme_durumu === "var"),
    asgariUcretAylik,
  ).sort((a, b) => (b.sonOdeme ?? "").localeCompare(a.sonOdeme ?? ""));
  const gormezdenGelinen = grupla(
    satirlar.filter((d) => d.odeme_durumu === "yoksayildi"),
    asgariUcretAylik,
  );
  const odenmediToplam = odenmedi.reduce((t, g) => t + g.toplam, 0);

  return (
    <>
      <AppHeader aktif="odemeler" />
      <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-8 p-4 sm:p-8">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">Ödemeler</h1>
          <p className="mt-1 text-muted-foreground">
            Kapanan iş dönemlerinin ücreti ödendi mi? Aynı çalışanın birden fazla işi tek satırda toplanır. Vade ve tutar
            takibi ön muhasebe programında kalır.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive">Kayıtlar yüklenemedi: {error.message}</p>
        ) : (
          <div className="flex flex-col gap-10">
            <Bolum baslik="Ödenmedi" gruplar={odenmedi} bos="Ödenmemiş iş yok." toplam={odenmediToplam} />
            <Bolum baslik="Ödendi" gruplar={odendi} bos="Henüz ödenmiş kayıt yok." />
            {gormezdenGelinen.length > 0 && (
              <Bolum baslik="Görmezden gelinen" gruplar={gormezdenGelinen} bos="" />
            )}
          </div>
        )}
      </div>
    </>
  );
}
