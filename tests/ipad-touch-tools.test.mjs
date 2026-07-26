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

test('board pointerdown on touch lets the text tool bypass preventDefault but blocks it for draw tools', async () => {
  for (const file of files) {
    const html = await source(file);
    const handler = section(html, 'board.addEventListener(\'pointerdown\', (e)=>{', 'board.addEventListener(\'pointermove\'');

    // 文字工具触屏不应该 preventDefault（让 Safari 合成 click，给 contenteditable 焦点）
    assert.match(handler, /if\(e\.pointerType==='touch'\)[\s\S]*if\(state\.tool!=='text'\) e\.preventDefault\(\)/,
      `${file} keeps text-tool touch events without preventDefault`);

    // 捏合 / 触点分支应该跳过文本工具，让触屏文本点击进入 openTextInput
    assert.match(handler, /state\.tool!=='text' && canvasTouchPoints\.size===1\) captureCanvasTouchBaseline\(/,
      `${file} skips pinch baseline for text tool`);
    assert.match(handler, /state\.tool!=='text' && canvasTouchPoints\.size>=2\)[\s\S]*beginCanvasPinchGesture\(true\)/,
      `${file} skips pinch activation for text tool`);
  }
});

test('openTextInput triggers an extra click + caret for iPad Safari', async () => {
  for (const file of files) {
    const html = await source(file);
    const fn = section(html, 'function openTextInput(', '\n}');

    assert.match(fn, /textInput\.click\(\)/,
      `${file} calls textInput.click() to nudge Safari touch focus`);
    assert.match(fn, /placeTextCaretEnd\(\)[\s\S]{0,200}textInput\.click\(\)[\s\S]{0,200}placeTextCaretEnd\(\)/,
      `${file} repeats placeTextCaretEnd around the click() call`);
  }
});

test('endAction accepts tap-sized shapes on touch screens with an 8px floor', async () => {
  for (const file of files) {
    const html = await source(file);
    const fn = section(html, 'function endAction(', '\n}\nboard.addEventListener(\'pointerup\'');

    // 不再用 2px 硬阈值；应该引用 minScreen，按 state.view.scale 换算
    assert.doesNotMatch(fn, /Math\.hypot\(draft\.x2-draft\.x1,draft\.y2-draft\.y1\)>2/,
      `${file} no longer uses the 2px arrow/line floor`);
    assert.doesNotMatch(fn, /Math\.abs\(draft\.w\)>2 && Math\.abs\(draft\.h\)>2/,
      `${file} no longer uses the 2px shape floor`);
    assert.match(fn, /minScreen\s*=\s*Math\.max\(8/,
      `${file} enforces an 8 screen-pixel floor for shapes`);
    assert.match(fn, /state\.view\.scale\s*\|\|\s*1/,
      `${file} reads state.view.scale with a 1 fallback`);
    // 过小形状要以 (x,y) 为锚放大到最小尺寸，而不是简单丢弃
    assert.match(fn, /draft\.w\s*=\s*px\*dirX/, `${file} expands too-small shapes to the floor`);
  }
});

test('ipad-touch fixes stay aligned between the creator and the pro template', async () => {
  const [a, b] = await Promise.all(files.map(source));
  const slice = html => [
    section(html, 'board.addEventListener(\'pointerdown\', (e)=>{', 'board.addEventListener(\'pointermove\''),
    section(html, 'function openTextInput(', '\n}\n'),
    section(html, 'function endAction(', '\n}\nboard.addEventListener(\'pointerup\''),
  ].join('\n');
  assert.equal(slice(a), slice(b));
});
