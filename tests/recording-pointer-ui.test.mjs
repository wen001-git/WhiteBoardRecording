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

test('recording controls share one compact framed container', async () => {
  for (const file of files) {
    const html = await source(file);
    const controls = between(html, '<div class="recbar" id="recBar">', '</div>');

    for (const id of [
      'recSettings', 'mediaToggle', 'teleToggle', 'recPointerToggle', 'timer',
      'recStart', 'recCancel', 'recGo', 'recPause', 'recStop', 'selfCheckBtn',
    ]) {
      assert.match(controls, new RegExp(`id="${id}"`), `${file} is missing ${id} in recBar`);
    }
    assert.match(html, /\.recbar\{[^}]*background:rgba\(255,255,255,\.94\)[^}]*border:1px solid var\(--line\)[^}]*border-radius:18px;/);
    assert.match(html, /\['toolbar','recBar'\]/);
    assert.doesNotMatch(html, /class="topright"/);
  }
});

test('board recording laser is visible live and composited with shared state and bounds', async () => {
  for (const file of files) {
    const html = await source(file);
    const boardRecording = between(html, 'function drawRecFrame(){', 'function drawPlanWatermarks(');
    const pointerFeature = between(html, 'function pointInRecordingFrame(', "const WATERMARK_STORAGE_KEY=");

    assert.match(html, /id="recordingLaserPointer"/);
    assert.match(html, /<div class="set-label">激光笔<\/div>/);
    assert.match(pointerFeature, /recConfig\.source==='board'/);
    assert.match(pointerFeature, /recState==='recording'\|\|recState==='paused'/);
    assert.match(pointerFeature, /recConfig\.cursorHighlight/);
    assert.match(pointerFeature, /pointInRecordingFrame\(recPointer\)/);
    assert.match(pointerFeature, /setBoardLaserEnabled/);
    assert.match(boardRecording, /pointInRecordingFrame\(recPointer,f\)/);
    assert.match(boardRecording, /recConfig\.cursorColor/);
    assert.match(html, /pointerToggle\.classList\.remove\('hidden'\)/);
    assert.match(html, /document\.getElementById\('recPointerToggle'\)\.onclick=toggleRecordingPointer/);
  }
});

test('screen recording cursor control is capability-gated and never adds a second laser', async () => {
  for (const file of files) {
    const html = await source(file);
    const screenControl = between(html, 'let screenCursorTrack=null', '/* ---- 「自检」画中画');
    const screenRecording = between(html, 'function drawScreenFrame(src){', 'function startCamPump(){');

    assert.match(screenControl, /track\.getCapabilities\(\)/);
    assert.match(screenControl, /modes\.includes\('never'\)/);
    assert.match(screenControl, /screenCursorVisibleMode/);
    assert.match(screenControl, /applyConstraints\(\{cursor:target\}\)/);
    assert.match(screenControl, /screenCursorTrack\.getSettings\(\)\.cursor/);
    assert.match(screenControl, /浏览器未能切换录屏光标，录制将继续/);
    assert.match(html, /initScreenCursorControl\(vtrack,settings\)/);
    assert.match(html, /resetScreenCursorControl\(\)/);
    assert.doesNotMatch(screenRecording, /recordingLaserPointer|cursorHighlight|pointInRecordingFrame/);
  }
});

test('recording pointer implementation stays aligned between both whiteboard variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const liveFeature = html => between(html, 'function pointInRecordingFrame(', "const WATERMARK_STORAGE_KEY=");
  const screenFeature = html => between(html, 'let screenCursorTrack=null', '/* ---- 「自检」画中画');
  const controls = html => between(html, '<div class="recbar" id="recBar">', '</div>');

  assert.equal(liveFeature(privateApp), liveFeature(commercialTemplate));
  assert.equal(screenFeature(privateApp), screenFeature(commercialTemplate));
  assert.equal(controls(privateApp), controls(commercialTemplate));
});
