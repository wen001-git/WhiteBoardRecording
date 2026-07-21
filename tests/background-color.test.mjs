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

test('both whiteboard variants expose the canvas background popover', async () => {
  for (const file of files) {
    const html = await source(file);
    const controls = between(
      html,
      '<div class="canvas-bg-popover" id="canvasBgPopover"',
      '<!-- 右上角：提词器开关 -->',
    );

    assert.match(html, /id="canvasBgBtn"[^>]*aria-expanded="false"/);
    assert.equal((controls.match(/data-canvas-bg="#[0-9a-f]{6}"/g) || []).length, 5);
    for (const color of ['#ffffff', '#f8f9fa', '#f5faff', '#fffce8', '#fdf8f6']) {
      assert.match(controls, new RegExp(`data-canvas-bg="${color}"`));
    }
    assert.match(controls, /data-canvas-bg-scope="global"/);
    assert.match(controls, /data-canvas-bg-scope="slide"/);
    assert.match(controls, /id="canvasBgPicker"[^>]*type="color"/);
    assert.match(controls, /id="canvasBgHex"[^>]*maxlength="7"/);
    assert.match(controls, /id="canvasBgInherit"/);
    assert.match(controls, /id="canvasBgWarning"/);
  }
});

test('canvas background data is normalized, inherited, saved and undoable', async () => {
  for (const file of files) {
    const html = await source(file);
    const behavior = between(
      html,
      '/* ----------------------- 画布背景颜色 ---------------------------------- */',
      '/* ---------------- 存档：自动保存(IndexedDB，回退 localStorage) + 导出/导入 .json ---------------- */',
    );

    assert.match(html, /const DEFAULT_CANVAS_BACKGROUND='#ffffff'/);
    assert.match(html, /function normalizeCanvasColor\(value,fallback=null\)/);
    assert.match(html, /canvasBackground: DEFAULT_CANVAS_BACKGROUND/);
    assert.match(html, /function effectiveSlideBackground\(slide\)/);
    assert.match(html, /backgroundColor:null/);
    assert.match(behavior, /function applyCanvasBackgroundColor\(value\)/);
    assert.match(behavior, /canvasBgGesturePushed/);
    assert.match(behavior, /pushHistory\(\)/);
    assert.match(behavior, /slide\.backgroundColor=null/);
    assert.match(behavior, /canvasColorContrast\(state\.color,current\)<3/);
    assert.doesNotMatch(behavior, /state\.color\s*=/);
    assert.match(html, /const DOC_VERSION=4/);
    assert.match(html, /canvasBackground:state\.canvasBackground/);
    assert.match(html, /normalizeCanvasColor\(doc\.canvasBackground,DEFAULT_CANVAS_BACKGROUND\)/);
    assert.match(html, /backgroundColor:normalizeCanvasColor\(s&&s\.backgroundColor,null\)/);
    assert.match(html, /slideBackgrounds:state\.slides\.map/);
    assert.match(html, /restoreSnapshot\(state\.undoStack\.pop\(\)\)/);
  }
});

test('rendering, minimap, reveal and recording preview share the effective background', async () => {
  for (const file of files) {
    const html = await source(file);
    const render = between(html, 'function render(opts={}){', 'function worldToScreen(');
    assert.ok(render.indexOf('clearBg()') < render.indexOf('drawSlideBackgrounds()'));
    assert.ok(render.indexOf('drawSlideBackgrounds()') < render.indexOf('drawObject(state.scene[i])'));

    const minimap = between(html, 'function updateMinimap(){', 'if(minimapToggle){');
    assert.match(minimap, /c\.fillStyle=state\.canvasBackground/);
    assert.match(minimap, /c\.fillStyle=effectiveSlideBackground\(s\)/);

    const reveal = between(html, 'function makeOutlineCanvasFromSnapshot(', 'function clearSelection(){');
    assert.match(reveal, /const bg=canvasColorRgb\(bgColor\)/);
    assert.match(reveal, /revealSmoothstep\(18,70,distance\)/);
    assert.match(reveal, /effectiveSlideBackground\(slide\)/);

    const recording = between(html, 'function drawRecFrame(){', 'function drawPlanWatermarks(');
    assert.match(recording, /paintBackground\(recCtx,W,H,bg\)/);
    assert.match(recording, /recCtx\.drawImage\(board,/);
    assert.match(html, /card\.style\.background=isScreen\?'#ffffff':activeCanvasBackground\(\)/);
  }
});

test('canvas background implementation stays aligned between both variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const controls = html => between(
    html,
    '<div class="canvas-bg-popover" id="canvasBgPopover"',
    '<!-- 右上角：提词器开关 -->',
  );
  const behavior = html => between(
    html,
    '/* ----------------------- 画布背景颜色 ---------------------------------- */',
    '/* ---------------- 存档：自动保存(IndexedDB，回退 localStorage) + 导出/导入 .json ---------------- */',
  );

  assert.equal(controls(privateApp), controls(commercialTemplate));
  assert.equal(behavior(privateApp), behavior(commercialTemplate));
});
