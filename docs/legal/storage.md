# Device Storage & Cookies Notice

Draft — not yet effective.

## Scope

This draft describes storage in the reviewed Pulse app and its standalone policy pages. A separate marketing website or future SDKs must be audited independently. Version: 2026-10-13; effective date pending publication.

## Native app

Pulse uses platform secure storage for authentication sessions, cached records and pending tracking events. Local app preferences support notification privacy, biometric lock and related settings. Device/OS settings may also affect backups and storage. Temporary generated PDF files are removed after sharing completes; copies you save remain in your selected destination. Optional substance photos are stored per account/substance on this device, not uploaded to Pulse or an image-generation provider. Unconfirmed creation requests retain their identifiers and original input in private device storage so interrupted saves can be retried without duplicating records. Successful requests are cleared; remaining requests can be included in an account export from that device.

## Web app

The web app uses browser storage for sign-in sessions and app state. This is not the native secure-store implementation. Signing out ends local authenticated use; account deletion removes associated synced data. Clearing browser storage can remove cached and unsynced information and sign you out.

## Policy pages and optional tracking

The generated standalone policy pages do not set cookies, load analytics, embed third-party fonts, or use advertising trackers. A hosting provider can still process connection logs. No advertising/analytics SDK is configured in the reviewed app. Any future non-essential tracking requires a new audit, accurate disclosures and consent before activation where required. A cookie banner should match actual technology and applicable law, not be added solely as decoration.

## Controls

You can manage permissions in device settings, clear browser storage and use the app’s privacy controls. Revoking calendar permission does not necessarily delete existing events. Remove Pulse-created calendar entries before disconnecting or deleting the account if you want those copies removed. Privacy/legal: legal@sciencebyhugs.com. DRAFT: verify hosting details before publication. Business mailing address: Science By Hugs, 1527 W Craig Rd, STE 1B, Box 147, North Las Vegas, NV 89032-0228.

## Interrupted feedback submissions

If a feedback submission is interrupted, its original message, category, consent choice, version/build, platform and request identifier remain in private storage on this device so the same ticket can be retried without duplication. This draft is scoped to the signed-in account and is removed after confirmation or account deletion. A message that has never been sent remains only in the open form and is discarded if you choose to close it.
