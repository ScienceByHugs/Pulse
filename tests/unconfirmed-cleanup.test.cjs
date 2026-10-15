const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const {
  candidate,
  scanCandidates,
  validateManifest,
  reviewSelected,
  configuration,
} = require('../scripts/cleanup-unconfirmed.cjs');

const NOW = Date.parse('2026-10-13T18:00:00Z');
const PROJECT = 'bxgcntumsyxjfnxenmqm';
function user(changes = {}) {
  const id = randomUUID();
  return {
    id,
    email: 'fictional@example.invalid',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: [{ provider: 'email', user_id: id }],
    ...changes,
  };
}
function manifest(users, auditedAt = NOW) {
  return {
    version: 1,
    projectRef: PROJECT,
    maxAgeDays: 30,
    auditedAt: new Date(auditedAt).toISOString(),
    candidates: users.map((u) => ({
      id: u.id,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    })),
  };
}
function fakeAdmin(users) {
  const rows = new Map(users.map((u) => [u.id, u]));
  const calls = [];
  return {
    rows,
    calls,
    async getUserById(id) {
      calls.push(['get', id]);
      return rows.has(id)
        ? { data: { user: rows.get(id) }, error: null }
        : { data: { user: null }, error: { status: 404 } };
    },
    async deleteUser(id, soft) {
      calls.push(['delete', id, soft]);
      const u = rows.get(id);
      rows.delete(id);
      return { data: { user: u }, error: null };
    },
  };
}
function options(users, changes = {}) {
  return {
    manifest: manifest(users),
    ids: users.map((u) => u.id),
    projectRef: PROJECT,
    now: () => NOW,
    ...changes,
  };
}

test('cleanup eligibility is conservative and requires more than 30 complete days', () => {
  assert.equal(candidate(user(), NOW), true);
  const boundary = new Date(NOW - 30 * 86_400_000).toISOString();
  assert.equal(candidate(user({ created_at: boundary }), NOW), false);
  assert.equal(
    candidate(
      user({ created_at: new Date(Date.parse(boundary) - 1).toISOString() }),
      NOW,
    ),
    true,
  );
  for (const changes of [
    { email_confirmed_at: boundary },
    { confirmed_at: boundary },
    { phone_confirmed_at: boundary },
    { phone: '+15550000000' },
    { last_sign_in_at: boundary },
    { is_anonymous: true },
    { is_anonymous: undefined },
    { is_sso_user: true },
    { invited_at: boundary },
    { deleted_at: boundary },
    { recovery_sent_at: boundary },
    { new_email: 'changed@example.invalid' },
    { factors: [{}] },
    { updated_at: undefined },
    { created_at: 'not a date' },
    { identities: undefined },
    { identities: [] },
    { identities: [{ provider: 'google' }] },
    { app_metadata: { provider: 'email', providers: ['email', 'google'] } },
    { app_metadata: { provider: 'phone', providers: ['phone'] } },
  ])
    assert.equal(candidate(user(changes), NOW), false, JSON.stringify(changes));
  // User-editable metadata never grants cleanup eligibility.
  assert.equal(
    candidate(
      user({ is_anonymous: true, user_metadata: { is_anonymous: false } }),
      NOW,
    ),
    false,
  );
});

test('dry-run pagination advances beyond page nine and completes before any mutation', async () => {
  const users = Array.from({ length: 25 }, () => user());
  const pages = [];
  const admin = {
    async listUsers({ page, perPage }) {
      pages.push(page);
      return {
        data: {
          users: users.slice((page - 1) * perPage, page * perPage),
          nextPage: 1,
        },
        error: null,
      };
    },
    async deleteUser() {
      assert.fail('Scan must never delete');
    },
  };
  const result = await scanCandidates(admin, { now: NOW, perPage: 2 });
  assert.equal(result.scanned, 25);
  assert.equal(result.candidates.length, 25);
  assert.deepEqual(
    pages,
    Array.from({ length: 13 }, (_, index) => index + 1),
  );
  assert.ok(
    result.candidates.every(
      (entry) => !('email' in entry) && !('app_metadata' in entry),
    ),
  );
});

test('pagination failure or a repeated full page fails closed without API error content', async () => {
  const secret = 'private-token-and-email';
  await assert.rejects(
    scanCandidates({ listUsers: async () => ({ error: { message: secret } }) }),
    (error) => error.cleanupSafe && !error.message.includes(secret),
  );
  const u = user();
  await assert.rejects(
    scanCandidates(
      { listUsers: async () => ({ data: { users: [u] }, error: null }) },
      { now: NOW, perPage: 1 },
    ),
    /stopped advancing/,
  );
});

