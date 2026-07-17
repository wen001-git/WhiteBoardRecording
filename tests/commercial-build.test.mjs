import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
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

function embeddedSticker(html, name) {
  const start = html.indexOf(`{name:'${name}'`);
  const end = html.indexOf('}\n      ,', start);
  assert.notEqual(start, -1, `${name} should exist`);
  assert.notEqual(end, -1, `${name} should have a complete object`);
  const object = html.slice(start, end + 1);
  const dimensions = object.match(/w:(\d+),h:(\d+),src:'data:image\/webp;base64,'\+/);
  assert.ok(dimensions, `${name} should be an inline WebP`);
  const base64 = [...object.matchAll(/'([A-Za-z0-9+/=]+)'/g)]
    .map((match) => match[1])
    .join('');
  return {
    width: Number(dimensions[1]),
    height: Number(dimensions[2]),
    bytes: Buffer.from(base64, 'base64'),
  };
}

test('public build publishes the commercial free app and excludes private source apps', async () => {
  await execFileAsync(process.execPath, [resolve(root, 'scripts/build-static.mjs')], { cwd: root });
  const files = (await readdir(resolve(root, '.render-static'))).sort();
  assert.deepEqual(files, ['account-admin.html', 'account-admin1.html', 'accounts.json', 'app.html', 'index.html', 'paywall.json']);
  assert.equal(await source('.render-static/app.html'), await source('whiteboard-pro.html'));
  assert.equal(await source('.render-static/accounts.json'), await source('accounts.json'));
  assert.equal(await source('.render-static/paywall.json'), await source('paywall.json'));
  await assert.rejects(access(resolve(root, '.render-static/whiteboard.html')));
  await assert.rejects(access(resolve(root, '.render-static/whiteboard-pro.html')));
});

