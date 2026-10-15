# Pulse privacy-request procedure

Prepared for Anthony Charles Hugershoff, operating under the registered Science By Hugs DBA. Owner adoption and attorney review are pending. This is an operator runbook, not a statement that each step has been exercised in production.

## Intake and ownership

Anthony monitors legal@sciencebyhugs.com for access, correction, withdrawal and appeals, and support@sciencebyhugs.com for account deletion/support. Forward requests internally to the same owner where appropriate; do not make a requester start over at the other inbox.

Ask initially for the account email, requested action and a brief description. Never ask for a password, authentication token, injection history, health notes or identification document by email. An email from the account address alone is not sufficient proof of ownership for disclosure or deletion.

Use the signed-in account's export/deletion controls when the requester can access them. A person requesting deletion must also have a route that does not require reinstalling Pulse. If the requester cannot sign in, use the provider's normal verified account-recovery flow and a signed-in web session, or another proportionate procedure approved by counsel. Never manually mark an email confirmed, reset a password for the requester or disclose records based only on knowledge of their email address. If account recovery is unavailable, escalate to the owner/attorney for a documented verification route rather than closing the request.

Do not confirm whether an account exists before ownership is established. Give a neutral acknowledgment. Requests made by representatives require appropriate authority checks; counsel must define these checks.

## Track and respond

Use a private owner-controlled request register outside the public Git repository. Keep it encrypted/access restricted. Record a random case ID, receipt date, request category, applicable jurisdiction/deadline, verification status, action dates, provider follow-ups and outcome. Keep any account-email mapping separately with restricted access. Do not copy tracking records, passwords, health content or photo exports into the register.

Target acknowledgment within three business days. This is an internal service target, not the deadline for fulfillment. Counsel must supply a jurisdiction/deadline matrix, permissible extensions, appeal deadlines and required notice language before public launch. Receipt dates must be retained even while verification is underway; do not automatically reset the legal clock after verification.

Process verified requests as follows:

| Request | Operator action | Evidence of completion |
| --- | --- | --- |
| Access/export | Use the account-scoped export. Provide a secure authenticated download or approved delivery route, not an unencrypted attachment with health records. | Scope checked, export delivered, temporary copies removed. |
| Correction | Use supported correction/profile controls; preserve audit history where appropriate. Explain any lawful limitation instead of silently replacing history. | Requested fields checked and result communicated. |
| Deletion | Use the authenticated deletion flow or a reviewed administrative workflow after ownership verification. Remove the profile photo through Storage API, delete account/associated active records, and verify absence. | Account and related active rows/photo verified removed; provider follow-ups recorded. |
| Withdrawal | Disable the specified optional processing. Explain which core features depend on the requested data; offer deletion when appropriate. | Optional setting/processing stopped and scope explained. |
| Appeal | Record separately, review the original decision and provide reasons and required escalation/contact information. | Decision and applicable regulator/escalation route communicated. |

Do not run deletion SQL or rely on a screenshot alone as completion. Do not download whole production tables to answer a single request. A provider backup is not an active account. If recovery from a backup is ever needed, apply a privately maintained deletion register before reopening the restored service so previously deleted accounts do not become active again.

## Providers and retained copies

Supabase is the reviewed backend provider. Verify actual deletion/retention and required processor propagation with Supabase; use PROVIDER_RETENTION_AUDIT.md for current limitations. A one-day dashboard log window does not establish deletion of every internal security log. Do not promise immediate erasure from all backups.

Exports, screenshots and third-party calendar copies independently created/shared by users may remain outside Pulse. Explain this without using it as a reason to retain active Pulse records. Verify any legally required exceptions before retaining data and document their category, purpose and period.

The attorney must set the minimum necessary retention for request/verification/deletion registers and lawful exceptions. Do not keep identification material or request correspondence indefinitely. A separate incident response plan is needed for suspected health-data breaches; a privacy request must not trigger an uncontrolled disclosure of another person's records.

## Before using this process publicly

Exercise export and deletion on an owner-designated disposable test account, including profile-photo removal and account data isolation. Confirm the public deletion page loads without login and the owner can receive/track its requests. Do not treat prepared email wording, a script or an unpublished page as an operational service. Complete the deadline/verification matrix with counsel and set a real policy effective date only after adoption.

Reviewed references:

- [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play user data and deletion](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Washington consumer health privacy](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy)
- [Supabase residency and retention](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq)
