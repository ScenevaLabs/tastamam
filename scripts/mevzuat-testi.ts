// Mevzuat kurallarının hesap testleri: npm run test:mevzuat
// Beklenen değerler MEVZUAT.md'den elle hesaplandı.
import assert from "node:assert/strict";
import {
  engelliKontenjani,
  fazlaCalismaYuvarla,
  calismaSuresi,
  fazlaSaatSiniri,
  saatMetni,
  saattenFazlaCalisma,
  genelTatil,
  ihbarSuresiHafta,
  isbasiTarihi,
  izinGunSay,
  yilEkle,
  yillikIzinGunu,
  yolIzniGunleri,
} from "../src/lib/mevzuat";
import { cikisIzinHesabi, gunlukUcret, izinBakiyesi, kidemMetni } from "../src/lib/izin";
import { puantajSatiri } from "../src/lib/puantaj";
import { isKazasiSonGun } from "../src/lib/mevzuat";
import { calisanIsgTakibi, isyeriBelgeTakibi } from "../src/lib/isg-takip";
import { hatirlatmaSecimi, takvimGruplari, takvimOgeleri } from "../src/lib/takvim";
import type { IsgBelge } from "../src/lib/types";
import PizZip from "pizzip";
import { fazlaCalismaEngeli, fazlaCalismaVar, kosulluBelgeler, pusulaAylari, saklamaBitisi } from "../src/lib/donem-belge";
import { besCaymaSonGun, kosulKabulSonGun } from "../src/lib/durum";
import { SABLON_ADLARI, ornekSablon, sablonDogrula, sablonDoldur } from "../src/lib/sablon";

function docxMetni(b: Buffer): string {
  const x = new PizZip(b).file("word/document.xml")!.asText();
  return x.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "");
}

let gecen = 0;
const bekleyen: Promise<void>[] = [];
function test(ad: string, fn: () => void | Promise<void>) {
  bekleyen.push(
    Promise.resolve(fn()).then(() => {
      gecen++;
      console.log("ok ", ad);
    }),
  );
}

test("yıllık izin kademeleri", () => {
  assert.equal(yillikIzinGunu(0, 30), 0);
  assert.equal(yillikIzinGunu(1, 30), 14);
  assert.equal(yillikIzinGunu(5, 30), 14);
  assert.equal(yillikIzinGunu(6, 30), 20);
  assert.equal(yillikIzinGunu(14, 30), 20);
  assert.equal(yillikIzinGunu(15, 30), 26);
});

test("yaş alt sınırı 20 gün", () => {
  assert.equal(yillikIzinGunu(1, 18), 20);
  assert.equal(yillikIzinGunu(1, 19), 14);
  assert.equal(yillikIzinGunu(2, 50), 20);
  assert.equal(yillikIzinGunu(16, 55), 26);
  assert.equal(yillikIzinGunu(3, null), 14);
});

test("genel tatiller", () => {
  assert.equal(genelTatil("2026-10-29")?.yarim, false);
  assert.equal(genelTatil("2026-10-28")?.yarim, true);
  assert.equal(genelTatil("2026-03-19")?.yarim, true);
  assert.equal(genelTatil("2026-05-30")?.ad, "Kurban Bayramı");
  assert.equal(genelTatil("2027-03-09")?.ad, "Ramazan Bayramı");
  assert.equal(genelTatil("2026-10-27"), null);
});

test("izin günü: Pazar ve tam gün tatil düşülmez, arife sayılır", () => {
  const r = izinGunSay("2026-10-26", "2026-10-30");
  assert.equal(r.gun, 4);
  assert.deepEqual(r.sayilmayan.map((s) => s.tarih), ["2026-10-29"]);
  assert.equal(izinGunSay("2026-10-05", "2026-10-11").gun, 6); // Pzt–Pzr, Cumartesi sayılır
  assert.equal(izinGunSay("2026-05-25", "2026-05-31").gun, 2); // Pzt + arife; bayram ve Pazar düşülmez
});

test("işbaşı tarihi", () => {
  assert.equal(isbasiTarihi("2026-10-30"), "2026-10-31");
  assert.equal(isbasiTarihi("2026-10-31"), "2026-11-02");
  assert.equal(isbasiTarihi("2026-05-26"), "2026-06-01");
});

