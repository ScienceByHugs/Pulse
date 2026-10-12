const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loader } = require('./helpers.cjs');
function harness() {
  const records = new Map(),
    legacy = new Map();
  const storage = {
    getItem: async (k) => records.get(k) ?? null,
    setItem: async (k, v) => {
      records.set(k, v);
    },
    removeItem: async (k) => records.delete(k),
  };
  const outbox = loader({
    '@react-native-async-storage/async-storage': {
      __esModule: true,
      default: {
        getItem: async (k) => legacy.get(k) ?? null,
        removeItem: async (k) => legacy.delete(k),
      },
    },
    '@/lib/privateStorage': { privateStorage: storage },
  })('src/lib/outbox.ts');
  let user = 'u';
  let mode = 'offline';
  const server = new Map();
  const calls = [];
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: user } } } }),
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (mode === 'offline')
        return { error: { message: 'Network request failed', status: 0 } };
      if (mode === 'reject')
        return { error: { message: 'Not enough inventory' } };
      if (name === 'undo_tracking_event') {
        const row = server.get(args.p_event_id);
        if (row) row.status = 'voided';
        return { data: true };
      }
      if (name === 'correct_dose_log') {
        const row = [...server.values()].find((r) => r.id === args.p_log_id);
        row.status = 'voided';
        return { data: row };
      }
      if (!server.has(args.p_event_id))
        server.set(args.p_event_id, {
          id: args.p_event_id,
          amount: args.p_amount,
          unit: args.p_unit,
          logged_at: args.p_logged_at,
          protocol_item_id: args.p_item_id,
          status: args.p_status,
          revision: 0,
          site: null,
        });
      return mode === 'uncertain'
        ? {
            error: {
              message: 'Network request failed after commit',
              status: 0,
            },
          }
        : { data: server.get(args.p_event_id) };
    },
  };
  const service = loader({
    'expo-crypto': { randomUUID },
    '@/lib/supabase': { supabase },
    '@/lib/outbox': outbox,
  })('src/services/pulse.ts');
  return {
    outbox,
    service,
    calls,
    server,
    setMode: (value) => (mode = value),
    setUser: (value) => (user = value),
  };
}
const item = {
  id: 'i',
  name: 'Fixture',
  dose_amount: 2,
  dose_unit: 'mg',
  route: 'other',
  schedule: { type: 'daily' },
  dayKey: '2026-10-11',
  timeZone: 'UTC',
  occurrenceKey: 'i:2026-10-11:08:00',
  scheduledFor: '2026-10-11T08:00:00Z',
  inventory_containers: [
    {
      id: 'c',
      is_active: true,
      remaining_amount: 4,
      total_amount: 4,
      unit: 'mg',
      low_threshold: 0,
    },
  ],
};
test('offline logging persists original time, reserves stock, rejects repeated taps and replays once', async () => {
  const h = harness();
  const saved = await h.service.quickLog(item);
  assert.equal(saved.queued, true);
  const queue = await h.outbox.readOutbox('u');
  assert.equal(queue.length, 1);
  assert.ok(queue[0].loggedAt);
  const instant = queue[0].loggedAt;
  await assert.rejects(h.service.quickLog(item), /already pending/);
  await h.service.quickLog({
    ...item,
    occurrenceKey: 'i:2026-10-11:18:00',
    scheduledFor: '2026-10-11T18:00:00Z',
  });
  await assert.rejects(
    h.service.quickLog({ ...item, occurrenceKey: 'i:2026-10-11:20:00' }),
    /enough/,
  );
  h.setMode('online');
  assert.equal(await h.service.flushQuickLogOutbox(), 2);
  assert.equal(h.server.size, 2);
  assert.equal([...h.server.values()][0].logged_at, instant);
  assert.equal((await h.outbox.readOutbox('u')).length, 0);
  assert.equal(await h.service.flushQuickLogOutbox(), 0);
});
test('a rejected event remains visible for review, while later entries sync and other accounts stay isolated', async () => {
  const h = harness();
  await h.service.quickLog(item);
  h.setMode('reject');
  await h.service.flushQuickLogOutbox();
  assert.equal((await h.outbox.readOutbox('u'))[0].needsReview, true);
  assert.match((await h.outbox.readOutbox('u'))[0].syncError, /inventory/);
  h.setMode('online');
  h.setUser('other');
  await h.service.flushQuickLogOutbox();
  assert.equal(h.server.size, 0);
  h.setUser('u');
  assert.equal(await h.service.flushQuickLogOutbox(), 0);
  assert.equal(await h.service.flushQuickLogOutbox(true), 1);
});
test('offline Undo preserves the event until both recording and server Undo are acknowledged', async () => {
  const h = harness();
  const result = await h.service.quickLog(item);
  await h.outbox.updateQuickLog('u', result.eventId, { undoRequested: true });
  assert.equal(await h.outbox.removeQuickLog('u', result.eventId), false);
  h.setMode('online');
  assert.equal(await h.service.flushQuickLogOutbox(), 1);
  assert.equal(h.server.size, 0);
  assert.equal((await h.outbox.readOutbox('u')).length, 0);
});
test('older queue entries without original timestamps are held for review rather than fabricated', async () => {
  const h = harness();
  await h.outbox.enqueueQuickLog('u', {
    protocolItemId: 'i',
    amount: 2,
    unit: 'mg',
    clientEventId: randomUUID(),
  });
  h.setMode('online');
  assert.equal(await h.service.flushQuickLogOutbox(), 0);
  assert.equal(h.server.size, 0);
  assert.equal((await h.outbox.readOutbox('u'))[0].needsReview, true);
});

test('a lost response after server commit reuses the same event on reconnect', async () => {
  const h = harness();
  h.setMode('uncertain');
  const result = await h.service.quickLog(item);
  assert.equal(result.queued, true);
  assert.equal(h.server.size, 1);
  h.setMode('online');
  assert.equal(await h.service.flushQuickLogOutbox(), 1);
  assert.equal(h.server.size, 1);
  assert.equal(
    h.calls
      .filter((c) => c.name === 'record_tracking_event')
      .every((c) => c.args.p_event_id === result.eventId),
    true,
  );
});
