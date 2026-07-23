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

function outputSize(html, ratio, quality, customW = 1080, customH = 1920) {
  const qualityConfig = between(
    html,
    "const RECORDING_QUALITY_STORAGE_KEY='wb_recording_quality_v1';",
    'const BG_CATEGORIES',
  );
  const outputFeature = between(html, 'function recordingOutputSize(', 'function applyRatioChange(){');
  const sandbox = {
    result: null,
    recConfig: { ratio, quality, customW, customH },
    RATIOS: {
      '16:9': { w: 1280, h: 720 },
      '4:3': { w: 1024, h: 768 },
      '3:4': { w: 810, h: 1080 },
      '9:16': { w: 720, h: 1280 },
      '1:1': { w: 1000, h: 1000 },
    },
  };
  vm.runInNewContext(`${qualityConfig}\n${outputFeature}\nresult=recordingOutputSize();`, sandbox);
  return structuredClone(sandbox.result);
}

test('recording settings expose three remembered board quality choices', async () => {
  for (const file of files) {
    const html = await source(file);
    const controls = between(
      html,
      '<div class="setting-section board-only" id="recordingQualitySection">',
      '<div class="setting-section board-only">',
    );

    for (const quality of ['1080p', '720p', '480p']) {
      assert.match(controls, new RegExp(`data-recording-quality="${quality}"`));
    }
    assert.match(controls, />推荐<\/span>/);
    assert.doesNotMatch(html, /id="recordingQualityQuick"/);
    assert.match(html, /id="recordingSummary"/);
    assert.match(html, /RECORDING_QUALITY_STORAGE_KEY='wb_recording_quality_v1'/);
    assert.match(html, /quality:loadRecordingQuality\(\)/);
    assert.match(html, /localStorage\.setItem\(RECORDING_QUALITY_STORAGE_KEY,recConfig\.quality\)/);
  }
});

test('standard ratios map to the requested 1080p, 720p and 480p output sizes', async () => {
  const html = await source('whiteboard.html');
  const expected = {
    '16:9': { '1080p': [1920, 1080], '720p': [1280, 720], '480p': [854, 480] },
    '4:3': { '1080p': [1440, 1080], '720p': [960, 720], '480p': [640, 480] },
    '3:4': { '1080p': [1080, 1440], '720p': [720, 960], '480p': [480, 640] },
    '9:16': { '1080p': [1080, 1920], '720p': [720, 1280], '480p': [480, 854] },
    '1:1': { '1080p': [1080, 1080], '720p': [720, 720], '480p': [480, 480] },
  };

  for (const [ratio, qualities] of Object.entries(expected)) {
    for (const [quality, [w, h]] of Object.entries(qualities)) {
      assert.deepEqual(outputSize(html, ratio, quality), { w, h }, `${ratio} ${quality}`);
    }
  }
});

test('Custom output preserves aspect, fits the selected tier and uses even pixels', async () => {
  const html = await source('whiteboard.html');
  assert.deepEqual(outputSize(html, 'custom', '1080p', 2000, 1000), { w: 1920, h: 960 });
  assert.deepEqual(outputSize(html, 'custom', '720p', 1000, 2000), { w: 640, h: 1280 });

  const unusual = outputSize(html, 'custom', '480p', 1234, 777);
  assert.equal(unusual.w % 2, 0);
  assert.equal(unusual.h % 2, 0);
  assert.ok(unusual.w <= 854 && unusual.h <= 480);
  assert.ok(Math.abs(unusual.w / unusual.h - 1234 / 777) < 0.01);
});

test('board recording uses quality output and bitrate without resizing slides', async () => {
  for (const file of files) {
    const html = await source(file);
    const setter = between(html, 'function setRecordingQuality(', 'function syncRecordingQualityUI(){');
    const audio = between(html, 'async function buildRecordingAudioTracks(', 'async function buildMixedAudioTracks(){');
    const board = between(html, 'async function startRecording(){', 'function pauseRecording(){');
    const screen = between(html, 'async function startScreenRecording(){', 'async function startRecording(){');

    assert.doesNotMatch(setter, /applyRatioChange|resizeSlidesToRatio/);
    assert.match(board, /const R=recordingOutputSize\(\)/);
    assert.match(board, /videoBitsPerSecond:recordingVideoBitrate\(\)/);
    assert.match(board, /captureStream\(0\)/);
    assert.match(board, /setInterval\(pushFrame,1000\/RECORDING_FPS\)/);
    assert.match(board, /recCanvasTrack\.requestFrame\(\)/);
    assert.match(html, /const RECORDING_FPS=30/);
    assert.match(audio, /createConstantSource\(\)/);
    assert.match(audio, /recordingAudioClock\.offset\.value=\.0001/);
    assert.match(audio, /recordingAudioClock\.connect\(recordingAudioDestination\)/);
    assert.match(audio, /Promise\.race\(/);
    assert.match(board, /if\(recMime\.startsWith\('video\/mp4'\)\) recorder\.start\(\)/);
    assert.match(screen, /if\(recMime\.startsWith\('video\/mp4'\)\) recorder\.start\(\)/);
    assert.match(html, /if\(!recMime\.startsWith\('video\/mp4'\) && recorder\.requestData\)/);
    assert.match(screen, /const maxSide=1920/);
    assert.match(screen, /videoBitsPerSecond: 8_000_000/);
  }
});

test('recording quality implementation stays aligned between both variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const constants = html => between(
    html,
    "const RECORDING_QUALITY_STORAGE_KEY='wb_recording_quality_v1';",
    'const BG_CATEGORIES',
  );
  const feature = html => between(html, 'function recordingOutputSize(', 'function applyRatioChange(){');
  const controls = html => between(
    html,
    '<div class="setting-section board-only" id="recordingQualitySection">',
    '<div class="setting-section board-only">',
  );

  assert.equal(constants(privateApp), constants(commercialTemplate));
  assert.equal(feature(privateApp), feature(commercialTemplate));
  assert.equal(controls(privateApp), controls(commercialTemplate));
});
