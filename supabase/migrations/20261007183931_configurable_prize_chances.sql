-- Apply after 20261005230228_guest_registration.sql, before deploying the app.
-- Existing campaigns retain 4/23/23/20/30; prizes and saved results are untouched.
begin;

create function public.pulsik_valid_chances(p_chances jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare v_key text; v_value jsonb; v_number numeric; v_total numeric:=0;
begin
 if p_chances is null or jsonb_typeof(p_chances)<>'object' then return false;end if;
 if (select count(*) from jsonb_object_keys(p_chances))<>5 then return false;end if;
 for v_key,v_value in select key,value from jsonb_each(p_chances) loop
  if v_key not in ('cup','keychain','pen','none','retry') or jsonb_typeof(v_value)<>'number' then return false;end if;
  v_number:=v_value::text::numeric;
  if v_number<0 or v_number>100 or v_number*100<>trunc(v_number*100) then return false;end if;
  v_total:=v_total+v_number;
 end loop;
 return v_total=100 and (p_chances->>'retry')::numeric<100;
end;$$;
revoke all on function public.pulsik_valid_chances(jsonb) from public,anon,authenticated;
grant execute on function public.pulsik_valid_chances(jsonb) to service_role;

alter table public.pulsik_campaigns
 add column chances jsonb not null default '{"cup":4,"keychain":23,"pen":23,"none":20,"retry":30}'::jsonb,
 add constraint pulsik_campaign_chances_valid check(public.pulsik_valid_chances(chances));

-- The API derives p_user from the NextAuth admin session. Only service_role may call.
-- Lock the same campaign row as spin/stock/reset before changing its distribution.
create function public.pulsik_admin_chances(p_user uuid,p_campaign text,p_chances jsonb,p_expected jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_previous jsonb;
begin
 if not exists(select 1 from public.pulsik_users where id=p_user and is_admin) then raise exception 'admin_required';end if;
 if p_campaign is null or p_campaign not in ('siara-2026','siara-2026-test') then raise exception 'invalid_request';end if;
 if not public.pulsik_valid_chances(p_chances) or not public.pulsik_valid_chances(p_expected) then raise exception 'invalid_chances';end if;
 select chances into v_previous from public.pulsik_campaigns where id=p_campaign for update;
 if not found then raise exception 'campaign_closed';end if;
 if v_previous is distinct from p_expected then raise exception 'chances_changed';end if;
 update public.pulsik_campaigns set chances=p_chances where id=p_campaign;
 insert into public.pulsik_admin_events(actor_id,campaign_id,action,details)
 values(p_user,p_campaign,'chances',jsonb_build_object('before',v_previous,'after',p_chances));
end;$$;
revoke all on function public.pulsik_admin_chances(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pulsik_admin_chances(uuid,text,jsonb,jsonb) to service_role;

create or replace function public.pulsik_spin_v2(p_user uuid,p_campaign text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_p public.pulsik_participants;v_s public.pulsik_spins;v_c public.pulsik_campaigns;
 v_roll numeric;v_outcome text;v_code text;v_attempt integer;
 v_id text;v_total numeric:=0;
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
 v_roll:=public.pulsik_draw();
 foreach v_id in array array['cup','keychain','pen','none','retry'] loop
  v_total:=v_total+(v_c.chances->>v_id)::numeric;
  if v_roll<v_total then v_outcome:=v_id;exit;end if;
 end loop;
 if v_outcome in ('cup','keychain','pen') then
  update public.pulsik_prizes set remaining=remaining-1 where campaign_id=p_campaign and id=v_outcome and remaining>0;
  if not found then v_outcome:='none';else
   for v_attempt in 1..100 loop
    v_code:=public.pulsik_new_claim_code(p_campaign);
    exit when not exists(select 1 from public.pulsik_participants where claim_code=v_code);
    if v_attempt=100 then raise exception 'claim_code_unavailable';end if;
   end loop;
  end if;
 end if;
 insert into public.pulsik_spins(participant_id,request_id,outcome,claim_code)
 values(v_p.id,p_request,v_outcome,v_code) returning * into v_s;
 if v_outcome<>'retry' then update public.pulsik_participants set status='complete',outcome=v_outcome,claim_code=v_code where id=v_p.id;end if;
 return to_jsonb(v_s);
end;$$;
revoke all on function public.pulsik_spin_v2(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.pulsik_spin_v2(uuid,text,uuid) to service_role;
commit;
