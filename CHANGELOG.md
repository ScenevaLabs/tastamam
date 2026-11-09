# Sürümler / Changelog

Her sürümde neyin değiştiği burada. Veritabanı değişikliği (migration) gerektiren
sürümlerde güncellemeden önce [KURULUM.md → Güncelleme](KURULUM.md#5-güncelleme)
adımlarını izle; `npm run kur` yalnızca yeni migration'ları uygular.

What changed in each release. When a release needs database migrations, follow
[KURULUM.md → Güncelleme](KURULUM.md#5-güncelleme) before updating; `npm run kur`
applies only the new migrations.

## 1.0.0 — 2026-11-09

İlk açık kaynak sürüm. / First open-source release.

**Neler var**

- Ana sayfa, çalışan dosyası, eksik evrak takibi; doğum tarihi SGK bildirgesinden ya da
  nüfus kayıt örneğinden okunur.
- İş girişi ve çıkışı: muhasebeye SGK bildirimi maili (toplu dahil), dönen belgenin
  gelen kutusundan okunup dosyalanması.
- İş sözleşmesi (belirli / belirsiz süreli, kendi şablonun), KVKK aydınlatma metni ve
  ayrı açık rıza beyanı.
- Puantaj (çoklu seçim, SGK eksik gün kodu önerisi, fazla çalışma takibi, Excel ve imza
  çizelgesi), yıllık izin, İSG, iş kazası, fazla çalışma onayı, çalışma belgesi, ücret
  pusulası arşivi, duruma bağlı kayıtlar, zimmet, takvim ve sabah maili.
- Belge deposu: yerel klasör, Supabase Storage, OneDrive ya da Google Drive.

**Güvenlik**

- Gelen mailde gönderen doğrulaması; OAuth token'ları şifreli (AES-256-GCM); tüm sunucu
  işlemlerinde yetki kontrolü; yetki için doğrulanmış e-posta şartı.

**Gerekenler:** Node.js 20+, Supabase (bulut ya da Docker ile yerel), SMTP mail kutusu.
Kurulum: [KURULUM.md](KURULUM.md).

**Veritabanı:** migration'lar `0001`–`0032`. Yeni kurulumda `npm run kur` hepsini uygular.

**Requirements:** Node.js 20+, Supabase (cloud or local via Docker), an SMTP mailbox.
Setup: [KURULUM.md](KURULUM.md). Database migrations `0001`–`0032`, applied by `npm run kur`.
