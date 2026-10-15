create table kisi_belge (
  id uuid primary key default gen_random_uuid(),
  kisi_id uuid not null references kisi(id) on delete cascade,
  belge_tipi text not null check (belge_tipi in ('adli_sicil','askerlik_durum','ikametgah','mezuniyet','nufus_kayit','kimlik')),
  durum text not null default 'yok' check (durum in ('var','yok')),
  notu text,
  created_at timestamptz not null default now(),
  unique (kisi_id, belge_tipi)
);

create table is_girisi_belge (
  id uuid primary key default gen_random_uuid(),
  is_girisi_id uuid not null references is_girisi(id) on delete cascade,
  belge_tipi text not null check (belge_tipi in ('isegiris_bildirgesi','sozlesme','ibraname','istenayrilis_bildirgesi','imzali_ciktisi')),
  durum text not null default 'yok' check (durum in ('var','yok')),
  notu text,
  created_at timestamptz not null default now(),
  unique (is_girisi_id, belge_tipi)
);

alter table kisi_belge enable row level security;
alter table is_girisi_belge enable row level security;

create policy "authenticated full access" on kisi_belge
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on is_girisi_belge
  for all to authenticated using (true) with check (true);
