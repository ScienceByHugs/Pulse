# Personalized Account

Account now starts with a large photo/initials, display name, email and join month. Edit profile opens a shared sheet with photo selection, replacement/removal, name and optional existing contact phone. Privacy and reminders remain immediately available; email/password forms move into a separate sheet. No new health or demographic fields are collected.

Photo implementation: system image picker, optional square crop, center-crop fallback, 512px JPEG re-encoding, 2MB upload limit. No camera or microphone permission. One fixed avatar path per user in a private Storage bucket; confirmed-account ownership policies cover read, insert, update and delete. Short-lived image links refresh while Account is focused. Image bytes are not stored in auth metadata. Photos save immediately, independently of the Save profile button.

The private bucket migration is applied. The existing authenticated delete-account function is deployed as version 2 and removes the avatar through Storage before deleting its user. Data export includes the saved name/contact phone and JPEG as base64.

Validation: TypeScript, existing 7 regression tests and iOS Hermes and web production exports pass. Rolled-back SQL fixtures verify own photo insert/replacement, cross-account insert/read/replacement/ownership changes denied, unverified access denied, anonymous reads denied, private bucket/size limit and deletion policy matching the tested ownership predicate. No real user records or photos are used. Actual Storage API deletion and native selection/cropping still require device acceptance; no native device validation is claimed.

Device checks for the next binary: add photo, cancel picker, crop portrait/landscape, replace photo, reopen Account/relaunch, remove photo, verify initials fallback, edit name, keyboard/Close reachability, offline error, export photo, and delete a disposable account with a photo. Native photo modules require a new build.

Supabase advisor results: no new findings. Existing notices remain for the intentional inventory correction function ([advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)) and disabled leaked-password protection ([configuration](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).
