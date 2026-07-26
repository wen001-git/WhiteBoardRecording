import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const core = await readFile(resolve(root, 'locales/i18n.js'), 'utf8');

function runtime(languages){
  const values = new Map();
  const window = {};
  const context = {
    window,
    navigator: { languages, language: languages[0] || '' },
    document: { body: null, documentElement: { lang: '' } },
    localStorage: {
      getItem: key=>values.get(key) ?? null,
      setItem: (key,value)=>values.set(key,String(value)),
    },
  };
  vm.createContext(context);
  vm.runInContext(core, context);
  window.i18n.addMessages('zh-CN',{ sample:'中文' });
  window.i18n.addMessages('en-US',{ sample:'English' });
  return { i18n:window.i18n, values, document:context.document };
}

test('auto language follows the first supported browser preference', () => {
  assert.equal(runtime(['zh-SG','en-US']).i18n.detectLanguage({default:'en-US'}),'zh-CN');
  assert.equal(runtime(['fr-FR','en-GB']).i18n.detectLanguage({default:'en-US'}),'en-US');
  assert.equal(runtime(['fr-FR']).i18n.detectLanguage({default:'en-US'}),'en-US');
});

test('browser detection remains auto until the user explicitly chooses', () => {
  const app = runtime(['zh-CN']);
  app.i18n.initI18n({storageKey:'wb.lang',default:'en-US'});
  assert.equal(app.i18n.languagePreference(),'auto');
  assert.equal(app.document.documentElement.lang,'zh-CN');
  assert.equal(app.values.has('wb.lang'),false,'auto detection must not become a manual override');

  app.i18n.setLanguage('en-US',{persist:true,storageKey:'wb.lang'});
  assert.equal(app.values.get('wb.lang'),'en-US');
  assert.equal(app.document.documentElement.lang,'en-US');

  app.i18n.setLanguage('auto',{persist:true,storageKey:'wb.lang'});
  assert.equal(app.values.get('wb.lang'),'auto');
  assert.equal(app.document.documentElement.lang,'zh-CN');
});
