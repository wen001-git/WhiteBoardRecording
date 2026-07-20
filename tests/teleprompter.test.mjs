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

test('teleprompter document state is exported, restored and reset without transient UI state', async () => {
  for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.match(html, /const DOC_VERSION=3/);
    assert.match(html, /teleprompter:currentTeleprompter\(\)/);
    assert.match(html, /return \{text:teleText\.value,speed:teleSpeed,fontSize:Number\(teleFontInput\.value\)\}/);
    assert.match(html, /applyTeleprompter\(doc\.teleprompter\)/);
    assert.match(html, /if\(value===null\|\|value===undefined\|\|value===''\) return fallback;/);
    assert.match(html, /teleSpeed=clampTeleSetting\(saved&&saved\.speed,10,120,TELE_DEFAULT_SPEED\)/);
    assert.match(html, /clampTeleSetting\(saved&&saved\.fontSize,16,44,TELE_DEFAULT_FONT_SIZE\)/);
    assert.match(html, /stopTele\(\);[\s\S]*teleScroll\.scrollTop=0;[\s\S]*teleScroll\.style\.display='none';[\s\S]*teleText\.style\.display='block';/);
    assert.match(html, /teleText\.addEventListener\('input',[\s\S]*scheduleSave\(\)/);
    assert.match(html, /teleSpeedInput\.oninput = \(e\)=>\{ teleSpeed=\+e\.target\.value; if\(autoloadDone\) scheduleSave\(\); \}/);
    assert.match(html, /teleFontInput\.oninput = \(e\)=>\{ teleScroll\.style\.fontSize=e\.target\.value\+'px'; if\(autoloadDone\) scheduleSave\(\); \}/);
    assert.match(html, /state\.canvasBackground=DEFAULT_CANVAS_BACKGROUND; applyTeleprompter\(null\);/);

    const serialized = html.match(/function currentTeleprompter\(\)\{([\s\S]*?)\n\}/)?.[1] || '';
    assert.doesNotMatch(serialized, /display|scroll|position|playing|left|top/);
  }
});
