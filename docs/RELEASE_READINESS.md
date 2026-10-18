> Historical snapshot. For current evidence and active gates, see [Release status](RELEASE_STATUS.md).

# Pulse release readiness — October 12, 2026

No new signed native build or TestFlight submission is authorized. Build 9 is the existing release. Account data contains fictional Apple-review samples; its email is confirmed. Credentials must remain outside this document and GitHub.

## Completed

- GitHub checks prepared for PRs, main, feature and codex branches, with a manual trigger. Read-only token, canceled superseded runs and timeouts limit scope and cost.
- TypeScript and 23 automated tests pass locally, including local PostgreSQL/RLS, event retry, inventory/Undo, schedules and PDF tests.
- Configured iOS icon is checked using app.json, rather than the old unused assets/icon.png path. No additional Python dependency is needed.
- iOS/Android/web JavaScript compilation uses intentionally invalid CI backend settings; no production credentials, EAS token, signing or submission step is present. Passing this is not a native compilation or device acceptance result.
- Tester quick-start includes an ordered checklist and feedback instructions without passwords or real health data.
- Review account confirmed with one fictional protocol, substance, inventory container and daily check-in. Login was verified when provisioned; read-only readiness rechecked today.
- Six legal drafts and public HTML counterparts exist locally, with app links before login and in Account. They are not effective or hosted yet.

## Release blockers to resolve before external expansion

- Physical-phone acceptance: offline reconnect/relaunch/Undo, multiple times, reminders/tap, calendar copies, PDF share, account switching and disposable-account deletion. Testers must record actual results; no pass is assumed.
- Confirm legal operator, public business address, monitored privacy/support contact, launch territories, age and policy host. A support review-login email does not by itself establish a monitored privacy-request channel.
- Verify actual backup/security-log retention, vendors/hosting regions and request/deletion/appeal procedures. Finalize legal and health-data consent requirements for actual markets, with appropriate counsel review.
- Host final policy/support/deletion URLs without login. Complete accurate Apple privacy and Google Data safety/Health app declarations.
- Policies, administration labels, site dropdown, substance picker and artwork remain local pending a separately approved release. Do not tell Build 9 testers these features are installed.
- Existing dependency/security-advisor findings remain recorded in the ten-improvements review. These checks are not a guarantee of legal compliance or absence of vulnerabilities.

## Next release, only when explicitly requested

Review local changes → finish legal details and publishing → check exact commit in CI → request a signed native build → physical device acceptance → assign to testers. Local iOS setup still needs the approved macOS/Xcode upgrade; Fastlane and CocoaPods are installed.
