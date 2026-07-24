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

test('top controls expose a main menu, colorful direct background, direct save, shape, asset and more menus', async () => {
  for (const file of files) {
    const html = await source(file);
    const toolbar = between(html, '<div class="toolbar" id="toolbar">', '<div id="toolHelp">');
    const documents = between(html, '<!-- 左上角：主菜单 + 高频保存备份 + 自动保存状态 -->', '<input id="fileInput"');

    for (const id of [
      'shapeToolTrigger', 'shapeToolMenu', 'assetToolTrigger', 'assetToolMenu',
      'moreToolTrigger', 'moreToolMenu', 'clearBtn',
    ]) {
      assert.match(toolbar, new RegExp(`id="${id}"`), `${file} is missing ${id}`);
    }
    for (const tool of ['ellipse', 'rect', 'diamond', 'arrow', 'line']) {
      assert.match(toolbar, new RegExp(`data-tool="${tool}"`), `${file} is missing ${tool}`);
    }
    for (const id of ['docMenuBtn', 'docActions', 'docNew', 'docOpen', 'docSave', 'docSaveQuick', 'canvasBgBtn']) {
      assert.match(documents, new RegExp(`id="${id}"`), `${file} is missing ${id}`);
    }
    assert.match(documents, /id="docMenuBtn"[^>]*aria-label="主菜单"/);
    assert.match(documents, /M5 7h14M5 12h14M5 17h14/);
    assert.match(documents, />新建白板<\/span>/);
    assert.match(documents, />打开文件…<\/span>/);
    assert.match(documents, />保存到文件…<\/span>/);
    assert.match(documents, /class="iconbtn direct-canvas-bg" id="canvasBgBtn"/);
    assert.match(documents, /class="canvas-bg-indicator"/);
    for (const color of ['#ff8c8c', '#f2c94c', '#6fcf97', '#7a76e8']) {
      assert.match(documents, new RegExp(`fill:${color}`));
    }
    assert.equal((documents.match(/M5 3h12l2 2v16H5z/g) || []).length, 2);
    assert.match(documents, /class="doc-menu-shortcut">Ctrl\/⌘ S<\/span>/);
    assert.match(html, /\.doc-actions\.show\{display:block;\}/);
    assert.match(html, /\.doc-actions \.doc-menu-item\{[^}]*min-height:44px/);
  }
});

test('direct save, menu save and keyboard shortcut reuse exportDoc', async () => {
  for (const file of files) {
    const html = await source(file);
    assert.match(html, /document\.getElementById\('docSave'\)\.onclick=exportDoc;/);
    assert.match(html, /document\.getElementById\('docSaveQuick'\)\.onclick=exportDoc;/);
    assert.match(html, /if\(meta && e\.key\.toLowerCase\(\)==='s'\)\{ e\.preventDefault\(\); exportDoc\(\); return; \}/);
    assert.match(html, /else\{ closeFileMenu\(\); openCanvasBackgroundPopover\(\); \}/);
    assert.match(html, /indicator\.style\.background=current/);
    assert.match(html, /closeCanvasBackgroundPopover\(true\)/);
  }
});

test('top controls use measured collision layout and viewport observers', async () => {
  for (const file of files) {
    const html = await source(file);
    const feature = between(html, '/* ---------------------- RESPONSIVE TOP CONTROLS ----------------------- */', '// 样式面板');

    assert.match(feature, /function syncTopControlsLayout\(\)/);
    assert.match(feature, /getBoundingClientRect\(\)/);
    assert.match(feature, /topRectsOverlapVertically/);
    assert.match(html, /<div class="topleft compact-doc">/);
    assert.match(feature, /classList\.add\('compact-mode'\)/);
    assert.match(feature, /classList\.add\('scroll-mode'\)/);
    assert.match(feature, /new ResizeObserver\(queueTopControlsLayout\)/);
    assert.match(feature, /visualViewport\?\./);
    assert.match(feature, /orientationchange/);
    assert.match(feature, /aria-expanded/);
    assert.match(feature, /\(e\.key==='Enter'\|\|e\.key===' '\)&&index>=0/);
    assert.match(html, /@media \(pointer:coarse\)\{\s*\.toolbar \.tool\{width:44px;height:44px;\}/);
  }
});

test('responsive top-control implementation stays aligned between both whiteboards', async () => {
  const [privateApp, commercialTemplate] = await Promise.all(files.map(source));
  const toolbar = html => between(html, '<div class="toolbar" id="toolbar">', '<div id="toolHelp">');
  const documents = html => between(html, '<!-- 左上角：主菜单 + 高频保存备份 + 自动保存状态 -->', '<input id="fileInput"');
  const feature = html => between(html, '/* ---------------------- RESPONSIVE TOP CONTROLS ----------------------- */', '// 样式面板');

  assert.equal(toolbar(privateApp), toolbar(commercialTemplate));
  assert.equal(documents(privateApp), documents(commercialTemplate));
  assert.equal(feature(privateApp), feature(commercialTemplate));
});
