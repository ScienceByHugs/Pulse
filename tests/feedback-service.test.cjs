const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loader } = require('./helpers.cjs');
function harness(options = {}) {
  const storage = new Map();
  const events = [];
  let calls = 0;
  const owner = randomUUID();
  const other = randomUUID();
  const request = {
    id: randomUUID(),
    category: 'suggestion',
    message: 'Please improve the feedback form spacing.',
    allowContact: false,
    appVersion: '2.0.0',
    buildNumber: '14',
    platform: 'ios',
  };
  const supabase = {
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              user: {
                id: options.changed ? other : owner,
                email_confirmed_at: options.unverified ? null : 'confirmed',
              },
            },
          },
          error: null,
        };
      },
      async getUser() {
        if (options.offline)
          return { data: { user: null }, error: new Error('Network failed') };
        return {
          data: {
            user: {
              id: options.changed ? other : owner,
              email_confirmed_at: options.unverified ? null : 'confirmed',
            },
          },
          error: null,
        };
      },
    },
    async rpc(name, args) {
      calls++;
      events.push({ name, args });
      if (options.rpcError)
        return { error: { message: 'Network interrupted' }, data: null };
      return { data: { id: args.p_id, status: 'received' }, error: null };
    },
  };
  const load = loader({
    '@/lib/supabase': { supabase },
    '@/lib/privateStorage': {
      privateStorage: {
        async getItem(k) {
          return storage.get(k) ?? null;
        },
        async setItem(k, v) {
          if (options.storageFails) throw new Error('Storage unavailable');
          storage.set(k, v);
        },
        async removeItem(k) {
          if (options.clearFails) throw new Error('Cannot remove');
          storage.delete(k);
        },
      },
    },
  });
  return {
    owner,
    other,
    request,
    storage,
    events,
    get calls() {
      return calls;
    },
    service: load('src/services/feedback.ts'),
    drafts: load('src/lib/feedbackDrafts.ts'),
  };
}
test('feedback binds writes to verified current owner and persists before an RPC', async () => {
  for (const opt of [
    { changed: true },
    { unverified: true },
    { storageFails: true },
  ]) {
    const h = harness(opt);
    await assert.rejects(h.service.sendFeedback(h.owner, h.request));
    assert.equal(h.calls, 0);
  }
  const h = harness();
  assert.equal(
    (await h.service.sendFeedback(h.owner, h.request)).draftCleared,
    true,
  );
  assert.equal(h.calls, 1);
  assert.equal(h.events[0].args.p_owner_id, h.owner);
  assert.equal(h.events[0].args.p_allow_contact, false);
  assert.equal(Object.keys(h.events[0].args).length, 8);
  assert.equal(h.storage.size, 0);
});
test('a lost response retains the original ticket across reloads and cannot overwrite an unresolved draft', async () => {
  const h = harness({ rpcError: true });
  await assert.rejects(
    h.service.sendFeedback(h.owner, h.request),
    /saved on this device/,
  );
  assert.deepEqual(await h.drafts.readFeedbackDraft(h.owner), h.request);
  await assert.rejects(
    h.drafts.saveFeedbackDraft(h.owner, { ...h.request, id: randomUUID() }),
    /earlier feedback send/,
  );
  await assert.rejects(
    h.drafts.saveFeedbackDraft(h.owner, {
      ...h.request,
      appVersion: 'changed',
    }),
    /unchanged/,
  );
  assert.deepEqual(await h.drafts.readFeedbackDraft(h.owner), h.request);
  assert.equal(await h.drafts.clearFeedbackDraft(h.owner, randomUUID()), false);
  assert.deepEqual(await h.drafts.readFeedbackDraft(h.owner), h.request);
  assert.equal(await h.drafts.readFeedbackDraft(h.other), null);
  await h.drafts.clearFeedbackDraft(h.owner);
  assert.equal(h.storage.size, 0);
});
test('backend-confirmed feedback stays reported as sent when local cleanup fails', async () => {
  const h = harness({ clearFails: true });
  const result = await h.service.sendFeedback(h.owner, h.request);
  assert.equal(result.id, h.request.id);
  assert.equal(result.draftCleared, false);
  assert.deepEqual(await h.drafts.readFeedbackDraft(h.owner), h.request);
});
test('feedback validation rejects malformed IDs, unsupported metadata and blank or oversized messages', async () => {
  const h = harness();
  for (const changes of [
    { id: 'bad' },
    { message: 'short' },
    { message: 'x'.repeat(2001) },
    { platform: 'unknown' },
    { allowContact: 'yes' },
    { appVersion: '' },
  ])
    await assert.rejects(
      h.service.sendFeedback(h.owner, { ...h.request, ...changes }),
    );
  assert.equal(h.calls, 0);
});

test('offline feedback retains an owner-bound retry draft before the remote user check', async () => {
  const h = harness({ offline: true });
  await assert.rejects(h.service.sendFeedback(h.owner, h.request), (error) => {
    assert.equal(error.draftSaved, true);
    return true;
  });
  assert.equal(h.calls, 0);
  assert.deepEqual(await h.drafts.readFeedbackDraft(h.owner), h.request);
});