test("yol izni günleri ve yol izniyle işbaşı", () => {
  // 23 Eki Cuma bitiş: 24 Cmt, (25 Pazar atlanır) 26 Pzt
  assert.deepEqual(yolIzniGunleri("2026-10-23", 2), ["2026-10-24", "2026-10-26"]);
  assert.equal(isbasiTarihi("2026-10-23", 2), "2026-10-27");
  // 28 Eki bitiş: 29 Ekim tatil atlanır
  assert.deepEqual(yolIzniGunleri("2026-10-28", 1), ["2026-10-30"]);
  assert.deepEqual(yolIzniGunleri("2026-10-23", 0), []);
  assert.equal(isbasiTarihi("2026-10-23", 0), "2026-10-24");
});

test("günlük fazla çalışma tavanı (toplam 11 saat)", () => {
  assert.equal(fazlaSaatSiniri("Ç"), 3.5);
  assert.equal(fazlaSaatSiniri("HT"), 11);
  assert.equal(fazlaSaatSiniri("GT"), 11);
  assert.equal(fazlaSaatSiniri("R"), 0);
  assert.equal(fazlaSaatSiniri("Yİ"), 0);
  assert.equal(fazlaSaatSiniri("Üİ"), 0);
});

test("yıl ekleme 29 Şubat", () => {
  assert.equal(yilEkle("2024-02-29", 1), "2025-02-28");
  assert.equal(yilEkle("2024-02-29", 4), "2028-02-29");
});

test("fazla çalışma yuvarlama", () => {
  assert.equal(fazlaCalismaYuvarla(2), 2);
  assert.equal(fazlaCalismaYuvarla(2.2), 2.5);
  assert.equal(fazlaCalismaYuvarla(2.5), 2.5);
  assert.equal(fazlaCalismaYuvarla(2.6), 3);
  assert.equal(fazlaCalismaYuvarla(0.1), 0.5);
});

test("ihbar ve engelli kontenjanı", () => {
  assert.equal(ihbarSuresiHafta(100), 2);
  assert.equal(ihbarSuresiHafta(200), 4);
  assert.equal(ihbarSuresiHafta(700), 6);
  assert.equal(ihbarSuresiHafta(1200), 8);
  assert.equal(engelliKontenjani(49), 0);
  assert.equal(engelliKontenjani(50), 2); // 1,5 → 2
  assert.equal(engelliKontenjani(83), 2); // 2,49 → 2
});

test("izin bakiyesi: hak yok, ilk yıl, devir", () => {
  const yeni = izinBakiyesi({ donemler: [{ giris_tarihi: "2026-07-15", cikis_tarihi: null }], dogumTarihi: null, izinler: [], bugun: "2026-10-13" })!;
  assert.equal(yeni.buYilHak, null);
  assert.equal(yeni.sonrakiHakEdis, "2027-07-15");
  assert.equal(yeni.sonrakiHakGun, 14);

  const b = izinBakiyesi({
    donemler: [{ giris_tarihi: "2021-11-03", cikis_tarihi: null }],
    dogumTarihi: "1990-04-12",
    izinler: [
      { baslangic: "2025-07-01", gun: 40 },
      { baslangic: "2026-08-03", gun: 5 },
    ],
    bugun: "2026-10-13",
  })!;
  assert.equal(b.sonHakEdis, "2025-11-03");
  assert.equal(b.buYilHak, 14);
  assert.equal(b.devreden, 2); // 3 × 14 − 40
  assert.equal(b.kullanilan, 5);
  assert.equal(b.kalan, 11);
  assert.equal(kidemMetni(b.etkinBaslangic, "2026-10-13"), "4 yıl");
});

test("izin bakiyesi: önceki dönem kıdeme eklenir, hakkı devretmez", () => {
  const b = izinBakiyesi({
    donemler: [
      { giris_tarihi: "2024-03-11", cikis_tarihi: "2024-04-30" }, // 51 gün
      { giris_tarihi: "2025-06-02", cikis_tarihi: null },
    ],
    dogumTarihi: null,
    izinler: [{ baslangic: "2024-04-01", gun: 3 }],
    bugun: "2026-10-13",
  })!;
  assert.equal(b.etkinBaslangic, "2025-04-12");
  assert.equal(b.sonHakEdis, "2026-04-12");
  assert.equal(b.devreden, 0);
  assert.equal(b.kalan, 14);
});

