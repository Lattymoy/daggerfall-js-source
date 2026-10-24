// PERF-VOL (2026-10-11, Mac: "Lets do the biggest remaining lever"): THE PLACED BATCHES' VOLUME ANSWERS, KEPT. The
// shadow pass asks every swaying placed batch of a lantern's reach whether any of its quads stands in each face
// (bounds.js placementsInVolume) - and under Steady shadows every face is redrawn every frame. Captured in the real game
// (Knightstale by night, the freeware ARENA2): 542 asks a frame, every one the frame before's to the bit. The planes are
// named by their bits (volumeName) and the answer kept on the batch's grid against every number the test reads
// (placementsInVolumeOf). These pins hold the kept answer to the asked one and to a walk of every placement - over
// random woods, lantern faces and cascades, frame after frame, each number moved alone - and the replay's draws to the
// replay's with nothing kept (SHADOW_TUNING.volumeMemo), and hold the saving by count. Never on a clock.
// PERF-ORDER, the same day and the same capture: two loops asked their dearest skip of every flat before their cheapest -
// the pixel walk the box and the shadow's reach before the far-flat rule (655 of 1,361 batches a frame then dropped), the
// air pass the sphere before the emission map (3 of 636 have one). Each test only skips, so the order is free; the last
// pin holds the air pass's emitters to the oracle and its sphere to the lit flats. The record is
// `bible/07-Rendering/Performance-Arena.md` (PERF-VOL, PERF-ORDER).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { SHADOW_TUNING, pointFaceMatrices } from '../../src/render/shadowPass.js';
import * as bounds from '../../src/render/bounds.js';
import { ortho, lookAt, multiply } from '../../src/world/mat4.js';

const { placementGrid, placementsInVolume, placementsInVolumeOf, volumeName, spherePlanes, sphereInPlanes, batchLift, VOLUME_MEMO_MAX, VOLUME_TABLE_MAX } = bounds;
const SHIPPED = { ...SHADOW_TUNING };   // AUDIT PERF-ARENA O1: the switch as the module ships it, before any pin sets it

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The oracle: every placement of the batch, in its frame, the lift folded in, against the planes - no grid, no cell. */
function anyQuad(b, rad, planes) {
  const p = b._place.pts, o = b.origin || bounds.ZERO_ORIGIN, ox = o[0], oy = o[1] + batchLift(b), oz = o[2];
  for (let i = 0; i < p.length; i += 3) if (sphereInPlanes(planes, p[i] + ox, p[i + 1] + oy, p[i + 2] + oz, rad)) return true;
  return false;
}
/** A lantern's six faces and a sun's cascade, as the pass makes them (pointFaceMatrices; an ortho box down a sun). */
function volumes(rand, n) {
  const out = [];
  while (out.length < n) {
    if (rand() < 0.75) {
      const faces = Array.from({ length: 6 }, () => new Float32Array(16));
      pointFaceMatrices([(rand() * 2 - 1) * 60, rand() * 6, (rand() * 2 - 1) * 60], 6 + rand() * 22, faces);
      for (const f of faces) out.push(spherePlanes(f, new Float32Array(24)));
    } else {
      const c = [(rand() * 2 - 1) * 40, 0, (rand() * 2 - 1) * 40], d = [0.4 + rand(), 0.6 + rand(), 0.3 + rand()];
      const half = 10 + rand() * 60;
      const vp = multiply(ortho(half, half, 0.1, 400), lookAt([c[0] + d[0] * 200, c[1] + d[1] * 200, c[2] + d[2] * 200], c, [0, 1, 0]), new Float32Array(16));
      out.push(spherePlanes(vp, new Float32Array(24)));
    }
  }
  return out.slice(0, n);
}
function wood(rand) {
  const n = 2 + Math.floor(rand() * 120), half = 10 + rand() * 90;
  const centers = Array.from({ length: n }, () => [(rand() * 2 - 1) * half, rand() * 3 - 1.5, (rand() * 2 - 1) * half]);
  return { _place: placementGrid(centers), centers, origin: [(rand() * 2 - 1) * 40, rand() * 2 - 1, (rand() * 2 - 1) * 40], size: { w: 1 + rand() * 3, h: (rand() < 0.1 ? -1 : 1) * (0.5 + rand() * 8) } };
}
/** A walk counter on a grid: a kept answer reads no placement. */
function counted(b) {
  const q = b._place, n = { walks: 0 };
  b._place = new Proxy(q, { get(t, k) { if (k === 'pts') n.walks++; return t[k]; }, set(t, k, v) { t[k] = v; return true; } });
  return n;
}

