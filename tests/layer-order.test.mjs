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

test('both whiteboard variants expose four layer controls for any selected object', async () => {
  for (const file of variants) {
    const html = await source(file);
    assert.match(html, /id="layerGroup"/);
    assert.equal((html.match(/data-layer-action="(?:back|backward|forward|front)"/g) || []).length, 4);
    assert.match(html, /const hasLayerSelection=!isEditingText && state\.tool==='select' && selectedSceneIndices\(\)\.length>0/);
    assert.match(html, /document\.getElementById\('layerGroup'\)\.style\.display = hasLayerSelection\?'block':'none'/);
  }
});

test('layer ordering supports front, back, and one-step moves while preserving selected order', async () => {
  for (const file of variants) {
    const html = await source(file);
    const fn = vm.runInNewContext(`(${extractFunction(html, 'reorderedSceneForLayer')})`);
    const scene = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id }));
    const selected = new Set([scene[1], scene[3]]);
    const ids = action => fn(scene, selected, action).map(item => item.id);

    assert.deepEqual(ids('back'), ['B', 'D', 'A', 'C', 'E']);
    assert.deepEqual(ids('backward'), ['B', 'A', 'D', 'C', 'E']);
    assert.deepEqual(ids('forward'), ['A', 'C', 'B', 'E', 'D']);
    assert.deepEqual(ids('front'), ['A', 'C', 'E', 'B', 'D']);

    const contiguous = new Set([scene[1], scene[2]]);
    assert.deepEqual(fn(scene, contiguous, 'backward').map(item => item.id), ['B', 'C', 'A', 'D', 'E']);
    assert.deepEqual(fn(scene, contiguous, 'forward').map(item => item.id), ['A', 'D', 'B', 'C', 'E']);
  }
});

test('layer changes keep selection and create exactly one undo snapshot', async () => {
  for (const file of variants) {
    const html = await source(file);
    const reorderBody = extractFunction(html, 'reorderSelectedLayer');
    assert.equal((reorderBody.match(/pushHistory\(\)/g) || []).length, 1);
    assert.match(reorderBody, /setSelectedIndices\(state\.scene\.map/);
    assert.match(html, /btn\.disabled=!indices\.length \|\| !next\.some/);
  }
});
