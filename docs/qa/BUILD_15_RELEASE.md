# Pulse 2.0.0 (15) local TestFlight build

Source: ed557c9 on codex/login-flow-polish (draft PR 90). Built locally at Anthony's request on 2026-10-13; no Expo cloud native build. Apple local archive validation and direct upload succeeded. The EAS submission stayed IN_QUEUE and was confirmed CANCELED before starting the direct Apple altool upload. Apple delivery UUID: 164c3c14-204b-4164-bf4d-6c2d7054aef9. App Store Connect subsequently confirmed processingState VALID, internalState IN_BETA_TESTING and externalState READY_FOR_BETA_SUBMISSION. Build 15 is available for internal TestFlight testing; external beta review has not been submitted. Temporary submission credentials were removed after upload.

Canceled EAS submission job: https://expo.dev/accounts/sciencebyhugss-team/projects/pulse/submissions/7c79051f-c71d-4f25-91b9-f40a56af6e7b
App Store Connect: https://appstoreconnect.apple.com/apps/6821774422/testflight/ios

Since build 14, this includes shared typography and spacing across pages/sheets, responsive Timeline period controls and in-app Help & feedback with owner-scoped history/status, optional reply-email consent off by default, and durable idempotent retries. Six policy drafts contain the corrected Science by hugs / PMB 147 mailing address and line order. Policies retain their draft/effective-date status. The admin web portal is hosted separately and excluded from the native bundle; dedicated owner account setup remains pending.

## Verification completed

- Latest source CI: TypeScript, 88 tests, assets, synchronized policy output and iOS/Android/web JavaScript plus standalone portal compilation passed.
- Local Xcode release archive and App Store export succeeded. Exported app and widget both have version 2.0.0/build 15. Xcode emitted an extension-version warning for its intermediate archive; the exported IPA was separately verified to contain matching build 15 for both targets.
- Codesign deep/strict verification passed; App Store provisioning is used and get-task-allow is disabled.
- The exported main app and widget UUIDs match their saved crash symbols.
- Actual native bundle contains the expected production backend URL/public key, feedback RPC and corrected PMB text. Admin counts RPC is absent from the native bundle.
- IPA is approximately 20.8 MiB; matching compressed crash symbols approximately 37.5 MiB. Source fingerprints, artifact hashes, bundle versions/UUIDs and submission information are in ignored local-builds/build-15-source.json.
- Temporary local build/signing workspace was cleaned automatically; approximately 90.8 GiB remained free. Existing release IPAs/symbols stay local at Anthony's explicit instruction. No older release file was deleted.

## Device testing still pending

Installation/upgrade, keyboard/safe area, large text/VoiceOver, feedback submission/history/contact consent and offline/relaunch behavior require the new TestFlight build on a physical iPhone. Automated/browser/signature checks do not complete these device cases. Public App Store release and external beta-review approval are not asserted by an upload.
