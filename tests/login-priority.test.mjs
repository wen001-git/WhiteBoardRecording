import assert from 'node:assert/strict';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1]
  .replace(/\s*checkSession\(\);\s*$/, '');

function response(status, data = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; },
    async text() { return String(data); },
  };
}

function staticAccounts({ password = 'local-password', enabled = true } = {}) {
  const salt = 'test-salt';
  return {
    salt,
    accounts: [{
      u: 'local-user',
      plan: 'pro',
      enabled,
      h: createHash('sha256').update(`${salt}:local-user:${password}`).digest('hex'),
    }],
  };
}

function runtime(fetchImpl, initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      id,
      textContent: '',
      value: '',
      disabled: false,
      noValidate: false,
      classList: { add() {}, toggle() {} },
      addEventListener() {},
      focus() {},
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    Uint8Array,
    Date,
    JSON,
    navigator: { platform: 'Test' },
    location: { hostname: 'localhost', protocol: 'http:', search: '', href: '' },
    crypto: { subtle: webcrypto.subtle, randomUUID },
    fetch: fetchImpl,
    localStorage: {
      getItem(key) { return store.get(key) ?? null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); },
    },
    document: {
      getElementById: element,
      open() {},
      write() {},
      close() {},
    },
  });
  vm.runInContext(`${inlineScript}\n;globalThis.__auth={loginPro,checkSession,getActive:()=>activeSessionSource};`, context);
  return { auth: context.__auth, store, elements };
}

test('valid static credentials log in without calling the account service', async () => {
  const calls = [];
  const accounts = staticAccounts();
  const app = runtime(async url => {
    calls.push(String(url));
    if (url === './accounts.json') return response(200, accounts);
    throw new Error(`unexpected request: ${url}`);
  });

  const result = await app.auth.loginPro('LOCAL-USER', 'local-password');
  assert.equal(result.source, 'static');
  assert.deepEqual(calls, ['./accounts.json']);
  assert.equal(JSON.parse(app.store.get('wb_static_pro_session')).source, 'static');
});

test('wrong, disabled, or unavailable static credentials fall back to Neon', async t => {
  for (const scenario of [
    { name: 'wrong password', accounts: staticAccounts(), password: 'wrong' },
    { name: 'disabled account', accounts: staticAccounts({ enabled: false }), password: 'local-password' },
    { name: 'missing accounts file', accounts: null, password: 'local-password' },
  ]) {
    await t.test(scenario.name, async () => {
      const calls = [];
      const app = runtime(async (url, options = {}) => {
        calls.push(String(url));
        if (url === './accounts.json') {
          if (!scenario.accounts) throw new Error('not found');
          return response(200, scenario.accounts);
        }
        if (String(url).endsWith('/api/login')) {
          assert.equal(options.method, 'POST');
          return response(200, { ok: true, username: 'server-user', plan: 'pro' });
        }
        throw new Error(`unexpected request: ${url}`);
      });

      const result = await app.auth.loginPro('local-user', scenario.password);
      assert.equal(result.source, 'server');
      assert.equal(calls[0], './accounts.json');
      assert.match(calls[1], /\/api\/login$/);
      assert.equal(app.store.has('wb_static_pro_session'), false);
    });
  }
});

test('an existing static session is restored without waking the account service', async () => {
  const session = { username: 'cached-user', plan: 'pro', source: 'static', expiresAt: Date.now() + 60_000 };
  const app = runtime(async url => { throw new Error(`unexpected request: ${url}`); }, {
    wb_static_pro_session: JSON.stringify(session),
  });

  await app.auth.checkSession();
  assert.equal(app.auth.getActive(), 'static');
  assert.equal(app.elements.get('sessionBox').textContent, '已登录：cached-user');
});

test('backend errors do not create a static Pro session', async () => {
  const app = runtime(async url => {
    if (url === './accounts.json') return response(404);
    if (String(url).endsWith('/api/login')) return response(403, { message: '设备数量已达上限' });
    throw new Error(`unexpected request: ${url}`);
  });

  await assert.rejects(app.auth.loginPro('server-user', 'password123'), /设备数量已达上限/);
  assert.equal(app.store.has('wb_static_pro_session'), false);
});
