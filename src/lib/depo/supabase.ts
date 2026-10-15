import { createClient } from "@/lib/supabase/server";
import { DosyaZatenVarHatasi, icerikTuru, sonParca, ustKlasor, type Depo } from "@/lib/depo/tipler";

// Varsayılan depo: Supabase Storage (özel bucket, yalnızca oturum açmış
// kullanıcı erişir — bkz. supabase/migrations/0020_depo_ve_isg_mail.sql).
// Klasör kavramı yok, yollar nesne anahtarının önekidir.
//
// Supabase anahtarlarında yalnızca ASCII harf/rakam ve birkaç işaret
// geçebiliyor; "Özlük/AKTİF/AYŞE DEMİR" gibi Türkçe yollar her parça için
// geri çevrilebilir biçimde kodlanır: izinli olmayan her karakter (ve "+"
// işaretinin kendisi) "+" ve 6 haneli onaltılık kod noktasıyla yazılır.

const BUCKET = process.env.SUPABASE_DEPO_BUCKET || "ozluk";
const ETIKET = "Supabase Storage";
const IZINLI = /[A-Za-z0-9_\-.!*'() &$@=;:,?]/;
const YER_TUTUCU = ".emptyFolderPlaceholder";

export function parcaKodla(parca: string): string {
  let sonuc = "";
  for (const harf of parca) {
    if (harf !== "+" && IZINLI.test(harf)) sonuc += harf;
    else sonuc += "+" + harf.codePointAt(0)!.toString(16).toUpperCase().padStart(6, "0");
  }
  return sonuc;
}

export function parcaCoz(parca: string): string {
  return parca.replace(/\+([0-9A-F]{6})/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

function anahtar(yol: string): string {
  return yol.split("/").filter(Boolean).map(parcaKodla).join("/");
}

type Kova = ReturnType<Awaited<ReturnType<typeof createClient>>["storage"]["from"]>;
type Oge = { name: string; id: string | null };

/** Kova erişimi dışarıdan verilebilir (testler gizli anahtarlı bir istemciyle
 *  çağırır); uygulamada oturum açmış kullanıcının istemcisi kullanılır. */
export function supabaseDepoOlustur(
  kova: () => Promise<Kova> = async () => (await createClient()).storage.from(BUCKET),
  apikey: string = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
): Depo {
  async function listele(onekAnahtar: string): Promise<Oge[]> {
    const k = await kova();
    const tum: Oge[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await k.list(onekAnahtar, { limit: 1000, offset });
      if (error) throw new Error(`Depo listelenemedi: ${error.message}`);
      tum.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return tum.filter((o) => o.name !== YER_TUTUCU);
  }

  async function ogeBul(yol: string): Promise<Oge | undefined> {
    const ad = parcaKodla(sonParca(yol));
    return (await listele(anahtar(ustKlasor(yol)))).find((o) => o.name === ad);
  }

  /** Önekin altındaki tüm dosya anahtarları (alt klasörler dahil). */
  async function tumDosyaAnahtarlari(onekAnahtar: string): Promise<string[]> {
    const sonuc: string[] = [];
    for (const oge of await listele(onekAnahtar)) {
      const tam = `${onekAnahtar}/${oge.name}`;
      if (oge.id === null) sonuc.push(...(await tumDosyaAnahtarlari(tam)));
      else sonuc.push(tam);
    }
    return sonuc;
  }

  return {
    ad: "supabase",
    etiket: ETIKET,

    async varMi(yol) {
      return (await ogeBul(yol)) !== undefined;
    },

    async klasorOlustur() {
      // Önekler ilk dosya yazıldığında kendiliğinden oluşur.
    },

    async dosyalariListele(klasorYol) {
      const ogeler = await listele(anahtar(klasorYol));
      return ogeler.filter((o) => o.id !== null).map((o) => parcaCoz(o.name));
    },

    async yaz(yol, veri) {
      const k = await kova();
      const { error } = await k.upload(anahtar(yol), veri, { contentType: icerikTuru(yol), upsert: false });
      if (error) {
        if (/exists|duplicate/i.test(error.message)) throw new DosyaZatenVarHatasi(sonParca(yol), ETIKET);
        throw new Error(`Depoya yazılamadı: ${error.message}`);
      }
    },

    async indir(yol) {
      const k = await kova();
      const { data, error } = await k.download(anahtar(yol));
      if (error || !data) throw new Error(`Dosya indirilemedi (${sonParca(yol)}): ${error?.message ?? ""}`);
      return Buffer.from(await data.arrayBuffer());
    },

    async tasi(kaynakYol, hedefYol) {
      const k = await kova();
      const kaynak = anahtar(kaynakYol);
      const hedef = anahtar(hedefYol);
      // Dosya mı klasör (önek) mü? Listede klasörlerin id'si null gelir.
      const oge = await ogeBul(kaynakYol);
      if (!oge) throw new Error(`Taşınacak bir şey bulunamadı: ${sonParca(kaynakYol)}`);
      const dosyalar = oge.id !== null ? [kaynak] : await tumDosyaAnahtarlari(kaynak);
      for (const d of dosyalar) {
        const yeni = d === kaynak ? hedef : hedef + d.slice(kaynak.length);
        const { error } = await k.move(d, yeni);
        if (error) throw new Error(`Taşınamadı (${sonParca(kaynakYol)}): ${error.message}`);
      }
    },

    async yuklemeOturumuAc(yol) {
      if (await ogeBul(yol)) throw new DosyaZatenVarHatasi(sonParca(yol), ETIKET);
      const k = await kova();
      const { data, error } = await k.createSignedUploadUrl(anahtar(yol));
      if (error || !data) throw new Error(`Yükleme başlatılamadı: ${error?.message ?? ""}`);
      return {
        uploadUrl: data.signedUrl,
        yontem: "tek",
        // supabase-js uploadToSignedUrl ile aynı başlıklar (ham gövde biçimi).
        basliklar: {
          "content-type": icerikTuru(yol),
          "cache-control": "max-age=3600",
          "x-upsert": "false",
          apikey,
        },
      };
    },
  };
}

export const supabaseDepo: Depo = supabaseDepoOlustur();