test('PERF-VOL: the kept answer is the asked answer - over random woods (one cell and sixteen, an upside-down flame\'s negative height), lantern faces and cascades, frame after frame through the replay\'s one reused Float32Array, with the radius, each origin axis (the array written in place, as a pixel\'s is), the height and a lantern\'s place each moved alone, a grid re-minted by a move, a NaN and a signed zero: every answer equals placementsInVolume\'s and a walk of every placement, each moved number flipped answers, and a still frame reads no placement (mutants: PERFVOL-no-rad, PERFVOL-no-ox, PERFVOL-no-oy, PERFVOL-no-oz, PERFVOL-no-h, PERFVOL-stale-answer, PERFVOL-one-memo, PERFVOL-rad-tolerant, PERFVOL-origin-tolerant, PERFVOL-h-abs)', () => {
  const rand = rng(7);
  const woods = Array.from({ length: 14 }, () => wood(rand));
  const vols = volumes(rand, 40);
  const rads = woods.map(() => 0.5 + rand() * 4);
  const live = new Float32Array(24);   // the replay's this._planes: one array, its content set per replay
  const flips = { rad: 0, ox: 0, oy: 0, oz: 0, h: 0, light: 0, move: 0 };
  let asks = 0, hits = 0, quietWalks = 0, quietAsks = 0;
  const kept = new Map();   // the answer each (wood, volume) gave the frame before
  const frame = (moved, quiet = false) => {
    const counts = woods.map((b) => (quiet ? counted(b) : null));
    for (let v = 0; v < vols.length; v++) {
      live.set(vols[v]);
      const name = volumeName(live);
      for (let w = 0; w < woods.length; w++) {
        const b = woods[w];
        const before = quiet ? counts[w].walks : 0;
        const got = placementsInVolumeOf(b, rads[w], live, name);
        if (quiet) quietWalks += counts[w].walks - before;
        const want = placementsInVolume(b, rads[w], live);
        assert.equal(got, want, `wood ${w}, volume ${v}: the kept answer is the asked one`);
        assert.equal(want, anyQuad(b, rads[w], live), `wood ${w}, volume ${v}: and the walk of every placement`);
        asks++; if (want) hits++;
        const k = `${w}|${v}`;
        if (moved && kept.has(k) && kept.get(k) !== want) flips[moved]++;
        kept.set(k, want);
        if (quiet) quietAsks++;
      }
    }
  };
  frame(null); frame(null);   // the first sight names nothing; the second names every volume and keeps its answers
  frame(null, true);          // a still frame: every answer kept
  for (let round = 0; round < 6; round++) {
    const w = Math.floor(rand() * woods.length), b = woods[w];
    // each number moved alone, then held for two frames (the frame after a move keeps the move's answer)
    rads[w] = rads[w] * (0.3 + rand() * 2.5); frame('rad'); frame(null);
    b.origin[0] += (rand() * 2 - 1) * 30; frame('ox'); frame(null);
    b.origin[1] += (rand() * 2 - 1) * 12; frame('oy'); frame(null);
    b.origin[2] += (rand() * 2 - 1) * 30; frame('oz'); frame(null);
    b.size.h = (rand() < 0.2 ? -1 : 1) * (0.5 + rand() * 14); frame('h'); frame(null);
    const v = Math.floor(rand() * vols.length);   // a lantern swung on its hook: its planes are new numbers
    const faces = Array.from({ length: 6 }, () => new Float32Array(16));
    pointFaceMatrices([(rand() * 2 - 1) * 60, rand() * 6, (rand() * 2 - 1) * 60], 6 + rand() * 22, faces);
    vols[v] = spherePlanes(faces[Math.floor(rand() * 6)], new Float32Array(24));
    frame('light'); frame(null); frame(null);
    // a move re-mints the grid (renderer.js moveBillboardBatch): the same centres shifted, a new object
    const dx = (rand() * 2 - 1) * 25;
    b.centers = b.centers.map((c) => [c[0] + dx, c[1], c[2]]); b._place = placementGrid(b.centers);
    frame('move'); frame(null);
  }
  for (const [k, n] of Object.entries(flips)) assert.ok(n > 0, `moving the ${k} alone flipped answers (${n})`);
  assert.ok(hits > asks / 10 && hits < asks * 0.9, `the asks fell both in and out (${hits} of ${asks})`);
  assert.equal(quietWalks, 0, `a still frame walked no placement (${quietWalks} walks over ${quietAsks} asks)`);
  // a NaN radius equals nothing kept: asked afresh, every time
  const b = woods[0], n = counted(b);
  live.set(vols[0]); const name = volumeName(live);
  for (let i = 0; i < 3; i++) assert.equal(placementsInVolumeOf(b, NaN, live, name), placementsInVolume(b, NaN, live), 'a NaN radius: the asked answer');
  assert.equal(n.walks, 6, `and asked afresh each time - its own walk and the check's (${n.walks})`);
  // AUDIT PERF-ARENA V1: THE KEY IS EXACT - the smallest move of the radius, of the origin, and the height's SIGN (the lift
  // is half of h, so an upside-down flame stands on the other side of its placement with the same radius), each flipping
  // the answer kept a moment before
  const flipAt = (lo, hi, ask) => {   // lo and hi answer differently; close them in to within 1e-7
    const at = ask(lo);
    for (let i = 0; i < 80 && hi - lo > 1e-7; i++) { const mid = (lo + hi) / 2; if (ask(mid) === at) lo = mid; else hi = mid; }
    return [lo, hi];
  };
  let boundaries = 0, radii = 0, origins = 0;
  for (let v = 0; v < vols.length && boundaries < 3; v++) {
    live.set(vols[v]); volumeName(live); live.set(vols[v]);
    const nm = volumeName(live);
    const z0 = { _place: placementGrid([[0, 0, 0], [3, 0.5, -2], [-4, 0.2, 5]]), origin: [0, 0, 0], size: { w: 1, h: 2 } };
    // a place for the wood where the radius decides: walk the origin until a small radius misses and a large one hits
    let placed = false;
    for (let t = 0; t < 400 && !placed; t++) {
      z0.origin = [(rand() * 2 - 1) * 70, rand() * 8 - 4, (rand() * 2 - 1) * 70];
      placed = !placementsInVolume(z0, 0.01, live) && placementsInVolume(z0, 30, live);
    }
    if (!placed) continue;
    // the radius
    const [r0, r1] = flipAt(0.01, 30, (rr) => placementsInVolume(z0, rr, live));
    assert.equal(placementsInVolumeOf(z0, r0, live, nm), placementsInVolume(z0, r0, live)); assert.equal(placementsInVolumeOf(z0, r0, live, nm), placementsInVolume(z0, r0, live), 'kept');
    assert.equal(placementsInVolumeOf(z0, r1, live, nm), placementsInVolume(z0, r1, live), `a radius ${r1 - r0} larger: asked afresh, and flipped`);
    assert.notEqual(placementsInVolume(z0, r1, live), placementsInVolume(z0, r0, live)); radii++;
    // the origin, on x
    const rr = r0, x0 = z0.origin[0];
    const pass = (x) => { z0.origin[0] = x; return placementsInVolume(z0, rr, live); };
    let far = null;
    for (const dx of [40, -40, 80, -80]) if (pass(x0 + dx) !== pass(x0)) { far = x0 + dx; break; }
    if (far !== null) {
      const [xa, xb] = far > x0 ? flipAt(x0, far, pass) : flipAt(far, x0, pass).reverse();
      z0.origin[0] = xa; assert.equal(placementsInVolumeOf(z0, rr, live, nm), placementsInVolume(z0, rr, live)); assert.equal(placementsInVolumeOf(z0, rr, live, nm), placementsInVolume(z0, rr, live), 'kept');
      z0.origin[0] = xb; assert.equal(placementsInVolumeOf(z0, rr, live, nm), placementsInVolume(z0, rr, live), `an origin ${Math.abs(xb - xa)} along: asked afresh, and flipped`);
      z0.origin[0] = xa; const ya = placementsInVolume(z0, rr, live); z0.origin[0] = xb; assert.notEqual(placementsInVolume(z0, rr, live), ya); origins++;
      z0.origin[0] = x0;
    }
    // the height's sign: the same radius, the lift on the other side
    z0.size.h = 2; const up = placementsInVolume(z0, rr, live); z0.size.h = -2; const down = placementsInVolume(z0, rr, live);
    if (up !== down) {
      z0.size.h = 2; assert.equal(placementsInVolumeOf(z0, rr, live, nm), up); assert.equal(placementsInVolumeOf(z0, rr, live, nm), up, 'kept');
      z0.size.h = -2; assert.equal(placementsInVolumeOf(z0, rr, live, nm), down, 'upside down, the same |h|: asked afresh, and flipped');
      boundaries++;
    }
  }
  assert.ok(boundaries > 0 && radii > 0 && origins > 0, `each boundary was met (the height's sign ${boundaries}, the radius ${radii}, the origin ${origins})`);
  // a signed zero is the same number to the test: +0 kept, -0 asked, the answer one
  const z = { _place: placementGrid([[0, 0, 0], [0.5, 0, 0]]), origin: [0, 0, 0], size: { w: 1, h: 1 } };
  assert.equal(placementsInVolumeOf(z, 0, live, name), placementsInVolume(z, 0, live));
  z.origin[0] = -0;
  assert.equal(placementsInVolumeOf(z, -0, live, name), placementsInVolume(z, -0, live), 'a signed zero: the same answer');
});

