import { docxPaketle, imzaTablosu, paragraf as p, tablo, type TabloHucresi } from "@/lib/docx";
import { CALISMA, PUANTAJ_KOD_ADI, calismaSuresi, haftaGunu, saatMetni } from "@/lib/mevzuat";
import type { PuantajSatiri } from "@/lib/puantaj";

// Çalışana imzalatılan aylık çalışma çizelgesi (14 Ekim 2026, kullanıcı kararı:
// giriş–çıkış saatleri elle girilir). Çalışma süreleri "uygun araçlarla"
// belgelenir (Çalışma Süreleri Yön. md. 9); işçinin imzaladığı çizelge fazla
// çalışma uyuşmazlığında yazılı delildir.

const GUN = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export type PuantajFormuVerisi = {
  sirketUnvani: string;
  adSoyad: string;
  tcKimlikNo: string;
  meslek: string;
  ayAdi: string;
  satir: PuantajSatiri;
  duzenlemeTarihi: string;
};

function tarihKisa(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

function sayi(n: number): string {
  return String(n).replace(".", ",");
}

// Tek sayfa A4 (20 Ekim 2026): 31 günlük ay, her gün saatli en kötü
// durumda da bir sayfaya sığar; satır boşlukları buna göre dar.
export function puantajFormuDocx(v: PuantajFormuVerisi): Buffer {
  const G = [850, 1250, 1800, 850, 850, 950, 1350, 1100]; // toplam 9000
  const baslik: TabloHucresi[] = ["Tarih", "Gün", "Durum", "Giriş", "Çıkış", "Ara din.", "Çalışma", "Fazla ç."].map(
    (m) => ({ metin: m, kalin: true, boyut: 8, golge: true }),
  );

  let toplamNet = 0;
  const satirlar: TabloHucresi[][] = v.satir.hucreler.map((h) => {
    const sure = h.giris && h.cikis ? calismaSuresi(h.giris, h.cikis) : null;
    if (sure) toplamNet += sure.netSaat;
    const durum =
      h.kod === null ? "İş dönemi dışında" : h.kod === "" ? "" : PUANTAJ_KOD_ADI[h.kod].charAt(0).toLocaleUpperCase("tr-TR") + PUANTAJ_KOD_ADI[h.kod].slice(1);
    const kucuk = (metin: string, ekstra: Partial<TabloHucresi> = {}): TabloHucresi => ({ metin, boyut: 8, ...ekstra });
    return [
      kucuk(tarihKisa(h.tarih)),
      kucuk(GUN[haftaGunu(h.tarih)]),
      kucuk(durum),
      kucuk(h.giris ?? ""),
      kucuk(h.cikis ?? ""),
      kucuk(sure ? `${sure.araDk} dk` : ""),
      kucuk(sure ? saatMetni(sure.netSaat) : ""),
      kucuk(h.fazlaSaat > 0 ? `${sayi(h.fazlaSaat)} saat` : ""),
    ];
  });

  const eksikGun = v.satir.eksik.reduce((t, e) => t + e.gun, 0);
  const ozet: [string, string][] = [
    ["Çalışılan gün", `${v.satir.calisilan} gün`],
    ["Toplam çalışma (saati girilen günler)", toplamNet ? saatMetni(toplamNet) : "—"],
    ["Toplam fazla çalışma", `${sayi(v.satir.fazlaSaat)} saat`],
    [
      "Eksik gün",
      eksikGun ? `${eksikGun} gün (${v.satir.eksik.map((e) => `${e.ad} ${e.gun}`).join(", ")})` : "Yok",
    ],
  ];

  const govde = [
    p(v.sirketUnvani, { kalin: true, ortala: true, boyut: 11, sonra: 60 }),
    p(`AYLIK ÇALIŞMA ÇİZELGESİ (PUANTAJ) · ${v.ayAdi.toLocaleUpperCase("tr-TR")}`, {
      kalin: true,
      ortala: true,
      boyut: 12,
      sonra: 160,
    }),
    tablo(
      [2200, 2300, 1700, 2800],
      [
        [
          { metin: "Adı soyadı", kalin: true, boyut: 9 },
          { metin: v.adSoyad, boyut: 9 },
          { metin: "T.C. kimlik no", kalin: true, boyut: 9 },
          { metin: v.tcKimlikNo, boyut: 9 },
        ],
        [
          { metin: "Meslek", kalin: true, boyut: 9 },
          { metin: v.meslek, boyut: 9 },
          { metin: "Dönem", kalin: true, boyut: 9 },
          { metin: v.ayAdi, boyut: 9 },
        ],
      ],
      40,
    ),
    p("", { sonra: 60 }),
    tablo(G, [baslik, ...satirlar], 10),
    p("", { sonra: 60 }),
    tablo(
      [4500, 4500],
      ozet.map(([a, b]) => [
        { metin: a, kalin: true, boyut: 9 },
        { metin: b, boyut: 9 },
      ]),
      20,
    ),
    p(
      `Normal günlük çalışma ${saatMetni(CALISMA.gunlukNormalSaat.deger)}; ara dinlenme çalışma süresinden sayılmaz. Hafta tatili ve genel tatilde yapılan çalışmanın tamamı fazla çalışmadır.`,
      { boyut: 8, sonra: 120 },
    ),
    p(
      "Bu çizelgedeki çalışma, hafta tatili, genel tatil ve izin günleri ile giriş–çıkış saatleri ve fazla çalışma süreleri doğrudur.",
      { boyut: 10, sonra: 120 },
    ),
    p(`Düzenleme tarihi: ${v.duzenlemeTarihi}`, { boyut: 9, sonra: 160 }),
    imzaTablosu("Çalışan", "İşveren / işveren vekili", 9000, 700),
    p(
      "Dayanak: 4857 sayılı İş Kanunu md. 41, 63, 68; Çalışma Süreleri Yönetmeliği md. 9; İş Kanununa İlişkin Fazla Çalışma ve Fazla Sürelerle Çalışma Yönetmeliği.",
      { boyut: 7 },
    ),
  ].join("");

  return docxPaketle(govde, 720);
}
