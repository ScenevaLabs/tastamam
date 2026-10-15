-- 13 Ekim 2026 (ürünleştirme, Faz C):
-- (1) İş girişi maillerinde İSG uzmanı bilgiye (CC) eklenir; ayarlardan kapatılabilir.
-- (2) Google Drive eklentisi için OAuth token'ları (OneDrive'ınkiyle aynı desen, 0009).
-- (3) Şirket adresi: sözleşme şablonunda işveren adresi olarak geçer.
-- (4) Varsayılan belge deposu: Supabase Storage'da özel "ozluk" bucket'ı.
--     Yalnızca oturum açmış kullanıcı erişir (v1 tek admin). Bucket adı
--     değiştirilecekse SUPABASE_DEPO_BUCKET ile aynı olmalı.

alter table ayarlar
  add column if not exists sirket_adresi text,
  add column if not exists isg_email text,
  add column if not exists isg_cc_giris boolean not null default true,
  add column if not exists g_refresh_token text,
  add column if not exists g_access_token text,
  add column if not exists g_access_token_expires_at timestamptz;

insert into storage.buckets (id, name, public)
values ('ozluk', 'ozluk', false)
on conflict (id) do nothing;

drop policy if exists "ozluk okuma" on storage.objects;
drop policy if exists "ozluk yazma" on storage.objects;
drop policy if exists "ozluk guncelleme" on storage.objects;
drop policy if exists "ozluk silme" on storage.objects;

create policy "ozluk okuma" on storage.objects
  for select to authenticated using (bucket_id = 'ozluk');
create policy "ozluk yazma" on storage.objects
  for insert to authenticated with check (bucket_id = 'ozluk');
create policy "ozluk guncelleme" on storage.objects
  for update to authenticated using (bucket_id = 'ozluk') with check (bucket_id = 'ozluk');
create policy "ozluk silme" on storage.objects
  for delete to authenticated using (bucket_id = 'ozluk');
