-- 15 Ekim 2026 (Faz D, paket 2): fazla çalışma onayı, çalışma belgesi,
-- ücret hesap pusulası arşivi, KVKK saklama süresi. Kurallar: MEVZUAT.md §5, §6, §8.

-- Koşullu dönem belgeleri: fazla çalışma onayı (Fazla Çalışma Yön. md. 9) ve
-- çıkışta verilen çalışma belgesi (4857 md. 28).
alter table is_girisi_belge drop constraint if exists is_girisi_belge_belge_tipi_check;
alter table is_girisi_belge add constraint is_girisi_belge_belge_tipi_check
  check (belge_tipi in (
    'isegiris_bildirgesi','sozlesme','ibraname','istenayrilis_bildirgesi','imzali_ciktisi',
    'fesih_bildirimi','yillik_izin_yazisi','fazla_calisma_onayi','calisma_belgesi'
  ));

-- İşçi fazla çalışma onayını 30 gün önceden yazılı bildirimle geri alabilir.
alter table is_girisi
  add column if not exists fazla_calisma_geri_alma date;

-- Yeni belgeler (fazla çalışma onayı, çalışma belgesi, ücret pusulası) bu
-- tarihten sonraki dönem ve aylar için istenir. Mevcut kurulumda bugün, boş
-- kurulumda hiç sınır yok (null) — geçmiş dönemler birden "eksik" görünmesin.
alter table ayarlar
  add column if not exists belge_takip_baslangic date;
update ayarlar
set belge_takip_baslangic = case when exists (select 1 from kisi) then current_date else null end
where id = true and belge_takip_baslangic is null;

alter table sablon drop constraint if exists sablon_ad_check;
alter table sablon add constraint sablon_ad_check check (ad in (
  'sozlesme_belirli', 'sozlesme_belirsiz', 'kvkk_aydinlatma', 'kvkk_acik_riza',
  'fazla_calisma_onayi', 'calisma_belgesi'
));

-- Ücret hesap pusulası (4857 md. 37): kişi × ay, imzalı nüsha dönem klasöründe.
create table if not exists ucret_pusulasi (
  kisi_id uuid not null references kisi(id) on delete cascade,
  ay date not null check (extract(day from ay) = 1),
  dosya_adi text,
  yuklendi_at timestamptz not null default now(),
  primary key (kisi_id, ay)
);

alter table ucret_pusulasi enable row level security;
create policy "yetkili erisim" on ucret_pusulasi
  for all to authenticated using (public.yetkili_mi()) with check (public.yetkili_mi());
