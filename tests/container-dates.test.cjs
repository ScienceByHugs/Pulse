const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { loader } = require('./helpers.cjs');

for (const [zone, expectedEnd] of [
  ['America/Los_Angeles', '2026-10-14T06:59:59.999Z'],
  ['America/New_York', '2026-10-14T03:59:59.999Z'],
  ['Pacific/Auckland', '2026-10-13T10:59:59.999Z'],
]) {
  test(`container dates survive editing and saving in ${zone}`, () => {
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `
        const assert = require('node:assert/strict');
        const { loader } = require('./tests/helpers.cjs');
        const { containerDateKey, containerDateTimestamp } = loader()('src/domain/containerDates.ts');
        assert.equal(containerDateTimestamp('2026-10-13', 'end'), ${JSON.stringify(expectedEnd)});
        for (const key of ['2026-10-13', '2026-03-08', '2026-11-01']) {
          for (const boundary of ['start', 'end']) {
            const original = containerDateTimestamp(key, boundary);
            assert.equal(containerDateKey(original), key);
            let saved = original;
            for (let retry = 0; retry < 3; retry++) {
              saved = containerDateTimestamp(containerDateKey(saved), boundary, saved);
              assert.equal(saved, original);
            }
            const instant = new Date(original);
            assert.equal(instant.getHours(), boundary === 'start' ? 0 : 23);
            assert.equal(instant.getMilliseconds(), boundary === 'start' ? 0 : 999);
          }
        }
        // Merely viewing the same record after travelling must not move its cutoff.
        const original = containerDateTimestamp('2026-10-13', 'end');
        process.env.TZ = 'UTC';
        assert.equal(containerDateTimestamp(containerDateKey(original), 'end', original), original);
        `,
      ],
      { env: { ...process.env, TZ: zone }, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
  });
}

test('container date changes preserve old instants only when the selected date is unchanged', () => {
  const { containerDateKey, containerDateTimestamp } = loader()(
    'src/domain/containerDates.ts',
  );
  const existing = '2026-10-13T14:05:06.123Z';
  assert.equal(
    containerDateTimestamp(containerDateKey(existing), 'end', existing),
    existing,
  );
  assert.equal(
    containerDateKey(containerDateTimestamp('2026-10-15', 'end', existing)),
    '2026-10-15',
  );
  assert.equal(containerDateTimestamp('', 'end', existing), null);
  assert.equal(containerDateKey(null), '');
  assert.equal(containerDateKey('invalid'), '');
  assert.throws(() => containerDateTimestamp('2026-02-30', 'end'), /real/);
  assert.throws(() => containerDateTimestamp('10/13/2026', 'end'), /valid/);
});
