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
  const feature = between(html, 'function clampScreenCrop(n,rect){', 'function updateScreenPrivacyHint(){');
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
      '3:4': { w: 960, h: 1280 },
      '9:16': { w: 720, h: 1280 },
      '1:1': { w: 1000, h: 1000 },
    },
    screenCropModes: { querySelectorAll: () => [] },
    screenStage: { classList: { contains: () => true } },
    recState: 'setup',
    positionScreenCropFrame() {},
    updateScreenCropPipModeUI() {},
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
  }
});

test('window and browser sources use the same adjustable crop setup as full-screen sources', async () => {
  for (const file of files) {
    const html = await source(file);
    const setup = between(html, 'async function enterScreenSetup(){', '(function bindScreenCropFrame(){');
    const captureAt = setup.indexOf('await captureMediaDevices.getDisplayMedia(displayMediaOptions)');
    const preparedFocusAt = setup.indexOf('captureController.setFocusBehavior(preferredCaptureFocus)');
    const appliedFocusAt = setup.lastIndexOf('captureController.setFocusBehavior(preferredCaptureFocus)');
    const playbackAt = setup.indexOf('await screenVideo.play()');
    const pipEditorAt = setup.indexOf('if(!showScreenCropPipEditor())');
    const stageFocusAt = setup.indexOf("screenStage.classList.add('show');", pipEditorAt);

    assert.match(setup, /const canOpenScreenCropPip=!screenCropPipUnavailable/);
    assert.match(setup, /if\(!screenCropPipWin && canOpenScreenCropPip\)\{\s*await openScreenCropPipLauncher\(\);\s*return;/);
    assert.match(setup, /const usingScreenCropPip=!!screenCropPipWin;/);
    assert.match(setup, /const captureNavigator=usingScreenCropPip \? screenCropPipWin\.navigator : navigator;/);
    assert.match(setup, /const captureMediaDevices=captureNavigator && captureNavigator\.mediaDevices;/);
    assert.match(setup, /const CaptureControllerCtor=\(usingScreenCropPip && screenCropPipWin\.CaptureController\) \|\| window\.CaptureController;/);
    assert.match(setup, /const preferredCaptureFocus=usingScreenCropPip\?'focus-captured-surface':'focus-capturing-application';/);
    assert.match(setup, /typeof CaptureControllerCtor==='function'/);
    assert.match(setup, /displayMediaOptions\.controller=captureController/);
    assert.ok(preparedFocusAt >= 0 && preparedFocusAt < captureAt, `${file} prepares focus before opening the system picker`);
    assert.ok(appliedFocusAt > captureAt, `${file} reapplies focus after capture selection`);
    assert.ok(playbackAt > appliedFocusAt, `${file} sets focus before awaiting captured video playback`);
    assert.match(setup, /if\(!usingScreenCropPip\)\{[\s\S]*try\{ window\.focus\(\); \}/);
    assert.ok(pipEditorAt > playbackAt, `${file} shows the always-on-top crop editor after captured video playback`);
    assert.ok(stageFocusAt > pipEditorAt, `${file} keeps the WhiteBoard crop stage as fallback`);
    assert.match(setup.slice(stageFocusAt), /requestAnimationFrame\(\(\)=>\{[\s\S]*positionScreenCropFrame\(\);[\s\S]*window\.focus\(\)/);
    assert.match(setup, /选择窗口或标签页后，将在置顶小窗中调整绿色录制框/);
    assert.match(setup, /screenCropMode=recConfig\.ratio;\s*screenCropNorm=null;/);
    assert.match(setup, /layoutScreenSnap\(true\);[\s\S]*screenCropNorm=screenCropForAspect\(screenCropAspect\(screenCropMode\)\);[\s\S]*showScreenCropPipEditor\(\)/);
    assert.doesNotMatch(setup, /if\(screenDisplaySurface==='browser'\|\|screenDisplaySurface==='window'\)[\s\S]*startScreenRecording\(\)/);
  }
});

test('Document PiP launcher keeps crop controls visible above the selected app', async () => {
  for (const file of files) {
    const html = await source(file);
    const pip = between(html, 'function screenCropPipCopy(zh,en){', '// 把当前屏幕一帧画到快照 canvas');
    const start = between(html, 'async function startScreenRecording(){', 'async function startRecording(){');

    assert.match(pip, /const launcherSize=\{width:760,height:590\};/);
    assert.match(pip, /documentPictureInPicture\.requestWindow\(\{[\s\S]*\.\.\.launcherSize,[\s\S]*preferInitialWindowPlacement:true/);
    assert.match(pip, /win\.resizeTo\(launcherSize\.width,launcherSize\.height\)/);
    assert.match(pip, /function detachCapturedStreamFromPip\(stream\)/);
    assert.match(pip, /structuredClone\(clone,\{transfer:\[clone\]\}\)/);
    assert.match(pip, /screenCropPipUI\.choose\.addEventListener\('click',async\(\)=>\{[\s\S]*await enterScreenSetup\(\)/);
    for (const mode of ['full', '16:9', '4:3', '3:4', '9:16', '1:1', 'custom']) {
      assert.match(pip, new RegExp(`\\['${mode.replace(':', '\\:')}'`));
    }
    assert.match(pip, /doc\.querySelector\('\.confirm'\)\.addEventListener\('click',\(\)=>startScreenRecording\(\)\)/);
    assert.match(pip, /function showScreenCropPipRecording\(\)/);
    assert.match(pip, /recording-pause[\s\S]*recording-stop/);
    assert.match(pip, /tele-warning[\s\S]*tele-text[\s\S]*tele-play[\s\S]*hide-tele/);
    assert.match(pip, /screenCropPipUI\.teleText\.innerHTML=sanitizeTeleHtml\(teleText\.innerHTML\)/);
    assert.match(pip, /screenCropPipUI\.teleWarning\.hidden=screenDisplaySurface!=='monitor'/);
    assert.match(pip, /function hideScreenCropPipTele\(\)[\s\S]*screenCropPipTeleCollapsed=!screenCropPipTeleCollapsed[\s\S]*teleText\.hidden=screenCropPipTeleCollapsed[\s\S]*teleActionLeft\.hidden=screenCropPipTeleCollapsed[\s\S]*resizeTo\(360,150\)/);
    assert.match(pip, /收起讲稿并保留暂停、停止控制/);
    assert.match(pip, /if\(\(recState==='recording'\|\|recState==='paused'\) && !screenStreamDetachedFromPip\)[\s\S]*stopRecording\(\);[\s\S]*else if\(recState==='setup'\) showMainScreenCropFallback\(\)/);
    assert.match(pip, /screenCropPipUnavailable=true;[\s\S]*请再次点击“录制”使用白板裁剪页/);
    assert.match(start, /if\(screenCropPipWin\) showScreenCropPipRecording\(\);/);
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
  const pipFeature = html => between(html, 'function screenCropPipCopy(zh,en){', '// 把当前屏幕一帧画到快照 canvas');
  const cropFeature = html => between(html, 'function clampScreenCrop(n,rect){', 'let lastCompositeTs=0;');
  const compositeFeature = html => between(html, 'function startScreenComposite(){', 'async function buildRecordingAudioTracks(');
  const toolbar = html => between(html, '<div id="screenCropModes"', '<div class="stage-hint">');

  assert.equal(pipFeature(privateApp), pipFeature(commercialTemplate));
  assert.equal(cropFeature(privateApp), cropFeature(commercialTemplate));
  assert.equal(compositeFeature(privateApp), compositeFeature(commercialTemplate));
  assert.equal(toolbar(privateApp), toolbar(commercialTemplate));
  assert.match(compositeFeature(privateApp), /\.catch\(error=>\{[\s\S]*startVideoFallback\(\);/);
  assert.match(compositeFeature(privateApp), /recLoop=setInterval\(drawScreenFrame,1000\/30\)/);

  for (const [file, html] of files.map((file, index) => [file, [privateApp, commercialTemplate][index]])) {
    const setup = between(html, 'async function enterScreenSetup(){', '(function bindScreenCropFrame(){');
    const layoutAt = setup.lastIndexOf('layoutScreenSnap(true)');
    const cropAt = setup.lastIndexOf('screenCropNorm=screenCropForAspect');
    assert.ok(layoutAt >= 0 && cropAt > layoutAt, `${file} must size the preview before initializing the preset crop`);
    assert.match(setup, /if\(usingScreenCropPip\)\{[\s\S]*detachCapturedStreamFromPip\(selectedScreenStream\)[\s\S]*screenStreamDetachedFromPip=true/);
  }
});
