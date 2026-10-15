-- Admin endpoints expose aggregates and volunteered feedback only. Membership is
-- provisioned by the operator in a private table, never user-editable metadata.
create table pulse_private.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table pulse_private.metric_exclusions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (reason in ('owner','demo','test'))
);
create table pulse_private.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  feedback_id uuid,
  previous_status text,
  next_status text,
  created_at timestamptz not null default now()
);
create index admin_audit_actor on pulse_private.admin_audit(actor_id);
alter table pulse_private.admin_accounts enable row level security;
alter table pulse_private.metric_exclusions enable row level security;
alter table pulse_private.admin_audit enable row level security;
revoke all on pulse_private.admin_accounts, pulse_private.metric_exclusions, pulse_private.admin_audit from public, anon, authenticated;

create table public.feedback_submissions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('problem','suggestion','update')),
  message text not null check (char_length(message) between 10 and 2000),
  app_version text not null check (char_length(app_version) between 1 and 32),
  build_number text not null check (char_length(build_number) between 1 and 32),
  platform text not null check (platform in ('ios','android','web')),
  allow_contact boolean not null default false,
  contact_email text,
  status text not null default 'received' check (status in ('received','reviewing','planned','shipped','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_contact_consent check (
    (allow_contact and contact_email is not null) or
    (not allow_contact and contact_email is null)
  )
);
create index feedback_owner_date on public.feedback_submissions(user_id,created_at desc,id desc);
create index feedback_status_date on public.feedback_submissions(status,created_at desc,id desc);
alter table public.feedback_submissions enable row level security;
revoke all on public.feedback_submissions from public,anon,authenticated;
grant select on public.feedback_submissions to authenticated;
create policy feedback_read_own on public.feedback_submissions for select to authenticated
  using (user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed()));

-- Revoked sessions and removed memberships stop admin access even while a JWT
-- has time remaining. TOTP must also remain verified after an aal2 login.
create function pulse_private.admin_member() returns boolean
language sql stable security definer set search_path='' as $$
 select exists (
   select 1 from pulse_private.admin_accounts a
   join auth.users u on u.id=a.user_id
   join auth.sessions s on s.user_id=u.id
   where a.user_id=(select auth.uid()) and u.email_confirmed_at is not null
     and s.id::text=(select auth.jwt()->>'session_id')
     and (s.not_after is null or s.not_after>now())
 );
$$;
create function pulse_private.admin_authorized() returns boolean
language sql stable security definer set search_path='' as $$
 select pulse_private.admin_member()
   and coalesce((select auth.jwt()->>'aal')='aal2',false)
   and exists(select 1 from auth.mfa_factors f where f.user_id=(select auth.uid()) and f.status='verified' and f.factor_type='totp');
$$;
create function public.pulse_admin_access() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('member',pulse_private.admin_member(),'authorized',pulse_private.admin_authorized());
$$;

