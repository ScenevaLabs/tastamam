import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// İstek başına tek okuma (15 Ekim 2026, hız incelemesi): sunucu fonksiyonu
// Netlify Ohio'da, veritabanı Frankfurt'ta — her sorgu ~100 ms Atlantik
// gidiş-dönüşü. Üst menü, modül kontrolü ve sayfa aynı ayarlar satırını
// ayrı ayrı okuyordu; React cache() ile aynı istekte bir kez okunur.

/** Ayarlar satırı (tek satır, id = true). Sadece sunucuda kullanılır. */
export const ayarlarSatiri = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("ayarlar").select("*").eq("id", true).maybeSingle();
  return data;
});

/** Oturumdaki kullanıcının e-postası. getClaims JWT'yi yerelde doğrular
 *  (ES256 imza anahtarı), Auth sunucusuna gitmez. */
export const oturumEposta = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims.email as string | undefined) ?? null;
});
