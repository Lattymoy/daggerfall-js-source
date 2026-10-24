// FIELD BUGS 2026-10-18 PASS-COUNT (bible/01-Overview/bugs/Field-Bugs-2026-10-18.md, MADMAN0037: "The Mouse and Fawn
// tavern in Sentinel, graphics settings preset ultra, Gpu fans turn into jet turbines", over a counter that read
// "198 fps ... draws 67 binds 77"). The counter counted the room's own pass alone: a building's view out through its
// windows (renderer.outsideViewFrame, drawn BEFORE the room's beginFrame, whose reset lost its draws) and the shadow
// maps' replays (their own stats) were nowhere on it, and nothing said what held the frame rate. The counter EXECUTES
// against a stub document; the renderer EXECUTES over a stub GL (test/render/fb1012g_paneclip.test.js's), its frames
// counted against the GL draws they really issued (AUDIT FB1018 L2-2: this pin was text alone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountFpsCounter, paceLine, drawsLine } from '../../src/ui/fpsCounter.js';
import { _resetFrameClock } from '../../src/systems/frameClock.js';
import { _resetFrameCap } from '../../src/systems/frameCap.js';
import { setValue, _resetForTests } from '../../src/systems/settings/settings.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { createViewOut, viewOutFrame } from '../../src/render/realWindows.js';
import { perspective, lookAt, mirrorProjectionX, identity, trs } from '../../src/world/mat4.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const stubEl = () => ({ id: '', textContent: '', style: { cssText: '', display: '' }, children: [], appendChild(c) { this.children.push(c); return c; }, remove() { this.removed = true; } });

/** One second and a frame of `frame()` through a mounted counter; answers its text. */
function second(frame) {
  const c = mountFpsCounter({ enabled: () => true, raf: null, stats: frame });
  let t = 0;
  for (let i = 0; i <= 61; i++) { c.tick(t); t += 1000 / 60; }
  const text = c.el.textContent;
  c.dispose();
  return text;
}

test('PASS-COUNT THE COUNTER SHOWS THE PASSES THE DRAW COUNT MISSED: the view out\'s and the shadow maps\' draws ride the draws line as per-frame means when a second held any, and the line is as it was when none did (mutants: the view unsummed; the shadows unsummed; the means not reset each second)', () => {
  const prev = globalThis.document;
  globalThis.document = { createElement: stubEl, body: stubEl() };
  try {
    _resetFrameClock();
    assert.match(second(() => ({ draws: 67, texBinds: 77, viewDraws: 1210, shadowDraws: 340 })), /\ndraws 67 {2}binds 77 {2}view 1210 {2}shadow 340$/m);
    assert.match(second(() => ({ draws: 67, texBinds: 77, viewDraws: 0, shadowDraws: 0 })), /\ndraws 67 {2}binds 77$/m, 'none held: the line as before');
    let i = 0;
    const text = second(() => ({ draws: 10, texBinds: 1, viewDraws: (i++ % 2) * 100, shadowDraws: 0 }));
    assert.match(text, /\ndraws 10 {2}binds 1 {2}view 5\d$/m, `every other frame's view out, a mean: ${JSON.stringify(text)}`);
    // one counter over two seconds: the street seen through the glass in the first, the player gone out of the room in
    // the second - its own means
    let frame = { draws: 67, texBinds: 77, viewDraws: 1210, shadowDraws: 340 };
    const c = mountFpsCounter({ enabled: () => true, raf: null, stats: () => frame });
    let t = 0;
    for (let k = 0; k <= 61; k++) { c.tick(t); t += 1000 / 60; }
    assert.match(c.el.textContent, /view 1210 {2}shadow 340$/m);
    frame = { draws: 300, texBinds: 120, viewDraws: 0, shadowDraws: 0 };
    for (let k = 0; k <= 61; k++) { c.tick(t); t += 1000 / 60; }
    assert.match(c.el.textContent, /\ndraws 300 {2}binds 120$/m, `a new second, its own means: ${JSON.stringify(c.el.textContent)}`);
    c.dispose();
    assert.equal(drawsLine(67, 77, 0.4, 0), '\ndraws 67  binds 77', 'under half a draw a frame is none');
    assert.equal(drawsLine(67, 77, 0, 0.4), '\ndraws 67  binds 77', 'the shadow maps\' too (AUDIT FB1018 L4-3)');
    // AUDIT FB1018 L4-3: the probe (window.__fpsStats, tools/perfProbe.mjs) carries both, and a stats object without them
    // (a host before PASS-COUNT, a stub) reads 0 - never NaN
    const prevW = globalThis.window;
    globalThis.window = {};
    try {
      const probe = (frame) => {
        _resetFrameClock();
        const c = mountFpsCounter({ enabled: () => true, raf: null, stats: frame });
        let t = 0;
        for (let k = 0; k <= 61; k++) { c.tick(t); t += 1000 / 60; }
        const out = globalThis.window.__fpsStats();
        c.dispose();
        return out;
      };
      const p = probe(() => ({ draws: 67, texBinds: 77, viewDraws: 1210, shadowDraws: 340 }));
      assert.deepEqual([p.viewDraws, p.shadowDraws], [1210, 340]);
      const q = probe(() => ({ draws: 1, texBinds: 1 }));
      assert.deepEqual([q.viewDraws, q.shadowDraws], [0, 0]);
    } finally { globalThis.window = prevW; }
  } finally { globalThis.document = prev; _resetFrameClock(); }
});

