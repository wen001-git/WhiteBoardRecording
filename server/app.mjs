import { randomUUID } from 'node:crypto';
import { parseCookies, safeEqual, sessionCookie, signSession, verifyPassword, verifySession } from './auth.mjs';
import { injectProGrant } from './pro-app.mjs';

const COOKIE_NAME = 'wb_pro_session';
const MAX_BODY = 64 * 1024;

function publicAccount(account) {
  return {
    id: account.id,
    username: account.username,
    enabled: account.enabled,
    maxDevices: account.maxDevices,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt,
    devices: account.devices || []
  };
}

function parseAllowedOrigins(value) {
  return new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean));
}

function requestIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error('请求内容过大'), { status: 413 });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error('JSON 格式不正确'), { status: 400 }); }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...headers
  });
  res.end(body);
}

function sendJson(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), { 'content-type': 'application/json; charset=utf-8', ...headers });
}

function adminAuthorized(req, token) {
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return Boolean(token) && safeEqual(supplied, token);
}

function validateDeviceId(value) {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{16,128}$/.test(id) ? id : '';
}

function validatePassword(value) {
  const password = String(value || '');
  return password.length >= 8 && password.length <= 128 ? password : '';
}

export function createApp(options) {
  const store = options.store;
  const authSecret = options.authSecret;
  const adminToken = options.adminToken;
  const sessionDays = Math.max(1, Number(options.sessionDays || 30));
  const cookieDomain = options.cookieDomain || '';
  const cookieSecure = options.cookieSecure !== false;
  const allowedOrigins = parseAllowedOrigins(options.allowedOrigins);
  const loadProtectedApp = options.loadProtectedApp;
  const loginAttempts = new Map();

  function corsHeaders(req) {
    const origin = String(req.headers.origin || '');
    if (!origin) return {};
    if (!allowedOrigins.has(origin)) return null;
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'access-control-allow-headers': 'Content-Type,Authorization,X-Device-Id',
      vary: 'Origin'
    };
  }

  async function sessionFor(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    const payload = verifySession(token, authSecret);
    if (!payload) return null;
    const account = await store.validateSession(payload.accountId, payload.deviceId, payload.sessionVersion);
    return account ? { account, payload } : null;
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const cors = corsHeaders(req);
    if (cors === null) return sendJson(res, 403, { ok: false, code: 'ORIGIN_DENIED', message: '此来源不允许访问账号服务' });
    if (req.method === 'OPTIONS') return send(res, 204, '', cors);
    try {
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/health') {
        await store.healthCheck();
        const body = req.method === 'HEAD' ? '' : JSON.stringify({ ok: true, service: 'whiteboard-auth' });
        return send(res, 200, body, { 'content-type': 'application/json; charset=utf-8', ...cors });
      }

      if (req.method === 'POST' && url.pathname === '/api/login') {
        const ip = requestIp(req);
        const attempt = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + 15 * 60_000 };
        if (Date.now() > attempt.resetAt) { attempt.count = 0; attempt.resetAt = Date.now() + 15 * 60_000; }
        if (attempt.count >= 20) return sendJson(res, 429, { ok: false, code: 'RATE_LIMITED', message: '尝试次数过多，请稍后再试' }, cors);
        const body = await readJson(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        const deviceId = validateDeviceId(body.deviceId);
        if (!username || !password || !deviceId) return sendJson(res, 400, { ok: false, code: 'INVALID_INPUT', message: '请输入账号、密码，并允许生成设备标识' }, cors);
        const account = await store.getAccountByUsername(username);
        const passwordOk = account && await verifyPassword(password, account.passwordSalt, account.passwordHash);
        if (!account || !passwordOk || !account.enabled) {
          attempt.count += 1; loginAttempts.set(ip, attempt);
          return sendJson(res, 401, { ok: false, code: account && !account.enabled ? 'ACCOUNT_DISABLED' : 'LOGIN_FAILED', message: account && !account.enabled ? '账号已停用，请联系作者' : '账号或密码不正确' }, cors);
        }
        const binding = await store.bindDevice(account.id, {
          deviceId,
          deviceName: String(body.deviceName || '').slice(0, 120),
          userAgent: String(req.headers['user-agent'] || '').slice(0, 500)
        });
        if (!binding.ok) {
          return sendJson(res, binding.reason === 'DEVICE_LIMIT' ? 403 : 401, {
            ok: false,
            code: binding.reason,
            message: binding.reason === 'DEVICE_LIMIT' ? `此账号最多可关联 ${binding.maxDevices} 台设备，请联系作者清空设备列表` : '账号当前不可用',
            maxDevices: binding.maxDevices
          }, cors);
        }
        await store.touchLogin(account.id);
        const now = Date.now();
        const exp = now + sessionDays * 86_400_000;
        const token = signSession({ accountId: account.id, username: account.username, deviceId, sessionVersion: account.sessionVersion, iat: now, exp }, authSecret);
        loginAttempts.delete(ip);
        return sendJson(res, 200, { ok: true, plan: 'pro', username: account.username, maxDevices: account.maxDevices, expiresAt: exp }, {
          ...cors,
          'set-cookie': sessionCookie(COOKIE_NAME, token, { secure: cookieSecure, domain: cookieDomain, maxAge: sessionDays * 86_400 })
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/session') {
        const session = await sessionFor(req);
        if (!session) return sendJson(res, 401, { ok: false, code: 'SESSION_INVALID', message: '登录已失效，请重新登录' }, cors);
        return sendJson(res, 200, { ok: true, plan: 'pro', username: session.account.username, maxDevices: session.account.maxDevices, expiresAt: session.payload.exp }, cors);
      }

      if (req.method === 'POST' && url.pathname === '/api/logout') {
        return sendJson(res, 200, { ok: true }, {
          ...cors,
          'set-cookie': sessionCookie(COOKIE_NAME, '', { secure: cookieSecure, domain: cookieDomain, maxAge: 0 })
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/app') {
        const session = await sessionFor(req);
        if (!session) return sendJson(res, 401, { ok: false, code: 'SESSION_INVALID', message: '请先登录 Pro' }, cors);
        const app = injectProGrant(await loadProtectedApp());
        return send(res, 200, app, {
          ...cors,
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': "frame-ancestors 'self' https://record.leewen.work",
          'cache-control': 'private, no-store, max-age=0'
        });
      }

      if (url.pathname.startsWith('/api/admin/')) {
        if (!adminAuthorized(req, adminToken)) return sendJson(res, 401, { ok: false, code: 'ADMIN_UNAUTHORIZED', message: '管理令牌不正确' }, cors);
        if (req.method === 'GET' && url.pathname === '/api/admin/accounts') {
          const accounts = await store.listAccounts();
          return sendJson(res, 200, { ok: true, accounts: accounts.map(publicAccount) }, cors);
        }
        if (req.method === 'POST' && url.pathname === '/api/admin/accounts') {
          const body = await readJson(req);
          const username = String(body.username || '').trim();
          const password = validatePassword(body.password);
          const maxDevices = Math.max(1, Math.min(20, Number(body.maxDevices || 3)));
          if (!username || username.length > 80 || !password) return sendJson(res, 400, { ok: false, code: 'INVALID_INPUT', message: '账号不能为空，密码至少 8 位' }, cors);
          try {
            const account = await store.createAccount({ username, password, maxDevices });
            return sendJson(res, 201, { ok: true, account: publicAccount(account) }, cors);
          } catch (error) {
            if (error && error.code === '23505') return sendJson(res, 409, { ok: false, code: 'USERNAME_EXISTS', message: '账号已存在' }, cors);
            throw error;
          }
        }
        const match = url.pathname.match(/^\/api\/admin\/accounts\/(\d+)(?:\/(password|devices))?$/);
        if (match) {
          const id = Number(match[1]);
          const action = match[2] || '';
          if (req.method === 'PATCH' && !action) {
            const body = await readJson(req);
            const patch = {};
            if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
            if (body.maxDevices != null) patch.maxDevices = Math.max(1, Math.min(20, Number(body.maxDevices)));
            const account = await store.updateAccount(id, patch);
            if (!account) return sendJson(res, 404, { ok: false, code: 'NOT_FOUND', message: '账号不存在' }, cors);
            return sendJson(res, 200, { ok: true, account: publicAccount(account) }, cors);
          }
          if (req.method === 'POST' && action === 'password') {
            const body = await readJson(req);
            const password = validatePassword(body.password);
            if (!password) return sendJson(res, 400, { ok: false, code: 'INVALID_PASSWORD', message: '新密码至少 8 位' }, cors);
            const account = await store.resetPassword(id, password);
            if (!account) return sendJson(res, 404, { ok: false, code: 'NOT_FOUND', message: '账号不存在' }, cors);
            return sendJson(res, 200, { ok: true }, cors);
          }
          if (req.method === 'POST' && action === 'devices') {
            const clearedDevices = await store.resetDevices(id);
            return sendJson(res, 200, { ok: true, clearedDevices }, cors);
          }
        }
      }

      return sendJson(res, 404, { ok: false, code: 'NOT_FOUND', requestId: randomUUID() }, cors);
    } catch (error) {
      console.error(error);
      return sendJson(res, error.status || 500, { ok: false, code: 'SERVER_ERROR', message: error.status ? error.message : '服务暂时不可用，请稍后重试' }, cors || {});
    }
  };
}