test('manifest validation refuses stale, future, wrong-project, duplicate and recent accounts', () => {
  const u = user();
  assert.equal(validateManifest(manifest([u]), PROJECT, NOW).length, 1);
  for (const m of [
    manifest([u], NOW - 15 * 60_000 - 1),
    manifest([u], NOW + 1),
    { ...manifest([u]), projectRef: 'other-project' },
    { ...manifest([u]), maxAgeDays: 7 },
    manifest([u, u]),
    manifest([
      user({ created_at: new Date(NOW - 29 * 86_400_000).toISOString() }),
    ]),
  ])
    assert.throws(() => validateManifest(m, PROJECT, NOW));
});

test('selected account review defaults to dry-run and never deletes', async () => {
  const u = user(),
    admin = fakeAdmin([u]);
  const result = await reviewSelected(admin, options([u]));
  assert.equal(result[0].status, 'eligible-dry-run');
  assert.deepEqual(admin.calls, [['get', u.id]]);
  assert.equal(admin.rows.size, 1);
  await assert.rejects(
    reviewSelected(admin, options([u], { ids: [randomUUID()] })),
    /present in the fresh/,
  );
  await assert.rejects(
    reviewSelected(admin, options([u], { ids: [u.id, u.id] })),
    /unique/,
  );
});

test('execution rechecks confirmation and auth changes, skips them, then hard-deletes only approved unchanged IDs', async () => {
  const confirmed = user(),
    changed = user(),
    valid = user();
  const originals = [confirmed, changed, valid];
  const admin = fakeAdmin(originals);
  admin.rows.set(confirmed.id, {
    ...confirmed,
    email_confirmed_at: new Date(NOW).toISOString(),
  });
  admin.rows.set(changed.id, {
    ...changed,
    updated_at: new Date(NOW).toISOString(),
  });
  const journal = [];
  const results = await reviewSelected(
    admin,
    options(originals, { execute: true, record: async (r) => journal.push(r) }),
  );
  assert.deepEqual(
    results.map((r) => r.status),
    ['skipped-changed', 'skipped-changed', 'deleted'],
  );
  assert.deepEqual(
    admin.calls.filter((r) => r[0] === 'delete'),
    [['delete', valid.id, false]],
  );
  assert.equal(admin.rows.size, 2);
  assert.deepEqual(
    journal.filter((r) => r.id === valid.id).map((r) => r.status),
    ['delete-request-pending', 'deleted'],
  );
});

test('failed journaling stops before mutation, missing accounts skip, uncertain deletions stop the batch', async () => {
  const one = user(),
    two = user();
  const writeFailure = fakeAdmin([one]);
  await assert.rejects(
    reviewSelected(
      writeFailure,
      options([one], {
        execute: true,
        record: async () => {
          throw Error('Disk full');
        },
      }),
    ),
    /Disk full/,
  );
  assert.ok(writeFailure.calls.every((call) => call[0] !== 'delete'));
  const missing = fakeAdmin([]);
  assert.equal(
    (await reviewSelected(missing, options([one], { execute: true })))[0]
      .status,
    'already-absent',
  );
  const uncertain = fakeAdmin([one, two]);
  uncertain.deleteUser = async () => ({
    data: { user: null },
    error: { message: 'secret-token' },
  });
  const journal = [];
  await assert.rejects(
    reviewSelected(
      uncertain,
      options([one, two], {
        execute: true,
        record: async (row) => journal.push(row),
      }),
    ),
    /not confirmed/,
  );
  assert.deepEqual(uncertain.calls, [['get', one.id]]);
  assert.equal(journal.at(-1).status, 'delete-unconfirmed-stop');
});

test('a thrown network failure after sending deletion records uncertainty and stops without exposing its contents', async () => {
  const one = user(),
    two = user(),
    admin = fakeAdmin([one, two]);
  admin.deleteUser = async () => {
    throw Error('private response including a secret token');
  };
  const journal = [];
  await assert.rejects(
    reviewSelected(
      admin,
      options([one, two], {
        execute: true,
        record: async (row) => journal.push(row),
      }),
    ),
    (error) => error.cleanupSafe && !error.message.includes('secret token'),
  );
  assert.equal(journal.at(-1).status, 'delete-unconfirmed-stop');
  assert.deepEqual(admin.calls, [['get', one.id]]);
});

