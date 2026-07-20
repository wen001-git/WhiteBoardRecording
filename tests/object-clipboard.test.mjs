import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

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

test('both variants copy and paste single or multi-selected scene objects', async () => {
  for (const file of variants) {
    const html = await source(file);
    const copyBody = extractFunction(html, 'copySelectedObjects');
    const pasteBody = extractFunction(html, 'pasteCopiedObjects');

    assert.match(copyBody, /const indices=selectedSceneIndices\(\)/);
    assert.match(copyBody, /indices\.map\(i=>cloneSceneObject\(state\.scene\[i\]\)\)/);
    assert.equal((pasteBody.match(/pushHistory\(\)/g) || []).length, 1);
    assert.match(pasteBody, /translateObject\(copy,offset,offset\)/);
    assert.match(pasteBody, /state\.scene\.push\(\.\.\.copies\)/);
    assert.match(pasteBody, /setSelectedIndices\(copies\.map/);
  }
});

test('copy, paste, and duplicate shortcuts preserve native text and image clipboard behavior', async () => {
  for (const file of variants) {
    const html = await source(file);
    assert.match(html, /window\.addEventListener\('copy'/);
    assert.match(html, /target\.isContentEditable\)\) return/);
    assert.match(html, /setData\('text\/plain',SCENE_CLIPBOARD_MARKER\)/);
    assert.match(html, /getData\('text\/plain'\)===SCENE_CLIPBOARD_MARKER/);
    assert.match(html, /e\.key\.toLowerCase\(\)==='d' && duplicateSelectedObjects\(\)/);
    assert.match(html, /item\.type\.startsWith\('image\/'\)/);
  }
});
