-- 15 Ekim 2026 (Faz D, paket 3): duruma bağlı kayıtlar ve zimmet.
-- Kurallar: MEVZUAT.md §5 (fazla çalışma yasakları), §6 (md. 22, md. 30), §7, §9 (BES).

-- Kişiye bağlı basit işaretler.
alter table kisi
  add column if not exists engelli boolean not null default false,
  add column if not exists kismi_sureli boolean not null default false,
  -- BES otomatik katılım (4632 ek md. 2): dahil edildiği gün ve cayma.
  add column if not exists bes_katilim date,
  add column if not exists bes_cayma date;

-- Tarihli durum kayıtları; her biri isteğe bağlı bir belgeyle.
create table if not exists kisi_durum (
  id uuid primary key default gen_random_uuid(),
  kisi_id uuid not null references kisi(id) on delete cascade,
  tur text not null check (tur in (
    'gebelik', 'dogum_izni', 'sut_izni', 'gece_raporu', 'calisma_izni',
    'kosul_degisikligi', 'savunma'
  )),
  baslangic date not null,
  bitis date,
  -- Çalışma koşulu değişikliğinde işçinin yazılı kabulü (md. 22).
  tamamlandi date,
  notu text,
  dosya_adi text,
  created_at timestamptz not null default now(),
  check (bitis is null or bitis >= baslangic)
);

create index if not exists kisi_durum_kisi_idx on kisi_durum (kisi_id, tur);

-- Zimmet: işçiye teslim edilen eşya (ekipman, kart, anahtar) ve iadesi.
create table if not exists zimmet (
  id uuid primary key default gen_random_uuid(),
  kisi_id uuid not null references kisi(id) on delete cascade,
  esya text not null,
  seri_no text,
  verilis date not null,
  iade date,
  notu text,
  created_at timestamptz not null default now(),
  check (iade is null or iade >= verilis)
);

create index if not exists zimmet_kisi_idx on zimmet (kisi_id);

alter table sablon drop constraint if exists sablon_ad_check;
alter table sablon add constraint sablon_ad_check check (ad in (
  'sozlesme_belirli', 'sozlesme_belirsiz', 'kvkk_aydinlatma', 'kvkk_acik_riza',
  'fazla_calisma_onayi', 'calisma_belgesi', 'zimmet_tutanagi'
));

alter table kisi_durum enable row level security;
alter table zimmet enable row level security;
create policy "yetkili erisim" on kisi_durum
  for all to authenticated using (public.yetkili_mi()) with check (public.yetkili_mi());
create policy "yetkili erisim" on zimmet
  for all to authenticated using (public.yetkili_mi()) with check (public.yetkili_mi());
