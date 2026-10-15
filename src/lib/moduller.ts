import { ayarlarSatiri } from "@/lib/istek";
import type { Modul } from "@/lib/types";

export async function acikModuller(): Promise<Modul[]> {
  const ayarlar = await ayarlarSatiri();
  return (ayarlar?.acik_moduller ?? []) as Modul[];
}
