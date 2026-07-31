import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root=resolve(import.meta.dirname,'..');
const files=['whiteboard.html','whiteboard-pro.html'];
const source=name=>readFile(resolve(root,name),'utf8');

function between(html,start,end){
  const from=html.indexOf(start);
  const to=html.indexOf(end,from+start.length);
  assert.notEqual(from,-1,`missing ${start}`);
  assert.notEqual(to,-1,`missing ${end}`);
  return html.slice(from,to);
}

test('both whiteboards expose the adjustable rounded-rectangle magnifier',async()=>{
  for(const file of files){
    const html=await source(file);
    assert.match(html,/data-tool="magnifier"[^>]*title="放大镜 \(M\)"/);
    assert.match(html,/id="magnifierBox"[^>]*aria-label="放大镜调整框"/);
    assert.equal((html.match(/class="magnifier-handle" data-h="(?:nw|ne|sw|se)"/g)||[]).length,4);
    assert.match(html,/id="magnifierZoom" min="120" max="500" step="10"/);
    assert.match(html,/MAGNIFIER_DEFAULTS=\{width:280,height:150,zoom:2\}/);
    assert.match(html,/MAGNIFIER_PREFS_KEY='wb_magnifier_preferences_v1'/);
  }
});

test('magnifier samples the composed board before drawing its own overlay',async()=>{
  for(const file of files){
    const html=await source(file);
    const renderer=between(html,'function render(opts={}){','function worldToScreen(');
    assert.match(renderer,/drawSlideRevealOverlay\(\);\s*drawSlideTransitionOverlay\(\);\s*drawMagnifierOverlay\(\);/);
    const magnifier=between(html,'function drawMagnifierOverlay(){','function render(opts={}){');
    assert.match(magnifier,/r\.w\/magnifier\.zoom\*dpr/);
    assert.match(magnifier,/magnifierSampleCtx\.drawImage\(board/);
    assert.match(magnifier,/roundRectPath\(ctx/);
    assert.match(magnifier,/ctx\.drawImage\(magnifierSampleCanvas/);
    const recording=between(html,'function drawRecFrame(){','function drawPlanWatermarks(');
    assert.match(recording,/recCtx\.drawImage\(board/);
  }
});

test('magnifier is transient but its size and zoom preferences are local',async()=>{
  for(const file of files){
    const html=await source(file);
    const documentWriter=between(html,'function currentDoc(){','function flashStatus(');
    assert.doesNotMatch(documentWriter,/magnifier/i);
    assert.match(html,/localStorage\.setItem\(MAGNIFIER_PREFS_KEY/);
    assert.match(html,/if\(e\.key==='Escape' && state\.tool==='magnifier' && hideMagnifier\(\)\)/);
    const keyboardShortcuts=between(html,'// 键盘快捷键',"window.addEventListener('keyup'");
    assert.ok(
      keyboardShortcuts.indexOf("state.tool==='magnifier'") < keyboardShortcuts.indexOf("target.tagName==='TEXTAREA'"),
      'Escape should hide the magnifier even when its zoom slider has focus',
    );
    assert.match(html,/m:'magnifier'/);
    assert.match(html,/if\(previousIndex!==index&&magnifier\.visible\)/);
  }
});

test('mouse and touch paths support moving, free resizing, and pinch rollback',async()=>{
  for(const file of files){
    const html=await source(file);
    assert.match(html,/action='magnifier-move'/);
    assert.match(html,/magnifier\.target=toWorld\(e\.clientX-offset\.x,e\.clientY-offset\.y\)/);
    assert.match(html,/function resizeMagnifierAt\(clientX,clientY\)/);
    assert.match(html,/magnifier\.width=right-left;\s*magnifier\.height=bottom-top;/);
    assert.match(html,/magnifier:cloneSceneObject\(magnifier\)/);
    assert.match(html,/magnifier=baseline\.magnifier/);
  }
});

test('magnifier implementation stays aligned between both whiteboards',async()=>{
  const [creator,pro]=await Promise.all(files.map(source));
  const toolbar=html=>between(html,'<div class="toolbar" id="toolbar">','<div id="toolHelp">');
  const renderFeature=html=>between(html,'function magnifierScreenRect(){','function render(opts={}){');
  const resizeFeature=html=>between(html,'function resizeMagnifierAt(clientX,clientY){','const rotateHandle=selectionBox.querySelector');
  assert.equal(toolbar(creator),toolbar(pro));
  assert.equal(renderFeature(creator),renderFeature(pro));
  assert.equal(resizeFeature(creator),resizeFeature(pro));
});
