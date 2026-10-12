alter table public.dose_logs add column revision integer not null default 0;
alter table public.dose_logs drop constraint dose_logs_status_check;
alter table public.dose_logs add constraint dose_logs_status_check check (status in ('completed','skipped','missed','voided'));
create table public.dose_log_revisions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 dose_log_id uuid not null references public.dose_logs(id) on delete cascade,
 before_record jsonb not null, after_record jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.dose_log_revisions enable row level security;
create policy revisions_read_own on public.dose_log_revisions for select to authenticated using ((select auth.uid())=user_id and (select pulse_private.email_is_confirmed()));
grant select on public.dose_log_revisions to authenticated;
create index dose_log_revisions_owner_log_idx on public.dose_log_revisions(user_id,dose_log_id,created_at);
-- Privileged trigger only appends audit records; it cannot be called through the API.
create function pulse_private.audit_dose_log_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.revision := old.revision + 1;
 insert into public.dose_log_revisions(user_id,dose_log_id,before_record,after_record)
 values(old.user_id,old.id,to_jsonb(old),to_jsonb(new));
 return new;
end $$;
revoke all on function pulse_private.audit_dose_log_revision() from public,anon,authenticated;
create trigger audit_dose_log_revision before update on public.dose_logs for each row execute function pulse_private.audit_dose_log_revision();

create function public.correct_dose_log(p_log_id uuid,p_revision integer,p_amount numeric,p_logged_at timestamptz,p_site text,p_status text)
returns public.dose_logs language plpgsql security invoker set search_path='' as $$
declare v_log public.dose_logs; v_stock public.inventory_containers; v_delta numeric;
begin
 if auth.uid() is null or not pulse_private.email_is_confirmed() then raise exception 'Verified account required' using errcode='42501'; end if;
 select * into v_log from public.dose_logs where id=p_log_id and user_id=auth.uid() for update;
 if not found then raise exception 'Log not found'; end if;
 if p_revision is distinct from v_log.revision then raise exception 'This entry changed. Reload your history before editing.'; end if;
 if v_log.status='voided' then raise exception 'This entry has already been undone'; end if;
 if p_status is null or p_status not in ('completed','skipped','voided') then raise exception 'Invalid log status'; end if;
 if p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a finite positive amount'; end if;
 if p_logged_at is null or not isfinite(p_logged_at) or p_logged_at>now()+interval '1 minute' then raise exception 'Log time cannot be in the future'; end if;
 if length(coalesce(p_site,''))>100 then raise exception 'Site is too long'; end if;
 -- Unit/container identity stays fixed so a correction cannot move stock between units.
 v_delta := (case when v_log.status='completed' then v_log.amount else 0 end) - (case when p_status='completed' then p_amount else 0 end);
 if v_log.inventory_container_id is not null and v_delta<>0 then
  select * into v_stock from public.inventory_containers where id=v_log.inventory_container_id and user_id=auth.uid() and protocol_item_id=v_log.protocol_item_id for update;
  if not found then raise exception 'Original inventory container not found'; end if;
  if lower(v_stock.unit)<>lower(v_log.unit) then raise exception 'Original inventory unit has changed'; end if;
  if v_stock.remaining_amount+v_delta<0 then raise exception 'Not enough inventory for this correction'; end if;
  if v_stock.remaining_amount+v_delta>v_stock.total_amount then raise exception 'Correction would exceed container capacity. Review inventory corrections first.'; end if;
  update public.inventory_containers set remaining_amount=remaining_amount+v_delta,updated_at=now() where id=v_stock.id;
 end if;
 update public.dose_logs set amount=p_amount,logged_at=p_logged_at,site=nullif(trim(p_site),''),status=p_status where id=v_log.id returning * into v_log;
 return v_log;
end $$;
revoke all on function public.correct_dose_log(uuid,integer,numeric,timestamptz,text,text) from public,anon;
grant execute on function public.correct_dose_log(uuid,integer,numeric,timestamptz,text,text) to authenticated;

create function public.skip_dose(p_item_id uuid,p_client_event_id uuid) returns public.dose_logs
language plpgsql security invoker set search_path='' as $$
declare v_item public.protocol_items; v_log public.dose_logs;
begin
 if auth.uid() is null or not pulse_private.email_is_confirmed() then raise exception 'Verified account required' using errcode='42501'; end if;
 if p_client_event_id is null then raise exception 'Unique event identifier required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_client_event_id::text,0));
 select * into v_log from public.dose_logs where user_id=auth.uid() and client_event_id=p_client_event_id;
 if found then
  if v_log.protocol_item_id is distinct from p_item_id or v_log.status<>'skipped' then raise exception 'Conflicting event identifier'; end if;
  return v_log;
 end if;
 select * into v_item from public.protocol_items where id=p_item_id and user_id=auth.uid() and active=true and archived_at is null;
 if not found then raise exception 'Active item not found'; end if;
 insert into public.dose_logs(user_id,protocol_item_id,amount,unit,route,status,client_event_id)
 values(auth.uid(),v_item.id,v_item.dose_amount,v_item.dose_unit,v_item.route,'skipped',p_client_event_id) returning * into v_log;
 return v_log;
end $$;
revoke all on function public.skip_dose(uuid,uuid) from public,anon;
grant execute on function public.skip_dose(uuid,uuid) to authenticated;
