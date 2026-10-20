# Android / Google Play fast track

## Architecture and scope

Pulse uses Expo SDK 58, React Native 0.88.0-rc.4, Expo Router and Hermes. The
fastest supported route is Expo Android prebuild plus local Gradle, not a rewrite
or a paid cloud build. The checked-in `android/` project was generated with
`npx expo prebuild --platform android --no-install`, then configured for local
preview and upload signing. Do not run `prebuild --clean`: it replaces the native
signing, preview and splash changes. Review/reapply those changes when upgrading
Expo. Existing iOS configuration, widget plugin, EAS/TestFlight profiles and
backend services are preserved. The iOS-only `expo-widgets` dependency is excluded from Android autolinking
because its Android notification classes fail Kotlin compilation in this pinned
version; iOS linkage and widget code remain intact. See [Expo autolinking](https://docs.expo.dev/modules/autolinking/).
The prerelease React Native dependency is inherited;
Play device testing remains required before production.

Application ID: `com.sciencebyhugs.pulse`; version 2.0.0 / versionCode 1.
Confirm this ID is available in the owner's Play account before the first upload;
a Play application ID is permanent. Increment `android/app/build.gradle`
versionCode for each subsequent upload and keep `app.json` in sync. Local Gradle
does not use EAS remote version increments.

## Free local build

Prerequisites: Node >=22.13, npm, Android Studio JDK, SDK platform 37, build-tools
37.0.0, NDK 27.1.12297006 and accepted SDK licenses. SDK 37 compiles the project;
the app targets API 36 and supports API 24+. The script defaults to macOS SDK/JDK
locations; override JAVA_HOME / ANDROID_HOME elsewhere. Allow at least 30 GiB free.

```sh
npm ci
npm run typecheck
npm test
# Existing public client settings only; never use a service-role key:
# set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# in ignored .env.local or your environment.
npm run android:apk
```

`android:apk` builds the non-debuggable **preview** variant for ARM64 phones / Apple Silicon emulators with embedded JS,
using an ignored random local preview keystore. It works without Metro; it is not a Play
release. Script runs lint, verifies the APK signature and ZIP alignment, prints
SHA-256 and copies it into ignored `local-builds/android/`. Install with:

```sh
adb install -r local-builds/android/app-preview.apk
adb shell am start -n com.sciencebyhugs.pulse.preview/com.sciencebyhugs.pulse.MainActivity
```

Preview uses `com.sciencebyhugs.pulse.preview` and coexists with the release app.
Both register the existing `pulse://` scheme; when testing auth links choose the
intended app in Android's resolver. Final Play QA must use the release package. Do not commit APKs, keystores,
passwords, `.env.local`, SDK paths or Gradle caches.

## Owner-controlled Play signing and AAB

Use Android Studio's free **Generate Signed Bundle / APK > Android App Bundle**
wizard to create or select an upload key. Store the key outside the repository,
back it up securely, and enable Play App Signing in Console. Do not overwrite an
existing upload key. Supply these variables through a private environment or
password manager, without writing their values into shell history or Git:

- PULSE_UPLOAD_STORE_FILE (absolute path)
- PULSE_UPLOAD_STORE_PASSWORD
- PULSE_UPLOAD_KEY_ALIAS
- PULSE_UPLOAD_KEY_PASSWORD

```sh
npm run android:aab
```

Release tasks fail if any signing variable is absent; they never fall back to the
local preview key. Output: `local-builds/android/app-release.aab`. Verify the
certificate with `keytool -printcert -jarfile` and compare it with the owner's
registered upload certificate. Run free bundletool `validate --bundle=...` and
check Play's pre-launch / native-library 16 KB compatibility reports. ZIP
alignment alone does not establish ELF page-size compatibility. No signed AAB
is claimed until it has actually been generated and verified. No automatic
upload, merge or release is included.

## Permissions and behavior

- Internet: existing authenticated backend traffic.
- Calendar read/write: only the calendar linking feature, prompted at use.
- Biometrics/fingerprint: optional privacy lock; no biometric templates leave OS.
- Notifications/vibration: optional private local reminders; verify Android 13+
  POST_NOTIFICATIONS prompt in merged manifest and on-device.
- Legacy external storage (maximum API 32): inherited picker compatibility.
- The merged SDK manifest also includes network/Wi-Fi state, boot/wake locks,
  FCM receive, install-referrer binding and vendor notification badge permissions.
  Include these SDKs in the Data Safety audit; this does not by itself prove
  that data is sent. No location or contacts permission was observed.
- Camera/audio/overlay and broad media read permissions are blocked. Photo
  selection should use the system picker; verify on API 24 and current Android.
- Backups disabled for Android private app data. HTTPS/custom `pulse://` auth
  callbacks retain existing behavior; do not change server redirect allowlists
  without approval. The iOS-only Today widget remains iOS-only.
- Adaptive launcher artwork uses existing Pulse assets; native splash is dark
  with centered Pulse artwork. Test gesture navigation and keyboard insets.

## Play Console gates (check against account dashboard)

Owner confirmed a personal account created after November 13, 2023: the 12-tester / 14-day closed-test gate applies. Developer verification is complete per owner. Verification does not itself
establish production eligibility. For personal accounts created after November
13, 2023, closed testing generally requires at least **12 testers continuously
opted in for 14 days**, followed by an application for production access. Internal
testing does not satisfy that gate. Check account type/date and any additional
device-verification prompts; do not assume this account is exempt.

1. Create app, confirm package ID, enroll Play App Signing, upload signed AAB to
   internal testing after owner approval; inspect pre-launch report.
2. Complete app access with a working reviewer test account and precise login,
   email confirmation and biometric-lock instructions; do not commit credentials.
3. Complete content rating, target audience, ads declaration, Health apps
   declaration and all Console-required policy forms. Pulse tracks health-related
   protocols; review claims and health disclosures, not just its category.
4. Review Data Safety against actual app + SDK behavior: account email/user ID,
   profile name/photo, health protocols/dose logs/inventory and any feedback or
   attached diagnostics. Establish collection, sharing/service-provider roles,
   purposes, optionality, encryption, retention and deletion for each. Local-only
   biometrics/calendar access differs from data sent off-device. Do not mark
   “no data collected” merely because the backend is private. Audit SDKs and
   confirm claims with the owner before submitting the form.
5. Publish/verify an accessible HTTPS privacy policy naming Pulse/ScienceByHugs,
   contact, health-data uses, processors, security, retention and deletion. Sources
   exist in `docs/legal/` and `public/legal/`; a repository file is not a verified
   live policy URL. Account creation requires deletion initiation both in-app and
   via an accessible web pathway; verify the live URL and end-to-end deletion.
   Hosting/production changes require owner approval.
6. Store listing: name (30 characters), short description (80), full description
   (4,000), support email, privacy URL, 512×512 Play icon, 1024×500 feature graphic,
   at least two actual Android phone screenshots. Existing icon is source artwork;
   capture screenshots from the built app with synthetic data. Do not reuse iOS
   screenshots as Android evidence. Confirm current Console dimension rules.
7. Start required closed test as early as possible after a safe internal build;
   collect real engagement/feedback, fix issues and apply for production access.
8. Owner approves final listing, declarations, signing and release. Merge/upload/
   production promotion are separate approvals.

## Device acceptance before submission

- Cold start without Metro; signup/confirmation/reset deep links and sign-out.
- Protocol create/edit/archive, Today calculations, Quick Log inventory exactly
  once, Timeline/Insights refresh, offline replay without duplication.
- Denied/granted notifications; private reminder text, local time/timezone,
  restart/background/battery restrictions. No exact-alarm delivery guarantee.
- Biometrics enrollment/cancel/fallback, session persistence and relaunch.
- Photo picker, calendar link/unlink, PDF export/share, account deletion.
- Current Pixel plus older supported Android, gesture navigation, small screen,
  large text, keyboard visibility and Android 16 KB environment.

## Current official references (reviewed 2026-10-19)

- [Expo local production builds](https://docs.expo.dev/guides/local-app-production/)
- [Target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
- [Personal account testing](https://support.google.com/googleplay/android-developer/answer/14151465)
- [User data / privacy policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [16 KB compatibility](https://developer.android.com/guide/practices/page-sizes)

See `docs/qa/ANDROID_FAST_TRACK.md` for measured build results and outstanding gates.
