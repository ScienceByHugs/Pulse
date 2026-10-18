# Pulse release status

Evidence reviewed October 17, 2026 (Pacific), October 18 UTC. Repository baseline: `ece6e4137eb979d6c195d2c5f96ed153aba8fa2f`. This is the current status entry point; older dated plans are historical snapshots.

## Verified repository state

- Main CI run [38792383203](https://github.com/ScienceByHugs/Pulse/actions/runs/38792383203) passed TypeScript, tests, assets, policy synchronization, all-platform JavaScript exports and admin hosting compilation.
- PR #90's head equals main; closed as already incorporated. #48 was superseded by merged #50. #49/#51 were superseded by merged #52; all three old drafts were closed.
- No new signed build, store submission, deployment, DNS or SMTP configuration change is included in stabilization work.
- Tracked-file path inventory contains `.env.example` but no `.env`, signing profile/key, IPA, output directory or retained native archive. This path check is not a historical secret scan.

## Native build evidence

| Build | Source | Repository evidence | Remaining verification |
| --- | --- | --- | --- |
| 15 | `ed557c9e9b7243099f9bfa6b57039352173a1305` | BUILD_15_RELEASE.md records Apple upload and internal beta processing | Current installed/external tester build and physical-device results |
| 17 | `c71b5a6` | BUILD_17_RELEASE.md records a verified local IPA; submission held | Do not substitute for the updated source |
| 18 | dependency update starting at `51710a9`, followed by config commits through `ece6e413` | October 15 release notes record credential validation failure before compilation; no IPA/upload | Resolve signing on the owner's Mac, then record the exact clean checkout and configuration actually used |

The owner reports external beta availability. The repository alone cannot establish which build is currently installed or Apple's latest distribution status. App configuration carrying build number 18 does not prove build 18 exists. #92 remains the release-traceability task; never assign the current main SHA to a previously built IPA without evidence.

## Active work

| Priority | Work | Tracker / owner | Completion evidence |
| --- | --- | --- | --- |
| P0 | Auth email delivery and mobile returns | #91 / ScienceByHugs, engineering implementation | Approved Pulse sender; verified SMTP/DNS settings and small controlled delivery test; signup/reset/email-change return on device |
| P0 | Source-to-installed-build reconciliation | #92 / ScienceByHugs | TestFlight About/version, Apple build record, clean local source and matching artifact fingerprints |
| P0 | Native acceptance | #68 / ScienceByHugs, device tester | Build-tagged iPhone results for auth, privacy, offline exactly-once logging, calendar, notifications, widget and sharing |
| P1 | Dependency advisories | #93 / ScienceByHugs | Compatible upstream remediation or documented residual risk; revalidate native builds after dependency changes |
| P1 | GitHub safeguards and branch retirement | GITHUB_MAINTENANCE.md / #33 | Enforced main checks/review, deletion setting, lease-checked branch cleanup |
| P1 | Android readiness | #68 and ANDROID_RELEASE_CHECKLIST.md | Native Android build and device QA, then signed AAB/Play track evidence |

Do not close release blockers solely because code is merged or CI is green. Keep existing launch availability distinct from approval of the next candidate.

## Stabilization validation

The auth-email patch adds a shared in-memory send lock and cooldown for signup, reset, resend and email change; plain Supabase rate-limit errors extend the wait. It never automatically retries, stores an email address, or changes server settings. Native delivery remains unverified. Test/CI results for the patch are recorded on its PR.
