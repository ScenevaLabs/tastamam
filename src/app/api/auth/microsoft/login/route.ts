import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { msGirisUrl } from "@/lib/msgraph-auth";

export async function GET() {
  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(msGirisUrl(state));
}
