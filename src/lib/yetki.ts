import { createClient } from "@/lib/supabase/server";

/** Her server action'ın ilk adımı (25 Ekim 2026, güvenlik incelemesi).
 *  Veriyi RLS zaten korur; bu kontrol, dosya deposuna ya da dış servislere
 *  (Drive, OneDrive, SMTP) dokunan adımların yetkisiz oturumla hiç
 *  başlamamasını sağlar. */
export async function yetkiliGerekli(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("yetkili_mi");
  if (error || data !== true) throw new Error("Bu işlem için yetkiniz yok.");
}
