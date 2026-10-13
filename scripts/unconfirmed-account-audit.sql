-- READ ONLY. Run in Pulse's SQL Editor using the owner account immediately
-- before review/execution. Copy only the audit JSON value into a private file.
-- This SELECT never returns emails, password hashes, tokens or health records.
-- projectRef is an operator check; confirm the selected Dashboard project.
with candidates as (
  select u.id, u.created_at, u.updated_at
  from auth.users u
  where u.created_at < now() - interval '30 days'
    and u.updated_at is not null
    and nullif(u.email, '') is not null
    and nullif(u.encrypted_password, '') is not null
    and u.email_confirmed_at is null
    and u.confirmed_at is null
    and nullif(u.phone, '') is null
    and u.phone_confirmed_at is null
    and u.last_sign_in_at is null
    and not coalesce(u.is_anonymous, false)
    and not coalesce(u.is_sso_user, false)
    and u.deleted_at is null
    and u.invited_at is null
    and u.recovery_sent_at is null
    and nullif(u.email_change, '') is null
    and nullif(u.phone_change, '') is null
    and u.raw_app_meta_data->>'provider' = 'email'
    and u.raw_app_meta_data->'providers' = '["email"]'::jsonb
    and (select count(*) from auth.identities i where i.user_id = u.id) = 1
    and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
    and not exists (select 1 from auth.sessions s where s.user_id = u.id)
    and not exists (select 1 from auth.mfa_factors f where f.user_id = u.id)
    -- Storage ownership blocks Auth deletion; do not delete/reassign files here.
    and not exists (select 1 from storage.objects o where o.owner_id = u.id::text)
    -- Skip accounts with any tracking data, even if their auth history is unusual.
    and not exists (select 1 from public.protocols p where p.user_id = u.id)
    and not exists (select 1 from public.protocol_items p where p.user_id = u.id)
    and not exists (select 1 from public.inventory_containers p where p.user_id = u.id)
    and not exists (select 1 from public.dose_logs p where p.user_id = u.id)
    and not exists (select 1 from public.inventory_adjustments p where p.user_id = u.id)
    and not exists (select 1 from public.dose_log_revisions p where p.user_id = u.id)
    and not exists (select 1 from public.daily_checkins p where p.user_id = u.id)
    and not exists (select 1 from public.protocol_item_versions p where p.user_id = u.id)
    and not exists (select 1 from public.tracking_event_cancellations p where p.user_id = u.id)
)
select jsonb_build_object(
  'version', 1,
  'projectRef', 'bxgcntumsyxjfnxenmqm',
  'auditedAt', now(),
  'maxAgeDays', 30,
  'candidates', coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'createdAt', created_at, 'updatedAt', updated_at
  ) order by created_at, id), '[]'::jsonb)
) as audit
from candidates;
