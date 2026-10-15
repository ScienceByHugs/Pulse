const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const jwt = (role) =>
  [
    'header',
    Buffer.from(JSON.stringify({ role })).toString('base64url'),
    'signature',
  ].join('.');
test('admin build rejects server credentials before creating an output directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-admin-build-'));
  try {
    for (const key of [
      'sb_secret_fictional',
      jwt('service_role'),
      'not-a-public-key',
    ]) {
      const out = path.join(root, 'rejected');
      const r = spawnSync(
        process.execPath,
        ['scripts/build-admin-web.cjs', out],
        {
          env: {
            ...process.env,
            CI: '1',
            EXPO_PUBLIC_SUPABASE_URL: 'https://pulse-ci.invalid',
            EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
          },
          encoding: 'utf8',
        },
      );
      assert.notEqual(r.status, 0);
      assert.equal(fs.existsSync(out), false);
      assert.equal(r.stderr.includes(key), false);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('production admin artifact contains only the real adapter and explicit public configuration', () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pulse-admin-production-'),
  );
  try {
    const r = spawnSync(
      process.execPath,
      ['scripts/build-admin-web.cjs', root],
      {
        env: {
          ...process.env,
          CI: '1',
          EXPO_PUBLIC_SUPABASE_URL: 'https://pulse-ci.invalid',
          EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
            'sb_publishable_compile_only_not_a_real_key',
          SUPABASE_SERVICE_ROLE_KEY: 'SERVER_SECRET_CANARY_DO_NOT_BUNDLE',
        },
        encoding: 'utf8',
      },
    );
    assert.equal(r.status, 0, r.stderr);
    const files = fs.readdirSync(root).sort();
    assert.deepEqual(files, [
      '_headers',
      'index.html',
      'portal.css',
      'portal.js',
    ]);
    const bundle = fs.readFileSync(path.join(root, 'portal.js'), 'utf8');
    assert.ok(bundle.includes('pulse-ci.invalid'));
    assert.ok(bundle.includes('sb_publishable_compile_only_not_a_real_key'));
    for (const blocked of [
      'SERVER_SECRET_CANARY_DO_NOT_BUNDLE',
      'LOCAL-FICTIONAL-PREVIEW',
      'fictional@example.invalid',
    ])
      assert.equal(bundle.includes(blocked), false);
    assert.ok(
      fs
        .readFileSync(path.join(root, '_headers'), 'utf8')
        .includes("frame-ancestors 'none'"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
