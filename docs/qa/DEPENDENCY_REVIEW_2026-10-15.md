# Dependency review — October 15, 2026

## Release boundary

Build 17 remains held locally. This review does not change its IPA, dependencies, or submission status. No native build or upload was performed.

## Audit findings

`npm audit --json` reports 22 affected package entries (14 high, 8 moderate), propagated from three underlying advisories. `npm ls braces node-forge uuid --all` traced these to Expo/Metro and Xcode project tooling. No direct imports were found in app, src, or scripts. This is a dependency-path review, not proof of complete runtime unreachability or a full security assessment.

| Dependency | Installed path and assessment | Follow-up |
| --- | --- | --- |
| braces 3.0.3 | Expo → Metro → metro-file-map → micromatch. Deeply nested patterns can exhaust the Node stack. | Advisory lists no patched version. Keep untrusted patterns out of build configuration; reassess when upstream publishes a fix. |
| node-forge 1.4.0 | Expo CLI and its code-signing-certificate helper. Advisory concerns RSA signature verification. | Advisory lists no patched version. Do not dismiss because it is tooling. Track upstream remediation; native Apple signature checks are separate and do not resolve this advisory. |
| uuid 7.0.3 | Expo config plugins → xcode 3.0.1. Inspected xcode code uses `uuid.v4()` without an external output buffer; the advisory concerns v3/v5/v6 buffer handling. | Affected operation was not found in the inspected consumer. Prefer an upstream xcode update; avoid an untested major-version override merely to clear the counter. |

Sources checked:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv
- https://github.com/advisories/GHSA-w5hq-g745-h8pq

Do not use `npm audit fix --force`: the proposed resolution includes downgrading Expo to 44.0.6 and React Native to 0.72.17, incompatible with this project's SDK 58 baseline.

## Compatibility review

The compatible SDK 58 patch updates were installed and locked. `npx expo-doctor` now passes all 20 checks. Current targets are:

```
@expo/ui ~58.0.17
expo ~58.0.10
expo-asset ~58.0.15
expo-constants ~58.0.12
expo-dev-client ~58.0.13
expo-file-system ~58.0.9
expo-image-manipulator ~58.0.14
expo-linking ~58.0.13
expo-notifications ~58.1.4
expo-router ~58.0.19
expo-sharing ~58.0.18
expo-widgets ~58.0.17
react-native 0.88.0-rc.4
react-native-gesture-handler ~3.3.0
react-native-reanimated 4.7.1
react-native-safe-area-context ~5.10.1
react-native-screens ~4.30.0
react-native-web ^0.21.4
@types/react-dom ~19.2.3
```

These include native framework and navigation changes, not just security patches. Keep the completed label-fix release reproducible: this update has not been built or submitted. Before the next release, run a local native build and physical-device checks of navigation, gestures, notifications, and widgets. Requery recommendations at that time; these targets can change. Compatibility alignment alone is not evidence that the three advisories are resolved.

## Validation scope

Registry audit, dependency tree inspection, advisory review, dependency installation, TypeScript, the full 88-test suite, and Expo Doctor completed. The audit still reports the same 22 entries because npm's available remediation would downgrade Expo and React Native across major versions. Outstanding advisories remain open; no security clearance is claimed. No native build or upload was performed.
