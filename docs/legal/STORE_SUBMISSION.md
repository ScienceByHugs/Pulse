# Apple and Google policy coverage and publication

Updated October 20, 2026. The owner adopted all six policies effective October 20, 2026. Policy wording was checked against current first-party Apple and Google sources. This is coverage evidence, not an attorney opinion, store approval, or certification that every operational control has been exercised.

## Shared source and effective copies

- `src/content/legal.json`: six bundled policy documents.
- `src/content/legal-meta.json`: one effective date/version and public base URL.
- `scripts/generate-legal-pages.py`: synchronized Markdown, six HTML pages and the public index; CI checks parity.
- `app/legal.tsx`: bundled offline text, effective version and a public-page link; accessible from sign-in, signup and You → Account & Privacy.
- `npm run legal:build`: an isolated static-only public host. No credentials, database binding, account forms, browser scripts, third-party assets or cookies. Its handler does not log requests or read their bodies. Invocation logs/traces are off; provider infrastructure can process connection metadata as disclosed.
- The native app text changes require a later approved build/upload. Existing 2.0.0 (3) Android and current iOS binaries retain their older bundled notices. No version bump, signing change, backend deployment or native release is included here.

## Public URLs

- Index: https://pulse-sbh-legal.sciencebyhugs-pulse.workers.dev/
- Privacy: https://pulse-sbh-legal.sciencebyhugs-pulse.workers.dev/privacy.html
- Consumer health privacy: https://pulse-sbh-legal.sciencebyhugs-pulse.workers.dev/health-privacy.html
- Account deletion: https://pulse-sbh-legal.sciencebyhugs-pulse.workers.dev/delete-account.html

Publication/HTTP verification results are recorded separately in `docs/qa/EFFECTIVE_POLICIES.md`. A URL written in source is not proof of deployment.

## Coverage against current platform requirements

| Requirement | Policy coverage | Separate implementation/store responsibility |
| --- | --- | --- |
| Apple 5.1.1(i): data collected, methods and all uses | Privacy: information provided/generated, feedback, purposes, permissions | Keep Apple App Privacy and actual SDK behavior consistent; provide the public URL in App Store Connect. |
| Apple 5.1.1(i): equal third-party protection | Privacy providers/disclosures: purpose limits, confidentiality, same/equal safeguards; health policy recipients | Maintain actual provider contracts and oversight. This wording does not independently audit every subprocessor. |
| Apple 5.1.1(i): retention, revocation and deletion | Privacy retention/rights; separate deletion page and health-consent withdrawal | Provider copy-specific periods remain unverified; current policies disclose criteria/limits rather than inventing a deadline. |
| Apple 5.1.1(ii), 5.1.2: choice/permission and purpose limits | Optional permissions do not gate core tracking; no unrelated repurposing; separate consent before any legally required new/optional processing | Policy acceptance is not proof of consent. Signup currently records US/18+ eligibility, not versioned terms or standalone health consent. Assess/apply any required consent UX before covered collection; do not falsely claim it already exists. |
| Apple 5.1.3: sensitive health data and advertising | No health-data advertising, sale, AI training or eligibility decisions; no HealthKit/Health Connect integration | Maintain those restrictions and assess intended use/claims separately. |
| Apple account deletion | You → Account & Privacy; confirmed deletion of account/associated data; no support approval for in-app deletion | Source and account tests support flow; fresh end-to-end live deletion/photo/provider checks remain a release QA task. |
| Google User Data: comprehensive accurate policy, operator/contact | Privacy names Pulse/Science By Hugs/operator, data categories, uses, recipients, security, retention/deletion; owner-confirmed business address/contact | Provide public HTTPS URL in Play Console; no PDF, login or geofence. |
| Google account deletion: in-app and outside-app request | Dedicated deletion page prominently explains email request without installation, ownership verification, retained categories/criteria | Monitor the confirmed support inbox; exercise outside-app verification/fulfillment and enter deletion URL in Data Safety. |
| Google Health apps | Separate health-data policy; no medical-device/diagnosis/treatment claim; professional-advice and emergency boundaries | Complete Health apps declaration and use matching store-description language. A disclaimer is not regulatory clearance. |
| Google Data Safety | Source inventory covers email/user IDs, optional profile/name/phone/photo, health/log/inventory/check-ins, feedback, platform/build and provider metadata; on-device versus synced distinctions | Submit accurate collection/sharing, purposes, optionality, security and deletion answers after owner/provider review. Policy publication does not submit the form. |
| US consumer health transparency | Separate conspicuous health-policy link, categories/sources/purposes/recipient categories, consent/withdrawal and access/deletion/appeal routes; no health-data sale or healthcare geofencing | Determine applicable state duties, deadlines, authorized-representative verification and processor propagation; implement separately required consent before covered use. |

## Adopted scope and operational limits

Operator/contact/address, US/18+ eligibility, free beta, no marketplace/affiliate/sponsored content, and no active promotional email are based on recorded owner decisions and reviewed code. Only requested tracking, sync, reminders, calendars, optional check-ins/photos, feedback and exports are described. Unconfirmed-account cleanup exists as an owner-operated tool but is not activated/scheduled; no automatic 30-day deletion promise is made.

Supabase's current DPA and residency/retention FAQ were reviewed. The last documented live primary-region inspection is October 12, 2026 (us-east-2). Provider backup/storage-recovery/internal-log periods and any external operational arrangements are not fully verified. The adopted policies explicitly explain these limits, retention criteria and recovery/deletion handling; do not turn whole-project deletion guidance into a guarantee about a single user's backups. A support request, consent mechanism or legal review has not occurred merely because a document was adopted.

No mandatory arbitration, class-action waiver, fixed liability cap or exclusive jurisdiction clause was invented. Apple’s applicable download license is distinguished from Pulse service terms. Confirm the App Store Connect license selection independently.

## Remaining beta submission work

Reviewer account/access instructions; store listing/assets/category/contact; ads, content rating, audience, government, financial and health declarations; accurate Data Safety; public policy/deletion URLs in store metadata; live account/export/deletion and consent QA. Then revalidate the prepared closed-track draft and submit to Google review. Existing internal release/tester access remains unchanged.

## First-party sources reviewed October 20, 2026

- Apple App Review Guidelines 5.1.1–5.1.3: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- Google account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Health Content and Services: https://support.google.com/googleplay/android-developer/answer/16679511
- Supabase DPA: https://supabase.com/legal/customer-resources/data-processing-addendum
- Supabase residency/retention: https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
- Supabase subprocessors: https://supabase.com/legal/customer-resources/subprocessor-list
