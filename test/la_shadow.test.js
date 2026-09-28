// LA-SHADOW / LA-LIGHTS (2026-09-27, Mac: "a deep audit on the enhanced lightning system, look for flickering issues,
// performance improvements and just a complete detailed overhaul"): THE SHADOWS HOLD STILL.
//
// Measured first (tools/lightFlickerProbe.mjs, the world host over ARENA2 on SwiftShader), then pinned here:
// - LA-SHADOW1: the sun's texel grid was snapped at the WORLD ORIGIN, so as the sun turned (a game minute is five real
//   seconds) the ground under a player hundreds of units off it slid up to half a cascade-0 texel a frame - every
//   shadow edge near a standing player crawled. It is snapped at an anchor beside the eye now, held with hysteresis
//   and carried by the floating origin; and the basis's up is the world's Z, which the sun's path never crosses (the
//   old up flipped from Y to Z within eight degrees of the zenith and turned the whole grid in one frame).
// - LA-SHADOW2: the cascades handed over at a hard line (a ring of popping shadows about the player) and the far one
//   stopped at its box's square edge; a band now mixes each into the next and the far one fades out by distance.
// - LA-SHADOW3: the dungeon hosts draw the level whole, so every torch keeps a shadow map (DISC15's lo tier) and none
//   lights through the rock as the nearest eight change (pinned in test/disc15.test.js, re-aimed).
// - LA-SHADOW4: a dungeon torch's flicker crossed PERF-FLICKER's quantum and flipped its shadow's far, redrawing its
//   map at each crossing; the far is held across the flicker now, and the caster table carries a lo map's far.
// - LA-LIGHTS1: a town lantern's flicker was its POOL index's, so a pixel streamed out moved every later lantern onto
//   another's range at once; each lantern flickers on its own pixel-named slot now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import {
  SHADOW_CASCADES, SHADOW_SUN_SIZE, SHADOW_GLSL, SHADOW_POINT_CASTERS, SHADOW_FAR_QUANTUM, SUN_ANCHOR_STEP, SUN_ANCHOR_HOLD,
  SUN_CASCADE_BAND, SHADOW_FAR_HOLD, SHADOW_CASTER_FAR_SHIFT, sunAnchorFor, sunCascadeMatrices, sunTexelWorld, shadowFarFor,
  heldShadowFar, casterWord,
} from '../src/render/shadowPass.js';
import { CityLightAnimator, sunDirection } from '../src/world/worldClock.js';
import { lanternSlot, nearestLights, capFadeColors, LIGHT_CAP_FADE, fillLanternPool } from '../src/world/cityLights.js';
import { transformPoint } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A view whose eye stands at (x, y, z), looking down -Z. */
const viewAt = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
/** A world point's texel coordinates on cascade c's map (continuous: a whole number is a texel's corner). */
const texelOf = (vp, p) => { const q = transformPoint(vp, p[0], p[1], p[2]); return [q[0] * SHADOW_SUN_SIZE / 2, q[1] * SHADOW_SUN_SIZE / 2]; };
const frac = (v) => Math.abs(v - Math.round(v));
const cascades = () => SHADOW_CASCADES.map(() => new Float32Array(16));

/** A recording fake GL (disc15's shape). */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? a.slice() : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}

/** The lane on the fake GL with one room mesh reaching everything; `frame` draws it under the lights and eye given. */
function stage({ sun = false } = {}) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.textures.set('1_1', { id: 't11' });
  r.setLighting(new Float32Array([0.18, 0.18, 0.18]), sun ? 1 : 0);
  const room = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 900]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const frame = ({ lights = new Float32Array(0), view = I, lightDir = new Float32Array([0.45, 0.8, 0.35]), every = false } = {}) => {
    r.setPointLights(lights, new Float32Array([1, 1, 1]));
    if (every) r.everyLightCasts();
    calls.length = 0;
    r.beginFrame(I, view, lightDir, WORLD_FRAME);
    const sp = r.shadows;
    const st = { ...sp.stats, casterOf: [...sp.casterOf], sunVP: sp.sunVP.map((m) => m.slice()), anchor: [...sp._sunAnchor] };
    r.drawMesh(room, I, null);
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  return { r, frame };
}

