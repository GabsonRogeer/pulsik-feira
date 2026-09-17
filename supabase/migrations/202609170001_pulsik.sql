-- Apply once in a new Supabase project. No service-role credential is used by the app.
begin;
create table public.pulsik_campaigns (
 id text primary key, starts_at timestamptz not null, ends_at timestamptz not null,
 active boolean not null default true, check(ends_at>starts_at)
);
create table public.pulsik_prizes (
 campaign_id text not null references public.pulsik_campaigns(id), id text not null check(id in ('cup','keychain','pen')),
 initial_stock integer not null check(initial_stock>=0),remaining integer not null check(remaining>=0 and remaining<=initial_stock),
 primary key(campaign_id,id)
);
create table public.pulsik_admins (user_id uuid primary key references auth.users(id));
create table public.pulsik_participants (
 id uuid primary key default gen_random_uuid(), campaign_id text not null references public.pulsik_campaigns(id),user_id uuid not null references auth.users(id),
 email text not null, name text not null, company text not null, job_title text not null,city text not null,state text not null,
 marketing boolean not null default false, privacy_version text not null default '2026-09-17',created_at timestamptz not null default now(),
 status text not null default 'ready' check(status in ('ready','complete')),outcome text check(outcome in ('cup','keychain','pen','none')),
 claim_code text unique, redeemed_at timestamptz,redeemed_by uuid references auth.users(id),
 unique(campaign_id,user_id),check((status='ready' and outcome is null) or (status='complete' and outcome is not null)),
 check((outcome in ('cup','keychain','pen') and claim_code is not null) or (claim_code is null and (outcome is null or outcome='none')))
);
create unique index pulsik_unique_email on public.pulsik_participants(campaign_id,lower(trim(email)));
create table public.pulsik_spins (
 id uuid primary key default gen_random_uuid(),participant_id uuid not null references public.pulsik_participants(id),request_id uuid not null,
 outcome text not null check(outcome in ('cup','keychain','pen','none','retry')),claim_code text,created_at timestamptz not null default now(),unique(participant_id,request_id)
);
create index pulsik_spins_participant on public.pulsik_spins(participant_id,created_at desc);
alter table public.pulsik_campaigns enable row level security;
alter table public.pulsik_prizes enable row level security;
alter table public.pulsik_admins enable row level security;
alter table public.pulsik_participants enable row level security;
alter table public.pulsik_spins enable row level security;
create function public.pulsik_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pulsik_admins where user_id=auth.uid());
$$;
create policy campaign_read on public.pulsik_campaigns for select to authenticated using(true);
create policy prize_read on public.pulsik_prizes for select to authenticated using(true);
create policy participant_read on public.pulsik_participants for select to authenticated using(user_id=auth.uid() or public.pulsik_is_admin());
create policy spin_read on public.pulsik_spins for select to authenticated using(exists(select 1 from public.pulsik_participants p where p.id=participant_id and (p.user_id=auth.uid() or public.pulsik_is_admin())));
revoke all on public.pulsik_campaigns,public.pulsik_prizes,public.pulsik_admins,public.pulsik_participants,public.pulsik_spins from anon,authenticated;
grant select on public.pulsik_campaigns,public.pulsik_prizes,public.pulsik_participants,public.pulsik_spins to authenticated;

create function public.pulsik_register(p_campaign text,p_name text,p_company text,p_job_title text,p_city text,p_state text,p_marketing boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_email text; v_p public.pulsik_participants; v_c public.pulsik_campaigns;
begin
 if v_user is null then raise exception 'google_required';end if;
 select lower(trim(u.email)) into v_email from auth.users u where u.id=v_user and u.email_confirmed_at is not null
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google');
 if v_email is null then raise exception 'google_required';end if;
 -- The campaign lock serializes registration and spin writes, including duplicate devices.
 select * into v_c from public.pulsik_campaigns where id=p_campaign for update;
 if not found then raise exception 'campaign_closed';end if;
 select * into v_p from public.pulsik_participants where campaign_id=p_campaign and user_id=v_user;
 if found then return to_jsonb(v_p);end if;
 if not v_c.active or now()<v_c.starts_at or now()>=v_c.ends_at then raise exception 'campaign_closed';end if;
 if p_name is null or char_length(trim(p_name)) not between 2 and 120
 or p_company is null or char_length(trim(p_company)) not between 2 and 160
 or p_job_title is null or char_length(trim(p_job_title)) not between 2 and 120
 or p_city is null or char_length(trim(p_city)) not between 2 and 100
 or p_state is null or p_state not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
 then raise exception 'invalid_fields';end if;
 if exists(select 1 from public.pulsik_participants where campaign_id=p_campaign and lower(trim(email))=v_email) then raise exception 'duplicate_email';end if;
 insert into public.pulsik_participants(campaign_id,user_id,email,name,company,job_title,city,state,marketing)
 values(p_campaign,v_user,v_email,trim(p_name),trim(p_company),trim(p_job_title),trim(p_city),p_state,coalesce(p_marketing,false)) returning * into v_p;
 return to_jsonb(v_p);
end;$$;

create function public.pulsik_draw() returns numeric language sql volatile set search_path='' as $$
 select (('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint::numeric / 4294967296)*100;
$$;
revoke all on function public.pulsik_draw() from public,anon,authenticated;
create function public.pulsik_spin(p_campaign text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p public.pulsik_participants;v_s public.pulsik_spins;v_c public.pulsik_campaigns;v_roll numeric;v_outcome text;v_code text;
begin
 if auth.uid() is null then raise exception 'google_required';end if;
 if p_request is null then raise exception 'invalid_request';end if;
 select * into v_c from public.pulsik_campaigns where id=p_campaign for update;
 if not found then raise exception 'campaign_closed';end if;
 select * into v_p from public.pulsik_participants where campaign_id=p_campaign and user_id=auth.uid() for update;
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

create function public.pulsik_redeem(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p public.pulsik_participants;v_c public.pulsik_campaigns;
begin
 if not public.pulsik_is_admin() then raise exception 'admin_required';end if;
 select * into v_p from public.pulsik_participants where claim_code=upper(trim(p_code)) for update;
 if not found then raise exception 'code_not_found';end if;
 if v_p.redeemed_at is not null then return jsonb_build_object('already_redeemed',true,'participant',to_jsonb(v_p));end if;
 select * into v_c from public.pulsik_campaigns where id=v_p.campaign_id;
 if now()<v_c.starts_at or now()>=v_c.ends_at then raise exception 'campaign_closed';end if;
 update public.pulsik_participants set redeemed_at=now(),redeemed_by=auth.uid() where id=v_p.id returning * into v_p;
 return jsonb_build_object('already_redeemed',false,'participant',to_jsonb(v_p));
end;$$;
revoke all on function public.pulsik_is_admin(),public.pulsik_register(text,text,text,text,text,text,boolean),public.pulsik_spin(text,uuid),public.pulsik_redeem(text) from public,anon;
grant execute on function public.pulsik_is_admin(),public.pulsik_register(text,text,text,text,text,text,boolean),public.pulsik_spin(text,uuid),public.pulsik_redeem(text) to authenticated;
insert into public.pulsik_campaigns values('siara-2026','2026-10-07 00:00:00-03','2026-10-10 00:00:00-03',true);
insert into public.pulsik_prizes values('siara-2026','cup',30,30),('siara-2026','keychain',200,200),('siara-2026','pen',200,200);
commit;
