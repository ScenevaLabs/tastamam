import { createClient } from "@supabase/supabase-js";

/** Gizli anahtarlı istemci: oturum yokken çalışan sunucu görevleri için
 *  (sabah hatırlatma maili). RLS'yi atlar; yalnızca sunucuda, yalnızca
 *  okuma ve kendi ayar satırını işaretlemek için kullanılır. */
export function servisIstemcisi() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anahtar = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anahtar) return null;
  return createClient(url, anahtar, { auth: { persistSession: false, autoRefreshToken: false } });
}