test('server credentials must target the selected HTTPS project and public/user keys are refused', () => {
  const env = {
    SUPABASE_URL: `https://${PROJECT}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_fictional-not-a-real-key',
  };
  assert.equal(configuration(PROJECT, env).url, env.SUPABASE_URL);
  for (const changes of [
    { SUPABASE_URL: 'http://localhost:54321' },
    { SUPABASE_URL: 'https://other.supabase.co' },
    { SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_fictional-not-a-real-key' },
    { SUPABASE_SERVICE_ROLE_KEY: 'invalid' },
  ])
    assert.throws(() => configuration(PROJECT, { ...env, ...changes }));
  const jwt = (role) =>
    [
      'header',
      Buffer.from(JSON.stringify({ role, ref: PROJECT })).toString('base64url'),
      'signature',
    ].join('.');
  assert.throws(() =>
    configuration(PROJECT, {
      ...env,
      SUPABASE_SERVICE_ROLE_KEY: jwt('authenticated'),
    }),
  );
  assert.ok(
    configuration(PROJECT, {
      ...env,
      SUPABASE_SERVICE_ROLE_KEY: jwt('service_role'),
    }),
  );
});

test('read-only SQL audit excludes passwordless, signed-in, storage-owning and data-bearing accounts without returning sensitive fields', async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    await db.exec(`create schema auth; create schema storage;
      create table auth.users(id uuid primary key, created_at timestamptz default now()-interval '31 days', updated_at timestamptz default now()-interval '31 days', email text default 'fictional@example.invalid', encrypted_password text default 'fictional-hash', email_confirmed_at timestamptz, confirmed_at timestamptz, phone text, phone_confirmed_at timestamptz, last_sign_in_at timestamptz, is_anonymous boolean default false, is_sso_user boolean default false, deleted_at timestamptz, invited_at timestamptz, recovery_sent_at timestamptz, email_change text, phone_change text, raw_app_meta_data jsonb default '{"provider":"email","providers":["email"]}');
      create table auth.identities(user_id uuid, provider text); create table auth.sessions(user_id uuid); create table auth.mfa_factors(user_id uuid);
      create table storage.objects(owner_id text);`);
    for (const table of [
      'protocols',
      'protocol_items',
      'inventory_containers',
      'dose_logs',
      'inventory_adjustments',
      'dose_log_revisions',
      'daily_checkins',
      'protocol_item_versions',
      'tracking_event_cancellations',
      'feedback_submissions',
    ])
      await db.exec(`create table public.${table}(user_id uuid)`);
    const valid = randomUUID(),
      passwordless = randomUUID(),
      signedIn = randomUUID(),
      photo = randomUUID(),
      health = randomUUID(),
      feedback = randomUUID(),
      oauth = randomUUID(),
      young = randomUUID();
    for (const id of [
      valid,
      passwordless,
      signedIn,
      photo,
      health,
      feedback,
      oauth,
      young,
    ]) {
      await db.query('insert into auth.users(id) values($1)', [id]);
      await db.query(
        "insert into auth.identities(user_id,provider) values($1,'email')",
        [id],
      );
    }
    await db.query(
      'update auth.users set encrypted_password=null where id=$1',
      [passwordless],
    );
    await db.query('insert into auth.sessions(user_id) values($1)', [signedIn]);
    await db.query('insert into storage.objects(owner_id) values($1)', [photo]);
    await db.query('insert into public.daily_checkins(user_id) values($1)', [
      health,
    ]);
    await db.query(
      "insert into auth.identities(user_id,provider) values($1,'google')",
      [oauth],
    );
    await db.query(
      "update auth.users set created_at=now()-interval '29 days' where id=$1",
      [young],
    );
    await db.query(
      'insert into public.feedback_submissions(user_id) values($1)',
      [feedback],
    );
    const sql = fs.readFileSync(
      'scripts/unconfirmed-account-audit.sql',
      'utf8',
    );
    const audit = (await db.query(sql)).rows[0].audit;
    assert.equal(audit.candidates.length, 1);
    assert.equal(audit.candidates[0].id, valid);
    assert.ok(!JSON.stringify(audit).includes('fictional'));
    assert.deepEqual(Object.keys(audit.candidates[0]).sort(), [
      'createdAt',
      'id',
      'updatedAt',
    ]);
    assert.equal(
      (await db.query('select count(*) from auth.users')).rows[0].count,
      8,
    );
  } finally {
    await db.close();
  }
});
