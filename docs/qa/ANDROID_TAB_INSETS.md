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
