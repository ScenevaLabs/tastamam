import { AppHeader } from "@/components/app-header";
import { ModulKapali } from "@/components/modul-kapali";
import { HatirlatmaFormu } from "@/components/isg-formlari";
import { createClient } from "@/lib/supabase/server";
import { ayarlarSatiri } from "@/lib/istek";
import { acikModuller } from "@/lib/moduller";
import { bugunIso } from "@/lib/isg";
import { gunEkle, haftaGunu } from "@/lib/mevzuat";
import { takvimGruplari, takvimOgeleri, type TakvimOgesi } from "@/lib/takvim";
import { takvimVerisiYukle } from "@/lib/takvim-veri";
import { TakvimSatiri as Satir } from "@/components/takvim-satiri";

// Tek takvim (15 Ekim 2026, Faz D paket 1). Onaylı tasarım:
// marka/ekranlar-v1/Takvim.dc.html.

const AY = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });

function AyTablosu({ ogeler, bugun }: { ogeler: TakvimOgesi[]; bugun: string }) {
  const ilk = `${bugun.slice(0, 7)}-01`;
  const gunler: (string | null)[] = Array(haftaGunu(ilk)).fill(null);
  for (let t = ilk; t.startsWith(bugun.slice(0, 7)); t = gunEkle(t, 1)) gunler.push(t);
  const dolu = new Set(ogeler.map((o) => o.tarih));
  return (
    <section>
      <h2 className="mb-2 text-[18px] font-bold">{AY.format(new Date(`${ilk}T00:00:00Z`))}</h2>
      <div className="border border-border bg-card p-4">
      <div className="grid grid-cols-7 gap-1 text-center text-[13px]">
        {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"].map((b) => (
          <span key={b} className="pb-1 text-muted-foreground">
            {b}
          </span>
        ))}
        {gunler.map((t, i) =>
          t ? (
            <span
              key={t}
              className={`py-1 font-mono ${t === bugun ? "bg-foreground text-background" : ""} ${
                dolu.has(t) ? "font-bold underline decoration-[var(--warn)] decoration-2 underline-offset-4" : ""
              }`}
            >
              {Number(t.slice(8))}
            </span>
          ) : (
            <span key={`b${i}`} />
          ),
        )}
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">Altı çizili günlerde bir süre doluyor. Siyah kutu bugün.</p>
      </div>
    </section>
  );
}

export default async function TakvimSayfasi() {
  if (!(await acikModuller()).includes("takvim")) return <ModulKapali aktif="takvim" ad="Takvim" />;
  const supabase = await createClient();
  const bugun = bugunIso();
  const ayarlar = await ayarlarSatiri();
  const girdi = await takvimVerisiYukle(supabase, bugun, ayarlar);
  const ogeler = takvimOgeleri(girdi);
  const gruplar = takvimGruplari(ogeler, bugun);
  const mailAcik = ayarlar?.hatirlatma_maili !== false;
  const alici = (ayarlar?.takip_email as string | null) || (ayarlar?.gonderen_email as string | null) || null;

  return (
    <>
      <AppHeader aktif="takvim" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-7 p-4 sm:p-8">
        <div className="max-w-3xl">
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">Takvim</h1>
          <p className="mt-1 text-muted-foreground">
            Yasal süreler ve hak edişler tek listede.
            {mailAcik && " Her biri, ayarladığın gün sayısı kadar önce mail olarak da gelir."} Yapılan iş listeden
            kendiliğinden düşer.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
          {/* Dar ekranda ay takvimi listenin üstünde; geniş ekranda sağ sütunda. */}
          <div className="lg:hidden">
            <AyTablosu ogeler={ogeler} bugun={bugun} />
          </div>
          <section className="min-w-0">
            {gruplar.length === 0 ? (
              <>
                <h2 className="mb-2 text-[18px] font-bold">Yaklaşan</h2>
                <p className="border border-border bg-card px-4 py-6">
                  Önümüzdeki iki ayda dolan bir süre yok. Her şey tastamam.
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-6">
                {gruplar.map((g) => (
                  <div key={g.baslik}>
                    <h2 className="mb-2 text-[18px] font-bold">{g.baslik}</h2>
                    <div className="border border-border bg-card">
                      {g.ogeler.map((o) => (
                        <Satir key={`${o.tarih}${o.metin}`} o={o} bugun={bugun} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
            <div className="hidden lg:block">
              <AyTablosu ogeler={ogeler} bugun={bugun} />
            </div>
            <section>
              <h2 className="mb-2 text-[18px] font-bold">Sabah maili</h2>
              <div className="border border-border bg-card p-4">
                <HatirlatmaFormu acik={mailAcik} gun={Number(ayarlar?.hatirlatma_gun ?? 3)} alici={alici} />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
