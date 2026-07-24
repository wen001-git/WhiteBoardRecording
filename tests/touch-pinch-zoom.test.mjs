import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const variants = ['whiteboard.html', 'whiteboard-pro.html'];

function extractFunction(html, name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = html.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  assert.fail(`${name} should have a complete body`);
}

test('both variants route two canvas touches into a pinch gesture', async () => {
  for (const file of variants) {
    const html = await readFile(resolve(root, file), 'utf8');
    assert.match(html, /const canvasTouchPoints=new Map\(\)/);
    assert.match(html, /canvasTouchPoints\.size>=2\)\{\s*canvasTouchGestureActive=true;\s*beginCanvasPinchGesture\(true\)/);
    assert.match(html, /if\(e&&finishCanvasTouchPointer\(e\)\) return/);
    assert.match(html, /if\(!canvasTouchPoints\.size\)\{\s*canvasTouchGestureActive=false/);
  }
});

test('pinch keeps the anchored world point under the moving midpoint', async () => {
  for (const file of variants) {
    const html = await readFile(resolve(root, file), 'utf8');
    const updateSource = extractFunction(html, 'updateCanvasPinchGesture');
    const context = {
      canvasPinchGesture: {
        ids: [1, 2],
        startDistance: 100,
        startScale: 1,
        anchor: { x: 100, y: 50 }
      },
      canvasTouchPoints: new Map([
        [1, { id: 1, x: 100, y: 100 }],
        [2, { id: 2, x: 300, y: 100 }]
      ]),
      state: { view: { x: 0, y: 0, scale: 1 } },
      render() {},
      updateZoomLabel() {}
    };
    vm.runInNewContext(`(${updateSource})()`, context);

    assert.equal(context.state.view.scale, 2);
    assert.equal(context.state.view.x, 0);
    assert.equal(context.state.view.y, 0);
  }
});
