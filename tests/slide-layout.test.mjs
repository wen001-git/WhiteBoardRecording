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

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: expected ${expected}, got ${actual}`);
}

function runResize(html, slides, scene, ratio) {
  const owner = between(html, 'function slideIndexForObject(', 'function shiftSlidesAndContents(');
  const resize = between(html, 'function resizeSlidesToRatio(){', 'function updateSlideRatioButton(){');
  const context = {
    state: {
      slides: slides.map(slide => ({ ...slide })),
      scene: scene.map(object => ({ ...object })),
      activeSlide: -1,
    },
    SLIDE_GAP: 80,
    ratioVal: () => ratio,
    transformBounds: () => null,
    objectBounds: object => object,
    rectCenterPoint: rect => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }),
    rectContainsPoint: (rect, point, pad = 0) => (
      point.x >= rect.x - pad && point.x <= rect.x + rect.w + pad
      && point.y >= rect.y - pad && point.y <= rect.y + rect.h + pad
    ),
    translateObject: (object, dx, dy) => { object.x += dx; object.y += dy; },
    selectSlide: () => {},
    render: () => {},
  };
  vm.runInNewContext(`${owner}\n${resize}\nresizeSlidesToRatio();`, context);
  return JSON.parse(JSON.stringify(context.state));
}

function runSmartSlideCreation(html, slides, activeSlide) {
  const creation = between(html, 'function slideFromViewportCenter(', 'function rectCenterPoint(');
  const context = {
    state: { slides: slides.map(slide => ({ ...slide })), activeSlide },
    commitText: () => {},
    getRatioConfig: () => ({ w: 900, h: 1200 }),
    viewportOverlapsActiveSlide: () => true,
    findFreeSlideSlot: (active, size) => ({ w: size.w, h: size.h }),
    toWorld: () => ({ x: 0, y: 0 }),
    window: { innerWidth: 1000, innerHeight: 800 },
    slideId: () => 'new',
    normalizeSlideTransition: value => value,
    defaultSlideRevealSetting: () => ({}),
  };
  vm.runInNewContext(`${creation}\nresult=createSlideAtSmartPosition();`, context);
  return JSON.parse(JSON.stringify(context.result));
}

function runRatioSync(html, slide) {
  const sync = between(html, 'function syncRecordingRatioToSlide(', 'function applyRatioChange(){');
  const context = {
    RATIOS: {
      '16:9': { w: 1280, h: 720 },
      '4:3': { w: 1024, h: 768 },
      '3:4': { w: 960, h: 1280 },
      '9:16': { w: 720, h: 1280 },
      '1:1': { w: 1000, h: 1000 },
    },
    recConfig: { ratio: '16:9', customW: 1080, customH: 1920 },
  };
  vm.runInNewContext(`${sync}\nchanged=syncRecordingRatioToSlide(slide);`, {
    ...context,
    slide,
  });
  return context;
}

test('restored slides drive the shared slide and recording ratio controls', async () => {
  for (const file of files) {
    const html = await source(file);
    const preset = runRatioSync(html, { w: 960, h: 1280 });
    assert.equal(preset.recConfig.ratio, '3:4', `${file} restores the 3:4 preset`);

    const custom = runRatioSync(html, { w: 900, h: 1100 });
    assert.equal(custom.recConfig.ratio, 'custom', `${file} restores a custom ratio`);
    assert.equal(custom.recConfig.customW, 900);
    assert.equal(custom.recConfig.customH, 1100);

    const applyDoc = between(html, 'function applyDoc(doc){', 'async function loadAutosave(){');
    const selectSlide = between(html, 'function selectSlide(index,opts={}){', 'function addSlide(){');
    assert.match(applyDoc, /syncRecordingRatioToSlide\(state\.slides\[state\.activeSlide\]\)/);
    assert.match(selectSlide, /syncRecordingRatioToSlide\(s\)/);
  }
});

test('ratio expansion reflows every later slide and carries its contents', async () => {
  for (const file of files) {
    const html = await source(file);
    const oldSlides = [
      { id: 'one', x: 0, y: 20, w: 720, h: 1280 },
      { id: 'two', x: 800, y: 35, w: 720, h: 1280 },
      { id: 'three', x: 1600, y: 50, w: 720, h: 1280 },
    ];
    const oldScene = [
      { type: 'rect', x: 100, y: 100, w: 100, h: 100 },
      { type: 'rect', x: 900, y: 100, w: 100, h: 100 },
      { type: 'rect', x: 1700, y: 100, w: 100, h: 100 },
      { type: 'rect', x: 5000, y: 100, w: 100, h: 100 },
    ];
    const result = runResize(html, oldSlides, oldScene, 4 / 3);
    const [first, second, third] = result.slides;

    closeTo(first.x + first.w / 2, 360, `${file} keeps the first slide center`);
    assert.equal(first.y, 20);
    assert.equal(second.y, 35);
    assert.equal(third.y, 50);
    closeTo(second.x - (first.x + first.w), 80, `${file} spaces slides one and two`);
    closeTo(third.x - (second.x + second.w), 80, `${file} spaces slides two and three`);

    const secondShift = (second.x + second.w / 2) - (oldSlides[1].x + oldSlides[1].w / 2);
    const thirdShift = (third.x + third.w / 2) - (oldSlides[2].x + oldSlides[2].w / 2);
    closeTo(result.scene[0].x, oldScene[0].x, `${file} leaves first-slide content anchored`);
    closeTo(result.scene[1].x, oldScene[1].x + secondShift, `${file} moves second-slide content`);
    closeTo(result.scene[2].x, oldScene[2].x + thirdShift, `${file} moves third-slide content`);
    closeTo(result.scene[3].x, oldScene[3].x, `${file} leaves free objects in place`);
  }
});

test('ratio contraction closes large gaps while preserving slide order', async () => {
  for (const file of files) {
    const html = await source(file);
    const result = runResize(html, [
      { id: 'one', x: 0, y: 0, w: 1024, h: 768 },
      { id: 'two', x: 1104, y: 0, w: 1024, h: 768 },
      { id: 'three', x: 2208, y: 0, w: 1024, h: 768 },
    ], [], 9 / 16);

    assert.deepEqual(result.slides.map(slide => slide.id), ['one', 'two', 'three']);
    closeTo(result.slides[1].x - (result.slides[0].x + result.slides[0].w), 80, `${file} closes the first gap`);
    closeTo(result.slides[2].x - (result.slides[1].x + result.slides[1].w), 80, `${file} closes the second gap`);
  }
});

test('new slides inherit the current slide dimensions after a ratio change', async () => {
  for (const file of files) {
    const html = await source(file);
    const created = runSmartSlideCreation(html, [
      { id: 'one', x: 0, y: 0, w: 540, h: 720 },
    ], 0);

    assert.equal(created.w, 540, `${file} inherits the resized slide width`);
    assert.equal(created.h, 720, `${file} inherits the resized slide height`);
  }
});

test('slide reflow implementation stays aligned between both variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const behavior = html => [
    between(html, 'function slideIndexForObject(', 'function shiftSlidesAndContents('),
    between(html, 'function resizeSlidesToRatio(){', 'function updateSlideRatioButton(){'),
  ].join('\n');
  assert.equal(behavior(privateApp), behavior(commercialTemplate));
});

test('selectSlide auto-fits an overflowing target only while idle', async () => {
  for (const file of files) {
    const html = await source(file);
    const fn = between(html, 'function selectSlide(', 'function addSlide(){');
    assert.match(fn, /if\(recState==='idle' && \(!opts\.animate \|\| !slideFitsViewportAtCurrentScale\(s\)\)\)[\s\S]{0,80}fitViewToRect\(s\)/,
      `${file} fits initialization and overflowing user-selected slides while idle`);
    assert.doesNotMatch(fn, /recState!=='idle'[\s\S]{0,100}fitViewToRect\(s\)/,
      `${file} does not auto-fit during setup or recording`);
  }
});

test('slide fit check uses the same safe viewport as fitViewToRect', async () => {
  for (const file of files) {
    const html = await source(file);
    const fn = between(html, 'function slideFitsViewportAtCurrentScale(', 'function selectSlide(');
    const context = {
      window: { innerWidth: 1600, innerHeight: 1000 },
      TOP_VIEW_INSET_PX: 110,
      state: { view: { scale: 1 } },
    };
    vm.runInNewContext(`${fn}\nfits=slideFitsViewportAtCurrentScale({w:720,h:1280});`, context);
    assert.equal(context.fits, false, `${file} detects a 9:16 slide overflowing at 100%`);

    context.state.view.scale = 0.59;
    vm.runInNewContext(`${fn}\nfits=slideFitsViewportAtCurrentScale({w:720,h:1280});`, context);
    assert.equal(context.fits, true, `${file} accepts the same slide after it is fitted`);
  }
});

test('user-driven navigation preserves zoom / vertical pan when the target already fits', async () => {
  for (const file of files) {
    const html = await source(file);
    const fn = between(html, 'function selectSlide(', 'function addSlide(){');
    assert.match(fn, /opts\.animate\s*&&\s*state\.slides\.length\)[\s\S]*?state\.view\.x=window\.innerWidth\/2 - cx\*state\.view\.scale/,
      `${file} recenters horizontally when the user clicks a slide in the rail`);
    assert.match(fn, /!slideFitsViewportAtCurrentScale\(s\)/,
      `${file} only enters fit mode when the target would overflow`);
  }
});

test('addSlide and insertSlideAt reuse the overflow-aware user navigation path', async () => {
  for (const file of files) {
    const html = await source(file);
    // addSlide 末尾调 selectSlide 时带上 {animate:true}
    assert.match(html, /function addSlide\(\)\{[\s\S]*?selectSlide\(state\.slides\.length-1,\s*\{animate:true\}\)/,
      `${file} addSlide selects the new slide through overflow-aware navigation`);
    // insertSlideAt 末尾也用 animate:true
    assert.match(html, /function insertSlideAt\(targetIndex\)\{[\s\S]*?selectSlide\(targetIndex,\s*\{animate:true\}\)/,
      `${file} insertSlideAt also opts in to the same navigation path`);
    // deleteSlide 末尾：删除后仍走 animate:true，保留 zoom 与 view.y
    const deleteBlock = between(html, 'function deleteSlide(', 'function resizeSlidesToRatio');
    assert.match(deleteBlock, /selectSlide\(state\.activeSlide,\s*\{animate:true\}\)/,
      `${file} deleteSlide re-selects the surviving slide with the animate flag`);
    // 删除后续幻灯片要凑上来：shiftSlidesAndContents 把 index 之后的整段左移 - (width + gap)
    assert.match(deleteBlock, /shiftSlidesAndContents\(index,\s*-\(removed\.w\s*\+\s*SLIDE_GAP\),\s*0\)/,
      `${file} deleteSlide closes the gap left by the removed slide`);
    // 删除幻灯片时把页内对象一起删掉：用 objectBelongsToSlide 筛出来再 splice scene
    assert.match(deleteBlock, /objectBelongsToSlide\(state\.scene\[i\][\s\S]{0,40}slide\)/,
      `${file} deleteSlide checks whether each object belongs to the removed slide`);
    assert.match(deleteBlock, /removedObjectIndices\.forEach\(i=>state\.scene\.splice\(i,1\)\)/,
      `${file} deleteSlide splices out the slide's objects from state.scene`);
    // 反向：四条路径中任何"无 animate 的 selectSlide"都不能存在，否则会触发 fit
    assert.doesNotMatch(html, /function addSlide\(\)\{[\s\S]*?selectSlide\(state\.slides\.length-1\);/,
      `${file} addSlide does not silently fall back to the fit-view branch`);
    assert.doesNotMatch(html, /function insertSlideAt\(targetIndex\)\{[\s\S]*?selectSlide\(targetIndex\);/,
      `${file} insertSlideAt does not silently fall back to the fit-view branch`);
    assert.doesNotMatch(deleteBlock, /selectSlide\(state\.activeSlide\);\s*\n\s*else render\(\)/,
      `${file} deleteSlide does not silently fall back to the fit-view branch`);
  }
});

