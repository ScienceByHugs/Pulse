# Android tab-content position follow-up

The owner's photo of internal version 2 shows excess visual space below the tab labels. Keep the full Android system-bar inset and the existing 88 dp bar height, but move the icon/label content down 6 dp by changing Android's fixed top/bottom padding from 7/12 dp to 13/6 dp. Both padding totals stay 19 dp; the usable area stays 69 dp plus font-scale growth. iOS/web retain 7/12 dp. Keyboard hiding and screen safe-area handling are unchanged.

Validation:

- TypeScript passed; 113 Node tests passed. Existing inset tests now also assert the new Android top/bottom padding, invariant content area, and unchanged iOS/web geometry.
- Production-entry preview APK generated; assemblePreview and lintPreview passed (0 errors, 36 warnings).
- Signature and 16 KB zip alignment verified.
- APK SHA-256: `77ec5a33c97d60f7eabb35a51df27de8ec6f3af9199f8a883a2a91ea472ef40d`.
- Retained ignored APK: `local-builds/nav-qa/lowered-content-preview.apk`.

This follow-up does not change versions, signing, services, credentials, or iOS configuration. No AAB built or uploaded; Google Play internal version 2 is unchanged. No merge performed.

Native visual QA used the actual production TabsLayout in the existing isolated offline fixture, with synthetic auth and fixture screens. On API 36, gesture (24 dp inset) and three-button (48 dp inset) layouts clear system navigation with the slightly lower labels/icons. In three-button mode the standard keyboard hides tabs and dismissal restores them at the adjusted position. Original emulator navigation/input preferences were restored. No authenticated Samsung-device run or iOS runtime run is claimed.

Evidence: [gesture](android-tab-position/gesture.png), [three-button](android-tab-position/three-button.png), [keyboard](android-tab-position/keyboard.png), [restored](android-tab-position/restored.png).
