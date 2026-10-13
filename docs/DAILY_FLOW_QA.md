# Daily flow polish — PR 90

Completed: Today groups remaining, pending, logged and skipped occurrences and identifies the next future scheduled instant. Empty states distinguish paused routines, tracking-date boundaries, as-needed routines and ordinary off-days. Failed loads show Retry instead of masquerading as an empty routine.

Substance details, schedule and stock editors use separate sheets. Shared form sheets keep Close outside the scrolling/keyboard area; date/time pickers use matching colors, close controls and scrollable content. Main actions expose button roles and minimum touch targets. Details distinguish amount per entry from container stock.

Failed updates/check-ins/report creation keep their input and offer Retry. Logging/Undo recovery retries the durable queue and refreshes server status instead of blindly creating another record. New-container failures do not have a blind Retry button. Creation operations now persist owner-scoped request IDs and recover committed records on retry; see docs/qa/PR90_TEN_ITEMS.md.

Validation: TypeScript and 25 tests pass, including mixed confirmed/pending states, next occurrence ordering and empty-state reasons. iOS, Android and web bundle exports pass. At 390px, the review account was used to inspect Today, details, schedule, inventory, new protocol, check-in, calendar/time pickers and report sheets. Report notes/check-ins remain off by default. Sign-out returned to login. No records were changed or exported in these UI checks.

Remaining native QA: keyboard/autofill, large text/VoiceOver, Android back handling, and forced network failures on actual devices. These require the next native build; no signed build or TestFlight submission was started for this work. Temporary export files were removed. Preview screenshots use fictional review-account data and are kept locally under output/ui, outside this commit.
