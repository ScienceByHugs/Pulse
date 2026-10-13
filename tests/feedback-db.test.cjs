const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
async function setup() {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
    create table auth.mfa_factors(user_id uuid references auth.users,status text,factor_type text);
    create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;`);
  for (const file of fs
    .readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql') && !f.includes('private_profile_photos'))
    .sort()) {
    await db.exec(
      fs
        .readFileSync('supabase/migrations/' + file, 'utf8')
        .replace('create extension if not exists pgcrypto;', ''),
    );
    if (file === '0005_idempotent_offline_quick_log.sql')
      await db.exec(
        'grant select,insert,update,delete on all tables in schema public to authenticated;',
      );
  }
  const admin = randomUUID(),
    user = randomUUID(),
    other = randomUUID(),
    pending = randomUUID(),
    demo = randomUUID();
  const session = randomUUID();
  await db.query(
    `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ($1,'admin@example.test',now(),'{}'),($2,'user@example.test',now(),'{"role":"admin","is_admin":true}'),
    ($3,'other@example.test',now(),'{}'),($4,'pending@example.test',null,'{}'),($5,'demo@example.test',now(),'{}')`,
    [admin, user, other, pending, demo],
  );
  await db.query(
    'insert into pulse_private.admin_accounts(user_id) values($1)',
    [admin],
  );
  await db.query(
    "insert into pulse_private.metric_exclusions(user_id,reason) values($1,'demo')",
    [demo],
  );
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [
    session,
    admin,
  ]);
  await db.query(
    "insert into auth.mfa_factors(user_id,status,factor_type) values($1,'verified','totp')",
    [admin],
  );
  await db.query(
    "insert into public.protocols(user_id,name) values($1,'PRIVATE_HEALTH_RECORD_SENTINEL')",
    [user],
  );
  return { db, admin, user, other, pending, demo, session };
}
async function actor(db, id, extra = {}) {
  await db.exec('reset role;');
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: id, role: 'authenticated', aal: 'aal1', ...extra }),
  ]);
  await db.exec('set role authenticated;');
}
const submitSQL =
  'select public.pulse_submit_feedback($1,$2,$3,$4,$5,$6,$7,$8) result';
const payload = (id, owner, contact = false) => [
  id,
  owner,
  'suggestion',
  'Please improve the spacing of the buttons.',
  '2.0.0',
  '14',
  'ios',
  contact,
];
async function json(db, sql, args = []) {
  return (await db.query(sql, args)).rows[0].result;
}

test('admin counts require allowlist, a live session and verified TOTP; forged user metadata cannot grant access', async () => {
  const s = await setup();
  const { db, admin, user, pending, session } = s;
  try {
    await actor(db, user, {
      aal: 'aal2',
      session_id: session,
      user_metadata: { role: 'admin' },
    });
    assert.deepEqual(await json(db, 'select pulse_admin_access() result'), {
      member: false,
      authorized: false,
    });
    await assert.rejects(
      db.query('select pulse_admin_overview()'),
      /ADMIN_VERIFICATION_REQUIRED/,
    );
    await assert.rejects(
      db.query('select * from pulse_private.admin_accounts'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('insert into pulse_private.admin_accounts(user_id) values($1)', [
        user,
      ]),
      /permission denied/,
    );
    await actor(db, pending, { aal: 'aal2', session_id: session });
    await assert.rejects(
      db.query('select pulse_admin_overview()'),
      /ADMIN_VERIFICATION_REQUIRED/,
    );
    await actor(db, admin, { session_id: session });
    assert.deepEqual(await json(db, 'select pulse_admin_access() result'), {
      member: true,
      authorized: false,
    });
    await assert.rejects(
      db.query('select pulse_admin_overview()'),
      /ADMIN_VERIFICATION_REQUIRED/,
    );
    await actor(db, admin, { aal: 'aal2', session_id: session });
    const counts = await json(db, 'select pulse_admin_overview() result');
    assert.equal(counts.registered_users, 3);
    assert.equal(counts.verified_users, 2);
    assert.equal(counts.pending_confirmation, 1);
    assert.equal(counts.new_verified_7_days, 2);
    assert.equal(counts.signup_days.length, 30);
    assert.equal(
      counts.signup_days.reduce((sum, d) => sum + d.count, 0),
      2,
    );
    const text = JSON.stringify(counts);
    for (const secret of [
      user,
      admin,
      'example.test',
      'PRIVATE_HEALTH_RECORD_SENTINEL',
      'protocols',
      'dose',
    ])
      assert.equal(text.includes(secret), false);
    assert.deepEqual(
      (await db.query('select name from public.protocols')).rows,
      [],
    );
    await db.exec('reset role;');
    await db.query('delete from auth.mfa_factors where user_id=$1', [admin]);
    await actor(db, admin, { aal: 'aal2', session_id: session });
    await assert.rejects(
      db.query('select pulse_admin_overview()'),
      /ADMIN_VERIFICATION_REQUIRED/,
    );
    await db.exec('reset role;');
    await db.query(
      "insert into auth.mfa_factors values($1,'verified','totp')",
      [admin],
    );
    await db.query('delete from auth.sessions where id=$1', [session]);
    await actor(db, admin, { aal: 'aal2', session_id: session });
    await assert.rejects(
      db.query('select pulse_admin_overview()'),
      /ADMIN_VERIFICATION_REQUIRED/,
    );
    await db.exec('reset role;set role anon;');
    await assert.rejects(
      db.query('select pulse_admin_access()'),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test('feedback is owner scoped, idempotent and consent bounded; members cannot edit status or impersonate another owner', async () => {
  const { db, user, other, pending, admin, session } = await setup();
  const id = randomUUID(),
    contactId = randomUUID();
  try {
    await actor(db, user);
    assert.equal((await json(db, submitSQL, payload(id, user))).id, id);
    await json(db, submitSQL, payload(id, user));
    assert.equal(
      (await db.query('select * from feedback_submissions')).rows.length,
      1,
    );
    assert.equal(
      (await db.query('select contact_email from feedback_submissions')).rows[0]
        .contact_email,
      null,
    );
    await assert.rejects(
      db.query(submitSQL, [
        ...payload(id, user).slice(0, 3),
        'Changed original feedback',
        ...payload(id, user).slice(4),
      ]),
      /FEEDBACK_RETRY_MISMATCH/,
    );
    await assert.rejects(
      db.query("update feedback_submissions set status='shipped' where id=$1", [
        id,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select pulse_admin_feedback()'),
      /ADMIN_VERIFICATION_REQUIRED/,
    );
    await assert.rejects(
      db.query(submitSQL, payload(randomUUID(), other)),
      /FEEDBACK_ACCOUNT_CHANGED/,
    );
    await json(db, submitSQL, payload(contactId, user, true));
    await actor(db, other);
    assert.equal(
      (await db.query('select * from feedback_submissions')).rows.length,
      0,
    );
    await assert.rejects(
      db.query(submitSQL, payload(id, other)),
      /FEEDBACK_CONFLICT/,
    );
    await actor(db, pending);
    await assert.rejects(
      db.query(submitSQL, payload(randomUUID(), pending)),
      /FEEDBACK_SIGN_IN_REQUIRED/,
    );
    await actor(db, admin, { aal: 'aal2', session_id: session });
    const rows = await json(db, 'select pulse_admin_feedback() result');
    assert.equal(rows.length, 2);
    assert.equal(
      rows.find((x) => x.id === contactId).contact_email,
      'user@example.test',
    );
    assert.equal(rows.find((x) => x.id === id).contact_email, null);
    assert.equal(JSON.stringify(rows).includes(user), false);
    assert.deepEqual(
      Object.keys(rows[0]).sort(),
      [
        'id',
        'category',
        'message',
        'app_version',
        'build_number',
        'platform',
        'status',
        'created_at',
        'updated_at',
        'contact_email',
      ].sort(),
    );
    await json(db, 'select pulse_admin_set_feedback_status($1,$2,$3) result', [
      id,
      'reviewing',
      'received',
    ]);
    await assert.rejects(
      db.query('select pulse_admin_set_feedback_status($1,$2,$3)', [
        id,
        'shipped',
        'received',
      ]),
      /FEEDBACK_STATUS_CHANGED/,
    );
    await actor(db, user);
    assert.equal(
      (
        await db.query('select status from feedback_submissions where id=$1', [
          id,
        ])
      ).rows[0].status,
      'reviewing',
    );
    await db.exec('reset role;');
    assert.equal(
      (await db.query('select * from pulse_private.admin_audit')).rows.length,
      1,
    );
    await db.query('delete from auth.users where id=$1', [user]);
    assert.equal(
      (await db.query('select * from feedback_submissions')).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test('feedback rejects invalid payloads and rate limits new tickets while allowing safe retries', async () => {
  const { db, user } = await setup();
  const first = randomUUID();
  try {
    await actor(db, user);
    for (const patch of [
      { 2: 'admin' },
      { 3: 'short' },
      { 3: 'x'.repeat(2001) },
      { 4: '' },
      { 6: 'unknown' },
      { 7: null },
    ]) {
      const args = payload(randomUUID(), user);
      for (const [i, v] of Object.entries(patch)) args[i] = v;
      await assert.rejects(db.query(submitSQL, args), /FEEDBACK_INVALID/);
    }
    for (let i = 0; i < 5; i++)
      await json(db, submitSQL, payload(i === 0 ? first : randomUUID(), user));
    await assert.rejects(
      db.query(submitSQL, payload(randomUUID(), user)),
      /FEEDBACK_RATE_LIMIT/,
    );
    await json(db, submitSQL, payload(first, user));
    assert.equal(
      (await db.query('select * from feedback_submissions')).rows.length,
      5,
    );
  } finally {
    await db.close();
  }
});

test('admin calendar windows use UTC and feedback pagination preserves tied timestamps without duplicates', async () => {
  const { db, admin, user, other, session } = await setup();
  try {
    await db.exec("set timezone='America/Los_Angeles'");
    await db.query(
      "update auth.users set created_at=(((now() at time zone 'UTC')::date-6)::timestamp at time zone 'UTC') where id=$1",
      [user],
    );
    await db.query(
      "update auth.users set created_at=(((now() at time zone 'UTC')::date-6)::timestamp at time zone 'UTC')-interval '1 second' where id=$1",
      [other],
    );
    const ids = Array.from({ length: 55 }, () => randomUUID())
      .sort()
      .reverse();
    for (const id of ids)
      await db.query(
        "insert into public.feedback_submissions(id,user_id,category,message,app_version,build_number,platform) values($1,$2,'suggestion','A fictional pagination test message.','2.0.0','14','ios')",
        [id, user],
      );
    // Force a timestamp tie to exercise the secondary UUID cursor.
    await db.exec(
      "update public.feedback_submissions set created_at='2026-10-13T00:00:00Z'",
    );
    await actor(db, admin, { aal: 'aal2', session_id: session });
    const counts = await json(db, 'select pulse_admin_overview() result');
    assert.equal(counts.new_verified_7_days, 1);
    assert.equal(counts.new_verified_30_days, 2);
    assert.equal(
      counts.signup_days.reduce((n, d) => n + d.count, 0),
      2,
    );
    const page = await json(db, 'select pulse_admin_feedback() result');
    assert.equal(page.length, 51);
    assert.deepEqual(
      page.map((t) => t.id),
      ids.slice(0, 51),
    );
    const cursor = page[49];
    const remaining = await json(
      db,
      'select pulse_admin_feedback(null,$1,$2) result',
      [cursor.created_at, cursor.id],
    );
    assert.deepEqual(
      remaining.map((t) => t.id),
      ids.slice(50),
    );
    await assert.rejects(
      db.query('select pulse_admin_feedback(null,$1,null)', [
        cursor.created_at,
      ]),
      /FEEDBACK_INVALID/,
    );
    await db.exec('reset role');
    await db.query(
      'delete from pulse_private.admin_accounts where user_id=$1',
      [admin],
    );
    await actor(db, admin, { aal: 'aal2', session_id: session });
    await assert.rejects(
      db.query('select pulse_admin_feedback()'),
      /ADMIN_VERIFICATION_REQUIRED/,
    );
  } finally {
    await db.close();
  }
});
