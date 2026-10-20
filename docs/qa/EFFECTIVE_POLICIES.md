# Effective policies — October 20, 2026

The owner requested Apple/Google policy coverage and adoption of all policies. All six documents are effective October 20, 2026, version `2026-10-20`. Current public copies are hosted at https://pulse-sbh-legal.sciencebyhugs-pulse.workers.dev/.

## Validation

- `npm test`: 115 passed, zero failed, including generated-policy parity and isolated-host behavior/security tests.
- `npm run typecheck`: passed.
- `python3 scripts/generate-legal-pages.py --check`: passed; all 13 Markdown/HTML outputs match shared text and metadata.
- `npm run legal:build`: passed; only the seven allowlisted public pages are bundled.
- Shared static handler checked against current Cloudflare Workers types (`@cloudflare/workers-types` 5.20261019.1): passed.
- `git diff --check`: passed.
- Chrome: public index and privacy document render without login; effective date and separate health/privacy/deletion links verified. Screenshots: `effective-policies/public-index.png`, `effective-policies/public-privacy.png`.
- Live HTTPS verification is recorded in `effective-policies/public-verification.json`; every page body compared with its generated local source, HEAD/security headers, root/index parity, unknown-path 404 and POST 405 checked.

## Publication

Created a separate Cloudflare Worker `pulse-sbh-legal`; existing `nova` and `pulse-sbh-admin` were not modified. No bindings, credentials, account forms, database or backend access, browser scripts, cookies, DNS changes, purchases or plan changes were introduced. Worker invocation logs/traces are off; Cloudflare infrastructure may process connection metadata as disclosed. Existing billing subscriptions could not be independently inspected with the connector's permissions.

Deployment ID: `8dc90e2d661841e8a8cc7bfe03e70e86`.

Built module SHA-256: `ea24616a41270ddbe35ff8b3ccbf9067e128e5891642f3c02508743ce81204d5`.

## Limits and next steps

See `../legal/STORE_SUBMISSION.md` for the first-party Apple/Google coverage matrix and remaining store/operational responsibilities. Public adoption does not prove consent implementation, provider-copy deletion, legal certification or store approval. Provider-specific recovery/log retention remains incompletely verified and is disclosed using criteria rather than an invented fixed deadline.

No native APK/AAB/iOS build or upload was performed for this policy change. Existing installed versions retain their old bundled notices until a separately approved updated build. Store privacy/deletion URL fields, Data Safety, App Privacy and health declarations still need completion. No PR merge is authorized by this policy-publication task.
