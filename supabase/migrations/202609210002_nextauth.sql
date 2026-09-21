-- Apply after 202609210001_participant_phone.sql. Transactional cutover to NextAuth.
begin;
create table public.pulsik_users (
 id uuid primary key default gen_random_uuid(), email text not null unique,
 name text, email_verified boolean not null default false,
 username text unique, password_hash text, is_admin boolean not null default false,
 created_at timestamptz not null default now()
);
-- Preserve UUIDs so every existing participation, result and redemption keeps its owner.
insert into public.pulsik_users(id,email,name,email_verified,password_hash,is_admin,username)
 select u.id,lower(trim(u.email)),u.raw_user_meta_data->>'full_name',u.email_confirmed_at is not null,
 case when a.user_id is not null then nullif(u.encrypted_password,'') end,
 a.user_id is not null,
 case when a.user_id is not null and lower(trim(u.email)) in ('pulsikadmin@pulsik.com.br','pulsikadmin@admin.pulsik.com.br') then 'pulsikadmin' end
 from auth.users u left join public.pulsik_admins a on a.user_id=u.id where nullif(trim(u.email),'') is not null;
alter table public.pulsik_participants drop constraint pulsik_participants_user_id_fkey;
alter table public.pulsik_participants drop constraint pulsik_participants_redeemed_by_fkey;
alter table public.pulsik_participants add foreign key(user_id) references public.pulsik_users(id);
alter table public.pulsik_participants add foreign key(redeemed_by) references public.pulsik_users(id);
-- Existing Supabase sessions must no longer read or mutate application data.
revoke all on public.pulsik_campaigns,public.pulsik_prizes,public.pulsik_participants,public.pulsik_spins,public.pulsik_admins from anon,authenticated;
revoke all on function public.pulsik_register(text,text,text,text,text,boolean),public.pulsik_spin(text,uuid),public.pulsik_redeem(text),public.pulsik_is_admin() from public,anon,authenticated;
create table public.pulsik_auth_limits(key text primary key, hits integer not null, resets_at timestamptz not null);
create table public.pulsik_email_codes(email text primary key, token_hash text not null, expires_at timestamptz not null, attempts integer not null default 0);
alter table public.pulsik_users enable row level security;
alter table public.pulsik_auth_limits enable row level security;
alter table public.pulsik_email_codes enable row level security;
revoke all on public.pulsik_users,public.pulsik_auth_limits,public.pulsik_email_codes from public,anon,authenticated;
grant all on public.pulsik_users,public.pulsik_auth_limits,public.pulsik_email_codes,public.pulsik_participants,public.pulsik_prizes,public.pulsik_spins,public.pulsik_campaigns to service_role;
create function public.pulsik_auth_limit(p_key text,p_max integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare v_hits integer;
begin
 insert into public.pulsik_auth_limits as l(key,hits,resets_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set hits=case when l.resets_at<=now() then 1 else l.hits+1 end,
 resets_at=case when l.resets_at<=now() then now()+make_interval(secs=>p_seconds) else l.resets_at end
 returning hits into v_hits;
 return v_hits<=p_max;
end;$$;
create function public.pulsik_verify_code(p_email text,p_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare v public.pulsik_email_codes;
begin
 select * into v from public.pulsik_email_codes where email=p_email for update;
 if not found or v.expires_at<=now() or v.attempts>=5 then return false;end if;
 if v.token_hash<>p_hash then
  update public.pulsik_email_codes set attempts=attempts+1 where email=p_email;
  return false;
 end if;
 delete from public.pulsik_email_codes where email=p_email;
 return true;
end;$$;
create function public.pulsik_verified_user(p_email text,p_name text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.pulsik_users;
begin
 if nullif(trim(p_email),'') is null then raise exception 'verified_email_required';end if;
 insert into public.pulsik_users as u(email,name,email_verified) values(lower(trim(p_email)),p_name,true)
 on conflict(email) do update set email_verified=true,name=coalesce(u.name,excluded.name) returning * into v;
 return jsonb_build_object('id',v.id,'email',v.email,'name',v.name);
end;$$;
create function public.pulsik_register_v2(p_user uuid,p_campaign text,p_name text,p_company text,p_job_title text,p_phone text,p_marketing boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=p_user; v_email text; v_phone text; v_p public.pulsik_participants; v_c public.pulsik_campaigns;
begin
 if v_user is null then raise exception 'verified_email_required';end if;
 select email into v_email from public.pulsik_users where id=v_user and email_verified=true;
 if v_email is null then raise exception 'verified_email_required';end if;
 select * into v_c from public.pulsik_campaigns where id=p_campaign for update;
 if not found then raise exception 'campaign_closed';end if;
 select * into v_p from public.pulsik_participants where campaign_id=p_campaign and user_id=v_user;
 if found then return to_jsonb(v_p);end if;
 if not v_c.active or now()<v_c.starts_at or now()>=v_c.ends_at then raise exception 'campaign_closed';end if;
 if p_name is null or char_length(trim(p_name)) not between 2 and 120
 or p_company is null or char_length(trim(p_company)) not between 2 and 160
 or p_job_title is null or char_length(trim(p_job_title)) not between 2 and 120
 then raise exception 'invalid_fields';end if;
 v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if v_phone !~ '^[0-9]{11}$' then raise exception 'invalid_phone';end if;
 if exists(select 1 from public.pulsik_participants where campaign_id=p_campaign and lower(trim(email))=v_email) then raise exception 'duplicate_email';end if;
 insert into public.pulsik_participants(campaign_id,user_id,email,name,company,job_title,phone,marketing)
 values(p_campaign,v_user,v_email,trim(p_name),trim(p_company),trim(p_job_title),v_phone,coalesce(p_marketing,false)) returning * into v_p;
 return to_jsonb(v_p);
end;$$;
create function public.pulsik_spin_v2(p_user uuid,p_campaign text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p public.pulsik_participants;v_s public.pulsik_spins;v_c public.pulsik_campaigns;v_roll numeric;v_outcome text;v_code text;
begin
 if p_user is null then raise exception 'google_required';end if;
 if p_request is null then raise exception 'invalid_request';end if;
 select * into v_c from public.pulsik_campaigns where id=p_campaign for update;
 if not found then raise exception 'campaign_closed';end if;
 select * into v_p from public.pulsik_participants where campaign_id=p_campaign and user_id=p_user for update;
 if not found then raise exception 'not_registered';end if;
 select * into v_s from public.pulsik_spins where participant_id=v_p.id and request_id=p_request;
 if found then return to_jsonb(v_s);end if;
 if v_p.status='complete' then
   select * into v_s from public.pulsik_spins where participant_id=v_p.id order by created_at desc,id desc limit 1;
   return to_jsonb(v_s);
 end if;
 if not v_c.active or now()<v_c.starts_at or now()>=v_c.ends_at then raise exception 'campaign_closed';end if;
 -- UUID v4 supplies cryptographically random bits; the browser never chooses the live result.
 v_roll:=public.pulsik_draw();
 v_outcome:=case when v_roll<3 then 'cup' when v_roll<23 then 'keychain' when v_roll<43 then 'pen' when v_roll<90 then 'none' else 'retry' end;
 if v_outcome in ('cup','keychain','pen') then
  update public.pulsik_prizes set remaining=remaining-1 where campaign_id=p_campaign and id=v_outcome and remaining>0;
  if not found then v_outcome:='none';else
   loop
    v_code:='PUL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
    exit when not exists(select 1 from public.pulsik_participants where claim_code=v_code);
   end loop;
  end if;
 end if;
 insert into public.pulsik_spins(participant_id,request_id,outcome,claim_code) values(v_p.id,p_request,v_outcome,v_code) returning * into v_s;
 if v_outcome<>'retry' then update public.pulsik_participants set status='complete',outcome=v_outcome,claim_code=v_code where id=v_p.id;end if;
 return to_jsonb(v_s);
end;$$;

create function public.pulsik_redeem_v2(p_user uuid,p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p public.pulsik_participants;v_c public.pulsik_campaigns;
begin
 if not exists(select 1 from public.pulsik_users where id=p_user and is_admin) then raise exception 'admin_required';end if;
 select * into v_p from public.pulsik_participants where claim_code=upper(trim(p_code)) for update;
 if not found then raise exception 'code_not_found';end if;
 if v_p.redeemed_at is not null then return jsonb_build_object('already_redeemed',true,'participant',to_jsonb(v_p));end if;
 select * into v_c from public.pulsik_campaigns where id=v_p.campaign_id;
 if now()<v_c.starts_at or now()>=v_c.ends_at then raise exception 'campaign_closed';end if;
 update public.pulsik_participants set redeemed_at=now(),redeemed_by=p_user where id=v_p.id returning * into v_p;
 return jsonb_build_object('already_redeemed',false,'participant',to_jsonb(v_p));
end;$$;

revoke all on function public.pulsik_auth_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.pulsik_auth_limit(text,integer,integer) to service_role;
revoke all on function public.pulsik_verify_code(text,text) from public,anon,authenticated;
grant execute on function public.pulsik_verify_code(text,text) to service_role;
revoke all on function public.pulsik_verified_user(text,text) from public,anon,authenticated;
grant execute on function public.pulsik_verified_user(text,text) to service_role;
revoke all on function public.pulsik_register_v2(uuid,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.pulsik_register_v2(uuid,text,text,text,text,text,boolean) to service_role;
revoke all on function public.pulsik_spin_v2(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.pulsik_spin_v2(uuid,text,uuid) to service_role;
revoke all on function public.pulsik_redeem_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.pulsik_redeem_v2(uuid,text) to service_role;
commit;
