const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');

function harness(options = {}) {
  const owner = 'owner-a';
  const events = [];
  const queries = [];
  const shares = [];
  const user = {
    id: owner,
    user_metadata: { eligibility_confirmation: { age18Plus: true } },
  };
  let authCalls = 0;
  const tableRows = {
    profiles: [{ user_id: owner }],
    protocol_items: [
      { id: 'item-1', user_id: owner },
      { id: 'item-2', user_id: owner },
    ],
    ...options.rows,
  };
  async function cleanup(step) {
    events.push(step);
    if (options.fail?.includes(step)) throw new Error(`Failed ${step}`);
  }
  const supabase = {
    auth: {
      async getUser() {
        authCalls++;
        return {
          data: {
            user:
              authCalls > 1 && options.accountChanged
                ? { id: 'owner-b' }
                : user,
          },
          error: null,
        };
      },
      async getSession() {
        return {
          data: {
            session: options.noSession
              ? null
              : { user, access_token: 'test-token-a' },
          },
          error: options.sessionError ?? null,
        };
      },
      async signOut(value) {
        events.push('sign out');
        assert.deepEqual(value, { scope: 'local' });
        if (options.signOutThrows) throw new Error('Could not sign out');
        return { error: options.signOutError ?? null };
      },
    },
    functions: {
      async invoke(name, value) {
        events.push('delete server account');
        assert.equal(name, 'delete-account');
        assert.deepEqual(value, {
          method: 'POST',
          body: {},
          headers: { Authorization: 'Bearer test-token-a' },
        });
        return options.serverResult ?? { data: { deleted: true }, error: null };
      },
    },
    from(table) {
      const request = {
        table,
        filters: [],
        order: null,
        ascending: null,
        limit: null,
      };
      queries.push(request);
      const query = {
        select(value) {
          assert.equal(value, '*');
          return this;
        },
        eq(key, value) {
          request.filters.push(['eq', key, value]);
          return this;
        },
        gt(key, value) {
          request.filters.push(['gt', key, value]);
          return this;
        },
        order(key, { ascending }) {
          request.order = key;
          request.ascending = ascending;
          return this;
        },
        limit(value) {
          request.limit = value;
          return this;
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(() => {
              if (options.beforeQuery) options.beforeQuery(request, tableRows);
              if (options.readError)
                return { data: null, error: options.readError };
              let data = [...(tableRows[table] ?? [])];
              if (!options.ignoreOwnershipFilter) {
                data = data.filter((row) =>
                  request.filters.every(([type, key, value]) =>
                    type === 'eq' ? row[key] === value : row[key] > value,
                  ),
                );
              }
              data.sort((a, b) =>
                String(a[request.order]).localeCompare(
                  String(b[request.order]),
                ),
              );
              return { data: data.slice(0, request.limit), error: null };
            })
            .then(resolve, reject);
        },
      };
      return query;
    },
  };
  const api = loader({
    '@/lib/supabase': { supabase },
    '@/lib/creationRequests': {
      clearCreations: (id) => {
        assert.equal(id, owner);
        return cleanup('pending creations');
      },
      pendingCreations: async (id) => {
        assert.equal(id, owner);
        return [{ id: 'pending-a' }];
      },
    },
    '@/lib/outbox': {
      clearOutbox: (id) => {
        assert.equal(id, owner);
        return cleanup('pending logs');
      },
    },
    '@/lib/privateStorage': {
      privateStorage: {
        getItem: async (key) => {
          assert.equal(key, `pulse.feedback-draft.${owner}`);
          return options.feedbackDraft ?? null;
        },
        removeItem: (key) => {
          if (key === `pulse.feedback-draft.${owner}`)
            return cleanup('feedback draft');
          assert.equal(key, `pulse.today-cache.${owner}`);
          return cleanup('Today cache');
        },
      },
    },
    '@/services/substancePhoto': {
      getSubstancePhoto: async (id, item) => {
        assert.equal(id, owner);
        return `photo-${item}`;
      },
      removeSubstancePhoto: (id, item) => {
        assert.equal(id, owner);
        return cleanup(`photo ${item}`);
      },
    },
    '@/services/profilePhoto': {
      exportProfilePhoto: async (id) => {
        assert.equal(id, owner);
        return 'profile photo';
      },
    },
    'react-native': {
      Share: {
        share: async (value) => {
          shares.push(value);
        },
      },
    },
  })('src/services/account.ts');
  return { api, events, queries, shares, owner };
}

test('confirmed deletion attempts all independent device cleanup and sign-out despite photo or storage failure', async () => {
  const h = harness({ fail: ['photo item-1', 'pending logs', 'Today cache'] });
  await assert.rejects(h.api.deletePulseAccount(), (error) => {
    assert.ok(error instanceof h.api.AccountDeviceCleanupError);
    assert.equal(error.accountDeleted, true);
    assert.match(error.message, /account was deleted/);
    assert.equal(error.failures.length, 3);
    return true;
  });
  assert.equal(h.events[0], 'delete server account');
  assert.equal(h.events.at(-1), 'sign out');
  assert.deepEqual(
    new Set(h.events.slice(1, -1)),
    new Set([
      'photo item-1',
      'photo item-2',
      'pending logs',
      'pending creations',
      'feedback draft',
      'Today cache',
    ]),
  );
});

