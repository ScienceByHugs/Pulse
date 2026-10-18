# Dependency and backend review — October 17, 2026 Pacific

Baseline `ece6e4137eb979d6c195d2c5f96ed153aba8fa2f`. No dependency override, downgrade, schema mutation or production configuration change was made.

## Fresh dependency audit

A clean `npm ci --legacy-peer-deps --ignore-scripts` completed. Fresh `npm audit --json` still reports 22 affected package entries: 14 high, 8 moderate, zero critical. These propagate from three underlying advisories; they are not 22 independent vulnerabilities. `npm ls braces node-forge uuid --all` confirms:

| Package | Path | Current disposition |
| --- | --- | --- |
| braces 3.0.3 | Expo → Metro → metro-file-map → micromatch | GHSA-vfj7-8cjw-p6xm still lists no patched version. Keep untrusted glob patterns out of build inputs and do not expose Metro publicly. |
| node-forge 1.4.0 | Expo CLI / code-signing-certificates | GHSA-86w9-cpqp-85rv still lists no patched version. Retain a maintenance blocker; Apple code-sign checks do not resolve a Node-tooling advisory. |
| uuid 7.0.3 | Expo config plugins → xcode 3.0.1 | GHSA-w5hq-g745-h8pq lists patches including 11.1.1. Existing xcode consumer uses v4, not the affected external-buffer v3/v5/v6 path. Prefer an upstream-compatible update; a major override requires native project-generation/signing validation before adoption. |

The npm-proposed fix still downgrades Expo to 44.0.6. Do not run `npm audit fix --force`. No runtime-unreachability guarantee or security clearance is claimed. Track compatible upstream fixes; any changed native dependency needs a local signed build and physical-device regression checks.

Primary sources checked October 17/18:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv
- https://github.com/advisories/GHSA-w5hq-g745-h8pq

## Read-only backend advisor review

PULSE2.0 project reports ACTIVE_HEALTHY. Security advisor findings:

- Three INFO notices for private admin tables with RLS and no policies. Keep their deny-by-default access; do not add public policies just to remove warnings.
- Inventory correction SECURITY DEFINER warning. Live function inspection confirms a pinned empty search path, confirmed-auth requirement, explicit owner predicate, row lock, bounded amount/reason and atomic audit insert. Privilege check: anon EXECUTE false, authenticated EXECUTE true. Intended owner-scoped API, not grounds to switch security mode blindly; local regression suite covers ownership and atomicity.
- Leaked-password protection remains disabled. Check plan availability and cost before proposing a production change. Do not upgrade automatically.

The Supabase changelog was fetched. The upcoming November 10 legacy TLS cipher removal affects old clients; include native signup/recovery connectivity in the next device matrix. No auth API breaking change requiring an SDK update was identified for this patch.

## Limits

The sampled unified log stream had no Auth source, so no fresh bounce count or delivery success can be inferred. Current SMTP settings and installed native builds are not accessible through these read-only checks. Track those separately in #91/#92.
