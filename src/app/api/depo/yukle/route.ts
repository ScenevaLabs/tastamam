import { NextResponse } from "next/server";
import { depoAdi } from "@/lib/depo";
import { DosyaZatenVarHatasi } from "@/lib/depo/tipler";
import { yerelDepo, yuklemeImzasiDogru } from "@/lib/depo/yerel";

// Yerel klasör deposuna tarayıcıdan yükleme (15 Ekim 2026). Adres
// yuklemeOturumuAc'ta imzalanır (yol + son kullanma); oturum zaten proxy'de
// istenir. Yalnızca DEPO_SAGLAYICI=yerel iken çalışır.

export async function PUT(istek: Request) {
  if (depoAdi() !== "yerel") return NextResponse.json({ hata: "yerel depo kullanılmıyor" }, { status: 404 });
  const u = new URL(istek.url);
  const yol = u.searchParams.get("yol") ?? "";
  const son = Number(u.searchParams.get("son"));
  const imza = u.searchParams.get("imza") ?? "";
  if (!yol || !yuklemeImzasiDogru(yol, son, imza)) {
    return NextResponse.json({ hata: "Yükleme adresinin süresi doldu, tekrar dene." }, { status: 403 });
  }
  try {
    await yerelDepo.yaz(yol, Buffer.from(await istek.arrayBuffer()));
  } catch (e) {
    if (e instanceof DosyaZatenVarHatasi) return NextResponse.json({ hata: e.message }, { status: 409 });
    return NextResponse.json({ hata: (e as Error).message }, { status: 500 });
  }
  return new NextResponse(null, { status: 201 });
}
