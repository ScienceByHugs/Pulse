const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');
const { createAuthLinkConsumer, isAuthUrl, AUTH_LINK_ERROR } = loader()('src/lib/authLinks.ts');
const session = { user: { id: 'fixture', email_confirmed_at: '2026-01-01' } };
const ok = () => Promise.resolve({ data: { session }, error: null });
const client = (overrides = {}) => ({ verifyOtp: ok, exchangeCodeForSession: ok, setSession: ok, ...overrides });

test('native implicit recovery parses fragment tokens without a browser URL implementation', async () => {
  const original = global.URLSearchParams;
  global.URLSearchParams = class { constructor() { throw new Error('native implementation unavailable'); } };
  try {
    let received;
    const consume = createAuthLinkConsumer(client({ setSession: async args => {
      received = args;
      return ok();
    } }));
    assert.equal(await consume('pulse://auth/reset-password#access_token=fixture%2Baccess%3D%3D&refresh_token=fixture%2Frefresh&type=recovery'), session);
    assert.deepEqual(received, { access_token: 'fixture+access==', refresh_token: 'fixture/refresh' });
  } finally { global.URLSearchParams = original; }
});

test('PKCE and direct token-hash callbacks establish a session', async () => {
  let code, otp;
  const consume = createAuthLinkConsumer(client({
    exchangeCodeForSession: async value => { code = value; return ok(); },
    verifyOtp: async value => { otp = value; return ok(); },
  }));
  assert.equal(await consume('pulse:///auth/reset-password?code=fixture-code'), session);
  assert.equal(code, 'fixture-code');
  assert.equal(await consume('pulse://auth/reset-password?token_hash=fixture-hash&type=recovery'), session);
  assert.deepEqual(otp, { token_hash: 'fixture-hash', type: 'recovery' });
});

test('duplicate initial and foreground delivery shares one single-use verification', async () => {
  let finish, attempts = 0;
  const consume = createAuthLinkConsumer(client({ exchangeCodeForSession: () => {
    attempts++;
    return new Promise(resolve => { finish = resolve; });
  } }));
  const url = 'pulse://auth/reset-password?code=fixture-code';
  const first = consume(url);
  assert.equal(consume(url), first);
  assert.equal(attempts, 1);
  finish({ data: { session }, error: null });
  await first;
});

test('invalid, expired, incomplete and ambiguous links fail without disclosing tokens', async () => {
  let attempts = 0;
  const consume = createAuthLinkConsumer(client({ setSession: async () => { attempts++; return ok(); } }));
  for (const url of [
    'https://example.invalid/auth/reset-password#access_token=private&refresh_token=secret',
    'pulse://auth/reset-password',
    'pulse://auth/reset-password#access_token=private',
    'pulse://auth/reset-password#error=access_denied&error_description=private',
    'pulse://auth/reset-password#access_token=%ZZ&refresh_token=secret',
    'pulse://auth/reset-password?code=private#code=other',
  ]) await assert.rejects(consume(url), { message: AUTH_LINK_ERROR });
  assert.equal(attempts, 0);
  for (const response of [
    { data: { session: null }, error: null },
    { data: { session }, error: new Error('private-token') },
  ]) {
    const failed = createAuthLinkConsumer(client({ exchangeCodeForSession: async () => response }));
    await assert.rejects(failed('pulse://auth/reset-password?code=private'), { message: AUTH_LINK_ERROR });
  }
});

test('only the intended native callback routes are accepted', () => {
  assert.ok(isAuthUrl('pulse://auth/callback#access_token=fixture'));
  assert.ok(isAuthUrl('pulse:///auth/reset-password/?code=fixture'));
  assert.equal(isAuthUrl('pulse://auth/reset-password-elsewhere?code=fixture'), false);
  assert.equal(isAuthUrl('pulse://untrusted/auth/reset-password?code=fixture'), false);
});
