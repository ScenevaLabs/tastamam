-- 8 Ekim 2026: İSG belgeleri (temel eğitim sertifikası, eğitim formu,
-- sağlık raporu, sınav soruları) artık dönem belgesi değil, kişiye bağlı.
-- Temel eğitim sertifikasının geçerlilik tarihine kadar bir kez alınmış
-- olmaları yeterli; süre dolunca dördü birden tekrar eksik görünür.
-- Geçmiş tutulur: her alınan belge ayrı satır (alınma tarihiyle).
-- "yoksayildi" satırı (alinma_tarihi null) o tipin bu kişi için gerekli
-- olmadığını işaretler.
-- is_girisi_belge'deki eski isg_egitim_sertifikasi/egitim_formu/saglik_raporu
-- satırlarına dokunulmuyor — kod artık onları okumuyor.

create table isg_belge (
  id uuid primary key default gen_random_uuid(),
  kisi_id uuid not null references kisi(id) on delete cascade,
  belge_tipi text not null check (belge_tipi in (
    'isg_egitim_sertifikasi','egitim_formu','saglik_raporu','sinav_sorulari'
  )),
  durum text not null default 'var' check (durum in ('var','yoksayildi')),
  alinma_tarihi date,
  gecerlilik_tarihi date,
  dosya_adi text,
  notu text,
  created_at timestamptz not null default now(),
  check (durum = 'yoksayildi' or alinma_tarihi is not null)
);

create index isg_belge_kisi_idx on isg_belge (kisi_id);

alter table isg_belge enable row level security;

create policy "authenticated full access" on isg_belge
  for all to authenticated using (true) with check (true);
