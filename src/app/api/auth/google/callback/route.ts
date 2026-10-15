import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleKoduTokenaCevir } from "@/lib/google-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const hataAciklama = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const cookieStore = await cookies();
  const beklenenState = cookieStore.get("g_oauth_state")?.value;
  cookieStore.delete("g_oauth_state");

  if (hataAciklama) {
    return NextResponse.redirect(new URL(`/ayarlar?g_hata=${encodeURIComponent(hataAciklama)}`, url));
  }
  if (!code || !state || state !== beklenenState) {
    return NextResponse.redirect(new URL("/ayarlar?g_hata=Geçersiz+istek", url));
  }

  try {
    await googleKoduTokenaCevir(code);
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : "Bilinmeyen hata";
    return NextResponse.redirect(new URL(`/ayarlar?g_hata=${encodeURIComponent(mesaj)}`, url));
  }

  return NextResponse.redirect(new URL("/ayarlar?g_basarili=1", url));
}
