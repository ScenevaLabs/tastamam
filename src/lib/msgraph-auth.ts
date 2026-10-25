import { createClient } from "@/lib/supabase/server";
import { tokenCoz, tokenSifrele } from "@/lib/token-sifre";

// Kişisel Microsoft hesabı (consumer OneDrive) — application permissions
// (client credentials) desteklenmiyor, bu yüzden /consumers ucu ve
// delegated authorization code + refresh token akışı kullanılıyor.
const TENANT = "consumers";
const AUTHORIZE_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const SCOPE = "offline_access Files.ReadWrite User.Read";

function env(name: string): string {
  const deger = process.env[name];
  if (!deger) throw new Error(`${name} tanımlı değil (.env.local'e bakın).`);
  return deger;
}

export function msGirisUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("MS_CLIENT_ID"),
    response_type: "code",
    redirect_uri: env("MS_REDIRECT_URI"),
    response_mode: "query",
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenYaniti = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

async function tokenIste(body: URLSearchParams): Promise<TokenYaniti> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Microsoft token isteği başarısız: ${await res.text()}`);
  }
  return res.json();
}

async function tokenKaydet(yanit: TokenYaniti): Promise<void> {
  const supabase = await createClient();
  const suresiDolacakTarih = new Date(Date.now() + yanit.expires_in * 1000).toISOString();
  await supabase
    .from("ayarlar")
    .update({
      ms_refresh_token: tokenSifrele(yanit.refresh_token, env("MS_CLIENT_SECRET")),
      ms_access_token: tokenSifrele(yanit.access_token, env("MS_CLIENT_SECRET")),
      ms_access_token_expires_at: suresiDolacakTarih,
    })
    .eq("id", true);
}

export async function msKoduTokenaCevir(code: string): Promise<void> {
  const yanit = await tokenIste(
    new URLSearchParams({
      client_id: env("MS_CLIENT_ID"),
      client_secret: env("MS_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: env("MS_REDIRECT_URI"),
      scope: SCOPE,
    }),
  );
  await tokenKaydet(yanit);
}

/** Geçerli bir access token döner; süresi dolmuşsa/dolmak üzereyse refresh
 *  token ile arka planda yeniler (MSA refresh token'ları her kullanımda
 *  döner — yeni gelen de kaydedilir). */
export async function gecerliMsTokenAl(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ayarlar")
    .select("ms_refresh_token, ms_access_token, ms_access_token_expires_at")
    .eq("id", true)
    .single();

  if (!data?.ms_refresh_token) {
    throw new Error(
      "OneDrive bağlantısı yapılmamış. Ayarlar sayfasından Microsoft hesabınızla giriş yapın.",
    );
  }

  const sir = env("MS_CLIENT_SECRET");
  const refresh = tokenCoz(data.ms_refresh_token, sir);
  const suresiDolmakUzere =
    !data.ms_access_token_expires_at ||
    new Date(data.ms_access_token_expires_at).getTime() - Date.now() < 2 * 60 * 1000;

  // Şifreleme öncesinden kalan düz metin kayıt: yenilenip şifreli yazılır.
  if (!suresiDolmakUzere && data.ms_access_token && !refresh.eski) {
    return tokenCoz(data.ms_access_token, sir).duz;
  }

  const yanit = await tokenIste(
    new URLSearchParams({
      client_id: env("MS_CLIENT_ID"),
      client_secret: sir,
      grant_type: "refresh_token",
      refresh_token: refresh.duz,
      scope: SCOPE,
    }),
  );
  await tokenKaydet(yanit);
  return yanit.access_token;
}
