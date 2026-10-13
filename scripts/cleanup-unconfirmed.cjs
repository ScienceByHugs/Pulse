#!/usr/bin/env node
// Owner-only maintenance. Nothing in this module runs when imported by tests.
const fs = require('node:fs/promises');
const { parseArgs } = require('node:util');

const DAY = 86_400_000;
const AUDIT_VALID_MS = 15 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT = /^[a-z0-9]{20}$/;

function fail(message) {
  // Only messages written here reach the terminal; never print an API error/body.
  const error = new Error(message);
  error.cleanupSafe = true;
  throw error;
}

function time(value) {
  return typeof value === 'string' && value ? Date.parse(value) : NaN;
}

function candidate(user, now = Date.now()) {
  const created = time(user?.created_at);
  if (!UUID.test(user?.id ?? '') || !Number.isFinite(created)) return false;
  if (created >= now - 30 * DAY || created > now) return false;
  if (!user.email || user.email_confirmed_at || user.confirmed_at) return false;
  if (user.phone || user.phone_confirmed_at || user.last_sign_in_at)
    return false;
  if (user.is_anonymous !== false || user.is_sso_user === true) return false;
  if (user.deleted_at || user.invited_at || user.recovery_sent_at) return false;
  if (user.new_email || user.new_phone || user.factors?.length) return false;
  if (user.app_metadata?.provider !== 'email') return false;
  if (
    !Array.isArray(user.app_metadata.providers) ||
    user.app_metadata.providers.length !== 1 ||
    user.app_metadata.providers[0] !== 'email'
  )
    return false;
  if (!Array.isArray(user.identities) || user.identities.length !== 1)
    return false;
  const identity = user.identities[0];
  if (identity.provider !== 'email' || identity.user_id !== user.id)
    return false;
  // This is an API candidate, not proof that a password exists. The SQL audit
  // checks encrypted_password IS NOT NULL/nonempty without returning its value.
  return Number.isFinite(time(user.updated_at));
}

function summary(user) {
  return {
    id: user.id,
    createdAt: new Date(user.created_at).toISOString(),
    updatedAt: new Date(user.updated_at).toISOString(),
  };
}

async function scanCandidates(admin, { now = Date.now(), perPage = 200 } = {}) {
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 1000)
    fail('Invalid page size.');
  const seen = new Set();
  const candidates = [];
  let scanned = 0;
  // Do not delete while paginating: removing rows changes page offsets.
  for (let page = 1; page <= 10_000; page++) {
    const { data, error } = await admin.listUsers({ page, perPage });
    if (error || !Array.isArray(data?.users))
      fail('Account scan failed. Nothing was deleted.');
    let added = 0;
    for (const user of data.users) {
      if (!UUID.test(user?.id ?? ''))
        fail(
          'Account scan returned an invalid identifier. Nothing was deleted.',
        );
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      scanned++;
      added++;
      if (candidate(user, now)) candidates.push(summary(user));
    }
    if (data.users.length < perPage) return { scanned, candidates };
    if (!added)
      fail('Account pagination stopped advancing. Nothing was deleted.');
    // Increment our own page number instead of trusting parsed Link headers.
  }
  fail('Account scan exceeded its safety limit. Nothing was deleted.');
}

function validateManifest(manifest, projectRef, now = Date.now()) {
  if (
    manifest?.version !== 1 ||
    manifest.projectRef !== projectRef ||
    manifest.maxAgeDays !== 30 ||
    !Array.isArray(manifest.candidates)
  )
    fail('Audit manifest does not match this project or cleanup policy.');
  const audited = time(manifest.auditedAt);
  if (
    !Number.isFinite(audited) ||
    audited > now ||
    now - audited > AUDIT_VALID_MS
  )
    fail(
      'Audit manifest must come from the read-only SQL audit within the last 15 minutes.',
    );
  const ids = new Set();
  for (const entry of manifest.candidates) {
    if (
      !UUID.test(entry?.id ?? '') ||
      ids.has(entry.id) ||
      !Number.isFinite(time(entry.createdAt)) ||
      !Number.isFinite(time(entry.updatedAt)) ||
      time(entry.createdAt) >= audited - 30 * DAY
    )
      fail(
        'Audit manifest contains an invalid, duplicate or too-recent account.',
      );
    ids.add(entry.id);
  }
  return manifest.candidates;
}

async function reviewSelected(
  admin,
  {
    manifest,
    ids,
    projectRef,
    execute = false,
    record = async () => {},
    now = () => Date.now(),
  },
) {
  const entries = validateManifest(manifest, projectRef, now());
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.some((id) => !UUID.test(id)) ||
    new Set(ids).size !== ids.length
  )
    fail('Select a nonempty JSON array of unique account UUIDs.');
  const selected = ids.map((id) => entries.find((entry) => entry.id === id));
  if (selected.some((entry) => !entry))
    fail('Every selected ID must be present in the fresh SQL audit manifest.');
  const results = [];
  for (const entry of selected) {
    // Revalidate freshness for every account, then refetch immediately before
    // delete. Confirmation, sign-in or any auth update since audit means skip.
    validateManifest(manifest, projectRef, now());
    const { data, error } = await admin.getUserById(entry.id);
    if (error?.status === 404 || error?.code === 'user_not_found') {
      const result = { id: entry.id, status: 'already-absent' };
      await record(result);
      results.push(result);
      continue;
    }
    if (error || !data?.user || data.user.id !== entry.id)
      fail(
        'Account recheck failed. Cleanup stopped before deleting this account.',
      );
    const user = data.user;
    if (
      !candidate(user, now()) ||
      time(user.created_at) !== time(entry.createdAt) ||
      time(user.updated_at) !== time(entry.updatedAt)
    ) {
      const result = { id: entry.id, status: 'skipped-changed' };
      await record(result);
      results.push(result);
      continue;
    }
    if (!execute) {
      const result = { id: entry.id, status: 'eligible-dry-run' };
      await record(result);
      results.push(result);
      continue;
    }
    // Require a writable durable journal before sending an irreversible request.
    await record({ id: entry.id, status: 'delete-request-pending' });
    let deletion;
    try {
      deletion = await admin.deleteUser(entry.id, false);
    } catch {
      await record({ id: entry.id, status: 'delete-unconfirmed-stop' });
      fail(
        'Deletion response was not confirmed. Cleanup stopped; review the journal and server before retrying.',
      );
    }
    if (deletion.error || deletion.data?.user?.id !== entry.id) {
      await record({ id: entry.id, status: 'delete-unconfirmed-stop' });
      fail(
        'Deletion response was not confirmed. Cleanup stopped; review the journal and server before retrying.',
      );
    }
    const result = { id: entry.id, status: 'deleted' };
    await record(result);
    results.push(result);
  }
  return results;
}

