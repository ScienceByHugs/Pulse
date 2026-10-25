# TestFlight from GitHub Actions

`.github/workflows/testflight.yml` runs the same `eas build --local` release build as `scripts/build-ios-local.sh`, but on a GitHub-hosted Mac instead of Anthony's. It does not use Expo cloud builds, so it does not consume the Expo free-plan build allowance. Uploading uses Apple's `altool`, not EAS Submit.

The standing rule still applies: a build or upload happens only when Anthony triggers it.

## How a run works

1. Actions → **Pulse TestFlight build** → **Run workflow**.
2. Leave **Upload** off to build and verify only, or turn it on to send the build to App Store Connect.
3. The `testflight` environment pauses the job until Anthony approves it.
4. The job type-checks and tests, builds with the `testflight-ci` profile, then verifies the IPA: bundle id, app and widget versions match, signatures verify.
5. The IPA (renamed `pulse-build-N.ipa`) is kept as a workflow artifact for 90 days, with its SHA-256 and source commit in the run summary. Download it to the release archive; workflow artifacts are not the permanent copy.
6. If Upload is on, the IPA goes to App Store Connect. Apple processing, TestFlight review and device QA are separate steps.

## Build numbers

`testflight-ci` extends `testflight` with `autoIncrement: true`. Build numbers are stored remotely on EAS (`appVersionSource: remote`), so each CI build takes the next number automatically and local builds stay in the same sequence. The existing `testflight` profile is unchanged.

## One-time setup (Anthony)

1. **Environment:** Settings → Environments → New environment `testflight`. Add yourself under **Required reviewers**, and limit deployment branches to `staging` and `main`. TestFlight builds come from `staging`; a build is submitted for App Store review only after `staging` is merged to `main`.
2. **Secrets** (in that environment):

   | Secret | Where it comes from |
   | --- | --- |
   | `EXPO_TOKEN` | expo.dev → Account settings → Access tokens (a robot or personal token for `sciencebyhugss-team`) |
   | `EXPO_PUBLIC_SUPABASE_URL` | The production value from `.env.local` |
   | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The production publishable key from `.env.local` |
   | `ASC_API_KEY_ID` | App Store Connect → Users and Access → Integrations → App Store Connect API (App Manager role) |
   | `ASC_API_ISSUER_ID` | Same page, Issuer ID |
   | `ASC_API_KEY_P8` | Full contents of the downloaded `AuthKey_<id>.p8` file |

   Paste secrets only into GitHub's secret fields; never into chat, issues or commits.
3. **Signing:** the build uses the Expo-managed iOS credentials already set up for this project (`eas credentials`). No certificates are stored in GitHub.

## Runner

The job defaults to `macos-26` and selects the newest installed Xcode 27. If that runner has no Xcode 27, the job stops with a clear error; rerun with a runner label that provides it. macOS runners are free for public repositories.

## What is not covered

- `eas build --local` may not produce a separate `.dSYM.zip`; if none is found the artifact step warns. Keep crash symbols from the IPA archive until a symbols step is added.
- Artifacts of a public repository can be downloaded by signed-in GitHub users. The IPA contains only the public backend values that ship in the App Store build.
