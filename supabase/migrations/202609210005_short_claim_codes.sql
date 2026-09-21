-- Apply after 202609210004_prize_chances.sql. Existing claim codes remain valid.
-- 5 symbols from a 32-character alphabet: avoids I/O/0/1 ambiguity.
begin;
create or replace function public.pulsik_new_claim_code(p_campaign text)
returns text language plpgsql volatile set search_path='' as $$
declare
 v_alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 v_random bigint:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint;
 v_suffix text:='';i integer;
begin
 if p_campaign is null or p_campaign not in ('siara-2026','siara-2026-test') then raise exception 'invalid_request';end if;
 -- The first 32 UUID bits are random; base 32 gives five unbiased symbols.
 for i in 1..5 loop
  v_suffix:=v_suffix||substr(v_alphabet,(v_random%32)::integer+1,1);
  v_random:=v_random/32;
 end loop;
 return (case when p_campaign='siara-2026-test' then 'TST-' else 'PLS-' end)||v_suffix;
end;$$;
revoke all on function public.pulsik_new_claim_code(text) from public,anon,authenticated;
grant execute on function public.pulsik_new_claim_code(text) to service_role;

-- Campaign lock, collision check and unique constraint prevent duplicate claims.
create or replace function public.pulsik_spin_v2(p_user uuid,p_campaign text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p public.pulsik_participants;v_s public.pulsik_spins;v_c public.pulsik_campaigns;v_roll numeric;v_outcome text;v_code text;v_attempt integer;
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
 v_outcome:=case when v_roll<4 then 'cup' when v_roll<27 then 'keychain' when v_roll<50 then 'pen' when v_roll<70 then 'none' else 'retry' end;
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
 insert into public.pulsik_spins(participant_id,request_id,outcome,claim_code) values(v_p.id,p_request,v_outcome,v_code) returning * into v_s;
 if v_outcome<>'retry' then update public.pulsik_participants set status='complete',outcome=v_outcome,claim_code=v_code where id=v_p.id;end if;
 return to_jsonb(v_s);
end;$$;



revoke all on function public.pulsik_spin_v2(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.pulsik_spin_v2(uuid,text,uuid) to service_role;
commit;
