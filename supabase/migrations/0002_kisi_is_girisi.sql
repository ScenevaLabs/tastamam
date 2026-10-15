drop table if exists calisan;

create table kisi (
  id uuid primary key default gen_random_uuid(),
  ad_soyad text not null,
  tc_kimlik_no text not null unique,
  meslek_kodu text not null,
  meslek_adi text not null,
  created_at timestamptz not null default now()
);

create table is_girisi (
  id uuid primary key default gen_random_uuid(),
  kisi_id uuid not null references kisi(id) on delete cascade,
  durum text not null default 'aktif' check (durum in ('aktif', 'pasif')),
  giris_tarihi date not null,
  cikis_tarihi date,
  ucret_tutari numeric(12, 2),
  created_at timestamptz not null default now()
);

alter table kisi enable row level security;
alter table is_girisi enable row level security;

create policy "authenticated full access" on kisi
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on is_girisi
  for all to authenticated using (true) with check (true);
