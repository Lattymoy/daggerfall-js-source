// GPU-TRAIL (2026-10-24, src/render/gpuTrail.js): the page's half of the GPU's last samples, kept beside a crash. The
// count, the ring, the sample and the running trail are executed - the count against the real Renderer's constructor,
// so it is the renderer's own first object it must see; the entry's wiring is pinned by source (it needs a browser and
// the shell). The shell's half is test/tooling/gputrail_crashlog.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GPU_TRAIL_MS, GPU_TRAIL_FIRST_MS, GPU_TRAIL_KEEP, GL_KINDS, countGlObjects, countCanvasGl, createTrail, gpuSample, startGpuTrail,
} from '../../src/render/gpuTrail.js';
import { Renderer } from '../../src/render/renderer.js';
import { mountFpsCounter } from '../../src/ui/fpsCounter.js';
import { _resetFrameClock } from '../../src/systems/frameClock.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A WebGL2 deep enough for the renderer's constructor (audit68_render_a's recordingGl), whose own members - the count's
 *  wrappers - answer first, and which keeps its own tally of what was made and deleted by kind. */
function tallyGl() {
  const made = {}, gone = {};
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160, TRIANGLE_STRIP: 5, ONE: 1 };
  const gl = new Proxy({}, {
    get(t, k) {
      if (Object.hasOwn(t, k)) return t[k];
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'isContextLost') return () => false;
      if (typeof k === 'string' && k.startsWith('create')) return () => { made[k.slice(6)] = (made[k.slice(6)] ?? 0) + 1; return { id: ++ids }; };
      if (typeof k === 'string' && k.startsWith('delete')) return (o) => { if (o) gone[k.slice(6)] = (gone[k.slice(6)] ?? 0) + 1; };
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  return { gl, made, gone };
}

test('GPU-TRAIL the count: a create counts, its delete uncounts; a null, a second delete and an object made before the count move nothing - a bare counter drifts below what the context holds (mutants: a delete uncounted unasked; a create returning null counted; the made object not handed back)', () => {
  const { gl } = tallyGl();
  const before = gl.createTexture();
  const live = countGlObjects(gl);
  assert.deepEqual(Object.keys(live), GL_KINDS.map(([, key]) => key));
  const a = gl.createTexture(), b = gl.createBuffer(), v = gl.createVertexArray(), f = gl.createFramebuffer(), p = gl.createProgram();
  assert.deepEqual(live, { textures: 1, buffers: 1, vaos: 1, framebuffers: 1, programs: 1 });
  assert.ok(a && b && v && f && p && a !== b, 'each create answers the object WebGL made');
  gl.deleteTexture(a); gl.deleteTexture(a); gl.deleteTexture(null); gl.deleteTexture(before);
  gl.deleteBuffer(b); gl.deleteVertexArray(v); gl.deleteFramebuffer(f);
  assert.deepEqual(live, { textures: 0, buffers: 0, vaos: 0, framebuffers: 0, programs: 1 });
  const lost = tallyGl().gl;
  lost.createTexture = () => null;   // a lost context answers null to every create
  const lostLive = countGlObjects(lost);
  assert.equal(lost.createTexture(), null);
  assert.equal(lostLive.textures, 0, 'nothing held, nothing counted');
});

test('GPU-TRAIL the renderer\'s own context is counted from its first object: the canvas is counted before `new Renderer`, every object the constructor makes is in the count, and the canvas\'s own getContext is given back after its first webgl2 answer (mutants: the hook counting from a later ask; the canvas left shadowed)', () => {
  const { gl, made, gone } = tallyGl();
  const proto = { getContext(type) { return type === 'webgl2' ? gl : null; } };
  const canvas = Object.assign(Object.create(proto), { clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const live = countCanvasGl(canvas);
  assert.equal(canvas.getContext('2d'), null);
  assert.ok(Object.hasOwn(canvas, 'getContext'), 'a 2d ask is no webgl2 answer - the count still waits');
  const r = new Renderer(canvas);
  assert.equal(r.gl, gl);
  assert.equal(Object.hasOwn(canvas, 'getContext'), false, 'the canvas\'s own getContext given back');
  const expected = Object.fromEntries(GL_KINDS.map(([kind, key]) => [key, (made[kind] ?? 0) - (gone[kind] ?? 0)]));
  assert.ok(expected.programs > 0 && expected.textures > 0 && expected.buffers > 0, `the constructor made its programs and textures: ${JSON.stringify(made)}`);
  assert.deepEqual({ ...live }, expected, 'every object the constructor made, less every one it deleted');
});

test('GPU-TRAIL the ring keeps the newest GPU_TRAIL_KEEP samples, oldest first, and answers a copy (mutants: the oldest kept; the ring itself handed out)', () => {
  assert.equal(GPU_TRAIL_KEEP, 20);
  assert.equal(GPU_TRAIL_KEEP * GPU_TRAIL_MS, 10 * 60_000, 'ten minutes');
  const t = createTrail();
  let out;
  for (let i = 0; i < GPU_TRAIL_KEEP + 5; i++) out = t.push({ i });
  assert.deepEqual(out.map((s) => s.i), Array.from({ length: GPU_TRAIL_KEEP }, (_, i) => i + 5));
  out.length = 0;
  assert.equal(t.push({ i: 99 }).length, GPU_TRAIL_KEEP, 'what was handed out is not the ring');
});

test('GPU-TRAIL a sample: the counts, the fps counter\'s second rounded, the heap in MB, hidden and lost - and nulls where there is no second (mutants: the heap in bytes; the frame\'s mean unrounded; lost dropped)', () => {
  const live = { textures: 812, buffers: 2300, vaos: 1100, framebuffers: 24, programs: 140 };
  const frame = { fps: 59, meanMs: 16.94, worstMs: 33.4, draws: 430.6, binds: 900.2, viewDraws: 0, shadowDraws: 120.4, hitch: { ms: 121.6 } };
  assert.deepEqual(gpuSample({ at: 1_000, upMs: 1_234_567, live, frame, heap: 512 * 1048576 + 1, hidden: false, lost: true }), {
    at: 1_000, upS: 1235, textures: 812, buffers: 2300, vaos: 1100, framebuffers: 24, programs: 140,
    fps: 59, frameMs: 16.9, worstMs: 33, hitchMs: 122, draws: 431, binds: 900, viewDraws: 0, shadowDraws: 120, heapMB: 512, hidden: false, lost: true,
  });
  const none = gpuSample({ at: 2_000, upMs: 0, live, frame: null, heap: null, hidden: true, lost: false });
  assert.deepEqual([none.fps, none.frameMs, none.worstMs, none.hitchMs, none.draws, none.heapMB, none.hidden], [null, null, null, null, null, null, true]);
  assert.equal(gpuSample({ at: 0, upMs: 0, live, frame: { fps: 60, hitch: null }, heap: null, hidden: false, lost: false }).hitchMs, null, 'no hitch in the minute');
});

test('GPU-TRAIL running: the first sample soon, then one every GPU_TRAIL_MS and one at a lost context, each sent with the samples before it; a second the counter has not moved past is no frame; a send that throws costs nothing; stop lets go (mutants: the first sample at the period; the lost context unheard; the stale second written as live)', () => {
  const timers = { at: [], every: [], setTimeout(fn, ms) { this.at.push([fn, ms]); return 1; }, setInterval(fn, ms) { this.every.push([fn, ms]); return 2; }, clearTimeout(id) { this.cleared = [...(this.cleared ?? []), id]; }, clearInterval(id) { this.cleared = [...(this.cleared ?? []), id]; } };
  const canvas = new EventTarget();
  let lost = false;
  const gl = { isContextLost: () => lost };
  const live = { textures: 3, buffers: 2, vaos: 1, framebuffers: 0, programs: 4 };
  let second = null;
  const sent = [];
  let refuse = false;
  const trail = startGpuTrail({ canvas, gl, live, frames: () => second, gpu: 'ANGLE (AMD, Radeon RX 7800 XT)', timers, send: (t) => { if (refuse) throw new Error('gone'); sent.push(t); } });
  assert.deepEqual(timers.at.map(([, ms]) => ms), [GPU_TRAIL_FIRST_MS]);
  assert.deepEqual(timers.every.map(([, ms]) => ms), [GPU_TRAIL_MS]);
  assert.ok(GPU_TRAIL_FIRST_MS < GPU_TRAIL_MS);
  second = { fps: 60, meanMs: 16.7, worstMs: 20 };
  timers.at[0][0]();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].gpu, 'ANGLE (AMD, Radeon RX 7800 XT)');
  assert.deepEqual(sent[0].samples.map((s) => [s.fps, s.textures, s.lost]), [[60, 3, false]]);
  timers.every[0][0]();
  assert.deepEqual(sent[1].samples.map((s) => s.fps), [60, null], 'the same second again: no frame since');
  live.textures = 9; lost = true;
  canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.deepEqual(sent[2].samples.map((s) => [s.textures, s.lost]), [[3, false], [3, false], [9, true]], 'the loss sampled at once, with the trail before it');
  refuse = true;
  assert.doesNotThrow(() => timers.every[0][0]());
  refuse = false;
  second = { fps: 30 };
  trail.sample();
  assert.equal(sent[3].samples.length, 5, 'a refused send kept its sample');
  trail.stop();
  assert.deepEqual(timers.cleared, [1, 2]);
  canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(sent.length, 4, 'stopped: the canvas no longer heard');
});

test('GPU-TRAIL the fps counter hands its last second, a new object each second - the trail tells a stalled counter by it (mutant: the accessor answering a copy every call)', () => {
  const prev = { d: globalThis.document, w: globalThis.window };
  const stubEl = () => ({ id: '', textContent: '', style: { cssText: '', display: '' }, children: [], appendChild(c) { this.children.push(c); return c; }, remove() { this.removed = true; } });
  globalThis.document = { createElement: stubEl, body: stubEl() };
  globalThis.window = {};
  try {
    _resetFrameClock();
    const c = mountFpsCounter({ enabled: () => false, raf: null, stats: () => ({ draws: 250, texBinds: 90 }) });
    assert.equal(c.last(), null, 'nothing before the first second');
    for (let t = 0; t <= 1020; t += 1000 / 60) c.tick(t);
    const one = c.last();
    assert.ok(one && one.fps >= 59 && Math.abs(one.draws - 250) < 1e-9, JSON.stringify(one));
    assert.equal(c.last(), one, 'the same second is the same object');
    for (let t = 1040; t <= 2040; t += 1000 / 60) c.tick(t);
    assert.notEqual(c.last(), one, 'the next second is a new one');
    c.dispose();
  } finally { globalThis.document = prev.d; globalThis.window = prev.w; _resetFrameClock(); }
});

test('GPU-TRAIL by source: the entry counts the canvas before the renderer is made, behind a door the shell opens, and starts the trail on the fps counter\'s seconds (mutants: the door after the renderer; the trail on a tab; the trail never started)', () => {
  const main = rd('src/main.js');
  const door = main.indexOf("const gpuTrail = typeof globalThis.daggerShell?.gpuTrail === 'function'");
  assert.ok(door > 0, 'the door is the shell\'s');
  assert.match(main, /\? await import\('\.\/render\/gpuTrail\.js'\)\.then\(\(m\) => m\.gpuTrailOn\(canvas, globalThis\.daggerShell\.gpuTrail\)\)\.catch\(\(\) => null\) : null;/);
  assert.ok(door < main.indexOf('const renderer = new Renderer(canvas);'), 'counted before the renderer makes its first object');
  assert.doesNotMatch(main, /^import .*gpuTrail/m, 'behind a door - the entry\'s static reach is BOOT2\'s');
  assert.match(main, /const fps = mountFpsCounter\(\{[^\n]*\n {2}gpuTrail\?\.start\(renderer, fps\.last\);/);
});
