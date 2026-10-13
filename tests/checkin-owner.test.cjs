const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');

test('a session change while opening a check-in cannot copy the old account observations into the new account', async () => {
  const writes = [];
  const load = loader({
    '@/lib/supabase': {
      supabase: {
        auth: {
          getUser: async () => ({
            data: {
              user: { id: 'new-owner', email_confirmed_at: '2026-01-01' },
            },
            error: null,
          }),
        },
        from: () => ({
          upsert: async (...args) => {
            writes.push(args);
            return { error: null };
          },
        }),
      },
    },
  });
  const { saveCheckIn } = load('src/services/checkins.ts');
  const { localDateKey } = load('src/domain/schedule.ts');
  const observation = {
    local_date: localDateKey(),
    sleep: 8,
    energy: 4,
    mood: 4,
    notes: 'Fictional test observation',
  };
  await assert.rejects(
    saveCheckIn(observation, 'old-owner'),
    /account changed/,
  );
  assert.equal(writes.length, 0);
  await saveCheckIn(observation, 'new-owner');
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0].user_id, 'new-owner');
});
