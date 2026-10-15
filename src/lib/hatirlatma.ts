import { servisIstemcisi } from "@/lib/supabase/servis";
import { bugunIso } from "@/lib/isg";
import { mailGonder } from "@/lib/mail";
import { gunFarki } from "@/lib/mevzuat";
import { hatirlatmaSecimi, takvimOgeleri, type TakvimOgesi } from "@/lib/takvim";
import { takvimVerisiYukle } from "@/lib/takvim-veri";
import { formatTarih } from "@/lib/utils";

// Sabah hatırlatma maili (15 Ekim 2026). İki yerden çağrılır: kendi
// bilgisayarında çalışan kurulumda src/instrumentation.ts'teki zamanlayıcı,
// barındırmada (Netlify) /api/hatirlatma. Takvim modülü kapalıysa ya da bugün
// zaten gönderildiyse bir şey yapmaz.

export type HatirlatmaSonucu = { durum: number; govde: Record<string, unknown> };

function satir(o: TakvimOgesi, bugun: string, kok: string): string {
  const f = gunFarki(bugun, o.tarih);
  const kalan = f < 0 ? `${-f} gün geçti` : f === 0 ? "bugün son gün" : `${f} gün kaldı`;
  return `<tr>
    <td style="padding:6px 14px 6px 0;font-family:monospace;white-space:nowrap">${formatTarih(o.tarih)}</td>
    <td style="padding:6px 14px 6px 0;color:#5D665F">${o.tur}</td>
    <td style="padding:6px 14px 6px 0"><a href="${kok}${o.href}" style="color:#1F3A93;text-decoration:none">${o.metin}</a></td>
    <td style="padding:6px 0;white-space:nowrap;color:${f <= 0 ? "#A3471C" : "#5D665F"}">${kalan}</td>
  </tr>`;
}

export async function hatirlatmaCalistir(): Promise<HatirlatmaSonucu> {
  const supabase = servisIstemcisi();
  if (!supabase) return { durum: 503, govde: { hata: "SUPABASE_SECRET_KEY tanımlı değil" } };

  const bugun = bugunIso();
  const { data: ayarlar } = await supabase.from("ayarlar").select("*").eq("id", true).maybeSingle();
  if (!ayarlar) return { durum: 500, govde: { hata: "ayarlar okunamadı" } };
  if (!((ayarlar.acik_moduller as string[] | null) ?? []).includes("takvim")) {
    return { durum: 200, govde: { durum: "takvim modülü kapalı" } };
  }
  if (ayarlar.hatirlatma_son_gonderim === bugun) return { durum: 200, govde: { durum: "bugün gönderildi" } };

  const alici = (ayarlar.takip_email as string | null) || (ayarlar.gonderen_email as string | null);
  const gonderen = ayarlar.gonderen_email as string | null;
  if (!alici || !gonderen) return { durum: 200, govde: { durum: "alıcı ya da gönderen adresi yok" } };

  const ogeler = takvimOgeleri(await takvimVerisiYukle(supabase, bugun, ayarlar));
  const { yeni, gecikmis } = hatirlatmaSecimi(ogeler, bugun, Number(ayarlar.hatirlatma_gun ?? 3));
  if (yeni.length === 0) return { durum: 200, govde: { durum: "hatırlatılacak iş yok" } };

  // Maildeki bağlantılar: barındırmada URL (Netlify verir), kendi bilgisayarında UYGULAMA_ADRESI.
  const kok = process.env.URL || process.env.UYGULAMA_ADRESI || "http://localhost:3000";
  const tablo = (liste: TakvimOgesi[]) =>
    `<table style="border-collapse:collapse;font-size:14px">${liste.map((o) => satir(o, bugun, kok)).join("")}</table>`;
  const html = `
    <div style="font-family:sans-serif;color:#1C1F1D;max-width:640px">
      <p>Günaydın. Süresi yaklaşan ${yeni.length === 1 ? "bir iş" : `${yeni.length} iş`} var:</p>
      ${tablo(yeni)}
      ${gecikmis.length ? `<p style="margin-top:20px">Süresi geçmiş, hâlâ açık görünenler:</p>${tablo(gecikmis)}` : ""}
      <p style="margin-top:20px;color:#5D665F;font-size:13px">Yaptığın iş takvimden kendiliğinden düşer. Hatırlatma gününü Takvim sayfasından değiştirebilirsin.</p>
    </div>`;

  const sonuc = await mailGonder({
    to: alici,
    from: gonderen,
    subject: `Tastamam: ${yeni.length === 1 ? yeni[0].metin : `${yeni.length} süre yaklaşıyor`}`,
    html,
  });
  if (!sonuc.ok) return { durum: 502, govde: { hata: sonuc.error } };

  await supabase.from("ayarlar").update({ hatirlatma_son_gonderim: bugun }).eq("id", true);
  return { durum: 200, govde: { durum: "gönderildi", adet: yeni.length + gecikmis.length } };
}
