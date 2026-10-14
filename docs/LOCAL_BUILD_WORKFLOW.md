# Local build and storage preferences

Anthony's standing instruction (2026-10-12): build Pulse locally only. Do not use an Expo cloud build without asking first. A request to prepare or test changes does not authorize a signed build or TestFlight submission.

## Before a build

Run `python3 scripts/storage-report.py`. Keep at least 30 GiB free as a working target; inspect available space and expected build size before continuing. Use the existing testflight EAS profile for store builds. Production settings are in Git-ignored .env.local. Do not commit environment files, signing material or credentials.

Run `./scripts/build-ios-local.sh` for the signed iOS build. It uses the ignored project-local working directory to avoid macOS /tmp and /var symlink aliases breaking widget imports. Use EAS local-build automatic temporary-directory cleanup. Do not enable EAS_LOCAL_BUILD_SKIP_CLEANUP except when actively debugging a failure; remove the debug directory afterward. After verification/upload, rename pulse-testflight.ipa to pulse-build-N.ipa using its actual build number before another build writes the generic output path. Preserve a conflicting existing release and resolve the conflict rather than overwriting it. Build artifacts belong in a dedicated ignored directory, not scattered through source folders. Check resulting files before removing old artifacts.

## Retention

Aim to keep at most two recent successful IPA files on this Mac once older releases have a verified archive destination. Anthony selected **Keep locally for now** on 2026-10-13; retain the existing release IPAs and matching crash symbols locally until he selects an off-Mac archive destination. Preserve released IPA files and their matching dSYM symbol files in an external archive before removing local copies. Record version/build number and source commit alongside release artifacts. Never delete the only copy of a release artifact or signing credential for cleanup.

Reclaim temporary build directories, old exports and Xcode DerivedData first. Keep the working project's dependencies between builds. Install no extra Apple platform or simulator runtimes unless needed. Simulator runtimes are not required to build a device IPA for TestFlight.

## Access baseline

Verified 2026-10-12: workspace read/write, GitHub CLI authentication, Expo owner login, native computer access, Xcode 27 command-line selection, first-launch completion and iOS 27 SDK. Fastlane 2.241.0, CocoaPods 1.17.0, Node 24.21.0 and EAS CLI 24.11.0 are installed. Apple signing credentials have not been downloaded or tested in a local signed build. App Store Connect may require reauthentication or 2FA. No broad permission changes are necessary based on this audit.

Storage baseline after installing Xcode: approximately 100 GiB available; project node_modules 569 MiB, npm cache 1.5 GiB, Homebrew cache 687 MiB and CoreSimulator directory 192 MiB. These are a snapshot, not ongoing monitoring.

For unattended local work the Mac must remain powered on, connected to power/network and awake, with the Codex app running. Do not disable FileVault, authentication or other security controls. Any new permission or credential prompt can still interrupt unattended work.

Signing setup note: the Apple WWDR G3 intermediate was downloaded from Apple’s certificate authority and imported into the login keychain on 2026-10-12. No trust override was applied.

First successful local release: Pulse 2.0.0 build 13, submitted to App Store Connect on 2026-10-12. Main app and widget versions were verified in the exported IPA. Local artifacts: 21 MiB IPA and 37 MiB compressed crash symbols, with source fingerprint manifest. EAS removed the working folder and temporary signing keychain/profiles. Apple processing was pending at submission completion.


## Submission and verification

Before upload, inspect the exported IPA rather than relying on Xcode's intermediate archive: app/widget marketing and build versions must match, signatures must verify, and matching dSYMs plus source fingerprints must be retained. Check the actual native bundle uses the intended public backend configuration.

On 2026-10-13, build 15 was compiled locally and sent directly from the Mac using Xcode's Apple altool uploader after the queued EAS submission was confirmed canceled. Apple validation and upload returned no errors. Existing ASC API credentials were held only in a temporary private directory and removed after upload. No new key, password or account permission was created. Apple processing and physical-device QA are separate from upload success; see docs/qa/BUILD_15_RELEASE.md.

For a future direct upload, first discover the installed flags with `xcrun altool --help`. Use the existing app-authorized API key via a private temporary file, not inline credential contents, then remove that copy. Do not commit credentials or uploader cache files. Confirm no other submission of the same build is running before switching upload routes. EAS Submit remains an alternative transfer service; it is separate from Expo cloud native builds.

## Same-name signing identities and local export

On October 14, multiple valid distribution identities shared the same display
name. The Expo profiles and distribution certificate matched; selecting by
display name nevertheless caused Xcode to choose another identity. Preserve
the other identities. Compare the existing profiles' certificate fingerprints
with the configured Expo certificate, then set `GYM_CODE_SIGNING_IDENTITY` to
the verified SHA-1 for the local archive command. Do not assume a previously
recorded fingerprint remains current after signing credentials change.

If archive succeeds but EAS export fails, reuse that archive instead of
compiling again. Xcode's local `-exportArchive` supports an explicit
`signingCertificate` SHA-1, `signingStyle: manual`, `destination: export` and a
`provisioningProfiles` mapping by verified profile name. The name mapping
resolved build 17's UUID lookup issue. Temporary profile copies may be needed
in `~/Library/Developer/Xcode/UserData/Provisioning Profiles` as well as the
legacy `~/Library/MobileDevice/Provisioning Profiles` directory. Preserve
existing files; remove only copies created for the attempt. Keep signing
material in a private temporary directory/keychain, restore the previous
keychain search list, and clean up all resources independently if one cleanup
step fails. Verify the final IPA and matching symbols before retaining it.

Build 17 was exported locally and is held without Apple upload at Anthony's
instruction. See docs/qa/BUILD_17_RELEASE.md.