create function pulse_private.submit_feedback(
 p_id uuid,p_owner_id uuid,p_category text,p_message text,
 p_app_version text,p_build_number text,p_platform text,p_allow_contact boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 owner_id uuid := auth.uid();
 verified_email text;
 existing public.feedback_submissions%rowtype;
 cleaned text := btrim(p_message);
begin
 if owner_id is null or owner_id is distinct from p_owner_id then raise exception 'FEEDBACK_ACCOUNT_CHANGED' using errcode='42501'; end if;
 select u.email into verified_email from auth.users u where u.id=owner_id and u.email_confirmed_at is not null;
 if verified_email is null then raise exception 'FEEDBACK_SIGN_IN_REQUIRED' using errcode='42501'; end if;
 if p_id is null or p_category is null or p_category not in ('problem','suggestion','update')
   or cleaned is null or char_length(cleaned) not between 10 and 2000
   or p_app_version is null or char_length(p_app_version) not between 1 and 32
   or p_build_number is null or char_length(p_build_number) not between 1 and 32
   or p_platform is null or p_platform not in ('ios','android','web')
   or p_allow_contact is null then raise exception 'FEEDBACK_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,1729));
 select * into existing from public.feedback_submissions where id=p_id;
 if found then
   if existing.user_id is distinct from owner_id then raise exception 'FEEDBACK_CONFLICT' using errcode='42501'; end if;
   if existing.category is distinct from p_category or existing.message is distinct from cleaned
     or existing.app_version is distinct from p_app_version or existing.build_number is distinct from p_build_number
     or existing.platform is distinct from p_platform or existing.allow_contact is distinct from p_allow_contact
     then raise exception 'FEEDBACK_RETRY_MISMATCH'; end if;
   return jsonb_build_object('id',existing.id,'status',existing.status);
 end if;
 if (select count(*) from public.feedback_submissions where user_id=owner_id and created_at>now()-interval '1 hour')>=5
   or (select count(*) from public.feedback_submissions where user_id=owner_id and created_at>now()-interval '1 day')>=10
   then raise exception 'FEEDBACK_RATE_LIMIT'; end if;
 insert into public.feedback_submissions(id,user_id,category,message,app_version,build_number,platform,allow_contact,contact_email)
 values(p_id,owner_id,p_category,cleaned,p_app_version,p_build_number,p_platform,p_allow_contact,
        case when p_allow_contact then verified_email else null end);
 return jsonb_build_object('id',p_id,'status','received');
end;
$$;
create function public.pulse_submit_feedback(
 p_id uuid,p_owner_id uuid,p_category text,p_message text,
 p_app_version text,p_build_number text,p_platform text,p_allow_contact boolean
) returns jsonb language sql security invoker set search_path='' as $$
 select pulse_private.submit_feedback(p_id,p_owner_id,p_category,p_message,p_app_version,p_build_number,p_platform,p_allow_contact);
$$;

create function pulse_private.admin_overview() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not pulse_private.admin_authorized() then raise exception 'ADMIN_VERIFICATION_REQUIRED' using errcode='42501'; end if;
 with counted as (
   select u.created_at,u.email_confirmed_at from auth.users u
   where not exists(select 1 from pulse_private.admin_accounts a where a.user_id=u.id)
     and not exists(select 1 from pulse_private.metric_exclusions e where e.user_id=u.id)
 ), days as (
   select d::date as day from generate_series((now() at time zone 'UTC')::date-29,(now() at time zone 'UTC')::date,interval '1 day') d
 ), daily as (
   select d.day,count(c.created_at) as signups from days d left join counted c
     on (c.created_at at time zone 'UTC')::date=d.day and c.email_confirmed_at is not null group by d.day
 )
 select jsonb_build_object(
   'registered_users',(select count(*) from counted),
   'verified_users',(select count(*) from counted where email_confirmed_at is not null),
   'pending_confirmation',(select count(*) from counted where email_confirmed_at is null),
   'new_verified_7_days',(select count(*) from counted where email_confirmed_at is not null and created_at>=(((now() at time zone 'UTC')::date-6)::timestamp at time zone 'UTC')),
   'new_verified_30_days',(select count(*) from counted where email_confirmed_at is not null and created_at>=(((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC')),
   'open_feedback',(select count(*) from public.feedback_submissions where status in ('received','reviewing','planned')),
   'received_feedback',(select count(*) from public.feedback_submissions where status='received'),
   'signup_days',(select jsonb_agg(jsonb_build_object('day',day,'count',signups) order by day) from daily),
   'generated_at',now()
 ) into result;
 return result;
end;
$$;
create function public.pulse_admin_overview() returns jsonb
language sql security invoker set search_path='' as $$ select pulse_private.admin_overview(); $$;

create function pulse_private.admin_feedback(p_status text,p_before_date timestamptz,p_before_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not pulse_private.admin_authorized() then raise exception 'ADMIN_VERIFICATION_REQUIRED' using errcode='42501'; end if;
 if p_status is not null and p_status not in ('received','reviewing','planned','shipped','closed') then raise exception 'FEEDBACK_INVALID'; end if;
 if (p_before_date is null)<>(p_before_id is null) then raise exception 'FEEDBACK_INVALID'; end if;
 select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id desc),'[]'::jsonb) into result from (
   select id,category,message,app_version,build_number,platform,status,created_at,updated_at,contact_email
   from public.feedback_submissions
   where (p_status is null or status=p_status)
     and (p_before_date is null or (created_at,id)<(p_before_date,p_before_id))
   order by created_at desc,id desc limit 51
 ) page;
 return result;
end;
$$;
create function public.pulse_admin_feedback(p_status text default null,p_before_date timestamptz default null,p_before_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select pulse_private.admin_feedback(p_status,p_before_date,p_before_id); $$;

create function pulse_private.admin_set_feedback_status(p_id uuid,p_status text,p_expected_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous text;
begin
 if not pulse_private.admin_authorized() then raise exception 'ADMIN_VERIFICATION_REQUIRED' using errcode='42501'; end if;
 if p_status is null or p_status not in ('received','reviewing','planned','shipped','closed') then raise exception 'FEEDBACK_INVALID'; end if;
 select status into previous from public.feedback_submissions where id=p_id for update;
 if not found then raise exception 'FEEDBACK_NOT_FOUND'; end if;
 if previous=p_status then return jsonb_build_object('id',p_id,'status',previous); end if;
 if previous is distinct from p_expected_status then raise exception 'FEEDBACK_STATUS_CHANGED'; end if;
 update public.feedback_submissions set status=p_status,updated_at=now() where id=p_id;
 insert into pulse_private.admin_audit(actor_id,feedback_id,previous_status,next_status) values(auth.uid(),p_id,previous,p_status);
 return jsonb_build_object('id',p_id,'status',p_status);
end;
$$;
create function public.pulse_admin_set_feedback_status(p_id uuid,p_status text,p_expected_status text)
returns jsonb language sql security invoker set search_path='' as $$ select pulse_private.admin_set_feedback_status(p_id,p_status,p_expected_status); $$;

-- Every privileged implementation is private, fixed-search-path and gated.
-- Exposed wrappers use invoker rights; clients cannot modify the allowlist.
revoke all on function pulse_private.admin_member(),pulse_private.admin_authorized(),pulse_private.admin_overview(),pulse_private.admin_feedback(text,timestamptz,uuid),pulse_private.admin_set_feedback_status(uuid,text,text),pulse_private.submit_feedback(uuid,uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function pulse_private.admin_member(),pulse_private.admin_authorized(),pulse_private.admin_overview(),pulse_private.admin_feedback(text,timestamptz,uuid),pulse_private.admin_set_feedback_status(uuid,text,text),pulse_private.submit_feedback(uuid,uuid,text,text,text,text,text,boolean) to authenticated;
revoke all on function public.pulse_admin_access(),public.pulse_admin_overview(),public.pulse_admin_feedback(text,timestamptz,uuid),public.pulse_admin_set_feedback_status(uuid,text,text),public.pulse_submit_feedback(uuid,uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.pulse_admin_access(),public.pulse_admin_overview(),public.pulse_admin_feedback(text,timestamptz,uuid),public.pulse_admin_set_feedback_status(uuid,text,text),public.pulse_submit_feedback(uuid,uuid,text,text,text,text,text,boolean) to authenticated;
