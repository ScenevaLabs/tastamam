// Kendi bilgisayarında çalışan kurulumda sabah hatırlatma maili (15 Ekim 2026).
// `npm start` ile açılan sunucu her 10 dakikada bir saate bakar; İstanbul
// saatiyle 08.00'i geçtiyse ve bugün gönderilmediyse hatırlatmayı çalıştırır.
// Bilgisayar 08.00'de kapalıysa açıldığı ilk 10 dakika içinde gönderilir.
// Aynı gün ikinci kez gitmez (ayarlar.hatirlatma_son_gonderim).
//
// Barındırmada (Netlify/Vercel) sunucu sürekli açık olmadığı için bu çalışmaz;
// orada /api/hatirlatma adresini platformun zamanlayıcısı çağırır.
// Kapatmak için: HATIRLATMA_ZAMANLAYICI=kapali

const ARALIK_MS = 10 * 60 * 1000;
const SAAT = 8;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NETLIFY || process.env.VERCEL) return;
  if (process.env.HATIRLATMA_ZAMANLAYICI === "kapali") return;

  const { hatirlatmaCalistir } = await import("@/lib/hatirlatma");
  let sonCalisma = "";

  const kontrol = async () => {
    const simdi = new Date();
    const gun = simdi.toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
    const saat = Number(simdi.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }));
    if (saat < SAAT || sonCalisma === gun) return;
    sonCalisma = gun;
    try {
      const { durum, govde } = await hatirlatmaCalistir();
      console.log(`[hatırlatma] ${gun}: ${durum} ${JSON.stringify(govde)}`);
      // Mail gönderilemediyse (SMTP geçici hata) bir sonraki turda tekrar denensin.
      if (durum >= 500) sonCalisma = "";
    } catch (e) {
      console.error("[hatırlatma] çalışmadı:", e);
      sonCalisma = "";
    }
  };

  setTimeout(kontrol, 60 * 1000);
  setInterval(kontrol, ARALIK_MS).unref();
}
