import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const dictionaries = {};
const api = { addMessages:(lang,messages)=>Object.assign(dictionaries[lang] ||= {},messages) };
const context = vm.createContext({window:{i18n:api},i18n:api});
for(const name of ['zh-CN.js','en-US.js','whiteboard-phrases.js']){
  vm.runInContext(await readFile(resolve(root,'locales',name),'utf8'),context);
}
const chinesePhrases = new Set(Object.values(dictionaries['zh-CN']));

function visibleChinese(html){
  const source = html
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<script\b[\s\S]*?<\/script>/gi,'')
    .replace(/<style\b[\s\S]*?<\/style>/gi,'');
  const found = new Set();
  for(const match of source.matchAll(/\b(?:title|aria-label|placeholder|alt|data-placeholder)="([^"]+)"/g)){
    const value = match[1].trim();
    if(/[\u3400-\u9fff]/.test(value)) found.add(value);
  }
  for(const match of source.matchAll(/>([^<>]+)</g)){
    const value = match[1].replace(/\s+/g,' ').trim();
    if(/[\u3400-\u9fff]/.test(value)) found.add(value);
  }
  return [...found];
}

test('all static Chinese whiteboard UI phrases have an English counterpart', async () => {
  for(const name of ['whiteboard.html','whiteboard-pro.html']){
    const html = await readFile(resolve(root,name),'utf8');
    const missing = visibleChinese(html).filter(value=>!chinesePhrases.has(value));
    assert.deepEqual(missing,[],`${name} untranslated static phrases: ${missing.join(' | ')}`);
  }
});

test('both whiteboards remain self-contained and do not require locale files at runtime', async () => {
  for(const name of ['whiteboard.html','whiteboard-pro.html']){
    const html = await readFile(resolve(root,name),'utf8');
    assert.match(html,/data-whiteboard-i18n/);
    assert.doesNotMatch(html,/src="\.\/locales\//);
  }
});
