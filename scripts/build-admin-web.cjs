const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
async function run() {
  const output = path.resolve(process.argv[2] || 'dist/admin');
  if (output === process.cwd())
    throw new Error('Choose a separate build output directory.');
  const env = { ...process.env };
  if (!process.env.CI && fs.existsSync('.env.local')) {
    const raw = process.loadEnvFile
      ? null
      : fs.readFileSync('.env.local', 'utf8');
    if (process.loadEnvFile) {
      process.loadEnvFile('.env.local');
      for (const k of [
        'EXPO_PUBLIC_SUPABASE_URL',
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      ])
        env[k] ??= process.env[k];
    } else
      for (const line of raw.split('\n')) {
        const match = line.match(
          /^(EXPO_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY))=(.*)$/,
        );
        if (match)
          env[match[1]] ??= match[2].trim().replace(/^['"]|['"]$/g, '');
      }
  }
  const url = env.EXPO_PUBLIC_SUPABASE_URL,
    key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || new URL(url).protocol !== 'https:')
    throw new Error(
      'Configure the HTTPS backend and publishable key before building the admin portal.',
    );
  if (!key.startsWith('sb_publishable_') && key.split('.').length !== 3)
    throw new Error(
      'Use a publishable key; server secrets must never enter the portal.',
    );
  if (key.split('.').length === 3) {
    let body;
    try {
      body = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
    } catch {
      throw new Error('Invalid publishable key.');
    }
    if (body.role !== 'anon')
      throw new Error('Server credentials must never enter the portal.');
  }
  fs.mkdirSync(output, { recursive: true });
  await build({
    entryPoints: ['admin-web/portal.tsx'],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    outfile: path.join(output, 'portal.js'),
    define: {
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(url),
      'process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key),
      'process.env.NODE_ENV': '"production"',
    },
    legalComments: 'none',
    sourcemap: false,
  });
  const csp = `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${new URL(url).origin}; base-uri 'none'; form-action 'none'; object-src 'none'`;
  fs.writeFileSync(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="robots" content="noindex,nofollow"><title>Pulse Admin · Science By Hugs</title><link rel="stylesheet" href="./portal.css"></head><body><div id="root"></div><script type="module" src="./portal.js"></script></body></html>`,
  );
  fs.writeFileSync(
    path.join(output, '_headers'),
    `/*\n  Content-Security-Policy: ${csp}; frame-ancestors 'none'\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Cache-Control: no-store\n`,
  );
  console.log(
    `Built standalone admin portal in ${output}. Only public backend configuration was bundled.`,
  );
}
run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
