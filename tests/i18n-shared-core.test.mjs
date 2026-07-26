import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const htmlFiles = ['index.html', 'whiteboard.html', 'whiteboard-pro.html', 'account-admin.html', 'account-admin1.html'];

test('locales/i18n.js exists and exposes the contract used by all entry points', async () => {
  const src = await readFile(resolve(root, 'locales/i18n.js'), 'utf8');
  // Public API surface required by current initI18n({select, applyClass}) + onChange + applyToDocument usage
  for (const name of ['addMessages','t','setLanguage','detectLanguage','initI18n','onChange','applyToDocument','applyI18n','currentLang']) {
    const re = new RegExp(`\\b${name}\\s*\\(`);
    assert.match(src, re, `i18n.js should expose ${name}`);
  }
});

test('each HTML entry point loads or embeds the shared i18n sources', async () => {
  for (const f of htmlFiles) {
    const src = await readFile(resolve(root, f), 'utf8');
    if(f === 'whiteboard.html' || f === 'whiteboard-pro.html'){
      assert.match(src, /WB_I18N_BUNDLE_START/, `${f} must embed the shared bundle`);
      assert.match(src, /__wbSharedCore/, `${f} must embed locales/i18n.js`);
      assert.match(src, /addMessages\('zh-CN'/, `${f} must embed zh-CN`);
      assert.match(src, /addMessages\('en-US'/, `${f} must embed en-US`);
    }else{
      assert.match(src, /\.\/locales\/i18n\.js/, `${f} must load locales/i18n.js`);
      assert.match(src, /\.\/locales\/zh-CN\.js/, `${f} must load locales/zh-CN.js`);
      assert.match(src, /\.\/locales\/en-US\.js/, `${f} must load locales/en-US.js`);
    }
    assert.match(src, /i18n\.initI18n\(/, `${f} must call initI18n at least once`);
    // 防回归：脚本块必须正确闭合，避免调试标记泄漏到 DOM
    const opens = (src.match(/<script\b/g) || []).length;
    const closes = (src.match(/<\/script>/g) || []).length;
    assert.equal(opens, closes, `${f} <script> opens (${opens}) must match closes (${closes})`);
    assert.doesNotMatch(src, /wb_i18n_magic_block_marker/, `${f} must not leak the i18n debug marker`);
    // 防回归：script 块之后的正文不得包含裸 JS 语句（任何以 i18n. 开头的属性访问随后的函数调用）
    for (const m of src.matchAll(/<\/script>/g)) {
      const after = src.slice(m.index, Math.min(src.length, m.index + 400));
      assert.doesNotMatch(after, /\bi18n\.(onChange|t)\s*\(\s*function\b/, `${f} must not leak i18n.onChange/t after </script>`);
    }
  }
});

test('embedded whiteboard bundles exactly match the locale source files', async () => {
  const sourceBundle = (await Promise.all(['i18n.js','zh-CN.js','en-US.js','whiteboard-phrases.js'].map(
    name=>readFile(resolve(root,'locales',name),'utf8')
  ))).join('\n').replaceAll('</script','<\\/script');
  for(const f of ['whiteboard.html','whiteboard-pro.html']){
    const src = await readFile(resolve(root,f),'utf8');
    const match = src.match(/<!-- WB_I18N_BUNDLE_START -->\n<script data-whiteboard-i18n>\ntry \{\n([\s\S]*?)\n\} catch \(error\) \{/);
    assert.ok(match, `${f} has a complete embedded bundle`);
    assert.equal(match[1], sourceBundle, `${f} embedded bundle is current`);
  }
});

test('zh-CN and en-US dictionaries cover the same key set (mirror check)', async () => {
  const zh = await readFile(resolve(root, 'locales/zh-CN.js'), 'utf8');
  const en = await readFile(resolve(root, 'locales/en-US.js'), 'utf8');
  const re = /'([\w.+:-]+)':\s*'/g;
  const set = (src) => new Set([...src.matchAll(re)].map(m => m[1]));
  const missingInEn = [...set(zh)].filter(k => !set(en).has(k));
  const missingInZh = [...set(en)].filter(k => !set(zh).has(k));
  assert.deepEqual(missingInEn, [], `Keys missing in en-US: ${missingInEn.join(', ')}`);
  assert.deepEqual(missingInZh, [], `Keys missing in zh-CN: ${missingInZh.join(', ')}`);
});
