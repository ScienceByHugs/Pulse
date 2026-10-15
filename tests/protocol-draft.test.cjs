const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');
const { protocolDraftSchedule } = loader()(
  'src/domain/protocolDraftSchedule.ts',
);
const base = {
  type: 'daily',
  time: '',
  additionalTimes: [],
  timeZone: 'local',
  days: [1, 3, 5],
  everyDays: '2',
  onDays: '5',
  offDays: '2',
  startDate: '2026-10-13',
};

test('a new Any time schedule matches the existing editor and gets one daily occurrence', () => {
  const schedule = protocolDraftSchedule(base);
  assert.equal('time' in schedule, false);
  assert.deepEqual(schedule.times, []);
  const { occurrencesForDay } = loader()('src/domain/occurrences.ts');
  const rows = occurrencesForDay(
    { id: 'fictional', schedule },
    '2026-10-13',
    'UTC',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].scheduledFor, null);
  assert.equal(rows[0].occurrenceKey, 'fictional:2026-10-13:any');
});

test('new schedules retain chosen daily times and reject ambiguous repeated times', () => {
  const schedule = protocolDraftSchedule({
    ...base,
    time: ' 08:00 ',
    additionalTimes: ['18:00'],
  });
  assert.equal(schedule.time, '08:00');
  assert.deepEqual(schedule.times, ['08:00', '18:00']);
  assert.throws(
    () =>
      protocolDraftSchedule({
        ...base,
        time: '08:00',
        additionalTimes: ['08:00'],
      }),
    /different/,
  );
  assert.throws(
    () => protocolDraftSchedule({ ...base, time: '99:00' }),
    /different|valid time/,
  );
});

test('blank or invalid intervals are rejected instead of becoming daily routines', () => {
  for (const everyDays of ['', '0', '-1', '1.5', 'abc', '366']) {
    assert.throws(
      () => protocolDraftSchedule({ ...base, type: 'interval', everyDays }),
      /Interval/,
    );
  }
  const schedule = protocolDraftSchedule({
    ...base,
    type: 'interval',
    everyDays: ' 3 ',
  });
  assert.equal(schedule.everyDays, 3);
  assert.equal(schedule.startDate, base.startDate);
});

test('cycle fields require explicit whole days, with an intentional zero-day break allowed', () => {
  for (const onDays of ['', '0', '-1', '1.5', 'abc', '366']) {
    assert.throws(
      () => protocolDraftSchedule({ ...base, type: 'cycle', onDays }),
      /on-days/,
    );
  }
  for (const offDays of ['', '-1', '0.5', 'abc', '366']) {
    assert.throws(
      () => protocolDraftSchedule({ ...base, type: 'cycle', offDays }),
      /off-days/,
    );
  }
  const schedule = protocolDraftSchedule({
    ...base,
    type: 'cycle',
    onDays: '4',
    offDays: '0',
  });
  assert.equal(schedule.onDays, 4);
  assert.equal(schedule.offDays, 0);
});

test('weekdays need a chosen day and as-needed ignores hidden recurring inputs', () => {
  assert.throws(
    () => protocolDraftSchedule({ ...base, type: 'weekdays', days: [] }),
    /weekday/,
  );
  assert.deepEqual(
    protocolDraftSchedule({
      ...base,
      type: 'as_needed',
      time: '99:00',
      onDays: '',
    }),
    { type: 'as_needed' },
  );
});
