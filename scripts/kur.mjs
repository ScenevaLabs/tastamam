// Tastamam kurulum ve güncelleme betiği: npm run kur [-- --admin ad@sirketin.com]
//
// Etkileşimsizdir (yapay zekâ ajanı da çalıştırabilir). Yaptıkları:
//   1. .env.local yoksa .env.example'dan oluşturur, eksik zorunlu ayarları listeler.
//   2. CRON_SECRET boşsa rastgele üretip yazar.
//   3. Veritabanına henüz uygulanmamış migration'ları sırayla uygular
//      (DATABASE_URL ile; uygulananlar tastamam_migration tablosunda tutulur).
//   4. --admin verilirse o e-postayla giriş hesabı açar ve yetki verir.
// Güncellemeden sonra (git pull) yeniden çalıştırmak güvenlidir: yalnızca yeni
// migration'ları uygular.
//
// Mevcut, migration'ları elle uygulanmış bir kurulumu bu betiğe geçirmek için:
//   npm run kur -- --uygulanmis-say 0026   (0026 dahil öncekileri uygulanmış sayar)

import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const ENV = ".env.local";
const ZORUNLU = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "DATABASE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
];

const arg = (ad) => {
  const i = process.argv.indexOf(ad);
  return i > 0 ? process.argv[i + 1] : undefined;
};

function hata(mesaj) {
  console.error(`\n✗ ${mesaj}\n`);
  process.exit(1);
}

function envOku() {
  const degerler = {};
  for (const satir of readFileSync(ENV, "utf8").split(/\r?\n/)) {
    const m = satir.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) degerler[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return degerler;
}

function envYaz(ad, deger) {
  const metin = readFileSync(ENV, "utf8");
  const re = new RegExp(`^\\s*${ad}\\s*=.*$`, "m");
  writeFileSync(ENV, re.test(metin) ? metin.replace(re, `${ad}=${deger}`) : `${metin.trimEnd()}\n${ad}=${deger}\n`);
}

// 1. Ortam dosyası
if (!existsSync(ENV)) {
  copyFileSync(".env.example", ENV);
  console.log(`• ${ENV} oluşturuldu (.env.example'dan). Değerleri doldurup betiği yeniden çalıştır.`);
}
let env = envOku();
for (const [k, v] of Object.entries(env)) if (!process.env[k] && v) process.env[k] = v;

const eksik = ZORUNLU.filter((k) => !process.env[k]);
if ((process.env.DEPO_SAGLAYICI ?? "").trim() === "yerel" && !process.env.YEREL_DEPO_KOK) eksik.push("YEREL_DEPO_KOK");
if (eksik.length) hata(`${ENV} içinde eksik ayarlar: ${eksik.join(", ")}. Açıklamalar .env.example ve KURULUM.md'de.`);
console.log("✓ Zorunlu ayarlar dolu");

// 2. Sabah hatırlatması / zamanlanmış görev anahtarı
if (!env.CRON_SECRET) {
  envYaz("CRON_SECRET", randomBytes(32).toString("base64url"));
  console.log("✓ CRON_SECRET üretildi");
}

// 3. Migration'lar
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {}, connect_timeout: 15 });
try {
  await sql`select 1`;
} catch (e) {
  hata(`Veritabanına bağlanılamadı (DATABASE_URL): ${e.message}`);
}

await sql`create table if not exists public.tastamam_migration (
  ad text primary key,
  uygulandi_at timestamptz not null default now()
)`;
await sql`alter table public.tastamam_migration enable row level security`;

const klasor = join("supabase", "migrations");
const dosyalar = readdirSync(klasor).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();

const sayilacak = arg("--uygulanmis-say");
if (sayilacak) {
  const secilen = dosyalar.filter((f) => f.slice(0, 4) <= sayilacak);
  for (const f of secilen) await sql`insert into public.tastamam_migration (ad) values (${f}) on conflict do nothing`;
  console.log(`✓ ${secilen.length} migration uygulanmış sayıldı (${sayilacak} dahil)`);
}

const uygulanan = new Set((await sql`select ad from public.tastamam_migration`).map((r) => r.ad));
if (uygulanan.size === 0) {
  const [{ var: tabloVar }] = await sql`select to_regclass('public.kisi') is not null as var`;
  if (tabloVar) {
    await sql.end();
    hata(
      "Veritabanında Tastamam tabloları zaten var ama hangi migration'ların uygulandığı bilinmiyor. " +
        "Son uyguladığın migration numarasıyla çalıştır: npm run kur -- --uygulanmis-say 00XX",
    );
  }
}

let yeni = 0;
for (const f of dosyalar) {
  if (uygulanan.has(f)) continue;
  const metin = readFileSync(join(klasor, f), "utf8");
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(metin);
      await tx`insert into public.tastamam_migration (ad) values (${f})`;
    });
    console.log(`  ✓ ${f}`);
    yeni++;
  } catch (e) {
    await sql.end();
    hata(`${f} uygulanamadı: ${e.message}\nÖncekiler uygulandı; bu dosya ve sonrası uygulanmadı.`);
  }
}
console.log(yeni ? `✓ ${yeni} migration uygulandı` : "✓ Veritabanı güncel");
await sql.end();

// 4. İlk kullanıcı
const admin = arg("--admin");
if (admin) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.admin.createUser({ email: admin, email_confirm: true });
  if (error && !/already|registered|exists/i.test(error.message)) hata(`Kullanıcı açılamadı: ${error.message}`);
  const { error: e2 } = await supabase.from("yetkili_kullanici").upsert({ email: admin.toLowerCase() }, { onConflict: "email" });
  if (e2) hata(`Kullanıcıya yetki verilemedi: ${e2.message}`);
  console.log(`✓ ${admin} giriş yapabilir`);
}

console.log("\nHazır. Başlatmak için: npm run build && npm start  →  http://localhost:3000\n");
