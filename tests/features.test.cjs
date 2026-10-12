const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');
const load = loader();
const occurrence = load('src/domain/occurrences.ts');
const schedule = load('src/domain/schedule.ts');
const { todayRecordState } = load('src/domain/todayState.ts');
const { supplyEstimate, preferredContainer } = load('src/domain/inventory.ts');
const { checkinTrends } = load('src/domain/checkinTrends.ts');
const { filterReportLogs, buildReportPDF } = load('src/domain/report.ts');
const { buildReminderPlan } = load('src/domain/reminderPlan.ts');
test('separate daily times, local travel, fixed home zone and daylight saving gaps/folds', () => {
  const item = {
    id: 'x',
    schedule: { type: 'daily', times: ['08:00', '18:00'], timeZone: 'local' },
  };
  const la = occurrence.todayOccurrences(
    [item],
    new Date('2026-10-11T15:00:00Z'),
    'America/Los_Angeles',
  );
  assert.equal(la.length, 2);
  assert.equal(la[0].scheduledFor, '2026-10-11T15:00:00.000Z');
  assert.equal(la[1].scheduledFor, '2026-10-12T01:00:00.000Z');
  const ny = occurrence.todayOccurrences(
    [item],
    new Date('2026-10-11T15:00:00Z'),
    'America/New_York',
  );
  assert.equal(ny[0].scheduledFor, '2026-10-11T12:00:00.000Z');
  const fixed = occurrence.todayOccurrences(
    [
      {
        ...item,
        schedule: { ...item.schedule, timeZone: 'America/Los_Angeles' },
      },
    ],
    new Date('2026-10-11T15:00:00Z'),
    'America/New_York',
  );
  assert.equal(fixed[0].scheduledFor, la[0].scheduledFor);
  assert.equal(
    occurrence.wallTimeToInstant('2026-03-08', '02:30', 'America/Los_Angeles'),
    null,
  );
  assert.equal(
    occurrence
      .wallTimeToInstant('2026-11-01', '01:30', 'America/Los_Angeles')
      .toISOString(),
    '2026-11-01T08:30:00.000Z',
  );
  assert.equal(
    occurrence
      .wallTimeToInstant('2026-10-11', '08:00', 'Asia/Kathmandu')
      .toISOString(),
    '2026-10-11T02:15:00.000Z',
  );
  assert.throws(
    () =>
      schedule.validateTrackedSchedule({
        type: 'daily',
        times: ['08:00', '08:00'],
      }),
    /different/,
  );
  assert.throws(
    () =>
      schedule.validateTrackedSchedule({
        type: 'daily',
        timeZone: 'No/Such_Zone',
      }),
    /zone/,
  );
});
test('a morning log resolves only that occurrence; evening can be skipped or undone separately', () => {
  const items = occurrence.todayOccurrences(
    [{ id: 'x', schedule: { type: 'daily', times: ['08:00', '18:00'] } }],
    new Date('2026-10-11T15:00:00Z'),
    'UTC',
  );
  const now = new Date('2026-10-11T15:00:00Z');
  const completed = {
    protocol_item_id: 'x',
    occurrence_key: items[0].occurrenceKey,
    status: 'completed',
    logged_at: now.toISOString(),
  };
  const result = todayRecordState(items, [completed], now);
  assert.equal(result.completed, 1);
  assert.equal(result.resolvedIds.has(items[1].occurrenceKey), false);
  const skip = {
    ...completed,
    occurrence_key: items[1].occurrenceKey,
    status: 'skipped',
  };
  assert.equal(todayRecordState(items, [completed, skip], now).skipped, 1);
  assert.equal(
    todayRecordState(items, [completed, { ...skip, status: 'voided' }], now)
      .resolvedIds.size,
    1,
  );
});
test('reminders carry separate occurrence IDs and honor end dates across a DST boundary', () => {
  const plan = buildReminderPlan(
    [
      {
        id: 'x',
        ends_on: '2026-11-02',
        schedule: {
          type: 'daily',
          times: ['08:00', '18:00'],
          timeZone: 'America/Los_Angeles',
        },
      },
    ],
    new Date('2026-10-31T00:00:00Z'),
  );
  assert.equal(new Set(plan.map((p) => p.occurrenceKey)).size, plan.length);
  const before = plan.find((p) => p.occurrenceKey === 'x:2026-10-31:08:00');
  const after = plan.find((p) => p.occurrenceKey === 'x:2026-11-01:08:00');
  assert.equal(before.when.toISOString(), '2026-10-31T15:00:00.000Z');
  assert.equal(after.when.toISOString(), '2026-11-01T16:00:00.000Z');
});
test('inventory excludes expired/inactive or mismatched containers and forecasts multiple daily entries', () => {
  const now = new Date('2026-10-11T07:00:00Z');
  const item = {
    id: 'i',
    dose_amount: 2,
    dose_unit: 'mg',
    schedule: { type: 'daily', times: ['08:00', '18:00'], timeZone: 'UTC' },
    inventory_containers: [
      {
        id: 'expired',
        is_active: true,
        unit: 'mg',
        remaining_amount: 100,
        total_amount: 100,
        low_threshold: 1,
        expires_at: '2026-10-10T00:00:00Z',
      },
      {
        id: 'open',
        is_active: true,
        unit: 'mg',
        remaining_amount: 8,
        total_amount: 10,
        low_threshold: 1,
        opened_at: '2026-10-09T00:00:00Z',
      },
      {
        id: 'inactive',
        is_active: false,
        unit: 'mg',
        remaining_amount: 100,
        total_amount: 100,
        low_threshold: 1,
      },
    ],
  };
  assert.equal(preferredContainer(item, now).id, 'open');
  const estimate = supplyEstimate(item, now);
  assert.equal(estimate.entries, 4);
  assert.equal(estimate.until, '2026-10-13');
  assert.equal(estimate.remaining, 8);
});
test('check-in summaries use only reported values and require observations in both weeks for comparisons', () => {
  const rows = [
    { local_date: '2026-10-11', sleep: 8, energy: null, mood: 4 },
    { local_date: '2026-10-10', sleep: 6, energy: 3, mood: 2 },
    { local_date: '2026-10-04', sleep: 7, energy: 5, mood: null },
    { local_date: '2026-10-03', sleep: 5, energy: null, mood: 3 },
  ];
  const trends = checkinTrends(rows, new Date(2026, 9, 11));
  assert.equal(trends[0].mean, 7);
  assert.equal(trends[0].delta, 1);
  assert.equal(trends[1].count, 1);
  assert.equal(trends[1].delta, null);
});
test('report selection uses historical names, saved local dates, status and chosen scope', () => {
  const rows = [
    {
      protocol_item_id: 'i',
      amount: 1,
      unit: 'mg',
      status: 'completed',
      local_date: '2026-10-11',
      logged_at: '2026-10-12T01:00:00Z',
      snapshot: {
        itemName: 'Old name',
        protocolId: 'p',
        protocolName: 'Routine',
      },
      protocol_items: { name: 'New name' },
    },
    {
      protocol_item_id: 'i',
      status: 'voided',
      local_date: '2026-10-11',
      logged_at: '2026-10-11T10:00:00Z',
    },
  ];
  const options = {
    start: '2026-10-11',
    end: '2026-10-11',
    includeLogs: true,
    includeCheckIns: false,
    includeNotes: false,
    search: 'old name',
    protocolId: 'p',
  };
  assert.equal(filterReportLogs(rows, options).length, 1);
  assert.equal(occurrence.entryName(rows[0]), 'Old name');
});
test('PDF generation handles long notes, multiple pages and excludes unselected private notes', async () => {
  const checks = Array.from({ length: 3 }, (_, i) => ({
    local_date: `2026-10-${String(9 + i).padStart(2, '0')}`,
    sleep: 7,
    energy: 3,
    mood: 4,
    notes: 'PRIVATE_SENTINEL '.repeat(120),
  }));
  const base = {
    start: '2026-10-09',
    end: '2026-10-11',
    includeLogs: false,
    includeCheckIns: true,
    includeNotes: false,
  };
  const bytes = await buildReportPDF([], checks, base);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
  const { PDFDocument } = require('pdf-lib');
  const one = await PDFDocument.load(bytes);
  assert.equal(one.getPageCount(), 1);
  const many = await PDFDocument.load(
    await buildReportPDF([], checks, { ...base, includeNotes: true }),
  );
  assert.ok(many.getPageCount() > 1);
});