test("izin bakiyesi: yaş 50 üstü 20 gün", () => {
  const b = izinBakiyesi({ donemler: [{ giris_tarihi: "2019-01-11", cikis_tarihi: null }], dogumTarihi: "1974-06-21", izinler: [], bugun: "2026-10-13" })!;
  assert.equal(b.buYilHak, 20); // kıdem 7 → 20 zaten
  const genc = izinBakiyesi({ donemler: [{ giris_tarihi: "2025-07-15", cikis_tarihi: null }], dogumTarihi: "2008-02-03", izinler: [], bugun: "2026-10-13" })!;
  assert.equal(genc.buYilHak, 20); // 18 yaşında hak kazandı
});

test("puantaj satırı", () => {
  const s = puantajSatiri({
    kisiId: "k",
    adSoyad: "Deneme",
    ay: "2026-10",
    donemler: [{ giris_tarihi: "2026-10-12", cikis_tarihi: null }],
    izinler: [{ baslangic: "2026-10-26", bitis: "2026-10-27", yol_izni_gun: 1 }],
    elle: [
      { kisi_id: "k", tarih: "2026-10-13", kod: "R", fazla_saat: 0, notu: null },
      { kisi_id: "k", tarih: "2026-10-12", kod: null, fazla_saat: 2, notu: null },
    ],
    bugun: "2026-10-31",
    kapali: false,
  });
  const kod = (g: number) => s.hucreler[g - 1].kod;
  assert.equal(kod(11), null);
  assert.equal(kod(12), "Ç");
  assert.equal(kod(13), "R");
  assert.equal(kod(18), "HT");
  assert.equal(kod(26), "Yİ");
  assert.equal(kod(28), "Üİ"); // yol izni: izni izleyen ilk iş günü (arife)
  assert.equal(kod(30), "Ç");
  assert.equal(kod(29), "GT");
  assert.equal(s.fazlaSaat, 2);
  assert.deepEqual(s.eksik.map((e) => [e.sgkKodu, e.gun]), [["01", 1], ["21", 1]]);
  assert.equal(s.calisilan, 13); // 20 gün − R − 2 Yİ − Üİ − 2 HT (18, 25) − GT
  assert.equal(s.ucretliGun, 18);
});

test("çıkışta ödenecek izin ve çıkıştan sonraya taşan izin", () => {
  const donemler = [{ giris_tarihi: "2024-03-01", cikis_tarihi: "2026-10-25" }];
  const h = cikisIzinHesabi({
    donemler,
    cikisTarihi: "2026-10-25",
    dogumTarihi: "1970-06-15", // 50 üstü: yılda 20 gün
    izinler: [
      { id: "a", baslangic: "2026-10-19", bitis: "2026-10-23", gun: 5 },
      { id: "b", baslangic: "2026-10-27", bitis: "2026-10-31", gun: 4 },
    ],
  })!;
  assert.equal(h.kalan, 35); // 20 + 20 − 5; taşan izin kullanılmış sayılmaz
  assert.deepEqual(h.tasanlar.map((t) => [t.id, t.tasanGun]), [["b", 4]]);
  // Çıkışı kapsayan izin: çıkışa kadarki günler (20–24 Eki, 5 gün) kullanılmış sayılır.
  const k = cikisIzinHesabi({
    donemler,
    cikisTarihi: "2026-10-25",
    dogumTarihi: "1970-06-15",
    izinler: [{ id: "c", baslangic: "2026-10-20", bitis: "2026-10-28", gun: 8 }],
  })!;
  assert.equal(k.kalan, 35);
  assert.deepEqual(k.tasanlar.map((t) => t.tasanGun), [3]);
});

