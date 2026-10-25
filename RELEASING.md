# Releasing pulse.

The same rules apply in every Science By Hugs repository: Core, Nexus, Pulse and the website.

## Branches

| Branch | Means | Who changes it |
| --- | --- | --- |
| `main` | The release line: what is in the App Store, Google Play and TestFlight | Pull request only, merged by Anthony |
| `feat/…`, `fix/…`, `design/…`, `ci/…`, `docs/…` | One piece of work | Anyone; deleted automatically after merge |
| `archive/2026-10-25` | Old branches kept for reference (see `ARCHIVE.md` on that branch) | Never merged |

- Nobody pushes straight to `main`. Changes go through a pull request with CI passing.
- Work branches start from `main` and target it.
- Stacked work (one PR building on another) points each PR at the branch before it, so every PR shows only its own changes. Merge from the bottom up.

## Versions

pulse. uses `MAJOR.MINOR.PATCH`:

- **MAJOR**: a new generation of the app (1.0 → 2.0).
- **MINOR**: new features.
- **PATCH**: fixes only.

Each iOS build also has a build number that only goes up (EAS stores it remotely; see `docs/TESTFLIGHT_CI.md`). Android uses `versionCode` the same way.

Past builds (13, 15, 17 and later) are not tagged yet. Tag them only from recorded evidence (source fingerprints in the release notes), never by guessing the commit; see issue #92.

## Tags and releases

Every build that leaves the building gets a git tag and a GitHub Release.

| Kind | Tag | Example |
| --- | --- | --- |
| TestFlight / App Store build | `pulse-vX.Y.Z+BUILD` | `pulse-v2.0.0+28` |
| Android build | `pulse-vX.Y.Z+android.CODE` | `pulse-v2.0.0+android.3` |

The release notes say what changed, the exact commit, and how it was verified (CI run, device checks). Include the IPA or AAB SHA-256 and keep the build and its crash symbols, as `docs/LOCAL_BUILD_WORKFLOW.md` describes.

Never tag a commit you can't prove the build came from.

## Approvals

- Draft PRs, branches and CI changes: anyone.
- Merging, deploying, signed builds, TestFlight or App Store uploads, and production changes: **Anthony only, each time, for that specific action**.
- Staging work never touches production backends.

## Restoring an archived branch

```sh
git fetch origin archive/2026-10-25
git show origin/archive/2026-10-25:ARCHIVE.md   # find the branch and its commit
git push origin <commit>:refs/heads/<branch>
```
