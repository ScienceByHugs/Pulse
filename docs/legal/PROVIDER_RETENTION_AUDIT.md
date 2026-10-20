> October 20 policy update: Supabase’s current residency/retention FAQ and DPA were reviewed again. Exact retention for every Free-plan backup, storage-recovery copy and internal security log remains unverified. Current effective policies disclose these limits and determining criteria; they do not promise immediate/seven-day erasure or confuse whole-project deletion periods with a Pulse user’s deletion. The historical project inspection below is dated October 12 and has not been represented as a new live inspection.

# Supabase backup and retention audit — October 12, 2026

## Verified live via connected Supabase account

- Pulse project: bxgcntumsyxjfnxenmqm (PULSE2.0), ACTIVE_HEALTHY.
- Organization: Science By Hugs - Pulse; plan free, tier_free.
- Primary database: us-east-2; PostgreSQL 17.11.0.002.

## Published provider guidance, not project-specific inspection

- Free plan has no included customer-accessible daily backup recovery window. Paid plans include daily backups; Pro has seven days. Free projects may still have internal provider backups, so absence of included recovery is not proof that no copies exist.
- Database backups exclude actual Storage API objects, including profile-photo files; object metadata alone is backed up.
- Free-plan log access is normally one day; limits/settings can reduce that window. Visibility does not establish all internal security-log deletion periods.
- Supabase's residency/retention FAQ directs exact retention inquiries to privacy@supabase.io. Project deletion timing is different from deletion of a single Pulse user's account.
- No automatic database dump/off-site backup or log-drain configuration found in the reviewed repository. This does not rule out provider-side or external configuration.

## Still unverified

The dashboard redirected to sign-in. The connected tools expose project and organization details but no backup inventory/settings endpoint. Actual backup inventory, internal Free-tier backup retention, Storage deletion retention, internal security telemetry retention and external log drains remain unverified. Do not promise seven-day erasure or zero retained copies in public policies.

Next: sign in to the project's Database > Backups dashboard; inspect available recovery/settings and Logs settings. Exact internal retention may still require Supabase's privacy team. No settings changed, backups downloaded or outbound messages sent in this audit.

Sources:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/troubleshooting/will-backups-be-accessible-from-the-dashboard-immediately-after-upgrading-to-a-paid-plan-hXY4rs
- https://supabase.com/docs/guides/troubleshooting/check-usage-for-monthly-active-users-mau-MwZaBs
- https://supabase.com/docs/guides/platform/manage-your-usage/logs-query
- https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
