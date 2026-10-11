# Pulse beta release plan — October 11, 2026

Targets: internal TestFlight Friday, October 16; external TestFlight by Sunday, October 25 (America/Los_Angeles). External availability depends on Apple beta review.

## Implemented and verified

- Corrected email validation used by signup, reset, resend, and email changes.
- Moved native auth sessions and calendar connection metadata to chunked SecureStore, with migration of existing AsyncStorage values. Browser storage remains browser-local AsyncStorage; this is not an encryption claim for web.
- Protected native pending logs and partitioned the queue by account. Serialized queue writes prevent simultaneous logs from overwriting one another.
- Fixed private-notification defaults. Removed scheduled and delivered notifications and cleared the widget preview when signed out.
- Bounded reminders to the nearest 60 events, honored protocol end dates and per-day time overrides. The rolling window refreshes when Pulse opens; reminders are not a safety-critical alarm system.
- Removed dosage/reconstitution/syringe calculators from all beta app routes, as requested. No reviewer-specific hiding or alternate public behavior.
- Removed automatic injection-site selection. Users explicitly record their chosen site.
- Added About & Safety; improved sign-in keyboard scrolling, accessible field labels, decorative-layer clipping, and secondary text contrast.
- Paginated exports and included inventory adjustment history. Exports are not a transactional snapshot and can change if records are edited during export.
- Added a store-distribution `testflight` EAS build profile. EAS `distribution: internal` is ad hoc distribution, not internal TestFlight.
- Applied two migrations to PULSE2.0 (`bxgcntumsyxjfnxenmqm`): `beta_privacy_hardening` and `enforce_owned_relationships`. These restrict correction RPC access, enforce parent ownership, and repair account-deletion cascades. They did not delete existing user data.
- TypeScript and security regression tests passed. Live SQL tests used generated fixtures inside a rolled-back transaction: confirmed-owner correction and audit succeed; unconfirmed, anonymous, cross-account correction/read, and cross-account parent links are denied; deletion cascades succeed.
- iOS and Android JavaScript/Hermes bundles exported. Sign-in was inspected in the browser at 390 × 844. These checks do not validate native compilation or authenticated device UI.

## Remaining release gates

| Target | Gate | Evidence needed |
| --- | --- | --- |
| Oct 12 | App Store Connect record | Pulse app registered with `com.sciencebyhugs.pulse`; membership is ready, app record is not yet confirmed |
| Oct 12–13 | Signing and EAS production environment | Apple team/signing credentials and both public Supabase environment variables configured for the store build |
| Oct 13–14 | Signed release candidate | Successful EAS iOS build including widget extension and calendar module; uploaded build processes in App Store Connect |
| Oct 14–15 | Physical iPhone QA | Fresh install, signup/verification, reset deep link, session upgrade, logging and duplicate prevention, inventory, export, account deletion, account switching, Face ID, calendar privacy, widgets, notification permission and delivery, timezone changes, keyboard and large text |
| Oct 16 | Internal TestFlight | Internal group installed and exercised the actual App Store Connect build; no critical defect |
| Oct 19–21 | External readiness | Hosted privacy policy and support URLs, accurate privacy disclosures, review credentials/notes, beta feedback contact, review of intended use and claims by qualified healthcare/privacy counsel |
| By Oct 25 | External TestFlight | Apple beta approval plus an install/QA pass by an external tester |

Use `eas build --platform ios --profile testflight` then `eas submit --platform ios --profile testflight` once signing and the App Store Connect app record are ready. Neither a signed build nor upload was performed in this pass.

## Risks and follow-up

- Supabase's live security advisor still reports leaked-password protection disabled. Enable it if supported by the project's plan; verify confirmation, password policy, rate limits and redirect allowlist in the Auth dashboard. The current connector does not expose these settings.
- The authenticated SECURITY DEFINER warning for inventory correction is intentional: clients cannot directly insert audit records. The function explicitly checks confirmed identity and ownership and pins the search path. Anonymous EXECUTE is revoked. Retest these conditions after future schema changes.
- `npm audit` reports 21 findings (14 high, 7 moderate), primarily in Expo/Metro/build tooling and transitive braces, node-forge, and uuid. The audit's suggested automatic fix downgrades Expo to SDK 44 / React Native to 0.72; do not run that forced fix. Assess patched upstream versions and build-tool exposure before releasing. A development server must not be exposed publicly.
- React Native is pinned to `0.88.0-rc.3`. Existing JavaScript exports succeed, but a successful native EAS build and device QA remain mandatory. Apple Health is not implemented in this beta.
- Legacy offline queues lack an owner. They are moved to private storage under `pulse.quick_log_outbox.unassigned` and are never automatically replayed into an account. If such a queue exists on an existing installation, recover it explicitly before treating upgrade QA as passed. New queues are account-scoped.
- Session validation contacts the Auth server; cold-start offline access is limited. Do not market the beta as fully offline-first.
- SecureStore can persist across iOS reinstall. Test both upgrade and reinstall behavior, and never rely on the local queue as the only copy of irreplaceable records.
- Shared exports and phone-calendar copies are outside Pulse. Account deletion does not recall those copies; the confirmation and About screen explain this.
- No engineering change or disclaimer guarantees immunity from lawsuits. Regulatory applicability depends on actual functionality, claims, intended use, data practices, and jurisdiction. Keep claims descriptive and obtain qualified review of privacy terms and intended use before external distribution.

## Primary references

- [Apple App Review Guidelines, including 1.4.1–1.4.2 and privacy requirements](https://developer.apple.com/app-store/review/guidelines/)
- [Apple TestFlight device testing and beta review](https://developer.apple.com/help/app-review/before-submitting-for-review/test-compatible-devices)
- [Expo iOS submission](https://docs.expo.dev/submit/ios/)
- [Expo internal/ad hoc distribution](https://docs.expo.dev/build/internal-distribution/)
- [Expo SecureStore behavior and size limits](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [FTC Health Breach Notification Rule](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
- [FDA device software and mobile medical applications](https://www.fda.gov/medical-devices/digital-health-center-excellence/device-software-functions-including-mobile-medical-applications)
- [Supabase leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
