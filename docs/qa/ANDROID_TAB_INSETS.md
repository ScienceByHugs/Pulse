# Android bottom tab system-bar spacing

## Cause and fix

Pulse uses Expo SDK 58 / React Native 0.88, Expo Router's React Navigation bottom tabs, and react-native-safe-area-context. Android runs edge-to-edge with adjustResize. The five screens already use SafeAreaView and scroll-content bottom spacing.

The custom tabBarStyle explicitly sets height and paddingBottom. React Navigation returns the explicit height and applies the custom padding after its default inset padding, so the original 88 dp / 12 dp values displaced automatic system-bar handling.

TabsLayout now adds useSafeAreaInsets().bottom to both height and bottom padding on Android only. The content area remains 69 dp (plus the existing font-scale allowance). No extra navigator SafeAreaView or screen padding is added. iOS/web retain their existing dimensions; tabBarHideOnKeyboard remains enabled. No native, signing, service, or environment configuration changed.

## Automated checks

- TypeScript: passed.
- Node tests: 113 passed, including 11 navigator-option regression cases covering Android bottom insets 0/24/48 dp, font scales 1/1.5/2, unchanged iOS/web dimensions, five routes, keyboard hiding, and invariant usable height.
- Standalone production-entry preview APK: assemblePreview + lintPreview passed; lint reports 0 errors / 36 warnings.
- APK signature and 16 KB zip alignment verified.
- APK SHA-256: bd35a50eec5dd4c86d6ecc5a6406be06839b3d80e2493695aa4bb5bef586dd48.
- Ignored artifact: local-builds/nav-qa/fixed-preview.apk (also local-builds/android/app-preview.apk).

The prior preview APK was preserved in local-builds/nav-qa/baseline-preview.apk. Existing release AAB and upload credentials were untouched. No Play upload, merge, or deployment performed.

## Native validation

Native validation uses an ignored, isolated com.sciencebyhugs.pulse.insetqa APK. It imports the actual production TabsLayout, Expo Router, native icons, and safe-area implementation, with synthetic offline auth and fixture screens containing a TextInput and the same SafeAreaView/content-bottom pattern. This does not exercise authenticated production data flows. The QA build is not the installable production-entry artifact above and must not be uploaded to Play.

Re-run the source checks with `npm run typecheck` and `npm test`; build the normal artifact with `npm run android:apk`. In the device test, switch System navigation between Gesture navigation and 3-button navigation, verify all five labels/icons clear the system bar, open a text field, verify the tabs hide while typing, dismiss the keyboard and verify the tabs return without a large residual gap. Scroll each authenticated screen to its final control on a real tester account before release.

### Android 16 / API 36 native results

| Navigation | Reported bottom inset | Keyboard hidden | Keyboard visible | After dismissal |
| --- | --- | --- | --- | --- |
| Gesture | 24 dp | Five tabs clear the gesture handle | Tabs hidden; input visible | Tabs restored at original spacing |
| Three-button | 48 dp | Five tabs clear the system buttons | Tabs hidden; input visible | Tabs restored at original spacing |

Switching navigation modes updated the inset live without restarting the app. Standard Gboard IME was used. The emulator's original gesture overlay, hardware-keyboard IME preference, and default handwriting setting were restored afterward.

Evidence (offline fixture, not production account screens):

- [Gesture](android-tab-insets/gesture.png), [keyboard shown](android-tab-insets/gesture-keyboard.png), [restored](android-tab-insets/gesture-restored.png)
- [Three-button](android-tab-insets/three-button.png), [keyboard shown](android-tab-insets/three-button-keyboard.png), [restored](android-tab-insets/three-button-restored.png)

Limitations: no authenticated production flow or iOS simulator run was performed. iOS behavior is guarded by regression tests and the Android-only branch; a real tester should confirm final scroll controls and the device-specific appearance before the next Play upload. No AAB was rebuilt for this UI fix.

## Owner-approved internal release — 2026-10-20

After the initial fix PR, the owner explicitly requested sending the update to Google Play. Android versionCode was increased to 2 in app.json and the native Gradle project; versionName remains 2.0.0. iOS build numbers and signing are unchanged.

- Source commit for bundle: `2055e44`.
- Local `npm run android:aab`: passed in 3m 54s; bundleRelease + lintRelease passed, 0 errors / 36 warnings.
- AAB generated: `local-builds/android/pulse-2.0.0-2/pulse-2.0.0-2.aab`; 71,161,826 bytes.
- SHA-256: `22a734383c974da2bfc064a3fcb558fa7e55803af33714f6e1b3e4141436c6f1`.
- bundletool 1.18.3 validation passed. Package, version code 2, versionName 2.0.0, target 36, non-debuggable manifest and all four ABIs verified.
- jarsigner reports jar verified, with the same self-signed/no-timestamp/manifest-order warnings documented for version 1. Upload certificate matches the existing protected upload key.
- Production entry verified in the release source map: real AuthProvider present, no offline nav-qa fixture sources. Embedded JS bundle present.
- All 52 64-bit native libraries have ELF LOAD alignment >=16 KiB (static check; no 16 KiB runtime claim).
- AAB, mapping, debug symbols and provenance retained in the ignored versioned archive; prior version 1 archive preserved.
- Google accepted version 2 with ReTrace mapping and native symbols; release review reported Ready to release and no loss of supported devices.
- Published only to the existing internal test. Console confirms Active, latest release **2.0.0 (2) — Android navigation fix**, **Available to internal testers**, released Oct 20 at 2:17 AM, Not reviewed.
- Existing tester access and opt-in link unchanged. Google indicates propagation usually within 1 hour, occasionally longer. No Play-installed runtime check claimed.
- No production/closed rollout or GitHub merge performed.

[Play Console confirmation](android-tab-insets/play-internal-version-2.png)
