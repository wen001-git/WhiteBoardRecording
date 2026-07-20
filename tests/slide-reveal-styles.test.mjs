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

test('both whiteboard variants expose one split control with three new presets and the legacy diagonal sweep', async () => {
  for (const file of files) {
    const html = await source(file);
    const controls = between(html, '<div id="slideRevealControl"', '<!-- 顶部工具栏 -->');

    assert.match(controls, /id="slideRevealFloatBtn"/);
    assert.match(controls, /id="slideRevealMenuBtn"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"/);
    assert.match(controls, /id="slideRevealPopover"[^>]*role="menu"/);
    assert.deepEqual(
      [...controls.matchAll(/data-slide-reveal-style="([^"]+)"/g)].map(match => match[1]),
      ['pencil', 'ink', 'diagonal', 'legacy'],
    );
    for (const label of ['彩铅铺色', '水墨晕染', '铅笔描绘', '斜线推进']) assert.match(controls, new RegExp(label));
    assert.doesNotMatch(controls, /data-slide-reveal-style="(?:stroke|left)"/);
  }
});

test('reveal presets use a color-aware outline followed by a separate color phase', async () => {
  for (const file of files) {
    const html = await source(file);
    const reveal = between(html, 'function revealClamp', 'function clearSelection');
    const outline = between(html, 'function makeOutlineCanvasFromSnapshot', 'function buildSlideRevealCache');
    const interaction = between(html, "const slideRevealFloatBtn=document.getElementById('slideRevealFloatBtn')", "document.getElementById('lockBtn').onclick");
    const render = between(html, 'function render(opts={}){', 'function worldToScreen(');
    const recording = between(html, 'function drawRecFrame(){', 'function drawPlanWatermarks(');

    assert.match(html, /const SLIDE_REVEAL_STYLE_KEY='wb_slide_reveal_style'/);
    assert.match(html, /localStorage\.getItem\(SLIDE_REVEAL_STYLE_KEY\)/);
    assert.match(interaction, /localStorage\.setItem\(SLIDE_REVEAL_STYLE_KEY,slideRevealStyle\)/);
    assert.match(html, /prefers-reduced-motion: reduce/);
    assert.match(reveal, /duration:4400/);
    assert.match(reveal, /revealSeeded\(0x4a6f7921\)/);
    assert.match(reveal, /revealSeeded\(0x7f4a7c15\)/);
    assert.match(reveal, /drawRevealPencilMask/);
    assert.match(reveal, /drawRevealWatercolorMask/);
    assert.match(reveal, /drawRevealActivationMask/);
    assert.match(reveal, /composeSlideRevealLayer/);
    assert.match(reveal, /function clipDiagonalReveal/);
    assert.match(reveal, /function drawSlideRevealBand/);
    assert.match(reveal, /style==='legacy'/);
    assert.match(reveal, /function makeOutlineCanvasFromSnapshot/);
    assert.doesNotMatch(reveal, /function makeInkCanvasFromSnapshot/);
    assert.match(reveal, /const maxPixels=2400000/);
    assert.match(reveal, /const neutrality=1-revealSmoothstep\(12,38,chroma\)/);
    assert.match(reveal, /revealSmoothstep\(42,180,Math\.hypot\(gx,gy\)\)/);
    assert.match(reveal, /revealSmoothstep\(55,180,rgbEdge\)/);
    assert.match(reveal, /backgroundNeighbor,1-revealSmoothstep\(12,32,neighborDistance\)/);
    assert.match(reveal, /const deepInk=lightInk/);
    assert.match(reveal, /const maxInkAlpha=235/);
    assert.match(reveal, /const inkPresence=Math\.max\(neutrality\*inkTone,deepInk\)/);
    assert.match(reveal, /neighborInkPresence=Math\.max\(neighborInkPresence,neighborNeutrality\*neighborInkTone,neighborDeepInk\)/);
    assert.match(reveal, /const inkEdgeBlock=revealSmoothstep\(\.015,\.06,neighborInkPresence\)/);
    assert.match(reveal, /const structuralGate=content\*backgroundNeighbor\*\(1-inkEdgeBlock\)/);
    assert.match(reveal, /\{r:12,g:12,b:14\}/);
    assert.match(reveal, /\{r:244,g:244,b:246\}/);
    assert.match(reveal, /const a=Math\.max\(neutralAlpha\[p\],edgeAlpha\[p\]\)/);
    assert.doesNotMatch(outline, /const radius=|expanded=edgeAlpha|falloff=/);
    assert.match(reveal, /outline:makeOutlineCanvasFromSnapshot\(color,bg\)/);
    assert.match(reveal, /const outlineProgress=revealClamp\(progress\/\.34\)/);
    assert.match(reveal, /const colorPhase=revealClamp\(\(progress-\.34\)\/\.66\)/);
    assert.match(reveal, /const colorProgress=Math\.pow\(colorPhase,\.62\)/);
    assert.match(reveal, /colorProgress>0&&clipDiagonalReveal/);
    assert.match(reveal, /slideRevealCache\.outline/);
    assert.doesNotMatch(reveal, /duration:5200|progress\/\.38|\(progress-\.38\)\/\.62|Math\.pow\(colorPhase,\.68\)/);
    assert.match(reveal, /ctx\.globalAlpha=\.96/);
    assert.doesNotMatch(reveal, /drawPencilCue/);
    assert.match(interaction, /selectSlideRevealStyle\(option\.dataset\.slideRevealStyle,true\)/);
    assert.ok(render.indexOf('drawObject(state.scene[i])') < render.indexOf('drawSlideRevealOverlay()'));
    assert.match(recording, /recCtx\.drawImage\(board,/);
  }
});

test('slide reveal UI and rendering implementation stay aligned between both variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const controls = html => between(html, '<div id="slideRevealControl"', '<!-- 顶部工具栏 -->');
  const reveal = html => between(html, 'function revealClamp', 'function clearSelection');
  const interaction = html => between(html, "const slideRevealFloatBtn=document.getElementById('slideRevealFloatBtn')", "document.getElementById('lockBtn').onclick");

  assert.equal(controls(privateApp), controls(commercialTemplate));
  assert.equal(reveal(privateApp), reveal(commercialTemplate));
  assert.equal(interaction(privateApp), interaction(commercialTemplate));
});