test("giriş–çıkış saatinden çalışma ve fazla çalışma (ara dinlenme md. 68)", () => {
  // 09:00–19:30: 10,5 saat − 1 saat ara = 9,5 saat; 7,5 üstü 2 saat FM
  const a = calismaSuresi("09:00", "19:30");
  assert.equal(a.araDk, 60);
  assert.equal(a.netSaat, 9.5);
  assert.equal(saattenFazlaCalisma("Ç", a.netSaat), 2);
  // 09:00–17:00: 8 saat brüt > 7,5 → 1 saat ara, 7 saat net, FM yok
  const b = calismaSuresi("09:00", "17:00");
  assert.equal(b.araDk, 60);
  assert.equal(b.netSaat, 7);
  assert.equal(saattenFazlaCalisma("Ç", b.netSaat), 0);
  // 09:00–16:30: 7,5 brüt → 30 dk ara, 7 saat net
  assert.equal(calismaSuresi("09:00", "16:30").araDk, 30);
  // 09:00–12:00: 3 saat → 15 dk ara
  assert.equal(calismaSuresi("09:00", "12:00").araDk, 15);
  // Gece yarısını geçen vardiya: 22:00–06:00 = 8 saat brüt, 7 net
  assert.equal(calismaSuresi("22:00", "06:00").netSaat, 7);
  // Hafta tatilinde çalışmanın tamamı FM: 10:00–14:20 → 4s20 − 30 dk = 3s50 → 4 saat
  assert.equal(saattenFazlaCalisma("HT", calismaSuresi("10:00", "14:20").netSaat), 4);
  // 7,75 net → FM 0,25 → yarım saate yuvarlanır
  assert.equal(saattenFazlaCalisma("Ç", 7.75), 0.5);
  assert.equal(saatMetni(9.5), "9 saat 30 dk");
  assert.equal(saatMetni(0.25), "15 dk");
});

test("günlük ücret: boşsa asgari ücret", () => {
  assert.equal(gunlukUcret(null, null, 30000), 1000);
  assert.equal(gunlukUcret(45000, "aylik", 30000), 1500);
  assert.equal(gunlukUcret(1250, "gunluk", 30000), 1250);
  assert.equal(gunlukUcret(1250, null, 30000), 1250); // tür yoksa günlük
});

test("iş kazası bildirimi: 3 iş günü, hafta sonu ve tam gün tatil sayılmaz", () => {
  assert.equal(isKazasiSonGun("2026-10-12"), "2026-10-15"); // Pzt → Per (onaylı ekran)
  assert.equal(isKazasiSonGun("2026-10-22"), "2026-10-27"); // Per → Cum, Pzt, Sal
  assert.equal(isKazasiSonGun("2026-10-27"), "2026-11-02"); // arife iş günü, 29 Ekim tatil
  assert.equal(isKazasiSonGun("2026-05-25"), "2026-06-02"); // arife 1, bayram atlanır, 1 ve 2 Haziran
});

function isg(tip: IsgBelge["belge_tipi"], alinma: string, gecerlilik: string | null = null): IsgBelge {
  return {
    id: alinma + tip,
    kisi_id: "k",
    belge_tipi: tip,
    durum: "var",
    alinma_tarihi: alinma,
    gecerlilik_tarihi: gecerlilik,
    dosya_adi: null,
    notu: null,
    created_at: "",
  };
}

test("İSG: tehlikeli sınıfta eğitim 2, muayene 3 yılda bir", () => {
  const t = calisanIsgTakibi({
    sinif: "tehlikeli",
    girisTarihi: "2024-03-04",
    belgeler: [
      isg("isg_egitim_sertifikasi", "2024-03-18", "2027-03-18"),
      isg("saglik_raporu", "2023-10-24"),
      isg("oryantasyon_formu", "2024-03-04"),
    ],
    bugun: "2026-10-15",
  });
  assert.equal(t.egitim.sonraki, "2026-03-18"); // yasal süre sertifikadakinden erken
  assert.equal(t.egitim.durum, "gecikti");
  assert.equal(t.muayene.sonraki, "2026-10-24");
  assert.equal(t.muayene.durum, "yaklasiyor");
  assert.equal(t.iseBaslama.durum, "tamam");
});

test("İSG: yeni çalışana temel eğitim 3 ay içinde, rapor işe başlamadan", () => {
  const t = calisanIsgTakibi({ sinif: "az", girisTarihi: "2026-09-01", belgeler: [], bugun: "2026-10-15" });
  assert.equal(t.egitim.sonraki, "2026-12-01");
  assert.equal(t.egitim.durum, "eksik");
  assert.equal(t.muayene.durum, "gecikti");
  assert.equal(t.iseBaslama.durum, "gecikti");
});

