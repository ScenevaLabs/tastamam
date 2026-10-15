import { izinBakiyesi } from "@/lib/izin";
import { calisanIsgTakibi, isyeriBelgeTakibi, kazaSonGun, ISYERI_BELGE_ADI } from "@/lib/isg-takip";
import { BES, FAZLA_CALISMA, SGK, gunEkle, gunFarki, tamYil, type TehlikeSinifi } from "@/lib/mevzuat";
import { DURUM_BILGI, besCaymaSonGun, kosulKabulSonGun } from "@/lib/durum";
import { saklamaBitisi } from "@/lib/donem-belge";
import type { IsgBelge, IsKazasi, IsyeriBelge, Modul } from "@/lib/types";

// Tek takvim (15 Ekim 2026): bütün yasal süreler tek listede. Saf hesap;
// veriyi takvim sayfası ve sabah hatırlatma görevi (api/hatirlatma) aynı
// yükleyiciyle (takvim-veri.ts) alır. Listede yalnızca henüz yapılmamış
// işler durur: yapılan iş (bildirge yüklendi, kaza bildirildi, ay kapandı)
// kendiliğinden düşer.

export type TakvimTuru = "SGK" | "İş kazası" | "İSG" | "İzin" | "Puantaj" | "KVKK" | "Çalışan";

export type TakvimOgesi = {
  /** Son gün (YYYY-MM-DD). */
  tarih: string;
  tur: TakvimTuru;
  metin: string;
  href: string;
  dayanak?: string;
};

export type TakvimGirdisi = {
  bugun: string;
  moduller: Modul[];
  sinif: TehlikeSinifi | null;
  puantajBaslangicAy: string | null;
  kisiler: {
    id: string;
    ad_soyad: string;
    dogum_tarihi: string | null;
    bes_katilim?: string | null;
    bes_cayma?: string | null;
  }[];
  /** Duruma bağlı kayıtlar (0030). */
  durumlar?: { kisi_id: string; tur: string; baslangic: string; bitis: string | null; tamamlandi: string | null }[];
  donemler: {
    id: string;
    kisi_id: string;
    giris_tarihi: string;
    cikis_tarihi: string | null;
    fazla_calisma_geri_alma?: string | null;
  }[];
  donemBelgeleri: { is_girisi_id: string; belge_tipi: string; durum: string }[];
  isgBelgeleri: IsgBelge[];
  isyeriBelgeleri: IsyeriBelge[];
  kazalar: IsKazasi[];
  izinler: { kisi_id: string; baslangic: string; gun: number }[];
  /** Kapanmış puantaj ayları ("YYYY-MM"). */
  kapaliAylar: string[];
};

/** Takvim bugünden bu kadar gün ilerisini gösterir. */
export const TAKVIM_ILERI_GUN = 60;
/** Geçmiş SGK süreleri bu kadar gün geriye kadar gösterilir (daha eskisi
 *  muhtemelen yapılmış ama belgesi yüklenmemiş). */
const SGK_GERI_GUN = 30;

