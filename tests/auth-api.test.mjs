import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { makePassword, normalizeUsername, SHARED_PASSWORD_SALT } from '../server/auth.mjs';
import { createApp } from '../server/app.mjs';
import { PRO_PLAN_GRANTED, PRO_PLAN_PLACEHOLDER } from '../server/pro-app.mjs';

class MemoryStore {
  constructor() {
    this.accounts = [];
    this.nextId = 1;
  }

  async healthCheck() { return true; }
  async getAccountByUsername(username) { return this.accounts.find(account => account.usernameNormalized === normalizeUsername(username)) || null; }
  async getAccountById(id) { return this.accounts.find(account => account.id === Number(id)) || null; }

  async createAccount({ username, password, maxDevices = 3 }) {
    if (await this.getAccountByUsername(username)) throw Object.assign(new Error('duplicate'), { code: '23505' });
    const credentials = await makePassword(password);
    const account = {
      id: this.nextId++,
      username: String(username).trim(),
      usernameNormalized: normalizeUsername(username),
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      enabled: true,
      maxDevices,
      sessionVersion: 1,
      devices: [],
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };
    this.accounts.push(account);
    return account;
  }

  async bindDevice(id, device) {
    const account = await this.getAccountById(id);
    if (!account || !account.enabled) return { ok: false, reason: 'ACCOUNT_DISABLED' };
    const existing = account.devices.find(item => item.deviceId === device.deviceId);
    if (existing) {
      existing.deviceName = device.deviceName;
      existing.userAgent = device.userAgent;
      existing.lastSeenAt = new Date().toISOString();
      return { ok: true, bound: false, maxDevices: account.maxDevices };
    }
    if (account.devices.length >= account.maxDevices) return { ok: false, reason: 'DEVICE_LIMIT', count: account.devices.length, maxDevices: account.maxDevices };
    account.devices.push({ id: account.devices.length + 1, ...device, firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() });
    return { ok: true, bound: true, count: account.devices.length, maxDevices: account.maxDevices };
  }

  async touchLogin(id) { const account = await this.getAccountById(id); account.lastLoginAt = new Date().toISOString(); }
  async validateSession(id, deviceId, version) {
    const account = await this.getAccountById(id);
    if (!account || !account.enabled || account.sessionVersion !== Number(version)) return null;
    return account.devices.some(device => device.deviceId === deviceId) ? account : null;
  }
  async listAccounts() { return this.accounts; }
  async updateAccount(id, patch) {
    const account = await this.getAccountById(id);
    if (!account) return null;
    if (typeof patch.enabled === 'boolean') {
      if (patch.enabled === false) account.sessionVersion += 1;
      account.enabled = patch.enabled;
    }
    if (patch.maxDevices != null) account.maxDevices = patch.maxDevices;
    return account;
  }
  async resetPassword(id, password) {
    const account = await this.getAccountById(id);
    if (!account) return null;
    const credentials = await makePassword(password);
    account.passwordHash = credentials.hash;
    account.passwordSalt = credentials.salt;
    account.sessionVersion += 1;
    return account;
  }
  async resetDevices(id) {
    const account = await this.getAccountById(id);
    const count = account.devices.length;
    account.devices = [];
    account.sessionVersion += 1;
    return count;
  }
}

const adminToken = 'test-admin-token-with-enough-entropy';
const allowedOrigin = 'https://record.example.test';
const store = new MemoryStore();
let server;
let base;

