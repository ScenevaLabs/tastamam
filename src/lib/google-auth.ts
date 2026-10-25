import { createClient } from "@/lib/supabase/server";
import { tokenCoz, tokenSifrele } from "@/lib/token-sifre";

// Google Drive eklentisi için OAuth (authorization code + refresh token).
// msgraph-auth.ts ile aynı desen; token'lar ayarlar tablosunda tutulur.
// Kapsam tam "drive": "Klasörü tara" elle eklenmiş dosyaları da görmeli,
// drive.file yalnızca uygulamanın kendi oluşturduğu dosyaları gösterir.
// Kurulum: KURULUM.md → Google Drive.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive";

function env(name: string): string {
  const deger = process.env[name];
  if (!deger) throw new Error(`${name} tanımlı değil (.env.local'e bakın).`);
  return deger;
}

export function googleGirisUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: env("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenYaniti = { access_token: string; refresh_token?: string; expires_in: number };

async function tokenIste(body: URLSearchParams): Promise<TokenYaniti> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token isteği başarısız: ${await res.text()}`);
  return res.json();
}

async function tokenKaydet(yanit: TokenYaniti): Promise<void> {
  const supabase = await createClient();
  const guncelleme: Record<string, string> = {
    g_access_token: tokenSifrele(yanit.access_token, env("GOOGLE_CLIENT_SECRET")),
    g_access_token_expires_at: new Date(Date.now() + yanit.expires_in * 1000).toISOString(),
  };
  // Google yenileme sırasında refresh token'ı tekrar göndermez; eskisi geçerli kalır.
  if (yanit.refresh_token) guncelleme.g_refresh_token = tokenSifrele(yanit.refresh_token, env("GOOGLE_CLIENT_SECRET"));
  await supabase.from("ayarlar").update(guncelleme).eq("id", true);
}

export async function googleKoduTokenaCevir(code: string): Promise<void> {
  await tokenKaydet(
    await tokenIste(
      new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID"),
        client_secret: env("GOOGLE_CLIENT_SECRET"),
        grant_type: "authorization_code",
        code,
        redirect_uri: env("GOOGLE_REDIRECT_URI"),
      }),
    ),
  );
}

export async function gecerliGoogleTokenAl(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ayarlar")
    .select("g_refresh_token, g_access_token, g_access_token_expires_at")
    .eq("id", true)
    .single();

  if (!data?.g_refresh_token) {
    throw new Error("Google Drive bağlantısı yapılmamış. Ayarlar sayfasından Google hesabınla bağlan.");
  }
  const sir = env("GOOGLE_CLIENT_SECRET");
  const refresh = tokenCoz(data.g_refresh_token, sir);
  const suresiDolmakUzere =
    !data.g_access_token_expires_at ||
    new Date(data.g_access_token_expires_at).getTime() - Date.now() < 2 * 60 * 1000;
  if (!suresiDolmakUzere && data.g_access_token && !refresh.eski) return tokenCoz(data.g_access_token, sir).duz;

  const yanit = await tokenIste(
    new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: sir,
      grant_type: "refresh_token",
      refresh_token: refresh.duz,
    }),
  );
  // Google yenilemede refresh token göndermez; eski düz metin kayıt burada şifrelenir.
  await tokenKaydet(refresh.eski && !yanit.refresh_token ? { ...yanit, refresh_token: refresh.duz } : yanit);
  return yanit.access_token;
}
