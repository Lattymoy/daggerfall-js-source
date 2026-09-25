// PERF-SCALE (2026-09-25) - two players, relayed by Mac: "One user is
// reporting fps issues in the exterior but fine in the interior ... GPU
// is NVIDIA GeForce RTX 4060 Ti", and "me too my friend.. don't know
// why. I got a RX6600". Mac: "It has nothing to do with our updates" -
// FPS1 (2026-09-11) had already heard "the outside still has
// optimization issues". The world was drawn at the window's full CSS
// size with no cap and no dial, and nothing on screen said which GPU the
// browser drew on or how many pixels it paid for.
//
// Driven through the real Renderer on AUDIT RETRO1's stateful fake GL
// (test/retroGl.mjs), the real RetroPass, the real Features row and
// tile, the real prefs shelf and the real counter. Each pin fails with
// src/ set back to the base (tools/mutants/perfscale.json holds the
// laws one line at a time):
//
//   S1  at 100% nothing changes - no image, no pass, no present: the
//       frame's GL calls are the frame with no scale source, call for call
//   S2  at 75% the world draws into round(canvas x 0.75), on either lane,
//       and is presented LINEAR, unsnapped and effect-free to the whole
//       canvas (or the host's docked strip) - a sprite sized to the image
//   S3  the UI is not scaled: the quads and the first-person overlay after
//       the present draw on the canvas at its own size
//   S4  retro wins over the scale, and the image's filter follows the kind
//   S5  the setting: a Sight row with its five tiers, 100% the default,
//       the player's online, persisted on the shelf, offered on the tile,
//       read per world frame through main.js's wire
//   S6  the counter names the GPU (read once, at the renderer's birth) and
//       the frame's size, and costs nothing while hidden
//   S7  (the review) the world frame that goes back to no image frees the
//       image and the lane's image-sized frame; one reading of "the scale
//       is on" for the frame and the warm

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as RendererModule from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { frameTarget, setFrameTarget } from '../src/render/renderTarget.js';
import { E, stateGl, presents, retroCfg } from './retroGl.mjs';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';
import { onlineForcedPref, ONLINE_PLAYERS_OWN_PREFS } from '../src/systems/onlineLane.js';
import { getPref, setPref, loadPrefs, PREF_DEFAULTS, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import * as CounterModule from '../src/ui/fpsCounter.js';
import { featureTile } from '../src/ui/enhancedMenu.js';

// The slice's new names are read off their modules' namespaces, and its new module is loaded here rather than linked,
// so that with src/ set back to the base each pin below FAILS ON ITS OWN rather than the file failing to link.
const { Renderer, WORLD_FRAME, gpuNameOf } = RendererModule;
const { mountFpsCounter, sizeLine } = CounterModule;
const { RENDER_SCALES = [], renderScaleOf, renderScaleSetting, _resetRenderScaleDoor } = await import('../src/systems/renderScale.js').catch(() => ({}));

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const L = new Float32Array([0.3, 0.8, -0.2]);
const Q = { x: 0, y: 0, w: 10, h: 10 };
const UNMASKED_RENDERER_WEBGL = 0x9246;

/** A frame's GL calls, objects by kind and id and arrays spelled out - two renderers' logs compare call for call. */
const norm = (calls) => calls.map((c) => c.map((a) => (a && typeof a === 'object'
  ? (a.kind ? `${a.kind}#${a.id}` : ArrayBuffer.isView(a) ? Array.from(a) : a.name ? `loc:${a.name}` : '{}')
  : a)));

/** stateGl, with a browser that hands out WEBGL_debug_renderer_info - every read of the unmasked name counted. */
function gpuGl(name = 'NVIDIA GeForce RTX 4060 Ti', { ext = true, renderer = 'WebKit WebGL' } = {}) {
  const base = stateGl();
  const asked = [];
  const info = { UNMASKED_RENDERER_WEBGL };
  const gl = new Proxy(base.gl, {
    get(t, k) {
      if (k === 'getExtension') return (n) => (n === 'WEBGL_debug_renderer_info' ? (ext ? info : null) : t.getExtension(n));
      if (k === 'getParameter') return (p) => { asked.push(p); return p === UNMASKED_RENDERER_WEBGL ? name : p === t.RENDERER ? renderer : t.getParameter(p); };
      return t[k];
    },
  });
  base.canvas.getContext = () => gl;
  return { ...base, gl, asked };
}

// ── S1: 100% is today's frame ──────────

test('PERF-SCALE S1: at 100% nothing changes - no image, no framebuffer, no present, and the frame\'s GL calls are the frame with no scale source, call for call, on either lane', () => {
  for (const lane of [false, true]) {
    const run = (withSource) => {
      const { canvas, calls, s } = stateGl();
      const r = new Renderer(canvas);
      if (lane) { r.setLightingLane(EL_LANE); r.setAir(true); }
      if (withSource) r.setRenderScaleSource(() => 1);
      calls.length = 0;
      try {
        r.beginFrame(I, I, L, WORLD_FRAME);
        const mid = { vp: r.worldViewportPx, fbo: r._frameFbo, target: frameTarget(), retro: r.retro, frame: r.retroFrame, laneW: r.air?.frame?.w ?? null, resolveTo: r.air?.resolveTo ?? null };
        r.drawScreenQuad({ id: 'ui' }, Q);
        r.beginFrame(I, I, L, WORLD_FRAME);
        r.drawScreenQuad({ id: 'ui' }, Q);
        return { mid, log: norm(calls), presents: presents(s).length, info: r.frameInfo };
      } finally { setFrameTarget(null); }
    };
    const bare = run(false), full = run(true);
    assert.deepEqual(full.log, bare.log, `${lane ? 'the lane' : 'the classic set'}: the same calls, in the same order, with the same arguments`);
    assert.equal(full.mid.vp, null, 'the world viewport is the canvas');
    assert.equal(full.mid.retro, null, 'no RetroPass is built - no image, no framebuffer');
    assert.equal(full.mid.frame, null);
    assert.equal(full.presents, 0, 'no present pass');
    assert.equal(full.info.scale, 1);
    assert.deepEqual(full.info.world, [1280, 720], 'the world is the canvas');
    if (lane) {
      assert.equal(full.mid.laneW, 1280, 'the lane\'s frame is the canvas\'s');
      assert.equal(full.mid.resolveTo, null, 'and it resolves to the canvas');
      assert.equal(full.mid.fbo, full.mid.target, 'the world draws into the lane\'s own frame, as today');
    } else {
      assert.equal(full.mid.fbo, null, 'the world draws straight to the canvas');
      assert.equal(full.mid.target, null);
    }
  }
  // the review: at 100% under a host's docked strip the counter's world is the STRIP, not the canvas
  {
    const { canvas } = stateGl(1280, 720);
    const r = new Renderer(canvas);
    r.setRenderScaleSource(() => 1);
    r.setWorldViewport({ x: 0, y: 0.25, w: 1, h: 0.75 });
    try {
      r.beginFrame(I, I, L, WORLD_FRAME);
      assert.equal(r.retroFrame, null);
      assert.deepEqual(r.frameInfo.world, [1280, 540], 'the host\'s world rect, in canvas pixels');
      assert.deepEqual(r.frameInfo.canvas, [1280, 720]);
      r.drawScreenQuad(null, Q);
    } finally { setFrameTarget(null); }
  }
  // a source that answers no scale below 1 is 100% too
  for (const bad of [0, -1, 2, NaN, null]) {
    const { canvas } = stateGl();
    const r = new Renderer(canvas);
    r.setRenderScaleSource(() => bad);
    try { r.beginFrame(I, I, L, WORLD_FRAME); assert.equal(r.retroFrame, null, `a scale of ${bad} takes no image`); r.drawScreenQuad(null, Q); } finally { setFrameTarget(null); }
  }
});

// ── S2: 75% ──────────

test('PERF-SCALE S2: at 75% the classic world draws into round(canvas x 0.75) and the first screen quad presents it LINEAR, unsnapped and effect-free to the whole canvas, with no black clear under an image that covers it', () => {
  const { canvas, s } = stateGl(1280, 720);
  const r = new Renderer(canvas);
  r.setRenderScaleSource(() => 0.75);
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.deepEqual(r.worldViewportPx, [0, 0, 960, 540], 'the world pass fills the image');
    assert.equal(r.retroFrame.kind, 'scale');
    const t = r.retro.target;
    assert.deepEqual([t.w, t.h], [960, 540], 'the image is 75% of the canvas each way');
    assert.equal(frameTarget(), t.fbo); assert.equal(r._frameFbo, t.fbo);
    assert.equal(s.clears.at(-1).fb, t.fbo, 'the world\'s clear lands in the image');
    assert.deepEqual(r.retroImageSpan, [540, 720], 'a sprite sized in canvas pixels is sized in the image\'s (AUDIT RETRO1 C6\'s law)');
    assert.deepEqual(r.frameInfo, { gpu: r.gpuName, world: [960, 540], canvas: [1280, 720], dpr: Number(globalThis.devicePixelRatio) || 1, scale: 0.75, retro: false });
    const clears = s.clears.length;
    s.draws.length = 0;
    r.drawScreenQuad({ id: 'ui' }, Q);
    const [p] = presents(s);
    assert.ok(p, 'the image is presented');
    assert.equal(p.fb, null, 'to the canvas');
    assert.deepEqual(p.viewport, [0, 0, 1280, 720], 'over the whole of it');
    assert.equal(p.prog.values.uSmooth[0], 1, 'the smooth present');
    assert.equal(p.prog.values.uKind[0], 0, 'no effect');
    assert.equal(p.units[0][E.TEXTURE_2D], t.tex, 'the image on unit 0');
    assert.equal(t.tex.params[E.TEXTURE_MIN_FILTER], E.LINEAR, 'LINEAR, not retro\'s Point');
    assert.equal(t.tex.params[E.TEXTURE_MAG_FILTER], E.LINEAR);
    assert.equal(s.clears.length, clears, 'an image over the whole canvas writes every pixel - no clear under it');
    assert.equal(frameTarget(), null); assert.equal(r._frameFbo, null);
    assert.equal(presents(s).length, 1, 'presented once');
  } finally { setFrameTarget(null); }
  // the shader: the smooth arm samples at the pixel's own spot and returns before the snap and the effect
  const fs = src('render/retroPass.js');
  assert.match(fs, /uniform int uSmooth;/);
  assert.match(fs, /void main\(\) \{\n {2}if \(uSmooth == 1\) \{ outColor = texture\(uColor, \(gl_FragCoord\.xy - uRect\.xy\) \/ uRect\.zw\); return; \}\n/);
});

test('PERF-SCALE S2: a docked strip - the image is the STRIP x the scale, presented to the strip over a black canvas; under the lane its frame is the image\'s size and resolves into it; the program-less fallback blits LINEAR', () => {
  {
    const { canvas, s } = stateGl(1280, 720);
    const r = new Renderer(canvas);
    r.setRenderScaleSource(() => 0.5);
    r.setWorldViewport({ x: 0, y: 0.25, w: 1, h: 0.75 });
    try {
      r.beginFrame(I, I, L, WORLD_FRAME);
      assert.deepEqual(r.worldViewportPx, [0, 0, 640, 270], 'the 1280x540 strip at 50%');
      assert.deepEqual(r.worldViewportRect, { x: 0, y: 0.25, w: 1, h: 0.75 }, 'the 2D pass\'s record is still the canvas rect (the tap ray and the crosshair map through it)');
      s.draws.length = 0; s.clears.length = 0;
      r.drawScreenQuad({ id: 'ui' }, Q);
      assert.deepEqual(presents(s)[0].viewport, [0, 180, 1280, 540], 'onto the strip');
      assert.deepEqual(s.clears.map((c) => [c.fb, c.color]), [[null, [0, 0, 0, 1]]], 'the canvas under the bar cleared once, black');
    } finally { setFrameTarget(null); }
  }
  {
    const { canvas, s } = stateGl(1280, 720);
    const r = new Renderer(canvas);
    r.setLightingLane(EL_LANE); r.setAir(true);
    r.setRenderScaleSource(() => 0.75);
    const ap = r.air;
    try {
      r.beginFrame(I, I, L, WORLD_FRAME);
      assert.deepEqual([ap.frame.w, ap.frame.h], [960, 540], 'the lane runs at the image\'s size - the air\'s passes with it');
      assert.equal(r._frameFbo, ap.frame.fbo, 'the world draws into the lane\'s frame');
      assert.equal(ap.resolveTo.fbo, r.retro.target.fbo, 'which resolves into the image');
      s.draws.length = 0;
      r.drawScreenQuad({ id: 'ui' }, Q);
      const grade = s.draws.findIndex((d) => d.prog?.locs?.has('uGrade'));
      const present = s.draws.findIndex((d) => d.prog?.locs?.has('uKind'));
      assert.ok(grade >= 0 && present > grade, 'the resolve, then the present');
      assert.equal(s.draws[grade].fb, r.retro.target.fbo);
      assert.deepEqual(s.draws[grade].viewport, [0, 0, 960, 540]);
      assert.equal(s.draws[present].prog.values.uSmooth[0], 1);
      assert.deepEqual(s.draws[present].viewport, [0, 0, 1280, 720]);
      // a menu over the world keeps the canvas slot; the world takes its image back
      r.beginFrame(I, I, L);
      assert.equal(ap.frame.w, 1280, 'a menu frame is not scaled');
      assert.equal(ap.resolveTo, null);
      r.drawScreenQuad({ id: 'ui' }, Q);
    } finally { setFrameTarget(null); }
  }
  // the warm builds the present's program when only the scale is on at load (AUDIT RETRO1 E7's step)
  {
    const { canvas } = stateGl(1280, 720);
    const r = new Renderer(canvas);
    r.setRenderScaleSource(() => 0.75);
    for (const step of r.warmSteps()) step();
    assert.ok(r.retro?.P, 'the present program is built before the first scaled frame');
    const { canvas: c2 } = stateGl(1280, 720);
    const r2 = new Renderer(c2);
    r2.setRenderScaleSource(() => 1);
    for (const step of r2.warmSteps()) step();
    assert.equal(r2.retro, null, 'and at 100% nothing is built');
  }
  // the pass without its program: a LINEAR blit for the scale, retro's NEAREST otherwise
  const src2 = src('render/retroPass.js');
  assert.match(src2, /gl\.blitFramebuffer\(0, 0, t\.w, t\.h, rect\[0\], rect\[1\], rect\[0\] \+ rect\[2\], rect\[1\] \+ rect\[3\], gl\.COLOR_BUFFER_BIT, smooth \? gl\.LINEAR : gl\.NEAREST\);/);
});

// ── S3: the UI is not scaled ──────────

test('PERF-SCALE S3: the UI is not scaled - the quad after the present, the first-person overlay and a panel draw on the canvas at its own size', () => {
  const { canvas, s } = stateGl(1280, 720);
  const r = new Renderer(canvas);
  r.setRenderScaleSource(() => 0.5);
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    s.draws.length = 0;
    r.drawScreenQuad({ id: 'ui' }, Q);
    const ui = s.draws.at(-1);
    assert.ok(!ui.prog.locs.has('uKind'), 'the last draw is the quad');
    assert.equal(ui.fb, null, 'on the canvas');
    assert.deepEqual(ui.viewport, [0, 0, 1280, 720], 'at its own size');
    assert.deepEqual(r.screenQuadProgram.values.uCanvas, [1280, 720], 'laid out in canvas pixels');
    // the first-person overlay: presented under, drawn at the canvas's size
    r.beginFrame(I, I, L, WORLD_FRAME);
    s.draws.length = 0;
    r.drawScreenOverlayQuad({ id: 'arm' }, 1, 1);
    assert.equal(presents(s).length, 1, 'the world image first');
    assert.equal(s.draws.at(-1).fb, null);
    assert.deepEqual(s.draws.at(-1).viewport, [0, 0, 1280, 720], 'the arm at the canvas\'s resolution, never in the image');
    // a panel (the automap, the paper doll) inside a scaled frame
    r.beginFrame(I, I, L, WORLD_FRAME);
    let inside = null;
    r.panelFrame({ proj: I, view: I, lightDir: L, rect: { x: 10, y: 20, w: 100, h: 100 } }, () => { inside = { fbo: r._frameFbo, target: frameTarget(), frame: r.retroFrame }; });
    assert.equal(inside.fbo, null, 'a panel keeps the canvas');
    assert.equal(inside.target, null);
  } finally { setFrameTarget(null); }
});

