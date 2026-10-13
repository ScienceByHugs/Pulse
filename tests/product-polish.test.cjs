const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');
const load = loader();
const { eligibleManualItems } = load('src/domain/manualTracking.ts');
const { matchesTimelineSearch } = load('src/domain/timelineSearch.ts');
const { inventoryHistoryEvents } = load('src/domain/inventoryHistory.ts');
const { reminderHealthText } = load('src/domain/reminderHealth.ts');
test('manual tracking excludes paused, archived, date-bounded and temporarily paused substances', () => {
  const now = new Date('2026-10-12T12:00:00Z'),
    base = { id: 'ok', schedule: { type: 'as_needed', timeZone: 'UTC' } };
  const rows = [
    base,
    { ...base, id: 'paused', active: false },
    { ...base, id: 'archived', archived_at: 'x' },
    { ...base, id: 'future', starts_on: '2026-10-13' },
    { ...base, id: 'ended', ends_on: '2026-10-11' },
    {
      ...base,
      id: 'temporary',
      schedule: {
        ...base.schedule,
        temporary: {
          paused: true,
          startDate: '2026-10-12',
          endDate: '2026-10-12',
        },
      },
    },
    { ...base, id: 'scheduled', schedule: { type: 'daily' } },
  ];
  assert.deepEqual(
    eligibleManualItems(rows, now).map((i) => i.id),
    ['ok'],
  );
});
test('timeline search handles multiple words, accents and renamed substances without searching notes', () => {
  const entry = {
    id: 'e',
    protocol_item_id: 'i',
    snapshot: { itemName: 'Café peptide', protocolName: 'Evening routine' },
    notes: 'private unrelated text',
  };
  assert.equal(matchesTimelineSearch(entry, 'evening cafe', []), true);
  assert.equal(
    matchesTimelineSearch(entry, 'renamed', [{ id: 'i', name: 'Renamed' }]),
    true,
  );
  assert.equal(matchesTimelineSearch(entry, 'private', []), false);
});
test('stock history distinguishes starting supply, balance corrections and undone entries', () => {
  const rows = inventoryHistoryEvents(
    [{ id: 'c', created_at: '2026-10-10', total_amount: 20, unit: 'mg' }],
    [
      {
        id: 'a',
        inventory_container_id: 'c',
        created_at: '2026-10-12',
        old_remaining_amount: 18,
        new_remaining_amount: 17,
        reason: 'Recount',
      },
    ],
    [
      {
        id: 'l',
        logged_at: '2026-10-11',
        amount: 2,
        unit: 'mg',
        status: 'undone',
      },
    ],
  );
  assert.deepEqual(
    rows.map((r) => r.title),
    ['Stock corrected', 'Entry undone (current status)', 'Container added'],
  );
  assert.match(rows[0].detail, /18 → 17 mg/);
  assert.match(rows[1].detail, /restored where tracked/);
});
test('reminder health distinguishes web, disabled, denied and scheduled states', () => {
  const allowed = { granted: true, canAskAgain: true },
    denied = { granted: false, canAskAgain: false };
  assert.match(reminderHealthText(true, allowed, 2, true).title, /web/);
  assert.match(reminderHealthText(false, allowed, 2).title, /off/);
  assert.match(reminderHealthText(true, denied, 0).body, /settings/);
  assert.match(reminderHealthText(true, allowed, 2).title, /2 pending/);
});
