import { FAZLA_CALISMA, SGK, gunEkle, tamYil } from "@/lib/mevzuat";
import { aylar } from "@/lib/puantaj";
import type { IsGirisiBelgeTipi } from "@/lib/types";

// Koşullu dönem belgeleri ve aylık ücret pusulası (15 Ekim 2026, MEVZUAT.md §5, §6).
// Saf hesap: hangi dönemde hangi belgenin istendiğini söyler; sayım ve
// gösterim kişi sayfası ile ana sayfada yapılır.
//
// `baslangic` (ayarlar.belge_takip_baslangic): bu belgeler takip edilmeye
// başlanan gün. Mevcut kurulumda geçmiş dönemler birden eksik görünmesin diye
// bu tarihten önce biten dönem ve aylar istenmez; null ise sınır yok.

/** ayarlar.belge_takip_baslangic; sütun yoksa (0029 uygulanmamış) bugün —
 *  geçmiş dönemler birden eksik görünmesin. */
export function takipBaslangici(ayarlar: Record<string, unknown> | null | undefined, bugun: string): string | null {
  if (!ayarlar || !("belge_takip_baslangic" in ayarlar)) return bugun;
  return (ayarlar.belge_takip_baslangic as string | null) ?? null;
}

type Donem = { giris_tarihi: string; cikis_tarihi: string | null };
type ElleGun = { kisi_id: string; tarih: string; fazla_saat: number | string | null };

/** Dönem içinde (başlangıçtan sonra) fazla çalışma girilmiş mi? */
export function fazlaCalismaVar(elle: ElleGun[], kisiId: string, d: Donem, baslangic: string | null): boolean {
  const son = d.cikis_tarihi ?? "9999-12-31";
  return elle.some(
    (g) =>
      g.kisi_id === kisiId &&
      Number(g.fazla_saat ?? 0) > 0 &&
      g.tarih >= d.giris_tarihi &&
      g.tarih <= son &&
      (!baslangic || g.tarih >= baslangic),
  );
}

/** Bu dönemde istenen koşullu belgeler. */
export function kosulluBelgeler(
  d: Donem,
  o: { fazlaCalisma: boolean; baslangic: string | null },
): IsGirisiBelgeTipi[] {
  const sonuc: IsGirisiBelgeTipi[] = [];
  if (o.fazlaCalisma) sonuc.push("fazla_calisma_onayi");
  // Çalışma belgesi çıkışta verilir (4857 md. 28); çıkış başlangıçtan önceyse istenmez.
  if (d.cikis_tarihi && (!o.baslangic || d.cikis_tarihi >= o.baslangic)) sonuc.push("calisma_belgesi");
  return sonuc;
}

/** Ücret pusulası istenen aylar ("YYYY-MM"): dönemin ve takip başlangıcının
 *  içinde kalan, bitmiş aylar (pusula ücret ödenirken verilir, md. 37). */
export function pusulaAylari(d: Donem, baslangic: string | null, bugun: string): string[] {
  const bas = baslangic && baslangic > d.giris_tarihi ? baslangic : d.giris_tarihi;
  const buAyBasi = `${bugun.slice(0, 7)}-01`;
  const sonGun = gunEkle(buAyBasi, -1); // geçen ayın son günü
  const bit = d.cikis_tarihi && d.cikis_tarihi < sonGun ? d.cikis_tarihi : sonGun;
  if (bas > bit) return [];
  return aylar(bas, bit);
}

/** Kişisel verilerin saklama süresinin bittiği gün: çıkış yılını izleyen
 *  yılbaşından itibaren 10 yıl (5510 md. 86/2). Süre dolunca KVKK gereği
 *  silinir ya da anonimleştirilir (Silme Yön.; periyodik imha en geç 6 ayda bir). */
export function saklamaBitisi(sonCikis: string): string {
  return `${Number(sonCikis.slice(0, 4)) + 1 + SGK.saklamaYil.deger}-01-01`;
}

export type FazlaCalismaEngeli = "onay_yok" | "geri_alindi" | "yas" | "gebelik" | "emzirme" | "kismi";

/** Fazla çalışma yaptırılamayan durumlar (Fazla Çalışma Yön. md. 8, 9).
 *  Gebelik ve emzirme kişinin durum kayıtlarından (0030), kısmi süre kişi
 *  işaretinden gelir. Sağlık raporuyla "sağlığı elvermez" kaydı henüz yok. */
export function fazlaCalismaEngeli(params: {
  tarih: string;
  onayVar: boolean;
  geriAlma: string | null;
  dogumTarihi: string | null;
  kismiSureli?: boolean;
  durumlar?: { tur: string; baslangic: string; bitis: string | null }[];
}): FazlaCalismaEngeli | null {
  const { tarih, onayVar, geriAlma, dogumTarihi } = params;
  if (dogumTarihi && tamYil(dogumTarihi, tarih) < FAZLA_CALISMA.yasakliYasAlti.deger) return "yas";
  const aktif = (tur: string) =>
    (params.durumlar ?? []).some((d) => d.tur === tur && d.baslangic <= tarih && (!d.bitis || d.bitis >= tarih));
  if (aktif("gebelik")) return "gebelik";
  if (aktif("sut_izni") || aktif("dogum_izni")) return "emzirme";
  if (params.kismiSureli) return "kismi";
  if (geriAlma && tarih >= gunEkle(geriAlma, FAZLA_CALISMA.onayGeriAlmaGun.deger)) return "geri_alindi";
  if (!onayVar) return "onay_yok";
  return null;
}
