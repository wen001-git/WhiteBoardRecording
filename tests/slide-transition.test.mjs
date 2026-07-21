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
    assert.deepEqual(
      [...between(panel, '<select id="slideTransitionSound"', '</select>').matchAll(/value="([^"]+)"/g)].map(match => match[1]),
      ['none', 'page', 'swish', 'soft'],
    );
    assert.match(panel, /id="slideTransitionSoundPreview"[^>]*disabled/);
    assert.match(panel, /id="slideTransitionVolume"[^>]*min="0"[^>]*max="100"[^>]*value="60"/);
    assert.match(panel, /应用到全部幻灯片/);
    assert.match(html, /class="slideTransitionMark"/);
  }
});

test('transition schema normalizes old documents and persists sound settings in v5 history', async () => {
  for (const file of files) {
    const html = await source(file);
    const schema = between(html, 'const SLIDE_TRANSITION_TYPES=', 'function roundRect(');
    const context = {};
    vm.runInNewContext(`${schema};globalThis.result={normalizeSlideTransition,SLIDE_TRANSITION_SPEEDS,SLIDE_TRANSITION_SOUNDS};`, context);
    assert.deepEqual({ ...context.result.normalizeSlideTransition(null) }, { type: 'none', speed: 'natural', sound: 'none', volume: .6 });
    assert.deepEqual({ ...context.result.normalizeSlideTransition({ type: 'bogus', speed: 'slow', sound: 'loud', volume: 'bad' }) }, { type: 'none', speed: 'natural', sound: 'none', volume: .6 });
    assert.deepEqual({ ...context.result.normalizeSlideTransition({ type: 'push', speed: 'gentle', sound: 'page', volume: .75 }) }, { type: 'push', speed: 'gentle', sound: 'page', volume: .75 });
    assert.equal(context.result.normalizeSlideTransition({ sound: 'soft', volume: 2 }).volume, 1);
    assert.equal(context.result.normalizeSlideTransition({ sound: 'swish', volume: -1 }).volume, 0);
    assert.equal(context.result.SLIDE_TRANSITION_SPEEDS.fast.duration, 350);
    assert.equal(context.result.SLIDE_TRANSITION_SPEEDS.natural.duration, 600);
    assert.equal(context.result.SLIDE_TRANSITION_SPEEDS.gentle.duration, 900);
    assert.deepEqual(Object.keys(context.result.SLIDE_TRANSITION_SOUNDS), ['none', 'page', 'swish', 'soft']);

    assert.match(html, /const DOC_VERSION=5/);
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
    assert.match(select, /const transitionSetting=slideTransitionFor\(s\)/);
    assert.match(select, /startSlideTransition\(s,sourceSnapshot,targetSnapshot,transitionSetting,direction\)/);
    assert.match(select, /playSlideTransitionSound\(transitionSetting\)/);
    assert.match(select, /stopSlideTransitionSound\(\)/);
    assert.ok(render.indexOf('drawSlideRevealOverlay()') < render.indexOf('drawSlideTransitionOverlay()'));
    assert.match(recording, /recCtx\.drawImage\(board,/);
    assert.match(html, /selectSlide\(i,\{animate:true\}\)/);
    assert.match(html, /cur\+dir\)\),\{animate:true\}\)/);
    assert.match(controls, /pushHistory\(\);\s*slide\.transition=normalized/);
    assert.match(controls, /pushHistory\(\);\s*state\.slides\.forEach/);
    assert.doesNotMatch(controls, /requirePro/);
  }
});

test('built-in transition sounds fade on interruption and enter the recording mix', async () => {
  for (const file of files) {
    const html = await source(file);
    const sounds = between(html, 'let transitionPreviewAudioCtx=null;', 'function roundRect(');
    const controls = between(html, "const slideTransitionBtn=document.getElementById('slideTransitionBtn')", '/* ---- 取景框（setup 状态） ---- */');
    const recording = between(html, 'async function buildRecordingAudioTracks(', 'function onRecStop()');

    assert.match(sounds, /linearRampToValueAtTime\(0,now\+\.04\)/);
    assert.match(sounds, /recState==='recording'&&audioCtx&&recordingAudioDestination/);
    assert.match(sounds, /outputs:\[audioCtx\.destination,recordingAudioDestination\]/);
    assert.match(sounds, /createBufferSource\(\)/);
    assert.match(sounds, /createOscillator\(\)/);
    assert.match(controls, /slideTransitionSoundSelect\?\.addEventListener\('change'/);
    assert.match(controls, /slideTransitionSoundPreview\?\.addEventListener\('click'/);
    assert.match(controls, /slideTransitionVolume\?\.addEventListener\('change'/);
    assert.match(controls, /current\.sound!==setting\.sound\|\|current\.volume!==setting\.volume/);
    assert.match(recording, /createMediaStreamDestination\(\)/);
    assert.match(recording, /async function buildBoardAudioTracks\(\)/);
    assert.match(recording, /const audioTracks = await buildBoardAudioTracks\(\)/);
    assert.match(recording, /stopSlideTransitionSound\(\)/);
    assert.match(recording, /recordingAudioDestination=null/);
    assert.doesNotMatch(html, /<audio[^>]+(?:page|swish|soft)/i);
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
