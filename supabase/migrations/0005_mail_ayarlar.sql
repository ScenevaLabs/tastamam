-- v1 tek satır: uygulama tek şirket/tek kullanıcı için ayarları tutar.
create table ayarlar (
  id boolean primary key default true check (id),
  mali_musavir_email text,
  gonderen_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into ayarlar (id) values (true);

create table mail_gonderim_kaydi (
  id uuid primary key default gen_random_uuid(),
  is_girisi_id uuid not null references is_girisi(id) on delete cascade,
  tip text not null check (tip in ('giris','cikis')),
  durum text not null check (durum in ('basarili','basarisiz')),
  hata_mesaji text,
  alici_email text not null,
  created_at timestamptz not null default now()
);

alter table ayarlar enable row level security;
alter table mail_gonderim_kaydi enable row level security;

create policy "authenticated full access" on ayarlar
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on mail_gonderim_kaydi
  for all to authenticated using (true) with check (true);
