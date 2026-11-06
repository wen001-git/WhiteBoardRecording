import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const files=['whiteboard.html','whiteboard-pro.html'];
const sources=await Promise.all(files.map(name=>readFile(resolve(root,name),'utf8')));
const plain=value=>JSON.parse(JSON.stringify(value));
function between(html,start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`missing ${start} / ${end}`);
  return html.slice(a,b);
}
function harness(html,{pro=true,slides,scene,activeSlide=0}={}){
  let next=0;
  const elements=new Map();
  const context={
    state:{slides:plain(slides||[{id:'first',x:0,y:0,w:100,h:160,backgroundColor:null,backgroundTexture:null}]),scene:plain(scene||[]),activeSlide,undoStack:[],redoStack:[],canvasBackground:'#ffffff',canvasBackgroundTexture:'paper'},
    recState:'idle',IS_PRO:pro,SLIDE_GAP:80,DEFAULT_CANVAS_BACKGROUND:'#ffffff',
    commitCount:0,saves:0,selected:[],upgrades:[],
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{disabled:false,querySelector:()=>({scrollIntoView:()=>{context.scrolled=true;},remove:()=>{}})});return elements.get(id);}},
    window:{i18n:{t:key=>key}},
    commitText:()=>{context.commitCount++;context.commitPending?.();},
    sceneObjectId:()=>`object-new-${++next}`,slideId:()=>`slide-new-${++next}`,elementCueId:()=>`cue-new-${++next}`,
    normalizeCanvasColor:(value,fallback)=>value??fallback,normalizeCanvasTexture:(value,fallback)=>value??fallback,
    normalizeSlideTransition:value=>value||{type:'none',speed:'normal',sound:'none',volume:.6},
    defaultSlideRevealSetting:()=>({style:'pencil',autoPlay:false}),normalizeSlideRevealSetting:value=>value||{style:'pencil',autoPlay:false},
    normalizeElementCueAudio:value=>value||{sound:'none',volume:.6},defaultElementCueAudio:()=>({sound:'none',volume:.6}),
    slideTransitionFor:slide=>context.normalizeSlideTransition(slide.transition),slideRevealFor:slide=>context.normalizeSlideRevealSetting(slide.reveal),elementCueAudioFor:slide=>context.normalizeElementCueAudio(slide.elementCueAudio),
    transformBounds:()=>null,
    objectBounds:o=>o.type==='pen'?{x:Math.min(...o.points.map(p=>p.x)),y:Math.min(...o.points.map(p=>p.y)),w:10,h:10}:o,
    render:()=>{},renderSlidePanel:()=>{},clearSelection:()=>{context.cleared=true;},
    syncCanvasBackgroundUI:()=>{},syncSlideTransitionUI:()=>{},syncSlideRevealStyleUI:()=>{},cancelSlideReveal:()=>{},cancelSlideTransition:()=>{},
    selectSlide:(index,options)=>{context.state.activeSlide=index;context.selected.push({index,options});},
    scheduleSave:()=>{context.saves++;},flashStatus:message=>{context.message=message;},requirePro:reason=>context.upgrades.push(reason),
  };
  context.state.slides=context.state.slides.map(slide=>({backgroundColor:null,backgroundTexture:null,transition:context.normalizeSlideTransition(),reveal:context.normalizeSlideRevealSetting(),elementCues:[],elementCueAudio:context.normalizeElementCueAudio(),...slide}));
  vm.createContext(context);
  const code=[
    between(html,'function ensureSceneObjectIds(','function elementCueId('),
    between(html,'function normalizeElementCues(','const ELEMENT_CUE_SOUNDS='),
    between(html,'function cloneSceneObject(','let sceneClipboard='),
    between(html,'function translateObject(','function cancelPendingImage('),
    between(html,'function rectCenterPoint(','function deleteSlide('),
    between(html,'function deleteSlide(','function resizeSlidesToRatio('),
    between(html,'function snapshot(','/* ------------------------ TOOLS (pointer)'),
  ].join('\n');
  vm.runInContext(code,context);
  return context;
}

