const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loader } = require('./helpers.cjs');
function harness() {
  const values = new Map();
  let fail = false;
  const storage = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      if (fail) throw Error('Storage unavailable');
      values.set(k, v);
    },
    removeItem: async (k) => values.delete(k),
  };
  const lib = loader({
    'expo-crypto': { randomUUID },
    '@/lib/privateStorage': { privateStorage: storage },
  })('src/lib/creationRequests.ts');
  return { lib, values, fail: () => (fail = true) };
}
test('uncertain creation retries reuse IDs across reloads and partial parent/container completion', async () => {
  const h = harness();
  const parents = new Set(),
    containers = new Set();
  let first = true;
  let id, container;
  async function work(r) {
    id = r.id;
    container = r.containerId;
    parents.add(r.id);
    if (first) {
      first = false;
      throw Error('Network request failed');
    }
    containers.add(r.containerId);
    return r.id;
  }
  await assert.rejects(
    h.lib.withCreation(
      'owner',
      'substance',
      { name: 'Demo', schedule: { type: 'daily' } },
      work,
    ),
  );
  const before = id,
    child = container;
  const fresh = loader({
    'expo-crypto': { randomUUID },
    '@/lib/privateStorage': {
      privateStorage: {
        getItem: async (k) => h.values.get(k) ?? null,
        setItem: async (k, v) => h.values.set(k, v),
        removeItem: async (k) => h.values.delete(k),
      },
    },
  })('src/lib/creationRequests.ts');
  assert.equal(
    await fresh.withCreation(
      'owner',
      'substance',
      { schedule: { type: 'daily' }, name: 'Demo' },
      work,
    ),
    before,
  );
  assert.equal(container, child);
  assert.equal(parents.size, 1);
  assert.equal(containers.size, 1);
  assert.equal((await fresh.pendingCreations('owner')).length, 0);
  assert.notEqual(
    await fresh.withCreation(
      'owner',
      'substance',
      { name: 'Demo', schedule: { type: 'daily' } },
      (r) => r.id,
    ),
    before,
  );
});
test('simultaneous identical creates share one request and account identifiers stay separate', async () => {
  const { lib } = harness();
  let calls = 0;
  const work = async (r) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return r.id;
  };
  const [a, b] = await Promise.all([
    lib.withCreation('a', 'protocol', { name: 'Demo' }, work),
    lib.withCreation('a', 'protocol', { name: 'Demo' }, work),
  ]);
  assert.equal(a, b);
  assert.equal(calls, 1);
  assert.notEqual(
    await lib.withCreation('b', 'protocol', { name: 'Demo' }, (r) => r.id),
    a,
  );
});
test('creation stops before sending anything if durable recovery storage fails', async () => {
  const h = harness();
  h.fail();
  let sent = false;
  await assert.rejects(
    h.lib.withCreation('a', 'protocol', { name: 'Demo' }, async () => {
      sent = true;
    }),
  );
  assert.equal(sent, false);
});
test('substance creation freezes original stock and date anchor across changed input, relaunch and lost responses', async () => {
  const rows = new Map(),
    storage = new Map();
  let lost = false,
    failChild = true;
  const uid = 'owner';
  function table(name) {
    if (!rows.has(name)) rows.set(name, new Map());
    return rows.get(name);
  }
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: uid } }, error: null }),
    },
    from(name) {
      const filters = [];
      let body;
      return {
        insert(value) {
          body = value;
          return this;
        },
        select() {
          return this;
        },
        eq(k, v) {
          filters.push([k, v]);
          return this;
        },
        async single() {
          const records = table(name);
          if (records.has(body.id))
            return { error: { code: '23505', message: 'duplicate id' } };
          records.set(body.id, { ...body });
          if (name === 'inventory_containers' && failChild) {
            failChild = false;
            lost = true;
            return {
              error: {
                message: 'Network request failed after commit',
                status: 0,
              },
            };
          }
          return { data: records.get(body.id), error: null };
        },
        async maybeSingle() {
          if (lost)
            return { error: { message: 'Network request failed', status: 0 } };
          return {
            data:
              [...table(name).values()].find((r) =>
                filters.every(([k, v]) => r[k] === v),
              ) ?? null,
            error: null,
          };
        },
      };
    },
  };
  const mocks = {
    'expo-crypto': { randomUUID },
    '@/lib/supabase': { supabase },
    '@/lib/outbox': {},
    '@/lib/privateStorage': {
      privateStorage: {
        getItem: async (k) => storage.get(k) ?? null,
        setItem: async (k, v) => storage.set(k, v),
        removeItem: async (k) => storage.delete(k),
      },
    },
  };
  const api = loader(mocks)('src/services/pulse.ts');
  const input = {
    protocolId: 'protocol',
    name: 'Fictional',
    route: 'other',
    doseAmount: 2,
    doseUnit: 'mg',
    schedule: {
      type: 'interval',
      everyDays: 2,
      startDate: '2026-10-12',
      time: '09:00',
    },
    inventoryAmount: 20,
  };
  await assert.rejects(
    api.createProtocolItem({ ...input, doseUnit: 'x'.repeat(31) }),
    /valid unit/,
  );
  await assert.rejects(
    api.createProtocolItem({ ...input, route: 'invalid' }),
    /administration type/,
  );
  assert.equal(
    storage.size,
    0,
    'Rejected input must not leave a recovery lock',
  );
  assert.equal(rows.size, 0, 'Rejected input must not send an insert');
  await assert.rejects(api.createProtocolItem(input));
  assert.equal(table('protocol_items').size, 1);
  assert.equal(table('inventory_containers').size, 1);
  const stock = [...table('inventory_containers').values()][0];
  stock.remaining_amount = 18;
  await assert.rejects(
    api.createProtocolItem({
      ...input,
      inventoryAmount: 21,
      schedule: { ...input.schedule, startDate: '2026-10-13' },
    }),
    /resume its original details/,
  );
  assert.equal(
    table('protocol_items').size,
    1,
    'Changed details must not create a second parent',
  );
  assert.equal(table('inventory_containers').size, 1);
  lost = false;
  const relaunched = loader(mocks)('src/services/pulse.ts');
  const original = await relaunched.pendingProtocolItemCreation();
  assert.equal(original.inventoryAmount, 20);
  assert.equal(original.schedule.startDate, '2026-10-12');
  await relaunched.createProtocolItem(original);
  assert.equal(table('protocol_items').size, 1);
  assert.equal(table('inventory_containers').size, 1);
  assert.equal(stock.remaining_amount, 18);
  assert.equal(await relaunched.pendingProtocolItemCreation(), null);
});
