import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const variants = ['whiteboard.html', 'whiteboard-pro.html'];

async function source(name) {
  return readFile(resolve(root, name), 'utf8');
}

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

test('arrow heads grow with long shafts while staying bounded', async () => {
  for (const file of variants) {
    const html = await source(file);
    const geometry = vm.runInNewContext(`(${extractFunction(html, 'arrowHeadGeometry')})`);

    assert.equal(geometry(0, 0, 330, 0, 2).length, 38);
    assert.equal(geometry(0, 0, 100, 0, 2).length, 18);
    assert.equal(geometry(0, 0, 20, 0, 2).length, 12.4);
    assert.equal(geometry(0, 0, 330, 0, 2).spread, 0.56);
  }
});

test('clean and sketch arrows share the clearer head geometry', async () => {
  for (const file of variants) {
    const html = await source(file);
    const clean = extractFunction(html, 'drawArrow');
    const sketch = extractFunction(html, 'roughArrow');
    const bounds = extractFunction(html, 'objectBounds');

    assert.match(clean, /arrowHeadGeometry\(x1,y1,x2,y2,w\)/);
    assert.match(sketch, /arrowHeadGeometry\(x1,y1,x2,y2,w\)/);
    assert.match(bounds, /arrowHeadGeometry\(o\.x1,o\.y1,o\.x2,o\.y2,o\.width\|\|4\)\.length/);
  }
});
