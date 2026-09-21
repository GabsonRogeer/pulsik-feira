-- Apply after 202609210002_nextauth.sql. No existing participation is deleted.
begin;
insert into public.pulsik_campaigns(id,starts_at,ends_at,active)
values('siara-2026-test',now(),now()+interval '7 days',false);
insert into public.pulsik_prizes(campaign_id,id,initial_stock,remaining)
values('siara-2026-test','cup',30,30),('siara-2026-test','keychain',200,200),('siara-2026-test','pen',200,200);

alter table public.pulsik_participants add column registration_code text not null
 default ('CAD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))) unique;
create view public.pulsik_admin_participants with (security_invoker=true) as
 select p.*, (select count(*)::integer from public.pulsik_spins s where s.participant_id=p.id) as spin_count
 from public.pulsik_participants p;
revoke all on public.pulsik_admin_participants from public,anon,authenticated;
grant select on public.pulsik_admin_participants to service_role;

create table public.pulsik_admin_events(
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references public.pulsik_users(id),
 campaign_id text not null references public.pulsik_campaigns(id),
 action text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.pulsik_admin_events enable row level security;
revoke all on public.pulsik_admin_events from public,anon,authenticated;
grant select,insert on public.pulsik_admin_events to service_role;

create function public.pulsik_admin_stock(p_user uuid,p_campaign text,p_stock jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; previous public.pulsik_prizes; available integer; expected integer; changes jsonb:='[]';
begin
 if not exists(select 1 from public.pulsik_users where id=p_user and is_admin) then raise exception 'admin_required';end if;
 if p_campaign not in ('siara-2026','siara-2026-test') or p_campaign is null then raise exception 'invalid_request';end if;
 perform 1 from public.pulsik_campaigns where id=p_campaign for update;
 if not found then raise exception 'campaign_closed';end if;
 if p_stock is null or jsonb_typeof(p_stock)<>'array' then raise exception 'invalid_stock';end if;
 if jsonb_array_length(p_stock)<>3 then raise exception 'invalid_stock';end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_stock) x where x->>'id' in ('cup','keychain','pen'))<>3 then raise exception 'invalid_stock';end if;
 for item in select value from jsonb_array_elements(p_stock) loop
  if jsonb_typeof(item->'remaining') is distinct from 'number' or (item->>'remaining') !~ '^[0-9]{1,6}$'
    or jsonb_typeof(item->'expected') is distinct from 'number' or (item->>'expected') !~ '^[0-9]{1,6}$' then raise exception 'invalid_stock';end if;
  available:=(item->>'remaining')::integer;expected:=(item->>'expected')::integer;
  if available>100000 then raise exception 'invalid_stock';end if;
  select * into previous from public.pulsik_prizes where campaign_id=p_campaign and id=item->>'id' for update;
  if not found then raise exception 'invalid_stock';end if;
  if previous.remaining<>expected then raise exception 'stock_changed';end if;
  update public.pulsik_prizes set remaining=available,initial_stock=previous.initial_stock-previous.remaining+available
   where campaign_id=p_campaign and id=previous.id;
  changes:=changes||jsonb_build_array(jsonb_build_object('id',previous.id,'before',previous.remaining,'after',available));
 end loop;
 insert into public.pulsik_admin_events(actor_id,campaign_id,action,details) values(p_user,p_campaign,'stock',changes);
end;$$;

create function public.pulsik_admin_test_state(p_user uuid,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.pulsik_users where id=p_user and is_admin) then raise exception 'admin_required';end if;
 if p_active is null then raise exception 'invalid_request';end if;
 perform 1 from public.pulsik_campaigns where id='siara-2026-test' for update;
 update public.pulsik_campaigns set active=p_active,
  starts_at=case when p_active then now()-interval '1 minute' else starts_at end,
  ends_at=case when p_active then now()+interval '7 days' else ends_at end
 where id='siara-2026-test';
 insert into public.pulsik_admin_events(actor_id,campaign_id,action,details)
 values(p_user,'siara-2026-test','test_state',jsonb_build_object('active',p_active));
end;$$;

create function public.pulsik_admin_reset_test(p_user uuid,p_campaign text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare participants_deleted integer;spins_deleted integer;
begin
 if not exists(select 1 from public.pulsik_users where id=p_user and is_admin) then raise exception 'admin_required';end if;
 if p_campaign is distinct from 'siara-2026-test' or p_confirmation is distinct from 'LIMPAR TESTES' then raise exception 'reset_not_allowed';end if;
 perform 1 from public.pulsik_campaigns where id=p_campaign for update;
 update public.pulsik_campaigns set active=false where id=p_campaign;
 delete from public.pulsik_spins where participant_id in (select id from public.pulsik_participants where campaign_id=p_campaign);
 get diagnostics spins_deleted=row_count;
 delete from public.pulsik_participants where campaign_id=p_campaign;
 get diagnostics participants_deleted=row_count;
 update public.pulsik_prizes set remaining=initial_stock where campaign_id=p_campaign;
 insert into public.pulsik_admin_events(actor_id,campaign_id,action,details)
 values(p_user,p_campaign,'reset_test',jsonb_build_object('participants',participants_deleted,'spins',spins_deleted));
 return jsonb_build_object('participants',participants_deleted,'spins',spins_deleted);
end;$$;

-- Always lock the campaign before its participant, like spin/reset/stock operations.
create function public.pulsik_admin_redeem(p_user uuid,p_campaign text,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p public.pulsik_participants;v_c public.pulsik_campaigns;
begin
 if not exists(select 1 from public.pulsik_users where id=p_user and is_admin) then raise exception 'admin_required';end if;
 select * into v_c from public.pulsik_campaigns where id=p_campaign for update;
 if not found then raise exception 'campaign_closed';end if;
 select * into v_p from public.pulsik_participants where campaign_id=p_campaign and claim_code=upper(trim(p_code)) for update;
 if not found then raise exception 'code_not_found';end if;
 if v_p.redeemed_at is not null then return jsonb_build_object('already_redeemed',true,'participant',to_jsonb(v_p));end if;
 if not v_c.active or now()<v_c.starts_at or now()>=v_c.ends_at then raise exception 'campaign_closed';end if;
 update public.pulsik_participants set redeemed_at=now(),redeemed_by=p_user where id=v_p.id returning * into v_p;
 return jsonb_build_object('already_redeemed',false,'participant',to_jsonb(v_p));
end;$$;

revoke all on function public.pulsik_admin_stock(uuid,text,jsonb),public.pulsik_admin_test_state(uuid,boolean),public.pulsik_admin_reset_test(uuid,text,text),public.pulsik_admin_redeem(uuid,text,text) from public,anon,authenticated;
grant execute on function public.pulsik_admin_stock(uuid,text,jsonb),public.pulsik_admin_test_state(uuid,boolean),public.pulsik_admin_reset_test(uuid,text,text),public.pulsik_admin_redeem(uuid,text,text) to service_role;

-- Test prizes are unmistakable and remain in their own campaign.
create or replace function public.pulsik_spin_v2(p_user uuid,p_campaign text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
    v_code:=(case when p_campaign='siara-2026-test' then 'TST-' else 'PUL-' end)||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
    exit when not exists(select 1 from public.pulsik_participants where claim_code=v_code);
   end loop;
  end if;
 end if;
 insert into public.pulsik_spins(participant_id,request_id,outcome,claim_code) values(v_p.id,p_request,v_outcome,v_code) returning * into v_s;
 if v_outcome<>'retry' then update public.pulsik_participants set status='complete',outcome=v_outcome,claim_code=v_code where id=v_p.id;end if;
 return to_jsonb(v_s);
end;$$;


commit;
