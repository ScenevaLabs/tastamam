# Tastamam kurulumu

> **To the AI agent reading this:** This file is a step-by-step installation runbook for
> Tastamam, written so that a coding agent (Claude Code, Codex, Cursor…) can carry it out
> for a non-technical user. Talk to the user in their language (most users are Turkish).
> Follow the steps in order, run the verification after each step, and stop to ask the user
> at every **[Kullanıcıya sor]** marker. Never print secret values (keys, passwords) back
> into the chat; write them only into `.env.local`.

Bu dosyayı ve repoyu bilgisayarına indirdiysen, en kolay yol şu: bilgisayarındaki yapay
zekâ ajanına (Claude Code, Codex, Cursor vb.) bu klasörü aç ve "KURULUM.md'yi oku ve
Tastamam'ı kur" de. Ajan aşağıdaki adımları senin yerine yapar, yalnızca gerektiğinde sana
sorar. Elle kurmak istersen adımlar aynı.

**Nasıl çalışır:** Tastamam senin bilgisayarında çalışan bir uygulamadır. Bilgisayarın
sunucu olur, sen tarayıcıdan `http://localhost:3000` adresiyle kullanırsın. Belgeler
bilgisayarındaki bir klasörde durur. Çalışan kayıtları bir veritabanında tutulur. Veritabanı
için iki yol var:

| | Supabase bulut (önerilen) | Tamamen bu bilgisayarda (Docker) |
|---|---|---|
| Ne gerekir | Ücretsiz Supabase hesabı | Docker Desktop (~2 GB RAM) |
| Kayıtlar nerede | Supabase'in Avrupa sunucusunda | Bu bilgisayarda |
| Kurulum | Daha kısa | Bir adım daha uzun |

Bu bir hukuki danışmanlık aracı değildir; süreleri ve kuralları mali müşavirinle teyit et.

---

## 0. Ön koşullar

Ajan için kontroller:

```bash
node -v        # v20.9 veya üstü olmalı (v22 LTS önerilir)
git --version  # yalnızca repoyu git ile indirdiysen ve güncellemek için
```

- Node yoksa ya da eskiyse: https://nodejs.org adresinden **LTS** sürümünü kur
  (Windows: `winget install OpenJS.NodeJS.LTS`, macOS: `brew install node@22`).
- Bu klasörde `package.json` olduğunu doğrula; komutların hepsi bu klasörde çalışır.

```bash
npm install
```

Doğrulama: komut hatasız biter, `node_modules/` klasörü oluşur.

**[Kullanıcıya sor]** Veritabanı: "Supabase bulut" mu, "tamamen bu bilgisayarda (Docker)" mı?
Bilmiyorsa Supabase bulut öner. Cevaba göre 1A ya da 1B'yi uygula.

---

## 1A. Veritabanı: Supabase bulut

1. **[Kullanıcıya sor]** https://supabase.com adresinde ücretsiz hesap açmasını ve
   **New project** ile bir proje oluşturmasını iste. Ad: `tastamam`, bölge: **Central EU
   (Frankfurt)**, veritabanı şifresini kendisi belirlesin ve bir yere not etsin.