// ── S4: retro wins ──────────

test('PERF-SCALE S4: retro wins over the scale - its own image and effect, Point-filtered; retro off hands the world to the scale and the filter follows the kind both ways', () => {
  const { canvas, s } = stateGl(1280, 720);
  const r = new Renderer(canvas);
  let retro = retroCfg({ post: 1 });
  r.setRetroSource(() => retro);
  r.setRenderScaleSource(() => 0.5);
  try {
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.equal(r.retroFrame.kind, 'retro');
    assert.deepEqual(r.worldViewportPx, [0, 0, 320, 200], 'retro\'s 320x200, not 640x360');
    assert.deepEqual([r.frameInfo.scale, r.frameInfo.retro], [1, true], 'the counter says retro, not 50%');
    s.draws.length = 0;
    r.drawScreenQuad({ id: 'ui' }, Q);
    let p = presents(s)[0];
    assert.equal(p.prog.values.uSmooth[0], 0, 'retro\'s own present');
    assert.equal(p.prog.values.uKind[0], 1, 'with its effect');
    assert.equal(r.retro.target.tex.params[E.TEXTURE_MAG_FILTER], E.NEAREST, 'Point');
    // retro off: the scale takes the world - and retro's palette LUT is freed as retro off always freed it (AUDIT RETRO1 E2)
    const lut = { tex: { kind: 'tex', id: -1, params: {} }, shift: 1, size: 128 };
    r.retro.lut = lut;
    retro = null;
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.equal(r.retroFrame.kind, 'scale');
    assert.equal(r.retro.lut, null, 'the LUT freed - a 64 MiB table at shift 0 is not kept for a mode that is off');
    assert.equal(lut.tex.deleted, true);
    assert.deepEqual(r.worldViewportPx, [0, 0, 640, 360]);
    s.draws.length = 0;
    r.drawScreenQuad({ id: 'ui' }, Q);
    assert.equal(r.retro.target.tex.params[E.TEXTURE_MAG_FILTER], E.LINEAR, 'smooth for the scale');
    assert.equal(presents(s)[0].prog.values.uSmooth[0], 1);
    // and back: Point again
    retro = retroCfg({ post: 0 });
    r.beginFrame(I, I, L, WORLD_FRAME);
    s.draws.length = 0;
    r.drawScreenQuad({ id: 'ui' }, Q);
    p = presents(s)[0];
    assert.equal(r.retro.target.tex.params[E.TEXTURE_MIN_FILTER], E.NEAREST);
    assert.equal(r.retro.target.tex.params[E.TEXTURE_MAG_FILTER], E.NEAREST, 'the retro image is Point again');
    assert.equal(p.prog.values.uSmooth[0], 0);
  } finally { setFrameTarget(null); }
  // ONE image kept across the kinds (a 640x400 canvas at 50% is retro's own 320x200, so nothing is reallocated): the
  // filter goes LINEAR for the scale and back to Point for retro on the same texture
  {
    const { canvas: c2 } = stateGl(640, 400);
    const r2 = new Renderer(c2);
    let cfg = retroCfg({ post: 0 });
    r2.setRetroSource(() => cfg);
    r2.setRenderScaleSource(() => 0.5);
    try {
      const filterAfter = () => { r2.beginFrame(I, I, L, WORLD_FRAME); r2.drawScreenQuad(null, Q); return [r2.retro.target, r2.retro.target.tex.params[E.TEXTURE_MAG_FILTER]]; };
      const [t0, f0] = filterAfter();
      cfg = null;
      const [t1, f1] = filterAfter();
      cfg = retroCfg({ post: 0 });
      const [t2, f2] = filterAfter();
      assert.ok(t0 === t1 && t1 === t2, 'one image throughout');
      assert.deepEqual([f0, f1, f2], [E.NEAREST, E.LINEAR, E.NEAREST], 'Point, smooth, Point again');
    } finally { setFrameTarget(null); }
  }
  const rs = src('render/renderer.js');
  assert.match(rs, /const scaled = cfg \? null : this\._scaledImage\(\);/, 'the scale is read only when retro answered none');
});

