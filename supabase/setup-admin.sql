-- First create the email/password user in Authentication > Users > Add user.
-- This script grants access only to the confirmed internal admin account.
do $$
declare admin_id uuid;
begin
 select id into admin_id from auth.users where lower(email)='pulsikadmin@pulsik.com.br' and email_confirmed_at is not null;
 if admin_id is null then raise exception 'Create and confirm the admin Auth user first';end if;
 insert into public.pulsik_admins(user_id) values(admin_id) on conflict(user_id) do nothing;
end $$;