test('PERF-VOL: volumeName - 0 at a set\'s first sight and for anything but a Float32Array(24); a name from the second sight, the same name for the same bits in another view (a subarray of a larger buffer too) and another for another set in the same buffer, another for one word changed, two names for two sets of ONE hash - at the first words and at the last, through one reused array, their answers kept apart; the first sights start over past VOLUME_TABLE_MAX hashes and forget no name; the named table starts over past VOLUME_TABLE_MAX names and its names go on counting; the two bounds are what the record says (mutants: PERFVOL-named-at-first-sight, PERFVOL-hash-alone, PERFVOL-compare-short, PERFVOL-names-reused, PERFVOL-named-never-forget, PERFVOL-sights-forget-names, PERFVOL-renamed-every-sight, PERFVOL-view-by-buffer, PERFVOL-table-max-raised, PERFVOL-memo-max-raised)', () => {
  assert.equal(VOLUME_TABLE_MAX, 512, 'the table\'s bound'); assert.equal(VOLUME_MEMO_MAX, 128, 'a grid\'s bound');   // AUDIT PERF-ARENA V5
  const rand = rng(21);
  const set = () => { const p = new Float32Array(24); for (let i = 0; i < 24; i++) p[i] = rand() * 2 - 1; return p; };
  const named = (p) => { assert.equal(volumeName(p), 0, 'first sight: no name'); const n = volumeName(p); assert.ok(n > 0, 'second sight: a name'); return n; };
  const a = set();
  const na = named(a);
  assert.equal(volumeName(a), na, 'and the same name after');
  const buf = new Float32Array(56); buf.set(a, 7);
  assert.equal(volumeName(buf.subarray(7, 31)), na, 'the same bits in a view of another buffer: the same name');
  const other = set(); buf.set(other, 31);
  const nOther = named(buf.subarray(31, 55));
  assert.ok(nOther !== na, 'another set in the same buffer, at another offset: another name (AUDIT PERF-ARENA V4: a view is the ARRAY\'s, not its buffer\'s)');
  assert.equal(volumeName(buf.subarray(7, 31)), na, 'and the first view still names its own');
  const b = Float32Array.from(a); b[23] = Math.fround(b[23] + 0.001);
  const nb = named(b);
  assert.ok(nb !== na, 'one word changed: another name');
  for (const bad of [Array.from(a), Float64Array.from(a), new Float32Array(23)]) { assert.equal(volumeName(bad), 0); assert.equal(volumeName(bad), 0, `${bad.constructor.name}(${bad.length}): never a name`); }
  // two sets of one hash: the hash's steps are undone at word k+1 - w' = w ^ s_k ^ s'_k, s_k the state after word k
  const step = (h, w) => { h = Math.imul(h ^ w, 16777619); return h ^ (h >>> 15); };
  const twin = (src, k) => {
    const cu = new Uint32Array(src.buffer, src.byteOffset, 24), d = Float32Array.from(src), du = new Uint32Array(d.buffer);
    let pre = 2166136261;
    for (let i = 0; i < k; i++) pre = step(pre, cu[i]);
    for (let t = 1; ; t++) {
      du[k] = (cu[k] & 0xff800000) | ((cu[k] + t) & 0x7fffff);
      du[k + 1] = (cu[k + 1] ^ step(pre, cu[k]) ^ step(pre, du[k])) >>> 0;
      if (((du[k + 1] >>> 23) & 0xff) !== 0xff) return d;   // a finite float, as a plane's is
    }
  };
  const w = { _place: placementGrid(Array.from({ length: 30 }, () => [(rand() * 2 - 1) * 5, 0, (rand() * 2 - 1) * 5])), origin: [0, 0, 0], size: { w: 1, h: 1 } };
  const live = new Float32Array(24);
  for (const k of [0, 22]) {
    const c = set(), d = twin(c, k);
    assert.equal(bounds.volumeHash(new Uint32Array(c.buffer)), bounds.volumeHash(new Uint32Array(d.buffer)), `words ${k}-${k + 1}: the two sets hash alike`);
    assert.notDeepEqual([...c], [...d], 'and are not the same numbers');
    live.set(c); volumeName(live); live.set(c); const nc = volumeName(live);
    live.set(d); assert.equal(volumeName(live), 0, `words ${k}-${k + 1}: the second of one hash, first seen`);
    live.set(d); const nd = volumeName(live);
    assert.ok(nc > 0 && nd > 0 && nc !== nd, `words ${k}-${k + 1}: one hash, two sets, two names (${nc}, ${nd})`);
    live.set(c); assert.equal(volumeName(live), nc, 'and each keeps its own');
    for (const [p, n] of [[c, nc], [d, nd], [c, nc], [d, nd]]) { live.set(p); assert.equal(placementsInVolumeOf(w, 1, live, n), placementsInVolume(w, 1, live), 'their answers apart'); }
  }
  // the first sights start over alone: a set seen once is forgotten past the bound, a named set is not
  const names = new Set([na, nOther, nb]);
  const kept = set(); const nKept = named(kept); names.add(nKept);
  const once = set(); assert.equal(volumeName(once), 0);
  for (let i = 0; i < VOLUME_TABLE_MAX + 1; i++) volumeName(set());
  assert.equal(volumeName(once), 0, 'past the bound the first sights started over: the set seen once is first seen again');
  assert.equal(volumeName(kept), nKept, 'and a named set kept its name through it');
  // the named table starts over past its bound, and the names go on counting
  for (let i = 0; i < VOLUME_TABLE_MAX + 1; i++) { const s = set(); volumeName(s); names.add(volumeName(s)); }
  assert.equal(volumeName(kept), 0, 'past the bound the named table started over: the old set is first seen again');
  const nNew = volumeName(kept);
  assert.ok(nNew > 0 && !names.has(nNew), `and named anew - no name given twice (${nNew})`);
  assert.ok(nNew > Math.max(...names), `the names go on counting past the start-over (${nNew} after ${Math.max(...names)}): a grid's answer under an old name can never be read for a new set`);
});