test('returned and thrown local sign-out errors are reported as confirmed deletion with incomplete device cleanup', async () => {
  for (const options of [
    { signOutError: { message: 'Storage failed' } },
    { signOutThrows: true },
  ]) {
    const h = harness(options);
    await assert.rejects(h.api.deletePulseAccount(), (error) => {
      assert.equal(error.accountDeleted, true);
      assert.deepEqual(
        error.failures.map((failure) => failure.step),
        ['sign out'],
      );
      return true;
    });
    assert.equal(h.events.at(-1), 'sign out');
  }
});

test('successful deletion clears only the captured owner and resolves after local sign-out', async () => {
  const h = harness();
  assert.equal(await h.api.deletePulseAccount(), undefined);
  assert.equal(h.events[0], 'delete server account');
  assert.equal(h.events.at(-1), 'sign out');
});

test('server rejection or unconfirmed deletion preserves local records and the session', async () => {
  for (const serverResult of [
    { error: new Error('Offline') },
    { data: { deleted: false }, error: null },
  ]) {
    const h = harness({ serverResult });
    await assert.rejects(h.api.deletePulseAccount());
    assert.deepEqual(h.events, ['delete server account']);
  }
});

test('a missing session or failed owner read stops before requesting deletion', async () => {
  for (const options of [
    { noSession: true },
    { sessionError: new Error('Read failed') },
    { readError: new Error('Read failed') },
  ]) {
    const h = harness(options);
    await assert.rejects(h.api.deletePulseAccount());
    assert.deepEqual(h.events, []);
  }
});

test('export pages by each owner unique key, keeps every remaining row when earlier rows disappear, and excludes other owners', async () => {
  const owner = 'owner-a';
  const protocols = Array.from({ length: 501 }, (_, i) => ({
    id: `protocol-${String(i).padStart(4, '0')}`,
    user_id: owner,
  }));
  protocols.push({ id: 'protocol-other', user_id: 'owner-b' });
  const h = harness({
    rows: { protocols },
    beforeQuery(request, rows) {
      if (
        request.table === 'protocols' &&
        request.filters.some(([type]) => type === 'gt')
      )
        rows.protocols = rows.protocols.filter(
          (row) => row.id !== 'protocol-0000',
        );
    },
  });
  const payload = await h.api.exportPulseData();
  assert.equal(payload.protocols.length, 501);
  assert.equal(new Set(payload.protocols.map((row) => row.id)).size, 501);
  assert.equal(payload.protocols.at(-1).id, 'protocol-0500');
  for (const query of h.queries) {
    assert.ok(
      query.filters.some(
        ([type, key, value]) =>
          type === 'eq' && key === 'user_id' && value === owner,
      ),
    );
    assert.equal(query.ascending, true);
    assert.equal(query.limit, 500);
  }
  const secondProtocolsPage = h.queries.filter(
    (query) => query.table === 'protocols',
  )[1];
  assert.ok(
    secondProtocolsPage.filters.some(
      ([type, key, value]) =>
        type === 'gt' && key === 'id' && value === 'protocol-0499',
    ),
  );
  assert.equal(h.shares.length, 1);
  assert.deepEqual(JSON.parse(h.shares[0].message), payload);
});

test('an account change during export stops before the share sheet opens', async () => {
  const h = harness({ accountChanged: true });
  await assert.rejects(h.api.exportPulseData(), /account changed/);
  assert.equal(h.shares.length, 0);
});

test('export rejects unexpected unowned rows rather than sharing them', async () => {
  const h = harness({
    ignoreOwnershipFilter: true,
    rows: { protocols: [{ id: 'foreign', user_id: 'owner-b' }] },
  });
  await assert.rejects(h.api.exportPulseData(), /verify the owner/);
  assert.equal(h.shares.length, 0);
});

test('feedback is exported only for the captured owner and feedback-draft cleanup failure does not prevent sign-out', async () => {
  const owner = 'owner-a';
  const h = harness({
    feedbackDraft: 'original private feedback',
    rows: {
      feedback_submissions: [
        { id: 'own-ticket', user_id: owner, message: 'My idea' },
        { id: 'foreign-ticket', user_id: 'owner-b', message: 'Other idea' },
      ],
    },
  });
  const payload = await h.api.exportPulseData();
  assert.equal(payload.feedback_submissions.length, 1);
  assert.equal(payload.feedback_submissions[0].id, 'own-ticket');
  assert.equal(payload.pending_feedback_draft, 'original private feedback');
  const failure = harness({ fail: ['feedback draft'] });
  await assert.rejects(failure.api.deletePulseAccount(), (error) => {
    assert.deepEqual(
      error.failures.map((f) => f.step),
      ['feedback draft'],
    );
    return true;
  });
  assert.equal(failure.events.at(-1), 'sign out');
});