test('PASS-COUNT THE COUNTER SAYS WHAT HOLDS THE FRAME RATE: "vsync off" where the desktop shell lifted the display\'s wait, the Frame Rate Cap\'s fps where one is set, and no line at the defaults - the display\'s own pace, uncapped (mutants: the shell\'s word unread; the cap unread; a line at the defaults)', () => {
  assert.equal(paceLine(false, 0), '');
  assert.equal(paceLine(true, 0), '\nvsync off  no cap');
  assert.equal(paceLine(false, 144), '\nvsync  cap 144');
  assert.equal(paceLine(true, 60), '\nvsync off  cap 60');
  const prev = { d: globalThis.document, w: globalThis.window };
  globalThis.document = { createElement: stubEl, body: stubEl() };
  globalThis.window = { daggerShell: { framesLifted: true } };
  _resetForTests(); _resetFrameCap();
  try {
    _resetFrameClock();
    assert.match(second(() => ({ draws: 1, texBinds: 1 })), /\nvsync off {2}no cap$/m, 'the desktop shell, VSync off');
    setValue('Video', 'TargetFrameRate', '144'); _resetFrameCap();
    globalThis.window = {};
    // a capped run counts only the frames the cap let through - the line is what matters here
    const c = mountFpsCounter({ enabled: () => true, raf: null, stats: () => ({ draws: 1, texBinds: 1 }) });
    for (let t = 0; t < 2100; t += 1) c.tick(t);
    assert.match(c.el.textContent, /\nvsync {2}cap 144$/m, `the cap: ${JSON.stringify(c.el.textContent)}`);
    c.dispose();
  } finally { globalThis.document = prev.d; globalThis.window = prev.w; _resetForTests(); _resetFrameCap(); _resetFrameClock(); }
});

/** The real Renderer over a stub GL that logs every call (fb1012g_paneclip's), and the count of draws it issued. */
function stubRenderer() {
  let id = 0;
  const log = [];
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name, p });
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'isVertexArray') return (v) => !!v;
      if (k === 'checkFramebufferStatus') return () => 0x8CD5;
      if (k === 'getExtension') return () => ({});
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'getParameter') return () => 4096;
      if (k === 'drawingBufferWidth') return 640;
      if (k === 'drawingBufferHeight') return 400;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push(k); };
    },
  });
  const r = new Renderer({ getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 });
  const glDraws = () => log.filter((k) => k === 'drawElements' || k === 'drawArrays').length;
  return { r, log, glDraws };
}
const px = { width: 1, height: 1, colors: new Uint8ClampedArray([255, 255, 255, 255]) };
const proj = mirrorProjectionX(perspective(1, 1.6, 0.05, 500));
const look = (x) => lookAt([0, 1.5, 0], [x, 1.5, -5], [0, 1, 0]);

