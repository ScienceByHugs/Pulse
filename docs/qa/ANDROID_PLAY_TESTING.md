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
  by bundletool; Google Play server acceptance is still unverified. No signing
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

**Not uploaded. No testing release or tester opt-in link has been created.**
The in-app browser's Play Console session requires the owner's Google passkey
sign-in. The work-domain account displayed the new-developer signup flow; the
personal account is at the passkey challenge. Owner must sign in to the verified
developer account. No new developer account was created, and no terms accepted.

After sign-in: inspect the app and signing state, upload to internal testing,
verify server acceptance/pre-launch checks, then prepare the required closed test
and obtain its opt-in link. Collect tester addresses or the owner's tester group
through Console, without committing their details. The owner confirmed the new
personal-account testing gate: at least 12 testers continuously opted in for
14 days, followed by a production-access application. That clock has not started.

Physical-device/authenticated-flow QA, 16 KiB runtime testing, policy/listing
requirements and production approval remain as documented in
`../ANDROID_RELEASE_CHECKLIST.md`. The prior preview APK sign-in smoke test does
not imply full acceptance of the optimized release build.
