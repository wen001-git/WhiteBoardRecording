import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root=resolve(import.meta.dirname,'..');
const files=['whiteboard.html','whiteboard-pro.html'];
const source=name=>readFile(resolve(root,name),'utf8');

function between(text,start,end){
  const a=text.indexOf(start),b=text.indexOf(end,a+start.length);
  assert.notEqual(a,-1,`missing ${start}`);assert.notEqual(b,-1,`missing ${end}`);
  return text.slice(a,b);
}

test('template manager stays inside the existing menu and preserves quick controls',async()=>{
  for(const file of files){
    const html=await source(file);
    assert.match(html,/id="slideTemplateManage"/);
    assert.match(html,/id="slideTemplateOverlay"/);
    assert.match(html,/id="slideTemplateSaveCurrent"/);
    assert.match(html,/id="slideTemplateImport"/);
    assert.match(html,/id="slideTemplateExportAll"/);
    assert.match(html,/id="docSaveQuick"[^>]*title="保存白板备份（Ctrl\/Cmd\+S）"/);
    assert.match(html,/id="slideAddBtn"[^>]*>\+<\/button>/);
    assert.match(html,/if\(card\.id==='docNew'\)\{\s*closeFileMenu\(\);\s*newDoc\(\);\s*\}/);
    assert.match(html,/document\.getElementById\('slideTemplateManage'\)\.onclick=openSlideTemplateOverlay/);
    assert.match(html,/document\.getElementById\('slideTemplateBlank'\)\.onclick=.*newDoc\(\)/);
  }
});

test('six system diary layouts are independently composed for three ratios',async()=>{
  const html=await source('whiteboard.html');
  const functions=between(html,'function templateText(','function resolveTemplateDynamicFields(');
  const make=new Function(`
    const RATIOS={'9:16':{w:720,h:1280},'16:9':{w:1280,h:720},'3:4':{w:960,h:1280}};
    const templateT=k=>({
      'template.slide.title.vertical':'视频\\n日记','template.slide.title':'视频日记',
      'template.prompt.event':'今天发生了什么','template.prompt.feeling':'我有什么感受','template.prompt.action':'明天做什么',
      'template.system.review':'三问复盘日记','template.system.minimal':'极简视频日记'
    }[k]||k);
    const normalizeSlideTransition=v=>v||{type:'none'};
    const defaultSlideRevealSetting=()=>({style:'pencil',autoPlay:false});
    const defaultElementCueAudio=()=>({sound:'none',volume:.6});
    const todayDiaryDate=()=> '2026/08/04';
    const SLIDE_TEMPLATE_VERSION=1;
    ${functions}
    return systemDiaryTemplate;
  `)();
  const expected={'9:16':[720,1280],'16:9':[1280,720],'3:4':[960,1280]};
  const signatures=new Set();
  for(const style of ['minimal','review'])for(const ratio of Object.keys(expected)){
    const payload=make(style,ratio,7),[w,h]=expected[ratio];
    assert.equal(payload.slide.w,w);assert.equal(payload.slide.h,h);assert.equal(payload.ratio,ratio);
    assert.equal(payload.objects.filter(o=>o.templateField==='date').length,1);
    assert.equal(payload.objects.filter(o=>o.templateField==='day').length,1);
    const brackets=payload.objects.filter(o=>o.type==='pen');
    assert.equal(brackets.length,2,`${style} ${ratio} title must use two open brackets`);
    assert.ok(brackets.every(o=>o.roughness==='clean'&&o.points.length>12),'bracket corners must be sampled arcs');
    const diaryMark=payload.objects.find(o=>['Diary','Video Diary','Daily Note'].includes(o.text));
    const bracketBottom=Math.max(...brackets.flatMap(o=>o.points.map(p=>p.y)));
    assert.ok(diaryMark,`${style} ${ratio} diary mark`);
    assert.ok(Math.abs(diaryMark.y+diaryMark.fontSize/2-bracketBottom)<.01,`${style} ${ratio} diary mark sits on bracket baseline`);
    const prompts=payload.objects.filter(o=>['今天发生了什么','我有什么感受','明天做什么'].includes(o.label));
    assert.equal(prompts.length,style==='review'?3:0);
    for(const object of payload.objects){
      if(Number.isFinite(object.x))assert.ok(object.x>=0&&object.x<=w,`${style} ${ratio} x`);
      if(Number.isFinite(object.y))assert.ok(object.y>=0&&object.y<=h,`${style} ${ratio} y`);
      if(Number.isFinite(object.w))assert.ok(object.x+object.w<=w,`${style} ${ratio} width`);
      if(Number.isFinite(object.h))assert.ok(object.y+object.h<=h,`${style} ${ratio} height`);
      if(Array.isArray(object.points))for(const point of object.points){
        assert.ok(point.x>=0&&point.x<=w,`${style} ${ratio} point x`);
        assert.ok(point.y>=0&&point.y<=h,`${style} ${ratio} point y`);
      }
    }
    signatures.add(payload.objects.map(o=>[o.type,o.x,o.y,o.w||0,o.h||0]).join('|'));
  }
  assert.equal(signatures.size,6,'all two-style by three-ratio layouts must have distinct coordinates');
});

