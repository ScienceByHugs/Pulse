const fs = require('node:fs');
const load = require('../tests/helpers.cjs').loader();
const { buildReportPDF } = load('src/domain/report.ts');
(async () => {
  const logs = Array.from({ length: 16 }, (_, i) => ({
    id: String(i),
    protocol_item_id: 'sample',
    amount: 2,
    unit: 'mg',
    status: i % 4 ? 'completed' : 'skipped',
    logged_at: `2026-10-${String(1 + Math.floor(i / 2)).padStart(2, '0')}T08:00:00Z`,
    local_date: `2026-10-${String(1 + Math.floor(i / 2)).padStart(2, '0')}`,
    time_zone: 'America/Los_Angeles',
    snapshot: {
      itemName:
        i === 0
          ? 'Sample α observation with a deliberately long substance label'
          : 'Sample tracked item',
      protocolName: 'Sample routine',
    },
    site: i % 2 ? 'Recorded site' : null,
  }));
  const checkins = [
    {
      id: 'c1',
      local_date: '2026-10-03',
      sleep: 7.5,
      energy: 4,
      mood: 3,
      notes: 'A sample observation for report review. '.repeat(45),
    },
    {
      id: 'c2',
      local_date: '2026-10-04',
      sleep: null,
      energy: null,
      mood: null,
      notes: 'Private notes are included only when selected.',
    },
  ];
  const bytes = await buildReportPDF(
    logs,
    checkins,
    {
      start: '2026-10-01',
      end: '2026-10-10',
      includeLogs: true,
      includeCheckIns: true,
      includeNotes: true,
    },
    fs.readFileSync('assets/fonts/NotoSans-Regular.ttf'),
    fs.readFileSync('assets/fonts/NotoSans-Bold.ttf'),
  );
  fs.writeFileSync('output/pdf/pulse-report-sample.pdf', bytes);
  console.log('Created report sample with synthetic data.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
