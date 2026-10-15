import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DosyaZatenVarHatasi, sonParca, type Depo } from "@/lib/depo/tipler";

// Yerel klasör deposu (15 Ekim 2026): belgeler, uygulamanın çalıştığı
// bilgisayarın diskinde YEREL_DEPO_KOK klasörüne yazılır (ör. ofisteki
// bilgisayar ya da sunucu; OneDrive/Dropbox eşitleme klasörü de olabilir).
//
// Yalnızca uygulamayı kendi bilgisayarında/sunucunda çalıştırıyorsan işe
// yarar (npm run build && npm start). Netlify/Vercel gibi sunucusuz
// barındırmada disk her istekte sıfırlanır; orada bu depo açılmaz.
//
// Tarayıcıdan yükleme: dosya, imzalı ve süreli bir adrese (/api/depo/yukle)
// PUT edilir; imza bu süreçte üretilen gizli anahtarla atılır.

const ETIKET = "bu bilgisayardaki";
const IMZA_SURESI_MS = 15 * 60 * 1000;

function kok(): string {
  const k = process.env.YEREL_DEPO_KOK?.trim();
  if (!k) throw new Error("YEREL_DEPO_KOK tanımlı değil. .env dosyasına belgelerin duracağı klasörün tam yolunu yaz.");
  if (process.env.NETLIFY || process.env.VERCEL) {
    throw new Error(
      "Yerel klasör deposu sunucusuz barındırmada (Netlify/Vercel) çalışmaz: disk kalıcı değil. Uygulamayı kendi bilgisayarında çalıştır ya da başka bir depo seç.",
    );
  }
  return path.resolve(k);
}

/** Depo yolunu ("Özlük/AKTİF/AYŞE DEMİR/…") diskteki tam yola çevirir;
 *  kök dışına çıkan ("..") yolları reddeder. */
export function tamYol(yol: string): string {
  const k = kok();
  const parcalar = yol.split("/").filter(Boolean);
  if (parcalar.some((p) => p === ".." || p === "." || /[\\:*?"<>|\x00-\x1f]/.test(p))) {
    throw new Error(`Geçersiz yol: ${yol}`);
  }
  const tam = path.resolve(k, ...parcalar);
  if (tam !== k && !tam.startsWith(k + path.sep)) throw new Error(`Geçersiz yol: ${yol}`);
  return tam;
}

async function varMi(tam: string): Promise<boolean> {
  try {
    await stat(tam);
    return true;
  } catch {
    return false;
  }
}

// Süreç boyunca sabit gizli anahtar (dev'de modül yeniden yüklenince de korunur).
const g = globalThis as { __tastamamYerelImza?: Buffer };
function imzaAnahtari(): Buffer {
  return (g.__tastamamYerelImza ??= randomBytes(32));
}

function imza(yol: string, son: number): string {
  return createHmac("sha256", imzaAnahtari()).update(`${yol}\n${son}`).digest("base64url");
}

export function yuklemeImzasiDogru(yol: string, son: number, gelen: string): boolean {
  if (!Number.isFinite(son) || son < Date.now()) return false;
  const a = Buffer.from(imza(yol, son));
  const b = Buffer.from(gelen);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const yerelDepo: Depo = {
  ad: "yerel",
  etiket: ETIKET,

  async varMi(yol) {
    return varMi(tamYol(yol));
  },

  async dosyalariListele(klasorYol) {
    try {
      const ogeler = await readdir(tamYol(klasorYol), { withFileTypes: true });
      return ogeler.filter((o) => o.isFile()).map((o) => o.name);
    } catch {
      return [];
    }
  },

  async yaz(yol, veri) {
    const tam = tamYol(yol);
    await mkdir(path.dirname(tam), { recursive: true });
    try {
      await writeFile(tam, veri, { flag: "wx" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new DosyaZatenVarHatasi(sonParca(yol), ETIKET);
      throw new Error(`Klasöre yazılamadı (${sonParca(yol)}): ${(e as Error).message}`);
    }
  },

  async indir(yol) {
    try {
      return await readFile(tamYol(yol));
    } catch (e) {
      throw new Error(`Dosya okunamadı (${sonParca(yol)}): ${(e as Error).message}`);
    }
  },

  async klasorOlustur(yol) {
    await mkdir(tamYol(yol), { recursive: true });
  },

  async tasi(kaynakYol, hedefYol) {
    const kaynak = tamYol(kaynakYol);
    const hedef = tamYol(hedefYol);
    if (!(await varMi(kaynak))) throw new Error(`Taşınacak bir şey bulunamadı: ${sonParca(kaynakYol)}`);
    await mkdir(path.dirname(hedef), { recursive: true });
    await rename(kaynak, hedef);
  },

  async yuklemeOturumuAc(yol) {
    if (await varMi(tamYol(yol))) throw new DosyaZatenVarHatasi(sonParca(yol), ETIKET);
    const son = Date.now() + IMZA_SURESI_MS;
    const q = new URLSearchParams({ yol, son: String(son), imza: imza(yol, son) });
    return { uploadUrl: `/api/depo/yukle?${q}`, yontem: "tek", basliklar: { "content-type": "application/octet-stream" } };
  },
};
