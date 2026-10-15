-- 15 Ekim 2026 (Faz D, paket 1): İSG periyodik takip, iş kazası kaydı,
-- takvim + günlük hatırlatma maili. Kurallar: MEVZUAT.md §1, §7.
--
-- Yeni modüller ("isg", "takvim") mevcut kurulumda kapalı başlar; bu
-- migration acik_moduller'e dokunmaz. Ayarlar > Modüller'den açılır.

alter table ayarlar
  add column if not exists isg_tehlike_sinifi text
    check (isg_tehlike_sinifi in ('az', 'tehlikeli', 'cok')),
  -- Takvimdeki bir süre dolmadan kaç gün önce mail gelsin.
  add column if not exists hatirlatma_gun integer not null default 3
    check (hatirlatma_gun between 0 and 30),
  -- Aynı gün iki kez gönderilmesin (zamanlanmış görev tekrar çalışırsa).
  add column if not exists hatirlatma_son_gonderim date;

-- İşyeri belgeleri: her yapılış ayrı satır (geçmiş tutulur).
create table if not exists isyeri_belge (
  id uuid primary key default gen_random_uuid(),
  tip text not null check (tip in ('risk_degerlendirmesi', 'acil_durum_plani', 'tatbikat')),
  yapilma_tarihi date not null,
  dosya_adi text,
  notu text,
  created_at timestamptz not null default now()
);

create index if not exists isyeri_belge_tip_idx on isyeri_belge (tip, yapilma_tarihi);

-- İş kazası, meslek hastalığı ve ramak kala kaydı (6331 md. 14).
create table if not exists is_kazasi (
  id uuid primary key default gen_random_uuid(),
  kisi_id uuid not null references kisi(id) on delete cascade,
  tur text not null default 'is_kazasi' check (tur in ('is_kazasi', 'meslek_hastaligi', 'ramak_kala')),
  olay_tarihi date not null,
  olay_saati text check (olay_saati is null or olay_saati ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  isyeri_disinda boolean not null default false,
  ogrenme_tarihi date,
  yer text,
  aciklama text not null,
  yaralanma text,
  saglik_kurulusu text,
  istirahat_bas date,
  istirahat_bit date,
  taniklar text,
  haber_verildi_at timestamptz,
  tutanak_dosya text,
  rapor_dosya text,
  bildirildi_tarihi date,
  created_at timestamptz not null default now(),
  check (istirahat_bit is null or istirahat_bas is not null),
  check (istirahat_bit is null or istirahat_bit >= istirahat_bas)
);

create index if not exists is_kazasi_kisi_idx on is_kazasi (kisi_id, olay_tarihi);

alter table isyeri_belge enable row level security;
alter table is_kazasi enable row level security;

create policy "authenticated full access" on isyeri_belge
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on is_kazasi
  for all to authenticated using (true) with check (true);
