import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

async function source(name) {
  return readFile(resolve(root, name), 'utf8');
}

test('both whiteboard variants support marquee multi-selection', async () => {
  for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.match(html, /id="marqueeBox" aria-hidden="true"/);
    assert.match(html, /let selectedIndices = new Set\(\)/);
    assert.match(html, /function selectObjectsInMarquee\(\)/);
    assert.match(html, /action='marquee'/);
    assert.match(html, /selectionBox\.classList\.toggle\('multi',multi\)/);
  }
});

test('multi-selected objects move and delete as one history operation', async () => {
  for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.match(html, /indices\.forEach\(i=>translateObject\(state\.scene\[i\],dx,dy\)\)/);
    assert.match(html, /indices\.sort\(\(a,b\)=>b-a\)\.forEach\(i=>state\.scene\.splice\(i,1\)\)/);
    assert.match(html, /if\(!movePushed\)\{ pushHistory\(\); movePushed=true; \}/);
    assert.match(html, /const indices=selectedSceneIndices\(\);\s+if\(!indices\.length\) return false;\s+pushHistory\(\);/);
  }
});

test('multi-selection keeps single-object resize, rotate, and text editing guarded', async () => {
  for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
    const html = await source(file);
    assert.ok((html.match(/if\(selectedSceneIndices\(\)\.length!==1\) return;/g) || []).length >= 2);
    assert.match(html, /function beginSelectedTextEdit\(\)\{\s+if\(selectedSceneIndices\(\)\.length!==1\) return false;/);
    assert.match(html, /function selectedObj\(\)\{ return selectedSceneIndices\(\)\.length===1/);
  }
});
