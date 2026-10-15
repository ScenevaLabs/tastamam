-- 13 Ekim 2026 (Faz D): puantaj ve yıllık izin modülleri.
-- Kurallar: MEVZUAT.md §2 ve §4, kodda src/lib/mevzuat.ts.
--
-- (1) Modül aç/kapa. Yeni modüller mevcut kurulumda (içinde çalışan kaydı
--     olan veritabanında) kapalı başlar, boş yeni kurulumda açık başlar.
-- (2) Doğum tarihi: yıllık izinde 18 yaş altı / 50 yaş üstü en az 20 gün
--     kuralı (ileride fazla çalışma yasağı ve BES 45 yaş sınırı için de).
-- (3) Puantaj: yalnızca varsayılandan farklı günler saklanır. Varsayılanı
--     kod üretir (iş dönemi, Pazar hafta tatili, genel tatil, yıllık izin).
-- (4) Puantaj ayı kapanışı (muhasebeye gönderildi mi).
-- (5) Yıllık izin kaydı: izin kayıt belgesinin satırları (Yön. md. 20).

alter table ayarlar
  add column if not exists acik_moduller text[] not null default '{}';

update ayarlar
set acik_moduller = case
  when exists (select 1 from kisi) then '{}'::text[]
  else array['puantaj', 'izin']
end
where id = true;

alter table kisi
  add column if not exists dogum_tarihi date;

create table puantaj_gun (
  kisi_id uuid not null references kisi(id) on delete cascade,
  tarih date not null,
  -- null: kod varsayılanda kalır, yalnızca fazla çalışma saati girilmiş
  kod text check (kod in ('Ç','HT','GT','R','Üİ','D','Dİ')),
  fazla_saat numeric(4,1) not null default 0 check (fazla_saat >= 0 and fazla_saat <= 11),
  notu text,
  updated_at timestamptz not null default now(),
  primary key (kisi_id, tarih)
);

create table puantaj_ay (
  ay date primary key check (extract(day from ay) = 1),
  kapandi_at timestamptz,
  gonderildi_at timestamptz,
  gonderim_hatasi text
);

create table yillik_izin (
  id uuid primary key default gen_random_uuid(),
  kisi_id uuid not null references kisi(id) on delete cascade,
  baslangic date not null,
  bitis date not null,
  -- izinden düşen gün (Pazar ve genel tatiller hariç), kayıt anında hesaplanır
  gun integer not null check (gun >= 0),
  yol_izni_gun integer not null default 0 check (yol_izni_gun between 0 and 4),
  form_durumu text not null default 'yok' check (form_durumu in ('yok','var')),
  dosya_adi text,
  notu text,
  created_at timestamptz not null default now(),
  check (bitis >= baslangic)
);

create index yillik_izin_kisi_idx on yillik_izin (kisi_id, baslangic);

alter table puantaj_gun enable row level security;
alter table puantaj_ay enable row level security;
alter table yillik_izin enable row level security;

create policy "authenticated full access" on puantaj_gun
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on puantaj_ay
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on yillik_izin
  for all to authenticated using (true) with check (true);