test('PERF-VOL: a grid keeps VOLUME_MEMO_MAX answers at most - asked by more names than that it starts over, and every answer is still the asked one (mutant: PERFVOL-memo-unbounded)', () => {
  const rand = rng(33);
  const b = wood(rand);
  const live = new Float32Array(24);
  const vols = volumes(rand, VOLUME_MEMO_MAX + 30);
  for (let pass = 0; pass < 3; pass++) {
    for (const v of vols) {
      live.set(v);
      const name = volumeName(live);
      assert.equal(placementsInVolumeOf(b, 2, live, name), placementsInVolume(b, 2, live));
      assert.ok((b._place.vol?.size ?? 0) <= VOLUME_MEMO_MAX, `the grid keeps at most ${VOLUME_MEMO_MAX} (${b._place.vol?.size})`);
    }
  }
  assert.ok(b._place.vol.size > 0, 'and it kept some');
});

// ─── the replay ───────────────────────────────────────────────────────────────────────────────────────────────────

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const RIGHT = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
const LIGHT_DIR = new Float32Array([0.45, 0.8, 0.35]);
/** perfshadow1.test.js's recording GL: every draw with the program, VAO and framebuffer it was made in. */
function recordingGl() {
  const draws = [];
  let ids = 0, prog = null, vao = null, fb = null;
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
      return (...args) => {
        if (k === 'useProgram') prog = args[0];
        else if (k === 'bindVertexArray') vao = args[0];
        else if (k === 'bindFramebuffer' && (args[0] === 36160 || args[0] === 36009)) fb = args[1];
        else if (k === 'drawElements' || k === 'drawArrays') draws.push([k, prog?.id, vao?.id, fb?.id, args[1], args[2], args[3]]);
      };
    },
  });
  return { draws, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}