function aySonu(ay: string): string {
  const [y, m] = ay.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function ayAdi(ay: string): string {
  return new Date(`${ay}-01T00:00:00Z`).toLocaleDateString("tr-TR", { month: "long", timeZone: "UTC" });
}

export function takvimOgeleri(g: TakvimGirdisi): TakvimOgesi[] {
  const { bugun } = g;
  const ad = new Map(g.kisiler.map((k) => [k.id, k.ad_soyad]));
  const tamam = new Set(
    g.donemBelgeleri.filter((b) => b.durum !== "yok").map((b) => `${b.is_girisi_id}:${b.belge_tipi}`),
  );
  const ogeler: TakvimOgesi[] = [];

  // SGK işe giriş ve işten ayrılış bildirgeleri.
  for (const d of g.donemler) {
    const kisi = ad.get(d.kisi_id) ?? "";
    const giris = gunEkle(d.giris_tarihi, -SGK.iseGirisOnceGun.deger);
    if (!tamam.has(`${d.id}:isegiris_bildirgesi`) && gunFarki(giris, bugun) <= SGK_GERI_GUN) {
      ogeler.push({
        tarih: giris,
        tur: "SGK",
        metin: `${kisi} için işe giriş bildirgesi`,
        href: `/kisi/${d.kisi_id}`,
        dayanak: SGK.iseGirisOnceGun.dayanak,
      });
    }
    if (d.cikis_tarihi) {
      const cikis = gunEkle(d.cikis_tarihi, SGK.ayrilisGun.deger);
      if (!tamam.has(`${d.id}:istenayrilis_bildirgesi`) && gunFarki(cikis, bugun) <= SGK_GERI_GUN) {
        ogeler.push({
          tarih: cikis,
          tur: "SGK",
          metin: `${kisi} için işten ayrılış bildirgesi`,
          href: `/kisi/${d.kisi_id}`,
          dayanak: SGK.ayrilisGun.dayanak,
        });
      }
    }
  }

  const aktifDonem = new Map<string, { giris_tarihi: string }>();
  for (const d of g.donemler) {
    if (d.giris_tarihi <= gunEkle(bugun, TAKVIM_ILERI_GUN) && (!d.cikis_tarihi || d.cikis_tarihi >= bugun)) {
      const onceki = aktifDonem.get(d.kisi_id);
      if (!onceki || onceki.giris_tarihi < d.giris_tarihi) aktifDonem.set(d.kisi_id, d);
    }
  }

  if (g.moduller.includes("isg")) {
    // İş kazası ve meslek hastalığı bildirimi (ramak kala bildirilmez).
    for (const k of g.kazalar) {
      const sonGun = kazaSonGun(k);
      if (!sonGun || k.bildirildi_tarihi) continue;
      ogeler.push({
        tarih: sonGun,
        tur: "İş kazası",
        metin: `${ad.get(k.kisi_id) ?? ""}: ${k.tur === "meslek_hastaligi" ? "meslek hastalığı" : "iş kazası"} için SGK bildirimi`,
        href: `/isg/kaza/${k.id}`,
        dayanak: SGK.isKazasiIsGunu.dayanak,
      });
    }

    if (g.sinif) {
      for (const [kisiId, d] of aktifDonem) {
        const t = calisanIsgTakibi({
          sinif: g.sinif,
          girisTarihi: d.giris_tarihi,
          belgeler: g.isgBelgeleri.filter((b) => b.kisi_id === kisiId),
          bugun,
        });
        const kisi = ad.get(kisiId) ?? "";
        if (t.egitim.sonraki && t.egitim.durum !== "gereksiz") {
          ogeler.push({
            tarih: t.egitim.sonraki,
            tur: "İSG",
            metin: t.egitim.son ? `${kisi} için temel İSG eğitimi yenileme` : `${kisi} için temel İSG eğitimi`,
            href: `/kisi/${kisiId}`,
          });
        }
        if (t.muayene.sonraki && t.muayene.durum !== "gereksiz") {
          ogeler.push({
            tarih: t.muayene.sonraki,
            tur: "İSG",
            metin: t.muayene.son ? `${kisi} için periyodik sağlık muayenesi` : `${kisi} için işe giriş sağlık raporu`,
            href: `/kisi/${kisiId}`,
          });
        }
      }
      const sonKaza =
        g.kazalar
          .filter((k) => k.tur !== "ramak_kala")
          .map((k) => k.olay_tarihi)
          .sort()
          .at(-1) ?? null;
      for (const b of isyeriBelgeTakibi({ sinif: g.sinif, belgeler: g.isyeriBelgeleri, sonKaza, bugun })) {
        if (!b.sonraki) continue;
        ogeler.push({
          tarih: b.sonraki,
          tur: "İSG",
          metin: b.kazaSonrasiYenilenmeli
            ? `${ISYERI_BELGE_ADI[b.tip]}: iş kazasından sonra yenilenmeli`
            : b.son
              ? `${ISYERI_BELGE_ADI[b.tip]} yenileme`
              : `${ISYERI_BELGE_ADI[b.tip]} kaydı yok`,
          href: "/isg#isyeri",
        });
      }
    }
  }

  if (g.moduller.includes("izin")) {
    for (const [kisiId] of aktifDonem) {
      const kisi = g.kisiler.find((k) => k.id === kisiId);
      const b = izinBakiyesi({
        donemler: g.donemler.filter((d) => d.kisi_id === kisiId),
        dogumTarihi: kisi?.dogum_tarihi ?? null,
        izinler: g.izinler.filter((i) => i.kisi_id === kisiId),
        bugun,
      });
      if (!b) continue;
      const yil = tamYil(b.etkinBaslangic, b.sonrakiHakEdis);
      ogeler.push({
        tarih: b.sonrakiHakEdis,
        tur: "İzin",
        metin: `${kisi?.ad_soyad ?? ""} ${yil}. yılını dolduruyor, ${b.sonrakiHakGun} gün yeni izin hakkı`,
        href: "/izin",
      });
    }
  }

  if (g.moduller.includes("puantaj")) {
    const buAy = bugun.slice(0, 7);
    const [y, m] = buAy.split("-").map(Number);
    const gecenAy = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
    for (const ay of [gecenAy, buAy]) {
      if (g.puantajBaslangicAy && ay < g.puantajBaslangicAy) continue;
      if (g.kapaliAylar.includes(ay)) continue;
      ogeler.push({
        tarih: aySonu(ay),
        tur: "Puantaj",
        metin: `${ayAdi(ay)[0].toLocaleUpperCase("tr")}${ayAdi(ay).slice(1)} puantajını kapat, muhasebeye gönder`,
        href: `/puantaj?ay=${ay}`,
      });
    }
  }

  // Fazla çalışma onayının geri alınması 30 gün sonra hüküm doğurur (Yön. md. 9).
  for (const d of g.donemler) {
    if (!d.fazla_calisma_geri_alma || (d.cikis_tarihi && d.cikis_tarihi < bugun)) continue;
    const tarih = gunEkle(d.fazla_calisma_geri_alma, FAZLA_CALISMA.onayGeriAlmaGun.deger);
    if (tarih < bugun) continue;
    ogeler.push({
      tarih,
      tur: "Puantaj",
      metin: `${ad.get(d.kisi_id) ?? ""}: bu günden itibaren fazla çalışma yaptırılamaz (onay geri alındı)`,
      href: `/kisi/${d.kisi_id}`,
      dayanak: FAZLA_CALISMA.onayGeriAlmaGun.dayanak,
    });
  }

  // KVKK: işten ayrılanın verileri saklama süresi dolunca silinir ya da anonimleştirilir.
  for (const k of g.kisiler) {
    const kd = g.donemler.filter((d) => d.kisi_id === k.id);
    if (kd.length === 0 || kd.some((d) => !d.cikis_tarihi || d.cikis_tarihi >= bugun)) continue;
    const sonCikis = kd.map((d) => d.cikis_tarihi!).sort().at(-1)!;
    ogeler.push({
      tarih: saklamaBitisi(sonCikis),
      tur: "KVKK",
      metin: `${k.ad_soyad}: kişisel verilerin saklama süresi doluyor, sil ya da anonimleştir`,
      href: `/kisi/${k.id}`,
      dayanak: SGK.saklamaYil.dayanak,
    });
  }

  // Duruma bağlı süreler (0030).
  for (const d of g.durumlar ?? []) {
    const kisi = ad.get(d.kisi_id) ?? "";
    const href = `/kisi/${d.kisi_id}`;
    if (d.tur === "calisma_izni" && d.bitis) {
      ogeler.push({ tarih: d.bitis, tur: "Çalışan", metin: `${kisi}: çalışma izni bitiyor, uzatma başvurusu`, href, dayanak: DURUM_BILGI.calisma_izni.dayanak });
    } else if (d.tur === "gece_raporu" && d.bitis) {
      ogeler.push({ tarih: d.bitis, tur: "İSG", metin: `${kisi}: gece çalışma sağlık raporu yenileme`, href, dayanak: DURUM_BILGI.gece_raporu.dayanak });
    } else if (d.tur === "kosul_degisikligi" && !d.tamamlandi) {
      ogeler.push({
        tarih: kosulKabulSonGun(d.baslangic),
        tur: "Çalışan",
        metin: `${kisi}: çalışma koşulu değişikliğine yazılı kabul (alınmazsa bağlamaz)`,
        href,
        dayanak: DURUM_BILGI.kosul_degisikligi.dayanak,
      });
    }
  }
  // BES: cayma süresi (dahil edilmeden itibaren 2 ay).
  for (const k of g.kisiler) {
    if (!k.bes_katilim || k.bes_cayma) continue;
    const son = besCaymaSonGun(k.bes_katilim);
    if (son < bugun) continue;
    ogeler.push({ tarih: son, tur: "Çalışan", metin: `${k.ad_soyad}: BES'ten cayma süresi bitiyor`, href: `/kisi/${k.id}`, dayanak: BES.caymaAy.dayanak });
  }

  const sinir = gunEkle(bugun, TAKVIM_ILERI_GUN);
  return ogeler.filter((o) => o.tarih <= sinir).sort((a, b) => a.tarih.localeCompare(b.tarih) || a.metin.localeCompare(b.metin, "tr"));
}

export type TakvimGrubu = { baslik: string; ogeler: TakvimOgesi[] };

/** Gecikmiş / Bu hafta / Gelecek hafta / Daha sonra (hafta Pazartesi başlar). */
export function takvimGruplari(ogeler: TakvimOgesi[], bugun: string): TakvimGrubu[] {
  const gun = (new Date(`${bugun}T00:00:00Z`).getUTCDay() + 6) % 7;
  const buHaftaSonu = gunEkle(bugun, 6 - gun);
  const gelecekHaftaSonu = gunEkle(buHaftaSonu, 7);
  const gruplar: TakvimGrubu[] = [
    { baslik: "Süresi geçti", ogeler: ogeler.filter((o) => o.tarih < bugun) },
    { baslik: "Bu hafta", ogeler: ogeler.filter((o) => o.tarih >= bugun && o.tarih <= buHaftaSonu) },
    { baslik: "Gelecek hafta", ogeler: ogeler.filter((o) => o.tarih > buHaftaSonu && o.tarih <= gelecekHaftaSonu) },
    { baslik: "Daha sonra", ogeler: ogeler.filter((o) => o.tarih > gelecekHaftaSonu) },
  ];
  return gruplar.filter((g) => g.ogeler.length > 0);
}

/** Sabah mailine girecekler: tam N gün kalanlar ve bugün son gün olanlar
 *  yeni hatırlatmadır; mail gidiyorsa süresi geçenler de eklenir. */
export function hatirlatmaSecimi(
  ogeler: TakvimOgesi[],
  bugun: string,
  onceGun: number,
): { yeni: TakvimOgesi[]; gecikmis: TakvimOgesi[] } {
  const hedef = gunEkle(bugun, onceGun);
  const yeni = ogeler.filter((o) => o.tarih === hedef || o.tarih === bugun);
  const gecikmis = yeni.length ? ogeler.filter((o) => o.tarih < bugun) : [];
  return { yeni, gecikmis };
}
