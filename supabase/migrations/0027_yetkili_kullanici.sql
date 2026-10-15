-- 15 Ekim 2026 (Faz E, güvenlik): verilere yalnızca yetkili e-postalar erişir.
--
-- Önceki politikalar "oturum açmış herkes"e açıktı. Supabase'de kayıt (signup)
-- varsayılan açık olduğu için, başkasının kurulumunda yabancı biri hesap açıp
-- bütün özlük verisini okuyabilirdi. Artık her tablo ve "ozluk" deposu,
-- oturumdaki e-posta yetkili_kullanici tablosundaysa erişilebilir.
--
-- Mevcut kurulumlar kilitlenmesin diye: bu migration çalıştığı anda var olan
-- bütün kullanıcıların e-postaları yetkili listesine eklenir. Yeni kullanıcı
-- `npm run admin -- e-posta` ile eklenir (hem hesap açar hem yetki verir).

create table if not exists yetkili_kullanici (
  email text primary key check (email = lower(email)),
  eklendi_at timestamptz not null default now()
);

alter table yetkili_kullanici enable row level security;
-- Tablonun kendisini uygulama okumaz; yalnızca aşağıdaki fonksiyon okur.

insert into yetkili_kullanici (email)
select lower(email) from auth.users where email is not null
on conflict do nothing;

-- security definer: RLS'li yetkili_kullanici tablosunu politika içinden okuyabilsin.
create or replace function public.yetkili_mi() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from yetkili_kullanici
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.yetkili_mi() from public;
grant execute on function public.yetkili_mi() to authenticated;

-- "authenticated full access" politikası olan her tabloyu yetkili kontrolüne çevir.
do $$
declare t record;
begin
  for t in
    select schemaname, tablename from pg_policies
    where schemaname = 'public' and policyname = 'authenticated full access'
  loop
    execute format('drop policy "authenticated full access" on %I.%I', t.schemaname, t.tablename);
    execute format(
      'create policy "yetkili erisim" on %I.%I for all to authenticated using (public.yetkili_mi()) with check (public.yetkili_mi())',
      t.schemaname, t.tablename
    );
  end loop;
end $$;

drop policy if exists "ozluk okuma" on storage.objects;
drop policy if exists "ozluk yazma" on storage.objects;
drop policy if exists "ozluk guncelleme" on storage.objects;
drop policy if exists "ozluk silme" on storage.objects;

create policy "ozluk okuma" on storage.objects
  for select to authenticated using (bucket_id = 'ozluk' and public.yetkili_mi());
create policy "ozluk yazma" on storage.objects
  for insert to authenticated with check (bucket_id = 'ozluk' and public.yetkili_mi());
create policy "ozluk guncelleme" on storage.objects
  for update to authenticated using (bucket_id = 'ozluk' and public.yetkili_mi())
  with check (bucket_id = 'ozluk' and public.yetkili_mi());
create policy "ozluk silme" on storage.objects
  for delete to authenticated using (bucket_id = 'ozluk' and public.yetkili_mi());
