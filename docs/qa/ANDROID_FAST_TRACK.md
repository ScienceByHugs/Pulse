# Android fast-track verification — 2026-10-19

Base: ScienceByHugs/Pulse main. Isolated checkout; no iOS signing or production
service mutations. Android source generated with Expo prebuild only for Android.

## Completed checks

- `npm ci --offline --ignore-scripts`: 572 packages installed, audit found zero vulnerabilities.
- `npm run typecheck`: passed.
- `npm test`: 102 passed, zero failed.
- `node scripts/check-app-assets.cjs`: passed.
- `python3 scripts/generate-legal-pages.py --check`: passed.
- `bash -n scripts/build-android-local.sh`: passed.
- `npx expo export --platform android --output-dir local-builds/android-export`:
  passed, generated Android Hermes bundle (approximately 6 MB). This alone is
  not an APK or native runtime test.
- `git diff --check`: passed.
- Confirmed no changes to EAS/TestFlight configuration, widget source or iOS plugin.

## Native build

`npm run android:apk`: **passed**. Final incremental Gradle build completed
in 29 seconds after dependencies had compiled. `assemblePreview` and `lintPreview`
passed with **0 errors, 36 warnings**. Warnings include inherited legacy storage,
newer-tool versions, resource density/format and API attributes; none were hidden
with a blanket lint suppression.

- Artifact: `local-builds/android/app-preview.apk` (ignored, local to this checkout).
- Size: **47,499,130 bytes** (ARM64).
- SHA-256: `b9b9d3d8bfba696289ffbce2b496f531fd4f5e34ef21c5ca9c980ab79ac92217`.
- Package `com.sciencebyhugs.pulse.preview`, version 2.0.0 / 1; min API 24,
  target API 36, compile API 37, non-debuggable preview with embedded Hermes JS.
- `apksigner verify`: passed. Local preview key only, not the Play upload key.
- `zipalign -c -P 16 -v 4`: passed.
- All **26 ARM64 native libraries** inspected have ELF LOAD alignment >=16 KiB.
  This is static verification, not a 16 KB-device runtime acceptance test.
- APK installed successfully on the existing API 36 ARM64 emulator alongside the
  existing release-ID Pulse app. Cold activity start returned `Status: ok`,
  TotalTime 1919 ms. Visually verified the rendered sign-in screen without Metro.
  Runtime error log was empty; emulator page size was 4096 bytes.
  No authenticated production actions were performed. Screenshot:
  [Android preview sign-in](android-preview-sign-in.png).
- Confirmed Android widget autolinking excluded and iOS widget linkage preserved.
- Confirmed all non-Android Expo config values unchanged.
- Merged manifest inspected: backup disabled, POST_NOTIFICATIONS present,
  camera/audio/overlay/broad media-read permissions absent. SDK-transitive
  network/boot/wake/FCM/referrer/badge declarations are documented in checklist.

The initial pinned `expo-widgets` Android implementation failed Kotlin compilation
on missing `jakex7` notification classes. Pulse's widget is iOS-only with an existing
Android no-op guard; Android-only Expo autolinking exclusion fixes the build without
changing iOS source/dependencies. Fresh Gradle process avoids the preexisting daemon's
Node lookup failure.

`npm run android:aab`: deliberately fails closed at missing
`PULSE_UPLOAD_STORE_FILE`. **No AAB was generated**; an owner-controlled upload key
and its private signing environment are required. The AAB workflow is documented,
and no upload/release/merge was performed.

## Submission gates

Owner confirmed: personal account created after November 13, 2023. Plan for
12 testers continuously opted in for 14 days, then apply for production access.
Developer verification is already complete per owner.

Owner-controlled upload signing key, signed AAB verification, physical Android
functional QA, 16 KB native-library compatibility, live privacy/deletion URLs,
Data Safety/health declarations, review account and actual Android listing
screenshots/feature graphic remain release gates. See
`docs/ANDROID_RELEASE_CHECKLIST.md` for commands and the fastest sequence.
