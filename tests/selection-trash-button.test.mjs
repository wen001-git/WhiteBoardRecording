import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const files = ['whiteboard.html', 'whiteboard-pro.html'];

async function source(name) {
  return readFile(resolve(root, name), 'utf8');
}

function section(html, start, end) {
  const from = html.indexOf(start);
  assert.notEqual(from, -1, `missing anchor: ${start}`);
  if (!end) return html.slice(from);
  const to = html.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing end anchor: ${end}`);
  return html.slice(from, to);
}

test('selection box hosts a touch-friendly trash button', async () => {
  for (const file of files) {
    const html = await source(file);

    // CSS：44px 圆形按钮，hover/active 红色态
    assert.match(html, /#selectionTrash\{[^}]*width:44px;height:44px;[^}]*touch-action:manipulation/,
      `${file} styles the trash button as a 44px touch-friendly circle`);
    assert.match(html, /#selectionTrash:hover,#selectionTrash:active\{background:#e15151;color:#fff;\}/,
      `${file} reddens the trash button on hover / active`);

    // DOM：按钮挂在 #selectionBox 内，含 aria-label。selectionBox 内有嵌套的 </div>，从 <div id="selectionBox"> 到 selectionBox 关闭的 400 字符窗口
    const boxStart = html.indexOf('<div id="selectionBox">');
    const boxSlice = html.slice(boxStart, boxStart + 500);
    assert.match(boxSlice, /<button id="selectionTrash"[^>]*aria-label="删除所选对象"/,
      `${file} renders the trash button inside #selectionBox with an aria-label`);
  }
});

test('updateSelectionBox shows the trash button only when something is selected in select mode', async () => {
  for (const file of files) {
    const html = await source(file);
    const fn = section(html, 'function updateSelectionBox(){', 'function updateSlideFrames');
    assert.match(fn, /selectionTrash[\s\S]{0,200}classList\.toggle\('show',\s*!!b\s*&&\s*state\.tool==='select'\s*&&\s*!state\.slides\.length\)/,
      `${file} toggles the trash button based on tool and selection`);
  }
});

test('trash click handler reuses deleteSelectedObject and stops pointerdown bubbling', async () => {
  for (const file of files) {
    const html = await source(file);
    const block = section(html, "const selectionTrash=document.getElementById('selectionTrash');",
      "board.addEventListener('contextmenu'");

    assert.match(block, /selectionTrash\.addEventListener\('click',\s*e=>\{[\s\S]*?if\(deleteSelectedObject\(\)\)/,
      `${file} calls deleteSelectedObject on click`);
    assert.match(block, /selectionTrash\.addEventListener\('pointerdown',\s*e=>e\.stopPropagation\(\)\)/,
      `${file} stops pointerdown so the trash tap does not deselect`);
  }
});

test('selection-trash implementation stays aligned between the creator and the pro template', async () => {
  const [a, b] = await Promise.all(files.map(source));
  const slice = html => [
    /#selectionTrash\{[^}]*\}/.exec(html)?.[0] || '',
    /#selectionTrash:hover,#selectionTrash:active\{[^}]*\}/.exec(html)?.[0] || '',
    /<button id="selectionTrash"[^>]*>/.exec(html)?.[0] || '',
    section(html, 'function updateSelectionBox(){', 'function updateSlideFrames'),
    section(html, "const selectionTrash=document.getElementById('selectionTrash');",
      "board.addEventListener('contextmenu'"),
  ].join('\n');
  assert.equal(slice(a), slice(b));
});
