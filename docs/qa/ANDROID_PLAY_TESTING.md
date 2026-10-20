# Signed Android testing bundle — 2026-10-19

Owner authorized a new upload key, signed AAB build and upload to a Play testing
track. Production release and merge remain unapproved.

## Verified artifact

- Source commit: `66a79f5` (same application source as PR #96).
- `npm run android:aab`: **passed**, local Gradle build in 12m 19s.
- `bundleRelease` and `lintRelease`: passed; **0 lint errors, 36 warnings**.
- File: `local-builds/android/app-release.aab` (ignored; not committed).
- Retained copy: `local-builds/android/pulse-2.0.0-1/pulse-2.0.0-1.aab`.
- Size: **71,161,808 bytes**.
- SHA-256: `7da6722c100818711d33133f8a3d884e07170c7de63b003bc2bcf44633a712bc`.
- Package `com.sciencebyhugs.pulse`, version **2.0.0 / 1**, min API 24,
  target API 36, compile API 37; non-debuggable, not testOnly, backups disabled.
- Embedded Hermes JS present; ARM64, ARMv7, x86 and x86_64 included.
- Google bundletool **1.18.3 validate**: passed. Official download checksum matched
  GitHub's published SHA-256.
- `jarsigner -verify`: **jar verified**; embedded certificate matches the new
  upload certificate. JDK reports self-signed/untrusted-chain and no-timestamp
  warnings, plus a JarInputStream/manifest-order warning. The artifact is accepted
  by bundletool and subsequently accepted by Google Play. No signing
  warnings were suppressed and the signed ZIP was not rewritten.
- All **52 64-bit native libraries** have ELF LOAD alignment >=16 KiB. This is
  static verification, not a 16 KiB-device runtime acceptance test.
- R8 mapping and native debug symbols retained alongside the versioned AAB.

## Signing material

A new owner-authorized 3072-bit RSA upload key was created outside the Pulse
checkout in the owner's private local storage. Keystore and signing metadata have
restricted file permissions and are excluded from Git. No password or private key
is in this PR. Keep a secure owner-controlled backup before relying on future
uploads. The public upload certificate SHA-256 is:

`9B:D7:05:F7:41:9E:4E:E2:42:E5:1B:AE:F3:9E:B5:76:E0:24:F5:04:6C:07:78:1B:30:B9:5E:71:1E:9D:7C:EF`

## Play Console state

**Uploaded and published to internal testing. Track is Active.**

- Console app: `Pulse`; package ID `com.sciencebyhugs.pulse` was confirmed available.
- Developer identity verification visible in Console; personal account.
- Owner explicitly approved Play App Signing terms, Developer Program Policy
  confirmation and US export-compliance certification before app creation.
- Original verified AAB uploaded and accepted as **1 (2.0.0)**, min API 24,
  target API 36, four ABIs. Console confirms ReTrace mapping and native symbols.
- Owner explicitly requested **owner-only access for now**. A one-user email list
  is saved and selected for the internal track. No tester addresses are in Git.
- Release name: **2.0.0 (1) — Internal test**.
- Review validation: **Ready to release** after tester configuration; no remaining
  validation warning displayed.
- Save and publish completed; Console displays **Active**, **Available to internal
  testers**, **Released on Oct 19 10:21 PM**, **Not reviewed**.
- [Internal testing Console](https://play.google.com/console/u/0/developers/6392503807184130481/app/4972244504934472355/tracks/4701357709668059512?tab=releases)
- [Owner opt-in link](https://play.google.com/apps/internaltest/4701357709668059512)
  was opened in the authorized account and visibly shows an invitation to test.
  The owner still needs to accept the invite and install from Play; that action
  was left to the owner. No Play-installed runtime test is claimed.
- Google displays the temporary name **com.sciencebyhugs.pulse (unreviewed)**
  until app setup/review is complete. This is expected for this first internal test.
- No closed-test or production rollout and no merge performed.

Next: owner accepts the invitation and verifies Play installation. Add the wider
pending tester group when ready. Finish app setup/policy/listing requirements and
create the required closed test. The 12-tester / 14-day production-access clock
has **not started**: this release is internal testing only.

Physical-device/authenticated-flow QA, 16 KiB runtime testing, policy/listing
requirements and production approval remain as documented in
`../ANDROID_RELEASE_CHECKLIST.md`. The prior preview APK sign-in smoke test does
not imply full acceptance of the optimized release build.
