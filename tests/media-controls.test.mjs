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

function recordingControls(html) {
  const from = html.indexOf('<div class="recbar" id="recBar">');
  const selfCheck = html.indexOf('id="selfCheckBtn"', from);
  const to = html.indexOf('</div>', selfCheck);
  assert.notEqual(from, -1, 'missing recBar');
  assert.notEqual(selfCheck, -1, 'missing selfCheckBtn');
  assert.notEqual(to, -1, 'missing recBar closing tag');
  return html.slice(from, to + '</div>'.length);
}

test('compact media capsule exposes independent camera and microphone controls', async () => {
  for (const file of files) {
    const html = await source(file);
    const controls = recordingControls(html);

    assert.match(controls, /class="media-capsule"/);
    assert.match(controls, /id="cameraToggle"/);
    assert.match(controls, /id="micToggle"/);
    assert.match(controls, /aria-pressed="false"/);
    assert.match(html, /\.media-capsule\{[^}]*width:76px[^}]*height:44px/);
    assert.match(html, /@media \(pointer:coarse\)\{[\s\S]*?\.media-capsule\{width:88px;height:44px;\}/);
    assert.match(html, /\.media-segment svg\{[^}]*stroke-width:1\.8/);
    assert.doesNotMatch(html, /id="mediaToggle"|id="showCamera"|recConfig\.showCamera/);
  }
});

test('settings keep device selection and feedback without duplicate media switches', async () => {
  for (const file of files) {
    const html = await source(file);
    const settings = between(html, '<div class="setting-section">\n          <div class="set-label">摄像头</div>', '<div class="setting-section board-only">');

    assert.match(settings, /id="cameraSettingStatus"/);
    assert.match(settings, /id="enableCameraPreview"/);
    assert.match(settings, /<div class="set-label">麦克风设备<\/div>/);
    assert.match(settings, /id="micSelect"/);
    assert.match(settings, /id="micMeterLevel"/);
    assert.match(html, /createAnalyser\(\)/);
    assert.match(html, /micMeterSource\.connect\(micMeterAnalyser\)/);
    assert.doesNotMatch(settings, /class="switch"/);
  }
});

test('camera and microphone streams stop independently and microphone can reconnect to an active recording', async () => {
  for (const file of files) {
    const html = await source(file);
    const media = between(html, '/* --------------------------- CAMERA', '// 摄像头小窗拖动 / 缩放');
    const audio = between(html, 'async function buildRecordingAudioTracks(', 'async function startScreenRecording(){');

    const stopCamera = between(media, 'function stopCameraStream(){', 'function stopMicrophoneStream(){');
    const stopMic = between(media, 'function stopMicrophoneStream(){', 'function adoptCameraStream(');
    assert.match(stopCamera, /cameraStream=null/);
    assert.doesNotMatch(stopCamera, /microphoneStream=null/);
    assert.match(stopMic, /microphoneStream=null/);
    assert.doesNotMatch(stopMic, /cameraStream=null/);
    assert.match(media, /getUserMedia\(\{\s*video:\{facingMode:/);
    assert.match(media, /getUserMedia\(\{video:false,audio:microphoneConstraints/);

    assert.match(audio, /recordingMicSource/);
    assert.match(audio, /recordingSystemSources/);
    assert.match(audio, /function syncRecordingMicrophoneSource\(\)/);
    assert.match(audio, /recordingMicSource\.connect\(recordingAudioDestination\)/);
    assert.match(audio, /return buildRecordingAudioTracks\(sysTracks\)/);
    assert.match(audio, /return buildRecordingAudioTracks\(\[\]\)/);
  }
});

test('media control implementation stays aligned between both variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const controls = recordingControls;
  const media = html => between(html, '/* --------------------------- CAMERA', '// 摄像头小窗拖动 / 缩放');
  const audio = html => between(html, 'async function buildRecordingAudioTracks(', 'async function startScreenRecording(){');

  assert.equal(controls(privateApp), controls(commercialTemplate));
  assert.equal(media(privateApp), media(commercialTemplate));
  assert.equal(audio(privateApp), audio(commercialTemplate));
});
