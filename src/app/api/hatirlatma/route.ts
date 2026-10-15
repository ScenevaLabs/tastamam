import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { hatirlatmaCalistir } from "@/lib/hatirlatma";

// Sabah hatırlatma maili, barındırma için (Netlify zamanlanmış fonksiyonu
// netlify/functions/hatirlatma.mjs çağırır). Oturum yok: CRON_SECRET ile
// doğrulanır. Kendi bilgisayarındaki kurulumda zamanlayıcı
// src/instrumentation.ts'te, bu adrese gerek kalmaz.

function yetkili(istek: Request): boolean {
  const sir = process.env.CRON_SECRET;
  if (!sir) return false;
  const gelen = Buffer.from(istek.headers.get("authorization") ?? "");
  const beklenen = Buffer.from(`Bearer ${sir}`);
  return gelen.length === beklenen.length && timingSafeEqual(gelen, beklenen);
}

export async function POST(istek: Request) {
  if (!yetkili(istek)) return NextResponse.json({ hata: "yetkisiz" }, { status: 401 });
  const { durum, govde } = await hatirlatmaCalistir();
  return NextResponse.json(govde, { status: durum });
}
