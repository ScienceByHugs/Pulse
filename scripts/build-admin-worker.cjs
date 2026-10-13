const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { build } = require('esbuild');
(async () => {
  const r = spawnSync(process.execPath, ['scripts/build-admin-web.cjs'], {
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error('Portal build did not finish.');
  const assets = Object.fromEntries(
    [
      ['index.html', 'text/html; charset=utf-8'],
      ['portal.js', 'text/javascript; charset=utf-8'],
      ['portal.css', 'text/css; charset=utf-8'],
    ].map(([file, type]) => [
      '/' + file,
      { body: fs.readFileSync(path.join('dist/admin', file), 'utf8'), type },
    ]),
  );
  const csp = fs
    .readFileSync('dist/admin/_headers', 'utf8')
    .match(/Content-Security-Policy: (.+)/)?.[1];
  if (!csp || !csp.includes("frame-ancestors 'none'"))
    throw new Error('Missing restrictive host headers.');
  const source = fs.readFileSync('admin-web/static-host.mjs', 'utf8');
  await build({
    stdin: {
      contents:
        source +
        '\nexport default createStaticHost(' +
        JSON.stringify(assets) +
        ',' +
        JSON.stringify(csp) +
        ');',
      loader: 'js',
    },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    outfile: 'dist/admin-worker/worker.mjs',
    legalComments: 'none',
  });
  console.log(
    'Built direct static hosting artifact. No server credentials, proxy or database binding.',
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
