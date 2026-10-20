# Google Play closed beta — October 20, 2026

## Scope and source

- PR: https://github.com/ScienceByHugs/Pulse/pull/99 (not merged).
- Android source: `24273db`, version 2.0.0, versionCode 4, package `com.sciencebyhugs.pulse`.
- Includes adopted effective policies/public links and the previously merged Android navigation fix. iOS build/signing and production backend configuration are unchanged.
- Owner approved the feature graphic's AI disclosure and submission of the prepared closed beta. Existing icon is brand artwork; both screenshots are genuine Android captures of sample data.

## Automated checks

GitHub Actions run 39452958501 passed TypeScript, tests and app assets (46 seconds), and iOS/Android/web bundle compilation (1 minute 48 seconds). Supabase Preview was skipped.

## Build and Console outcome

Local `npm run android:aab` completed successfully in 20 minutes 33 seconds, including `:app:bundleRelease` and `:app:lintRelease` (917 tasks). Signed AAB generated and archived in ignored `local-builds/android/pulse-2.0.0-4/app-release.aab`.

- AAB SHA-256: `5eb8a4b8a7ada76c2594248f4941aa4c8036bec76832f19776316f03bd7c8566` (71,165,279 bytes).
- JAR signature verified; signer certificate matches the existing owner-controlled upload key.
- Bundletool 1.18.3 validation passed; manifest confirms package, versionCode 4, min API 24 and target API 36.
- All 52 arm64/x86_64 libraries have ELF LOAD alignment of at least 16 KB. This static check does not establish 16 KB runtime coverage.
- Universal QA APK generated from this exact AAB and signed with the existing development key for local installation; APK v2/v3 signature verification passed. SHA-256: `cccb5aa7b44da4f5136a0b0bf0aeacedb2fbc4e09920130fedff4043d723187e`. This certificate is different from Play App Signing.
- QA APK installed successfully on API 36 emulator, versionCode 4 confirmed, activity launched and process remained running; crash buffer was empty. No full authenticated-flow or physical-device acceptance is implied by this launch smoke test.
- Existing compiler/Gradle/JDK deprecation warnings were emitted; build and validation exited successfully.

Google accepted build 4 with mapping and native symbols attached and marked it Ready to release. The owner-approved submission of 13 changes was confirmed in Console on October 20 at approximately 09:16 PDT. Publishing overview now shows **Changes in review**, including **2.0.0 (4) — Closed beta** under **Closed testing - Alpha**, US only, selected email tester list, listing and policy declarations. Google quick checks were still running (up to 14 minutes shown); Console says changes proceed to review when checks pass. This is an accepted submission request, not Google approval or confirmed tester availability. Managed publishing is off, so approved changes publish to this closed track automatically. Production was not submitted.

Evidence: `google-play-closed-beta/submitted.png`.

The pre-review check additionally requested the Android advertising-ID declaration. Answered No after confirming no AD_ID permission in the actual release manifest and no advertising SDK/use in the audited source/dependencies; saved successfully.

All eleven app setup sections have been completed in Console, including reviewer access, public privacy/deletion URLs, Data Safety, health declaration, rating and store listing. Listing is ready to send for review. Closed Alpha build 4 and the completed listing/declarations are submitted, with Google checks/review pending. Internal testing build 3 remains separate.

## Production gate

Console shows a new personal developer account requiring at least 12 opted-in closed testers continuously for at least 14 days before applying for production access. At this checkpoint it shows zero opted-in closed testers. Internal testing does not start this clock. Google review/approval, tester enrollment and the later production-access application remain separate from this submission.
