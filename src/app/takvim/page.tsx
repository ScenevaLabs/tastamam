import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ModulKapali } from "@/components/modul-kapali";
import { HatirlatmaFormu } from "@/components/isg-formlari";
import { createClient } from "@/lib/supabase/server";
import { ayarlarSatiri } from "@/lib/istek";
import { acikModuller } from "@/lib/moduller";
import { bugunIso } from "@/lib/isg";
import { gunEkle, gunFarki, haftaGunu } from "@/lib/mevzuat";
import { takvimGruplari, takvimOgeleri, type TakvimOgesi } from "@/lib/takvim";
import { takvimVerisiYukle } from "@/lib/takvim-veri";

// Tek takvim (15 Ekim 2026, Faz D paket 1). Onaylı tasarım:
// marka/ekranlar-v1/Takvim.dc.html.

const KISA = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const GUN = new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "UTC" });
const AY = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });

function kalanMetni(tarih: string, bugun: string): string {
  const f = gunFarki(bugun, tarih);
  if (f < 0) return `${-f} gün geçti`;
  if (f === 0) return "bugün";
  if (f === 1) return "yarın";
  return `${f} gün`;
}

function Satir({ o, bugun }: { o: TakvimOgesi; bugun: string }) {
  const f = gunFarki(bugun, o.tarih);
  const acil = f <= 7;
  const d = new Date(`${o.tarih}T00:00:00Z`);
  return (
    <Link
      href={o.href}
      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/40"
    >
      <span className={`min-w-[96px] font-mono text-[14px] ${acil ? "font-medium text-[var(--warn)]" : ""}`}>
        {KISA.format(d)} {GUN.format(d)}
      </span>
      <span className="w-20 text-[13px] text-muted-foreground">{o.tur}</span>
      <span className="min-w-0 flex-1">
        {o.metin}
        {o.dayanak && <span className="ml-2 font-mono text-[11px] text-muted-foreground">{o.dayanak}</span>}
      </span>
      <span className={`min-w-[80px] text-right text-[13px] ${acil ? "font-bold text-[var(--warn)]" : "text-muted-foreground"}`}>
        {kalanMetni(o.tarih, bugun)}
      </span>
    </Link>
  );
}

function AyTablosu({ ogeler, bugun }: { ogeler: TakvimOgesi[]; bugun: string }) {
  const ilk = `${bugun.slice(0, 7)}-01`;
  const gunler: (string | null)[] = Array(haftaGunu(ilk)).fill(null);
  for (let t = ilk; t.startsWith(bugun.slice(0, 7)); t = gunEkle(t, 1)) gunler.push(t);
  const dolu = new Set(ogeler.map((o) => o.tarih));
  return (
    <div className="border border-border bg-card p-4">
      <p className="mb-3 font-bold">{AY.format(new Date(`${ilk}T00:00:00Z`))}</p>
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
  const alici = (ayarlar?.takip_email as string | null) || (ayarlar?.gonderen_email as string | null) || null;

  return (
    <>
      <AppHeader aktif="takvim" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-7 p-4 sm:p-8">
        <div className="max-w-3xl">
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">Takvim</h1>
          <p className="mt-1 text-muted-foreground">
            Yasal süreler ve hak edişler tek listede. Her biri, ayarladığın gün sayısı kadar önce mail olarak da gelir.
            Yapılan iş listeden kendiliğinden düşer.
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <section className="min-w-0 flex-[2_1_560px]">
            {gruplar.length === 0 ? (
              <p className="border border-border bg-card px-4 py-6">
                Önümüzdeki iki ayda dolan bir süre yok. Her şey tastamam.
              </p>
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
          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
            <AyTablosu ogeler={ogeler} bugun={bugun} />
            <section className="border border-border bg-card p-5">
              <h2 className="mb-3 text-[18px] font-bold">Sabah maili</h2>
              <HatirlatmaFormu gun={Number(ayarlar?.hatirlatma_gun ?? 3)} alici={alici} />
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
