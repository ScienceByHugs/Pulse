# Pulse app review — PR 90 follow-up

## Implemented changes

- Timeline filters moved into a shared popup with visible active-filter count, clear controls and readable status labels. Fixed empty-string rendering warnings.
- Timeline uses saved record days, includes years in grouping, retains original record time zone and applies filters consistently to charts/calendar totals. Legacy records fall back to the current protocol relationship when no snapshot is available.
- Insights respects protocol windows in its next-week map and avoids displaying 100% when no entries were scheduled. Added load/retry states.
- Container opened/expiry/use-by dates use local date conversion consistently and preserve the original timestamp when an unchanged field is saved. Regression cases cover Pacific, Eastern and ahead-of-UTC time zones.
- New protocol schedules permit intentional Any time entries and reject invalid/missing interval or cycle days instead of silently substituting a daily routine.
- Check-ins load fresh owner-scoped observations before editing, expose failed loads, protect unsaved changes when selecting another date and lock inputs while saving. Closing or leaving cancels pending UI loads. Save rejects an account switch before any upsert.
- Account and reset-password controls have permanent labels, Next keyboard actions, shared sheet layout and explicit busy/error feedback. Native-only switches are unavailable with an explanation on web.
- Log correction has explicit Recorded/Skipped selection and a site dropdown; date/time controls lock during mutation. Report creation requires a valid range and selected content. Private notes reset to excluded each time a new report opens.
- Reminder updates serialize. Private text cancels old pending alerts before network refresh; failures identify whether the preference saved. Enable failures roll back the preference and partial schedules. Sign-out also attempts pending/delivered notification cleanup. Stale Today loads cannot update UI or schedule alerts after navigation/account changes.
- Calendar waits for a successfully loaded routine/connection before connect/sync/privacy writes, provides Retry after failed reads and explains native availability on web. Navigation respects reduced motion.

## Verification

73 automated tests passed, including new regression cases for stored timeline dates/filtering, date round-trips, schedule validation, reminder privacy races/rollback and account changes during check-in save. TypeScript, configured app assets and policy synchronization passed. Local iOS/Android/web JavaScript exports passed; these are not signed native builds.

Browser walkthrough at 390×844 used the existing fictional Apple-review account. Checked Today, Protocol, Timeline, Insights, Account, report/profile sheets, Calendar and About. Verified existing sample observations load, unsaved notes survive a rejected date change, filter counts and clear controls update, report creation disables when no content is selected, notes reset off on reopen, and sign-out reaches login. No tracking records, profile details, credentials or calendar events were created/changed during the walkthrough; local test drafts were discarded.

Physical iPhone/Android keyboard behavior, notification delivery, calendar permission/recovery, large text and screen-reader traversal remain pending the next authorized local native build. No TestFlight submission, production schema/config change, policy publication or cleanup activation occurred.
