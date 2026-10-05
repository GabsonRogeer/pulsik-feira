-- NextAuth: execute APENAS depois de 202609210002_nextauth.sql.
-- Execute no SQL Editor com uma conexao administrativa.
-- Para provisionar uma conta nova, gere um hash bcrypt local (custo 12), substitua
-- HASH_BCRYPT abaixo pelo hash e revise o e-mail. Nunca coloque a senha em texto
-- puro neste arquivo. Para recuperar uma conta administrativa existente, defina
-- v_reset_password=true. A recuperacao preserva UUID, nome e vinculos.
-- Nao exclua o usuario: o login atual usa public.pulsik_users, sem Supabase Auth.
-- A troca de senha nao encerra sessoes NextAuth existentes.
do $$
declare
 v_hash text := 'HASH_BCRYPT';
 v_reset_password boolean := false;
 v_user_id uuid;
begin
 -- A conta existente so pode ser recuperada se ja for administradora.
 if v_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' then
  raise exception 'Substitua HASH_BCRYPT por um hash bcrypt valido com custo 12';
 end if;
 insert into public.pulsik_users as u(email,name,username,password_hash,is_admin,email_verified)
 values('pulsikadmin@pulsik.com.br','Administrador Pulsik','pulsikadmin',v_hash,true,true)
 on conflict(email) do update
 set username=excluded.username,password_hash=excluded.password_hash,email_verified=true
 where v_reset_password and u.is_admin
 returning id into v_user_id;
 if v_user_id is null then
  raise exception 'Conta existente: a recuperacao exige v_reset_password=true e uma conta ja administrativa';
 end if;
end $$;

-- Confirme o cadastro sem exibir o hash da senha.
select id,email,username,is_admin,email_verified
from public.pulsik_users
where email='pulsikadmin@pulsik.com.br';
