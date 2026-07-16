import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createApp } from './app.mjs';
import { PgAccountStore } from './store.mjs';

const port = Number(process.env.PORT || 8787);
const appPath = resolve(process.env.PRO_APP_PATH || './whiteboard-pro.html');
const required = ['DATABASE_URL', 'AUTH_SECRET', 'ADMIN_TOKEN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} 未配置`);
}

const store = new PgAccountStore(process.env.DATABASE_URL);
await store.init();
let cachedApp = null;
async function loadProtectedApp() {
  if (!cachedApp) cachedApp = await readFile(appPath, 'utf8');
  return cachedApp;
}

const handler = createApp({
  store,
  authSecret: process.env.AUTH_SECRET,
  adminToken: process.env.ADMIN_TOKEN,
  allowedOrigins: process.env.ALLOWED_ORIGINS || 'https://record.leewen.work,http://localhost:8000,null',
  cookieDomain: process.env.COOKIE_DOMAIN || '',
  cookieSecure: process.env.COOKIE_SECURE !== '0',
  sessionDays: process.env.SESSION_DAYS || 30,
  loadProtectedApp
});

const server = createServer(handler);
server.listen(port, '0.0.0.0', () => console.log(`WhiteBoard account service listening on ${port}`));

async function shutdown() {
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
