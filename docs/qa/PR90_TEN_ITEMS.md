# PR 90 — second improvement set

1. Native phone QA: scenarios and reporting gate prepared; actual device execution pending next native build. No physical phone paired in the current audit.
2. First-protocol onboarding: numbered setup and prominent first-substance next step. New substance route is unselected; no time recommendation is prefilled.
3. As-needed tracking: explicit creation pattern and manual amount entry on Today; respects active state, protocol dates and temporary pauses; uses durable logging and the optional injection-site dropdown. Manual records do not count as scheduled daily obligations.
4. Completed Today groups: logged/skipped groups collapse by default; notification targets expand them.
5. Timeline search: improves existing search with multiple words, accent normalization, result count and Clear. Notes are not searched implicitly.
6. Stock history: shows container additions, corrections and current tracking status. Displays current recorded dates and real persisted completed/voided/skipped/missed statuses. Latest 100 records shown; full history available in account export.
7. Creation recovery: owner-scoped durable IDs, shared in-flight requests and replay reads. Failed substance creation opens a read-only resume sheet using its original payload/date anchor, including after relaunch; edited inputs cannot create another substance while recovery is unresolved. Partial substance/container creation can resume without duplicate rows or resetting consumed stock. Recovery data appears in account export and is cleared after account deletion. Requires no new database schema or permissions.
8. Reminder health: permission/preference/pending-count display, refresh and device-settings link. Reading status never requests permissions or schedules notifications.
9. Accessibility: contrast regression check, labeled switches/buttons, adaptive navigation/content space and reduced-motion support. Browser checks do not replace device VoiceOver/TalkBack and large-text QA.
10. Policies: updated drafts with confirmed sole-proprietor/US/18+ and promotion facts; primary database region verified as us-east-2. Signup requires age/residency self-attestation, not verified identity or geographic enforcement. Support/privacy-request affordance prepared. Public publication still awaits mailing address, exact provider retention, operating adoption and attorney review. Owner-operated abandoned-signup cleanup and a privacy-request runbook are prepared. The owner confirmed Anthony Charles Hugershoff as the sole proprietor and legal@sciencebyhugs.com; the PO Box is pending this week.

Security audit: existing owner/verified-email restrictions remain. The inventory-correction SECURITY DEFINER warning is intentional: the function checks auth.uid and owner before locking/correcting stock. [Supabase advisory documentation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Supabase's existing leaked-password protection warning remains; no auth-management tool is available in this connection to change it. [Password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

No native build, TestFlight submission, production schema/config change or policy-site publication is included in this set.

Latest validation: 54 automated tests, TypeScript, configured app assets and policy-output synchronization passed. iOS, Android and web JavaScript bundle exports passed locally; these are not native-device tests.

Follow-up validation: live read-only abandoned-signup audit found no eligible accounts. Browser checks confirmed stock history loads, web reminder diagnostics refresh without requesting permissions, sign-out reaches login, and signup checkbox exposes aria-checked and gates account creation. No new account was created and no tracking record was changed. Native device QA remains pending.

Account deletion now attempts each device cleanup independently and distinguishes confirmed server deletion from incomplete local cleanup. Account exports use owner-filtered cursor pagination and stop before sharing if the signed-in account changes.

Further app walkthrough fixes and latest validation are recorded in APP_REVIEW.md.
