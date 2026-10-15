# Pulse 2.0.0 (17) — local build, submission held

Built from c71b5a6 on codex/login-flow-polish on October 14, 2026.
Anthony requested a local build containing the vial label alignment fix and
explicitly held TestFlight submission. No native cloud build or Apple upload
was performed for this release.

## Included change

The illustrative vial label scales with its image in thumbnails and the
enlarged view. Name and quantity have fixed centered areas, long names wrap
within the label, and brand/research text uses the same image coordinates.
This release includes the existing build 15 functionality as well.

## Verification

- TypeScript, 88 tests, configured icon/assets and local browser label review passed.
- Xcode release archive and local App Store export succeeded.
- Exported main app and widget both report version 2.0.0/build 17.
- Strict/deep signature checks passed; both use App Store provisioning with debug signing disabled.
- Main app and widget binary UUIDs match retained crash symbols.
- The native JavaScript bundle contains the new label text and expected public production backend configuration. The private admin overview RPC is absent.
- Numbered IPA, compressed crash symbols and source/artifact fingerprints are retained in ignored local-builds/. Older release artifacts remain local at Anthony's instruction.

## Signing/export repair

Attempt 16 failed before archive because Xcode selected another same-name
distribution identity. Selecting the existing Pulse certificate by SHA-1
allowed archive 17 to complete. EAS export still encountered identity/profile
lookup issues; the completed archive was exported locally with Xcode,
explicit certificate selection and verified profiles selected by name.
Temporary profiles were installed in the legacy and current Xcode profile
folders and removed afterward. The temporary keychain/private signing files
were removed and the original keychain search list restored. Other projects'
certificates and profiles were preserved. Profiles match those in build 15.

See docs/LOCAL_BUILD_WORKFLOW.md for the fingerprint/profile-name workaround.

## Still pending

Physical iPhone/Android font rendering and device behavior remain unverified.
Expo Doctor passed 19 of 20 checks; its package-version alignment check flagged
15 existing dependencies. No dependency upgrade was included in this label
fix. Dependency alignment and npm's reported advisories need a maintenance
review before a public release.

Build 17 is held locally. It has not been uploaded, processed by Apple or
made available in TestFlight. Build 15 remains the previously uploaded build.
