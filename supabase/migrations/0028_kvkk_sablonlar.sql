-- 15 Ekim 2026: KVKK aydınlatma metni ve açık rıza; kullanıcının kendi
-- belge şablonları (iş sözleşmesi belirli/belirsiz süreli, KVKK metinleri).
-- Kural: MEVZUAT.md §8 (aydınlatma ile rıza ayrı metin; rıza isteğe bağlı).

alter table kisi_belge drop constraint if exists kisi_belge_belge_tipi_check;
alter table kisi_belge add constraint kisi_belge_belge_tipi_check
  check (belge_tipi in (
    'adli_sicil','askerlik_durum','ikametgah','mezuniyet','nufus_kayit','kimlik',
    'referans_mektubu','kvkk_aydinlatma','kvkk_acik_riza'
  ));

-- Açık rıza beyanı yalnızca rızaya dayalı ek işlem yapan işyerlerinde
-- (ör. görüntü/ses kullanımı) gösterilir.
alter table ayarlar
  add column if not exists kvkk_acik_riza boolean not null default false;

-- Kullanıcının yüklediği şablonlar. Yoksa uygulamadaki örnek şablon kullanılır.
-- Depo seçiminden bağımsız olsun diye veritabanında (base64) tutulur; şablon
-- kişisel veri değil, şirketin boş belge kalıbıdır.
create table if not exists sablon (
  ad text primary key check (ad in (
    'sozlesme_belirli', 'sozlesme_belirsiz', 'kvkk_aydinlatma', 'kvkk_acik_riza'
  )),
  dosya_adi text not null,
  icerik_b64 text not null check (length(icerik_b64) <= 4000000),
  yuklendi_at timestamptz not null default now()
);

alter table sablon enable row level security;

-- 0027 sonrası her yeni tablo yetkili e-postalarla sınırlı.
create policy "yetkili erisim" on sablon
  for all to authenticated using (public.yetkili_mi()) with check (public.yetkili_mi());
