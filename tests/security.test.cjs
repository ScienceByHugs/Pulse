const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
function memory() {
  const values = new Map();
  return {
    values,
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); }
  };
}
const { createChunkedStorage } = load('src/lib/storageAdapter.ts');
const { isValidEmail } = load('src/domain/validation.ts');
const schedule = load('src/domain/schedule.ts');
const { buildReminderPlan } = load('src/domain/reminderPlan.ts', { './schedule': schedule });

test('reminders prioritize nearest events and respect protocol ends and temporary times', () => {
  const now = new Date(2026, 9, 11, 8);
  const items = [
    { id: 'a', schedule: { type: 'daily', time: '09:00', temporary: { startDate: '2026-10-12', endDate: '2026-10-12', time: '11:00' } }, ends_on: '2026-10-12' },
    { id: 'b', schedule: { type: 'daily', time: '10:00' } },
    { id: 'c', schedule: { type: 'as_needed' } }
  ];
  const plan = buildReminderPlan(items, now, 4);
  assert.deepEqual(plan.map(entry => entry.item.id), ['a', 'b', 'b', 'a']);
  assert.equal(plan[3].when.getHours(), 11);
  assert.equal(buildReminderPlan(items, now).filter(entry => entry.item.id === 'a').length, 2);
  const many = Array.from({ length: 8 }, (_, index) => ({ id: String(index), schedule: { type: 'daily', time: '09:00' } }));
  assert.equal(buildReminderPlan(many, now).length, 60);
});

test('email flows accept ordinary addresses and reject whitespace and missing domains', () => {
  for (const email of ['anthony@sciencebyhugs.com', 'test+beta@example.org', '  person@example.com  ']) assert.equal(isValidEmail(email), true);
  for (const email of ['person@example', 'person example.com', 'a b@example.com', 'a@b c.com', '@example.com']) assert.equal(isValidEmail(email), false);
});

test('long Unicode sessions survive secure storage and stay within native value limits', async () => {
  const backing = memory();
  const storage = createChunkedStorage(backing);
  const value = JSON.stringify({ token: 'abc'.repeat(3000), name: '🩵'.repeat(900) });
  await storage.setItem('auth:user:session', value);
  assert.equal(await storage.getItem('auth:user:session'), value);
  for (const entry of backing.values.values()) assert.ok(Buffer.byteLength(entry) < 2048);
  await storage.removeItem('auth:user:session');
  assert.equal(await storage.getItem('auth:user:session'), null);
  assert.equal(backing.values.size, 0);
});

test('a failed replacement write retains the last complete session', async () => {
  const backing = memory();
  let writes = 0;
  let fail = false;
  const storage = createChunkedStorage({ ...backing, setItem: async (key, value) => {
    if (fail && ++writes === 2) throw new Error('Device write failed');
    await backing.setItem(key, value);
  } });
  await storage.setItem('session', 'old session');
  fail = true;
  await assert.rejects(storage.setItem('session', 'new'.repeat(1000)));
  assert.equal(await storage.getItem('session'), 'old session');
  fail = false;
  await storage.setItem('session', 'replacement');
  assert.equal(await storage.getItem('session'), 'replacement');
  await storage.removeItem('session');
  assert.equal(backing.values.size, 0);
});

test('simultaneous logs remain separate by account and no queued logs are lost', async () => {
  const backing = memory();
  const legacy = memory();
  const outbox = load('src/lib/outbox.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: legacy },
    '@/lib/privateStorage': { privateStorage: createChunkedStorage(backing) }
  });
  const payload = id => ({ protocolItemId: 'item', clientEventId: id, amount: 1, unit: 'mg' });
  await Promise.all([
    outbox.enqueueQuickLog('account-a', payload('first')),
    outbox.enqueueQuickLog('account-a', payload('second')),
    outbox.enqueueQuickLog('account-b', payload('third'))
  ]);
  assert.deepEqual((await outbox.readOutbox('account-a')).map(x => x.clientEventId), ['first', 'second']);
  assert.deepEqual((await outbox.readOutbox('account-b')).map(x => x.clientEventId), ['third']);
  await outbox.clearOutbox('account-a');
  assert.deepEqual(await outbox.readOutbox('account-a'), []);
  assert.equal((await outbox.readOutbox('account-b')).length, 1);
  await legacy.setItem('pulse.quick_log_outbox.v1', JSON.stringify([payload('unknown-owner')]));
  assert.equal((await outbox.readOutbox('account-b')).length, 1);
  assert.equal(await legacy.getItem('pulse.quick_log_outbox.v1'), null);
  assert.ok(await createChunkedStorage(backing).getItem('pulse.quick_log_outbox.unassigned'));
});
