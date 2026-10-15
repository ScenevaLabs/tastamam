import { docxPaketle, imzaTablosu, paragraf as p, tablo } from "@/lib/docx";

// Yıllık izin formu (izin kayıt belgesinin tek izinlik nüshası). Alanlar
// Yıllık Ücretli İzin Yönetmeliği md. 20 ve EK-I'e göre. Şablon dosyası
// yerine kodla üretilir; kurumsal bir şablon istenirse sözleşmedeki gibi
// docxtemplater'a geçilebilir.

export type IzinFormuVerisi = {
  sirketUnvani: string;
  adSoyad: string;
  tcKimlikNo: string;
  iseGirisTarihi: string;
  kidem: string;
  hakKazanmaTarihi: string;
  hakEdilenGun: string;
  baslangic: string;
  bitis: string;
  isbasi: string;
  gun: number;
  yolIzniGun: number;
  kalanGun: string;
  duzenlemeTarihi: string;
};

export function izinFormuDocx(v: IzinFormuVerisi): Buffer {
  const govde = [
    p(v.sirketUnvani, { kalin: true, ortala: true, boyut: 12 }),
    p("YILLIK ÜCRETLİ İZİN FORMU", { kalin: true, ortala: true, boyut: 14, sonra: 300 }),
    tablo(
      [3800, 5200],
      ([
      ["Adı soyadı", v.adSoyad],
      ["T.C. kimlik no", v.tcKimlikNo],
      ["İşe giriş tarihi (kıdem başlangıcı)", v.iseGirisTarihi],
      ["Kıdem", v.kidem],
      ["İzne hak kazanma tarihi", v.hakKazanmaTarihi],
      ["Hak edilen izin", v.hakEdilenGun],
      ["İzin başlangıç tarihi", v.baslangic],
      ["İzin bitiş tarihi", v.bitis],
      ["İşbaşı tarihi", v.isbasi],
      ["Kullanılan izin", `${v.gun} gün`],
      ["Yol izni (ücretsiz)", v.yolIzniGun ? `${v.yolIzniGun} gün` : "Yok"],
      ["İzin sonrası kalan", v.kalanGun],
      ] as [string, string][]).map(([a, b]) => [
        { metin: a, kalin: true },
        { metin: b },
      ]),
    ),
    p(""),
    p(
      "Yukarıda belirtilen tarihler arasında yıllık ücretli iznimi kullanmak istiyorum. İzin süresine denk gelen hafta tatili ve genel tatil günleri izinden düşülmemiştir.",
      { sonra: 300 },
    ),
    p(`Düzenleme tarihi: ${v.duzenlemeTarihi}`, { sonra: 300 }),
    imzaTablosu("İzni kullanan işçi", "İşveren / işveren vekili"),
    p(""),
    p("Dayanak: 4857 sayılı İş Kanunu md. 53–56, Yıllık Ücretli İzin Yönetmeliği md. 20.", { boyut: 8 }),
  ].join("");

  return docxPaketle(govde);
}