// ── LA-SHADOW1: the anchor ────────────────────────────────────────────────────────────────────────────────────────

test('LA-SHADOW1: the anchor is taken at the eye rounded to SUN_ANCHOR_STEP, held while the eye is within SUN_ANCHOR_HOLD of it, and re-taken past it', () => {
  assert.equal(SUN_ANCHOR_STEP, 8); assert.equal(SUN_ANCHOR_HOLD, 24);
  assert.ok(SUN_ANCHOR_HOLD > SUN_ANCHOR_STEP, 'the hold outlasts the rounding, or a fresh anchor could be out of its own hold');
  const a = new Float64Array([NaN, NaN, NaN]);
  assert.equal(sunAnchorFor([403.7, 12.2, -290.1], a), true, 'none yet: one is taken');
  assert.deepEqual([...a], [400, 16, -288]);
  assert.equal(sunAnchorFor([420, 12.2, -290.1], a), false, '20 off: held');
  assert.deepEqual([...a], [400, 16, -288]);
  assert.equal(sunAnchorFor([400, 16 + 23.9, -288], a), false, 'held up to the hold');
  assert.equal(sunAnchorFor([425, 12.2, -290.1], a), true, '25 off: re-taken');
  assert.deepEqual([...a], [424, 16, -288]);
});

test('LA-SHADOW1: the anchor is on every cascade\'s texel grid, and a walk that keeps it moves every world point by whole texels', () => {
  const eye = [403.7, 12.2, -290.1], ld = sunDirection(9 * 60);
  const anchor = new Float64Array([NaN, NaN, NaN]);
  sunAnchorFor(eye, anchor);
  const out = sunCascadeMatrices(eye, ld, cascades(), anchor);
  for (let c = 0; c < SHADOW_CASCADES.length; c++) {
    const [tx, ty] = texelOf(out[c], anchor);
    assert.ok(frac(tx) < 2e-3 && frac(ty) < 2e-3, `cascade ${c}: the anchor on the grid (${tx}, ${ty})`);
  }
  const eye2 = [eye[0] + 3.37, eye[1] - 0.2, eye[2] + 1.91];
  assert.equal(sunAnchorFor(eye2, anchor), false);
  const moved = sunCascadeMatrices(eye2, ld, cascades(), anchor);
  for (const p of [[401, 11, -289], [410.3, 12, -285.5]]) {
    const a = texelOf(out[0], p), b = texelOf(moved[0], p);
    assert.ok(frac(a[0] - b[0]) < 2e-2 && frac(a[1] - b[1]) < 2e-2, `${p}: a whole number of texels (${a[0] - b[0]}, ${a[1] - b[1]})`);
  }
});

test('LA-SHADOW1: AS THE SUN TURNS, the ground beside a player four hundred units from the origin slides a tenth of what it did - the base\'s grid (snapped at the origin) moved it half a texel a frame', () => {
  const eye = [403.7, 12.2, -290.1];
  const ground = [405, 10.5, -292];   // two metres from the eye
  // one frame at 60 fps of a morning sun: the day's half turn over 720 game minutes of five real seconds
  const m0 = 9 * 60, dm = 1 / (60 * 5);
  const l0 = sunDirection(m0), l1 = sunDirection(m0 + dm);
  const slide = (anchor) => {
    const a = texelOf(sunCascadeMatrices(eye, l0, cascades(), anchor)[0], ground);
    const b = texelOf(sunCascadeMatrices(eye, l1, cascades(), anchor)[0], ground);
    return Math.max(frac(a[0] - b[0]), frac(a[1] - b[1]));   // the sub-texel part: a whole texel is the snap's own step
  };
  const anchor = new Float64Array([NaN, NaN, NaN]);
  sunAnchorFor(eye, anchor);
  const base = slide([0, 0, 0]), now = slide(anchor);
  assert.ok(base > 0.2, `the base: the origin-snapped grid slid ${base.toFixed(3)} of a texel in one frame`);
  assert.ok(now < 0.02, `now: ${now.toFixed(4)} of a texel`);
  assert.ok(now * 10 < base);
});

