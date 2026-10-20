const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { build } = require('esbuild');

(async () => {
  const result = spawnSync('python3', ['scripts/generate-legal-pages.py', '--check'], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Policy source and public pages differ.');
  const policies = JSON.parse(fs.readFileSync('src/content/legal.json', 'utf8'));
  const files = ['index.html', ...policies.map(p => `${p.slug}.html`)];
  const assets = Object.fromEntries(files.map(file => ['/' + file, {
    body: fs.readFileSync(path.join('public/legal', file), 'utf8'),
    type: 'text/html; charset=utf-8',
  }]));
  const csp = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  const source = fs.readFileSync('admin-web/static-host.mjs', 'utf8');
  await build({
    stdin: { contents: source + '\nexport default createStaticHost(' + JSON.stringify(assets) + ',' + JSON.stringify(csp) + ');', loader: 'js' },
    bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022',
    outfile: 'dist/legal-worker/worker.mjs', legalComments: 'none',
  });
  console.log('Built seven public policy pages only; no credentials, backend, cookies, scripts or request-body processing.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