// ── S5: the setting ──────────

test('PERF-SCALE S5: the setting - a Sight row with its five tiers, 100% the default, the player\'s own online, offered on its tile, persisted on the shelf and read per world frame through main.js', () => {
  const row = FEATURES.find((f) => f.id === 'render-scale');
  assert.ok(row, 'the row');
  assert.equal(row.group, 'sight', 'with the other dials of what you see');
  assert.equal(row.title, 'Render scale');
  assert.deepEqual(row.control.tiers.map(([v, l]) => [v, l]), [[1, '100%'], [0.85, '85%'], [0.75, '75%'], [0.67, '67%'], [0.5, '50%']]);
  assert.deepEqual([...RENDER_SCALES], [1, 0.85, 0.75, 0.67, 0.5], 'the module reads the row\'s tiers - one declaration');
  assert.equal(row.effect, 'Takes effect at once.', 'read per world frame, so the press lands on the next');
  assert.equal(FEATURE_PREF_DEFAULTS.renderScale, 1);
  assert.equal(PREF_DEFAULTS.renderScale, 1, '100% - nothing changes for a player who never touches it');
  assert.equal(onlineForcedPref('renderScale', '?online=1'), undefined, 'the player\'s own online');
  assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes('renderScale'));
  assert.match(row.note, /Retro Picture Mode/, 'the row says what wins over it');
  // a value that names no tier is 100%
  assert.equal(renderScaleOf(0.75), 0.75);
  assert.equal(renderScaleOf('0.5'), 0.5);
  for (const bad of [0.3, 2, 'x', '', null, undefined]) assert.equal(renderScaleOf(bad), null, String(bad));
  // the review: a tier is matched by its STRING, as the tile matches it - a value the tile shows as 100% never runs scaled
  for (const odd of ['0.750', ' 0.5 ', '.5', '5e-1', '0.50']) assert.equal(renderScaleOf(odd), null, `${JSON.stringify(odd)} is no tier on the tile, so none here`);
  // the shelf, and the tile that writes it
  let store = new Map();
  const prevLs = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const fakeEl = () => {
    const n = { children: [], className: '', textContent: '', title: '', style: {}, dataset: {}, attrs: {}, append(...cs) { n.children.push(...cs); }, setAttribute(k, v) { n.attrs[k] = v; }, addEventListener() {}, removeEventListener() {} };
    return n;
  };
  const find = (n, cls, out = []) => { if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) find(c, cls, out); return out; };
  const tile = () => {
    globalThis.document = { createElement: fakeEl, createTextNode: (t) => ({ textContent: t }), querySelectorAll: () => [] };
    try { return find(find(featureTile(row), 'ft-seg')[0], 'ft-segb'); } finally { delete globalThis.document; }
  };
  try {
    store = new Map(); resetPrefs(); _resetRenderScaleDoor();
    let segs = tile();
    assert.deepEqual(segs.map((b) => b.textContent), ['100%', '85%', '75%', '67%', '50%'], 'offered with its options');
    assert.deepEqual(segs.map((b) => b.attrs['aria-pressed']), ['true', 'false', 'false', 'false', 'false'], '100% by default');
    assert.equal(renderScaleSetting(), 1);
    segs.find((b) => b.textContent === '75%').onclick({ stopPropagation() {} });
    assert.equal(getPref('renderScale'), 0.75);
    assert.equal(JSON.parse(store.get('dagger.ui.v1')).renderScale, 0.75, 'written to the shelf');
    resetPrefs(); loadPrefs();
    assert.equal(getPref('renderScale'), 0.75, 'and read back after a reload');
    assert.equal(renderScaleSetting(), 0.75, 'the renderer\'s source answers it');
    segs = tile();
    assert.equal(segs.find((b) => b.attrs['aria-pressed'] === 'true').textContent, '75%');
    setPref('renderScale', 0.42);
    assert.equal(renderScaleSetting(), 1, 'a shelf value that names no tier is 100%');
    setPref('renderScale', '0.750');
    assert.equal(tile().find((b) => b.attrs['aria-pressed'] === 'true').textContent, '100%', 'the tile reads "0.750" as no tier');
    assert.equal(renderScaleSetting(), 1, 'and so does the renderer\'s source');
    // the door, read once a page
    const prevLoc = globalThis.location;
    globalThis.location = { search: '?renderscale=0.5' };
    try {
      _resetRenderScaleDoor();
      assert.equal(renderScaleSetting(), 0.5, 'the probe\'s door wins');
      globalThis.location = { search: '' };
      assert.equal(renderScaleSetting(), 0.5, 'read once');
      globalThis.location = { search: '?renderscale=.5' };
      _resetRenderScaleDoor();
      assert.equal(renderScaleSetting(), 1, 'a door that names no tier by its string is none');
    } finally { globalThis.location = prevLoc; _resetRenderScaleDoor(); }
  } finally { globalThis.localStorage = prevLs; resetPrefs(); }
  // the wire: main.js hands the renderer the source beside retro's
  const main = src('main.js');
  assert.match(main, /import \{ renderScaleSetting \} from '\.\/systems\/renderScale\.js';/);
  assert.match(main, /renderer\.setRetroSource\(retroFrameConfig\);[^\n]*\n\s+renderer\.setRenderScaleSource\(renderScaleSetting\);/);
  // and the renderer asks it once per WORLD frame, live
  let asked = 0, scale = 1;
  const { canvas } = stateGl(1280, 720);
  const r = new Renderer(canvas);
  r.setRenderScaleSource(() => { asked++; return scale; });
  try {
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
    r.beginFrame(I, I, L); r.drawScreenQuad(null, Q);
    assert.equal(asked, 1, 'a menu frame does not ask');
    scale = 0.67;
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.deepEqual(r.worldViewportPx, [0, 0, 858, 482], 'the next world frame takes the new tier: round(1280 x 0.67) x round(720 x 0.67)');
    r.drawScreenQuad(null, Q);
    scale = 1;
    r.beginFrame(I, I, L, WORLD_FRAME);
    assert.equal(r.worldViewportPx, null, 'and 100% gives the world the canvas back');
    assert.equal(r._frameFbo, null);
    r.drawScreenQuad(null, Q);
  } finally { setFrameTarget(null); }
});

