import assert from 'node:assert/strict';
import { randomUUID, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'whiteboard-pro.html'), 'utf8');
const start = html.indexOf("const STATIC_SESSION_KEY='wb_static_pro_session'");
const end = html.indexOf('/* ----------------------------- STATE', start);
assert.ok(start > 0 && end > start, 'entitlement bootstrap should be extractable');
const bootstrap = html.slice(start, end);

function classList() {
  const values = new Set();
  return {
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    contains(name) { return values.has(name); },
    toggle(name, force) {
      const next = force === undefined ? !values.has(name) : Boolean(force);
      if (next) values.add(name); else values.delete(name);
      return next;
    },
  };
}

function createRuntime() {
  const elements = new Map();
  const handlers = new Map();
  const element = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        textContent: '',
        title: '',
        hidden: false,
        disabled: false,
        src: '',
        classList: classList(),
        setAttribute() {},
        contains() { return false; },
        querySelector() { return element(`${id}-child`); },
        addEventListener(type, handler) { handlers.set(`${id}:${type}`, handler); },
      });
    }
    return elements.get(id);
  };
  const calls = [];
  const context = vm.createContext({
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    Uint8Array,
    Date,
    JSON,
    setTimeout,
    clearTimeout,
    navigator: { platform: 'Test' },
    location: { hostname: 'record.leewen.work', protocol: 'https:', search: '', reload() {} },
    crypto: { subtle: webcrypto.subtle, randomUUID },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    window: { addEventListener() {} },
    document: {
      hidden: false,
      querySelector(selector) {
        if (selector === 'meta[name="whiteboard-plan"]') return { content: 'free', dataset: {} };
        return null;
      },
      getElementById: element,
      addEventListener() {},
    },
    async fetch(url) {
      calls.push(String(url));
      if (String(url).endsWith('/api/session')) {
        return { ok: true, status: 200, async json() { return { ok: true, plan: 'pro', username: 'admin' }; } };
      }
      if (String(url) === './paywall.json') {
        return { ok: true, status: 200, async json() { return { version: 1, price: '59', wx: 'leewen2017' }; } };
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
  });
  vm.runInContext(`${bootstrap}\n;globalThis.__proState={isPro:()=>IS_PRO,serverGranted:()=>SERVER_PRO_GRANTED};`, context);
  return { context, calls, elements };
}

test('a restored Neon session promotes the existing page and updates the account button', async () => {
  const app = createRuntime();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(app.context.__proState.isPro(), true);
  assert.equal(app.context.__proState.serverGranted(), true);
  assert.equal(app.elements.get('accountBtn').textContent, 'admin');
  assert.equal(app.elements.get('accountBtn').classList.contains('pro'), true);
  assert.equal(app.elements.get('accountMenu').hidden, false);
  assert.ok(app.calls.some(url => url.endsWith('/api/session')));
  assert.equal(bootstrap.includes('document.write'), false);
});
