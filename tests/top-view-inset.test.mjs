import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const files = ['whiteboard.html', 'whiteboard-pro.html'];

async function source(name) {
  return readFile(resolve(root, name), 'utf8');
}

function section(html, start, end) {
  const from = html.indexOf(start);
  assert.notEqual(from, -1, `missing anchor: ${start}`);
  const to = html.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing end anchor: ${end}`);
  return html.slice(from, to);
}

test('whiteboard defines a top view inset that pulls the canvas below the toolbar', async () => {
  for (const file of files) {
    const html = await source(file);
    assert.match(html, /const TOP_VIEW_INSET_PX\s*=\s*\d{2,3};/,
      `${file} exposes a TOP_VIEW_INSET_PX constant`);
    const value = Number((html.match(/const TOP_VIEW_INSET_PX\s*=\s*(\d+);/) || [])[1]);
    assert.ok(value >= 80 && value <= 160,
      `${file} keeps the inset between 80 and 160 pixels (got ${value})`);
  }
});

test('centerViewOnWorld centers vertically with the inset reserved for the toolbar + titles', async () => {
  for (const file of files) {
    const html = await source(file);
    const fn = section(html, 'function centerViewOnWorld(', 'render();\n}');
    assert.match(fn, /window\.innerHeight\s*-\s*TOP_VIEW_INSET_PX\s*\)\s*\/\s*2\s*-\s*p\.y\s*\*\s*state\.view\.scale/,
      `${file} uses the inset when picking the world point to vertically center on`);
  }
});

test('fitViewToRect also shrinks the available height by the inset', async () => {
  for (const file of files) {
    const html = await source(file);
    const fn = section(html, 'function fitViewToRect(', '\n}\n\nfunction '); // 抓整段函数体直到下一个 function
    assert.match(fn, /availH=\(window\.innerHeight-TOP_VIEW_INSET_PX\)\*marginRatio/,
      `${file} trims the available vertical area by TOP_VIEW_INSET_PX`);
    assert.match(fn, /state\.view\.y=TOP_VIEW_INSET_PX\+\(window\.innerHeight-TOP_VIEW_INSET_PX\)\/2 - cy\*scale/,
      `${file} centers the fitted slide inside the viewport below the top inset`);
  }
});

test('top-view-inset implementation stays aligned between the creator and the pro template', async () => {
  const [a, b] = await Promise.all(files.map(source));
  const slice = html => [
    /const TOP_VIEW_INSET_PX\s*=\s*\d+;/.exec(html)?.[0] || '',
    section(html, 'function centerViewOnWorld(', 'render();\n}'),
    section(html, 'function fitViewToRect(', '\n}\n\nfunction '),
  ].join('\n');
  assert.equal(slice(a), slice(b));
});
