import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const apps = ['whiteboard.html', 'whiteboard-pro.html'];
const assets = [
  ['纸张便签·暖白横版', 'warm-white-horizontal.webp', 480, 312],
  ['纸张便签·米黄横版', 'warm-beige-horizontal.webp', 480, 281],
  ['纸张便签·浅灰横版', 'cool-gray-horizontal.webp', 480, 237],
  ['纸张便签·暖白竖版', 'warm-white-vertical.webp', 342, 480],
  ['纸张便签·米黄竖版', 'warm-beige-vertical.webp', 333, 480],
  ['纸张便签·浅灰竖版', 'cool-gray-vertical.webp', 370, 480],
];

async function source(file) {
  return readFile(resolve(root, file), 'utf8');
}

function assetBlock(html) {
  const start = html.indexOf('// PAPER_NOTE_ASSETS_START');
  const end = html.indexOf('// PAPER_NOTE_ASSETS_END', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return html.slice(start, end);
}

function embeddedBase64(block, name) {
  const start = block.indexOf(`{name:'${name}'`);
  const end = block.indexOf('}', start);
  assert.notEqual(start, -1, `${name} is embedded`);
  assert.notEqual(end, -1, `${name} entry closes`);
  const object = block.slice(start, end + 1);
  const dataStart = object.indexOf("src:'data:image/webp;base64,'+");
  assert.notEqual(dataStart, -1, `${name} uses an inline WebP`);
  return [...object.slice(dataStart).matchAll(/'([A-Za-z0-9+/=]+)'/g)]
    .map((match) => match[1])
    .join('');
}

test('six generated paper-note assets are embedded identically in both whiteboards', async () => {
  const html = await Promise.all(apps.map(source));
  const blocks = html.map(assetBlock);
  assert.equal(blocks[0], blocks[1]);
  assert.equal((blocks[0].match(/kind:'paperNote'/g) || []).length, 6);

  for (const [name, file, width, height] of assets) {
    assert.match(blocks[0], new RegExp(`name:'${name}',kind:'paperNote',w:${width},h:${height}`));
    const bytes = await readFile(resolve(root, 'assets/stickers/paper-notes', file));
    assert.equal(Buffer.from(embeddedBase64(blocks[0], name), 'base64').compare(bytes), 0);
  }
});

test('paper notes use one transformable editable object throughout the interaction paths', async () => {
  for (const file of apps) {
    const html = await source(file);
    assert.match(html, /\{id:'paper',label:'纸张便签',stickers:PAPER_NOTE_STICKERS\}/);
    assert.match(html, /function beginPendingPaperNote\(src,nw,nh\)/);
    assert.match(html, /pendingImage=\{[\s\S]*?type:'paperNote'/);
    assert.match(html, /if\(placed\.type==='paperNote'\)[\s\S]*?beginLabelEdit\(index\)/);
    assert.match(html, /\['pen','arrow','line','rect','ellipse','diamond','text','image','paperNote'\]/);
    assert.match(html, /o\.type==='image'\|\|o\.type==='paperNote'/);
    assert.match(html, /o\.type==='rect'\|\|o\.type==='ellipse'\|\|o\.type==='diamond'\|\|o\.type==='paperNote'/);
    assert.match(html, /if\(orig\.type==='paperNote'\)[\s\S]*?target\.labelFontSize/);
    assert.match(html, /sticker\.kind==='paperNote'\) beginPendingPaperNote/);
  }
});

test('paper-note labels and asset sync commands remain bilingual and reproducible', async () => {
  const [phrases, pkg, script] = await Promise.all([
    source('locales/whiteboard-phrases.js'),
    source('package.json'),
    source('scripts/sync-paper-note-assets.mjs'),
  ]);
  assert.match(phrases, /\['纸张便签','Paper notes'\]/);
  for (const [name] of assets) assert.ok(phrases.includes(`['${name}'`));
  assert.match(pkg, /"sync:paper-notes": "node scripts\/sync-paper-note-assets\.mjs"/);
  assert.match(script, /\['whiteboard\.html', 'whiteboard-pro\.html'\]/);
});
