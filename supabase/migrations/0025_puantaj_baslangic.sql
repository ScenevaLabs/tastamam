-- 14 Ekim 2026: puantaj, kişi sayfasındaki dönem evrak listesinde her ay için
-- bir satır olarak görünür (saat girilmemiş ya da imzasız ay eksik sayılır).
-- Puantajın kullanılmaya başlandığı aydan önceki aylar listelenmez; yoksa
-- geçmişteki bütün dönemler bir anda "puantaj eksik" görünürdü.
-- Varsayılan: migration'ın uygulandığı ay; ama daha önce saat ya da imzalı
-- çizelge girilmiş bir ay varsa (mevcut kurulumda Eylül 2026) oradan başlar.
-- Ayarlar → Modüller'den değiştirilebilir.

alter table ayarlar
  add column if not exists puantaj_baslangic date not null default date_trunc('month', now())::date;

alter table ayarlar drop constraint if exists ayarlar_puantaj_baslangic_ay_basi;
alter table ayarlar
  add constraint ayarlar_puantaj_baslangic_ay_basi check (extract(day from puantaj_baslangic) = 1);

update ayarlar
set puantaj_baslangic = least(
  puantaj_baslangic,
  coalesce((select date_trunc('month', min(tarih))::date from puantaj_gun where giris_saati is not null), puantaj_baslangic),
  coalesce((select min(ay) from puantaj_imza), puantaj_baslangic)
)
where id = true;
