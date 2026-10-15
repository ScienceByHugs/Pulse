# Owner-operated cleanup of abandoned signup accounts

Status: implementation available for review and local testing. **No production deletion, deployment or schedule has been enabled.** A scheduled 30-day retention promise is not current behavior. Anthony approved the retention design in [OWNER_DECISIONS.md](OWNER_DECISIONS.md).

The tool uses the existing pinned `@supabase/supabase-js` dependency and defaults to a read-only scan. It targets email/password signups older than 30 complete 24-hour days which have never confirmed or signed in. Confirmed email or phone, anonymous users, OAuth/SSO identities, invitations, password recovery, pending identity changes and MFA factors are excluded. Accounts with a storage object or tracking records are excluded by the SQL audit; their files and records are not cleaned up by this tool.

An email identity can use a password **or** a passwordless method. The Auth Admin API does not expose whether a password exists. Therefore execution requires a fresh read-only SQL audit that checks the existence of a password and absence of sessions and user data, without returning any password hash, email, token or health record. The audit returns UUIDs and creation/update timestamps only. User-editable metadata is never used to authorize deletion.

## Prepare and review

1. Test the tool against a disposable non-production project before first production use. Current automated tests use fake Admin API responses and a local PostgreSQL database; they are not evidence of a live deletion test.
2. The owner supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through a secure terminal environment or password-manager environment injection. Use a server-only secret or service-role key. Never put it in `EXPO_PUBLIC_*`, an app bundle, a screenshot, a command argument, source control or a committed `.env` file. The cleanup tool does not load dotenv files or print its credentials.
3. An initial read-only scan is optional:

   ```sh
   node scripts/cleanup-unconfirmed.cjs --project-ref bxgcntumsyxjfnxenmqm
   ```

   This prints counts only. Use `--report /private/tmp/pulse-cleanup-scan.ndjson` to record candidate UUIDs/timestamps in a new owner-readable file. It does not prove password-based signup or select accounts for deletion. Scanning always completes before any execution; the tool never deletes rows while paginating. The script increments page numbers itself, deduplicates identifiers and stops if pagination fails to advance.

4. In the **correct project's** Supabase SQL Editor, run [unconfirmed-account-audit.sql](../../scripts/unconfirmed-account-audit.sql). It is a SELECT only; no Auth schema is exposed, function installed or policy changed. Its project marker currently names Pulse. For a disposable test project, change the marker in a private copy and use that project’s credentials.
5. Save only the returned `audit` JSON object in a private file outside the repository, such as `/private/tmp/pulse-cleanup-audit.json`. Make it readable only by you. The file expires after 15 minutes. Do not export `select * from auth.users` or password hashes.
6. Review the candidates and write the specific IDs you approve to a separate private JSON file containing an array of UUID strings, such as `/private/tmp/pulse-cleanup-selected.json`. An empty or duplicate list is refused. Do not select a verified, active or unfamiliar account.
7. Recheck those selected IDs without deleting:

   ```sh
   node scripts/cleanup-unconfirmed.cjs --project-ref bxgcntumsyxjfnxenmqm \
     --manifest /private/tmp/pulse-cleanup-audit.json \
     --ids /private/tmp/pulse-cleanup-selected.json \
     --report /private/tmp/pulse-cleanup-review.ndjson
   ```

   Every selected ID must be present in the fresh SQL audit. The current Auth user must still satisfy all API checks, including matching creation/update timestamps. Changed accounts are skipped. Missing accounts are recorded as already absent. Recheck failures stop the batch. Refresh the SQL audit if review takes longer than 15 minutes.

## Explicit execution

Only after owner review and staging verification, execution additionally requires `--execute`, a matching project confirmation and a new private journal:

```sh
node scripts/cleanup-unconfirmed.cjs --project-ref bxgcntumsyxjfnxenmqm \
  --manifest /private/tmp/pulse-cleanup-audit.json \
  --ids /private/tmp/pulse-cleanup-selected.json \
  --execute --confirm-project bxgcntumsyxjfnxenmqm \
  --report /private/tmp/pulse-cleanup-execution.ndjson
```

This is an irreversible Auth hard deletion for only the selected, unchanged accounts. The report file is exclusively created with mode `0600`; existing files are refused. Each pending request is flushed to disk before deletion. Confirmed and uncertain responses are recorded separately; any unconfirmed deletion response stops the batch. An API/network error message is never printed. On an uncertain response, review the journal and the server before retrying with a new audit; do not assume the account still exists or rerun the old list blindly.

The URL must exactly match the selected project's standard Supabase HTTPS hostname. Custom domains and local URLs are refused. Removing storage objects or working around constraints is intentionally outside this cleanup operation. Auth deletion can cascade a default profile row through existing foreign keys, but unexpected ownership or database constraints should stop deletion for investigation. Audit/journal files contain private identifiers: keep them outside Git and delete temporary copies after recording the minimal completed operational result in the owner’s secure maintenance log. No outbound email is sent.

## Limits and activation gate

- The SQL audit reads Supabase-managed Auth tables, whose non-primary-key schema may change. The local SQL test confirms the expected schema; verify the query in staging and against the actual project before activation. Missing columns/tables fail rather than broadening eligibility.
- The SQL audit and Auth API deletion are separate operations. Per-ID refetching and matching `updated_at` narrow the race window; they cannot provide an atomic guarantee if an account confirms or otherwise changes between the recheck and the delete request. If strict atomic exclusion is required, design and review a database transaction separately. Do not advertise this manual tool as a continuously running cleanup service.
- The tool excludes anyone with `last_sign_in_at` or a session in the fresh SQL audit. It does not revoke existing tokens. Supabase notes that user deletion does not immediately invalidate issued JWTs; this is why previously signed-in users are excluded.
- Backups and provider logs are outside this operation. Their exact retention periods remain unverified and must not be promised by the public policy.
- Existing app deletion remains a separate signed-in account flow. This tool is only for abandoned signups. It does not process privacy requests, send notices or delete independently downloaded/device exports.
- Before a recurring 30-day commitment goes into published policies, choose a daily operating procedure or reviewed scheduler, test it in staging, enable it explicitly and confirm successful records. None of those activation steps occurred during implementation.

Official references checked October 13, 2026: [User object and identities](https://supabase.com/docs/guides/auth/users), [listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers), [getUserById](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid), [deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [user deletion, storage and JWT limitations](https://supabase.com/docs/guides/auth/managing-user-data), [Supabase changelog](https://supabase.com/changelog). No relevant Auth Admin breaking change was identified in the current changelog.

Live verification: the complete read-only SQL audit ran successfully against Pulse via the connected Supabase account and returned zero eligible accounts. This confirms current schema compatibility, not the destructive Admin API path. No accounts were deleted.
