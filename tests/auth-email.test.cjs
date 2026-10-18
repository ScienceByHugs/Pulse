const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');
const { createAuthEmailGate, AuthEmailWaitError, authEmailErrorMessage } =
  loader()('src/domain/authEmail.ts');

test('rapid email attempts share a synchronous lock, even beyond the cooldown while pending', async () => {
  let now = 1000;
  const gate = createAuthEmailGate(() => now);
  let finish;
  let sent = 0;
  const first = gate.run(() => {
    sent++;
    return new Promise(resolve => { finish = resolve; });
  });
  await assert.rejects(gate.run(async () => { sent++; return { error: null }; }), AuthEmailWaitError);
  now += 120000;
  await assert.rejects(gate.run(async () => { sent++; return { error: null }; }), AuthEmailWaitError);
  assert.equal(sent, 1);
  finish({ error: null, data: { accepted: true } });
  assert.equal((await first).data.accepted, true);
  await gate.run(async () => ({ error: null }));
});

test('successful sends prevent a second action until the shared sixty-second deadline', async () => {
  let now = 0;
  const gate = createAuthEmailGate(() => now);
  await gate.run(async () => ({ error: null }));
  assert.equal(gate.remainingSeconds(), 60);
  now = 59999;
  assert.equal(gate.remainingSeconds(), 1);
  await assert.rejects(gate.run(async () => ({ error: null })), AuthEmailWaitError);
  now = 60000;
  assert.equal(gate.remainingSeconds(), 0);
  await gate.run(async () => ({ error: null }));
});

test('returned and thrown failures never cause an automatic resend or clear the wait', async () => {
  for (const throws of [false, true]) {
    let attempts = 0;
    const gate = createAuthEmailGate(() => 0);
    const error = new Error('network failed');
    await assert.rejects(gate.run(async () => {
      attempts++;
      if (throws) throw error;
      return { error };
    }), error);
    assert.equal(attempts, 1);
    assert.equal(gate.remainingSeconds(), 60);
    await assert.rejects(gate.run(async () => { attempts++; return { error: null }; }));
    assert.equal(attempts, 1);
  }
});

test('provider rate limits extend the wait for both returned and thrown plain errors', async () => {
  for (const error of [{ status: 429 }, { code: 'over_email_send_rate_limit' }, { code: 'over_request_rate_limit' }]) {
    for (const throws of [true, false]) {
      let now = 0;
      const gate = createAuthEmailGate(() => now);
      await assert.rejects(gate.run(async () => {
        if (throws) throw error;
        return { error };
      }));
      assert.equal(gate.remainingSeconds(), 300);
      now = 60000;
      await assert.rejects(gate.run(async () => ({ error: null })), AuthEmailWaitError);
      now = 300000;
      await gate.run(async () => ({ error: null }));
    }
  }
});

test('email request errors explain recovery without revealing raw provider details', () => {
  assert.match(authEmailErrorMessage({ status: 429 }), /at least five minutes/);
  assert.match(authEmailErrorMessage({ code: 'email_address_invalid' }), /Check the email address/);
  const message = authEmailErrorMessage(new Error('private@example.com token=secret'));
  assert.doesNotMatch(message, /private|token|secret/);
  assert.match(message, /Check your connection/);
  assert.match(authEmailErrorMessage(new AuthEmailWaitError()), /Please wait/);
});
