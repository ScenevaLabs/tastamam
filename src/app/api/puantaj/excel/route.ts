import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AY_RE, puantajExcel, puantajYukle } from "@/lib/puantaj-veri";

export async function GET(request: NextRequest) {
  const ay = request.nextUrl.searchParams.get("ay") ?? "";
  if (!AY_RE.test(ay)) return new Response("Ay geçersiz.", { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum yok.", { status: 401 });

  const dosya = puantajExcel(await puantajYukle(supabase, ay));
  return new Response(new Uint8Array(dosya), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="puantaj-${ay}.xlsx"`,
    },
  });
}
