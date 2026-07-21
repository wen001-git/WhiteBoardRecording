import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
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

test('both whiteboard variants expose the compact per-slide transition UI', async () => {
  for (const file of files) {
    const html = await source(file);
    const panel = between(html, '<!-- 幻灯片面板（右侧，常驻） -->', '<!-- 录制条 -->');
    assert.match(panel, /id="slideTransitionBtn"[^>]*aria-haspopup="dialog"/);
    assert.match(panel, /id="slideTransitionPopover"[^>]*role="dialog"/);
    assert.deepEqual(
      [...panel.matchAll(/data-slide-transition-type="([^"]+)"/g)].map(match => match[1]),
      ['none', 'fade', 'push', 'wipe'],
    );
    assert.deepEqual(
      [...panel.matchAll(/data-slide-transition-speed="([^"]+)"/g)].map(match => match[1]),
      ['fast', 'natural', 'gentle'],
    );
    assert.match(panel, /应用到全部幻灯片/);
    assert.match(html, /class="slideTransitionMark"/);
  }
});

test('transition schema normalizes old documents and persists in v4 history', async () => {
  for (const file of files) {
    const html = await source(file);
    const schema = between(html, 'const SLIDE_TRANSITION_TYPES=', 'function roundRect(');
    const context = {};
    vm.runInNewContext(`${schema};globalThis.result={normalizeSlideTransition,SLIDE_TRANSITION_SPEEDS};`, context);
    assert.deepEqual({ ...context.result.normalizeSlideTransition(null) }, { type: 'none', speed: 'natural' });
    assert.deepEqual({ ...context.result.normalizeSlideTransition({ type: 'bogus', speed: 'slow' }) }, { type: 'none', speed: 'natural' });
    assert.deepEqual({ ...context.result.normalizeSlideTransition({ type: 'push', speed: 'gentle' }) }, { type: 'push', speed: 'gentle' });
    assert.equal(context.result.SLIDE_TRANSITION_SPEEDS.fast.duration, 350);
    assert.equal(context.result.SLIDE_TRANSITION_SPEEDS.natural.duration, 600);
    assert.equal(context.result.SLIDE_TRANSITION_SPEEDS.gentle.duration, 900);

    assert.match(html, /const DOC_VERSION=4/);
    assert.match(html, /transition:normalizeSlideTransition\(s&&s\.transition\)/);
    assert.match(html, /slideTransitions:state\.slides\.map/);
    assert.match(html, /const transitions=new Map/);
    assert.match(html, /transition:normalizeSlideTransition\(null\)/);
  }
});

test('user navigation composites transitions into the board recording path', async () => {
  for (const file of files) {
    const html = await source(file);
    const rendering = between(html, 'function captureSlideTransitionSnapshot(', 'function isTextRevealObject(');
    const render = between(html, 'function render(opts={}){', 'function worldToScreen(');
    const select = between(html, 'function selectSlide(index,opts={}){', 'function addSlide(){');
    const controls = between(html, "const slideTransitionBtn=document.getElementById('slideTransitionBtn')", '/* ---- 取景框（setup 状态） ---- */');
    const recording = between(html, 'function drawRecFrame(){', 'function drawPlanWatermarks(');

    assert.match(rendering, /captureSlideTransitionSnapshot/);
    assert.match(rendering, /slideTransition\.type==='fade'/);
    assert.match(rendering, /slideTransition\.type==='push'/);
    assert.match(rendering, /slideTransition\.type==='wipe'/);
    assert.match(rendering, /direction:direction<0\?-1:1/);
    assert.match(select, /recState!=='paused'/);
    assert.match(select, /captureSlideTransitionSnapshot\(sourceSlide\)/);
    assert.match(select, /lastSlideTransitionSource=/);
    assert.match(select, /startSlideTransition\(s,sourceSnapshot,targetSnapshot,slideTransitionFor\(s\),direction\)/);
    assert.ok(render.indexOf('drawSlideRevealOverlay()') < render.indexOf('drawSlideTransitionOverlay()'));
    assert.match(recording, /recCtx\.drawImage\(board,/);
    assert.match(html, /selectSlide\(i,\{animate:true\}\)/);
    assert.match(html, /cur\+dir\)\),\{animate:true\}\)/);
    assert.match(controls, /pushHistory\(\);\s*slide\.transition=normalized/);
    assert.match(controls, /pushHistory\(\);\s*state\.slides\.forEach/);
    assert.doesNotMatch(controls, /requirePro/);
  }
});

test('transition implementation stays aligned between both whiteboard variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const panel = html => between(html, '<!-- 幻灯片面板（右侧，常驻） -->', '<!-- 录制条 -->');
  const rendering = html => between(html, 'const SLIDE_TRANSITION_TYPES=', 'function isTextRevealObject(');
  const select = html => between(html, 'function selectSlide(index,opts={}){', 'function addSlide(){');
  const controls = html => between(html, "const slideTransitionBtn=document.getElementById('slideTransitionBtn')", '/* ---- 取景框（setup 状态） ---- */');

  assert.equal(panel(privateApp), panel(commercialTemplate));
  assert.equal(rendering(privateApp), rendering(commercialTemplate));
  assert.equal(select(privateApp), select(commercialTemplate));
  assert.equal(controls(privateApp), controls(commercialTemplate));
});