// ── S6: the counter ──────────

test('PERF-SCALE S6: the GPU is read ONCE, at the renderer\'s birth - the unmasked name where the browser gives it, gl.RENDERER otherwise, null when neither is a string', () => {
  const g = gpuGl('NVIDIA GeForce RTX 4060 Ti');
  const r = new Renderer(g.canvas);
  r.setRenderScaleSource(() => 0.75);
  assert.equal(r.gpuName, 'NVIDIA GeForce RTX 4060 Ti');
  try {
    for (let i = 0; i < 5; i++) { r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q); void r.frameInfo; }
  } finally { setFrameTarget(null); }
  assert.equal(g.asked.filter((p) => p === UNMASKED_RENDERER_WEBGL).length, 1, 'one read in five frames and five info reads');
  assert.equal(r.frameInfo.gpu, 'NVIDIA GeForce RTX 4060 Ti');
  const masked = gpuGl('x', { ext: false, renderer: 'AMD Radeon RX 6600' });
  assert.equal(gpuNameOf(masked.gl), 'AMD Radeon RX 6600', 'the extension refused: gl.RENDERER');
  assert.equal(gpuNameOf(stateGl().gl), null, 'no string: null, never a Float32Array');
  assert.equal(gpuNameOf({ getExtension() { throw new Error('lost'); } }), null, 'a lost context throws nothing out');
});

