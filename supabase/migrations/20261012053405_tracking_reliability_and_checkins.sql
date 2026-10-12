-- Tracking reliability, immutable history and owner-only daily check-ins.
alter table public.dose_logs add column snapshot jsonb;
alter table public.dose_logs add column occurrence_key text;
alter table public.dose_logs add column local_date date;
alter table public.dose_logs add column time_zone text;
create unique index dose_logs_one_resolved_occurrence on public.dose_logs(user_id,protocol_item_id,occurrence_key)
where occurrence_key is not null and status in ('completed','skipped');

create table public.protocol_item_versions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 protocol_item_id uuid not null references public.protocol_items(id) on delete cascade,
 version_order bigint generated always as identity,
 effective_at timestamptz not null default now(),
 snapshot jsonb not null
);
alter table public.protocol_item_versions enable row level security;
create policy versions_read_own on public.protocol_item_versions for select to authenticated
using (user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed()));
grant select on public.protocol_item_versions to authenticated;
create index item_versions_owner_time on public.protocol_item_versions(user_id,protocol_item_id,effective_at desc,id);

create function pulse_private.item_snapshot(p_item public.protocol_items) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('itemName',p_item.name,'protocolId',p_item.protocol_id,'protocolName',p.name,
 'doseAmount',p_item.dose_amount,'doseUnit',p_item.dose_unit,'route',p_item.route,'category',p_item.category,
 'schedule',p_item.schedule,'active',p_item.active,'archivedAt',p_item.archived_at,
 'protocolStatus',p.status,'startsOn',p.starts_on,'endsOn',p.ends_on)
 from public.protocols p where p.id=p_item.protocol_id and p.user_id=p_item.user_id;
$$;
revoke all on function pulse_private.item_snapshot(public.protocol_items) from public,anon;
grant execute on function pulse_private.item_snapshot(public.protocol_items) to authenticated;
create function pulse_private.capture_item_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or row(new.name,new.category,new.route,new.dose_amount,new.dose_unit,new.schedule,new.active,new.archived_at,new.protocol_id)
 is distinct from row(old.name,old.category,old.route,old.dose_amount,old.dose_unit,old.schedule,old.active,old.archived_at,old.protocol_id) then
 insert into public.protocol_item_versions(user_id,protocol_item_id,snapshot) values(new.user_id,new.id,pulse_private.item_snapshot(new));
 end if;
 return new;
end $$;
revoke all on function pulse_private.capture_item_version() from public,anon,authenticated;
create trigger capture_item_version after insert or update on public.protocol_items for each row execute function pulse_private.capture_item_version();
create function pulse_private.capture_protocol_versions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if row(new.name,new.status,new.starts_on,new.ends_on) is distinct from row(old.name,old.status,old.starts_on,old.ends_on) then
 insert into public.protocol_item_versions(user_id,protocol_item_id,snapshot)
 select i.user_id,i.id,pulse_private.item_snapshot(i) from public.protocol_items i where i.protocol_id=new.id and i.user_id=new.user_id;
 end if;
 return new;
end $$;
revoke all on function pulse_private.capture_protocol_versions() from public,anon,authenticated;
create trigger capture_protocol_versions after update on public.protocols for each row execute function pulse_private.capture_protocol_versions();
-- Baselines begin at installation. Older schedules cannot be reconstructed honestly.
insert into public.protocol_item_versions(user_id,protocol_item_id,snapshot)
select i.user_id,i.id,pulse_private.item_snapshot(i) || '{"baseline":true}'::jsonb from public.protocol_items i;

create function pulse_private.freeze_log_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare v_item public.protocol_items; v_snapshot jsonb;
begin
 if tg_op='UPDATE' then
 new.snapshot:=old.snapshot; new.occurrence_key:=old.occurrence_key; new.time_zone:=old.time_zone;
 -- A deliberate date correction changes the record's day, retaining its original scheduled occurrence.
 if new.logged_at is distinct from old.logged_at then new.local_date:=(new.logged_at at time zone coalesce(old.time_zone,'UTC'))::date; end if;
 return new;
 end if;
 select snapshot into v_snapshot from public.protocol_item_versions where protocol_item_id=new.protocol_item_id and user_id=new.user_id and effective_at<=new.logged_at order by effective_at desc,version_order desc limit 1;
 if v_snapshot is null then
 select * into v_item from public.protocol_items where id=new.protocol_item_id and user_id=new.user_id;
 v_snapshot:=pulse_private.item_snapshot(v_item) || '{"historicalDetailsUnavailable":true}'::jsonb;
 end if;
 new.snapshot:=v_snapshot;
 return new;
end $$;
revoke all on function pulse_private.freeze_log_snapshot() from public,anon,authenticated;
create trigger aa_freeze_log_snapshot before insert or update on public.dose_logs for each row execute function pulse_private.freeze_log_snapshot();

