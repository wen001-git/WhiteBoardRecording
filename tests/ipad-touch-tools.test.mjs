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

test('endAction creates shapes from a zero-distance iPad tap and from a small drag', async () => {
  for (const file of files) {
    const html = await source(file);
    const fn = section(html, 'function endAction(', '\n}\nboard.addEventListener(\'pointerup\'');

    // 桌面保留 2px 阈值；触屏切换成单独的 minScreen 分支
    assert.match(fn, /isTouch\s*=\s*!!\(e && e\.pointerType==='touch'\)/,
      `${file} derives isTouch from the pointer event`);
    assert.match(fn, /isTouch \? Math\.max\(8, 8\/\(state\.view\.scale\|\|1\)\) : 2/,
      `${file} keeps a 2px desktop floor and an 8 screen-pixel touch floor`);
    // 触屏箭头 / 直线零长度视为有效（生成默认长度的水平线）
    assert.match(fn, /len===0 && isTouch/,
      `${file} accepts a zero-length touch tap for arrow and line`);
    // 过小形状扩展到最小尺寸时以 start 为中心，而不是按原 draft.x/.y 留下空锚
    assert.match(fn, /start\.x - px\/2/,
      `${file} centers auto-sized shapes on the tap point`);
    assert.doesNotMatch(fn, /Math\.hypot\(draft\.x2-draft\.x1,draft\.y2-draft\.y1\)>2/,
      `${file} no longer uses the 2px arrow/line floor`);
    assert.doesNotMatch(fn, /Math\.abs\(draft\.w\)>2 && Math\.abs\(draft\.h\)>2/,
      `${file} no longer uses the 2px shape floor`);
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
