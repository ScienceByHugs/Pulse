// Isolated browser layout fixture. Never deploy output/admin-preview.
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
(async () => {
  const out = 'output/admin-preview';
  fs.mkdirSync(out, { recursive: true });
  await build({
    entryPoints: ['admin-web/portal.tsx'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: out + '/portal.js',
    plugins: [
      {
        name: 'local-layout-fixture',
        setup(b) {
          b.onResolve({ filter: /^\.\/api$/ }, (a) =>
            a.importer.endsWith('/admin-web/portal.tsx')
              ? { path: path.resolve('tests/fixtures/admin-preview-api.ts') }
              : undefined,
          );
        },
      },
    ],
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  fs.writeFileSync(
    out + '/index.html',
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse Admin · Local fictional preview</title><link rel="stylesheet" href="./portal.css"></head><body><p style="padding:12px;text-align:center;background:#193f55;color:white">LOCAL PREVIEW · FICTIONAL DATA · NO BACKEND CONNECTION</p><div id="root"></div><script type="module" src="./portal.js"></script></body></html>',
  );
  console.log(
    'Built fictional local preview in ' +
      out +
      '. Never deploy this directory.',
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
