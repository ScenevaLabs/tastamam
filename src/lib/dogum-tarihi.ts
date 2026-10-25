// Belgenin metin katmanından doğum tarihi (20 Ekim 2026; istek:
// tek tek girmek yerine belgelerden çekilsin). KVKK kararı gereği belge
// dışarı gönderilmez; yalnızca PDF/DOCX metni okunur, kimlik fotokopisi
// gibi taranmış belgelerden okunamaz.
//
// Örnek belgelerde doğrulanan kural:
// - SGK işe giriş / işten ayrılış bildirgesi: makul yıllı en erken tarih
//   doğum tarihidir (tarih "YYYY-AA-GG", TC tek tek kutularda). %100 tutarlı.
// - e-Devlet nüfus kayıt örneği: belgede tek kişi (tek TC) varsa en erken
//   tarih doğum tarihidir. Aile kaydında başka bireylerin tarihleri karıştığı
//   için birden fazla TC geçen nüfus kaydı kullanılmaz.

export type DogumKaynagi = "sgk" | "nufus";

/** Belgedeki geçerli tarihler (GG.AA.YYYY, GG/AA/YYYY, YYYY-AA-GG) ISO olarak. */
function tarihler(metin: string): string[] {
  const sonuc: string[] = [];
  const ekle = (y: string, a: string, g: string) => {
    const iso = `${y}-${a}-${g}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso) sonuc.push(iso);
  };
  for (const m of metin.matchAll(/(?<!\d)(\d{2})[./](\d{2})[./](\d{4})(?!\d)/g)) ekle(m[3], m[2], m[1]);
  for (const m of metin.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) ekle(m[1], m[2], m[3]);
  return sonuc;
}

/** Bulunamazsa ya da belge bu kişiye ait görünmüyorsa null. bugun: ISO. */
export function dogumTarihiAyikla(metin: string, kaynak: DogumKaynagi, tcKimlikNo: string, bugun: string): string | null {
  if (!metin.trim() || !/^\d{11}$/.test(tcKimlikNo)) return null;
  // Form kutularındaki tek tek rakamlar birleştirilerek TC aranır.
  const bitisik = metin.replace(/(?<=\d)\s+(?=\d)/g, "");
  if (!bitisik.includes(tcKimlikNo)) return null;
  if (kaynak === "nufus") {
    const tcler = new Set(metin.match(/(?<!\d)[1-9]\d{10}(?!\d)/g) ?? []);
    if (tcler.size !== 1) return null;
  }
  // 14 yaşından küçük çalıştırılamaz (İş K. md. 71); 1940 öncesi belge tarihi değil, gürültü.
  const enGec = `${Number(bugun.slice(0, 4)) - 14}${bugun.slice(4)}`;
  const adaylar = tarihler(metin).filter((t) => t >= "1940-01-01" && t <= enGec);
  return adaylar.length ? adaylar.sort()[0] : null;
}