test('PASS-COUNT THE RENDERER COUNTS THEM: the room\'s frame takes every draw its view out issued - the street and the panes\' depth before it (AUDIT FB1018 L2-3), and what went out before a throw (L2-4) - a cached view out counts none, the view out\'s own begin takes none; the lane\'s shadow render counts the maps\' replays, sun and points, and a frame off the world or the lane none (mutants: the view out uncounted, the panes uncounted, the shadow count never written or never zeroed)', () => {
  const { r, log, glDraws } = stubRenderer();
  r.uploadTexture(9, 3, px, { opaque: true }); r.uploadEmissionTexture(9, 3, px, { window: true });
  r.uploadTexture(9, 5, px); r.uploadGlassMask(9, 5, px);
  r.uploadTexture(9, 4, px, { opaque: true });
  const sub = (rec, start, b) => ({ textureArchive: 9, textureRecord: rec, primitiveCount: 2, startIndex: start, _bounds: new Float32Array(b) });
  const room = { vao: { id: 'roomvao' }, subMeshes: [sub(3, 0, [0, 1.5, -4, 0.5]), sub(5, 6, [1, 1.5, -4, 0.5]), sub(4, 18, [0, 1.5, -6, 3])] };
  const street = { vao: { id: 'streetvao' }, subMeshes: [{ textureArchive: 9, textureRecord: 4, primitiveCount: 2, startIndex: 0 }] };
  const N = 40;
  let throwAt = -1, inside = null;
  const scene = { draw: (info) => { inside = info.renderer.stats.viewDraws; for (let i = 0; i < N; i++) { info.renderer.drawMesh(street, identity()); if (i === throwAt) throw new Error('mid street'); } } };
  const vo = createViewOut();
  let now = 0;
  const frame = (x) => {
    now += 16; log.length = 0;
    const v = viewOutFrame(vo, { renderer: r, mode: 'full', proj, view: look(x), now, scene });
    const out = glDraws();
    r.beginFrame(proj, look(x), new Float32Array([0, 1, 0]), WORLD_FRAME);
    r.setGlassView(v);
    r.drawMesh(room, trs(0.5, 0, -0.25, 0, 0, 0));
    return { view: r.stats.viewDraws, out };
  };
  assert.deepEqual(frame(0), { view: 0, out: 0 }, 'no glass seen yet: no view out');
  const drawn = frame(0);
  assert.ok(drawn.out > N, `the street and the panes went out (${drawn.out})`);
  assert.equal(drawn.view, drawn.out, 'the room\'s frame counts every draw its view out issued');
  assert.equal(inside, 0, 'the view out\'s own begin takes none');
  assert.deepEqual(frame(0), { view: 0, out: 0 }, 'the camera still: the picture kept, nothing drawn, nothing counted');
  assert.deepEqual(frame(0.01), drawn, 'mouse-look: drawn again, counted again');
  throwAt = 9;
  const warn = console.warn; console.warn = () => {};
  try {
    const part = frame(0.02);
    assert.ok(part.out > 0 && part.out < drawn.out);
    assert.equal(part.view, part.out, 'a throw mid-street: what went out is counted');
  } finally { console.warn = warn; throwAt = -1; }
  // the shadow maps: the lane's own render, sun and points, written each world frame
  const s = stubRenderer().r;
  s.uploadTexture(9, 4, px, { opaque: true });
  const mesh = { vao: { id: 'm' }, subMeshes: [{ textureArchive: 9, textureRecord: 4, primitiveCount: 2, startIndex: 0, _bounds: new Float32Array([0, 1, -3, 1]) }], _bounds: new Float32Array([0, 1, -3, 1]) };
  s.setLightingLane(EL_LANE);
  s.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.8, new Float32Array([1, 1, 1]));
  s.setPointLights(new Float32Array([0, 2, -2, 8, 1, 2, -3, 8]), new Float32Array([1, 1, 1]));
  const lit = (opts) => { s.beginFrame(proj, look(0), new Float32Array([0.3, 0.8, 0.2]), opts); for (let i = 0; i < 5; i++) s.drawMesh(mesh, identity()); s.resolveFrame?.(); return s.stats.shadowDraws; };
  console.warn = () => {};
  try {
    lit(WORLD_FRAME);   // the first frame records the casters
    const n = lit(WORLD_FRAME);
    const sp = s._shadowPass.stats;
    assert.ok(sp.sunDraws > 0 && sp.pointDraws > 0, 'the sun and the points both replayed');
    assert.equal(n, sp.sunDraws + sp.pointDraws, 'the maps\' replays, counted');
    assert.equal(lit(null), 0, 'a frame off the world: none');
    s.setLightingLane(null);
    assert.equal(lit(WORLD_FRAME), 0, 'the lane off: none');
  } finally { console.warn = warn; }
  // the order the count relies on: the interior host asks for the view out before its own beginFrame
  const modes = read('src/scenes/worldModes.js');
  const at = modes.indexOf('viewOutFrame(');
  assert.ok(at > 0 && modes.indexOf('renderer.beginFrame(', at) > at, 'the view out is drawn before the room begins its frame');
});