create table public.tracking_event_cancellations(
 user_id uuid not null references auth.users(id) on delete cascade,event_id uuid not null,created_at timestamptz not null default now(),primary key(user_id,event_id)
);
alter table public.tracking_event_cancellations enable row level security;
create policy cancellations_read on public.tracking_event_cancellations for select to authenticated using(user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed()));
create policy cancellations_insert on public.tracking_event_cancellations for insert to authenticated with check(user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed()));
grant select,insert on public.tracking_event_cancellations to authenticated;
create function public.undo_tracking_event(p_event_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_log public.dose_logs;
begin
 if auth.uid() is null or not pulse_private.email_is_confirmed() then raise exception 'Verified account required' using errcode='42501'; end if;
 if p_event_id is null then raise exception 'Event identifier required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_event_id::text,0));
 select * into v_log from public.dose_logs where user_id=auth.uid() and client_event_id=p_event_id for update;
 if found and v_log.status<>'voided' then perform public.correct_dose_log(v_log.id,v_log.revision,v_log.amount,v_log.logged_at,v_log.site,'voided'); end if;
 insert into public.tracking_event_cancellations(user_id,event_id) values(auth.uid(),p_event_id) on conflict do nothing;
 return true;
end $$;
revoke all on function public.undo_tracking_event(uuid) from public,anon;
grant execute on function public.undo_tracking_event(uuid) to authenticated;

create function public.record_tracking_event(
 p_item_id uuid,p_event_id uuid,p_amount numeric,p_unit text,p_route text,p_site text,
 p_container_id uuid,p_logged_at timestamptz,p_scheduled_for timestamptz,p_occurrence_key text,p_local_date date,p_time_zone text,p_status text
) returns public.dose_logs language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=auth.uid(); v_log public.dose_logs; v_item public.protocol_items; v_stock public.inventory_containers;
begin
 if v_user is null or not pulse_private.email_is_confirmed() then raise exception 'Verified account required' using errcode='42501'; end if;
 if p_event_id is null then raise exception 'Event identifier required'; end if;
 if p_amount is null or p_amount<=0 or p_amount>1000000000 or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid amount'; end if;
 if p_unit is null or length(trim(p_unit)) not between 1 and 30 or length(coalesce(p_site,''))>100 then raise exception 'Invalid record details'; end if;
 if p_status is null or p_status not in ('completed','skipped') then raise exception 'Invalid status'; end if;
 if p_logged_at is null or not isfinite(p_logged_at) or p_logged_at>now()+interval '1 minute' then raise exception 'Record time cannot be in the future'; end if;
 if p_time_zone is null or not exists(select 1 from pg_timezone_names where name=p_time_zone) then raise exception 'Invalid time zone'; end if;
 if p_local_date is null or p_local_date<>(coalesce(p_scheduled_for,p_logged_at) at time zone p_time_zone)::date then raise exception 'Record date does not match time zone'; end if;
 if p_occurrence_key is not null and (length(p_occurrence_key)>100 or p_occurrence_key not like p_item_id::text || ':' || p_local_date::text || ':%') then raise exception 'Invalid scheduled entry identifier'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text||':'||p_event_id::text,0));
 if exists(select 1 from public.tracking_event_cancellations where user_id=v_user and event_id=p_event_id) then return null; end if;
 select * into v_log from public.dose_logs where user_id=v_user and client_event_id=p_event_id;
 if found then
 if v_log.protocol_item_id is distinct from p_item_id or v_log.amount is distinct from p_amount or v_log.unit is distinct from p_unit or v_log.inventory_container_id is distinct from p_container_id or v_log.occurrence_key is distinct from p_occurrence_key then raise exception 'Event identifier conflicts with another record'; end if;
 return v_log;
 end if;
 select * into v_item from public.protocol_items where id=p_item_id and user_id=v_user for update;
 if not found then raise exception 'Substance not found'; end if;
 -- Owned archived/paused items can receive a previously recorded offline event.
 if p_logged_at>=now()-interval '1 minute' and (v_item.active=false or v_item.archived_at is not null) then raise exception 'Substance is paused or archived'; end if;
 if p_occurrence_key is not null then
 perform pg_advisory_xact_lock(hashtextextended(v_user::text||':'||p_occurrence_key,0));
 if exists(select 1 from public.dose_logs where user_id=v_user and protocol_item_id=p_item_id and occurrence_key=p_occurrence_key and status in ('completed','skipped')) then raise exception 'This scheduled entry is already recorded. Refresh Today.'; end if;
 end if;
 if p_status='skipped' and p_container_id is not null then raise exception 'Skipped entries cannot use inventory'; end if;
 if p_container_id is not null then
 select * into v_stock from public.inventory_containers where id=p_container_id and user_id=v_user and protocol_item_id=p_item_id for update;
 if not found or not v_stock.is_active then raise exception 'Original inventory container is unavailable. Review this pending entry.'; end if;
 if v_stock.unit<>p_unit then raise exception 'Inventory unit does not match'; end if;
 if (v_stock.expires_at is not null and v_stock.expires_at<=p_logged_at) or (v_stock.user_use_by_at is not null and v_stock.user_use_by_at<=p_logged_at) then raise exception 'Container date has passed. Review inventory.'; end if;
 if v_stock.remaining_amount<p_amount then raise exception 'Not enough inventory. Review this pending entry.'; end if;
 update public.inventory_containers set remaining_amount=remaining_amount-p_amount,updated_at=now() where id=v_stock.id;
 end if;
 insert into public.dose_logs(user_id,protocol_item_id,inventory_container_id,amount,unit,route,site,status,logged_at,scheduled_for,client_event_id,occurrence_key,local_date,time_zone)
 values(v_user,p_item_id,p_container_id,p_amount,p_unit,p_route,p_site,p_status,p_logged_at,p_scheduled_for,p_event_id,p_occurrence_key,p_local_date,p_time_zone) returning * into v_log;
 return v_log;
