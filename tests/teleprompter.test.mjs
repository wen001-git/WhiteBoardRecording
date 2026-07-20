import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

async function source(name) {
  return readFile(resolve(root, name), 'utf8');
}

test('teleprompter title bar is draggable and stays inside the viewport', async () => {
  for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.match(html, /#tele header\{[^}]*cursor:grab;[^}]*touch-action:none;/);
    assert.match(html, /teleHeader\.addEventListener\('pointerdown'/);
    assert.match(html, /window\.addEventListener\('pointermove'/);
    assert.match(html, /function clampTelePosition\(left,top\)/);
    assert.match(html, /window\.addEventListener\('resize',clampTeleToViewport\)/);
  }
});

test('opening the teleprompter keeps the slide picker visible on the right', async () => {
  for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.match(html, /\.slidesPanel\{left:auto;right:14px;top:128px;z-index:29;/);
    assert.match(html, /if\(panel\) panel\.style\.right='14px';/);
    assert.doesNotMatch(html, /tele\.style\.display==='flex'\) \? '350px'/);
  }
});

test('teleprompter text is restored and saved locally in both editions', async () => {
  for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.match(html, /const TELE_TEXT_STORAGE_KEY = 'wb_teleprompter_text_v1';/);
    assert.match(html, /localStorage\.getItem\(TELE_TEXT_STORAGE_KEY\)/);
    assert.match(html, /if\(savedTeleText!==null\) teleText\.value=savedTeleText;/);
    assert.match(html, /teleText\.addEventListener\('input'/);
    assert.match(html, /localStorage\.setItem\(TELE_TEXT_STORAGE_KEY,teleText\.value\)/);
  }
});
