# Device Storage & Cookies Notice

**Draft for operator and legal review — not yet published.**

## Scope

This draft describes storage in the reviewed Pulse app and its standalone policy pages. A separate marketing website or future SDKs must be audited independently. Version: 2026-10-12; effective date pending publication.

## Native app

Pulse uses platform secure storage for authentication sessions, cached records and pending tracking events. Local app preferences support notification privacy, biometric lock and related settings. Device/OS settings may also affect backups and storage. Temporary generated PDF files are removed after sharing completes; copies you save remain in your selected destination. Optional substance photos are stored per account/substance on this device, not uploaded to Pulse or an image-generation provider.

## Web app

The web app uses browser storage for sign-in sessions and app state. This is not the native secure-store implementation. Signing out ends local authenticated use; account deletion removes associated synced data. Clearing browser storage can remove cached and unsynced information and sign you out.

## Policy pages and optional tracking

The generated standalone policy pages do not set cookies, load analytics, embed third-party fonts, or use advertising trackers. A hosting provider can still process connection logs. No advertising/analytics SDK is configured in the reviewed app. Any future non-essential tracking requires a new audit, accurate disclosures and consent before activation where required. A cookie banner should match actual technology and applicable law, not be added solely as decoration.

## Controls

You can manage permissions in device settings, clear browser storage and use the app’s privacy controls. Revoking calendar permission does not necessarily delete existing events. Remove Pulse-created calendar entries before disconnecting or deleting the account if you want those copies removed. DRAFT: add verified privacy contact and hosting details before publication.