/** A night town under Steady shadows: swaying woods and a still one, a walker by each lantern, lanterns that hold
 *  still - and a script of frames that each move one thing. `memo` is SHADOW_TUNING.volumeMemo. */
function town(seed, memo, { sun = false, steady = true, cache = true } = {}) {
  const rand = rng(seed);
  const g = recordingGl();
  const r = new Renderer(g.canvas);
  r.setLightingLane(EL_LANE);
  for (const k of ['504_1', '504_2', '504_3']) r.textures.set(k, { id: `tex-${k}` });
  if (sun) r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  else r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0);
  if (!cache) r.setShadowCache(false);
  const woods = [];
  for (let k = 0; k < 10; k++) {
    const b = r.createBillboardBatch(504, 1 + (k % 2), { w: 1 + rand() * 3, h: 2 + rand() * 7 }, Array.from({ length: 20 + Math.floor(rand() * 80) }, () => [(rand() * 2 - 1) * 40, rand() - 0.5, (rand() * 2 - 1) * 40]));
    b.sway = k < 8 ? 0.4 + rand() : 0;
    b.origin = [(rand() * 2 - 1) * 30, 0, (rand() * 2 - 1) * 30];
    woods.push(b);
  }
  const nL = 6, lights = new Float32Array(nL * 4);
  for (let i = 0; i < nL; i++) lights.set([(rand() * 2 - 1) * 40, 2 + rand() * 3, (rand() * 2 - 1) * 40, 8 + rand() * 14], i * 4);
  const walkers = Array.from({ length: nL }, (_, i) => { const b = r.createBillboardBatch(504, 3, { w: 1, h: 1.8 }, [[0, 0, 0]]); b.origin = [lights[i * 4] + 1, 0, lights[i * 4 + 2] + 1]; return b; });
  // the walks of the REPLAYS alone - a lantern's cube query (_candidateQuads, _dynamicNear) walks placements too, outside them
  let inReplay = false;
  const n = woods.map((b) => { const q = b._place, c = { walks: 0 }; b._place = new Proxy(q, { get(t, k) { if (inReplay && k === 'pts') c.walks++; return t[k]; }, set(t, k, v) { t[k] = v; return true; } }); return c; });
  const sp = r.shadows, replay = sp.replay.bind(sp);
  sp.replay = (...a) => { inReplay = true; try { return replay(...a); } finally { inReplay = false; } };
  const wind = [6, 2, 3.7, 1];
  let t = 0;
  const frame = (move) => {
    const was = [SHADOW_TUNING.override, SHADOW_TUNING.volumeMemo];
    SHADOW_TUNING.override = steady; SHADOW_TUNING.volumeMemo = memo;
    try {
      t++;
      walkers.forEach((b, i) => { b.origin = [lights[i * 4] + Math.sin(t + i) * 2, 0, lights[i * 4 + 2] + Math.cos(t) * 2]; });   // a mover by each lantern: its dynamic faces redraw
      if (move === 'light') lights[0] += 0.75;
      if (move === 'wind') wind[0] += 3;
      if (move === 'origin') woods[0].origin[0] += 4;   // in place, as a pixel's translation array is written
      if (move === 'height') woods[1].size.h += 3;
      r.setPointLights(lights, new Float32Array(nL * 3).fill(1));
      g.draws.length = 0;
      const w0 = n.reduce((s, c) => s + c.walks, 0);
      r.beginFrame(I, I, LIGHT_DIR, WORLD_FRAME);
      const shadow = g.draws.slice();
      const walks = n.reduce((s, c) => s + c.walks, 0) - w0;
      r.setFlatWind(wind);
      r.drawBillboards([...woods, ...walkers], RIGHT, UP);
      r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
      return { shadow, walks, faces: r.shadows.stats.dynFaces ?? 0 };
    } finally { [SHADOW_TUNING.override, SHADOW_TUNING.volumeMemo] = was; }
  };
  return { frame };
}

