# Admin and feedback verification — 2026-10-13

Implemented separate Pulse Admin and owner-scoped Help & feedback. Migration 20261013133225_feedback_and_private_admin.sql applied to bxgcntumsyxjfnxenmqm. No membership seeded, no Auth accounts/passwords/MFA credentials created, and no feedback/tracking/profile records modified during live QA.

## Automated checks

88 tests cover existing tracking/account behavior plus feedback ownership and export/delete integration, immutable durable retries, offline failures, consent-derived reply email, quota/idempotency, UTC count boundaries, composite inbox pagination, status compare-and-set and audit, approved membership/live session/TOTP gates, forged metadata, removed factor/session/membership, direct-table and anonymous denials, DTO projection and production bundle exclusion of server secrets and preview fixtures. TypeScript includes the admin portal. GitHub CI compiles native JavaScript/web bundles and the standalone admin portal with dummy public backend values; no signed builds or submissions.

## Live backend

Read-only grants check: admin_allowlist_entries=0, feedback_rows=0, authenticated allowlist SELECT=false, direct authenticated feedback INSERT=false, anon admin RPC EXECUTE=false. Authenticated context without a user returns member=false/authorized=false. The existing Apple reviewer signed in to the production portal and visibly received Administrator activation required; no counts/tickets appeared. It was signed out afterward.

Security advisors returned no new WARN or ERROR. The three new private administration tables intentionally have RLS enabled with no client policies/grants (deny all); the advisor reports that condition as INFO. Private SECURITY DEFINER implementations use fixed empty search_path and explicit authorization; exposed wrappers use invoker rights. Existing inventory SECDEF and disabled leaked-password warnings remain unchanged. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy, https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable, https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Performance advisors show only pre-existing missing foreign-key indexes; new indexes are unused because no feedback/admin records exist yet. No unrelated privileges/configuration changed.

## Browser checks

390×844 and 320×740 viewport checks: fictional overview/inbox fit without horizontal overflow, cards/labels/status controls wrap, changing fictional status updates the ticket. Fictional data remains visibly labeled and never enters the live backend. Actual app navigation opens Help & feedback; owner history loads empty from the live backend, contact switch starts off, short text disables sending, and the close action protects typed unsent text. The test message was discarded, not sent. Browser review does not verify native keyboard/sheet behavior.

Local untracked screenshots: output/ui/admin-overview-preview.png, admin-feedback-preview.png, admin-access-denied.png, in-app-feedback-form.png. Build output/preview servers are temporary; retain screenshots for review. Native build14 does not include these additions. No new native build or TestFlight submission for this work. Policy source/output remain synchronized drafts and are excluded from the portal artifact.

## Remaining gates

- Confirm the admin mailbox works; Anthony creates/verifies the dedicated login, operator approves it, Anthony enrolls/verifies TOTP. End-to-end real owner login is blocked until those user-controlled steps.
- Hosting completed at https://pulse-sbh-admin.sciencebyhugs-pulse.workers.dev. Live200/login page, CSP frame-ancestors none, X-Frame-Options DENY, cache no-store, production JS hash equality and draft policy404 verified. Static host tests reject unknown/prototype-named routes and POST, and validate HEAD/headers. No Git integration or native cloud build.
- Next authorized local native build: verify iOS/Android feedback sheet keyboard, focus, text scaling, submit/status and offline/relaunch flows. Automated SQL/service tests cover server round trips; no fabricated live ticket was sent to the operator.
