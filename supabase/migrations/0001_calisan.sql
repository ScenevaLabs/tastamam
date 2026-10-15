create table if not exists calisan (
  id uuid primary key default gen_random_uuid(),
  ad_soyad text not null,
  tc_kimlik_no text not null,
  tip text not null check (tip in ('kadrolu', 'freelance')),
  durum text not null default 'aktif' check (durum in ('aktif', 'pasif')),
  giris_tarihi date not null,
  cikis_tarihi date,
  ucret_tipi text not null check (ucret_tipi in ('gunluk', 'aylik')),
  ucret_tutari numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

alter table calisan enable row level security;

create policy "authenticated full access"
  on calisan
  for all
  to authenticated
  using (true)
  with check (true);
