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

test('text editing caret uses thin theme colors for light and dark backgrounds', async () => {
  for (const file of files) {
    const html = await source(file);
    const style = section(html, 'function applyTextInputStyle(){', '\n}\nlet textCaretSyncFrame');

    assert.match(html, /id="textCaretIndicator" aria-hidden="true"/,
      `${file} has a recording-safe DOM caret indicator`);
    assert.match(html, /#textCaretIndicator\{[^}]*width:1\.5px/,
      `${file} renders a natural 1.5px caret`);
    assert.match(style, /isDarkBackground\(bg\)\?'#ffd84d':'#5b57d6'/,
      `${file} uses yellow on dark backgrounds and purple on light backgrounds`);
    assert.doesNotMatch(style, /boxShadow|caretEdge/,
      `${file} keeps the thin caret free of glow and outline effects`);
  }
});

test('custom caret follows collapsed selection and hides outside text editing', async () => {
  for (const file of files) {
    const html = await source(file);
    const sync = section(html, 'function syncTextCaretIndicator(){', '\n}\nfunction textObjectFromInput');

    assert.match(sync, /document\.activeElement!==textInput/,
      `${file} only shows the custom caret while the editor has focus`);
    assert.match(sync, /!info\.range\.collapsed/,
      `${file} hides the caret for a non-collapsed text selection`);
    assert.match(sync, /textCaretScreenRect\(info\.range\)/,
      `${file} positions the caret at the actual DOM selection`);
    assert.match(html, /measureCharacter\(node,offset-1,offset,true\)/,
      `${file} measures the preceding character when Chromium gives a zero-sized collapsed range`);
    assert.match(html, /probe\.insertNode\(marker\)/,
      `${file} measures empty lines with a temporary zero-width marker`);
    assert.match(html, /document\.addEventListener\('selectionchange'/,
      `${file} updates the custom caret when the selection moves`);
    assert.match(html, /function commitText\(\)\{[\s\S]{0,160}textCaretIndicator\.style\.display='none'/,
      `${file} hides the caret when text is committed`);
    assert.match(html, /function cancelTextInput\(\)\{[\s\S]{0,160}textCaretIndicator\.style\.display='none'/,
      `${file} hides the caret when editing is cancelled`);
  }
});

test('caret implementation stays aligned between creator and pro whiteboards', async () => {
  const [creator, pro] = await Promise.all(files.map(source));
  const slice = html => [
    section(html, '#textCaretIndicator{', '\n  @keyframes textCaretPulse'),
    section(html, 'function applyTextInputStyle(){', '\n}\nfunction textObjectFromInput'),
    section(html, "textInput.addEventListener('focus'", '\n});\n\n// 编辑态按键提示'),
  ].join('\n');

  assert.equal(slice(creator), slice(pro));
});
