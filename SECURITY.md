# Güvenlik / Security

Tastamam'ı kuran şirket, kendi çalışanlarının kimlik, adres, ücret ve sağlık bilgilerini
kendi bilgisayarında ya da kendi hesaplarında bu uygulamayla tutar; bu veriler bize hiçbir
zaman gelmez. Yine de uygulamadaki bir açık bu kurulumları etkileyebileceği için, bir
güvenlik açığı bulursan lütfen **herkese açık issue açma**; GitHub'da bu deponun **Security → Report a
vulnerability** bölümünden gizli olarak bildir. 7 gün içinde dönüş yapılır.

*Tastamam is self-hosted: each company keeps its own employee data on its own machine or
accounts, and none of it reaches us. Because a flaw could still affect those installations,
please do not open public issues for security problems. Use GitHub's private vulnerability
reporting (Security → Report a vulnerability). We aim to respond within 7 days.*

## Kurulumunu güvende tutmak için

- Verilere yalnızca `npm run kur -- --admin` ile eklenen e-postalar erişir (veritabanı
  satır güvenliği, migration 0027). Supabase'de **yeni kullanıcı kaydını kapalı** tut.
- `.env.local` dosyasını kimseyle paylaşma, git'e ekleme. `SUPABASE_SECRET_KEY` ve
  `DATABASE_URL` veritabanına tam erişim verir.
- Uygulamayı internete açtıysan (KURULUM.md §6B) güncellemeleri takip et ve
  `npm run kur` ile uygula.
- Belgeler klasörünün (`YEREL_DEPO_KOK`) bulunduğu bilgisayarda disk şifrelemesini
  (BitLocker / FileVault) aç.
