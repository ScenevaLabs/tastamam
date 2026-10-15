-- 14 Ekim 2026: puantajın çalışana imzalatılması (kullanıcı kararı: B seçeneği,
-- giriş–çıkış saati elle girilir).
-- (1) Günlük giriş ve çıkış saati. İkisi birlikte girilir; fazla çalışma
--     saati bunlardan hesaplanıp fazla_saat'e yazılır (ara dinlenme düşülür,
--     4857 md. 68). Çıkış girişten küçükse gece yarısını geçen vardiya.
-- (2) Aylık çizelgenin imzalı nüshası (çalışan başına ay başına bir dosya).

alter table puantaj_gun
  add column if not exists giris_saati time,
  add column if not exists cikis_saati time;

alter table puantaj_gun drop constraint if exists puantaj_gun_saat_cift;
alter table puantaj_gun
  add constraint puantaj_gun_saat_cift check ((giris_saati is null) = (cikis_saati is null));

create table if not exists puantaj_imza (
  ay date not null check (extract(day from ay) = 1),
  kisi_id uuid not null references kisi(id) on delete cascade,
  dosya_adi text not null,
  yuklendi_at timestamptz not null default now(),
  primary key (ay, kisi_id)
);

alter table puantaj_imza enable row level security;

drop policy if exists "authenticated full access" on puantaj_imza;
create policy "authenticated full access" on puantaj_imza
  for all to authenticated using (true) with check (true);