end $$;
revoke all on function public.record_tracking_event(uuid,uuid,numeric,text,text,text,uuid,timestamptz,timestamptz,text,date,text,text) from public,anon;
grant execute on function public.record_tracking_event(uuid,uuid,numeric,text,text,text,uuid,timestamptz,timestamptz,text,date,text,text) to authenticated;

create function public.duplicate_protocol(p_source_id uuid,p_name text,p_start date,p_end date) returns public.protocols
language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=auth.uid(); v_protocol public.protocols; v_source public.protocols;
begin
 if v_user is null or not pulse_private.email_is_confirmed() then raise exception 'Verified account required' using errcode='42501'; end if;
 if length(trim(p_name)) not between 1 and 100 or p_start is null or (p_end is not null and p_end<p_start) then raise exception 'Check protocol name and dates'; end if;
 select * into v_source from public.protocols where id=p_source_id and user_id=v_user for share;
 if not found then raise exception 'Protocol not found'; end if;
 insert into public.protocols(user_id,name,status,starts_on,ends_on) values(v_user,trim(p_name),'paused',p_start,p_end) returning * into v_protocol;
 insert into public.protocol_items(user_id,protocol_id,name,category,route,form,dose_amount,dose_unit,schedule,active,site_rotation_enabled)
 select v_user,v_protocol.id,name,category,route,form,dose_amount,dose_unit,
 case when schedule->>'type' in ('interval','cycle') then jsonb_set(schedule-'temporary','{startDate}',to_jsonb(p_start::text)) else schedule-'temporary' end,
 active,site_rotation_enabled from public.protocol_items where protocol_id=p_source_id and user_id=v_user and archived_at is null;
 return v_protocol;
end $$;
revoke all on function public.duplicate_protocol(uuid,text,date,date) from public,anon;
grant execute on function public.duplicate_protocol(uuid,text,date,date) to authenticated;

create table public.daily_checkins (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 local_date date not null,sleep numeric check(sleep between 0 and 24),energy integer check(energy between 1 and 5),mood integer check(mood between 1 and 5),
 notes text check(length(notes)<=2000),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,local_date)
);
alter table public.daily_checkins enable row level security;
create policy checkins_select on public.daily_checkins for select to authenticated using(user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed()));
create policy checkins_insert on public.daily_checkins for insert to authenticated with check(user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed()));
create policy checkins_update on public.daily_checkins for update to authenticated using(user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed())) with check(user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed()));
create policy checkins_delete on public.daily_checkins for delete to authenticated using(user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed()));
grant select,insert,update,delete on public.daily_checkins to authenticated;
create index checkins_owner_date on public.daily_checkins(user_id,local_date desc);

create function public.get_schedule_versions(p_from timestamptz) returns setof public.protocol_item_versions
language sql stable security invoker set search_path='' as $$
 select v.* from public.protocol_item_versions v where v.user_id=(select auth.uid()) and (select pulse_private.email_is_confirmed())
 and (v.effective_at>=p_from or v.id in (
 select distinct on (protocol_item_id) id from public.protocol_item_versions where user_id=(select auth.uid()) and effective_at<p_from
 order by protocol_item_id,effective_at desc,version_order desc)) order by v.effective_at,v.version_order;
$$;
revoke all on function public.get_schedule_versions(timestamptz) from public,anon;
grant execute on function public.get_schedule_versions(timestamptz) to authenticated;

notify pgrst, 'reload schema';