test('unselected notes are absent from the actual PDF content streams', async () => {
  const { PDFDocument, decodePDFRawStream } = require('pdf-lib');
  async function contents(bytes) {
    const doc = await PDFDocument.load(bytes);
    return doc
      .getPages()
      .flatMap((page) => {
        const streams = page.node.Contents();
        if (!streams) return [];
        return Array.from({ length: streams.size() }, (_, i) =>
          Buffer.from(
            decodePDFRawStream(doc.context.lookup(streams.get(i))).decode(),
          ).toString(),
        );
      })
      .join('');
  }
  const checks = [
    {
      local_date: '2026-10-11',
      sleep: 7,
      energy: 3,
      mood: 4,
      notes: 'PRIVATE_SENTINEL',
    },
  ];
  const options = {
    start: '2026-10-11',
    end: '2026-10-11',
    includeLogs: false,
    includeCheckIns: true,
    includeNotes: false,
  };
  const needle = Buffer.from('PRIVATE_SENTINEL').toString('hex').toUpperCase();
  assert.equal(
    (await contents(await buildReportPDF([], checks, options))).includes(
      needle,
    ),
    false,
  );
  assert.equal(
    (
      await contents(
        await buildReportPDF([], checks, { ...options, includeNotes: true }),
      )
    ).includes(needle),
    true,
  );
});
