// AUDIT 637 (2026-10-06, Mac: "Audit this"), the shadow lens: PR #637's PERF-SHADOW1 (render/shadowPass.js - a
// lantern's six faces sharing one walk), audited. bible/01-Overview/Audit-637.md. The faces are held to the draws they
// made against the same pass with the pre-pass off (SHADOW_TUNING.facePrepass), and the savings by count. Never on a
// clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { SHADOW_TUNING, pointFaceMatrices, cubeKeeps, cubeSlack, cubeReach, CUBE_REACH, shadowFarFor, swayLean } from '../src/render/shadowPass.js';
import { spherePlanes, sphereInPlanes, placementRadius, quadHalfDiagonal } from '../src/render/bounds.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const RIGHT = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
const LIGHT_DIR = new Float32Array([0.45, 0.8, 0.35]);

/** perfshadow1.test.js's recording GL: every draw with the program, VAO and framebuffer it was made in. */
function recordingGl() {
  const draws = [], uses = { n: 0 };
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
        if (k === 'useProgram') { prog = args[0]; uses.n++; }
        else if (k === 'bindVertexArray') vao = args[0];
        else if (k === 'bindFramebuffer' && (args[0] === 36160 || args[0] === 36009)) fb = args[1];
        else if (k === 'drawElements' || k === 'drawArrays') draws.push([k, prog?.id, vao?.id, fb?.id, args[1], args[2], args[3]]);
      };
    },
  });
  return { draws, uses, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A night renderer on the lane, the textures the scenes use. */
function night() {
  const g = recordingGl();
  const r = new Renderer(g.canvas);
  r.setLightingLane(EL_LANE);
  for (const k of ['504_1', '504_2', '504_3', '182_1', '300_0']) r.textures.set(k, { id: `tex-${k}` });
  r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0);
  return { g, r };
}
/** One frame: the lights, the shadow pass (its draws answered), then the frame's own draws (`draw`) - recorded for the
 *  next frame's pass. */
function frameOf(g, r, lights, draw) {
  r.setPointLights(lights, new Float32Array((lights.length / 4) * 3).fill(1));
  g.draws.length = 0;
  r.beginFrame(I, I, LIGHT_DIR, WORLD_FRAME);
  const shadow = g.draws.slice();
  draw();
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  return shadow;
}
/** Steady shadows on and the pre-pass as asked, for `fn`; the console's switches handed back as they were. */
const withTuning = (prepass, fn) => {
  const was = [SHADOW_TUNING.override, SHADOW_TUNING.facePrepass];
  SHADOW_TUNING.override = true; SHADOW_TUNING.facePrepass = prepass;
  try { return fn(); } finally { [SHADOW_TUNING.override, SHADOW_TUNING.facePrepass] = was; }
};

// ─── B1: the far plane's float32 rounding ────────────────────────────────────────────────────────────────────────

/** The farthest (on any axis, from P) centre of a sphere of radius r that face planes `pl` take: the vertices of the
 *  six planes moved out by r, three at a time, that every plane takes. */
function farthestTaken(pl, P, r) {
  const det3 = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const rows = Array.from({ length: 6 }, (_, k) => [pl[k * 4], pl[k * 4 + 1], pl[k * 4 + 2], pl[k * 4 + 3]]);
  let best = -Infinity, at = null;
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++) {
    const A = [rows[i], rows[j], rows[k]], D = det3(A[0], A[1], A[2]);
    if (Math.abs(D) < 1e-12) continue;
    const b = [-r - rows[i][3], -r - rows[j][3], -r - rows[k][3]];
    const v = [0, 1, 2].map((c) => { const m = A.map((row, t) => [0, 1, 2].map((q) => (q === c ? b[t] : row[q]))); return det3(m[0], m[1], m[2]) / D; });
    if (rows.some((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2] + row[3] < -r - 1e-9 * (1 + Math.abs(row[3])))) continue;
    const m = Math.max(Math.abs(v[0] - P[0]), Math.abs(v[1] - P[1]), Math.abs(v[2] - P[2]));
    if (m > best) { best = m; at = v; }
  }
  return { best, at };
}

