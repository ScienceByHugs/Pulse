const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { loader } = require('./helpers.cjs');

const confirmed = { user: { id: 'fixture', email_confirmed_at: '2026-01-01' } };
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function mount({ initialUrl = null, exchange, user = confirmed.user } = {}) {
  const values = [], effects = [];
  let index = 0, linked, authEvent, cleanup;
  const calls = { verify: 0, getUser: 0, getSession: 0 };
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState: initial => {
      const slot = index++;
      if (!(slot in values)) values[slot] = initial;
      return [values[slot], value => { values[slot] = value; }];
    },
    useEffect: fn => { if (!cleanup) effects.push(fn); },
    useMemo: fn => fn(),
    useContext: () => {},
  };
  const auth = {
    getSession: async () => { calls.getSession++; return { data: { session: null } }; },
    getUser: async () => { calls.getUser++; return { data: { user }, error: null }; },
    exchangeCodeForSession: async () => {
      calls.verify++;
      return exchange ? exchange() : { data: { session: confirmed }, error: null };
    },
    setSession: async () => ({ data: { session: confirmed }, error: null }),
    verifyOtp: async () => ({ data: { session: confirmed }, error: null }),
    onAuthStateChange: fn => { authEvent = fn; return { data: { listener: null, subscription: { unsubscribe() {} } } }; },
    startAutoRefresh() {}, stopAutoRefresh() {}, signOut: async () => {},
  };
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx: (_type, props) => props },
    'expo-linking': {
      getInitialURL: async () => initialUrl,
      addEventListener: (_name, fn) => { linked = fn; return { remove() {} }; },
    },
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'expo-notifications': { dismissAllNotificationsAsync: async () => {} },
    '@/lib/reminders': { disableReminders: async () => {} },
    '@/lib/widgets': { updatePulseTodayWidget: async () => {} },
    '@/domain/network': { isNetworkError: () => false },
    '@/lib/supabase': { supabase: { auth } },
    '@/lib/authLinks': loader()('src/lib/authLinks.ts'),
  };
  const compiled = ts.transpileModule(fs.readFileSync('src/providers/AuthProvider.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  const render = () => { index = 0; return module.exports.AuthProvider({ children: null }).value; };
  render();
  cleanup = effects[0]();
  return { render, calls, link: url => linked({ url }), event: (event, session) => authEvent(event, session), unmount: cleanup };
}

test('cold recovery waits for the link and validates its returned session without needing an auth event', async () => {
  const verification = deferred();
  const app = mount({ initialUrl: 'pulse://auth/reset-password?code=fixture', exchange: () => verification.promise });
  await flush();
  assert.equal(app.render().loading, true);
  assert.equal(app.render().session, null);
  verification.resolve({ data: { session: confirmed }, error: null });
  await flush();
  assert.equal(app.render().session.user.id, 'fixture');
  assert.equal(app.render().loading, false);
  assert.equal(app.calls.getSession, 0);
  assert.equal(app.calls.getUser, 1);
  app.unmount();
});

test('warm recovery resumes verification after signed-out startup, including duplicate delivery', async () => {
  const verification = deferred();
  const app = mount({ exchange: () => verification.promise });
  await flush();
  assert.equal(app.render().loading, false);
  app.link('pulse://auth/reset-password?code=fixture');
  app.link('pulse://auth/reset-password?code=fixture');
  assert.equal(app.render().loading, true);
  verification.resolve({ data: { session: confirmed }, error: null });
  await flush();
  assert.equal(app.render().session.user.id, 'fixture');
  assert.equal(app.calls.verify, 1);
  assert.equal(app.render().loading, false);
  app.unmount();
});

test('failed recovery finishes loading and shows a safe error rather than swallowing it', async () => {
  const app = mount({ initialUrl: 'pulse://auth/reset-password?code=fixture', exchange: async () => { throw new Error('secret'); } });
  await flush();
  assert.equal(app.render().loading, false);
  assert.match(app.render().authLinkError, /Request a new email/);
  assert.doesNotMatch(app.render().authLinkError, /secret/);
  assert.equal(app.render().session, null);
  app.unmount();
});

test('recovery never bypasses the server confirmed-user check', async () => {
  const app = mount({ initialUrl: 'pulse://auth/reset-password?code=fixture', user: { id: 'fixture', email_confirmed_at: null } });
  await flush();
  assert.equal(app.render().loading, false);
  assert.equal(app.render().session, null);
  app.unmount();
});
