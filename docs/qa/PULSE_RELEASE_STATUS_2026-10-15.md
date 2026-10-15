# Pulse by SBH — release status and next four builds

Date: October 15, 2026

## Completed

- Corrected vial artwork text alignment and kept the Science By Hugs / research-use labeling consistent.
- Completed the login and account-flow polish already included in the current branch.
- Updated Expo SDK 58 dependencies to the current compatible patch versions.
- Refreshed the lockfile.
- TypeScript passed.
- Full automated test suite passed.
- Expo Doctor passed all 20 checks.
- Build 17 was previously compiled and signature-verified locally, but it remains held and was not submitted.
- No Expo cloud native build was used for this update.

## Current release status

The dependency update is committed locally as `51710a9`. A new local build was attempted for build 18, then retried with the verified Pulse certificate fingerprint and frozen credentials. EAS stopped before compilation while validating the remote Apple credentials, so no build 18 IPA was created and nothing was uploaded to App Store Connect.

The next action is to restore local Apple credential validation or use the known manual Xcode export workflow, then verify the new IPA before submitting it. The previously verified build 17 should not be submitted as a substitute because it does not contain the dependency update.

## Next four builds

### Build 18 — dependency update release

Purpose: compile the current dependency update locally.

Check: signed IPA, both app and widget at the same build number, strict code-sign verification, matching dSYMs, Expo Doctor and tests, then physical-device smoke test for login, navigation, notifications, widgets, and label rendering.

Release: submit to internal TestFlight only after the checks pass.

### Build 19 — beta feedback fixes

Purpose: address the highest-confidence issues reported by internal and external beta testers.

Check: reproduce each reported issue, add or update a regression test where practical, repeat the device smoke test, and verify no personal health data reaches admin views or feedback payloads.

Release: internal TestFlight first; promote to external testing after review notes are ready.

### Build 20 — release-candidate polish

Purpose: final spacing, accessibility, empty states, error messages, and onboarding cleanup based on beta evidence.

Check: VoiceOver pass on login, Today, Protocol, Timeline, Insights, You, feedback, and account deletion; offline/retry checks; privacy and legal links; crash-free smoke test.

Release: external TestFlight candidate, pending product and legal review.

### Build 21 — App Store submission candidate

Purpose: freeze the release candidate and prepare App Store metadata, screenshots, review notes, support links, and privacy details.

Check: clean local build from a clean checkout, archive and dSYM retention, final device matrix, version/build verification, no secrets or debug flags, and App Store Connect processing confirmation.

Release: submit for App Store review only after the final checklist is signed off.

## Remaining dependency advisories

The npm audit still reports advisories in Expo/Metro/Xcode build tooling. Its automatic remediation would downgrade Expo and React Native across major versions, so it was not applied. The warnings are documented in `docs/qa/DEPENDENCY_REVIEW_2026-10-15.md` and remain a tracked maintenance item.
