-- Eski/farklı isimlendirmeli birkaç kişide (birkaç gerçek dosyada görüldü)
-- diğer çalışanlarda olmayan belgeler bulundu: sağlık raporu, fesih
-- bildirimi, yıllık izin yazısı, İSG eğitim sertifikası, eğitim formu
-- (dönem bazlı) ve referans mektubu (kök, kişiye bağlı). Herkes için
-- listeye ekleniyor — kullanıcı geçerli olmayanları "gerekli değil"
-- olarak işaretleyecek (29 Ağustos 2026).

alter table kisi_belge drop constraint kisi_belge_belge_tipi_check;
alter table kisi_belge add constraint kisi_belge_belge_tipi_check
  check (belge_tipi in (
    'adli_sicil','askerlik_durum','ikametgah','mezuniyet','nufus_kayit','kimlik',
    'referans_mektubu'
  ));

alter table is_girisi_belge drop constraint is_girisi_belge_belge_tipi_check;
alter table is_girisi_belge add constraint is_girisi_belge_belge_tipi_check
  check (belge_tipi in (
    'isegiris_bildirgesi','sozlesme','ibraname','istenayrilis_bildirgesi','imzali_ciktisi',
    'fesih_bildirimi','yillik_izin_yazisi','isg_egitim_sertifikasi','egitim_formu','saglik_raporu'
  ));
