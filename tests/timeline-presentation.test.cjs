const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');
const {
  filterTimelineEntries,
  groupTimelineByDay,
  entriesForCalendarDay,
  timelineProtocolId,
  recordedTimeLabel,
} = loader()('src/domain/timelinePresentation.ts');
const filters = {
  search: '',
  status: '',
  substance: '',
  protocol: '',
  from: '',
  through: '',
};
const entry = (id, day, extra = {}) => ({
  id,
  local_date: day,
  logged_at: `${day}T12:00:00Z`,
  protocol_item_id: 'item',
  amount: 1,
  unit: 'unit',
  route: 'other',
  site: null,
  status: 'completed',
  revision: 0,
  snapshot: {
    itemName: 'Sample item',
    protocolId: 'original',
    protocolName: 'Sample routine',
  },
  ...extra,
});

test('Timeline keeps repeating month/day labels in distinct years and sorts full dates', () => {
  const rows = [
    entry('a', '2020-10-12'),
    entry('b', '2026-10-12'),
    entry('c', '2026-10-13'),
  ];
  assert.deepEqual(
    groupTimelineByDay(rows).map(([day, entries]) => [
      day,
      entries.map((e) => e.id),
    ]),
    [
      ['2026-10-13', ['c']],
      ['2026-10-12', ['b']],
      ['2020-10-12', ['a']],
    ],
  );
});

test('Day view uses the saved calendar day for travel and backdated records, not timestamp day', () => {
  const rows = [
    entry('travel', '2026-10-12', {
      logged_at: '2026-10-13T02:00:00Z',
      time_zone: 'America/Los_Angeles',
    }),
    entry('other', '2026-10-11', { logged_at: '2026-10-12T20:00:00Z' }),
    entry('future', '2026-10-13'),
  ];
  assert.deepEqual(
    entriesForCalendarDay(rows, '2026-10-12').map((e) => e.id),
    ['travel'],
  );
});

test('Protocol filter includes legacy records while preserving snapshot identity after reassignment', () => {
  const items = [{ id: 'item', protocol_id: 'current', name: 'Renamed item' }];
  const historical = entry('historical', '2026-10-12');
  const legacy = entry('legacy', '2026-10-12', { snapshot: null });
  assert.equal(timelineProtocolId(historical, items), 'original');
  assert.equal(timelineProtocolId(legacy, items), 'current');
  assert.deepEqual(
    filterTimelineEntries(
      [historical, legacy],
      { ...filters, protocol: 'current' },
      items,
    ).map((e) => e.id),
    ['legacy'],
  );
  assert.deepEqual(
    filterTimelineEntries(
      [historical, legacy],
      { ...filters, protocol: 'original' },
      items,
    ).map((e) => e.id),
    ['historical'],
  );
});

test('Combined Timeline filters apply to calendar and overview input with inclusive saved dates', () => {
  const rows = [
    entry('start', '2026-10-10'),
    entry('end', '2026-10-12'),
    entry('outside', '2026-10-13'),
    entry('skip', '2026-10-11', { status: 'skipped' }),
    entry('other-substance', '2026-10-11', { protocol_item_id: 'other' }),
  ];
  assert.deepEqual(
    filterTimelineEntries(
      rows,
      {
        ...filters,
        search: 'sample routine',
        status: 'completed',
        substance: 'item',
        protocol: 'original',
        from: '2026-10-10',
        through: '2026-10-12',
      },
      [],
    ).map((e) => e.id),
    ['start', 'end'],
  );
  assert.deepEqual(
    filterTimelineEntries(
      rows,
      { ...filters, from: '2026-10-12', through: '2026-10-10' },
      [],
    ),
    [],
  );
});

test('Recorded times stay in their saved time zone and tolerate legacy invalid zones', () => {
  const saved = entry('travel', '2026-10-12', {
    logged_at: '2026-10-13T02:15:00Z',
    time_zone: 'America/Los_Angeles',
  });
  const expected = new Date(saved.logged_at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: saved.time_zone,
  });
  assert.equal(recordedTimeLabel(saved), expected);
  assert.doesNotThrow(() =>
    recordedTimeLabel({ ...saved, time_zone: 'Invalid/Zone' }),
  );
});
