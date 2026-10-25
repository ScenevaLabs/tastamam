import Link from "next/link";
import { gunFarki } from "@/lib/mevzuat";
import type { TakvimOgesi } from "@/lib/takvim";

// Takvim listesinin bir satırı; takvim sayfası ve ana sayfa ortak (20 Ekim 2026).

const KISA = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const GUN = new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "UTC" });

function kalanMetni(tarih: string, bugun: string): string {
  const f = gunFarki(bugun, tarih);
  if (f < 0) return `${-f} gün geçti`;
  if (f === 0) return "bugün";
  if (f === 1) return "yarın";
  return `${f} gün`;
}

export function TakvimSatiri({ o, bugun }: { o: TakvimOgesi; bugun: string }) {
  const f = gunFarki(bugun, o.tarih);
  const acil = f <= 7;
  const d = new Date(`${o.tarih}T00:00:00Z`);
  return (
    <Link
      href={o.href}
      className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-muted/40 sm:grid-cols-[100px_84px_minmax(0,1fr)_96px]"
    >
      <span className={`font-mono text-[14px] ${acil ? "font-medium text-[var(--warn)]" : ""}`}>
        {KISA.format(d)} {GUN.format(d)}
        <span className="font-sans text-[13px] font-normal text-muted-foreground sm:hidden"> · {o.tur}</span>
      </span>
      <span className="hidden text-[13px] text-muted-foreground sm:block">{o.tur}</span>
      <span className="col-span-2 min-w-0 sm:col-span-1">
        {o.metin}
        {o.dayanak && <span className="block font-mono text-[11px] text-muted-foreground">{o.dayanak}</span>}
      </span>
      <span
        className={`text-right text-[13px] max-sm:col-start-2 max-sm:row-start-1 ${acil ? "font-bold text-[var(--warn)]" : "text-muted-foreground"}`}
      >
        {kalanMetni(o.tarih, bugun)}
      </span>
    </Link>
  );
}