test('gateway prefers static accounts and falls back to the account service', async () => {
  const html = await source('index.html');
  assert.match(html, /accounts\.json/);
  assert.match(html, /wb_static_pro_session/);
  assert.match(html, /async function tryStaticLogin/);
  assert.match(html, /async function loginPro/);
  assert.match(html, /api\('\/api\/login'/);
  assert.ok(html.indexOf('await tryStaticLogin') < html.indexOf("api('/api/login'"));
  assert.match(html, /本地账号未匹配，正在连接账号服务/);
  assert.match(html, /\.\/app\.html/);
  assert.doesNotMatch(html, /\.\/whiteboard\.html/);
  assert.match(html, /PAYWALL_URL='\.\/paywall\.json'/);
  assert.doesNotMatch(html, /document\.write/);
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
    /const DEFAULT_PURCHASE_CONFIG=\{price:'59',wechat:'leewen2017'\}/,
  );
  assert.match(commercialTemplate, /raw\.wx\?\?raw\.wechat/);
  assert.match(commercialTemplate, /const PAYWALL_URL='\.\/paywall\.json'/);
  assert.match(commercialTemplate, /fetch\(PAYWALL_URL/);
  assert.match(commercialTemplate, /function loadPurchaseConfig\(\)/);
  assert.match(commercialTemplate, /const STATIC_ADMIN_CHANNEL='wb_static_admin_cfg'/);
  assert.match(commercialTemplate, /function watchPurchaseConfigUpdates\(\)/);
  assert.match(commercialTemplate, /BroadcastChannel\(STATIC_ADMIN_CHANNEL\)/);
  assert.match(commercialTemplate, /window\.addEventListener\('storage'/);
  assert.match(commercialTemplate, /purchaseMessageFromConfig\(\)/);
  assert.match(commercialTemplate, /id="proWechatId"/);
  assert.match(commercialTemplate, /id="accountBtn"/);
  assert.match(commercialTemplate, /id="accountLogout"/);
  assert.match(commercialTemplate, /function openStaticProLogin\(\)/);
  assert.match(commercialTemplate, /function loginWithFallback\(/);
  assert.match(commercialTemplate, /function grantServerProSession\(session\)/);
  assert.match(commercialTemplate, /function restoreServerProSession\(\)/);
  assert.match(commercialTemplate, /function renderAccountEntry\(\)/);
  assert.match(commercialTemplate, /grantServerProSession\(result\.session\)/);
  assert.match(commercialTemplate, /proApi\('\/api\/logout'/);
  assert.match(commercialTemplate, /localStorage\.removeItem\(STATIC_SESSION_KEY\)/);
  assert.match(commercialTemplate, /btn\.textContent=username/);
  assert.doesNotMatch(commercialTemplate, /Pro · \$\{username\}/);
  assert.doesNotMatch(commercialTemplate, /document\.write/);
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

test('sticker tools stay above slide canvas controls in both whiteboard variants', async () => {
  for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.match(html, /\.slideFrame\{position:fixed;z-index:57;/);
    assert.match(html, /#slideRevealFloatBtn\{position:fixed;z-index:58;/);
    assert.match(html, /\.sticker-popover\{position:fixed;z-index:59;/);
  }
});

test('remote meeting AI comic stickers ship identically in both whiteboard variants', async () => {
  const groups = [];
  const names = ['远程会议', '实时记录', '实时翻译', '详细纪要', '会议总结', '行动计划'];

  for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    const start = html.indexOf("{id:'meeting',label:'会议场景',stickers:[");
    const end = html.indexOf('\n    ]}', start);
    assert.notEqual(start, -1, `${file} should include the meeting sticker group`);
    assert.notEqual(end, -1, `${file} should close the meeting sticker group`);
    const group = html.slice(start, end);
    assert.equal((group.match(/data:image\/webp;base64,/g) || []).length, 6);
    for (const name of names) assert.ok(group.includes(`会议场景·${name}`));
    groups.push(group);
  }

  assert.equal(groups[0], groups[1]);
});

test('praise stickers are embedded identically in both whiteboard variants', async () => {
  const expected = {
    '男生·表扬': {
      width: 182,
      height: 420,
      sha256: 'fe9571d0b26b0d1dc130aac71e7bc1b848d749ae75901b0ef6d2a3bcef1c4a9b',
    },
    '女生·表扬': {
      width: 178,
      height: 420,
      sha256: '7bf975b9cd751973048e575c9e685a70dc700ba3b079190dc237cff66fff3d44',
    },
    '综合·女孩点赞': {
      width: 417,
      height: 420,
      sha256: '263aca8304bcc6db7a60d4a6808c74f59c86be183bec02efe5ee99a77e0cd532',
    },
  };
  const apps = await Promise.all(['whiteboard.html', 'whiteboard-pro.html'].map(source));

  for (const [name, asset] of Object.entries(expected)) {
    const embedded = apps.map((html) => embeddedSticker(html, name));
    for (const sticker of embedded) {
      assert.equal(sticker.width, asset.width);
      assert.equal(sticker.height, asset.height);
      assert.equal(createHash('sha256').update(sticker.bytes).digest('hex'), asset.sha256);
    }
    assert.deepEqual(embedded[0].bytes, embedded[1].bytes);
  }
});

test('admin token remains session-only and new accounts default to three devices', async () => {
  const html = await source('account-admin.html');
  assert.match(html, /const TOKEN_KEY\s*=\s*['"]wb_admin_token['"]/);
  assert.match(html, /sessionStorage\.getItem\(TOKEN_KEY\)/);
  assert.match(html, /sessionStorage\.setItem\(TOKEN_KEY/);
  assert.doesNotMatch(html, /localStorage\.[^(]*\([^)]*wb_admin_token/);
  assert.match(html, /value="3"/);
  assert.equal((html.match(/minlength="4"/g) || []).length, 2);
  assert.match(html, /设备 \/ 登录 IP/);
  assert.match(html, /最近成功登录 IP（最多 100 条，仅 Neon 账号）/);
  assert.match(html, /function detectIpBurst\(events\)/);
  assert.match(html, /检测到 1 小时内使用/);
});

test('all shipped password inputs use the four-character minimum', async () => {
  for (const file of ['index.html', 'whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.match(html, /type="password"[^>]*minlength="4"/);
    assert.doesNotMatch(html, /minlength="8"/);
  }
});

test('all customer login forms can show and hide the password', async () => {
  for (const file of ['index.html', 'whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.match(html, /data-password-toggle="(?:password|proPassword)"[^>]*aria-label="显示密码"/);
    assert.match(html, /<svg class="password-eye"[^>]*aria-hidden="true">/);
    assert.match(html, /<svg class="password-eye-off"[^>]*aria-hidden="true">/);
    assert.match(html, /input\.type=show\?'text':'password'/);
    assert.match(html, /button\.setAttribute\('aria-pressed',String\(show\)\)/);
  }
});

test('static Pro accounts contain enabled hashed accounts without plaintext passwords', async () => {
  const data = JSON.parse(await source('accounts.json'));
  assert.equal('purchase' in data, false);
  assert.ok(data.accounts.length >= 10);
  assert.ok(data.accounts.every(account => account.enabled === true));
  assert.ok(data.accounts.every(account => account.plan === 'pro'));
  assert.ok(data.accounts.every(account => /^[a-f0-9]{64}$/.test(account.h)));
  assert.doesNotMatch(await source('accounts.json'), /WbPro-/);
  const admin = data.accounts.find(account => account.u === 'admin');
  const expectedAdminHash = createHash('sha256').update(`${data.salt}:admin:window2000!`).digest('hex');
  assert.equal(admin?.h, expectedAdminHash);
});

test('paywall configuration is independent from accounts.json', async () => {
  const data = JSON.parse(await source('paywall.json'));
  assert.deepEqual(Object.keys(data).sort(), ['price', 'updatedAt', 'version', 'wx']);
  assert.equal(data.version, 1);
  assert.equal(data.price, '59');
  assert.equal(data.wx, 'leewen2017');
  assert.ok(String(data.updatedAt).trim());
});

test('static account admin manages accounts.json without backend API', async () => {
  const html = await source('account-admin1.html');
  assert.match(html, /accounts\.json/);
  assert.match(html, /wb-static-pro-salt-v1/);
  assert.match(html, /SHA-256\(salt:usernameLowercase:password\)/);
  assert.match(html, /id="purchasePrice"/);
  assert.match(html, /id="purchaseWechat"/);
  assert.match(html, /function purchaseFromInputs\(\)/);
  assert.match(html, /id="pullPurchaseBtn"/);
  assert.match(html, /id="paywallJsonOut"/);
  assert.match(html, /function paywallFromInputs\(/);
  assert.match(html, /function savePaywallJsonToDisk\(/);
  assert.match(html, /function saveAccountsJsonToDisk\(/);
  assert.match(html, /paywallFileHandle/);
  assert.match(html, /git add paywall\.json/);
  assert.doesNotMatch(html, /purchase:purchaseFromInputs\(\)/);
  assert.match(html, /const STATIC_ADMIN_CHANNEL='wb_static_admin_cfg'/);
  assert.match(html, /function syncPurchaseConfigOnly\(\)/);
  assert.match(html, /BroadcastChannel\(STATIC_ADMIN_CHANNEL\)/);
  assert.match(html, /showOpenFilePicker/);
  assert.match(html, /showSaveFilePicker/);
  assert.match(html, /accountsFileHandle/);
  assert.match(html, /const MIN_PASSWORD_LENGTH=4/);
  assert.match(html, /密码至少 4 位/);
  assert.match(html, /data-tab="single"/);
  assert.match(html, /id="singleUsername"/);
  assert.match(html, /id="singlePassword"[^>]*minlength="4"/);
  assert.match(html, /id="singleSalt"[^>]*value="wb-static-pro-salt-v1"/);
  assert.match(html, /id="singleHashOutput"/);
  assert.match(html, /id="copySingleHashBtn"/);
  assert.match(html, /sha256Hex\(`\$\{salt\}:\$\{user\}:\$\{password\}`\)/);
  assert.match(html, /尚未修改 accounts\.json/);
  assert.match(html, /id="generateSaltValue"/);
  assert.match(html, /本页静态账号统一盐值/);
  assert.match(html, /Node\/Neon 后端账号统一使用此盐值/);
  assert.match(html, /function syncStaticSaltInfo\(data\)/);
  assert.match(html, /localStorage\.setItem\(LOCAL_PURCHASE_KEY/);
  assert.match(html, /localStorage\.setItem\(LOCAL_ACCOUNTS_KEY,JSON\.stringify\(normalizeAccounts\(data\)\)\)/);
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
  assert.match(yaml, /path: \/accounts\.json\s+name: Access-Control-Allow-Origin\s+value: "\*"/);
  assert.match(yaml, /value: https:\/\/record\.leewen\.work,http:\/\/localhost:8000,null/);
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
