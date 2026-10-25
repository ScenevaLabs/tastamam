-- Yetki yalnızca doğrulanmış e-postaya (25 Ekim 2026, güvenlik incelemesi).
--
-- yetkili_mi() JWT'deki e-postaya bakıyordu. Supabase'de e-posta onayı kapalı
-- bir kurulumda, yetkili listesinde olup henüz hesabı açılmamış bir adresle
-- herkes şifreli kayıt (signup) yapıp o e-postayla oturum alabilirdi. Artık
-- oturumdaki kullanıcının e-postası doğrulanmış (email_confirmed_at dolu)
-- olmalı. Giriş tek kullanımlık kodla (OTP) yapıldığı ve `npm run admin`
-- hesabı onaylı açtığı için mevcut kullanıcılar etkilenmez.

create or replace function public.yetkili_mi() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from yetkili_kullanici y
    join auth.users u on u.id = auth.uid()
    where y.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(u.email) = y.email
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.yetkili_mi() from public;
grant execute on function public.yetkili_mi() to authenticated;