test('AUDIT 637 B1: THE CUBE IS NEVER THE NARROWER TEST AT ANY FAR A LIGHT HAS - the farthest sphere each of a lantern\'s six float32 faces takes, for fars 4 to 120 (SHADOW_CASTER_MAX_RANGE) beside the origin and out to 120 km, is one the pre-pass keeps: the far plane is row 3 less row 2 of the float32 matrix, so its rounding grows with far x (far + the place), and the slack that grew with far alone let a far-96 lantern\'s face draw what the cube had dropped (mutants: the far plane\'s term dropped; the class\'s own slack dropped)', () => {
  const vps = Array.from({ length: 6 }, () => new Float32Array(16));
  const planes = Array.from({ length: 6 }, () => new Float32Array(24));
  let worst = 0, past = 0, taken = 0;
  for (const P0 of [[0, 2, 0], [-40, 3, 25], [3000, 40, -2500], [30000, 60, 30000], [120000, 10, -90000]]) {
    const P = P0.map(Math.fround);
    for (const F of [4, 12, 36, 64, 96, 120]) {
      pointFaceMatrices(P, F, vps);
      for (let f = 0; f < 6; f++) spherePlanes(vps[f], planes[f]);
      const lim = Float64Array.from([P[0], P[1], P[2], F, cubeSlack(P[0], P[1], P[2], F)]);
      for (const r of [0.05, 1.3, 3.7]) {
        for (let f = 0; f < 6; f++) {
          const { best, at } = farthestTaken(planes[f], P, r);
          const v = at.map((x, i) => x + (P[i] - x) * 1e-9);   // a hair inside the face's corner
          if (!sphereInPlanes(planes[f], v[0], v[1], v[2], r)) continue;
          taken++;
          const over = best - (F + r * CUBE_REACH);
          if (over > 0) past++;
          worst = Math.max(worst, over / lim[4]);
          assert.ok(cubeKeeps(lim, 0, v[0], v[1], v[2], r), `face ${f} of a far-${F} lantern at ${P} takes a sphere r ${r} at [${v}] - ${over.toExponential(2)} past the exact bound, the slack ${lim[4].toExponential(2)}`);
        }
      }
    }
  }
  assert.ok(taken > 500 && past > 50, `the faces' corners were taken (${taken}), ${past} of them past the exact bound`);
  assert.ok(worst < 0.5, `the slack holds with room: the worst corner ${worst.toFixed(3)} of it`);
});

test('AUDIT 637 B1: a far-96 lantern\'s face that takes a sphere past the old slack draws it with the pre-pass on, as with it off - the case the audit found end to end (mutants: the far plane\'s term dropped)', () => {
  const F = shadowFarFor(96);
  assert.equal(F, 96);
  // found by a search of the corners: face 1 of a far-96 lantern at (0, 2, 0) takes this sphere, and the cube under
  // the slack before (1e-3 + 1e-5 S) dropped it
  const c = [-97.30239868164062, -97.1404800415039, 0], rad = Math.fround(1.3);
  const S = 2 + F, old = Float64Array.from([0, 2, 0, F, 1e-3 + 1e-5 * S]);
  assert.equal(cubeKeeps(old, 0, c[0], c[1], c[2], rad), false, 'the slack before dropped it');
  const run = (prepass) => withTuning(prepass, () => {
    const { g, r } = night();
    const mesh = { vao: { id: 'vao-corner' }, buffers: [], bounds: new Float32Array([...c, rad]), subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 4 }] };
    const lights = new Float32Array([0, 2, 0, 96]);
    return Array.from({ length: 3 }, () => frameOf(g, r, lights, () => r.drawMesh(mesh, I, null)).filter((d) => d[2] === 'vao-corner').length);
  });
  const off = run(false);
  assert.ok(off[1] >= 1, `a face draws it (${off})`);
  assert.deepEqual(run(true), off, 'and with the pre-pass on, the same');
});

// ─── B2: the pins the faces were missing ─────────────────────────────────────────────────────────────────────────

/** Audit B's differential scenes, richer than PERF-SHADOW1's town: many billboard records, records that come and go
 *  between frames, placed woods whose quads miss (dropped by _candidateQuads), a batch destroyed mid-run, cache on and
 *  off, cadenced lanterns. */
