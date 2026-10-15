// İlk (ve v1'de tek) admin kullanıcıyı oluşturur. Kayıt formu yok; giriş
// e-postayla gelen tek kullanımlık bağlantıyla yapılır.
// Kullanım: npm run admin -- ad@sirketin.com
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function envOku() {
  try {
    for (const satir of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = satir.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // .env.local yoksa ortam değişkenleri doğrudan verilmiş olabilir.
  }
}

envOku();
const email = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anahtar = process.env.SUPABASE_SECRET_KEY;

if (!email || !email.includes("@")) {
  console.error("E-posta adresi ver: npm run admin -- ad@sirketin.com");
  process.exit(1);
}
if (!url || !anahtar) {
  console.error(".env.local'de NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY olmalı.");
  process.exit(1);
}

const supabase = createClient(url, anahtar, { auth: { persistSession: false } });
const { error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
if (error && !/already|registered|exists/i.test(error.message)) {
  console.error(`Kullanıcı oluşturulamadı: ${error.message}`);
  process.exit(1);
}
// Verilere erişim yetkisi (migration 0027): yalnızca bu listedeki e-postalar.
const { error: yetkiHatasi } = await supabase
  .from("yetkili_kullanici")
  .upsert({ email: email.toLowerCase() }, { onConflict: "email" });
if (yetkiHatasi) {
  console.error(`Hesap var ama yetki verilemedi: ${yetkiHatasi.message} (migration'lar uygulandı mı?)`);
  process.exit(1);
}
console.log(`${email} eklendi ve yetkilendirildi. Uygulamada bu adresle giriş bağlantısı isteyebilirsin.`);
