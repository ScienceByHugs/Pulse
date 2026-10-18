# Pulse authentication email operations

Tracker: #91. Project: PULSE2.0 (`bxgcntumsyxjfnxenmqm`). Prepared October 17, 2026 Pacific. Production changes require owner approval.

## Verified findings

- Existing flows validate email format but had no post-request cooldown. The stabilization patch shares one 60-second courtesy limit across signup, password reset, confirmation resend and email change, with a synchronous pending lock. Rate-limit errors (HTTP 429 or Supabase rate-limit codes) extend the wait to five minutes. Users explicitly retry; the app never loops sends.
- The wait is session memory, survives sheet/navigation changes, and stores no recipient/password/token. Relaunches and other devices rely on server limits. This is UX protection, not abuse prevention or proof of delivery.
- Resend's connected account listed only `srccvde.com` and `auth.srccvde.com`, both verified. No Science By Hugs sender domain was listed. Do not repurpose the SRCcvde sender or credentials.
- The read-only unified logs query for 2026-10-17 05:30Z through 2026-10-18 05:30Z exposed only pgbouncer/postgres sources. It provided no Auth delivery or bounce evidence. Earlier #91 rate-limit observations remain historical; a 429 is not an SMTP bounce.
- Current SMTP host/sender and enabled state are not exposed by the connected Supabase tools and have not been verified in the dashboard. Do not assume the shared sender is still configured.

## Prepared sender proposal (not enabled)

Owner decision: approve `auth.sciencebyhugs.com`, sender `Pulse by Science By Hugs <no-reply@auth.sciencebyhugs.com>`, and a monitored support destination. Verify ownership and available free/existing provider capacity first. Do not add a paid subscription or replace working mail routing.

1. Read existing Supabase Auth SMTP, rate-limit, confirmation and redirect settings without printing credentials. Record only non-secret settings and whether a credential is configured. Capture rollback values securely outside git.
2. Verify provider domain capacity. Add the approved Pulse sending domain only after approval. Obtain the provider's exact required DNS records; review SPF/DKIM/DMARC alignment. Preserve existing MX records and a single valid SPF policy per name. Do not invent DKIM values or impose a DMARC policy without reviewing existing use.
3. Create a dedicated sending-only credential restricted to the approved domain where supported. Store it only in provider/Supabase secret settings. Never in git, logs, chat, `.env.example`, mobile code or a public bundle.
4. Configure Supabase custom SMTP after approval: `smtp.resend.com`, port `465` with TLS (verify current provider guidance), username `resend`, dedicated credential, approved From/name. Preserve email confirmation and secure email-change settings. Do not raise rate limits merely to hide repeated-send behavior.
5. Keep link/open tracking off for auth. Preserve `pulse://auth/callback` and `pulse://auth/reset-password` in the redirect allowlist and test both existing callback styles. Never disable confirmation to make a failed test pass.
6. Use only a few owner-approved deliverable addresses. Independently verify signup confirmation, resend, recovery, email-change confirmation and return to the native app. Record build/OS, UTC timestamp, redacted provider message identifier and delivered/failed/bounced status. Do not send during a code-only test or target real users without approval.
7. Observe permanent failures and complaints in the provider, suppress permanent bounces, and stop retrying invalid recipients. Review rate limits separately from bounce counts. Do not record user addresses, tokens or message bodies in public issues.

## Failure and rollback

If delivery or deep links regress, stop further test sends. Inspect provider delivery/error categories and Supabase Auth dashboard logs, preserving recipient privacy. Reapply the securely recorded previous SMTP settings only with production approval; do not change unrelated projects, authentication policy or routing. Keep #91 open until actual delivery and device evidence are attached.

## Current primary references

- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/rate-limits
- https://resend.com/docs/send-with-supabase-smtp
- https://resend.com/docs/smtp
