-- NextAuth: execute APENAS depois de 202609210002_nextauth.sql.
-- Administradores antigos ja sao migrados; nao execute para trocar uma senha existente.
-- Para provisionar uma conta nova, gere um hash bcrypt local (custo 12), substitua
-- HASH_BCRYPT abaixo pelo hash e revise o e-mail. Nunca coloque a senha em texto
-- puro neste arquivo. O bloco recusa placeholders e nao altera conta existente.
do $$
declare v_hash text := 'HASH_BCRYPT';
begin
 if v_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' then
  raise exception 'Substitua HASH_BCRYPT por um hash bcrypt valido com custo 12';
 end if;
 insert into public.pulsik_users(email,name,username,password_hash,is_admin,email_verified)
 values('pulsikadmin@pulsik.com.br','Administrador Pulsik','pulsikadmin',v_hash,true,true);
end $$;
