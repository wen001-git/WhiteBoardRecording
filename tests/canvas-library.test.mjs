import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const files = ['whiteboard.html', 'whiteboard-pro.html'];

async function source(name) {
  return readFile(resolve(root, name), 'utf8');
}

function between(html, start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing ${start}`);
  assert.notEqual(to, -1, `missing ${end}`);
  return html.slice(from, to);
}

test('both whiteboard variants expose the local canvas library controls', async () => {
  for (const file of files) {
    const html = await source(file);
    const controls = between(html, '<div class="doc-actions" id="docActions"', '<div class="canvas-bg-popover"');
    for (const id of ['boardLibraryCount', 'boardLibraryList', 'docNew', 'docOpen', 'docSave', 'boardClear', 'boardConfirmOverlay']) {
      assert.match(controls, new RegExp(`id="${id}"`));
    }
    assert.doesNotMatch(controls, /id="boardDelete"/);
    assert.match(controls, /aria-label="画布管理"/);
    assert.match(controls, />导入</);
    assert.match(controls, />导出</);
  }
});

test('canvas library preserves boards and separates clear from delete', async () => {
  for (const file of files) {
    const html = await source(file);
    const storage = between(html, '/* ---------------- 存档：本机多画布 + 自动保存 + 导出/导入 .json ---------------- */', '// 缩放条');
    assert.match(storage, /let boardLibrary=\{version:1,activeId:'',boards:\[\]\}/);
    assert.match(storage, /function boardStorageKey\(id\)/);
    assert.match(storage, /async function switchBoard\(id\)/);
    assert.match(storage, /async function clearCurrentBoard\(\)/);
    assert.match(storage, /async function deleteBoardById\(id\)/);
    assert.match(storage, /boardLibrary\.boards\.length<=1/);
    assert.match(storage, /applyDoc\(emptyBoardDoc\(\)\)/);
    assert.match(storage, /await idbDelete\(boardStorageKey\(entry\.id\)\)/);
    assert.match(storage, /findIndex\(item=>item\.id===id\)/);
    assert.match(storage, /if\(entry\.id===boardLibrary\.activeId\)/);
    assert.match(storage, /remove\.dataset\.deleteBoardId/);
    assert.match(storage, /e\.preventDefault\(\); e\.stopPropagation\(\)/);
    assert.match(storage, /className='board-library-open'/);
    assert.match(storage, /className='board-library-delete'/);
    assert.match(storage, /if\(boardLibrary\.boards\.length>1\)/);
    assert.match(storage, /const savedLibrary=await idbGet\('library'\)/);
    assert.match(storage, /let legacy=await idbGet\('current'\)/);
    assert.match(storage, /已导入为新画布/);
  }
});

test('canvas library implementation stays aligned between both variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const storage = html => between(html, '/* ---------------- 存档：本机多画布 + 自动保存 + 导出/导入 .json ---------------- */', '// 缩放条');
  const controls = html => between(html, '<div class="doc-actions" id="docActions"', '<div class="canvas-bg-popover"');
  assert.equal(storage(privateApp), storage(commercialTemplate));
  assert.equal(controls(privateApp), controls(commercialTemplate));
});