test("İSG: iş kazasından sonra risk değerlendirmesi yenilenir", () => {
  const b = isyeriBelgeTakibi({
    sinif: "tehlikeli",
    belgeler: [
      { id: "1", tip: "risk_degerlendirmesi", yapilma_tarihi: "2024-03-01", dosya_adi: null, notu: null, created_at: "" },
      { id: "2", tip: "acil_durum_plani", yapilma_tarihi: "2024-03-01", dosya_adi: null, notu: null, created_at: "" },
    ],
    sonKaza: "2026-10-12",
    bugun: "2026-10-15",
  });
  assert.equal(b[0].kazaSonrasiYenilenmeli, true);
  assert.equal(b[0].durum, "gecikti");
  assert.equal(b[1].sonraki, "2028-03-01");
  assert.equal(b[1].durum, "tamam");
  assert.equal(b[2].durum, "eksik"); // tatbikat kaydı yok
});

test("takvim: SGK süreleri, iş kazası, hatırlatma seçimi", () => {
  const ogeler = takvimOgeleri({
    bugun: "2026-10-15",
    moduller: ["isg"],
    sinif: null,
    puantajBaslangicAy: null,
    kisiler: [
      { id: "a", ad_soyad: "Murat Kaya", dogum_tarihi: null },
      { id: "b", ad_soyad: "Can Yıldız", dogum_tarihi: null },
    ],
    donemler: [
      { id: "d1", kisi_id: "a", giris_tarihi: "2026-09-01", cikis_tarihi: "2026-10-07" },
      { id: "d2", kisi_id: "b", giris_tarihi: "2026-07-15", cikis_tarihi: null },
    ],
    donemBelgeleri: [
      { is_girisi_id: "d1", belge_tipi: "isegiris_bildirgesi", durum: "var" },
      { is_girisi_id: "d2", belge_tipi: "isegiris_bildirgesi", durum: "var" },
    ],
    isgBelgeleri: [],
    isyeriBelgeleri: [],
    kazalar: [
      {
        id: "z",
        kisi_id: "b",
        tur: "is_kazasi",
        olay_tarihi: "2026-10-12",
        olay_saati: null,
        isyeri_disinda: false,
        ogrenme_tarihi: null,
        yer: null,
        aciklama: "",
        yaralanma: null,
        saglik_kurulusu: null,
        istirahat_bas: null,
        istirahat_bit: null,
        taniklar: null,
        haber_verildi_at: null,
        tutanak_dosya: null,
        rapor_dosya: null,
        bildirildi_tarihi: null,
        created_at: "",
      },
    ],
    izinler: [],
    kapaliAylar: [],
  });
  assert.deepEqual(
    ogeler.map((o) => [o.tarih, o.tur]),
    [
      ["2026-10-15", "İş kazası"],
      ["2026-10-17", "SGK"],
    ],
  );
  assert.equal(ogeler[1].metin, "Murat Kaya için işten ayrılış bildirgesi");
  assert.equal(takvimGruplari(ogeler, "2026-10-15")[0].baslik, "Bu hafta");
  // 2 gün önce hatırlat: 17 Ekim tam 2 gün sonra, 15 Ekim bugün son gün.
  assert.equal(hatirlatmaSecimi(ogeler, "2026-10-15", 2).yeni.length, 2);
  assert.equal(hatirlatmaSecimi(ogeler, "2026-10-14", 2).yeni.length, 0);
});

test("puantaj: iş kazası istirahati rapor (R) olarak düşer", () => {
  const s = puantajSatiri({
    kisiId: "b",
    adSoyad: "Can Yıldız",
    ay: "2026-10",
    donemler: [{ giris_tarihi: "2026-07-15", cikis_tarihi: null }],
    izinler: [],
    raporlar: [{ baslangic: "2026-10-13", bitis: "2026-10-15" }],
    elle: [],
    bugun: "2026-10-31",
    kapali: true,
  });
  const kod = (t: string) => s.hucreler.find((h) => h.tarih === t)!.kod;
  assert.equal(kod("2026-10-12"), "Ç");
  assert.equal(kod("2026-10-13"), "R");
  assert.equal(kod("2026-10-15"), "R");
  assert.equal(kod("2026-10-16"), "Ç");
});

