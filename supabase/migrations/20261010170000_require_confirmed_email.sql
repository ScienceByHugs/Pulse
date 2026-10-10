-- Restrict every Pulse data operation to identities with server-confirmed email.
-- Supabase Auth > Providers > Email > Confirm email must ALSO be enabled;
-- otherwise signup can automatically populate email_confirmed_at.
create schema if not exists pulse_private;
revoke all on schema pulse_private from public, anon;
grant usage on schema pulse_private to authenticated;

create or replace function pulse_private.email_is_confirmed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
  );
$$;

revoke all on function pulse_private.email_is_confirmed() from public, anon;
grant execute on function pulse_private.email_is_confirmed() to authenticated;

-- RESTRICTIVE policies combine with existing owner-only PERMISSIVE policies,
-- rather than opening a new access path with OR semantics.
create policy require_confirmed_email
on public.profiles
as restrictive
for all to authenticated
using ((select pulse_private.email_is_confirmed()))
with check ((select pulse_private.email_is_confirmed()));

create policy require_confirmed_email
on public.protocols
as restrictive
for all to authenticated
using ((select pulse_private.email_is_confirmed()))
with check ((select pulse_private.email_is_confirmed()));

create policy require_confirmed_email
on public.protocol_items
as restrictive
for all to authenticated
using ((select pulse_private.email_is_confirmed()))
with check ((select pulse_private.email_is_confirmed()));

create policy require_confirmed_email
on public.inventory_containers
as restrictive
for all to authenticated
using ((select pulse_private.email_is_confirmed()))
with check ((select pulse_private.email_is_confirmed()));

create policy require_confirmed_email
on public.dose_logs
as restrictive
for all to authenticated
using ((select pulse_private.email_is_confirmed()))
with check ((select pulse_private.email_is_confirmed()));

create policy require_confirmed_email
on public.inventory_adjustments
as restrictive
for all to authenticated
using ((select pulse_private.email_is_confirmed()))
with check ((select pulse_private.email_is_confirmed()));
