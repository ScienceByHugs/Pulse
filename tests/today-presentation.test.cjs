const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');
const { groupToday, todayEmptyMessage } = loader()(
  'src/domain/todayPresentation.ts',
);
const slot = (id, time) => ({
  id,
  occurrenceKey: id,
  scheduledFor: time,
  dayKey: '2026-10-12',
  timeZone: 'UTC',
});
test('Today separates confirmed logs/skips from pending records and finds next future occurrence by instant', () => {
  const rows = [
    slot('late', '2026-10-12T23:00:00Z'),
    slot('logged', '2026-10-12T09:00:00Z'),
    slot('pending', '2026-10-12T10:00:00Z'),
    slot('earlier', '2026-10-12T08:00:00Z'),
    slot('skip', null),
    slot('next', '2026-10-12T18:00:00Z'),
    slot('any', null),
  ];
  const g = groupToday(
    rows,
    new Set(['logged', 'pending']),
    new Set(['skip']),
    new Set(['pending']),
    new Date('2026-10-12T17:00:00Z'),
  );
  assert.deepEqual(
    g.logged.map((i) => i.id),
    ['logged'],
  );
  assert.deepEqual(
    g.skipped.map((i) => i.id),
    ['skip'],
  );
  assert.deepEqual(
    g.waiting.map((i) => i.id),
    ['pending'],
  );
  assert.equal(g.next.id, 'next');
  assert.equal(g.earlier, 1);
  assert.equal(
    new Set(
      [...g.remaining, ...g.waiting, ...g.logged, ...g.skipped].map(
        (i) => i.id,
      ),
    ).size,
    rows.length,
  );
});
test('Today empty states distinguish paused tracking, protocol boundaries, as-needed routines and off-days', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  const item = {
    id: 'x',
    schedule: { type: 'daily', timeZone: 'UTC' },
    starts_on: '2026-10-13',
  };
  assert.equal(todayEmptyMessage([], 0, 0, now).action, 'Create a protocol');
  assert.equal(
    todayEmptyMessage([], 2, 2, now).action,
    'Manage paused routines',
  );
  assert.equal(
    todayEmptyMessage([item], 1, 0, now).action,
    'Review protocol dates',
  );
  assert.equal(
    todayEmptyMessage(
      [
        {
          ...item,
          starts_on: null,
          schedule: { type: 'as_needed', timeZone: 'UTC' },
        },
      ],
      1,
      0,
      now,
    ).action,
    'Review routines',
  );
  assert.equal(
    todayEmptyMessage([{ ...item, starts_on: null }], 1, 0, now).action,
    'Review schedules',
  );
});
