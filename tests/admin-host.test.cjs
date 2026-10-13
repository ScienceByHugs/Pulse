const { test } = require('node:test');
const assert = require('node:assert/strict');
test('static admin host serves only fixed assets and rejects bodies, unknown paths and framing', async () => {
  const { createStaticHost } = await import('../admin-web/static-host.mjs');
  const host = createStaticHost(
    {
      '/index.html': {
        body: '<main>Sign in</main>',
        type: 'text/html; charset=utf-8',
      },
      '/portal.js': {
        body: 'export {}',
        type: 'text/javascript; charset=utf-8',
      },
    },
    "default-src 'none'; frame-ancestors 'none'",
  );
  const get = host.fetch(new Request('https://admin.example.invalid/'));
  assert.equal(get.status, 200);
  assert.equal(await get.text(), '<main>Sign in</main>');
  for (const [key, value] of [
    ['X-Frame-Options', 'DENY'],
    ['Cache-Control', 'no-store'],
    ['X-Content-Type-Options', 'nosniff'],
  ])
    assert.equal(get.headers.get(key), value);
  assert.ok(
    get.headers
      .get('Content-Security-Policy')
      .includes("frame-ancestors 'none'"),
  );
  const head = host.fetch(
    new Request('https://admin.example.invalid/portal.js', { method: 'HEAD' }),
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  for (const url of [
    '/legal/privacy.html',
    '/.env.local',
    '/pulse_admin_overview',
    '/__proto__',
    '/constructor',
    '/unknown',
  ])
    assert.equal(
      host.fetch(new Request('https://admin.example.invalid' + url)).status,
      404,
    );
  const post = host.fetch(
    new Request('https://admin.example.invalid/', {
      method: 'POST',
      body: 'credentials must never be handled here',
    }),
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
});