function scene(seed, prepass) {
  const rand = rng(seed);
  const { g, r } = night();
  const sun = rand() < 0.3, steady = rand() < 0.5, cacheOff = rand() < 0.3;
  if (sun) r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  if (cacheOff) r.setShadowCache(false);
  const groups = [];
  for (let g2 = 0, nRecs = 4 + Math.floor(rand() * 8); g2 < nRecs; g2++) {
    const list = [];
    for (let q = 0, nb = 1 + Math.floor(rand() * 6); q < nb; q++) {
      const kind = rand();
      let b;
      if (kind < 0.35) {   // a placed wood - a line (a big sphere, few quads) or a scatter
        const line = rand() < 0.5, n = 3 + Math.floor(rand() * 30), half = 5 + rand() * 120;
        const centers = line ? Array.from({ length: n }, (_, i) => [i * (2 * half / n) - half, rand() * 2 - 1, (rand() - 0.5) * 2]) : Array.from({ length: n }, () => [(rand() * 2 - 1) * half, rand() * 3 - 1.5, (rand() * 2 - 1) * half]);
        b = r.createBillboardBatch(504, 1 + Math.floor(rand() * 3), { w: 0.5 + rand() * 4, h: 0.6 + rand() * 9 }, centers);
        b.sway = rand() < 0.5 ? 0 : rand() * 1.4;
      } else if (kind < 0.85) {   // a single flat, some walking
        b = r.createBillboardBatch(rand() < 0.2 ? 182 : 504, rand() < 0.2 ? 1 : 2, { w: 0.6 + rand() * 1.5, h: 0.6 + rand() * 2.4 }, [[0, 0, 0]]);
        b.walks = rand() < 0.4;
      } else {   // a gib
        b = r.createBillboardBatch(504, 3, { w: 0.8, h: 1.2 }, Array.from({ length: 4 }, () => [rand() * 2, rand(), rand() * 2]), { dynamic: true });
        b.walks = true;
      }
      b.origin = [(rand() * 2 - 1) * 90, rand() * 3, (rand() * 2 - 1) * 90];
      list.push(b);
    }
    groups.push({ list, every: rand() < 0.3 ? 2 : 1, phase: Math.floor(rand() * 2) });
  }
  const meshes = Array.from({ length: 5 }, (_, m) => ({ vao: { id: `vao-m${seed}-${m}` }, buffers: [], bounds: new Float32Array([(rand() * 2 - 1) * 80, 2, (rand() * 2 - 1) * 80, 1 + rand() * 20]), subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 2 }] }));
  const nL = 6 + Math.floor(rand() * 12);
  const lights = new Float32Array(nL * 4);
  for (let i = 0; i < nL; i++) lights.set([(rand() * 2 - 1) * 80, 1 + rand() * 4, (rand() * 2 - 1) * 80, 6 + rand() * 34], i * 4);
  const wind = [9 * (rand() * 2 - 1), 9 * (rand() * 2 - 1), 3.7, 1];
  const killAt = Math.floor(rand() * 8);
  let t = 0;
  const frame = () => {
    const was = [SHADOW_TUNING.override, SHADOW_TUNING.facePrepass];
    SHADOW_TUNING.override = steady; SHADOW_TUNING.facePrepass = prepass;
    try {
      t++;
      for (const gr of groups) for (const b of gr.list) if (b.walks) b.origin = [b.origin[0] + Math.sin(t + b.size.w) * 0.6, b.origin[1], b.origin[2] + Math.cos(t * 0.7) * 0.6];
      if (t === killAt) r.destroyBillboardBatch(groups[0].list[0]);
      const shadow = frameOf(g, r, lights, () => {
        r.setFlatWind(wind);
        groups.forEach((gr, mi) => {
          if ((t + gr.phase) % gr.every === 0) r.drawBillboards(gr.list, RIGHT, UP);   // a record that comes and goes
          if (mi < meshes.length && (t + mi) % 3 !== 0) r.drawMesh(meshes[mi], I, null);
        });
      });
      const { culled, ...st } = r.shadows.stats;   // eslint-disable-line no-unused-vars
      return { shadow, st };
    } finally { [SHADOW_TUNING.override, SHADOW_TUNING.facePrepass] = was; }
  };
  return { frame, desc: `seed ${seed} (sun ${sun}, steady ${steady}, cache ${!cacheOff}, ${nL} lights)` };
}