test('PERF-VOL: the replay draws exactly what it drew - every draw of every frame of a night town under Steady shadows, and by day, cadenced and with the static cache off (program, VAO, framebuffer, count, offset, in order), against the same pass keeping nothing (SHADOW_TUNING.volumeMemo false), through frames that each move one thing: a lantern swung, the wind risen (the quads\' lean, their radius), a wood\'s origin written in place, a wood\'s height; and the saving by count - the pass that keeps nothing walks the woods\' placements every frame, the one that keeps them walks none on a still frame and only again on a frame that moved something (mutants: PERFVOL-replay-unnamed, PERFVOL-off-arm-ignored, PERFVOL-renamed-every-sight, PERFVOL-key-not-refreshed)', () => {
  const script = [null, null, null, null, 'light', null, null, 'wind', null, null, 'origin', null, null, 'height', null, null];
  // a frame's pass replays the records the frame before drew (frame 0 has none): the first replay names nothing, the
  // second names and keeps; a move is replayed on its own frame or, a record's own number (the wind), on the next
  let compared = 0;
  // AUDIT PERF-ARENA V8: and the draws by day (the cascades, never named), cadenced (Steady off) and with the static cache off
  for (const opts of [{ sun: true }, { steady: false }, { cache: false }]) {
    for (const seed of [6, 7]) {
      const kept = town(seed, true, opts), asked = town(seed, false, opts);
      for (let f = 0; f < script.length; f++) {
        const x = kept.frame(script[f]), y = asked.frame(script[f]);
        assert.deepEqual(x.shadow, y.shadow, `${JSON.stringify(opts)} seed ${seed}, frame ${f}: the same draws in the same order`);
        compared += x.shadow.length;
      }
    }
  }
  for (const seed of [3, 4, 5]) {
    const kept = town(seed, true), asked = town(seed, false);
    const walks = [];
    for (let f = 0; f < script.length; f++) {
      const x = kept.frame(script[f]), y = asked.frame(script[f]);
      assert.deepEqual(x.shadow, y.shadow, `seed ${seed}, frame ${f} (${script[f] ?? 'still'}): the same draws in the same order`);
      if (f > 0) assert.ok(y.walks > 0, `seed ${seed}, frame ${f}: keeping nothing, the faces walk the woods (${y.walks})`);
      walks.push(x.walks);
      compared += x.shadow.length;
    }
    assert.ok(walks[1] > 0 && walks[2] > 0, `seed ${seed}: the first replay walks, and the second, which keeps (${walks})`);
    for (let f = 3; f < script.length; f++) {
      if (script[f] != null) assert.ok(walks[f] + walks[f + 1] > 0, `seed ${seed}, frame ${f}: the ${script[f]} moved, and its asks are asked again (${walks})`);
      else if (script[f - 1] == null) assert.equal(walks[f], 0, `seed ${seed}, frame ${f}: a still frame walks no placement (${walks})`);
    }
  }
  assert.ok(compared > 2000, `the comparison drew something (${compared})`);
});

