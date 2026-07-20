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

test('selecting the pen enables an automatic lock without changing manual lock semantics', async () => {
  for (const file of files) {
    const html = await source(file);
    const toolSelection = between(html, 'function setActiveTool(tool, openPicker=false){', 'function activateImageTool(){');

    assert.match(html, /let penAutoLocked = false;/);
    assert.match(toolSelection, /tool!=='pen' && penAutoLocked/);
    assert.match(toolSelection, /toolLocked=false;\s*penAutoLocked=false;/);
    assert.match(toolSelection, /tool==='pen' && !toolLocked/);
    assert.match(toolSelection, /toolLocked=true;\s*penAutoLocked=true;/);
    assert.match(toolSelection, /updateLockButton\(\);\s*state\.tool=tool;/);
    assert.match(html, /toolLocked=!toolLocked; penAutoLocked=false; updateLockButton\(\)/);
    assert.match(html, /p:'pen'/);
    assert.match(html, /'7':'pen'/);
  }
});

test('pen auto-lock implementation stays aligned between both whiteboard variants', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const feature = html => between(html, 'let toolLocked = false;', 'function updateToolHelp(){');
  const selection = html => between(html, 'function setActiveTool(tool, openPicker=false){', 'function activateImageTool(){');

  assert.equal(feature(privateApp), feature(commercialTemplate));
  assert.equal(selection(privateApp), selection(commercialTemplate));
});