test("örnek şablonlar kurgu veriyle doluyor, alan ya da şirkete özgü ifade kalmıyor", async () => {
  const veri = {
    AD_SOYAD: "Ayşe Demir",
    TC: "99000000010",
    ADRES: "Örnek Mah. 1. Sok. No:3 Kadıköy / İstanbul",
    MESLEK: "Montajcı",
    UCRET: "42.000,00 TL",
    IMZA_TARIHI: "14/10/2026",
    BASLAMA_TARIHI: "15/10/2026",
    BITIS_TARIHI: "31/12/2026",
    TARIH: "15/10/2026",
    SIRKET_UNVANI: "ÖRNEK YAPIM LTD. ŞTİ.",
    SIRKET_ADRESI: "Örnek Mah. Defter Sok. No:1",
  };
  for (const ad of SABLON_ADLARI) {
    const dolu = sablonDoldur(await ornekSablon(ad), veri);
    const metin = docxMetni(dolu);
    assert.ok(metin.includes("Ayşe Demir"), `${ad}: ad soyad yok`);
    assert.ok(metin.includes("ÖRNEK YAPIM LTD. ŞTİ."), `${ad}: şirket unvanı yok`);
    assert.ok(!/[{}]/.test(metin), `${ad}: doldurulmamış alan kaldı`);
    assert.ok(!/undefined/.test(metin), `${ad}: undefined yazıldı`);
    // Şirket ve kişi adları dışa aktarım taramasında aranır (public-disa-aktar.mjs).
    assert.ok(!/yapımcı|idare/i.test(metin), `${ad}: başka bir şablondan kalan ifade`);
    const k = sablonDogrula(await ornekSablon(ad), ad);
    assert.equal(k.error, null);
    if (k.error === null) assert.deepEqual(k.bilinmeyen, [], `${ad}: tanınmayan alan`);
  }
});

test("koşullu dönem belgeleri: çalışma belgesi çıkışta, fazla çalışma onayı fazla saatte", () => {
  const acik = { giris_tarihi: "2026-07-15", cikis_tarihi: null };
  const kapali = { giris_tarihi: "2026-09-01", cikis_tarihi: "2026-10-20" };
  const eski = { giris_tarihi: "2025-01-01", cikis_tarihi: "2025-06-30" };
  assert.deepEqual(kosulluBelgeler(acik, { fazlaCalisma: false, baslangic: "2026-10-15" }), []);
  assert.deepEqual(kosulluBelgeler(kapali, { fazlaCalisma: false, baslangic: "2026-10-15" }), ["calisma_belgesi"]);
  assert.deepEqual(kosulluBelgeler(eski, { fazlaCalisma: false, baslangic: "2026-10-15" }), []); // takipten önce
  assert.deepEqual(kosulluBelgeler(eski, { fazlaCalisma: false, baslangic: null }), ["calisma_belgesi"]);
  const elle = [
    { kisi_id: "a", tarih: "2026-10-10", fazla_saat: 2 },
    { kisi_id: "a", tarih: "2026-10-20", fazla_saat: 3 },
  ];
  assert.equal(fazlaCalismaVar(elle, "a", acik, "2026-10-15"), true);
  assert.equal(fazlaCalismaVar(elle, "a", acik, "2026-10-25"), false);
  assert.equal(fazlaCalismaVar(elle, "b", acik, null), false);
});

test("ücret pusulası ayları: bitmiş aylar, takip başlangıcından itibaren", () => {
  assert.deepEqual(pusulaAylari({ giris_tarihi: "2026-07-15", cikis_tarihi: null }, "2026-08-10", "2026-10-15"), [
    "2026-08",
    "2026-09",
  ]);
  assert.deepEqual(pusulaAylari({ giris_tarihi: "2026-10-01", cikis_tarihi: null }, null, "2026-10-15"), []);
  assert.deepEqual(pusulaAylari({ giris_tarihi: "2026-08-01", cikis_tarihi: "2026-08-20" }, null, "2026-10-15"), ["2026-08"]);
});

test("KVKK saklama: çıkış yılını izleyen yılbaşından 10 yıl", () => {
  assert.equal(saklamaBitisi("2026-10-07"), "2037-01-01");
  assert.equal(saklamaBitisi("2016-01-01"), "2027-01-01");
});

test("fazla çalışma engeli: 18 yaş altı, onay yok, geri alındıktan 30 gün sonra", () => {
  const ortak = { onayVar: true, geriAlma: null, dogumTarihi: "1990-01-01" };
  assert.equal(fazlaCalismaEngeli({ ...ortak, tarih: "2026-10-10" }), null);
  assert.equal(fazlaCalismaEngeli({ ...ortak, tarih: "2026-10-10", dogumTarihi: "2008-11-01" }), "yas");
  assert.equal(fazlaCalismaEngeli({ ...ortak, tarih: "2026-10-10", onayVar: false }), "onay_yok");
  assert.equal(fazlaCalismaEngeli({ ...ortak, tarih: "2026-10-30", geriAlma: "2026-10-01" }), null); // 30 gün dolmadı
  assert.equal(fazlaCalismaEngeli({ ...ortak, tarih: "2026-10-31", geriAlma: "2026-10-01" }), "geri_alindi");
});

