import { gecerliGoogleTokenAl } from "@/lib/google-auth";
import { DosyaZatenVarHatasi, icerikTuru, sonParca, ustKlasor, type Depo } from "@/lib/depo/tipler";

// Google Drive eklentisi (Drive API v3). Drive yol değil kimlik (id) ile
// çalışır ve aynı klasörde aynı adlı birden çok dosyaya izin verir; bu
// yüzden yollar parça parça ada göre çözülür ve yazmadan önce çakışma
// kontrolü yapılır. Kök: GDRIVE_KOK_KLASOR_ID (yoksa "Drive'ım").

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const KLASOR_TURU = "application/vnd.google-apps.folder";
const ETIKET = "Google Drive";

type DriveOge = { id: string; name: string; mimeType: string; parents?: string[] };

function kokId(): string {
  return process.env.GDRIVE_KOK_KLASOR_ID || "root";
}

function sorguDegeri(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function istek(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await gecerliGoogleTokenAl();
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
}

async function cocuklar(ustId: string, ekSorgu = ""): Promise<DriveOge[]> {
  const tum: DriveOge[] = [];
  let sayfa: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${sorguDegeri(ustId)}' in parents and trashed = false${ekSorgu}`,
      fields: "nextPageToken, files(id, name, mimeType, parents)",
      pageSize: "1000",
    });
    if (sayfa) params.set("pageToken", sayfa);
    const res = await istek(`${API}/files?${params}`);
    if (!res.ok) throw new Error(`Google Drive listelenemedi: ${await res.text()}`);
    const json = (await res.json()) as { files: DriveOge[]; nextPageToken?: string };
    tum.push(...json.files);
    sayfa = json.nextPageToken;
  } while (sayfa);
  return tum;
}

async function cocukBul(ustId: string, ad: string): Promise<DriveOge | null> {
  const bulunan = await cocuklar(ustId, ` and name = '${sorguDegeri(ad)}'`);
  return bulunan[0] ?? null;
}

/** Yolu parça parça çözer; bulunamazsa null. */
async function ogeBul(yol: string): Promise<DriveOge | null> {
  let simdiki: DriveOge = { id: kokId(), name: "", mimeType: KLASOR_TURU };
  for (const parca of yol.split("/").filter(Boolean)) {
    const sonraki = await cocukBul(simdiki.id, parca);
    if (!sonraki) return null;
    simdiki = sonraki;
  }
  return simdiki;
}

/** Klasör yolunu (gerekirse oluşturarak) çözer, id'sini döner. */
async function klasorIdAl(yol: string): Promise<string> {
  let ustId = kokId();
  for (const parca of yol.split("/").filter(Boolean)) {
    const mevcut = await cocukBul(ustId, parca);
    if (mevcut) {
      ustId = mevcut.id;
      continue;
    }
    const res = await istek(`${API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: parca, mimeType: KLASOR_TURU, parents: [ustId] }),
    });
    if (!res.ok) throw new Error(`Klasör oluşturulamadı (${parca}): ${await res.text()}`);
    ustId = ((await res.json()) as { id: string }).id;
  }
  return ustId;
}

export const gdriveDepo: Depo = {
  ad: "gdrive",
  etiket: ETIKET,

  async varMi(yol) {
    return (await ogeBul(yol)) !== null;
  },

  async klasorOlustur(yol) {
    await klasorIdAl(yol);
  },

  async dosyalariListele(klasorYol) {
    const klasor = await ogeBul(klasorYol);
    if (!klasor) return [];
    return (await cocuklar(klasor.id, ` and mimeType != '${KLASOR_TURU}'`)).map((o) => o.name);
  },

  async yaz(yol, veri) {
    const ustId = await klasorIdAl(ustKlasor(yol));
    if (await cocukBul(ustId, sonParca(yol))) throw new DosyaZatenVarHatasi(sonParca(yol), ETIKET);
    const sinir = `tastamam${Date.now()}`;
    const govde = Buffer.concat([
      Buffer.from(
        `--${sinir}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          JSON.stringify({ name: sonParca(yol), parents: [ustId] }) +
          `\r\n--${sinir}\r\nContent-Type: ${icerikTuru(yol)}\r\n\r\n`,
      ),
      veri,
      Buffer.from(`\r\n--${sinir}--`),
    ]);
    const res = await istek(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${sinir}` },
      body: new Uint8Array(govde),
    });
    if (!res.ok) throw new Error(`Google Drive'a yazılamadı: ${await res.text()}`);
  },

  async indir(yol) {
    const oge = await ogeBul(yol);
    if (!oge) throw new Error(`Dosya bulunamadı: ${sonParca(yol)}`);
    const res = await istek(`${API}/files/${oge.id}?alt=media`);
    if (!res.ok) throw new Error(`Dosya indirilemedi (${sonParca(yol)}): ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },

  async tasi(kaynakYol, hedefYol) {
    const oge = await ogeBul(kaynakYol);
    if (!oge) throw new Error(`Taşınacak bir şey bulunamadı: ${sonParca(kaynakYol)}`);
    const hedefUstId = await klasorIdAl(ustKlasor(hedefYol));
    const eskiUst = oge.parents?.[0];
    const params = new URLSearchParams({ fields: "id" });
    if (eskiUst && eskiUst !== hedefUstId) {
      params.set("addParents", hedefUstId);
      params.set("removeParents", eskiUst);
    }
    const res = await istek(`${API}/files/${oge.id}?${params}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sonParca(hedefYol) }),
    });
    if (!res.ok) {
      throw new Error(`Taşınamadı (${sonParca(kaynakYol)} → ${sonParca(hedefYol)}): ${await res.text()}`);
    }
  },

  /** Devam ettirilebilir yükleme oturumu. Oturum tarayıcının adresiyle
   *  (Origin) açılmazsa Drive, tarayıcıdan gelen PUT'lara CORS izni vermez. */
  async yuklemeOturumuAc(yol, origin) {
    const ustId = await klasorIdAl(ustKlasor(yol));
    if (await cocukBul(ustId, sonParca(yol))) throw new DosyaZatenVarHatasi(sonParca(yol), ETIKET);
    const res = await istek(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": icerikTuru(yol),
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify({ name: sonParca(yol), parents: [ustId] }),
    });
    const uploadUrl = res.headers.get("location");
    if (!res.ok || !uploadUrl) throw new Error(`Google Drive yükleme oturumu açılamadı: ${await res.text()}`);
    return { uploadUrl, yontem: "parcali" };
  },
};
