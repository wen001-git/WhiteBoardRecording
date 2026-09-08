import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function section(html, from, to) {
  const start = html.indexOf(from), end = html.indexOf(to, start);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end);
}
function harness(file, surface = 'browser', language = 'zh-CN') {
  const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: false, style: {}, innerHTML: '', value: '24', scrollTop: 0,
      classList: { add() {}, remove() {}, toggle() {} },
      listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; },
      setAttribute() {}, querySelectorAll: () => [], getContext: () => ({}),
    });
    return elements.get(selector);
  }
  const doc = { documentElement: { lang: language }, head: {}, body: {}, querySelector: element };
  const win = {
    document: doc, navigator: { mediaDevices: { getDisplayMedia() { throw Error('capture must belong to the main document'); } } },
    listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; },
    resizeTo(w, h) { this.size = [w, h]; },
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    close() { this.listeners.pagehide(); },
  };
  const video = { readyState: 'live', listeners: {}, getSettings: () => ({ displaySurface: surface }),
    addEventListener(name, fn) { this.listeners[name] = fn; }, stop() { this.readyState = 'ended'; } };
  const audio = { readyState: 'live', stop() { this.readyState = 'ended'; } };
  const stream = { getTracks: () => [video, audio], getVideoTracks: () => [video], getAudioTracks: () => [audio] };
  let captureError;
  const c = {
    document: { documentElement: { lang: language }, getElementById: element },
    navigator: { mediaDevices: { async getDisplayMedia() { c.captureCalls++; if (captureError) throw captureError; return stream; } } },
    documentPictureInPicture: { async requestWindow() { return win; } },
    screenCropPipWin: null, screenCropPipUI: null, screenCropPipIntentionalClose: false, screenCropPipUnavailable: false,
    screenCropPipTelePlaying: false, screenCropPipTeleRAF: null, screenCropPipTeleLast: 0, screenCropPipTeleCollapsed: false,
    screenStream: null, screenVideo: { videoWidth: 1280, videoHeight: 720, async play() {} },
    screenCropNorm: null, screenDisplaySurface: '', screenCropMode: '16:9', recConfig: { source: 'screen', ratio: '16:9' },
    recState: 'idle', camActive: false, IS_PRO: true, teleText: { innerHTML: 'script' }, teleFontInput: { value: '24' },
    sanitizeTeleHtml: value => value, screenStage: element('#screenStage'),
    performance: { now: () => 0 }, console: { warn() {} },
    setTimeout(fn) { fn(); }, requestAnimationFrame(fn) { fn(); },
    captureCalls: 0, stops: 0, messages: [], showPlanToast(text) { c.messages.push(text); },
    stopRecording() { c.stops++; c.recState = 'idle'; },
    cancelSetup() {}, pauseRecording() {}, startScreenRecording() {},
    alert() {}, updateRecUI() {}, renderSlidePanel() {}, hideFrame() {},
    initScreenCursorControl() {}, updateScreenCropModeUI() {}, screenCropAspect: () => 16 / 9,
    screenCropForAspect: () => ({ x: 0, y: 0, w: 1, h: 1 }),
    layoutScreenSnap() {}, positionScreenCropFrame() {},
  };
  c.window = { documentPictureInPicture: c.documentPictureInPicture, focus() {} };
  vm.createContext(c);
  vm.runInContext(section(html, 'function screenCropPipCopy(zh,en){', '// 把当前屏幕一帧画到快照 canvas') + '\n' +
    section(html, 'async function enterScreenSetup(){', '(function bindScreenCropFrame(){'), c);
  return { c, win, video, audio, stream, failCapture(error) { captureError = error; } };
}
for (const file of ['whiteboard.html', 'whiteboard-pro.html']) {
  for (const surface of ['browser', 'window', 'monitor']) {
    for (const state of ['recording', 'paused']) {
      test(`${file}: closing PiP preserves ${surface} capture while ${state}; Stop sharing still stops`, async () => {
        const { c, win, video, audio, stream } = harness(file, surface);
        await c.enterScreenSetup(); // first gesture opens only PiP
        assert.equal(c.captureCalls, 0);
        await c.enterScreenSetup(); // PiP button calls main-document mediaDevices
        assert.equal(c.captureCalls, 1);
        assert.equal(c.screenStream, stream);
        c.recState = state;
        c.showScreenCropPipRecording();
        assert.equal(c.screenCropPipTeleCollapsed, true);
        assert.equal(c.screenCropPipUI.teleActionLeft.hidden, true);
        c.hideScreenCropPipTele();
        c.toggleScreenCropPipTele();
        assert.equal(c.screenCropPipTelePlaying, true);
        win.close();
        assert.equal(c.recState, state);
        assert.equal(c.stops, 0);
        assert.equal(c.screenCropPipTelePlaying, false);
        assert.equal(c.screenStream, stream);
        assert.equal(c.screenVideo.srcObject, stream);
        assert.equal(video.readyState, 'live');
        assert.equal(audio.readyState, 'live');
        video.readyState = 'ended';
        video.listeners.ended();
        assert.equal(c.stops, 1);
      });
    }
  }
  test(`${file}: close-window button preserves the stream and compact controls toggle in English`, async () => {
    const { c, win, video } = harness(file, 'window', 'en');
    await c.enterScreenSetup(); await c.enterScreenSetup(); c.recState = 'recording';
    c.showScreenCropPipRecording();
    assert.equal(c.screenCropPipUI.hideTele.textContent, 'Show teleprompter');
    c.hideScreenCropPipTele();
    assert.equal(c.screenCropPipUI.hideTele.textContent, 'Hide teleprompter');
    assert.deepEqual(win.size, [560, 480]);
    c.closeScreenCropPipTeleWindow();
    assert.equal(c.screenCropPipWin, null);
    assert.equal(c.stops, 0);
    assert.equal(video.readyState, 'live');
    assert.match(c.messages.at(-1), /Recording continues/);
  });
  test(`${file}: missing PiP activation falls back before capture instead of using PiP-owned tracks`, async () => {
    const { c, failCapture } = harness(file);
    await c.enterScreenSetup();
    failCapture({ name: 'InvalidStateError' });
    await c.enterScreenSetup();
    assert.equal(c.screenCropPipWin, null);
    assert.equal(c.screenStream, null);
    assert.equal(c.screenCropPipUnavailable, true);
    assert.equal(c.recState, 'idle');
    failCapture(null);
    await c.enterScreenSetup();
    assert.equal(c.recState, 'setup');
    assert.equal(c.captureCalls, 2);
  });
  test(`${file}: closing PiP during crop setup shows the main crop without stopping capture`, async () => {
    const { c, win, video } = harness(file);
    await c.enterScreenSetup(); await c.enterScreenSetup();
    win.close();
    assert.equal(c.recState, 'setup');
    assert.equal(c.stops, 0);
    assert.equal(video.readyState, 'live');
  });
}
