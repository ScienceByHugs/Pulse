const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');
const { colors } = loader()('src/theme.ts');
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const contrast = (a, b) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
test('standard body, helper, status and button colors maintain readable contrast', () => {
  for (const bg of [colors.bg, colors.panel, colors.panel2])
    for (const fg of [
      colors.text,
      colors.muted,
      colors.success,
      colors.warning,
    ])
      assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg}`);
  assert.ok(contrast(colors.accent, colors.accentSoft) >= 4.5);
  assert.ok(contrast(colors.bg, colors.accent) >= 4.5);
});
