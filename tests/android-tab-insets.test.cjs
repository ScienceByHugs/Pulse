const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Exercise the production navigator options without a device or auth/network.
function options(platform, bottom, fontScale = 1) {
  const module = { exports: {} };
  const Tabs = () => null;
  Tabs.Screen = () => null;
  const mocks = {
    'react-native': { Platform: { OS: platform }, StyleSheet: { create: x => x }, useWindowDimensions: () => ({ fontScale }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom }) },
    '@expo/ui': { Icon: { select: x => x[platform] } },
    'expo-router': { Tabs },
    '@/providers/AuthProvider': { useAuth: () => ({ session: {}, loading: false }) },
    '@/theme': { colors: {} },
  };
  const code = ts.transpileModule(fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name];
    if (name.endsWith('.xml')) return name;
    return require(name);
  }, module, module.exports);
  const navigator = module.exports.default();
  assert.equal(navigator.props.children.length, 5);
  return navigator.props.screenOptions({ route: { name: 'index' } });
}

for (const bottom of [0, 24, 48]) {
  for (const fontScale of [1, 1.5, 2]) {
    test(`Android inset ${bottom}, font scale ${fontScale}: reserve system bar once`, () => {
      const result = options('android', bottom, fontScale);
      const style = result.tabBarStyle;
      assert.equal(style.height, 88 + (fontScale - 1) * 24 + bottom);
      assert.equal(style.paddingBottom, 12 + bottom);
      assert.equal(style.height - style.paddingTop - style.paddingBottom, 69 + (fontScale - 1) * 24);
      assert.equal(result.tabBarHideOnKeyboard, true);
    });
  }
}
for (const platform of ['ios', 'web']) {
  test(`${platform}: existing layout stays unchanged`, () => {
    const style = options(platform, 34).tabBarStyle;
    assert.equal(style.height, 88);
    assert.equal(style.paddingBottom, 12);
  });
}
