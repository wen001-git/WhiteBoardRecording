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

// 跟普通的 section 不同：@-规则 / 嵌套 if 块之间有内部 `}`，取 anchor 后 800 字符窗口里做 grep
function window(html, anchor, size = 800) {
  const from = html.indexOf(anchor);
  assert.notEqual(from, -1, `missing window anchor: ${anchor}`);
  return html.slice(from, from + size);
}

test('toolbar uses a coarse-pointer media query to flatten the compact tool groups', async () => {
  for (const file of files) {
    const html = await source(file);
    // @media (pointer:coarse) 块的 `}` 在内部多次出现，取 1000 字符窗口确保覆盖整个块
    const coarse = window(html, '@media (pointer:coarse){', 1000);
    assert.match(coarse, /\.toolbar\s+\.compact-tool-trigger\{display:none\s*!important/,
      `${file} hides compact tool triggers on coarse pointers`);
    assert.match(coarse, /\.toolbar\s+\.compact-tool-group,\s*\.toolbar\s+\.compact-tool-menu\{display:contents\s*!important/,
      `${file} flattens compact groups back into the toolbar on coarse pointers`);
    assert.match(coarse, /\.toolbar\.compact-mode\s+\.compact-tool-menu\{position:static\s*!important/,
      `${file} drops the popup floating positioning on coarse pointers`);
    assert.match(coarse, /\.compact-tool-trigger\s+\.chev\{display:none/,
      `${file} hides the chevron indicator when the trigger itself is hidden`);
  }
});

test('compact tool triggers show a chevron indicator on non-coarse pointers', async () => {
  for (const file of files) {
    const html = await source(file);
    assert.match(html, /\.compact-tool-trigger \.chev\{position:absolute;right:3px;bottom:3px;/,
      `${file} anchors the chevron to the compact trigger's bottom-right`);
    assert.match(html, /id="shapeToolTrigger"[^>]*title="形状工具 ▾"/,
      `${file} updates the shape trigger title with a hint`);
    assert.match(html, /id="assetToolTrigger"[^>]*title="图片与贴纸 ▾"/,
      `${file} updates the asset trigger title with a hint`);
    assert.match(html, /id="moreToolTrigger"[^>]*title="更多工具 ▾"/,
      `${file} updates the more trigger title with a hint`);
  }
});

test('synthesizeClickForTouch forwards touch pointerdowns to a synthetic click', async () => {
  for (const file of files) {
    const html = await source(file);
    const helpers = section(html, 'function synthesizeClickForTouch(', 'function applyTouchClickFallback(');
    assert.match(helpers, /e\.pointerType!=='touch'/,
      `${file} bails on non-touch pointer events`);
    assert.match(helpers, /e\._touchClickHandled=true/,
      `${file} guards duplicate synthetic clicks`);
    assert.match(helpers, /target\.click\(\)/,
      `${file} dispatches a native click() on the original target`);
  }
});

test('touch click fallback is wired to tool buttons, compact triggers and the trash', async () => {
  for (const file of files) {
    const html = await source(file);

    assert.match(html, /applyTouchClickFallback\(trigger\);[\s\S]{0,80}trigger\?\.addEventListener\('keydown'/,
      `${file} forwards touch clicks on compact triggers`);

    assert.match(html, /document\.querySelectorAll\('\.tool\[data-tool\]'\)\.forEach\(btn=>\{[\s\S]*?applyTouchClickFallback\(btn\);[\s\S]*?\}\);/,
      `${file} forwards touch clicks on every data-tool button`);

    const trash = window(html, "if(selectionTrash){", 600);
    assert.match(trash, /applyTouchClickFallback\(selectionTrash\)/,
      `${file} forwards touch clicks on the floating selection trash`);
  }
});

test('coarse-toolbar changes stay byte-aligned between the creator and the pro template', async () => {
  const [a, b] = await Promise.all(files.map(source));
  const slice = html => [
    window(html, '@media (pointer:coarse){', 1000),
    /\.compact-tool-trigger \.chev\{position:absolute[^}]*\}/.exec(html)?.[0] || '',
    section(html, 'function synthesizeClickForTouch(', 'function applyTouchClickFallback('),
  ].join('\n');
  assert.equal(slice(a), slice(b));
});
