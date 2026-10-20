# Google Play closed-beta preparation — October 20, 2026

Owner authorized submission, reuse of the dedicated sample reviewer account, acceptance of IARC terms, and labeling only the feature graphic as AI-assisted. Reviewer credentials are stored only in Console/private local input, never here.

## Listing assets

- `icon.png`: 512×512 rasterization of the existing Pulse brand SVG; no replacement logo.
- `feature-graphic.svg` / `.png`: 1024×500 composition using existing colors/mark and a simple headline; AI-assisted and declared as such in Console.
- `screenshots/phone-today.png`, `screenshots/phone-navigation.png`: actual 720×1280 Android screenshots, captured through Android Studio from version 3 generated from the existing Play AAB. The emulator APK uses the matching development certificate, not Google's Play signing identity. UI is production code, not the isolated navigation fixture. Only the dedicated account's fictional sample content appears. No account data was created/deleted for screenshots.
- Screenshot Today capture: Desktop `Screenshot_20261020_084131.png`; navigation capture: `Screenshot_20261020_084419.png`. The earlier version-1 capture is excluded.

## Data Safety basis

`data-safety.csv` follows the actual Console export schema. Imported successfully and all eleven data categories marked completed by Console. No third-party sharing is declared under Google's service-provider and explicit user-initiated export/calendar exceptions. This does not mean no off-device collection.

| Data | Required / optional | Collection purpose |
| --- | --- | --- |
| Name, phone, profile photo | Optional | Profile/account functionality and management |
| Email, account IDs | Required | Authentication/account management, security; email also necessary account/support communications |
| Other personal info | Required | US/18+ eligibility self-attestation and compliance |
| Health info | Required for core tracking | User-entered routines, quantities, schedules, history, inventory and optional check-ins; app functionality |
| Other user-generated content | Optional | Feedback/support and diagnosing issues; health notes are covered as health info |
| App interactions | Required | Service request/API-path logs for functionality, troubleshooting and security |
| Diagnostics | Required | Provider response-status/request-timing logs; optional feedback also includes app/build/platform |
| Approximate location | Required | Provider IP-derived city/country security metadata; no GPS permission or precise-location functionality |

All selected data is non-ephemeral because account records or provider logs can persist. Optionality describes the union across users and data paths. Public privacy text explicitly covers provider IP-derived location and technical request logs. Health data is not used for advertising or third-party behavioral profiling.

Reviewed source: `src/lib/supabase.ts`, `src/config/backend.ts`, `src/services/feedback.ts`, profile-photo/account/calendar/report services; package/lock dependencies; release merged manifest/resources; notifications API usage. No advertising/behavioral analytics SDK, remote crash-reporting integration, push-token registration or Firebase Google app configuration was found. The Firebase provider/notification classes in the dependency graph alone do not establish an active Firebase installation or push collection. Expo updates are disabled in the release manifest. Device biometrics, substance photos and PDF generation are local; calendar/report sharing is explicit user-initiated action. Supabase processors receive account/sync/photo/feedback information and operational request metadata over HTTPS. No independent security-review badge was claimed. Do not interpret this source/dependency review as packet-capture certification or a complete provider-retention audit.

Sources reviewed:

- https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
- https://supabase.com/docs/guides/observability/log-field-reference
- https://supabase.com/docs/guides/troubleshooting/discovering-and-interpreting-api-errors-in-the-logs-7xREI9
- https://support.google.com/googleplay/android-developer/answer/14738291

## Android build 4

The next Android bundle includes the adopted policies and public policy links, retaining the merged navigation fix. Only Android versionCode increments to 4; iOS signing/build number, services, credentials and production backend configuration are unchanged. Build, verification and actual Console submission outcome are recorded in `../../qa/GOOGLE_PLAY_CLOSED_BETA.md`; a prepared file alone is not a successful submission.
