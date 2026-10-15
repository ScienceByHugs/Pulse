# Pulse Admin and in-app feedback

Pulse Admin is a standalone responsive web portal. It shows aggregate account/signup counts and the feedback users voluntarily submit. It does not query or expose their tracking records, profiles, photos or check-ins. No separate native admin app is required.

## Operator setup

1. Confirm admin@sciencebyhugs.com is a working mailbox controlled by Anthony.
2. Open https://pulse-sbh-admin.sciencebyhugs-pulse.workers.dev and select **Set up the new admin login**. Anthony chooses and enters a unique password of at least 12 characters himself. Existing Pulse accounts can instead sign in directly.
3. Verify the email using the existing Pulse auth callback, then return to the portal. The account has no administrator access yet.
4. The backend operator runs `scripts/activate-pulse-admin.sql` in the Pulse project SQL Editor. It resolves exactly one verified matching Auth account and refuses a conflicting pre-existing administrator. Never approve the shared Apple review account or grant a role through user-editable metadata.
5. Anthony signs in, enrolls an authenticator himself, stores its setup key privately, and verifies a current code. The backend will only return counts/tickets with approved membership, an actual unexpired Auth session, an aal2 token and a verified TOTP factor.

On 2026-10-13 the migration was applied, but membership remained empty and the dedicated Auth account did not exist. No admin account, password or MFA credential was created on Anthony's behalf. Signup eligibility metadata is descriptive, not an authorization source. The browser uses sessionStorage with a dedicated storage key; closing its tab removes that tab's stored login. Sign-out clears rendered data immediately even if cleanup fails.

## What the portal contains

- Overview: verified users, new verified signups over seven UTC calendar days, pending verification, open feedback and a 30-day signup chart/table.
- Counts describe currently existing Auth accounts, not active users or lifetime totals. Deleted accounts disappear. Verified signup dates use account creation time, not verification time. Admin accounts and explicitly marked owner/demo/test accounts are excluded. Other test accounts must be classified by the operator in the private metric_exclusions table before relying on counts as customer totals.
- Inbox: category, volunteered message, status, version/build, platform, dates and reply email only if consented. There is no user directory or health-data viewer. Feedback can contain sensitive details typed by a user; the form asks them not to include those details. It does not attach tracking data or diagnostic logs.
- Status changes: Received, Reviewing, Planned, Shipped, Closed. Compare-and-set prevents silently overwriting another window's change. Minimal private audit rows record actor ID, ticket ID and status transitions, never messages/health records. Changing status does not send email.

## App feedback behavior

Help & feedback appears in You and the navigation menu. Users choose Problem, Suggestion or Recent change, write 10–2,000 characters and optionally permit follow-up. Reply-email consent starts off. The backend derives the email from their verified account; no arbitrary client-provided email is accepted.

Feedback is linked to its owner for My feedback, export and deletion. No anonymous submissions. Writes use a client request UUID and expected owner ID; the server enforces identity, quota and idempotency. Five new tickets per hour and ten per day per account are allowed; retries of already accepted tickets remain safe. After an interrupted send, the same immutable original draft is kept in private account-scoped device storage. The user must retry it before starting another ticket. Unsubmitted open-form text is discarded only after a close confirmation. Feedback rows cascade with Auth account deletion; the device draft is independently cleared and included in exports. Audit IDs/statuses survive with null actor after deletion; no message/email is retained there. Provider backup retention is still a separate pending policy detail.

## Build and hosting

`npm run admin:web:build` outputs only portal.js, portal.css, index.html and _headers to ignored dist/admin. Public Supabase URL/publishable key are bundled; no server keys. The build rejects secret/service-role credentials. HTTPS is required in production. CSP limits scripts to self and connections to the configured backend. Serve _headers on a compatible host such as Cloudflare Pages, including frame-ancestors none, no-store and nosniff. GitHub Pages does not implement this header file. Publish only dist/admin, never public/legal, source fixtures or output/admin-preview. Policies remain drafts awaiting the existing release gates.

The initial portal is deployed as the small static-only Cloudflare Worker pulse-sbh-admin because the Pages Git installation failed. `npm run admin:host:build` packages exactly index.html, portal.js and portal.css into dist/admin-worker/worker.mjs. The host accepts GET/HEAD for those fixed paths, rejects POST/unknown paths, and sets restrictive headers on every response. It has no backend/service-role keys, proxy, DB/Storage bindings, API/data handlers or user-record persistence. CSP and X-Frame-Options prevent framing; cache is no-store. Cloudflare runtime logs are enabled without invocation logs or traces and with query strings redacted; the handler logs nothing and never reads request bodies. Provider infrastructure request processing remains subject to its policies. The small compiled artifact is uploaded through the connected Cloudflare API; no Git integration, native build or cloud compilation is needed. Account workers.dev subdomain is sciencebyhugs-pulse; version previews are disabled. The deployed JS hash matches the local production artifact, and draft policy paths return404. A future switch to the native static-assets service can replace the embedded small asset map as the portal grows.

A web portal deploy does not create a signed iOS build or consume an Expo native cloud build. Native Pulse builds remain local and require Anthony's instruction. Build 14 does not contain the feedback screen or subsequent typography changes.

Local layout QA: `node scripts/build-admin-preview.cjs`, then `python3 -m http.server 8092 --bind 127.0.0.1 --directory output/admin-preview`. This fixture has visible fictional-data labeling and no backend client or credentials. Never deploy it.

## Access removal and recovery

The operator can remove the UUID from pulse_private.admin_accounts to revoke portal access immediately. The next gated request is denied even with a previously valid token. Revoke Auth sessions as well after compromise. Do not weaken MFA or grant the review account during recovery. If an authenticator is lost, verify Anthony's identity through an established owner-controlled channel before performing provider-side MFA recovery; the portal does not offer self-service admin approval or MFA bypass.

## Verification

See docs/qa/ADMIN_FEEDBACK_REVIEW.md. Physical keyboard, native sheet/accessibility text sizing and a fully approved real admin MFA session remain pending user setup and the next authorized native build.