for(const [i,file] of files.entries()){
  const html=sources[i];
  test(`${file}: copy preserves content and settings, remaps IDs, and shifts later pages`,()=>{
    const slides=[{id:'first',x:20,y:30,w:100,h:160,backgroundColor:'#14213d',backgroundTexture:'kraft',transition:{type:'fade',speed:'slow',sound:'soft',volume:.4},reveal:{style:'text',autoPlay:true},elementCues:[{id:'cue-original',name:'Show title',objectIds:['title','absent']}],elementCueAudio:{sound:'click',volume:.8}},{id:'later',x:200,y:30,w:100,h:160}];
    const scene=[{objectId:'title',type:'text',x:30,y:40,w:40,h:20,text:'Day 7',templateField:'day',runs:[{start:0,end:5,color:'#ffffff'}],rotation:.2},{objectId:'pen',type:'pen',points:[{x:40,y:80},{x:50,y:90}],pressures:[.3,.8],lastCommittedPoint:{x:50,y:90}},{objectId:'paper',type:'paperNote',x:40,y:100,w:30,h:40,text:'Note',runs:[{bold:true}],imageDataUrl:'data:image/webp;base64,example'},{objectId:'later-object',type:'image',x:210,y:40,w:30,h:30},{objectId:'outside',type:'rect',x:900,y:40,w:30,h:30}];
    const c=harness(html,{slides,scene});
    c.duplicateCurrentSlide();
    assert.equal(c.state.slides.length,3);
    const [original,copy,later]=c.state.slides;
    for(const key of Object.keys(slides[0]))assert.deepEqual(plain(original[key]),slides[0][key]);
    assert.notEqual(copy.id,original.id);
    assert.equal(copy.x,200);assert.equal(copy.y,30);assert.equal(later.x,380);
    for(const key of ['w','h','backgroundColor','backgroundTexture','transition','reveal','elementCueAudio'])assert.deepEqual(plain(copy[key]),slides[0][key]);
    assert.equal(c.state.scene.length,8);
    assert.equal(c.state.scene[3].x,390);assert.equal(c.state.scene[4].x,900);
    const copies=c.state.scene.slice(5);
    assert.equal(copies[0].text,'Day 7');assert.equal(copies[0].templateField,'day');assert.equal(copies[0].x,210);
    assert.deepEqual(plain(copies[1].points),[{x:220,y:80},{x:230,y:90}]);
    assert.deepEqual(plain(copies[1].lastCommittedPoint),{x:230,y:90});
    assert.equal(copies[2].imageDataUrl,scene[2].imageDataUrl);
    assert.equal(new Set(c.state.scene.map(o=>o.objectId)).size,8);
    assert.deepEqual(plain(copy.elementCues[0].objectIds),[copies[0].objectId]);
    assert.notEqual(copy.elementCues[0].id,'cue-original');
    copies[0].runs[0].color='#000000';copies[1].points[0].x=999;copy.transition.type='wipe';
    assert.equal(original.transition.type,'fade');assert.equal(c.state.scene[0].runs[0].color,'#ffffff');assert.equal(c.state.scene[1].points[0].x,40);
    assert.equal(c.state.activeSlide,1);assert.equal(c.selected[0].options.playback,false);assert.equal(c.scrolled,true);assert.ok(c.saves);
  });
  test(`${file}: one undo/redo restores the whole deck, including shifted content`,()=>{
    const c=harness(html,{slides:[{id:'first',x:0,y:0,w:100,h:160},{id:'second',x:180,y:0,w:100,h:160}],scene:[{objectId:'a',type:'rect',x:10,y:10,w:10,h:10},{objectId:'b',type:'rect',x:190,y:10,w:10,h:10}]});
    const initial=plain({slides:c.state.slides,scene:c.state.scene,activeSlide:c.state.activeSlide});
    c.duplicateCurrentSlide();
    assert.equal(c.state.undoStack.length,1);
    const duplicated=plain({slides:c.state.slides,scene:c.state.scene,activeSlide:c.state.activeSlide});
    c.undo();
    assert.deepEqual(plain({slides:c.state.slides,scene:c.state.scene,activeSlide:c.state.activeSlide}),initial);
    c.redo();
    assert.deepEqual(plain({slides:c.state.slides,scene:c.state.scene,activeSlide:c.state.activeSlide}),duplicated);
    c.pushHistory();c.state.scene.at(-1).x+=5;c.undo();c.undo();c.redo();
    assert.deepEqual(plain({slides:c.state.slides,scene:c.state.scene,activeSlide:c.state.activeSlide}),duplicated);
  });
  test(`${file}: later insert/delete actions undo before the duplicate without losing pages`,()=>{
    const c=harness(html,{scene:[{objectId:'a',type:'rect',x:10,y:10,w:10,h:10}]});
    c.duplicateCurrentSlide();
    c.insertSlideAt(2);
    assert.equal(c.state.slides.length,3);
    c.undo();assert.equal(c.state.slides.length,2);
    c.undo();assert.equal(c.state.slides.length,1);assert.equal(c.state.scene.length,1);
    c.redo();c.redo();assert.equal(c.state.slides.length,3);
    c.deleteSlide(1);assert.equal(c.state.slides.length,2);assert.equal(c.state.scene.length,1);
    c.undo();assert.equal(c.state.slides.length,3);assert.equal(c.state.scene.length,2);
  });
  test(`${file}: empty/last page, inherited background, and pending text are supported`,()=>{
    const c=harness(html);
    c.duplicateCurrentSlide();
    assert.equal(c.state.slides.length,2);assert.equal(c.state.scene.length,0);
    assert.equal(c.state.slides[1].backgroundColor,null);assert.equal(c.state.slides[1].backgroundTexture,null);
    c.commitPending=()=>{c.state.scene.push({objectId:'pending',type:'text',text:'Just typed',x:190,y:10,w:10,h:10});c.commitPending=null;};
    c.duplicateCurrentSlide();
    assert.equal(c.state.slides.length,3);assert.equal(c.state.activeSlide,2);
    assert.equal(c.state.scene.at(-1).text,'Just typed');assert.equal(c.state.scene.at(-1).x,370);
  });
  test(`${file}: recording/setup/paused and free-page limits block mutations`,()=>{
    for(const recState of ['setup','recording','paused']){
      const c=harness(html);c.recState=recState;c.duplicateCurrentSlide();
      assert.equal(c.state.slides.length,1);assert.equal(c.commitCount,0);assert.equal(c.state.undoStack.length,0);
    }
    const c=harness(html,{pro:false});c.duplicateCurrentSlide();c.duplicateCurrentSlide();c.duplicateCurrentSlide();
    assert.equal(c.state.slides.length,3);assert.deepEqual(c.upgrades,['slides']);assert.equal(c.state.undoStack.length,2);
    c.recState='recording';c.undo();assert.equal(c.state.slides.length,3);
    const empty=harness(html,{slides:[],activeSlide:-1});empty.duplicateCurrentSlide();assert.equal(empty.state.undoStack.length,0);
  });
}

test('both variants expose the same accessible control, copy behavior, and deck history',()=>{
  for(const html of sources){
    assert.match(html,/id="slideDuplicateBtn"[^>]*type="button"[^>]*data-i18n-title="slide.duplicate.title"[^>]*disabled/);
    assert.match(html,/getElementById\('slideDuplicateBtn'\)\.onclick = duplicateCurrentSlide/);
    assert.match(html,/getElementById\('slideDuplicateBtn'\)\.disabled=recState!=='idle'\|\|!state.slides\[state.activeSlide\]/);
    assert.match(html,/const userNavigation=!!opts.animate&&opts.playback!==false/);
  }
  for(const [start,end] of [['function duplicateCurrentSlide(','function deleteSlide('],['function snapshot(','/* ------------------------ TOOLS (pointer)'],['  <div class="slideActions">','<!-- 录制条 -->']])assert.equal(between(sources[0],start,end),between(sources[1],start,end));
});