test('AUDIT 637 B2: every draw of every frame is the one drawn with the pre-pass off, over scenes of many billboard records that come and go, woods dropped by their quads, a batch destroyed mid-run, cache on and off, steady and cadenced (mutants: a list reused without emptying it; a placed batch\'s quads asked short of the cube\'s reach; the wind\'s lean left out of a quad\'s radius)', () => {
  let draws = 0;
  for (let s = 1; s <= 40; s++) {
    const a = scene(1000 + s, true), b = scene(1000 + s, false);
    for (let f = 0; f < 8; f++) {
      const x = a.frame(), y = b.frame();
      assert.deepEqual(x.shadow, y.shadow, `${a.desc}, frame ${f}: the same draws in the same order`);
      assert.deepEqual(x.st, y.st, `${a.desc}, frame ${f}: the same faces, slots, blits and draws counted`);
      draws += x.shadow.length;
    }
  }
  assert.ok(draws > 20000, `the comparison drew something (${draws})`);
});

test('AUDIT 637 B2: a swaying wood whose one tree stands in a lantern\'s CORNER - past far + its radius on one axis, inside a side plane\'s reach - is kept for that face, with its lean in the wind (mutants: the quads asked within far + 2 radii; the lean left out)', () => {
  const run = (prepass) => withTuning(prepass, () => {
    const { g, r } = night();
    r.setShadowCache(false);   // every lantern's six faces, every frame
    const P = [0, 2, 0], F = shadowFarFor(20), wind = [9, 0, 3.7, 1];
    const size = { w: 2, h: 9 }, sway = 1.4;
    const rad = placementRadius(quadHalfDiagonal(size), swayLean(Math.hypot(wind[0], wind[1]), sway, size.h));
    const rad0 = placementRadius(quadHalfDiagonal(size), 0);
    // the tree: just inside face +Z's far plane and its +X side plane, at the light's height (the batch lifts h/2)
    const qz = F + rad - 0.05, qx = qz + rad * Math.SQRT2 - 0.05;
    assert.ok(qx > F + rad0 * CUBE_REACH + 0.1, 'past the reach of its radius without the lean');
    const centers = [[qx, P[1] - size.h / 2, qz], ...Array.from({ length: 40 }, (_, i) => [-300 + i * 3, 0, 400])];
    const wood = r.createBillboardBatch(504, 1, size, centers);
    assert.ok(wood._place, 'a placed batch');
    wood.sway = sway; wood.origin = [0, 0, 0];
    const lights = new Float32Array([...P, 20]);
    return Array.from({ length: 4 }, () => frameOf(g, r, lights, () => { r.setFlatWind(wind); r.drawBillboards([wood], RIGHT, UP); }).filter((d) => d[2] === wood.vao.id).length);
  });
  const off = run(false);
  assert.ok(off.slice(1).every((n) => n >= 1), `a face draws the wood for its corner tree (${off})`);
  assert.deepEqual(run(true), off, 'and with the pre-pass on, the same');
});

test('AUDIT 637 B2: UNDER THE STATIC CACHE TOO, a wood is asked of its quads once a lantern - the static faces and the dynamic ones each find it dropped from the lists, where every face walked its placements before (mutants: either cache-on ask of the quads gone)', () => {
  const run = (prepass) => withTuning(prepass, () => {
    const { g, r } = night();   // the static cache on, as it ships
    // forty-one trees along x at z = 0, a still wood and a swaying one; four lanterns 60 off the line, inside both
    // woods' spheres, their cubes (far 12) clear of every tree; a walker by each lantern, so its dynamic faces redraw
    const line = (z) => Array.from({ length: 41 }, (_, i) => [i * 5 - 100, 0, z]);
    const still = r.createBillboardBatch(504, 1, { w: 3, h: 7 }, line(0));
    const swaying = r.createBillboardBatch(504, 2, { w: 3, h: 7 }, line(1));
    swaying.sway = 1;
    const lights = new Float32Array([0, 2.5, 60, 12, 30, 2.5, -55, 12, -40, 3, 62, 12, 55, 2, -50, 12]);
    const walkers = [];
    for (let i = 0; i < 4; i++) { const b = r.createBillboardBatch(504, 3, { w: 1, h: 1.8 }, [[0, 0, 0]]); walkers.push(b); }
    let walks = 0, on = false;
    for (const wood of [still, swaying]) { const q = wood._place; wood._place = new Proxy(q, { get(t, k) { if (on && k === 'pts') walks++; return t[k]; } }); }
    const sp = r.shadows, render = sp.render.bind(sp);
    sp.render = (f) => { on = true; try { return render(f); } finally { on = false; } };
    const out = [];
    let faces = 0;
    for (let f = 0; f < 6; f++) {
      walkers.forEach((b, i) => { b.origin = [lights[i * 4] + Math.sin(f + i) * 2, 0, lights[i * 4 + 2] + Math.cos(f) * 2]; });
      out.push(frameOf(g, r, lights, () => { r.setFlatWind([6, 2, 3.7, 1]); r.drawBillboards([still, swaying, ...walkers], RIGHT, UP); }));
      faces += sp.stats.staticFaces + sp.stats.dynFaces;
    }
    return { out, walks, faces };
  });
  const base = run(false), now = run(true);
  assert.deepEqual(now.out, base.out, 'the same draws');
  assert.ok(base.faces >= 4 * 6 * 5, `the lanterns drew their static faces and then their dynamic ones every frame (${base.faces})`);
  assert.ok(base.walks >= 4 * 6 * 5, `the base walked the woods' placements from the faces (${base.walks})`);
  assert.equal(now.walks, 0, `now no face walks them (${now.walks})`);
});

