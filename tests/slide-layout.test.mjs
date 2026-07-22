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

test('slide reflow implementation stays aligned between both variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const behavior = html => [
    between(html, 'function slideIndexForObject(', 'function shiftSlidesAndContents('),
    between(html, 'function resizeSlidesToRatio(){', 'function updateSlideRatioButton(){'),
  ].join('\n');
  assert.equal(behavior(privateApp), behavior(commercialTemplate));
});
