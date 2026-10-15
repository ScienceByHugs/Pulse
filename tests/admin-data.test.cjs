const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loader } = require('./helpers.cjs');
const api = loader()('admin-web/data.ts');
const overview = {
  registered_users: 5,
  verified_users: 4,
  pending_confirmation: 1,
  new_verified_7_days: 2,
  new_verified_30_days: 4,
  open_feedback: 3,
  received_feedback: 2,
  signup_days: Array.from({ length: 30 }, (_, i) => ({
    day: `2026-09-${String(i + 1).padStart(2, '0')}`,
    count: i === 1 ? 4 : 0,
  })),
  generated_at: '2026-10-13T00:00:00Z',
};
test('admin response projection retains only counts and ticket fields, dropping unexpected identifiers or records', () => {
  const parsed = api.parseOverview({
    ...overview,
    email: 'private@example.test',
    user_id: randomUUID(),
    records: ['private'],
  });
  assert.deepEqual(parsed, overview);
  const ticket = {
    id: randomUUID(),
    category: 'suggestion',
    message: 'A valid feedback message.',
    status: 'received',
    app_version: '2.0.0',
    build_number: '14',
    platform: 'ios',
    created_at: '2026-10-13T00:00:00Z',
    updated_at: '2026-10-13T00:00:00Z',
    contact_email: null,
  };
  assert.deepEqual(
    api.parseTicket({
      ...ticket,
      user_id: randomUUID(),
      profile: { private: true },
    }),
    ticket,
  );
});
test('admin responses reject malformed counts, dates, statuses and oversize ticket content', () => {
  for (const patch of [
    { verified_users: -1 },
    { open_feedback: NaN },
    { signup_days: [] },
    { generated_at: 'not-a-date' },
  ])
    assert.throws(() => api.parseOverview({ ...overview, ...patch }));
  const ticket = {
    id: randomUUID(),
    category: 'suggestion',
    message: 'A valid feedback message.',
    status: 'received',
    app_version: '2.0.0',
    build_number: '14',
    platform: 'ios',
    created_at: '2026-10-13T00:00:00Z',
    updated_at: '2026-10-13T00:00:00Z',
    contact_email: null,
  };
  for (const patch of [
    { status: 'administrator' },
    { message: 'x'.repeat(2001) },
    { id: 'unsafe' },
    { created_at: 'bad' },
    { contact_email: undefined },
  ])
    assert.throws(() => api.parseTicket({ ...ticket, ...patch }));
});