test('AUDIT 637 B2: the walk empties every list it opens, whatever came before it - frames whose pass never discards draw what the pass without the pre-pass draws (mutants: a list reused without emptying it)', () => {
  const run = (prepass) => withTuning(prepass, () => {
    const { g, r } = night();
    r.setShadowCache(false);
    const flats = Array.from({ length: 3 }, (_, i) => { const b = r.createBillboardBatch(504, 2, { w: 1, h: 2 }, [[0, 0, 0]]); b.origin = [i * 2 - 2, 0, 3]; return b; });
    r.shadows.discard = () => {};   // the records pile up, the same way in both
    return Array.from({ length: 4 }, () => frameOf(g, r, new Float32Array([0, 2, 0, 12]), () => r.drawBillboards(flats, RIGHT, UP)));
  });
  const off = run(false);
  assert.ok(off[3].length > off[1].length, 'the records piled up');
  assert.deepEqual(run(true), off);
});

// ─── B3: a still frame walks nothing ─────────────────────────────────────────────────────────────────────────────

test('AUDIT 637 B3: A STILL FRAME WALKS NOTHING - with every lantern\'s map cached and nothing dynamic, no candidate walk is made and no lantern\'s dynamic scan is asked (it walked every record and flat against every lantern for lists nobody read); one mover - a flat, or a mesh, with no dynamic flat in the frame - makes ONE walk a frame for every lantern and draws what the pass without the pre-pass draws, and so does a pass whose faces all redraw (mutants: the walk made up front; the dynamic scan asked with nothing dynamic; a dynamic record other than a flat\'s missed; the walk made again by every lantern that asks)', () => {
  const run = ({ mover, meshMover = false, cacheOff, prepass = true }) => withTuning(prepass, () => {
    const { g, r } = night();
    if (cacheOff) r.setShadowCache(false);
    const rand = rng(5);
    const flats = Array.from({ length: 60 }, () => { const b = r.createBillboardBatch(504, 1, { w: 1, h: 2 }, [[0, 0, 0]]); b.origin = [(rand() * 2 - 1) * 40, 0, (rand() * 2 - 1) * 40]; return b; });
    const walker = r.createBillboardBatch(504, 3, { w: 1, h: 1.8 }, [[0, 0, 0]]);
    const meshes = Array.from({ length: 10 }, (_, m) => ({ vao: { id: `vao-s${m}` }, buffers: [], bounds: new Float32Array([(rand() * 2 - 1) * 40, 2, (rand() * 2 - 1) * 40, 3]), subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 2 }] }));
    const lights = new Float32Array(16);
    for (let i = 0; i < 4; i++) lights.set([(rand() * 2 - 1) * 30, 3, (rand() * 2 - 1) * 30, 16], i * 4);
    const door = { vao: { id: 'vao-door' }, buffers: [], bounds: new Float32Array([0, 1, 0, 1.5]), subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 2 }] };
    const at = new Float32Array(I);
    const sp = r.shadows;
    const walk = sp._casterCandidates.bind(sp), scan = sp._dynamicNear.bind(sp);
    let walks = 0, scans = 0;
    sp._casterCandidates = (...a) => { walks++; return walk(...a); };
    sp._dynamicNear = (...a) => { scans++; return scan(...a); };
    const per = [];
    for (let f = 0; f < 8; f++) {
      walks = 0; scans = 0;
      walker.origin = [lights[0] + Math.sin(f) * 2, 0, lights[2] + 1];
      at[12] = lights[4] + 1 + f * 0.3; at[14] = lights[6];   // a door swinging by lantern 1, a little more each frame
      const shadow = frameOf(g, r, lights, () => { r.setFlatWind([0, 0, 0, 0]); for (const m of meshes) r.drawMesh(m, I, null); if (meshMover) r.drawMesh(door, at, null); r.drawBillboards(mover ? [...flats, walker] : flats, RIGHT, UP); });
      per.push([walks, scans, shadow]);
    }
    return per.slice(3);   // the caches built
  });
  for (const [walks, scans] of run({ mover: false, cacheOff: false })) {
    assert.equal(walks, 0, 'a still, cached frame: no walk');
    assert.equal(scans, 0, 'and no dynamic scan');
  }
  for (const [walks, scans] of run({ mover: true, cacheOff: false })) {
    assert.equal(walks, 1, 'a mover: one walk for every lantern');
    assert.equal(scans, 4, 'and each lantern\'s dynamic scan');
  }
  for (const [walks] of run({ mover: false, cacheOff: true })) assert.equal(walks, 1, 'every face redrawn: one walk');
  const door = run({ mover: false, meshMover: true, cacheOff: false });
  for (const [walks, scans] of door) assert.deepEqual([walks, scans], [1, 4], 'a moving mesh and no dynamic flat: one walk, every lantern\'s scan');
  assert.deepEqual(door.map((x) => x[2]), run({ mover: false, meshMover: true, cacheOff: false, prepass: false }).map((x) => x[2]), 'and its shadow drawn as without the pre-pass');
  assert.ok(door.some((x) => x[2].some((d) => d[2] === 'vao-door')), 'the door casts');
});

