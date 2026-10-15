alter table kisi_belge drop constraint kisi_belge_durum_check;
alter table kisi_belge add constraint kisi_belge_durum_check check (durum in ('var', 'yok', 'yoksayildi'));

alter table is_girisi_belge drop constraint is_girisi_belge_durum_check;
alter table is_girisi_belge add constraint is_girisi_belge_durum_check check (durum in ('var', 'yok', 'yoksayildi'));
