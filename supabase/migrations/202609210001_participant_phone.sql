-- Apply after 202609170002_email_login.sql. Preserve historical records.
begin;
alter table public.pulsik_participants add column phone text;
alter table public.pulsik_participants add constraint pulsik_phone_format check(phone is null or phone ~ '^[0-9]{11}$');
alter table public.pulsik_participants alter column city drop not null;
alter table public.pulsik_participants alter column state drop not null;
drop function public.pulsik_register(text,text,text,text,text,text,boolean);
create function public.pulsik_register(p_campaign text,p_name text,p_company text,p_job_title text,p_phone text,p_marketing boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_email text; v_phone text; v_p public.pulsik_participants; v_c public.pulsik_campaigns;
begin
 if v_user is null then raise exception 'verified_email_required';end if;
 select lower(trim(u.email)) into v_email from auth.users u where u.id=v_user and u.email_confirmed_at is not null and nullif(trim(u.email),'') is not null
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider in ('google','email'));
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
revoke all on function public.pulsik_register(text,text,text,text,text,boolean) from public,anon;
grant execute on function public.pulsik_register(text,text,text,text,text,boolean) to authenticated;
commit;
