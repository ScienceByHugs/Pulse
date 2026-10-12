const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { randomUUID } = require('node:crypto');
async function database() {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;`,
  );

  await db.exec('grant usage on schema auth,public to authenticated,anon;');
  const files = fs
    .readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql') && !f.includes('private_profile_photos'))
    .sort();
  for (const f of files) {
    await db.exec(
      fs
        .readFileSync('supabase/migrations/' + f, 'utf8')
        .replace('create extension if not exists pgcrypto;', ''),
    );
    if (f === '0005_idempotent_offline_quick_log.sql')
      await db.exec(
        'grant select,insert,update,delete on all tables in schema public to authenticated;',
      );
  }
  return db;
}
async function asUser(db, id) {
  await db.exec('reset role;');
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: id, role: 'authenticated' }),
  ]);
  await db.exec('set role authenticated;');
}
test('local PostgreSQL: event replay, stock, historical snapshots, duplicates, check-ins and ownership', async () => {
  const db = await database();
  try {
    const u = randomUUID(),
      other = randomUUID(),
      unverified = randomUUID(),
      p = randomUUID(),
      i = randomUUID(),
      c = randomUUID();
    await db.query(
      'insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now()),($3,null)',
      [u, other, unverified],
    );
    await db.query(
      "insert into public.protocols(id,user_id,name) values($1,$2,'Original routine')",
      [p, u],
    );
    await db.query(
      'insert into public.protocol_items(id,user_id,protocol_id,name,route,dose_amount,dose_unit,schedule) values($1,$2,$3,\'Original substance\',\'other\',2,\'mg\',\'{"type":"daily","times":["08:00","18:00"]}\')',
      [i, u, p],
    );
    await db.query(
      "insert into public.inventory_containers(id,user_id,protocol_item_id,total_amount,remaining_amount,unit) values($1,$2,$3,10,10,'mg')",
      [c, u, i],
    );
    await asUser(db, u);
    const time = new Date().toISOString(),
      day = time.slice(0, 10),
      event = randomUUID(),
      key = i + ':' + day + ':08:00';
    const args = [
      i,
      event,
      2,
      'mg',
      'other',
      null,
      c,
      time,
      time,
      key,
      day,
      'UTC',
      'completed',
    ];
    const call =
      'select * from public.record_tracking_event(' +
      args.map((_, n) => '$' + (n + 1)).join(',') +
      ')';
    const log = (await db.query(call, args)).rows[0];
    assert.equal(new Date(log.logged_at).toISOString(), time);
    assert.equal(log.snapshot.itemName, 'Original substance');
    await db.query(call, args);
    assert.equal(
      Number(
        (
          await db.query(
            'select remaining_amount from inventory_containers where id=$1',
            [c],
          )
        ).rows[0].remaining_amount,
      ),
      8,
    );
    await assert.rejects(
      db.query(call, [...args.slice(0, 1), randomUUID(), ...args.slice(2)]),
      /already recorded/,
    );
    await db.query(
      'update protocol_items set name=\'New name\',dose_amount=3,schedule=\'{"type":"weekdays","days":[1]}\' where id=$1',
      [i],
    );
    await db.query("update protocols set name='New routine' where id=$1", [p]);
    const frozen = (
      await db.query('select snapshot from dose_logs where id=$1', [log.id])
    ).rows[0].snapshot;
    assert.equal(frozen.itemName, 'Original substance');
    assert.equal(frozen.protocolName, 'Original routine');
    assert.deepEqual(frozen.schedule.times, ['08:00', '18:00']);
    assert.ok(
      (
        await db.query(
          'select id from protocol_item_versions where protocol_item_id=$1',
          [i],
        )
      ).rows.length >= 3,
    );
    await assert.rejects(
      db.query(
        "update protocol_item_versions set snapshot='{}' where protocol_item_id=$1",
        [i],
      ),
      /permission denied/,
    );
    await db.query("select * from correct_dose_log($1,0,2,$2,null,'voided')", [
      log.id,
      time,
    ]);
    assert.equal(
      Number(
        (
          await db.query(
            'select remaining_amount from inventory_containers where id=$1',
            [c],
          )
        ).rows[0].remaining_amount,
      ),
      10,
    );
    // Replay of an undone event stays undone and does not decrement again.
    assert.equal((await db.query(call, args)).rows[0].status, 'voided');
    const reLog = (
      await db.query(call, [
        i,
        randomUUID(),
        2,
        'mg',
        'other',
        null,
        c,
        time,
        time,
        key,
        day,
        'UTC',
        'completed',
      ])
    ).rows[0];
    assert.equal(reLog.status, 'completed');
    const skipped = (
      await db.query(call, [
        i,
        randomUUID(),
        3,
        'mg',
        'other',
        null,
        null,
        time,
        time,
        i + ':' + day + ':18:00',
        day,
        'UTC',
        'skipped',
      ])
    ).rows[0];
    assert.equal(skipped.status, 'skipped');
    assert.equal(
      Number(
        (
          await db.query(
            'select remaining_amount from inventory_containers where id=$1',
            [c],
          )
        ).rows[0].remaining_amount,
      ),
      8,
    );
    await assert.rejects(
      db.query(call, [
        i,
        randomUUID(),
        30,
        'mg',
        'other',
        null,
        c,
        time,
        null,
        null,
        day,
        'UTC',
        'completed',
      ]),
      /Not enough inventory/,
    );
    await assert.rejects(
      db.query(call, [
        i,
        randomUUID(),
        2,
        'mg',
        'other',
        null,
        c,
        new Date(Date.now() + 3600000).toISOString(),
        null,
        null,
        day,
        'UTC',
        'completed',
      ]),
      /future/,
    );
    await assert.rejects(
      db.query(call, [
        i,
        randomUUID(),
        'NaN',
        'mg',
        'other',
        null,
        c,
        time,
        null,
        null,
        day,
        'UTC',
        'completed',
      ]),
      /Invalid amount/,
    );
    const copy = (
      await db.query('select * from duplicate_protocol($1,$2,$3,$4)', [
        p,
        'Copied routine',
        day,
        null,
      ])
    ).rows[0];
    assert.equal(copy.status, 'paused');
    const copied = (
      await db.query('select id from protocol_items where protocol_id=$1', [
        copy.id,
      ])
    ).rows;
    assert.equal(copied.length, 1);
    assert.equal(
      (
        await db.query(
          'select id from inventory_containers where protocol_item_id=$1',
          [copied[0].id],
        )
      ).rows.length,
      0,
    );
    await db.query(
      'insert into daily_checkins(user_id,local_date,sleep,energy,mood,notes) values($1,$2,7.5,4,3,$3)',
      [u, day, 'Private observation'],
    );
    await db.query(
      'insert into daily_checkins(user_id,local_date,sleep) values($1,$2,8) on conflict(user_id,local_date) do update set sleep=excluded.sleep',
      [u, day],
    );
    assert.equal(
      (await db.query('select id from daily_checkins')).rows.length,
      1,
    );
    await assert.rejects(
      db.query('update daily_checkins set energy=9'),
      /check constraint/,
    );
    const canceledEvent = randomUUID();
    await db.query('select undo_tracking_event($1)', [canceledEvent]);
    const canceled = await db.query(call, [
      i,
      canceledEvent,
      30,
      'mg',
      'other',
      null,
      c,
      time,
      null,
      null,
      day,
      'UTC',
      'completed',
    ]);
    assert.equal(canceled.rows[0].id, null);
    assert.equal(
      Number(
        (
          await db.query(
            'select remaining_amount from inventory_containers where id=$1',
            [c],
          )
        ).rows[0].remaining_amount,
      ),
      8,
    );
    await db.query('select undo_tracking_event($1)', [reLog.client_event_id]);
    await db.query('select undo_tracking_event($1)', [reLog.client_event_id]);
    assert.equal(
      Number(
        (
          await db.query(
            'select remaining_amount from inventory_containers where id=$1',
            [c],
          )
        ).rows[0].remaining_amount,
      ),
      10,
    );
    await asUser(db, other);
    assert.equal((await db.query('select id from dose_logs')).rows.length, 0);
    assert.equal(
      (await db.query('select id from protocol_item_versions')).rows.length,
      0,
    );
    assert.equal(
      (await db.query('select id from daily_checkins')).rows.length,
      0,
    );
    await assert.rejects(
      db.query(call, [
        i,
        randomUUID(),
        2,
        'mg',
        'other',
        null,
        c,
        time,
        null,
        null,
        day,
        'UTC',
        'completed',
      ]),
      /not found/,
    );
    await assert.rejects(
      db.query('select * from duplicate_protocol($1,$2,$3,$4)', [
        p,
        'Forbidden copy',
        day,
        null,
      ]),
      /not found/,
    );
    await assert.rejects(
      db.query('insert into daily_checkins(user_id,local_date) values($1,$2)', [
        u,
        day,
      ]),
      /row-level security/,
    );
    await asUser(db, unverified);
    await assert.rejects(
      db.query('insert into daily_checkins(user_id,local_date) values($1,$2)', [
        unverified,
        day,
      ]),
      /row-level security/,
    );
    await assert.rejects(db.query(call, args), /Verified/);
    await db.exec('reset role;set role anon');
    await assert.rejects(db.query(call, args), /permission denied/);
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [u]);
    assert.equal(
      (await db.query('select id from daily_checkins')).rows.length,
      0,
    );
    assert.equal(
      (await db.query('select id from protocol_item_versions')).rows.length,
      0,
    );
    assert.equal(
      (await db.query('select event_id from tracking_event_cancellations')).rows
        .length,
      0,
    );
  } finally {
    await db.close();
  }
});
