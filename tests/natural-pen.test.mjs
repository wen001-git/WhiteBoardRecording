import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const variants = ['whiteboard.html', 'whiteboard-pro.html'];

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function perfectFreehandMath(source) {
  const names = [
    'pfAdd', 'pfSub', 'pfMul', 'pfPer', 'pfDot', 'pfDist', 'pfDist2',
    'pfUnit', 'pfLerp', 'pfRotate', 'pfProject', 'pfSimulatePressure',
    'pfStrokeRadius', 'perfectFreehandOptions', 'perfectFreehandInput',
    'pfStrokePoints', 'pfInitialPressure', 'pfDotOutline', 'pfStrokeOutline',
    'perfectFreehandStroke', 'naturalPenCenterSamples',
  ];
  const constants = [
    'const NATURAL_PEN_SIZE_FACTOR=4.25;',
    'const PF_RATE_OF_PRESSURE_CHANGE=.275;',
    'const PF_FIXED_PI=Math.PI+.0001;',
  ].join('\n');
  const declarations = names.map(name => extractFunction(source, name)).join('\n');
  return new Function(`${constants}\n${declarations}; return {${names.join(',')}};`)();
}

function pen(points, extra = {}) {
  return {
    type: 'pen',
    width: 2,
    strokeDynamics: 'natural',
    points: points.map(([x, y]) => ({ x, y })),
    pressures: [],
    simulatePressure: true,
    lastCommittedPoint: { x: points.at(-1)[0], y: points.at(-1)[1] },
    ...extra,
  };
}

test('Excalicord width presets and Perfect Freehand parameters are exact', async () => {
  for (const file of variants) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /const WIDTHS = \[1, 2, 4\]/);
    assert.match(html, /\{value:1,label:'细',preview:1\.25\}/);
    assert.match(html, /\{value:2,label:'粗',preview:2\.5\}/);
    assert.match(html, /\{value:4,label:'特粗',preview:3\.75\}/);
    assert.match(html, /width: 2,/);
    assert.match(html, /const NATURAL_PEN_SIZE_FACTOR=4\.25/);
    assert.match(html, /thinning:\.6,smoothing:\.5,streamline:\.5/);
    assert.match(html, /Math\.sin\(\(\.5-thinning\*\(\.5-pressure\)\)\*Math\.PI\/2\)/);
  }
});

test('simulated pressure is distance-based and real pressure remains monotonic', async () => {
  const html = await readFile(variants[0], 'utf8');
  const { pfSimulatePressure, pfStrokeRadius } = perfectFreehandMath(html);
  const size = 8.5;
  assert.ok(pfSimulatePressure(.5, 1, size) > pfSimulatePressure(.5, 8, size));
  assert.ok(pfStrokeRadius(size, .6, .8) > pfStrokeRadius(size, .6, .2));
});

test('streamline completion reaches the pointer and ignores event timing and legacy f', async () => {
  const html = await readFile(variants[0], 'utf8');
  const { perfectFreehandOptions, perfectFreehandInput, pfStrokePoints, perfectFreehandStroke } =
    perfectFreehandMath(html);
  const points = [[0, 0], [20, 2], [40, -1], [60, 0]];
  const object = pen(points);
  const complete = pfStrokePoints(perfectFreehandInput(object), perfectFreehandOptions(object));
  const liveObject = { ...object, lastCommittedPoint: null };
  const live = pfStrokePoints(perfectFreehandInput(liveObject), perfectFreehandOptions(liveObject));
  assert.deepEqual(complete.at(-1).point, [60, 0]);
  assert.notDeepEqual(live.at(-1).point, [60, 0]);

  const timed = { ...object, points: object.points.map((point, i) => ({ ...point, t: i * 999 })) };
  const legacy = { ...object, simulatePressure: undefined, points: object.points.map((point, i) => ({ ...point, f: i ? 1.8 : .2 })) };
  assert.deepEqual(perfectFreehandStroke(timed).outline, perfectFreehandStroke(object).outline);
  assert.deepEqual(perfectFreehandStroke(legacy).outline, perfectFreehandStroke(object).outline);
});

test('outline owns its rounded caps without separate endpoint circles', async () => {
  const html = await readFile(variants[0], 'utf8');
  const { perfectFreehandStroke } = perfectFreehandMath(html);
  const object = pen([[0, 0], [25, 0], [50, 0], [75, 0], [100, 0]]);
  const { outline } = perfectFreehandStroke(object);
  assert.ok(outline.length > 30);
  assert.ok(outline.every(point => point.every(Number.isFinite)));
  assert.doesNotMatch(extractFunction(html, 'drawNaturalPenStroke'), /ctx\.arc/);
  assert.doesNotMatch(extractFunction(html, 'drawNaturalPenOutline'), /ctx\.arc/);
  assert.match(extractFunction(html, 'drawNaturalPenOutline'), /ctx\.closePath\(\);ctx\.fill\(\)/);
});

test('capture, v8 persistence, transforms, bounds, and legacy fallback stay aligned', async () => {
  const htmls = await Promise.all(variants.map(file => readFile(file, 'utf8')));
  for (const html of htmls) {
    assert.doesNotMatch(html, /getCoalescedEvents/);
    assert.doesNotMatch(html, /naturalPenSpeedFactor/);
    assert.match(html, /activePointerId=e\.pointerId/);
    assert.match(html, /const simulatePressure=e\.pressure===\.5/);
    assert.match(html, /pressures:\[\], simulatePressure, lastCommittedPoint:null/);
    assert.match(html, /appendNaturalPenPoint\(e,true\)/);
    assert.match(html, /o\.simulatePressure!==false/);
    assert.match(html, /function penPointBounds\(o,padding=0\)/);
    assert.match(html, /const outline=perfectFreehandStroke\(o\)\.outline/);
    assert.match(html, /return \{\.\.\.p,x:/);
    assert.match(html, /target\.lastCommittedPoint=mapPointBetweenBoxes/);
    assert.match(html, /const DOC_VERSION=8/);
    assert.match(html, /else if\(roughness === 'clean'/);
  }
  for (const name of [
    'pfSimulatePressure',
    'pfStrokePoints',
    'pfStrokeOutline',
    'perfectFreehandStroke',
    'drawNaturalPenStroke',
    'appendNaturalPenPoint',
  ]) {
    assert.equal(extractFunction(htmls[0], name), extractFunction(htmls[1], name), `${name} differs`);
  }
});
