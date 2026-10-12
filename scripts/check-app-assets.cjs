const fs = require('node:fs');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { expo } = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const filename = expo.ios?.icon ?? expo.icon;
assert.equal(typeof filename, 'string', 'An iOS icon path is required');
const bytes = fs.readFileSync(filename);
assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Icon must be PNG');
assert.equal(bytes.readUInt32BE(16), 1024, 'Icon width must be 1024');
assert.equal(bytes.readUInt32BE(20), 1024, 'Icon height must be 1024');
assert.equal(bytes[24], 8, 'Expected 8-bit icon');
assert.equal(bytes[25], 2, 'iOS icon must be RGB without alpha');
const chunks = [];
let ended = false;
for (let offset = 8; offset < bytes.length;) {
  const length = bytes.readUInt32BE(offset);
  const kind = bytes.toString('ascii', offset + 4, offset + 8);
  assert.ok(offset + 12 + length <= bytes.length, 'Truncated PNG');
  if (kind === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
  if (kind === 'IEND') { ended = true; break; }
  offset += length + 12;
}
assert.ok(ended, 'PNG must contain IEND');
assert.equal(inflateSync(Buffer.concat(chunks)).length, 1024 * (1 + 1024 * 3), 'Icon pixel data must decode');
for (const asset of [expo.android?.adaptiveIcon?.foregroundImage]) if (asset) assert.ok(fs.existsSync(asset), `Missing asset: ${asset}`);
console.log(`Validated configured iOS icon: ${filename} (1024x1024 RGB PNG)`);
