import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { msKoduTokenaCevir } from "@/lib/msgraph-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const hataAciklama = url.searchParams.get("error_description");

  const cookieStore = await cookies();
  const beklenenState = cookieStore.get("ms_oauth_state")?.value;
  cookieStore.delete("ms_oauth_state");

  if (hataAciklama) {
    return NextResponse.redirect(new URL(`/ayarlar?ms_hata=${encodeURIComponent(hataAciklama)}`, url));
  }
  if (!code || !state || state !== beklenenState) {
    return NextResponse.redirect(new URL("/ayarlar?ms_hata=Geçersiz+istek", url));
  }

  try {
    await msKoduTokenaCevir(code);
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : "Bilinmeyen hata";
    return NextResponse.redirect(new URL(`/ayarlar?ms_hata=${encodeURIComponent(mesaj)}`, url));
  }

  return NextResponse.redirect(new URL("/ayarlar?ms_basarili=1", url));
}
