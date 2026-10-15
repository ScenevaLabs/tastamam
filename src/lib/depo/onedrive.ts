import { gecerliMsTokenAl } from "@/lib/msgraph-auth";
import { DosyaZatenVarHatasi, sonParca, ustKlasor, type Depo } from "@/lib/depo/tipler";

// OneDrive eklentisi (Microsoft Graph). Kod Faz 7'den beri canlıda çalışan
// ozluk-dosya.ts'ten taşındı; davranış aynı. Kurulum: KURULUM.md → OneDrive.

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const ETIKET = "OneDrive";

function yolKodla(yol: string): string {
  return yol.split("/").map(encodeURIComponent).join("/");
}

async function ogeUrl(yol: string): Promise<{ url: string; token: string }> {
  return { url: `${GRAPH_BASE}/me/drive/root:/${yolKodla(yol)}`, token: await gecerliMsTokenAl() };
}

async function varMi(yol: string): Promise<boolean> {
  const { url, token } = await ogeUrl(yol);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`OneDrive kontrolü başarısız: ${await res.text()}`);
  return true;
}

/** Taşıma (PATCH) işlemlerinde hedef `parentReference.id` ile verilir;
 *  `parentReference.path` kişisel OneDrive'da (Türkçe karakterli yollarda)
 *  `invalidRequest` döndürüyordu. */
async function klasorIdAl(yol: string): Promise<string> {
  const { url, token } = await ogeUrl(yol);
  const res = await fetch(`${url}?$select=id`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`OneDrive klasörü bulunamadı (${yol}): ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

async function klasorOlustur(yol: string): Promise<void> {
  if (!yol || (await varMi(yol))) return;
  const ust = ustKlasor(yol);
  await klasorOlustur(ust);
  const token = await gecerliMsTokenAl();
  const res = await fetch(`${GRAPH_BASE}/me/drive/root:/${yolKodla(ust)}:/children`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: sonParca(yol), folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Klasör oluşturulamadı (${yol}): ${await res.text()}`);
  }
}

/** Ön-yetkili `uploadUrl` döner; conflictBehavior:"fail" ile aynı isimde
 *  dosya varsa 409 gelir. Graph ilk yazımda ara klasörleri kendisi açar. */
async function yuklemeOturumuUrl(yol: string): Promise<string> {
  const { url, token } = await ogeUrl(yol);
  const res = await fetch(`${url}:/createUploadSession`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "fail" } }),
  });
  if (res.status === 409) throw new DosyaZatenVarHatasi(sonParca(yol), ETIKET);
  if (!res.ok) throw new Error(`OneDrive yükleme oturumu açılamadı: ${await res.text()}`);
  return ((await res.json()) as { uploadUrl: string }).uploadUrl;
}

export const onedriveDepo: Depo = {
  ad: "onedrive",
  etiket: ETIKET,
  varMi,
  klasorOlustur,

  async dosyalariListele(klasorYol) {
    const { url, token } = await ogeUrl(klasorYol);
    const res = await fetch(`${url}:/children?$select=name,folder&$top=999`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`OneDrive klasörü listelenemedi: ${await res.text()}`);
    const json = (await res.json()) as { value: { name: string; folder?: unknown }[] };
    return json.value.filter((oge) => !oge.folder).map((oge) => oge.name);
  },

  async yaz(yol, veri) {
    const uploadUrl = await yuklemeOturumuUrl(yol);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(veri.byteLength),
        "Content-Range": `bytes 0-${veri.byteLength - 1}/${veri.byteLength}`,
      },
      body: new Uint8Array(veri),
    });
    if (res.status === 409) throw new DosyaZatenVarHatasi(sonParca(yol), ETIKET);
    if (!res.ok) throw new Error(`OneDrive'a yazılamadı: ${await res.text()}`);
  },

  async indir(yol) {
    const { url, token } = await ogeUrl(yol);
    const res = await fetch(`${url}:/content`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Dosya indirilemedi (${sonParca(yol)}): ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },

  async tasi(kaynakYol, hedefYol) {
    const hedefUst = ustKlasor(hedefYol);
    await klasorOlustur(hedefUst);
    const govde: Record<string, unknown> = { name: sonParca(hedefYol) };
    if (ustKlasor(kaynakYol) !== hedefUst) govde.parentReference = { id: await klasorIdAl(hedefUst) };
    const { url, token } = await ogeUrl(kaynakYol);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(govde),
    });
    if (!res.ok) {
      throw new Error(`Taşınamadı (${sonParca(kaynakYol)} → ${sonParca(hedefYol)}): ${await res.text()}`);
    }
  },

  async yuklemeOturumuAc(yol) {
    return { uploadUrl: await yuklemeOturumuUrl(yol), yontem: "parcali" };
  },
};
