# Apple and Google policy release worksheet

Prepared October 12, 2026. Draft policies reflect reviewed repository behavior, not a completed legal or vendor audit. Do not submit placeholder pages or claim approval/compliance from these documents alone.

## Documents

- Privacy Policy: mandatory public privacy information, with an in-app link.
- Consumer Health Data Privacy Policy: separate health-data notice; assess applicable state laws and consent/rights requirements.
- Terms of Use: recommended service agreement; Apple standard EULA can remain the app license unless a compliant custom EULA is selected.
- Health & Safety Notice: tracking limitations, clinician advice and emergency boundary; Google health requirements must be reflected in store description too.
- Device Storage & Cookies Notice: transparency about native/browser storage; no automatic cookie consent banner is added.
- Account & Data Deletion: public deletion instructions plus an operational route to request deletion without installing the app, required for Google account-creating apps.

## Required operator decisions before publication

1. Confirm legal contracting/controller name (individual or registered company), public support/privacy email and business address. Current Apple credentials identify Anthony Hugershoff, but this does not establish the contracting entity.
2. Confirm launch countries/states and minimum age. Implement matching eligibility controls; do not merely put an unenforced 18+ promise in the policy.
3. Confirm Supabase hosting region, configured backup/log retention, email-delivery provider, processor contracts, staff access and any external monitoring. Replace retention draft language with specific verified periods/criteria and justified exceptions.
4. Establish a monitored access/deletion/withdrawal/appeal procedure, ownership verification, legally appropriate deadlines and propagation to processors. Do not require reinstalling for web deletion requests. Avoid collecting health content in the initial request.
5. Assess Washington/Nevada and other consumer health privacy laws, FTC Health Breach Notification Rule and any international obligations for actual markets. Required consent must be specific, recorded, revocable and implemented before covered collection/sharing. Privacy notices are not consent.
6. Confirm actual data sale/advertising/AI practices including vendors; ensure future changes cannot silently invalidate policy statements.
7. Have appropriate counsel review final terms, operator identity, age, regulatory/intended-use claims, health-data notice, liability and dispute provisions. No arbitration, class-action waiver, invented liability cap or assumed governing state is inserted here.

## Publishing

Edit the shared content in src/content/legal.json and keep docs/legal/*.md and public/legal/*.html synchronized before release. The current documents visibly say draft; remove that status only after all blanks and procedures are resolved. Public HTML has no external assets, cookies or analytics. Choose a real HTTPS host; no hosting/domain URL is assumed or published by this task.

Host public/legal as accessible static pages, with no login, geoblocking or broken placeholders. Add a conspicuous separate Consumer Health Privacy link to the public homepage. Verify every policy and deletion URL on a signed-out phone browser. Google requires a publicly accessible non-PDF privacy policy; do not use a shared editable document as the store policy URL. Publish an effective date and version, then implement explicit versioned signup terms acceptance and any separately required health-data consent. Current app links are available from signup, navigation and Account & Privacy but do not impose acceptance of these drafts.

## Apple App Store Connect

- Privacy Policy URL: actual hosted privacy.html URL.
- Support URL: a real support page/channel, not a draft.
- App Privacy responses: account-linked email, optional name/phone, user ID, photos, health/tracking/check-in content and other user-entered content need accurate category/purpose mapping. Review calendar/event processing and provider logs; do not equate on-device-only data with uploaded data.
- Current purposes: App Functionality; assess diagnostics/security processing actually retained by providers. No configured ad tracking is identified, but verify vendor SDK behavior before answering No to tracking.
- Account deletion exists in-app; test the final deployed flow on a disposable account, including photo and associated records.
- Review intended-use and health claims against guidelines 1.4 and 5.1. Keep unsupported clinical claims/calculators excluded. App label/disclaimer is not a regulatory determination.
- Confirm standard Apple EULA selection; a custom EULA must meet Apple's minimum terms.

## Google Play Console

- Privacy Policy URL: actual hosted privacy.html URL; app/developer identity must match the listing.
- Account deletion URL: hosted delete-account.html with working verified web request channel. In-app account deletion alone does not complete the web requirement.
- Data safety: health/fitness information, personal info (email/name/phone/user ID), photos and other user content are collected for account/app features. Distinguish optional fields from mandatory fields. Confirm encryption-in-transit and account deletion assertions against live infrastructure.
- Google defines collected and shared differently; service-provider transfers may qualify for sharing exceptions. Do not blindly mark all Supabase processing as either shared or not shared without checking current definitions and contracts.
- Health apps declaration: complete accurately, including testing tracks where required. Describe routine/medication tracking and check-in features; do not claim Health Connect integration.
- Health policy: include the required clear non-medical-device/no-diagnosis-treatment statement and professional-advice reminder in app and listing where applicable. Verify actual feature/claim classification.
- No advertising ID, precise-location or Health Connect permission is configured in reviewed source. Audit the built manifest/SDKs and third-party services before final answers.

## Reviewed official sources

- Apple guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Google User Data (privacy and deletion): https://support.google.com/googleplay/android-developer/answer/10144311
- Google Health Content and Services: https://support.google.com/googleplay/android-developer/answer/16679511
- Google health declaration: https://support.google.com/googleplay/android-developer/answer/14738291
- Washington health privacy: https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy
- FTC health breach guidance: https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0
- ICO storage/access guidance: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-storage-and-access-technologies/
