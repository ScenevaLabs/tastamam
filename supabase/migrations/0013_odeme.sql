create table odeme (
  id uuid primary key default gen_random_uuid(),
  is_girisi_id uuid not null references is_girisi(id) on delete cascade,
  aciklama text,
  tutar numeric(12, 2) not null,
  vade_tarihi date not null,
  odendi_mi boolean not null default false,
  odeme_tarihi date,
  created_at timestamptz not null default now()
);

alter table odeme enable row level security;

create policy "authenticated full access" on odeme
  for all
  to authenticated
  using (true)
  with check (true);
