-- Apply after 202609210003_test_campaign.sql.
-- Per spin: cup 4%, keychain 23%, pen 23%, none 20%, retry 30%.
-- Applies to both campaigns. Existing results, reservations and stock are preserved.
begin;
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
 v_outcome:=case when v_roll<4 then 'cup' when v_roll<27 then 'keychain' when v_roll<50 then 'pen' when v_roll<70 then 'none' else 'retry' end;
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



revoke all on function public.pulsik_spin_v2(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.pulsik_spin_v2(uuid,text,uuid) to service_role;
commit;