test('custom templates persist self-contained slide data and remap identities',async()=>{
  for(const file of files){
    const html=await source(file);
    const behavior=between(html,'/* ---------------- 幻灯片模板：系统视频日记 + 本机模板库 ---------------- */',"document.getElementById('docSave').onclick=exportDoc;");
    assert.match(behavior,/SLIDE_TEMPLATE_LIBRARY_KEY='template-library'/);
    assert.match(behavior,/function slideTemplateStorageKey\(id\)\{ return 'template:'\+id; \}/);
    assert.match(behavior,/effectiveSlideBackground\(slide\)/);
    assert.match(behavior,/effectiveSlideBackgroundTexture\(slide\)/);
    assert.match(behavior,/transition:normalizeSlideTransition/);
    assert.match(behavior,/elementCues:normalizeElementCues/);
    assert.match(behavior,/o\.objectId=sceneObjectId\(\)/);
    assert.match(behavior,/idMap\.get\(id\)/);
    assert.match(behavior,/translateObject\(o,-slide\.x,-slide\.y\)/);
    assert.match(behavior,/shiftSlidesAndContents\(index,dx,0\)/);
    assert.doesNotMatch(behavior,/cameraStream|recConfig\.camera|microphoneStream|teleprompter/);
  }
});

test('diary counter, ratio memory, import and export contracts are explicit',async()=>{
  for(const file of files){
    const html=await source(file);
    assert.match(html,/DIARY_DAY_STORAGE_KEY='wb_video_diary_next_day_v1'/);
    assert.match(html,/DIARY_RATIO_STORAGE_KEY='wb_video_diary_ratio_v1'/);
    assert.match(html,/SYSTEM_DIARY_RATIOS=\['9:16','16:9','3:4'\]/);
    assert.match(html,/if\(diary\)\{setNextDiaryDay\(day\+1\)/);
    assert.match(html,/slideTemplateRatios'[\s\S]{0,700}classList\.toggle\('active',option\.dataset\.templateRatio===selectedDiaryRatio\)/);
    assert.match(html,/kind:'whiteboard-slide-template'/);
    assert.match(html,/kind:'whiteboard-slide-template-library'/);
    assert.match(html,/\.wbtemplate\.json/);
    assert.match(html,/\.wbtemplates\.json/);
    assert.match(html,/validImportedTemplate/);
  }
});

test('template controls and behavior stay aligned between both variants',async()=>{
  const [a,b]=await Promise.all(files.map(source));
  assert.equal(
    between(a,'<div class="overlay hidden" id="slideTemplateOverlay"','<div class="canvas-bg-popover"'),
    between(b,'<div class="overlay hidden" id="slideTemplateOverlay"','<div class="canvas-bg-popover"'),
  );
  assert.equal(
    between(a,'/* ---------------- 幻灯片模板：系统视频日记 + 本机模板库 ---------------- */',"document.getElementById('docSave').onclick=exportDoc;"),
    between(b,'/* ---------------- 幻灯片模板：系统视频日记 + 本机模板库 ---------------- */',"document.getElementById('docSave').onclick=exportDoc;"),
  );
});