test('PERF-VOL: the replay asks through the name, once a replay, a lantern\'s alone, and only with a placed batch to ask; and the memo SHIPS ON (AUDIT PERF-ARENA O1: every other pin sets the switch for each arm, so a shipped `volumeMemo: false` failed none) (mutant: PERFVOL-shipped-off)', async () => {
  assert.equal(SHIPPED.volumeMemo, true, 'SHADOW_TUNING.volumeMemo ships on');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../src/render/shadowPass.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('  replay(f, vp, lightPos,'), src.indexOf('\n  }\n', src.indexOf('  replay(f, vp, lightPos,')));
  assert.match(body, /let vname = -1;/, 'the name is asked lazily');
  assert.match(body, /if \(vname < 0\) vname = lightPos && SHADOW_TUNING\.volumeMemo !== false \? volumeName\(planes\) : 0;/, 'at the first placed batch, a lantern\'s alone, by the off arm (AUDIT PERF-ARENA V2: no cascade\'s planes come again)');
  assert.match(body, /if \(!\(vname === 0 \? placementsInVolume\(b, rad, planes\) : placementsInVolumeOf\(b, rad, planes, vname\)\)\) \{ this\.stats\.culled\+\+; continue; \}/, 'named: the kept answers; unnamed: the walk itself');
  assert.equal((body.match(/placementsInVolume(?:Of)?\(/g) ?? []).length, 2, 'and no other ask');
});

// ─── PERF-ORDER: the cheapest skip first ──────────────────────────────────────────────────────────────────────────

