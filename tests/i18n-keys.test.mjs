import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const files = ['index.html', 'whiteboard.html', 'whiteboard-pro.html', 'account-admin.html', 'account-admin1.html'];
const locales = ['i18n.js', 'zh-CN.js', 'en-US.js'];

async function source(name) {
  return readFile(resolve(root, name), 'utf8');
}

test('locales/ ships the shared i18n core plus zh-CN and en-US dictionaries', async () => {
  for (const f of locales) {
    const html = await source(`locales/${f}`);
    assert.ok(html.length > 0, `locales/${f} exists`);
  }
  const core = await source('locales/i18n.js');
  assert.match(core, /window\.i18n\s*=\s*i18n/);
  assert.match(core, /addMessages/);
  assert.match(core, /setLanguage/);
  assert.match(core, /detectLanguage/);
  assert.match(core, /initI18n/);
  assert.match(core, /navigator\.languages|navigator\.language/);
  // 中文 / zh-* 命中 zh-CN
  assert.match(core, /zh-?\*\/?zh-CN/);
});

test('zh-CN and en-US dictionaries share the same key set', async () => {
  const zh = await source('locales/zh-CN.js');
  const en = await source('locales/en-US.js');
  const extractKeys = src => Array.from(src.matchAll(/'([a-z0-9_.\-]+)'\s*:\s*'/g)).map(m=>m[1]).sort();
  const zhKeys = extractKeys(zh);
  const enKeys = extractKeys(en);
  const onlyInZh = zhKeys.filter(k => !enKeys.includes(k));
  const onlyInEn = enKeys.filter(k => !zhKeys.includes(k));
  assert.deepEqual(onlyInZh, [], 'every key in zh-CN must exist in en-US');
  assert.deepEqual(onlyInEn, [], 'every key in en-US must exist in zh-CN');
});

test('entry pages load shared locales and whiteboards embed the same source bundle', async () => {
  for (const file of files) {
    const html = await source(file);
    if(file === 'whiteboard.html' || file === 'whiteboard-pro.html'){
      assert.match(html, /WB_I18N_BUNDLE_START/);
      assert.match(html, /data-whiteboard-i18n/);
      assert.match(html, /__wbSharedCore/);
      assert.match(html, /addMessages\('zh-CN'/);
      assert.match(html, /addMessages\('en-US'/);
      continue;
    }
    // i18n.js 必须在 zh-CN / en-US 之前
    const idxCore = html.indexOf('./locales/i18n.js');
    const idxZh = html.indexOf('./locales/zh-CN.js');
    const idxEn = html.indexOf('./locales/en-US.js');
    assert.ok(idxCore > 0, `${file} loads locales/i18n.js`);
    assert.ok(idxZh > 0, `${file} loads locales/zh-CN.js`);
    assert.ok(idxEn > 0, `${file} loads locales/en-US.js`);
    assert.ok(idxCore < idxZh && idxCore < idxEn, `${file} loads i18n.js before both dictionaries`);
  }
});

test('every HTML seed the init with i18n.initI18n(...)', async () => {
  for (const file of files) {
    const html = await source(file);
    if(file==='index.html'){
      assert.match(html, /<script src="\.\/locales\/index-init\.js"><\/script>/, `${file} loads its shared i18n initializer`);
      assert.match(await source('locales/index-init.js'), /i18n\.initI18n\(/, 'shared index initializer boots i18n');
    }else{
      assert.match(html, /i18n\.initI18n\(/, `${file} boots i18n once`);
    }
  }
});