test('AUDIT 637 B3: A LANTERN THAT DRAWS NOTHING ASKS NOTHING, whoever walks - a cached lantern beside a wood whose trees stand in its cube reads no more of the wood\'s placements than the pass without the pre-pass reads (its static signature\'s one ask a frame) while another lantern\'s mover makes the frame\'s walk (mutants: every lantern\'s quads asked with the walk)', () => {
  const run = (prepass) => withTuning(prepass, () => {
    const { g, r } = night();   // the static cache on
    // lantern A with a walker by it (its dynamic faces redraw every frame, so A walks); lantern B 100 off, still, a wood
    // of still trees all about it in its cube - B's map cached after its first frame, and nothing dynamic by it
    const lights = new Float32Array([0, 2, 0, 12, 100, 2, 0, 12]);
    const wood = r.createBillboardBatch(504, 1, { w: 2, h: 5 }, Array.from({ length: 41 }, (_, i) => [100 + Math.cos(i) * 6, 0, Math.sin(i) * 6]));
    assert.ok(wood._place, 'a placed batch');
    const walker = r.createBillboardBatch(504, 3, { w: 1, h: 1.8 }, [[0, 0, 0]]);
    let reads = 0, on = false;
    const q = wood._place;
    wood._place = new Proxy(q, { get(t, k) { if (on && k === 'pts') reads++; return t[k]; } });
    const sp = r.shadows, render = sp.render.bind(sp);
    sp.render = (f) => { on = true; try { return render(f); } finally { on = false; } };
    const after = [];
    for (let f = 0; f < 7; f++) {
      reads = 0;
      walker.origin = [Math.sin(f) * 2, 0, 1];
      frameOf(g, r, lights, () => r.drawBillboards([wood, walker], RIGHT, UP));
      if (f >= 3) after.push([reads, sp.stats.dynFaces, sp.stats.staticFaces]);
    }
    return after;
  });
  const base = run(false), now = run(true);
  for (const [, dyn, st] of now) assert.deepEqual([dyn, st], [6, 0], 'A\'s dynamic faces drawn every frame (the frame walked), B\'s map cached');
  assert.deepEqual(now.map((x) => x[0]), base.map((x) => x[0]), `B, drawing nothing, read the wood's placements as often as without the pre-pass (${now.map((x) => x[0])})`);
});

