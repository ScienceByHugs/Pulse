# Pulse 2.0

Science By Hugs protocol tracking for iOS, Android and web.

## Current status

Start with [Release status](docs/RELEASE_STATUS.md). It separates repository validation from installed TestFlight builds and physical-device acceptance. Older dated QA documents are historical evidence.

## Stack

- TypeScript, React 19, React Native 0.88 prerelease, Expo SDK 58 and Expo Router.
- Supabase Auth, Postgres with owner-scoped access, Storage and account-deletion Edge Function.
- Native notifications, device calendar, SecureStore and iOS widget extension.
- Separate static admin portal; private administration remains server-authorized.

## Development

Use Node 24 to match CI (package minimum: 22.13). Install with `npm ci --legacy-peer-deps --ignore-scripts`, then `npm run typecheck` and `npm test`. Public backend variables are described in `.env.example`; keep real local configuration out of git.

CI compiles JavaScript for iOS, Android and web using dummy backend values. It cannot validate native signing, live email delivery or physical devices. See [local native workflow](docs/LOCAL_BUILD_WORKFLOW.md) before any signed build. Builds remain local on the owner's Mac; uploads require separate authorization.

## Operations

- [Auth email runbook](docs/AUTH_EMAIL_RUNBOOK.md)
- [Repository maintenance](docs/GITHUB_MAINTENANCE.md)
- [Android checklist](docs/ANDROID_RELEASE_CHECKLIST.md)
- [Product scope](docs/PRODUCT.md)
