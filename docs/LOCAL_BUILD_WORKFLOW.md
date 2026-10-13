# Local build and storage preferences

Anthony's standing instruction (2026-10-12): build Pulse locally only. Do not use an Expo cloud build without asking first. A request to prepare or test changes does not authorize a signed build or TestFlight submission.

## Before a build

Run `python3 scripts/storage-report.py`. Keep at least 30 GiB free as a working target; inspect available space and expected build size before continuing. Use the existing testflight EAS profile for store builds. Production settings are in Git-ignored .env.local. Do not commit environment files, signing material or credentials.

Run `./scripts/build-ios-local.sh` for the signed iOS build. It uses the ignored project-local working directory to avoid macOS /tmp and /var symlink aliases breaking widget imports. Use EAS local-build automatic temporary-directory cleanup. Do not enable EAS_LOCAL_BUILD_SKIP_CLEANUP except when actively debugging a failure; remove the debug directory afterward. Build artifacts belong in a dedicated ignored directory, not scattered through source folders. Check resulting files before removing old artifacts.

## Retention

Keep at most two recent successful IPA files on this Mac. Preserve released IPA files and their matching dSYM symbol files in an external archive before removing local copies. Record version/build number and source commit alongside release artifacts. Never delete the only copy of a release artifact or signing credential for cleanup.

Reclaim temporary build directories, old exports and Xcode DerivedData first. Keep the working project's dependencies between builds. Install no extra Apple platform or simulator runtimes unless needed. Simulator runtimes are not required to build a device IPA for TestFlight.

## Access baseline

Verified 2026-10-12: workspace read/write, GitHub CLI authentication, Expo owner login, native computer access, Xcode 27 command-line selection, first-launch completion and iOS 27 SDK. Fastlane 2.241.0, CocoaPods 1.17.0, Node 24.21.0 and EAS CLI 24.11.0 are installed. Apple signing credentials have not been downloaded or tested in a local signed build. App Store Connect may require reauthentication or 2FA. No broad permission changes are necessary based on this audit.

Storage baseline after installing Xcode: approximately 100 GiB available; project node_modules 569 MiB, npm cache 1.5 GiB, Homebrew cache 687 MiB and CoreSimulator directory 192 MiB. These are a snapshot, not ongoing monitoring.

For unattended local work the Mac must remain powered on, connected to power/network and awake, with the Codex app running. Do not disable FileVault, authentication or other security controls. Any new permission or credential prompt can still interrupt unattended work.

Signing setup note: the Apple WWDR G3 intermediate was downloaded from Apple’s certificate authority and imported into the login keychain on 2026-10-12. No trust override was applied.

First successful local release: Pulse 2.0.0 build 13, submitted to App Store Connect on 2026-10-12. Main app and widget versions were verified in the exported IPA. Local artifacts: 21 MiB IPA and 37 MiB compressed crash symbols, with source fingerprint manifest. EAS removed the working folder and temporary signing keychain/profiles. Apple processing was pending at submission completion.
