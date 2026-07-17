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

test('both whiteboard variants expose the complete watermark interaction', async () => {
  for (const file of files) {
    const html = await source(file);
    const controls = between(
      html,
      '<div class="setting-section" id="watermarkSection">',
      '<div class="setting-section">',
    );

    assert.match(controls, /id="watermarkEnabled"/);
    assert.match(controls, /id="watermarkText"[^>]*maxlength="40"/);
    assert.match(controls, /id="watermarkOpacity"[^>]*min="20"[^>]*max="100"/);
    assert.equal((controls.match(/data-watermark-pos=/g) || []).length, 9);
    assert.equal((controls.match(/data-watermark-size=/g) || []).length, 3);
    assert.match(html, /id="previewWatermark"/);
    assert.match(html, /previewWatermark\.onpointerdown/);
    assert.match(html, /recConfig\.watermarkPosition='custom'/);
    assert.match(html, /WATERMARK_STORAGE_KEY='wb_recording_watermark_v1'/);
    assert.match(html, /function validateWatermarkSettings\(\)/);
  }
});

test('custom watermark is composited into board and screen recordings', async () => {
  for (const file of files) {
    const html = await source(file);
    const boardRecording = between(html, 'function drawRecFrame(){', 'function drawPlanWatermarks(');
    const screenRecording = between(html, 'function drawScreenFrame(src){', 'function startCamPump(){');

    for (const recording of [boardRecording, screenRecording]) {
      assert.match(recording, /drawUserWatermark\(recCtx,W,H\)/);
      assert.match(recording, /drawPlanWatermarks\(recCtx,W,H\)/);
      assert.ok(
        recording.indexOf('drawUserWatermark(recCtx,W,H)')
          < recording.indexOf('drawPlanWatermarks(recCtx,W,H)'),
        `${file} should draw the custom watermark before the mandatory plan watermark`,
      );
    }

    assert.match(html, /function getWatermarkLayout\(ctx,W,H\)/);
    assert.match(html, /ctx\.fillText\(layout\.text,layout\.x,layout\.y\)/);
  }
});

test('watermark implementation stays aligned between both whiteboard variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const feature = (html) => between(
    html,
    "const WATERMARK_STORAGE_KEY='wb_recording_watermark_v1';",
    '// 摄像头提亮：',
  );
  const controls = (html) => between(
    html,
    '<div class="setting-section" id="watermarkSection">',
    '<div class="setting-section">',
  );

  assert.equal(feature(privateApp), feature(commercialTemplate));
  assert.equal(controls(privateApp), controls(commercialTemplate));
});
