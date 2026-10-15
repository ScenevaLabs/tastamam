import { belgeYuklemeBaslat, belgeYuklemeTamamla, type YuklemeIstegi } from "@/app/actions";

// Tarayıcıdan doğrudan depoya yükleme (9 Ekim 2026). Sunucu sadece
// yükleme oturumunu açar ve sonunda kaydı işaretler; dosya baytları
// Netlify'dan geçmez — ~6 MB istek gövdesi sınırı yüzünden 12 MB'lık
// taranmış evraklar yüklenemiyordu. uploadUrl ön-yetkili olduğu için
// Authorization başlığı gönderilmez.
//
// "parcali" (OneDrive, Google Drive): Content-Range'li PUT parçaları.
// Parça boyu 320 KiB'ın (Graph) ve 256 KiB'ın (Drive) katı olmalı.
// Drive ara parçalara 308 döner — bu hata değil, "devam et" demek.
// "tek" (Supabase Storage): imzalı adrese tek PUT.
const PARCA_BOYUTU = 320 * 1024 * 16; // 5 MiB

export async function belgeYukle(
  istek: YuklemeIstegi,
  dosya: File,
  ilerleme?: (oran: number) => void,
): Promise<{ error: string | null }> {
  const baslat = await belgeYuklemeBaslat(istek, dosya.name);
  if (baslat.error !== null) return { error: baslat.error };
  const zatenVar = `Bu isimde bir dosya zaten var: ${baslat.dosyaAdi}. Önce mevcut dosyayı depodan kaldırın.`;

  try {
    if (baslat.yontem === "tek") {
      const res = await fetch(baslat.uploadUrl, { method: "PUT", headers: baslat.basliklar, body: dosya });
      if (res.status === 409) return { error: zatenVar };
      if (!res.ok) return { error: `Depoya yazılamadı (${res.status}).` };
      ilerleme?.(1);
    } else {
      for (let bas = 0; bas < dosya.size; bas += PARCA_BOYUTU) {
        const son = Math.min(bas + PARCA_BOYUTU, dosya.size);
        const res = await fetch(baslat.uploadUrl, {
          method: "PUT",
          headers: { ...baslat.basliklar, "Content-Range": `bytes ${bas}-${son - 1}/${dosya.size}` },
          body: dosya.slice(bas, son),
        });
        if (res.status === 409) return { error: zatenVar };
        if (!res.ok && res.status !== 308) return { error: `Depoya yazılamadı (${res.status}).` };
        ilerleme?.(son / dosya.size);
      }
    }
  } catch {
    return { error: "Depoya bağlanılamadı — internet bağlantısını kontrol edip tekrar dene." };
  }

  return belgeYuklemeTamamla(istek, baslat.dosyaAdi);
}