test('LA-SHADOW1: THE GRID NEVER TURNS AT NOON - across the zenith the map\'s axes move with the sun, a hair a minute, where the base\'s flipped ninety degrees at 11:28', () => {
  const eye = [0, 0, 0];
  let prev = null, worst = 0;
  for (let m = 11 * 60; m <= 13 * 60; m += 0.5) {
    const vp = sunCascadeMatrices(eye, sunDirection(m), cascades())[0];
    const axis = [vp[0], vp[4], vp[8]];   // the map's x in world space
    const l = Math.hypot(...axis); const x = axis.map((v) => v / l);
    if (prev) worst = Math.max(worst, Math.acos(Math.min(1, x[0] * prev[0] + x[1] * prev[1] + x[2] * prev[2])));
    prev = x;
  }
  assert.ok(worst < 0.01, `the largest turn of the map between half-minutes: ${(worst * 180 / Math.PI).toFixed(3)} degrees`);
});

test('LA-SHADOW1: THE PASS - the sun\'s maps are snapped at its held anchor beside the eye; a recentre carries the anchor, so the moved world lands on the texels it held', () => {
  const s = stage({ sun: true });
  const view = viewAt(403.7, 12.2, -290.1);
  s.frame({ view });
  const a = s.frame({ view });
  assert.deepEqual(a.anchor, [400, 16, -288], 'the anchor: the eye rounded');
  for (let c = 0; c < SHADOW_CASCADES.length; c++) {
    const [tx, ty] = texelOf(a.sunVP[c], a.anchor);
    assert.ok(frac(tx) < 2e-2 && frac(ty) < 2e-2, `cascade ${c}: its map snapped at the anchor (${tx}, ${ty})`);
  }
  // a recentre: the host moves the world by `off` and says so
  const off = [-819.2, 0, 409.6];
  s.r.shadowOriginShift(off);
  const b = s.frame({ view: viewAt(403.7 + off[0], 12.2, -290.1 + off[2]) });
  assert.deepEqual(b.anchor, [400 + off[0], 16, -288 + off[2]], 'the anchor moved with the world, not re-taken');
  const p = [405, 10.5, -292], q = [p[0] + off[0], p[1], p[2] + off[2]];
  const ta = texelOf(a.sunVP[0], p), tb = texelOf(b.sunVP[0], q);
  assert.ok(frac(ta[0] - tb[0]) < 2e-2 && frac(ta[1] - tb[1]) < 2e-2, `a point and its recentred self on the same texel phase (${ta[0] - tb[0]}, ${ta[1] - tb[1]})`);
});

// ── LA-SHADOW2: the handover ──────────────────────────────────────────────────────────────────────────────────────

/** sunShadowTap's weights, transcribed: the cascade picked at distance d and the share of the next mixed in. */
function twin(d) {
  const [r0, r1, r2] = SHADOW_CASCADES;
  const c = d < r0 * 0.9 ? 0 : d < r1 * 0.9 ? 1 : 2;
  const r = [r0, r1, r2][c];
  const e0 = r * (0.9 - SUN_CASCADE_BAND), e1 = r * 0.9;
  const x = Math.max(0, Math.min(1, (d - e0) / (e1 - e0)));
  return { c, t: x * x * (3 - 2 * x) };
}