test('all slide-navigation entry points use the same overflow-aware selection path', async () => {
  for (const file of files) {
    const html = await source(file);
    // 带 animate 的入口用于用户切换，并由 selectSlide 决定保留视图或在溢出时 fit；不带 animate 的入口用于初始化并始终 fit。
    // 用户级切页入口：rail click / addSlide / insertSlideAt / deleteSlide / 键盘翻页 → 全部带 animate
    assert.match(html, /item\.addEventListener\('click',[\s\S]*?selectSlide\(i,\s*\{animate:true\}\)/,
      `${file} rail click uses animate:true`);
    assert.match(html, /selectSlide\(Math\.max\(0,\s*Math\.min\(state\.slides\.length-1,\s*cur\+dir\)\),\{animate:true\}\)/,
      `${file} keyboard arrow navigation uses animate:true`);
    // 初始化入口：enterSetup 与 resizeSlidesToRatio 内部仍用无 animate 的 selectSlide（这是为了让 fit 行为生效）
    const enterSetup = between(html, 'function enterSetup(', '\n}');
    assert.match(enterSetup, /selectSlide\(state\.activeSlide>=0 \? state\.activeSlide : 0\)\s*;/,
      `${file} enterSetup still calls fit-branch selectSlide for the initial framing`);
    const resize = between(html, 'function resizeSlidesToRatio', 'function updateSlideRatioButton');
    assert.match(resize, /if\(state\.activeSlide>=0\)\s*selectSlide\(state\.activeSlide\);/,
      `${file} resizeSlidesToRatio still calls fit-branch selectSlide after a ratio change`);
  }
});
