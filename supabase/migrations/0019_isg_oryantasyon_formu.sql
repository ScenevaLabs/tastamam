-- 9 Ekim 2026: İSG belgelerine beşinci zorunlu belge — Oryantasyon ve
-- İşbaşı Eğitimi Formu. Diğer İSG belgeleri gibi temel eğitim
-- sertifikasının döngüsüne bağlı (bkz. lib/isg.ts).

alter table isg_belge drop constraint isg_belge_belge_tipi_check;
alter table isg_belge add constraint isg_belge_belge_tipi_check check (belge_tipi in (
  'isg_egitim_sertifikasi','egitim_formu','oryantasyon_formu','saglik_raporu','sinav_sorulari'
));
