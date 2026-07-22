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

function cropHarness(html, width, height, expression) {
  const feature = between(html, 'function clampScreenCrop(n){', 'function updateScreenPrivacyHint(){');
  const sandbox = {
    result: null,
    screenSnap: { getBoundingClientRect: () => ({ width, height }) },
    screenVideo: { videoWidth: width, videoHeight: height },
    screenCropNorm: null,
    screenCropMode: '16:9',
    recConfig: { source: 'screen', customW: 1080, customH: 1920 },
    RATIOS: {
      '16:9': { w: 1280, h: 720 },
      '4:3': { w: 1024, h: 768 },
      '3:4': { w: 810, h: 1080 },
      '9:16': { w: 720, h: 1280 },
      '1:1': { w: 1000, h: 1000 },
    },
    screenCropModes: { querySelectorAll: () => [] },
    screenStage: { classList: { contains: () => true } },
    recState: 'setup',
    positionScreenCropFrame() {},
  };
  vm.runInNewContext(`${feature}\nresult=(${expression});`, sandbox);
  return structuredClone(sandbox.result);
}

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

test('screen crop toolbar exposes full screen, presets and Custom in both variants', async () => {
  for (const file of files) {
    const html = await source(file);
    const toolbar = between(html, '<div id="screenCropModes"', '</div>');
    for (const mode of ['full', '16:9', '4:3', '3:4', '9:16', '1:1', 'custom']) {
      assert.match(toolbar, new RegExp(`data-screen-crop-mode="${mode.replace(':', '\\:')}"`));
    }
    assert.match(html, /<div class="setting-section">\s*<div class="set-label">画面比例<\/div>/);
    assert.doesNotMatch(html, /画面比例仅白板模式生效/);
    assert.match(html, /const r = getRatioConfig\(\);/);
    assert.match(html, /screenCropMode=recConfig\.ratio/);
    assert.match(html, /screenCropMode==='full'/);
    assert.match(html, /else if\(screenCropMode==='custom'\)/);
    assert.match(html, /recState==='setup' && recConfig\.source==='board'/);
    assert.match(html, /screenDisplaySurface==='browser'\|\|screenDisplaySurface==='window'/);
  }
});

test('preset crops use the largest centered rectangle for the real source aspect', async () => {
  const html = await source('whiteboard.html');

  const landscape = cropHarness(html, 1920, 1080, 'screenCropForAspect(16/9)');
  assert.deepEqual(landscape, { x: 0, y: 0, w: 1, h: 1 });

  const classic = cropHarness(html, 1920, 1080, 'screenCropForAspect(4/3)');
  closeTo(classic.x, 0.125, '4:3 crop is horizontally centered');
  closeTo(classic.y, 0, '4:3 crop uses full height');
  closeTo(classic.w, 0.75, '4:3 crop width');
  closeTo(classic.h, 1, '4:3 crop height');

  const portrait = cropHarness(html, 1920, 1080, 'screenCropForAspect(9/16)');
  closeTo(portrait.x, (1 - 81 / 256) / 2, '9:16 crop is horizontally centered');
  closeTo(portrait.w, 81 / 256, '9:16 crop width');
  closeTo(portrait.h, 1, '9:16 crop height');

  const verticalSource = cropHarness(html, 1080, 1920, 'screenCropForAspect(16/9)');
  closeTo(verticalSource.x, 0, 'landscape crop uses full width on a vertical source');
  closeTo(verticalSource.y, (1 - 81 / 256) / 2, 'landscape crop is vertically centered');
  closeTo(verticalSource.w, 1, 'landscape crop width on a vertical source');
  closeTo(verticalSource.h, 81 / 256, 'landscape crop height on a vertical source');
});

test('all preset ratios reuse the centered 16:9 safe band on a 16:10 screen', async () => {
  const html = await source('whiteboard.html');
  const expected = {
    '16:9': { w: 1, h: 0.9 },
    '4:3': { w: 0.75, h: 0.9 },
    '3:4': { w: 0.421875, h: 0.9 },
    '9:16': { w: 0.31640625, h: 0.9 },
    '1:1': { w: 0.5625, h: 0.9 },
  };

  for (const [mode, size] of Object.entries(expected)) {
    const crop = cropHarness(html, 1920, 1200, `screenCropForAspect(RATIOS['${mode}'].w/RATIOS['${mode}'].h)`);
    closeTo(crop.x, (1 - size.w) / 2, `${mode} crop is horizontally centered`);
    closeTo(crop.y, 0.05, `${mode} crop avoids the top menu`);
    closeTo(crop.w, size.w, `${mode} crop width`);
    closeTo(crop.h, size.h, `${mode} crop height`);
    closeTo(crop.y + crop.h, 0.95, `${mode} crop avoids the bottom Dock`);
  }
});

test('full screen covers the source and Custom initializes from settings without hiding handles', async () => {
  for (const file of files) {
    const html = await source(file);
    const full = cropHarness(html, 2560, 1440, "applyScreenCropMode('full'),screenCropNorm");
    assert.deepEqual(full, { x: 0, y: 0, w: 1, h: 1 });

    const custom = cropHarness(html, 2560, 1440, "applyScreenCropMode('custom',{initialize:true}),screenCropNorm");
    closeTo(custom.w / custom.h * (2560 / 1440), 1080 / 1920, `${file} custom aspect`);
    assert.doesNotMatch(html, /screenCropMode[^\n]*sc-handle[^\n]*display:\s*none/);
  }
});

test('standard preset corner resizing stays locked to the selected source-pixel aspect', async () => {
  for (const file of files) {
    const html = await source(file);
    const resized = cropHarness(
      html,
      1920,
      1080,
      "screenCropMode='4:3',resizeScreenCropLocked({x:.125,y:0,w:.75,h:1},'br',-.15,-.2,{width:1920,height:1080})",
    );
    closeTo(resized.w / resized.h * (1920 / 1080), 4 / 3, `${file} locked 4:3 aspect`);
    assert.ok(resized.x >= 0 && resized.y >= 0, `${file} crop starts inside the source`);
    assert.ok(resized.x + resized.w <= 1 && resized.y + resized.h <= 1, `${file} crop ends inside the source`);
  }
});

test('screen crop implementation stays aligned between both whiteboard variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const cropFeature = html => between(html, 'function clampScreenCrop(n){', 'let lastCompositeTs=0;');
  const toolbar = html => between(html, '<div id="screenCropModes"', '<div class="stage-hint">');

  assert.equal(cropFeature(privateApp), cropFeature(commercialTemplate));
  assert.equal(toolbar(privateApp), toolbar(commercialTemplate));

  for (const [file, html] of files.map((file, index) => [file, [privateApp, commercialTemplate][index]])) {
    const setup = between(html, 'async function enterScreenSetup(){', '(function bindScreenCropFrame(){');
    const layoutAt = setup.lastIndexOf('layoutScreenSnap(true)');
    const cropAt = setup.lastIndexOf('screenCropNorm=screenCropForAspect');
    assert.ok(layoutAt >= 0 && cropAt > layoutAt, `${file} must size the preview before initializing the preset crop`);
  }
});
