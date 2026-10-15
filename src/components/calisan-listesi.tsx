"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { formatDonemAraligi, formatTarih, ucretMetni } from "@/lib/utils";
import type { Kisi, IsGirisi } from "@/lib/types";

type Row = {
  kisi: Kisi;
  donemler: IsGirisi[];
  aktif: boolean;
  guncelDonem: IsGirisi;
  eksikToplam: number;
  hicKontrolEdilmedi: boolean;
};

// Telefonda yalnızca ad ve evrak durumu (yatay kaydırma yok, 14 Ekim 2026);
// dönem ve ücret sütunları md ve üstünde.
const SATIR_GRID =
  "grid-cols-[minmax(0,1fr)_auto_16px] md:grid-cols-[minmax(190px,1.5fr)_minmax(190px,1.2fr)_minmax(120px,0.8fr)_minmax(110px,0.7fr)_20px]";

function evrakRozeti(row: Row) {
  if (row.hicKontrolEdilmedi) {
    return <span className="text-xs text-muted-foreground">Kontrol edilmedi</span>;
  }
  if (row.eksikToplam === 0) {
    return (
      <span className="text-[14px] font-bold text-[var(--ok)]">Tastamam</span>
    );
  }
  return (
    <span className="text-[14px] font-bold text-[var(--warn)]">{row.eksikToplam} eksik</span>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
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

function CalisanSatiri({ row, sonDonemGoster }: { row: Row; sonDonemGoster: boolean }) {
  return (
    <Link
      href={`/kisi/${row.kisi.id}`}
      className={`grid ${SATIR_GRID} items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-b-0 hover:bg-accent/50 sm:px-5`}
    >
      <div className="min-w-0 bg-card pr-2 md:sticky md:left-0">
        <div className="text-[15px] font-bold">{row.kisi.ad_soyad}</div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">{row.guncelDonem.meslek_adi ?? row.kisi.meslek_adi}</div>
      </div>
      <div className="hidden font-mono text-[13px] text-muted-foreground md:block">
        {sonDonemGoster
          ? formatDonemAraligi(row.guncelDonem.giris_tarihi, row.guncelDonem.cikis_tarihi)
          : `${row.donemler.length}. dönem · ${formatTarih(row.guncelDonem.giris_tarihi)}'den beri`}
      </div>
      <div className="hidden font-mono text-[13px] text-muted-foreground md:block">
        {ucretMetni(
          row.guncelDonem.ucret_tutari,
          row.guncelDonem.ucret_periyodu,
          row.guncelDonem.ucret_tipi,
        )}
      </div>
      <div className="text-right md:text-left">{evrakRozeti(row)}</div>
      <ChevronRight />
    </Link>
  );
}

function CalisanTablosu({
  rows,
  sonDonemGoster,
  bosMesaj,
  durumBasligi,
}: {
  rows: Row[];
  sonDonemGoster: boolean;
  bosMesaj: string;
  durumBasligi: string;
}) {
  return (
    <div className="border border-border bg-card md:overflow-x-auto">
      <div className="md:min-w-fit">
        <div
          className={`grid ${SATIR_GRID} gap-4 border-b border-border px-4 py-2.5 text-[12px] font-medium text-muted-foreground sm:px-5`}
        >
          <div className="bg-card pr-2 md:sticky md:left-0">Çalışan</div>
          <div className="hidden md:block">{durumBasligi}</div>
          <div className="hidden md:block">Ücret</div>
          <div className="text-right md:text-left">Dosya</div>
          <div />
        </div>
        {rows.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">{bosMesaj}</p>}
        {rows.map((row) => (
          <CalisanSatiri key={row.kisi.id} row={row} sonDonemGoster={sonDonemGoster} />
        ))}
      </div>
    </div>
  );
}

export function CalisanListesi({
  aktifRows,
  pasifRows,
}: {
  aktifRows: Row[];
  pasifRows: Row[];
}) {
  const [arama, setArama] = useState("");

  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const filtrele = (rows: Row[]) =>
    q ? rows.filter((r) => r.kisi.ad_soyad.toLocaleLowerCase("tr-TR").includes(q)) : rows;

  const aktifFiltreli = filtrele(aktifRows);
  const pasifFiltreli = filtrele(pasifRows);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <InputGroup className="h-11 max-w-md bg-card">
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Ad ile ara"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
        />
      </InputGroup>

      <div className="flex min-w-0 flex-col gap-12">
        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-xl font-extrabold">Aktif</h2>
            <span className="font-mono text-[13px] text-muted-foreground">{aktifFiltreli.length}</span>
          </div>
          <CalisanTablosu
            rows={aktifFiltreli}
            sonDonemGoster={false}
            bosMesaj="Aktif çalışan yok."
            durumBasligi="Durum"
          />
        </section>

        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-xl font-extrabold">Pasif</h2>
            <span className="font-mono text-[13px] text-muted-foreground">{pasifFiltreli.length}</span>
          </div>
          <CalisanTablosu
            rows={pasifFiltreli}
            sonDonemGoster={true}
            bosMesaj="Pasif çalışan yok."
            durumBasligi="Son dönem"
          />
        </section>
      </div>
    </div>
  );
}