2. Proje açılınca kullanıcıdan şu değerleri `.env.local` dosyasına yapıştırmasını iste
   (dosya henüz yoksa önce `npm run kur` çalıştır, `.env.example`'dan oluşturur):
   - **Project Settings → API Keys:** `Publishable key` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
     `Secret key` → `SUPABASE_SECRET_KEY`
   - **Project Settings → Data API:** Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - **Connect** düğmesi → **Session pooler** bağlantı adresi → `DATABASE_URL`
     (`[YOUR-PASSWORD]` yerine 1. adımdaki veritabanı şifresi)
3. **Authentication → Sign In / Providers:** "Allow new users to sign up" **kapalı** olsun.
   Kullanıcıları yalnızca `npm run kur -- --admin` ekler.
4. **Authentication → URL Configuration:**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/**` ekle (mobil ve domain için 6. bölümde
     başka adresler de eklenecek).
5. **Authentication → Emails → SMTP Settings:** Giriş bağlantısı e-postayla gelir.
   Supabase'in kendi mail servisi saatte birkaç mailde sınırlıdır; 2. adımdaki şirket mail
   kutusunun SMTP bilgilerini burada da girmeni öneririm (aynı bilgiler).

## 1B. Veritabanı: tamamen bu bilgisayarda (Docker)

1. Docker Desktop kurulu ve çalışıyor olmalı: `docker info` hatasız dönmeli.
   Değilse https://www.docker.com/products/docker-desktop/ (Windows'ta WSL 2 ister).
2. Bu klasörde:

   ```bash
   npx supabase init        # supabase/config.toml oluşturur (editör sorularına "N")
   ```

   **Önce** `supabase/config.toml` içinde `[db.seed]` bölümünde `enabled = false` yap;
   yoksa örnek (kurgu) veri gerçek veritabanına yüklenir. Sonra:

   ```bash
   npx supabase start       # ilk sefer imajları indirir, birkaç dakika sürer
   ```

   `supabase start` sonunda adresleri ve anahtarları yazar. `.env.local` için:
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = çıktıdaki publishable/anon key
   - `SUPABASE_SECRET_KEY` = çıktıdaki secret/service_role key
   - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
3. `supabase/config.toml` içinde `[auth]` bölümünde `site_url = "http://localhost:3000"`,
   `additional_redirect_urls = ["http://localhost:3000/**"]`, `enable_signup = false` olsun.
4. Giriş e-postaları bu modda dışarı gitmez; `http://127.0.0.1:54324` adresindeki yerel
   posta kutusunda (Mailpit) görünür. Gerçek e-postayla giriş istenirse `config.toml`
   içindeki `[auth.email.smtp]` bölümüne şirket SMTP bilgileri girilir.
5. Bilgisayar her açıldığında Docker Desktop ve `npx supabase start` çalışmalı (7. bölüm).

> Not: `supabase start` migration'ları kendisi de uygular. Sonraki adımdaki `npm run kur`
> bunu fark eder; "tablolar zaten var" derse `npm run kur -- --uygulanmis-say 9999` ile
> hepsini uygulanmış say ve devam et.

---

## 2. Ayarlar (`.env.local`)

`.env.local` yoksa:

```bash
npm run kur
```

Betik dosyayı oluşturur ve eksik olanları listeler. Doldurulacaklar (açıklamalar
`.env.example` içinde):

- **Mail (zorunlu):** muhasebeye giden bildirimler ve sabah hatırlatmaları bu kutudan
  gider. `SMTP_HOST`, `SMTP_PORT` (genelde 465), `SMTP_USER`, `SMTP_PASS`; gelen
  cevapları okumak için `IMAP_HOST`, `IMAP_PORT` (genelde 993). Muhasebeden gelen
  belgelerin otomatik dosyalanması için `MAIL_DOGRULAYICI`: o kutuya gelmiş bir mailin
  kaynağındaki en üst `Authentication-Results:` satırında `;`'den önceki ad (boşsa belgeler
  elle onaylanır).
  **[Kullanıcıya sor]** şirket mail kutusunun sunucu adresi ve şifresi. Şifreyi kullanıcı
  dosyaya kendisi yazsın.
- **Belgeler:** `DEPO_SAGLAYICI=yerel` ve `YEREL_DEPO_KOK=` belgelerin duracağı klasörün tam
  yolu. **[Kullanıcıya sor]** hangi klasör. OneDrive/Dropbox/iCloud eşitleme klasörünün
  içinde bir klasör seçerse belgeler ayrıca buluta yedeklenir.
  Örnek: `C:\Users\ad\OneDrive\Şirket\Özlük` ya da `/Users/ad/Documents/Tastamam`.
  Klasör yoksa oluştur.
  (Alternatif: `supabase` seçilirse belgeler Supabase depolamasında durur.)
- `UYGULAMA_ADRESI=http://localhost:3000` (maillerdeki bağlantılar; domain bağlanırsa o adres).

## 3. Veritabanını kur ve ilk kullanıcıyı ekle

**[Kullanıcıya sor]** Giriş yapacağı e-posta adresi.

```bash
npm run kur -- --admin ad@sirketin.com
```

Doğrulama: çıktıda `✓ … migration uygulandı` ve `✓ ad@sirketin.com giriş yapabilir`.
Hata verirse mesajı oku; en sık neden `DATABASE_URL` şifresinin yanlış olması.

Başka kullanıcı eklemek için aynı komut farklı e-postayla. Verilere yalnızca bu yolla
eklenen e-postalar erişebilir.

## 4. Çalıştır

```bash
npm run build
npm start
```

Doğrulama: `http://localhost:3000` açılır, giriş ekranı gelir. E-postayı yaz, gelen
bağlantıya **aynı bilgisayarın aynı tarayıcısında** tıkla.

İlk girişte **Ayarlar** sayfasında şirket unvanı, adresi, mali müşavirin ve İSG uzmanının
e-postasını doldur; **Modüller** bölümünden kullanacağın modülleri aç.

Denemek için örnek veri istersen (gerçek kurulumda değil, boş bir test projesinde):
`supabase/seed.sql` dosyasını Supabase SQL Editor'de çalıştır. Kişiler ve şirket kurgudur.

## 5. Güncelleme

```bash
git pull            # ya da yeni sürümü indirip bu klasörün üzerine kopyala (.env.local'e dokunma)
npm install
npm run kur         # yalnızca yeni migration'ları uygular
npm run build
npm start
```

---

## 6. Telefondan kullanmak

Bilgisayar sunucu olduğu için telefon ona bir şekilde ulaşmalı. Üç yol var; **bilgisayar
açık ve Tastamam çalışıyor olmalı.**

### 6A. Aynı Wi-Fi'da (en basit, domain gerekmez)

1. Bilgisayarın yerel IP'sini bul: Windows `ipconfig` (IPv4 Address), macOS
   `ipconfig getifaddr en0`. Örnek: `192.168.1.25`.
2. Güvenlik duvarında 3000 numaralı porta izin ver (Windows ilk `npm start`ta sorar:
   "Özel ağlar" işaretli olsun).
3. Supabase → Authentication → URL Configuration → Redirect URLs'e
   `http://192.168.1.25:3000/**` ekle (Docker modunda `config.toml` →
   `additional_redirect_urls`).
4. Telefonda `http://192.168.1.25:3000` aç, girişi **telefonda** iste ve gelen bağlantıyı
   **telefonda** aç.
5. Tarayıcı menüsünden "Ana ekrana ekle" ile uygulama gibi kullanılabilir.

Router'ın bilgisayara verdiği IP değişebilir; router ayarlarından sabitlemek iyi olur.

### 6B. Kendi domain'inle her yerden (Cloudflare Tunnel)

Örnek adres: `https://ik.sirketin.com`. Modemde port açmak gerekmez, HTTPS kendiliğinden
gelir. Gerekenler: bir domain ve ücretsiz bir Cloudflare hesabı. Domain'in DNS'i
Cloudflare'de olmalı (Cloudflare → Add a site, sonra domain sağlayıcısında nameserver'ları
Cloudflare'inkilerle değiştir).

**[Kullanıcıya sor]** Domain adı ve hangi alt alan adı kullanılacak (ör. `ik`).

1. `cloudflared` kur: Windows `winget install Cloudflare.cloudflared`, macOS
   `brew install cloudflared`, Linux: https://pkg.cloudflare.com
2. Bağla ve tüneli oluştur:

   ```bash
   cloudflared tunnel login                       # tarayıcı açılır, domain seçilir
   cloudflared tunnel create tastamam
   cloudflared tunnel route dns tastamam ik.sirketin.com
   ```

3. `~/.cloudflared/config.yml` (Windows: `%USERPROFILE%\.cloudflared\config.yml`):

   ```yaml
   tunnel: tastamam
   credentials-file: <tunnel create çıktısındaki .json dosyasının tam yolu>
   ingress:
     - hostname: ik.sirketin.com
       service: http://localhost:3000
     - service: http_status:404
   ```

4. Dene: `cloudflared tunnel run tastamam`, sonra `https://ik.sirketin.com` açılmalı.
5. Kalıcı yap (bilgisayar açılınca kendiliğinden başlasın): `cloudflared service install`
   (Windows'ta yönetici olarak; config dosyasının yolu servis için de geçerli olmalı).
6. Supabase → URL Configuration: Redirect URLs'e `https://ik.sirketin.com/**` ekle; yalnızca
   domain'den kullanılacaksa Site URL'yi de bu adres yap. `.env.local`'de
   `UYGULAMA_ADRESI=https://ik.sirketin.com`, sonra `npm run build && npm start`.
7. Cloudflare → SSL/TLS → Edge Certificates → **Always Use HTTPS** açık olsun.

Uygulama artık internetten erişilebilir: yalnızca `npm run kur -- --admin` ile eklenen
e-postalar giriş yapabilir ve verileri görebilir. İstersen Cloudflare Zero Trust → Access ile
adresin önüne ikinci bir e-posta doğrulaması koyabilirsin.

### 6C. Domain olmadan, yalnızca kendi cihazlarından (Tailscale)

Bilgisayara ve telefona Tailscale kurulur, aynı hesapla girilir; telefon bilgisayara
`http://<bilgisayar-adı>:3000` ile ulaşır, internete açılmaz. Redirect URLs'e bu adres
eklenir (6A'daki gibi).

---

## 7. Bilgisayar açılınca kendiliğinden başlasın

`npm start` terminal kapanınca durur. Kalıcı çalışması için (ajan kullanıcının işletim
sistemine göre birini kurar):

- **Windows:** Görev Zamanlayıcı → "Oturum açıldığında" tetikleyicili görev:
  program `cmd.exe`, bağımsız değişken `/c npm start`, başlangıç klasörü bu klasör.
  Docker modundaysa önce Docker Desktop'ın "Start when you sign in" ayarı açık olmalı ve
  aynı görevin başına `npx supabase start &&` eklenir.
- **macOS:** `~/Library/LaunchAgents/com.tastamam.plist` ile `npm start` (WorkingDirectory
  bu klasör, RunAtLoad true, KeepAlive true).
- **Linux:** systemd kullanıcı servisi (`systemctl --user`), `ExecStart=npm start`.

Doğrulama: bilgisayarı yeniden başlat, `http://localhost:3000` açılıyor mu bak.

## 8. Sabah hatırlatma maili

Takvim modülü açıksa, `npm start` ile çalışan uygulama her sabah 08.00'den sonra
yaklaşan yasal süreleri (SGK bildirgeleri, iş kazası bildirimi, İSG yenilemeleri, izin hak
edişleri) Ayarlar'daki takip adresine mailler. Ek kurulum gerekmez; bilgisayar 08.00'de
kapalıysa açıldıktan sonraki 10 dakika içinde gider. Kapatmak için `.env.local`'e
`HATIRLATMA_ZAMANLAYICI=kapali`.

## 9. Yedek

- **Belgeler:** `YEREL_DEPO_KOK` klasörü. Eşitleme klasöründeyse zaten yedekleniyor; değilse
  düzenli kopyala.
- **Kayıtlar:** veritabanının dökümünü düzenli al ve belgelerin yanına koy:
  Supabase bulut için `npx supabase db dump --db-url "<DATABASE_URL>" --data-only -f yedek.sql`,
  Docker modunda `npx supabase db dump --local --data-only -f yedek.sql`.
  Ajan bunu 7. bölümdeki gibi haftalık bir zamanlanmış göreve bağlayabilir.

## Sorun giderme

| Belirti | Neden / çözüm |
|---|---|
| Giriş bağlantısı gelmiyor | SMTP ayarı (1A-5) ya da spam klasörü. Docker modunda `http://127.0.0.1:54324` |
| Bağlantıya tıklayınca tekrar giriş ekranı | Bağlantı isteğin yapıldığı tarayıcıda açılmadı, ya da adres Redirect URLs'te yok |
| Giriş yapıldı ama liste boş | E-posta yetkili değil: `npm run kur -- --admin o@adres.com` |
| "YEREL_DEPO_KOK tanımlı değil" | `.env.local`'e klasör yolunu yaz, `npm run build && npm start` |
| Belge yüklenmiyor, "zaten var" | Aynı adlı dosya klasörde duruyor; eskisini klasörden kaldır |
| `npm run kur`: "tablolar zaten var" | `--uygulanmis-say` notuna bak (1B) |
