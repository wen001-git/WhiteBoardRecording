import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const variants = ['whiteboard.html', 'whiteboard-pro.html'];
const source = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

function between(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing start marker: ${start}`);
  assert.notEqual(to, -1, `missing end marker: ${end}`);
  return text.slice(from, to);
}

test('both whiteboard variants expose a per-slide element cue bar', async () => {
  for (const file of variants) {
    const html = await source(file);
    assert.match(html, /id="elementCueAddSelected"[^>]*data-i18n="slide\.cue\.add"/);
    assert.match(html, /id="elementCueControl"[^>]*data-i18n-aria="slide\.cue\.bar"/);
    assert.match(html, /id="elementCueItems"/);
    assert.match(html, /id="elementCueHideAll"[^>]*data-i18n="slide\.cue\.hideAll"/);
    assert.match(html, /id="elementCueShowAll"[^>]*data-i18n="slide\.cue\.showAll"/);
    assert.match(html, /\.element-cue-items?|#elementCueItems/);
    assert.match(html, /#elementCueItems\{[^}]*flex-wrap:wrap[^}]*overflow:visible/);
    assert.doesNotMatch(html, /#elementCueItems\{[^}]*overflow-x:auto/);
    assert.match(html, /syncSlideRevealStyleUI\(\);\s*renderElementCueControl\(\);\s*slideRevealPopover\.classList\.add/);
  }
});

test('v9 documents persist stable object IDs and cue bindings, not runtime visibility', async () => {
  for (const file of variants) {
    const html = await source(file);
    assert.match(html, /const DOC_VERSION=9/);
    assert.match(html, /function ensureSceneObjectIds\(scene=state\.scene\)/);
    assert.match(html, /function normalizeElementCues\(value,validIds=null\)/);
    assert.match(html, /elementCues:normalizeElementCues\(s&&s\.elementCues,validObjectIds\)/);
    assert.match(html, /slideElementCues:state\.slides\.map/);
    assert.match(html, /elementCueHiddenBySlide\.clear\(\)/);
    const currentDoc = between(html, 'function currentDoc(){', 'function flashStatus(');
    assert.match(currentDoc, /slides:state\.slides/);
    assert.doesNotMatch(currentDoc, /elementCueHiddenBySlide/);
  }
});

test('cue controls reveal with a 200ms canvas fade and can hide without changing recording state', async () => {
  for (const file of variants) {
    const html = await source(file);
    const runtime = between(html, 'const elementCueHiddenBySlide=new Map();', 'const slideRevealReduceMotion=');
    assert.match(runtime, /duration:slideRevealReduceMotion\?1:200/);
    assert.match(runtime, /cancelSlideReveal\(\)/);
    assert.match(runtime, /render\(\{skipSave:true\}\)/);
    const render = between(html, 'function render(opts={}){', 'function worldToScreen(');
    assert.match(render, /if\(isElementCueObjectHidden\(state\.scene\[i\]\)\) continue/);
    assert.match(render, /drawObject\(state\.scene\[i\],\{alpha:elementCueObjectAlpha\(state\.scene\[i\]\)\}\)/);
    const pause = between(html, 'function pauseRecording(){', 'function stopRecording(){');
    assert.doesNotMatch(pause, /elementCue/);
    assert.match(html, /if\(recState==='paused'\) return;\s*drawRecFrame\(\)/);
  }
});

test('cue bar expands above the reveal control while the reveal control stays in its original position', async () => {
  for (const file of variants) {
    const html = await source(file);
    const position = between(html, 'function positionElementCueControl(){', "let elementCueRenderKey='';");
    assert.match(position, /const revealRect=revealControl\.getBoundingClientRect\(\)/);
    assert.match(position, /const y=Math\.max\(edge,revealRect\.top-height-gap\)/);
    assert.match(position, /control\.dataset\.dock='above-reveal'/);
    assert.doesNotMatch(position, /sideSpace|overflow-x/);
    const revealPosition = between(html, 'function positionSlideRevealButton(){', 'function positionSlideRevealPopover(){');
    assert.match(revealPosition, /const y=clamp\(r\.top-bh-4,edge,innerHeight-bh-edge\)/);
    assert.doesNotMatch(revealPosition, /cueStack|cuePlacement/);
  }
});

test('cue bindings prune deleted or moved objects and copied objects receive new IDs', async () => {
  for (const file of variants) {
    const html = await source(file);
    const prune = between(html, 'function pruneElementCues(){', 'const slideRevealReduceMotion=');
    assert.match(prune, /objectBelongsToSlide\(o,slide\)/);
    assert.match(prune, /normalizeElementCues\(slide\.elementCues/);
    const paste = between(html, 'function pasteCopiedObjects(){', 'function duplicateSelectedObjects(){');
    assert.match(paste, /cloneSceneObject\(o\)/);
    assert.match(html, /if\(!valid\) o\.objectId=sceneObjectId\(\)/);
  }
});

test('element cue implementation stays aligned between both whiteboard variants', async () => {
  const [creator, pro] = await Promise.all(variants.map(source));
  const start = 'function sceneObjectId(){';
  const end = 'const slideRevealReduceMotion=';
  assert.equal(between(creator, start, end), between(pro, start, end));
  assert.equal(
    between(creator, 'function positionElementCueControl(){', "let elementCueRenderKey='';"),
    between(pro, 'function positionElementCueControl(){', "let elementCueRenderKey='';")
  );
});
