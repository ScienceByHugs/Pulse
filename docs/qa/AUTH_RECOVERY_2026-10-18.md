# Password recovery regression — October 18, 2026

Owner device test: email received, link opened Pulse, but reset verification error persisted. Installed TestFlight version: 2.0.0 (15). SMTP delivery is confirmed; recovery acceptance remains blocked under issue #91.

Read-only production diagnostics showed a successful recovery request and a verification redirect, without a subsequent user-validation request in the inspected window. This narrows the investigation but does not prove the exact native failure. No actual reset links, credentials, tokens or recipient details were collected.

The patch resolves confirmed app weaknesses:

- Startup waits for the initial auth URL; foreground links enter an explicit pending state.
- Auth-link operations return a session which the provider explicitly validates with the Auth server, rather than depending only on an auth event.
- Link parsing is independent of native URLSearchParams behavior, accepts both native slash forms, decodes once, and rejects malformed/duplicate parameters.
- Concurrent duplicate delivery shares the single-use verification request. Raw URLs are retained only during the operation, never persisted or logged.
- Link failures become safe user-facing errors. Confirmed-user checks remain in force.

Validation: 102 automated tests and TypeScript passed. Nine new cases cover implicit recovery, PKCE, token hashes, missing native URLSearchParams, invalid/expired/malformed links, duplicate delivery, cold/warm startup, safe failures and confirmed-user enforcement. Native device success is not claimed.

Release acceptance requires a new separately approved native build. On the updated build, request a fresh link and test both cold and foreground launch, password update and subsequent sign-in, plus safe rejection of used/expired links. Do not close #91 before device evidence passes. Existing build 15 does not receive this code through an SMTP setting change.