test('PERF-SCALE S6: the counter shows the GPU line and the size line while on, reads neither while hidden, and __fpsStats carries both', () => {
  const prev = { d: globalThis.document, w: globalThis.window, dpr: globalThis.devicePixelRatio };
  const stubEl = () => ({ id: '', textContent: '', style: { cssText: '', display: '' }, children: [], appendChild(c) { this.children.push(c); return c; }, remove() { this.removed = true; } });
  globalThis.document = { createElement: stubEl, body: stubEl() };
  globalThis.window = {};
  globalThis.devicePixelRatio = 1.5;
  const g = gpuGl('NVIDIA GeForce RTX 4060 Ti');
  const r = new Renderer(g.canvas);
  r.setRenderScaleSource(() => 0.75);
  try {
    r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
    let on = false, infoReads = 0;
    const c = mountFpsCounter({ enabled: () => on, raf: null, stats: () => r.stats, info: () => { infoReads++; return r.frameInfo; } });
    // AUDIT BRANCH-0925 PS-A4: the box is capped at the window less its two 8px margins and the safe areas, and a
    // line longer than that WRAPS - a Windows ANGLE name ("ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Ti (0x00002803)
    // Direct3D11 vs_5_0 ps_5_0, D3D11)") made an unwrapped box 728px wide, 346px off a 390px phone's left edge, and
    // the size line alone overflows a phone. tools/fpsCounterProbe.mjs measures it in Chromium.
    const css = c.el.style.cssText;
    assert.match(css, /max-width:calc\(100vw - 16px - env\(safe-area-inset-left, 0px\) - env\(safe-area-inset-right, 0px\)\);box-sizing:border-box;/, 'capped at the window');
    assert.match(css, /white-space:pre-wrap;overflow-wrap:anywhere;/, 'and a long line wraps inside it');
    assert.doesNotMatch(css, /white-space:pre;/);
    for (let t = 0; t <= 1020; t += 1000 / 60) c.tick(t);
    assert.equal(infoReads, 0, 'hidden: never read');
    assert.equal(c.el.textContent, '', 'and nothing written');
    const st = globalThis.window.__fpsStats();
    assert.equal(infoReads, 1, 'the probe\'s ask reads it, once');
    assert.equal(st.gpu, 'NVIDIA GeForce RTX 4060 Ti');
    assert.deepEqual([st.world, st.canvas, st.dpr, st.scale, st.retro], [[960, 540], [1280, 720], 1.5, 0.75, false]);
    assert.ok(st.fps > 0, 'beside the second\'s numbers');
    on = true;
    for (let t = 1040; t <= 2100; t += 1000 / 60) c.tick(t);
    const lines = c.el.textContent.split('\n');
    assert.ok(lines.includes('gpu NVIDIA GeForce RTX 4060 Ti'), `the GPU line: ${JSON.stringify(lines)}`);
    assert.ok(lines.includes('world 960x540  canvas 1280x720  dpr 1.5  scale 75%'), `the size line: ${JSON.stringify(lines)}`);
    assert.equal(g.asked.filter((p) => p === UNMASKED_RENDERER_WEBGL).length, 1, 'the counter\'s seconds never ask the GPU again');
    c.dispose();
    // the review: under retro the probe's read says so; a GPU no browser would name reads "unknown"
    const rr = new Renderer(stateGl(1280, 720).canvas);
    rr.setRetroSource(() => retroCfg());
    rr.setRenderScaleSource(() => 0.75);
    rr.beginFrame(I, I, L, WORLD_FRAME); rr.drawScreenQuad(null, Q);
    assert.equal(rr.gpuName, null, 'the fake GL names no GPU');
    let shown = true;
    const c2 = mountFpsCounter({ enabled: () => shown, raf: null, stats: () => rr.stats, info: () => rr.frameInfo });
    for (let t = 0; t <= 1020; t += 1000 / 60) c2.tick(t);
    const st2 = globalThis.window.__fpsStats();
    assert.deepEqual([st2.retro, st2.scale, st2.world], [true, 1, [320, 200]], 'retro, and the scale it took is none');
    const lines2 = c2.el.textContent.split('\n');
    assert.ok(lines2.includes('gpu unknown'), `the GPU line still stands: ${JSON.stringify(lines2)}`);
    assert.ok(lines2.includes('world 320x200  canvas 1280x720  dpr 1.5  scale retro'), JSON.stringify(lines2));
    shown = false;
    c2.dispose();
  } finally {
    setFrameTarget(null);
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.devicePixelRatio = prev.dpr;
  }
  assert.equal(sizeLine({ world: [320, 200], canvas: [1920, 1080], dpr: 1, scale: 1, retro: true }), 'world 320x200  canvas 1920x1080  dpr 1  scale retro');
  assert.equal(sizeLine({ world: [2560, 1440], canvas: [2560, 1440], dpr: 2, scale: 1 }), 'world 2560x1440  canvas 2560x1440  dpr 2  scale 100%');
  assert.equal(sizeLine(null), null);
  // a browser zoomed to 90% answers a float's 0.9 - the line shows two places, not the float
  assert.equal(sizeLine({ world: [1280, 720], canvas: [1280, 720], dpr: 0.8999999761581421, scale: 1 }), 'world 1280x720  canvas 1280x720  dpr 0.9  scale 100%');
});