function configuration(projectRef, env) {
  if (!PROJECT.test(projectRef ?? '')) fail('Supply a valid --project-ref.');
  if (env.SUPABASE_URL !== `https://${projectRef}.supabase.co`)
    fail('SUPABASE_URL must exactly match --project-ref over HTTPS.');
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (key.startsWith('sb_secret_') && key.length > 20)
    return { url: env.SUPABASE_URL, key };
  try {
    const jwt = JSON.parse(
      Buffer.from(key.split('.')[1], 'base64url').toString('utf8'),
    );
    if (
      key.split('.').length === 3 &&
      jwt.role === 'service_role' &&
      (!jwt.ref || jwt.ref === projectRef)
    )
      return { url: env.SUPABASE_URL, key };
  } catch {}
  fail(
    'Supply a server-only secret/service-role key through SUPABASE_SERVICE_ROLE_KEY. Public or user keys are refused.',
  );
}

const HELP = `Pulse unconfirmed-account cleanup (owner-operated; defaults to dry-run)

  node scripts/cleanup-unconfirmed.cjs --project-ref PROJECT
  node scripts/cleanup-unconfirmed.cjs --project-ref PROJECT --manifest AUDIT.json --ids SELECTED.json

Execution additionally requires all of:
  --execute --confirm-project PROJECT --manifest AUDIT.json --ids SELECTED.json --report PRIVATE.ndjson

Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-only secret; never EXPO_PUBLIC).
Audit: scripts/unconfirmed-account-audit.sql; expires after 15 minutes.
Reports contain private UUIDs/timestamps only. No emails, tokens, metadata or password hashes are printed.
Read docs/legal/UNCONFIRMED_ACCOUNT_CLEANUP.md before execution.
`;

async function main(argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean' },
      execute: { type: 'boolean' },
      'project-ref': { type: 'string' },
      'confirm-project': { type: 'string' },
      manifest: { type: 'string' },
      ids: { type: 'string' },
      report: { type: 'string' },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  const projectRef = values['project-ref'];
  const config = configuration(projectRef, env);
  if (Boolean(values.manifest) !== Boolean(values.ids))
    fail('--manifest and --ids must be supplied together.');
  if (
    values.execute &&
    (!values.manifest ||
      !values.report ||
      values['confirm-project'] !== projectRef)
  )
    fail(
      'Execution requires a fresh manifest, selected IDs, new private report and matching --confirm-project.',
    );
  const { createClient } = require('@supabase/supabase-js');
  const admin = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }).auth.admin;
  const manifest = values.manifest
    ? JSON.parse(await fs.readFile(values.manifest, 'utf8'))
    : null;
  const ids = values.ids
    ? JSON.parse(await fs.readFile(values.ids, 'utf8'))
    : null;
  if (manifest) validateManifest(manifest, projectRef);
  // Exclusive, owner-only file; never overwrite an existing audit or follow its symlink.
  const journal = values.report
    ? await fs.open(values.report, 'ax', 0o600)
    : null;
  const record = async (value) => {
    if (!journal) return;
    await journal.appendFile(
      JSON.stringify({ recordedAt: new Date().toISOString(), ...value }) + '\n',
    );
    await journal.sync();
  };
  try {
    await record({
      kind: 'start',
      projectRef,
      mode: values.execute ? 'execute' : 'dry-run',
    });
    if (manifest) {
      const results = await reviewSelected(admin, {
        manifest,
        ids,
        projectRef,
        execute: Boolean(values.execute),
        record,
      });
      const counts = results.reduce(
        (all, result) => ({
          ...all,
          [result.status]: (all[result.status] ?? 0) + 1,
        }),
        {},
      );
      console.log(
        JSON.stringify({
          mode: values.execute ? 'execute' : 'dry-run',
          counts,
        }),
      );
    } else {
      const { scanned, candidates } = await scanCandidates(admin);
      for (const entry of candidates)
        await record({ status: 'candidate-requires-sql-audit', ...entry });
      console.log(
        JSON.stringify({
          mode: 'dry-run',
          scanned,
          apiCandidates: candidates.length,
          note: 'Password/session/storage audit and explicit ID selection required before deletion.',
        }),
      );
    }
    await record({ kind: 'complete' });
  } finally {
    await journal?.close();
  }
}

module.exports = {
  candidate,
  scanCandidates,
  validateManifest,
  reviewSelected,
  configuration,
  main,
};
if (require.main === module)
  main().catch((error) => {
    console.error(
      error.cleanupSafe
        ? error.message
        : 'Cleanup stopped due to an unexpected error. No error body or credentials were printed; inspect any private journal before retrying.',
    );
    process.exitCode = 1;
  });