// ─── B4: nothing kept past the frame ─────────────────────────────────────────────────────────────────────────────

test('AUDIT 637 B4: no lantern\'s list holds a batch past the frame - discard() empties every list as far as any was filled, so a destroyed batch\'s placement grid is not kept alive by a slot (mutants: the lists left at discard; the filled extent never recorded)', () => withTuning(true, () => {
  const { g, r } = night();
  r.setShadowCache(false);
  const rand = rng(9);
  const flats = Array.from({ length: 30 }, () => { const b = r.createBillboardBatch(504, 1, { w: 1, h: 2 }, [[0, 0, 0]]); b.origin = [(rand() * 2 - 1) * 20, 0, (rand() * 2 - 1) * 20]; return b; });
  const lights = new Float32Array([0, 2, 0, 16, 8, 2, 8, 16]);
  const sp = r.shadows;
  let held = 0;
  const render = sp.render.bind(sp);
  sp.render = (f) => { const out = render(f); held = Math.max(held, ...sp._cands.map((c) => c.bb.reduce((n, l) => n + (l?.length ?? 0), 0))); return out; };
  for (let f = 0; f < 3; f++) frameOf(g, r, lights, () => r.drawBillboards(f < 2 ? flats : flats.slice(0, 2), RIGHT, UP));
  assert.ok(held > 0, `the lanterns' lists held flats while the pass ran (${held})`);
  const left = sp._cands.reduce((n, c) => n + c.bb.reduce((m, l) => m + (l?.length ?? 0), 0), 0);
  assert.equal(left, 0, `and none once it was done (${left})`);
}));

// ─── B5, B6, B8: the cube's own law at its edges ─────────────────────────────────────────────────────────────────

test('AUDIT 637 B5/B6/B8: the cube keeps every sphere a face takes at its degenerate edges - a centre off at infinity on two axes or three (a face\'s plane meets it as 0 x Infinity or Infinity - Infinity and culls nothing), and a radius below zero, whose reach along a face\'s axis is far + r; `facePrepass` is declared where the console finds it (mutants: an infinite centre culled; a negative radius reaching r (1 + sqrt 2))', () => {
  const P = [0, 2, 0], F = 20;
  const vps = Array.from({ length: 6 }, () => new Float32Array(16));
  const planes = Array.from({ length: 6 }, () => new Float32Array(24));
  pointFaceMatrices(P, F, vps);
  for (let f = 0; f < 6; f++) spherePlanes(vps[f], planes[f]);
  const lim = Float64Array.from([...P, F, cubeSlack(...P, F)]);
  const anyFace = (x, y, z, r) => planes.some((pl) => sphereInPlanes(pl, x, y, z, r));
  let taken = 0;
  for (const c of [[Infinity, Infinity, 0], [0, Infinity, Infinity], [Infinity, 2, Infinity], [Infinity, Infinity, Infinity], [-Infinity, Infinity, 0], [Infinity, -Infinity, -Infinity]]) {
    if (!anyFace(c[0], c[1], c[2], 1)) continue;
    taken++;
    assert.ok(cubeKeeps(lim, 0, c[0], c[1], c[2], 1), `[${c}] is taken by a face, and kept`);
  }
  assert.ok(taken >= 3, `faces take centres at infinity (${taken})`);
  for (const r of [-2, -0.5, -0.05]) {
    let t = 0;
    for (let u = 0; u <= 40; u++) {
      const x = P[0] + F + r - u * 0.01;
      if (!anyFace(x, P[1], P[2], r)) continue;
      t++;
      assert.ok(cubeKeeps(lim, 0, x, P[1], P[2], r), `a radius ${r} at ${(x - P[0]).toFixed(2)} along +X is taken by a face, and kept`);
    }
    assert.ok(t > 30, `a face takes a radius ${r} to far + r (${t})`);
  }
  assert.equal(cubeReach(-0.5), -0.5);
  assert.equal(cubeReach(1), CUBE_REACH);
  assert.equal(SHADOW_TUNING.facePrepass, true, 'declared, and on');
});
