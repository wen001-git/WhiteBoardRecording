import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { PRO_PLAN_PLACEHOLDER } from '../server/pro-app.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, '..');

async function source(name) {
  return readFile(resolve(root, name), 'utf8');
}

test('public build publishes the commercial free app and excludes private source apps', async () => {
  await execFileAsync(process.execPath, [resolve(root, 'scripts/build-static.mjs')], { cwd: root });
  const files = (await readdir(resolve(root, '.render-static'))).sort();
  assert.deepEqual(files, ['account-admin.html', 'account-admin1.html', 'accounts.json', 'app.html', 'index.html']);
  assert.equal(await source('.render-static/app.html'), await source('whiteboard-pro.html'));
  assert.equal(await source('.render-static/accounts.json'), await source('accounts.json'));
  await assert.rejects(access(resolve(root, '.render-static/whiteboard.html')));
  await assert.rejects(access(resolve(root, '.render-static/whiteboard-pro.html')));
});

test('gateway loads Pro through static accounts file', async () => {
  const html = await source('index.html');
  assert.match(html, /accounts\.json/);
  assert.match(html, /wb_static_pro_session/);
  assert.match(html, /正在校验静态 Pro 账号/);
  assert.match(html, /\.\/app\.html/);
  assert.doesNotMatch(html, /\.\/whiteboard\.html/);
});

test('private app is full-featured while the commercial template fails closed', async () => {
  const [privateApp, commercialTemplate] = await Promise.all([
    source('whiteboard.html'),
    source('whiteboard-pro.html'),
  ]);
  assert.match(privateApp, /name="whiteboard-plan"\s+content="pro"/);
  assert.doesNotMatch(privateApp, /data-server-plan-grant=/);
  assert.match(commercialTemplate, /content\|\|'free'/);
  assert.doesNotMatch(commercialTemplate, /name="whiteboard-plan"\s+content="pro"/);
  assert.equal(commercialTemplate.split(PRO_PLAN_PLACEHOLDER).length - 1, 1);
  assert.match(
    commercialTemplate,
    /const PRO_PURCHASE_MESSAGE='创作不易，请加作者微信购买，39元解锁全部功能。'/,
  );
  assert.match(
    commercialTemplate,
    /purchaseMessage\.textContent\s*=\s*PRO_PURCHASE_MESSAGE/,
  );
  assert.match(commercialTemplate, /id="accountBtn"/);
  assert.match(commercialTemplate, /id="accountLogout"/);
  assert.match(commercialTemplate, /function openStaticProLogin\(\)/);
  assert.match(commercialTemplate, /localStorage\.removeItem\(STATIC_SESSION_KEY\)/);
  for (const html of [privateApp, commercialTemplate]) {
    assert.match(html, /function requirePro\(feature\)/);
    assert.match(html, /微信扫码加好友 → 付款 → 获取 Pro 账号/);
    assert.match(html, /leewen2017/);
  }
});

test('localhost API override is accepted only for local pages and local targets', async () => {
  for (const file of ['whiteboard.html', 'whiteboard-pro.html', 'account-admin.html']) {
    const html = await source(file);
    assert.match(html, /LOCAL_API_HOSTS=new Set\(\['localhost','127\.0\.0\.1'\]\)/);
    assert.match(html, /new URLSearchParams\(location\.search\)\.get\('api'\)/);
    assert.match(html, /LOCAL_API_HOSTS\.has\(target\.hostname\)/);
  }
});

test('all agreed free limits are enforced before protected actions', async () => {
  const html = await source('whiteboard-pro.html');
  assert.match(html, /!IS_PRO\s*&&\s*state\.slides\.length>=3/);
  assert.match(html, /requirePro\('slides'\)/);
  assert.match(html, /requirePro\('monitorRecording'\)/);
  assert.match(html, /requirePro\('stickers'\)/);
  assert.match(html, /requirePro\('slideReveal'\)/);
  assert.match(html, /requirePro\('flow'\)/);
  assert.match(html, /s\s*>=\s*25/);
  assert.match(html, /免费录制将在 30 秒时自动结束/);
  assert.match(html, /curElapsed\(\)\s*>=\s*30000/);
  assert.match(html, /drawPlanWatermarks/);
  assert.match(html, /record\.leewen\.work/);
  assert.doesNotMatch(html, /白板录制工具  免费版/);
});

test('admin token remains session-only and new accounts default to three devices', async () => {
  const html = await source('account-admin.html');
  assert.match(html, /const TOKEN_KEY\s*=\s*['"]wb_admin_token['"]/);
  assert.match(html, /sessionStorage\.getItem\(TOKEN_KEY\)/);
  assert.match(html, /sessionStorage\.setItem\(TOKEN_KEY/);
  assert.doesNotMatch(html, /localStorage\.[^(]*\([^)]*wb_admin_token/);
  assert.match(html, /value="3"/);
});

test('static Pro accounts contain ten enabled hashed accounts without plaintext passwords', async () => {
  const data = JSON.parse(await source('accounts.json'));
  assert.equal(data.accounts.length, 10);
  assert.ok(data.accounts.every(account => account.enabled === true));
  assert.ok(data.accounts.every(account => account.plan === 'pro'));
  assert.ok(data.accounts.every(account => /^[a-f0-9]{64}$/.test(account.h)));
  assert.doesNotMatch(await source('accounts.json'), /WbPro-/);
});

test('static account admin manages accounts.json without backend API', async () => {
  const html = await source('account-admin1.html');
  assert.match(html, /accounts\.json/);
  assert.match(html, /wb-static-pro-salt-v1/);
  assert.match(html, /SHA-256\(salt:usernameLowercase:password\)/);
  assert.doesNotMatch(html, /\/api\/admin/);
  assert.doesNotMatch(html, /ADMIN_TOKEN/);
});

test('Render blueprint has one protected Node service in Oregon', async () => {
  const yaml = await source('render.yaml');
  assert.match(yaml, /name: whiteboard-auth/);
  assert.match(yaml, /runtime: node/);
  assert.match(yaml, /region: oregon/);
  assert.match(yaml, /healthCheckPath: \/health/);
  for (const key of ['DATABASE_URL', 'AUTH_SECRET', 'ADMIN_TOKEN', 'ALLOWED_ORIGINS', 'COOKIE_DOMAIN']) {
    assert.match(yaml, new RegExp(`key: ${key}`));
  }
});

test('inline JavaScript in shipped HTML parses successfully', async () => {
  for (const file of ['index.html', 'whiteboard.html', 'whiteboard-pro.html', 'account-admin.html', 'account-admin1.html']) {
    const html = await source(file);
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
    assert.ok(scripts.length > 0, `${file} should contain inline JavaScript`);
    scripts.forEach((code, index) => {
      assert.doesNotThrow(() => new Function(code), `${file} inline script ${index + 1} should parse`);
    });
  }
});