async function request(path, { method = 'GET', body, cookie, admin = false, origin = allowedOrigin } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      origin,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(admin ? { authorization: `Bearer ${adminToken}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { response, data, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}

before(async () => {
  const handler = createApp({
    store,
    authSecret: 'test-auth-secret-not-for-production',
    adminToken,
    allowedOrigins: `${allowedOrigin},null`,
    cookieSecure: false,
    sessionDays: 30,
    loadProtectedApp: async () => `<!doctype html><head>${PRO_PLAN_PLACEHOLDER}<title>Protected WhiteBoard</title></head>`
  });
  server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
});

test('backend password hashes use the shared static-account salt', async () => {
  const first = await makePassword('same-password');
  const second = await makePassword('same-password');
  assert.equal(first.salt, SHARED_PASSWORD_SALT);
  assert.equal(second.salt, SHARED_PASSWORD_SALT);
  assert.equal(first.hash, second.hash);
});

test('health and CORS policy', async () => {
  const health = await request('/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.data.ok, true);
  const fileOrigin = await request('/health', { origin: 'null' });
  assert.equal(fileOrigin.response.status, 200);
  assert.equal(fileOrigin.response.headers.get('access-control-allow-origin'), 'null');
  const denied = await request('/api/session', { origin: 'https://evil.example' });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.data.code, 'ORIGIN_DENIED');
});

test('admin creates default three-device and one-device test accounts', async () => {
  const normal = await request('/api/admin/accounts', { method: 'POST', admin: true, body: { username: 'creator', password: 'creator-pass-123' } });
  assert.equal(normal.response.status, 201);
  assert.equal(normal.data.account.maxDevices, 3);
  const trial = await request('/api/admin/accounts', { method: 'POST', admin: true, body: { username: 'tester', password: 'tester-pass-123', maxDevices: 1 } });
  assert.equal(trial.response.status, 201);
  assert.equal(trial.data.account.maxDevices, 1);
  const unauthorized = await request('/api/admin/accounts');
  assert.equal(unauthorized.response.status, 401);
});

test('admin accepts four-character passwords and rejects shorter passwords', async () => {
  const accepted = await request('/api/admin/accounts', { method: 'POST', admin: true, body: { username: 'four-char-user', password: 'a1B!' } });
  assert.equal(accepted.response.status, 201);
  const login = await request('/api/login', {
    method: 'POST',
    body: { username: 'four-char-user', password: 'a1B!', deviceId: 'four-char-device-0001' }
  });
  assert.equal(login.response.status, 200);

  const rejected = await request('/api/admin/accounts', { method: 'POST', admin: true, body: { username: 'short-user', password: 'a1!' } });
  assert.equal(rejected.response.status, 400);
  assert.match(rejected.data.message, /至少 4 位/);
});

test('login binds devices and rejects the fourth device', async () => {
  let lastCookie = '';
  for (let index = 1; index <= 3; index += 1) {
    const login = await request('/api/login', {
      method: 'POST',
      body: { username: 'creator', password: 'creator-pass-123', deviceId: `creator-device-${String(index).padStart(3, '0')}`, deviceName: `Device ${index}` }
    });
    assert.equal(login.response.status, 200);
    lastCookie = login.cookie;
  }
  const fourth = await request('/api/login', {
    method: 'POST',
    body: { username: 'creator', password: 'creator-pass-123', deviceId: 'creator-device-004', deviceName: 'Device 4' }
  });
  assert.equal(fourth.response.status, 403);
  assert.equal(fourth.data.code, 'DEVICE_LIMIT');
  const session = await request('/api/session', { cookie: lastCookie });
  assert.equal(session.response.status, 200);
  assert.equal(session.data.plan, 'pro');
});

test('one-device test account rejects its second device', async () => {
  const first = await request('/api/login', {
    method: 'POST',
    body: { username: 'tester', password: 'tester-pass-123', deviceId: 'tester-device-0001' }
  });
  assert.equal(first.response.status, 200);
  const second = await request('/api/login', {
    method: 'POST',
    body: { username: 'tester', password: 'tester-pass-123', deviceId: 'tester-device-0002' }
  });
  assert.equal(second.response.status, 403);
});

test('protected app requires a valid session', async () => {
  const denied = await request('/api/app');
  assert.equal(denied.response.status, 401);
  const login = await request('/api/login', {
    method: 'POST',
    body: { username: 'tester', password: 'tester-pass-123', deviceId: 'tester-device-0001' }
  });
  const allowed = await request('/api/app', { cookie: login.cookie });
  assert.equal(allowed.response.status, 200);
  assert.match(allowed.data, /Protected WhiteBoard/);
  assert.equal(allowed.data.split(PRO_PLAN_GRANTED).length - 1, 1);
  assert.doesNotMatch(allowed.data, /content="free" data-server-plan-grant/);
  assert.match(allowed.response.headers.get('cache-control'), /no-store/);
});

test('logout clears the server session cookie', async () => {
  const login = await request('/api/login', {
    method: 'POST',
    body: { username: 'tester', password: 'tester-pass-123', deviceId: 'tester-device-0001' }
  });
  assert.equal(login.response.status, 200);
  const logout = await request('/api/logout', { method: 'POST', cookie: login.cookie });
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get('set-cookie') || '', /Max-Age=0/i);
});

test('password reset and device reset invalidate old sessions', async () => {
  const account = await store.getAccountByUsername('tester');
  const login = await request('/api/login', {
    method: 'POST',
    body: { username: 'tester', password: 'tester-pass-123', deviceId: 'tester-device-0001' }
  });
  assert.equal(login.response.status, 200);
  const changed = await request(`/api/admin/accounts/${account.id}/password`, { method: 'POST', admin: true, body: { password: 'tester-new-pass-456' } });
  assert.equal(changed.response.status, 200);
  assert.equal((await request('/api/session', { cookie: login.cookie })).response.status, 401);
  const relogin = await request('/api/login', {
    method: 'POST',
    body: { username: 'tester', password: 'tester-new-pass-456', deviceId: 'tester-device-0001' }
  });
  assert.equal(relogin.response.status, 200);
  const reset = await request(`/api/admin/accounts/${account.id}/devices`, { method: 'POST', admin: true, body: {} });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.data.clearedDevices, 1);
  assert.equal((await request('/api/session', { cookie: relogin.cookie })).response.status, 401);
});

test('disabled account cannot log in and existing sessions are rejected', async () => {
  const account = await store.getAccountByUsername('creator');
  const existing = await request('/api/login', {
    method: 'POST',
    body: { username: 'creator', password: 'creator-pass-123', deviceId: 'creator-device-001' }
  });
  assert.equal(existing.response.status, 200);
  const disabled = await request(`/api/admin/accounts/${account.id}`, { method: 'PATCH', admin: true, body: { enabled: false } });
  assert.equal(disabled.response.status, 200);
  assert.equal((await request('/api/session', { cookie: existing.cookie })).response.status, 401);
  const login = await request('/api/login', {
    method: 'POST',
    body: { username: 'creator', password: 'creator-pass-123', deviceId: 'creator-device-001' }
  });
  assert.equal(login.response.status, 401);
  assert.equal(login.data.code, 'ACCOUNT_DISABLED');
});