test('PERF-ORDER: the air pass\'s emitters are the flats with an emission map, in view, with a picture - over random flats in front of the eye and behind it, lit and plain, one lit with no picture: the draws counted are the oracle\'s, and the sphere is asked of the lit flats alone (Knightstale by night: 3 of the 636 a frame) (mutants: PERFORDER-blind-drawn, PERFORDER-unseen-drawn, PERFORDER-sphere-first, PERFORDER-picture-first; EL3\'s emit-flat-without-map, re-aimed)', async () => {
  const { perspective, mirrorProjectionX } = await import('../../src/world/mat4.js');
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE_CUBE_MAP_POSITIVE_X: 100, TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, FRAMEBUFFER: 7, TRIANGLE_STRIP: 5, drawingBufferWidth: 320, drawingBufferHeight: 200, ONE: 1, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771 };
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
      return (...args) => { calls.push(k); };
    },
  });
  const r = new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  r.setLightingLane(EL_LANE);
  r.setAir(true);
  r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0);
  const P = mirrorProjectionX(perspective(1, 1.6, 0.5, 6000));
  const sun = new Float32Array([0.3, 0.8, -0.2]);
  const rand = rng(41);
  const flats = [];
  for (let k = 0; k < 120; k++) {
    const lit = k % 4 === 0, blind = k === 8;   // a quarter lit; one of them with no picture
    const rec = lit ? (blind ? 9 : 1) : 2 + (k % 3);
    const b = r.createBillboardBatch(210, rec, { w: 0.5 + rand() * 2, h: 0.5 + rand() * 3 }, [[0, 0, 0]]);
    b.origin = blind ? [0, 1, -12] : [(rand() * 2 - 1) * 60, rand() * 4, (rand() * 2 - 1) * 60];   // z < 0 in front of the identity eye, z > 0 behind; the blind one in view
    flats.push({ b, lit, blind });
  }
  for (const k of ['210_1', '210_2', '210_3', '210_4']) r.textures.set(k, { id: `t${k}` });
  r.emissionTextures.set('210_1', { id: 'e1' }); r.emissionTextures.set('210_9', { id: 'e9' });
  const planes = spherePlanes(multiply(P, I, new Float32Array(16)), new Float32Array(24));
  const want = flats.filter((f) => f.lit && !f.blind && bounds.batchVisible(planes, f.b)).length;
  const offLit = flats.filter((f) => f.lit && !f.blind && !bounds.batchVisible(planes, f.b)).length;
  assert.ok(want > 3 && offLit > 3, `lit flats both in view (${want}) and out of it (${offLit})`);
  assert.ok(flats.some((f) => !f.lit && bounds.batchVisible(planes, f.b)), 'and plain ones in view');
  assert.ok(bounds.batchVisible(planes, flats[8].b), 'and the lit one with no picture');
  // the sphere's asks at the resolve, by flat
  let resolving = false;
  const asked = new Map();
  for (const f of flats) {
    let s = f.b.bounds;
    Object.defineProperty(f.b, 'bounds', { get() { if (resolving) asked.set(f, (asked.get(f) ?? 0) + 1); return s; }, set(v) { s = v; }, configurable: true });
  }
  // AUDIT PERF-ORDER O3: and the picture is asked after both skips - the plain flats' keys are never looked up at the resolve
  const pictures = [];
  const texGet = r.textures.get.bind(r.textures);
  r.textures.get = (k) => { if (resolving) pictures.push(k); return texGet(k); };
  const frame = () => {
    r.beginFrame(P, I, sun, WORLD_FRAME);
    r.drawBillboards(flats.map((f) => f.b), RIGHT, UP);
    pictures.length = 0;
    resolving = true;
    try { r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); } finally { resolving = false; }
  };
  frame(); asked.clear(); frame();
  assert.equal(r.air.stats.emitDraws, want, 'the emitters drawn are the lit flats in view with a picture');
  const plainAsked = flats.filter((f) => !f.lit && asked.get(f)).length;
  assert.equal(plainAsked, 0, `no plain flat's sphere asked at the resolve (${plainAsked} were)`);
  assert.ok(flats.filter((f) => f.lit && asked.get(f)).length >= want, 'the lit flats\' were');
  const plainPictures = pictures.filter((k) => k !== '210_1' && k !== '210_9');
  assert.equal(plainPictures.length, 0, `no plain flat's picture looked up at the resolve (${plainPictures.length}: ${[...new Set(plainPictures)]})`);
  assert.ok(pictures.includes('210_1'), 'the lit flats\' were');
});
