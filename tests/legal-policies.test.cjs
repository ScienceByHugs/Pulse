const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const policies = require('../src/content/legal.json');
const meta = require('../src/content/legal-meta.json');

// Check publication contracts: source parity, public accessibility and deletion
// links. These do not claim provider operations or store approval were tested.
test('effective policy sources and generated index/documents remain synchronized', () => {
  const check = spawnSync('python3', ['scripts/generate-legal-pages.py', '--check'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(policies.length, 6);
  assert.equal(new Set(policies.map(p => p.slug)).size, 6);
  assert.equal(meta.status, 'effective');
  assert.match(meta.effectiveDate, /^\d{4}-\d{2}-\d{2}$/);
  for (const p of policies) {
    const body = fs.readFileSync(`public/legal/${p.slug}.html`, 'utf8');
    assert.match(body, /Effective October 20, 2026/);
    assert.doesNotMatch(body, /Draft|not yet effective|pending publication|to be set on publication/i);
    assert.ok(body.includes(p.title.replaceAll('&', '&amp;')));
    assert.match(body, /legal@sciencebyhugs.com/);
    assert.match(body, /support@sciencebyhugs.com/);
    for (const match of body.matchAll(/href="([^"#]+)"/g)) {
      if (match[1].startsWith('mailto:')) continue;
      assert.ok(fs.existsSync(path.join('public/legal', match[1])), `Broken policy link ${match[1]}`);
    }
    assert.doesNotMatch(body, /<script|<form|<iframe|<img|<link\s/i);
  }
  const index = fs.readFileSync('public/legal/index.html', 'utf8');
  assert.match(index, /health-privacy.html/);
  assert.match(index, /delete-account.html/);
});

test('policy host publishes exactly public policy pages and rejects data submission', async () => {
  const build = spawnSync(process.execPath, ['scripts/build-legal-worker.cjs'], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const { default: host } = await import(pathToFileURL(path.resolve('dist/legal-worker/worker.mjs')).href);
  const names = ['index', ...policies.map(p => p.slug)];
  for (const name of names) {
    const res = host.fetch(new Request(`${meta.publicBaseUrl}/${name}.html?private-input=ignored`));
    assert.equal(res.status, 200);
    assert.equal(await res.text(), fs.readFileSync(`public/legal/${name}.html`, 'utf8'));
    assert.match(res.headers.get('Content-Security-Policy'), /default-src 'none'/);
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(res.headers.get('Referrer-Policy'), 'no-referrer');
    assert.equal(res.headers.get('Set-Cookie'), null);
    const head = host.fetch(new Request(`${meta.publicBaseUrl}/${name}.html`, { method: 'HEAD' }));
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  }
  const root = host.fetch(new Request(meta.publicBaseUrl));
  assert.equal(root.status, 200);
  for (const pathname of ['/portal.js', '/.env.local', '/src/content/legal.json', '/reviewer-access.txt', '/api', '/private'])
    assert.equal(host.fetch(new Request(meta.publicBaseUrl + pathname)).status, 404);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
    assert.equal(host.fetch(new Request(meta.publicBaseUrl + '/delete-account.html', { method, body: 'private' })).status, 405);
});