test('LA-SHADOW2: THE CASCADES HAND OVER IN A BAND - sunShadowTap picks by distance as it did, mixes the next cascade in over the band before the line, and fades the far one to lit; the lookup is sunCascadeTap\'s, whole', () => {
  assert.equal(SUN_CASCADE_BAND, 0.2);
  const tap = /float sunShadowTap\(vec3 wp, vec3 n, bool soft\) \{([\s\S]*?)\n\}/.exec(SHADOW_GLSL)[1];
  assert.match(tap, /int c = d < uSunShadowParams\.x \* 0\.9 \? 0 : d < uSunShadowParams\.y \* 0\.9 \? 1 : 2;/, 'the pick as it was');
  assert.match(tap, /float r = c == 0 \? uSunShadowParams\.x : c == 1 \? uSunShadowParams\.y : uSunShadowParams\.z;/);
  assert.match(tap, /float t = smoothstep\(r \* 0\.70, r \* 0\.9, d\);/, 'the band: the last fifth of the reach before the line');
  assert.match(tap, /if \(c == 2\) return t >= 1\.0 \? 1\.0 : mix\(sunCascadeTap\(2, wp, n, soft\), 1\.0, t\);/, 'the far one fades to lit, and past its fade reads nothing');
  assert.match(tap, /float lit = sunCascadeTap\(c, wp, n, soft\);\n\s+return t > 0\.0 \? mix\(lit, sunCascadeTap\(c \+ 1, wp, n, soft\), t\) : lit;/, 'the next one mixed in, only in the band');
  assert.doesNotMatch(tap, /texture\(uSunShadow/, 'the pick reads no map itself');
  assert.match(SHADOW_GLSL, /float sunCascadeTap\(int c, vec3 wp, vec3 n, bool soft\) \{/);
  assert.ok(SHADOW_GLSL.indexOf('float sunCascadeTap(') < SHADOW_GLSL.indexOf('float sunShadowTap('), 'declared before its caller');
});

test('LA-SHADOW2: the twin - continuous across every line (the next cascade whole at the handover), and the far fade done inside the far box', () => {
  for (let c = 0; c < 2; c++) {
    const line = SHADOW_CASCADES[c] * 0.9;
    const below = twin(line - 1e-6), above = twin(line + 1e-6);
    assert.equal(below.c, c); assert.equal(above.c, c + 1);
    assert.ok(below.t > 0.999, `cascade ${c}: all of the next one at its line (${below.t})`);
    assert.ok(above.t < 1e-6, `...which reads alone just past it (${above.t})`);
    assert.ok(twin(SHADOW_CASCADES[c] * 0.69).t === 0, 'short of the band: the cascade alone');
    assert.ok(SHADOW_CASCADES[c] * 0.9 < SHADOW_CASCADES[c], 'the band ends inside the cascade\'s own box');
  }
  const r2 = SHADOW_CASCADES[2];
  assert.equal(twin(r2 * 0.9).t, 1, 'the far cascade lit by 0.9 of its reach');
  assert.ok(r2 * 0.9 < r2, '...inside its box, whose square edge no longer shows');
  // no step anywhere: the lit share of a surface in full shadow in every cascade moves by a sliver per centimetre
  let prev = null, worst = 0;
  for (let d = 0.5; d < r2; d += 0.01) {
    const { c, t } = twin(d);
    const lit = c === 2 ? t : 0;   // shadowed in both of any band's cascades; only the far fade lifts it
    if (prev !== null) worst = Math.max(worst, Math.abs(lit - prev));
    prev = lit;
  }
  assert.ok(worst < 0.01, `the far fade's steepest centimetre: ${worst}`);
});

// ── LA-SHADOW4: the held far ──────────────────────────────────────────────────────────────────────────────────────

test('LA-SHADOW4: heldShadowFar keeps the far a map was drawn to while the range stays within it and less than SHADOW_FAR_HOLD short of it, and is never inside the range', () => {
  assert.equal(SHADOW_FAR_HOLD, 2 * SHADOW_FAR_QUANTUM);
  assert.equal(heldShadowFar(NaN, 12.3), 16, 'no map yet: the quantised far');
  assert.equal(heldShadowFar(16, 11.5), 16, 'a flicker down: held');
  assert.equal(heldShadowFar(16, 16), 16);
  assert.equal(heldShadowFar(16, 16.1), 20, 'past it: a fresh one');
  assert.equal(heldShadowFar(16, 8.1), 16, 'held down to the hold');
  assert.equal(heldShadowFar(16, 8), 8, 'a range shrunk well inside: a fresh, tighter one');
  for (let held = 4; held <= 60; held += 4) for (let r = 0.25; r < 70; r += 0.25) assert.ok(heldShadowFar(held, r) >= r, `never inside the reach (${held}, ${r})`);
});

test('LA-SHADOW4: A DUNGEON TORCH\'S FLICKER - the base\'s far flipped between two planes as AnimateLight crossed a quantum; held, it changes at most once', () => {
  const anim = new CityLightAnimator(1, [12.3]);
  const base = new Set(); const held = new Set();
  let far = NaN, flips = 0, changes = 0, prevBase = NaN;
  for (let f = 0; f < 1200; f++) {
    anim.tick(1 / 60);
    const r = anim.ranges[0];
    const b = shadowFarFor(r);
    if (!Number.isNaN(prevBase) && b !== prevBase) flips++;
    prevBase = b; base.add(b);
    const h = heldShadowFar(far, r);
    if (!Number.isNaN(far) && h !== far) changes++;
    far = h; held.add(h);
  }
  assert.ok(base.size === 2 && flips > 20, `the base: ${flips} flips between ${[...base]} in twenty seconds`);
  assert.ok(changes <= 1, `held: ${changes} change (${[...held]})`);
});

test('LA-SHADOW4: THE PASS - lamps whose flicker crosses 12 redraw nothing after the first crossing, the eight\'s static faces and every lo map alike; the base redrew at each', () => {
  const s = stage();
  const lamps = (range) => { const L = new Float32Array(12 * 4); for (let i = 0; i < 12; i++) L.set([i * 1.5, 2, 3, range], i * 4); return L; };
  s.frame({ lights: lamps(11.9), every: true });   // the door: the room recorded
  const first = s.frame({ lights: lamps(11.9), every: true });
  assert.ok(first.staticFaces > 0 && first.loFaces > 0, 'the maps drawn once');
  const grow = s.frame({ lights: lamps(12.3), every: true });
  assert.ok(grow.staticFaces > 0 && grow.loFaces > 0, 'a range past the far: drawn again, once');
  for (const r of [11.5, 12.6, 11.2, 12.2, 11.4, 12.7]) {
    const st = s.frame({ lights: lamps(r), every: true });
    assert.equal(st.staticFaces, 0, `range ${r}: no static face redrawn`);
    assert.equal(st.loFaces, 0, `range ${r}: no lo map redrawn`);
  }
});

test('LA-SHADOW4: THE CASTER TABLE CARRIES A LO MAP\'S FAR - the word is the slot in its low byte and the far in quanta above it, as the shader decodes it', () => {
  assert.equal(SHADOW_CASTER_FAR_SHIFT, 8);
  for (const [slot, far] of [[8, 4], [8 + 47, 120], [9, 16], [20, 20]]) {
    const w = casterWord(slot, far);
    assert.equal(w & 255, slot); assert.equal((w >> SHADOW_CASTER_FAR_SHIFT) * SHADOW_FAR_QUANTUM, far);
  }
  const s = stage();
  const L = new Float32Array(12 * 4); for (let i = 0; i < 12; i++) L.set([i * 1.5, 2, 3, 13.1], i * 4);
  s.frame({ lights: L, every: true });
  s.frame({ lights: L, every: true });
  const L2 = L.slice(); for (let i = 0; i < 12; i++) L2[i * 4 + 3] = 11.2;   // flickered down: the maps keep 16
  const st = s.frame({ lights: L2, every: true });
  const lo = st.casterOf.slice(0, 12).filter((w) => (w & 255) >= SHADOW_POINT_CASTERS);
  assert.equal(lo.length, 12 - SHADOW_POINT_CASTERS);
  for (const w of lo) assert.equal((w >> SHADOW_CASTER_FAR_SHIFT) * SHADOW_FAR_QUANTUM, 16, 'the far the map was drawn to, not the live range\'s 12');
  assert.match(SHADOW_GLSL, /float casterShadowAt\(int k, vec4 L, vec3 wp, vec3 n\) \{\n\s+int s = k & 255;\n\s+return s < 8 \? pointShadowAt\(s, wp, n\) : pointShadowLoAt\(s - 8, float\(k >> 8\) \* 4\.0, L, wp, n\);/);
  assert.match(SHADOW_GLSL, /float casterShadowOne\(int k, vec4 L, vec3 wp\) \{\n\s+int s = k & 255;\n\s+return s < 8 \? pointShadowOne\(s, wp\) : pointShadowLoOne\(s - 8, float\(k >> 8\) \* 4\.0, L, wp\);/);
  assert.match(SHADOW_GLSL, /float pointShadowLoAt\(int j, float far, vec4 L, vec3 wp, vec3 n\) \{/);
  assert.match(SHADOW_GLSL, /float pointShadowLoOne\(int j, float far, vec4 L, vec3 wp\) \{/);
});

// ── LA-LIGHTS1: a lantern's own flicker ───────────────────────────────────────────────────────────────────────────

test('LA-LIGHTS1: EACH LANTERN FLICKERS ON ITS PIXEL\'S SLOTS - a pixel streamed out moves no other lantern\'s range (the base took the pool\'s index, and every lantern after it jumped)', () => {
  const anim = new CityLightAnimator(4096, 18);
  for (let f = 0; f < 120; f++) anim.tick(1 / 60);
  const pixels = [{ px: 110, py: 220, n: 5 }, { px: 111, py: 220, n: 3 }, { px: 110, py: 221, n: 4 }];
  // LA-AUDIT F2: the pool the street fills, by its own fill (cityLights.js fillLanternPool - world.js calls it)
  const byPixel = (list) => {   // each lantern placed at x = px * 100 + j, z = py: its name read back off the pool
    const built = list.map((p) => ({ px: p.px, py: p.py, lights: Array.from({ length: p.n }, (_, j) => [p.px * 100 + j, 0, p.py]) }));
    const pool = [], { n, ranges } = fillLanternPool(built, () => [0, 0, 0], pool, new Float32Array(4), anim.ranges);
    return Array.from({ length: n }, (_, i) => `${Math.floor(pool[i].x / 100)},${pool[i].z},${pool[i].x % 100}:${ranges[i]}`);
  };
  const byIndex = (list) => { const out = []; let n = 0; for (const p of list) for (let j = 0; j < p.n; j++) out.push(`${p.px},${p.py},${j}:${anim.ranges[n++]}`); return out; };
  const kept = (a, b) => b.filter((x) => a.includes(x)).length;
  const after = pixels.slice(1);   // the first pixel streamed out
  assert.equal(kept(byPixel(pixels), byPixel(after)), 7, 'every remaining lantern keeps its own range');
  assert.ok(kept(byIndex(pixels), byIndex(after)) < 7, 'the base: the remaining lanterns took other lanterns\' ranges');
  assert.notEqual(lanternSlot(110, 220), lanternSlot(111, 220)); assert.notEqual(lanternSlot(110, 220), lanternSlot(110, 221));
  assert.equal(lanternSlot(110, 220), lanternSlot(110, 220), 'named by the pixel alone');
  // the host: the street fills its pool by fillLanternPool from the animator's ranges, and the selection reads the pool's own ranges
  const w = rd('src/scenes/world.js');
  assert.match(w, /const _pool = fillLanternPool\(built\.values\(\), \(p\) => state\.pixelTranslation\(p\.px, p\.py, _lightT\), _sceneLights, _litRanges, worldLightAnimator\.ranges\);/);
  assert.match(w, /_litRanges = _pool\.ranges;/);
  assert.match(w, /nearestLights\(_sceneLights, cam\.pos, renderer\.maxPointLights \+ \(renderer\.lightingLane \? 1 : 0\), _litRanges, null, 0, n\)/);
  assert.doesNotMatch(w, /nearestLights\([^)]*worldLightAnimator\.ranges/, 'no selection reads the animator by pool index');
  assert.doesNotMatch(w, /worldLightAnimator\.ranges\.subarray/, 'nor copies it by pool index');
});

// ── LA-LIGHTS2: the cap fades ─────────────────────────────────────────────────────────────────────────────────────

test('LA-LIGHTS2: capFadeColors - the hand\'s lights whole, each kept lantern its share (1 short of the fade, 0 at the first lantern the cap leaves out), and nothing when the cap cuts nothing', () => {
  assert.equal(LIGHT_CAP_FADE, 16);
  const cap = 4, c = [0.5, 0.4, 0.3];
  // two hand lights - the torch at the eye, a peer's 45 off (inside the fade's reach) - then lanterns at 5, 30, 40, 50
  // along x (the renderer keeps 4: the hand's two and two)
  const lit = new Float32Array([0, 0, 0, 5, 0, 0, 45, 5, 5, 0, 0, 18, 30, 0, 0, 18, 40, 0, 0, 18, 50, 0, 0, 18]);
  const col = capFadeColors(lit, 2, [0, 0, 0], cap, c);
  assert.equal(col.length, cap * 3);
  assert.deepEqual([...col.slice(0, 6)], [0.5, 0.4, 0.3, 0.5, 0.4, 0.3].map(Math.fround), 'the hand\'s lights: never faded, the peer\'s 45 off included');
  const share = (i) => col[i * 3] / 0.5;
  assert.ok(Math.abs(share(2) - 1) < 1e-6, 'a lantern 30 short of the cut: whole');
  assert.ok(Math.abs(share(3) - 10 / 16) < 1e-6, `a lantern 10 short of the cut (at 40): 10/16 (${share(3)})`);
  assert.equal(capFadeColors(lit.subarray(0, 16), 2, [0, 0, 0], cap, c), null, 'four lights under a cap of four: nothing cut, nothing faded');
  assert.equal(capFadeColors(lit, 4, [0, 0, 0], cap, c), null, 'the hand\'s lights fill the cap: no lantern to fade');
});

/** A night town: `n` lanterns strewn over a square, the renderer's cap, and the host's composition - the hand's
 *  `lead` lights at the eye first, then the lanterns nearest first - lit as the renderer lights it (the first `cap`
 *  kept, each at its colour's share). Answers each lantern's brightness (0 for one not lit) from `pos`. */
function nightTown(n, seed) {
  let s = seed;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const lights = Array.from({ length: n }, () => ({ x: (rnd() - 0.5) * 600, y: 2 + rnd() * 3, z: (rnd() - 0.5) * 600 }));
  const cap = 48, lead = 2;
  const lit = (pos, faded) => {
    const sel = nearestLights(lights, pos, cap + (faded ? 1 : 0), 18);
    const all = new Float32Array((lead + sel.length / 4) * 4);
    for (let i = 0; i < lead; i++) all.set([pos[0], pos[1], pos[2], 5], i * 4);
    all.set(sel, lead * 4);
    const col = faded ? capFadeColors(all, lead, pos, cap, [1, 1, 1]) : null;
    const out = new Map();
    for (let i = lead; i < Math.min(cap, all.length / 4); i++) out.set(`${all[i * 4]},${all[i * 4 + 2]}`, col ? col[i * 3] : 1);
    return out;
  };
  return { lights, lit };
}

test('LA-LIGHTS2: A WALK THROUGH A NIGHT TOWN - with the cap cutting every frame, no lantern\'s light jumps by more than a step can move it; the base switched lanterns fully on and off', () => {
  const town = nightTown(400, 7);
  const worst = { base: 0, faded: 0 };
  let swaps = 0, step = 0;
  const at = (k) => [-150 + k * 0.2, 1.7, 40 + Math.sin(k / 90) * 30];   // a winding walk, under 0.4 of a unit a frame
  for (const faded of [false, true]) {
    let prev = null;
    for (let k = 0; k <= 1500; k++) {
      const pos = at(k);
      if (k) step = Math.max(step, Math.hypot(...pos.map((v, i) => v - at(k - 1)[i])));
      const now = town.lit(pos, faded);
      if (prev) {
        for (const [key, b] of now) worst[faded ? 'faded' : 'base'] = Math.max(worst[faded ? 'faded' : 'base'], Math.abs(b - (prev.get(key) ?? 0)));
        for (const [key, b] of prev) if (!now.has(key)) { worst[faded ? 'faded' : 'base'] = Math.max(worst[faded ? 'faded' : 'base'], b); if (!faded) swaps++; }
      }
      prev = now;
    }
  }
  assert.ok(swaps > 20, `the cap cut the set ${swaps} times over the walk - without this the pin proves nothing`);
  assert.equal(worst.base, 1, 'the base: a lantern switched fully on or off in one frame');
  // a share is (cut - d) / fade, and a step of length l moves the eye's distance to the lantern and to the cut by l each
  assert.ok(worst.faded <= 2 * step / LIGHT_CAP_FADE + 1e-4, `faded: the largest change in one frame is ${worst.faded.toFixed(4)} (a step of ${step.toFixed(3)} moves a share by at most ${(2 * step / LIGHT_CAP_FADE).toFixed(4)})`);
  assert.ok(worst.faded < 0.05, 'a twentieth of a lantern at most');
});

test('LA-LIGHTS2: the host - on the lane the street picks one lantern past the cap and hands the renderer the faded colours; classic picks the cap and fades nothing; the hand lights ride the call they always did', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const _lanterns = wodSel \? null : nearestLights\(_sceneLights, cam\.pos, renderer\.maxPointLights \+ \(renderer\.lightingLane \? 1 : 0\), _litRanges, null, 0, n\);/);
  assert.match(w, /const lit = withPlayerLights\(wodSel \? wodSel\.data : _lanterns,/);
  assert.match(w, /else renderer\.setPointLights\(lit, CITY_LIGHT_COLOR_F32, renderer\.lightingLane \? capFadeColors\(lit, lit\.length \/ 4 - _lanterns\.length \/ 4, cam\.pos, renderer\.maxPointLights, CITY_LIGHT_COLOR_F32\) : null\);/);
});

test('LA-SHADOW1: the pass and the grid by source - the anchor held and passed, carried by the recentre, the Z up', () => {
  const sp = rd('src/render/shadowPass.js');
  assert.match(sp, /sunAnchorFor\(f\.eye, this\._sunAnchor\);[^\n]*\n\s+sunCascadeMatrices\(f\.eye, f\.lightDir, this\._sunVPNew, this\._sunAnchor\);/);
  assert.match(sp, /this\._sunAnchor\[0\] \+= offset\[0\]; this\._sunAnchor\[1\] \+= offset\[1\]; this\._sunAnchor\[2\] \+= offset\[2\];/);
  assert.match(sp, /const up = Math\.abs\(lightDir\[2\]\) < 0\.9 \? Z_UP : Y_UP;/);
  assert.ok(sunTexelWorld(0) < 0.02);
});