test("koşul değişikliği 6 iş günü, BES cayma 2 ay", () => {
  assert.equal(kosulKabulSonGun("2026-10-12"), "2026-10-20"); // Pzt → 6 iş günü sonra Sal
  assert.equal(kosulKabulSonGun("2026-10-26"), "2026-11-04"); // 28 Eki arife iş günü, 29 Ekim tatil
  assert.equal(besCaymaSonGun("2026-08-31"), "2026-10-31");
  assert.equal(besCaymaSonGun("2026-12-31"), "2027-02-28");
});

test("fazla çalışma engeli: gebelik, emzirme, kısmi süre", () => {
  const ortak = { tarih: "2026-10-10", onayVar: true, geriAlma: null, dogumTarihi: "1990-01-01" };
  assert.equal(fazlaCalismaEngeli({ ...ortak, durumlar: [{ tur: "gebelik", baslangic: "2026-09-01", bitis: null }] }), "gebelik");
  assert.equal(fazlaCalismaEngeli({ ...ortak, durumlar: [{ tur: "gebelik", baslangic: "2026-11-01", bitis: null }] }), null);
  assert.equal(fazlaCalismaEngeli({ ...ortak, durumlar: [{ tur: "sut_izni", baslangic: "2026-01-01", bitis: "2026-12-31" }] }), "emzirme");
  assert.equal(fazlaCalismaEngeli({ ...ortak, kismiSureli: true }), "kismi");
});

test("zimmet tutanağı: her eşya bir satır", async () => {
  const dolu = sablonDoldur(await ornekSablon("zimmet_tutanagi"), {
    AD_SOYAD: "Can Yıldız",
    TC: "99000000040",
    TARIH: "15/10/2026",
    SIRKET_UNVANI: "ÖRNEK YAPIM LTD. ŞTİ.",
    SIRKET_ADRESI: "Örnek Mah.",
    ESYALAR: [
      { ESYA: "Dizüstü bilgisayar", SERI_NO: "DB-0042", VERILIS: "15/07/2026" },
      { ESYA: "Giriş kartı", SERI_NO: "", VERILIS: "15/07/2026" },
    ],
  });
  const metin = docxMetni(dolu);
  assert.ok(metin.includes("Dizüstü bilgisayar") && metin.includes("DB-0042") && metin.includes("Giriş kartı"));
  assert.ok(!/[{}]/.test(metin));
});

test("takvim: çalışma izni, koşul değişikliği ve BES cayma süreleri", () => {
  const o = takvimOgeleri({
    bugun: "2026-10-15",
    moduller: [],
    sinif: null,
    puantajBaslangicAy: null,
    kisiler: [{ id: "a", ad_soyad: "Selin Koç", dogum_tarihi: null, bes_katilim: "2026-10-01", bes_cayma: null }],
    donemler: [{ id: "d", kisi_id: "a", giris_tarihi: "2026-10-01", cikis_tarihi: null }],
    donemBelgeleri: [{ is_girisi_id: "d", belge_tipi: "isegiris_bildirgesi", durum: "var" }],
    isgBelgeleri: [],
    isyeriBelgeleri: [],
    kazalar: [],
    izinler: [],
    kapaliAylar: [],
    durumlar: [
      { kisi_id: "a", tur: "calisma_izni", baslangic: "2025-11-01", bitis: "2026-11-30", tamamlandi: null },
      { kisi_id: "a", tur: "kosul_degisikligi", baslangic: "2026-10-12", bitis: null, tamamlandi: null },
    ],
  });
  assert.deepEqual(
    o.map((x) => [x.tarih, x.tur]),
    [
      ["2026-10-20", "Çalışan"],
      ["2026-11-30", "Çalışan"],
      ["2026-12-01", "Çalışan"],
    ],
  );
});

Promise.all(bekleyen).then(
  () => console.log(`\n${gecen} test geçti.`),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