// ── S7: the review ──────────

test('PERF-SCALE S7 (the review): the world frame that goes back to no image frees the image and its depth, and under the lane the image-sized frame, while a menu\'s canvas-sized frame stays; retro off frees them too', () => {
  for (const lane of [false, true]) {
    const { canvas } = stateGl(1920, 1080);
    const r = new Renderer(canvas);
    if (lane) { r.setLightingLane(EL_LANE); r.setAir(true); }
    let scale = 0.75;
    r.setRenderScaleSource(() => scale);
    try {
      r.beginFrame(I, I, L); r.drawScreenQuad({ id: 'ui' }, Q);   // a menu first: the lane's canvas slot
      for (let k = 0; k < 3; k++) { r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad({ id: 'ui' }, Q); }
      const img = r.retro.target;
      assert.deepEqual([img.w, img.h], [1440, 810]);
      const slot = lane ? r.air._frames.retro : null, canvasSlot = lane ? r.air._frames.canvas : null;
      if (lane) assert.deepEqual([slot.w, slot.h, canvasSlot.w], [1440, 810, 1920], 'the lane\'s image-sized frame beside its canvas one');
      scale = 1;
      r.beginFrame(I, I, L, WORLD_FRAME);
      assert.equal(r.retro.target, null, `${lane ? 'the lane' : 'the classic set'}: the image is let go at 100%`);
      assert.deepEqual([img.tex.deleted, img.depth.deleted, img.fbo.deleted], [true, true, true], 'its texture, its depth and its framebuffer');
      if (lane) {
        assert.equal(r.air._frames.retro, null, 'the lane\'s image-sized frame too');
        assert.ok(slot.tex.deleted && slot.depths.every((d) => d.deleted) && slot.depthFbos.every((f) => f.deleted) && slot.fbo.deleted);
        assert.equal(r.air._frames.canvas, canvasSlot, 'the canvas-sized frame the world draws into now is kept');
        assert.ok(!canvasSlot.tex.deleted);
        assert.equal(r.air.frame, canvasSlot);
      }
      r.drawScreenQuad({ id: 'ui' }, Q);
      for (let k = 0; k < 3; k++) { r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad({ id: 'ui' }, Q); }
      assert.equal(r.retro.target, null, 'and stays let go');
      // back to 75%: a fresh image, Point until the present smooths it
      scale = 0.75;
      r.beginFrame(I, I, L, WORLD_FRAME);
      const img2 = r.retro.target;
      assert.ok(img2 && img2 !== img, 'allocated afresh');
      r.drawScreenQuad({ id: 'ui' }, Q);
      assert.equal(img2.tex.params[E.TEXTURE_MAG_FILTER], E.LINEAR);
      // retro off (the scale at 100%) frees retro's image the same way
      scale = 1;
      let cfg = retroCfg();
      r.setRetroSource(() => cfg);
      r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad({ id: 'ui' }, Q);
      const rimg = r.retro.target;
      assert.deepEqual([rimg.w, rimg.h], [320, 200]);
      cfg = null;
      r.beginFrame(I, I, L, WORLD_FRAME);
      assert.equal(r.retro.target, null);
      assert.equal(rimg.tex.deleted, true);
      r.drawScreenQuad({ id: 'ui' }, Q);
    } finally { setFrameTarget(null); }
  }
  // the lane's drop leaves no frame pointing at what it freed (the image-sized frame is the lane's live one after its resolve)
  {
    const { canvas } = stateGl(1280, 720);
    const r = new Renderer(canvas);
    r.setLightingLane(EL_LANE); r.setAir(true);
    r.setRenderScaleSource(() => 0.5);
    try {
      r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
      const slot = r.air._frames.retro;
      assert.equal(r.air.frame, slot);
      r.air.dropFrame('retro');
      assert.deepEqual([r.air.frame, r.air._frames.retro, slot.tex.deleted], [null, null, true]);
      assert.doesNotThrow(() => r.air.dropFrame('retro'), 'twice is nothing');
    } finally { setFrameTarget(null); }
  }
  // AUDIT BRANCH-0925 PS-A2: the lane turned OFF at 75%, then 100% - the renderer lets go of its AirPass (`air` is
  // null while the lane is off) but keeps the pass itself, and with it the image-sized frame; the drop is the kept
  // pass's, or the frame (a colour image, two depths and three framebuffers) is held for the rest of the session -
  // `_retroFrame` is null from then on, so nothing would ever ask again, the lane back on or not
  {
    const { canvas } = stateGl(1920, 1080);
    const r = new Renderer(canvas);
    r.setLightingLane(EL_LANE); r.setAir(true);
    let scale = 0.75;
    r.setRenderScaleSource(() => scale);
    try {
      for (let k = 0; k < 2; k++) { r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q); }
      const pass = r.air, slot = pass._frames.retro;
      assert.deepEqual([slot.w, slot.h], [1440, 810], 'the lane\'s image-sized frame');
      r.setLightingLane(null);   // Enhanced Lighting off (the hosts' syncLightingLane at the next mount)
      assert.equal(r.air, null, 'the lane off lets go of the air pass');
      for (let k = 0; k < 2; k++) { r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q); }
      assert.equal(pass._frames.retro, slot, 'still kept while the world draws scaled');
      scale = 1;
      r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
      assert.equal(r.retro.target, null);
      assert.equal(pass._frames.retro, null, 'the lane off, the scale at 100%: the kept pass\'s image-sized frame is let go');
      assert.deepEqual([slot.tex.deleted, ...slot.depths.map((d) => d.deleted), ...slot.depthFbos.map((f) => f.deleted), slot.fbo.deleted], [true, true, true, true, true, true]);
      r.setLightingLane(EL_LANE);   // and the lane back on at 100% draws into its canvas-sized frame alone
      r.beginFrame(I, I, L, WORLD_FRAME); r.drawScreenQuad(null, Q);
      assert.equal(r.air, pass, 'the same pass, reinstalled');
      assert.equal(pass._frames.retro, null);
      assert.ok(pass._frames.canvas && pass.frame === pass._frames.canvas);
    } finally { setFrameTarget(null); }
  }
  // an owed image is presented BEFORE it is freed: the frame with no quad, then 100%
  {
    const { canvas, s } = stateGl(1280, 720);
    const r = new Renderer(canvas);
    let scale = 0.5;
    r.setRenderScaleSource(() => scale);
    try {
      r.beginFrame(I, I, L, WORLD_FRAME);   // no quad: owed
      const img = r.retro.target;
      scale = 1;
      s.draws.length = 0;
      r.beginFrame(I, I, L, WORLD_FRAME);
      const [p] = presents(s);
      assert.ok(p, 'the owed image presented');
      assert.equal(p.units[0][E.TEXTURE_2D], img.tex, 'from the live image');
      assert.equal(img.tex.deleted, true, 'then freed');
      r.drawScreenQuad(null, Q);
    } finally { setFrameTarget(null); }
  }
});

test('PERF-SCALE S7 (the review): ONE reading of "the scale is on" - a source answering 0 or less, 1 or more, or no number builds nothing in the warm, as the frame takes no image for it', () => {
  for (const v of [0, -1, 1, 2, NaN, 'x']) {
    const { canvas } = stateGl(1280, 720);
    const r = new Renderer(canvas);
    r.setRenderScaleSource(() => v);
    for (const step of r.warmSteps()) step();
    assert.equal(r.retro, null, `a source answering ${String(v)} warms no present`);
    try { r.beginFrame(I, I, L, WORLD_FRAME); assert.equal(r.retroFrame, null); r.drawScreenQuad(null, Q); } finally { setFrameTarget(null); }
  }
  for (const v of [0.5, 0.99]) {
    const { canvas } = stateGl(1280, 720);
    const r = new Renderer(canvas);
    r.setRenderScaleSource(() => v);
    for (const step of r.warmSteps()) step();
    assert.ok(r.retro?.P, `${v}: warmed`);
  }
});
