begin;

-- Only the server can use guest sessions. Raw secrets stay in HttpOnly cookies.
create table public.pulsik_guest_sessions (
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  campaign_id text not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '8 hours',
  primary key (token_hash, campaign_id),
  foreign key (campaign_id, user_id)
    references public.pulsik_participants(campaign_id, user_id) on delete cascade,
  check (expires_at > created_at)
);
create index pulsik_guest_sessions_participant
  on public.pulsik_guest_sessions(campaign_id, user_id);
alter table public.pulsik_guest_sessions enable row level security;
revoke all on public.pulsik_guest_sessions from public, anon, authenticated;
grant select, insert, delete on public.pulsik_guest_sessions to service_role;

create function public.pulsik_register_guest(
  p_token_hash text, p_campaign text, p_email text, p_name text,
  p_company text, p_job_title text, p_phone text, p_marketing boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_phone text;
  v_user uuid;
  v_campaign public.pulsik_campaigns;
  v_session public.pulsik_guest_sessions;
  v_participant public.pulsik_participants;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_request';
  end if;
  if v_email is null or char_length(v_email) > 254
    or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'invalid_email';
  end if;
  -- Same lock order as registration, spin and test reset; no external I/O here.
  select * into v_campaign from public.pulsik_campaigns where id = p_campaign for update;
  if not found then raise exception 'campaign_closed'; end if;

  select * into v_session from public.pulsik_guest_sessions
    where token_hash = p_token_hash and campaign_id = p_campaign;
  if found then
    if v_session.expires_at <= now() then raise exception 'unauthorized'; end if;
    if not exists (select 1 from public.pulsik_users where id = v_session.user_id
      and email = v_email and not email_verified and not is_admin) then
      raise exception 'duplicate_email';
    end if;
    select * into v_participant from public.pulsik_participants
      where campaign_id = p_campaign and user_id = v_session.user_id;
    return to_jsonb(v_participant);
  end if;

  if not v_campaign.active or now() < v_campaign.starts_at or now() >= v_campaign.ends_at then
    raise exception 'campaign_closed';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 120
    or p_company is null or char_length(trim(p_company)) not between 2 and 160
    or p_job_title is null or char_length(trim(p_job_title)) not between 2 and 120 then
    raise exception 'invalid_fields';
  end if;
  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if v_phone !~ '^[0-9]{11}$' then raise exception 'invalid_phone'; end if;

  -- Unique email is the arbiter even if another guest or verified login races us.
  -- Never attach an unauthenticated visitor to an existing account.
  insert into public.pulsik_users(email, name, email_verified)
    values (v_email, trim(p_name), false)
    on conflict (email) do nothing returning id into v_user;
  if v_user is null then raise exception 'duplicate_email'; end if;

  insert into public.pulsik_participants(campaign_id, user_id, email, name, company, job_title, phone, marketing)
    values (p_campaign, v_user, v_email, trim(p_name), trim(p_company), trim(p_job_title), v_phone, coalesce(p_marketing, false))
    returning * into v_participant;
  insert into public.pulsik_guest_sessions(token_hash, campaign_id, user_id)
    values (p_token_hash, p_campaign, v_user);
  return to_jsonb(v_participant);
end;
$$;
revoke all on function public.pulsik_register_guest(text,text,text,text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.pulsik_register_guest(text,text,text,text,text,text,text,boolean) to service_role;

commit;
