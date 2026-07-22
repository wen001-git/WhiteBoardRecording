import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files=['whiteboard.html','whiteboard-pro.html'];

for(const file of files){
  test(`${file} keeps camera beauty live preview and recordings aligned`,async()=>{
    const html=await readFile(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(html,/<canvas id="camFxLive" width="320" height="320"><\/canvas>/);
    assert.match(html,/#camVideo\{position:absolute;width:1px;height:1px;opacity:0/);
    assert.match(html,/startLiveCameraFx\(\);/);
    assert.match(html,/ctx\.drawImage\(camFxLive,0,0,camFxLive\.width,camFxLive\.height,0,0,D,D\)/);
    assert.match(html,/function naturalBeautyInto\(/);
    assert.match(html,/const edgeProtect=1-/);
    assert.match(html,/const lumaKeep=lumaDetail/);
    assert.match(html,/const chromaMix=skin\*strength/);
    assert.match(html,/const textureMix=skin\*strength\*\.22\*edgeProtect/);
    assert.doesNotMatch(html,/const m=skin\*strength/);
    assert.match(html,/id="cameraDarkCircle" type="range"/);
    assert.match(html,/id="cameraRosy" type="range"/);
    assert.match(html,/cameraDarkCircle:40/);
    assert.match(html,/cameraRosy:35/);
    assert.match(html,/function boxBlurMono\(/);
    assert.match(html,/boxBlurRGB\(d, fxBlurBuf, FX_P, FX_P, 9\)/);
    assert.match(html,/const shadowMask=dark\*fxSkinSoftBuf\[i\]\*shadow\*edgeProtect/);
    assert.match(html,/const shadowLift=24\*shadowMask/);
    assert.match(html,/const tone=skin\*rosyLevel/);
    assert.match(html,/const gamma=1-lift\*\.18/);
    assert.doesNotMatch(html,/function camBrightAlpha\(/);
    assert.ok((html.match(/drawCamBeautified\(recCtx,/g)||[]).length>=2,'board and screen recordings must use the shared beauty renderer');
  });
}
