// PERF-SUN1 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"): THE SUN'S CASCADES SHARE ONE WALK (bible/07-Rendering/Performance-Online.md PERF-SUN1; PERF-NEXT item 1).
// Every cascade's replay walked every record and every flat of the frame; now one walk finds the far cascade's, and each
// nearer cascade's list is found from the next one out's (shadowPass.js _sunCandidates). These pins hold the cascades to
// the draws they made - every draw of every frame, its program, VAO, framebuffer, count and offset, in order, against
// the same pass with the walk off (SHADOW_TUNING.sunPrepass) - over random towns spread from the eye to past the far
// cascade, under four suns, steady and cadenced, about the camera and about a travel view's focus; hold the nesting the
// walk stands on (a sphere a cascade takes, the next one out takes, out to 120 km, at the travel view's scale too); and
// hold the saving by count. Never on a clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { SHADOW_TUNING, SHADOW_CASCADES, sunCascadeMatrices, sunAnchorFor, sunTexelWorld, SHADOW_SUN_DEPTH } from '../src/render/shadowPass.js';
import { spherePlanes, sphereInPlanes } from '../src/render/bounds.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const RIGHT = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
/** Four suns: the afternoon's, a low evening's, noon's, and one along z (sunCascadeMatrices' basis takes Y for up). */
const SUNS = [[0.45, 0.8, 0.35], [0.95, 0.15, 0.1], [0.05, 0.99, 0.05], [0.2, 0.3, 0.93]].map((d) => new Float32Array(d));
const LAST = SHADOW_CASCADES.length - 1;

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
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A view placing the camera at `e` (no turn): what the renderer reads its eye from. */
const viewAt = (e) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -e[0], -e[1], -e[2], 1]);

/**
 * A random town about the eye, built twice from one seed: woods (placed batches) and single flats in rings within each
 * cascade, across its edge and past the far one (to 2,000 units); walkers; a gib; a flat placed by a NaN; meshes with
 * sub-spheres near and far, one unbounded and one placed by a NaN; terrain near and far. `frame()` runs one frame -
 * the eye walking, under `sun`, about `focus` when one is given (the travel view: its cascades four times as wide) -
 * and answers its shadow draws and the pass's counts.
 */
function town(seed, { sun, steady, prepass, focus = false }) {
  const rand = rng(seed);
  const g = recordingGl();
  const r = new Renderer(g.canvas);
  r.setLightingLane(EL_LANE);
  for (const k of ['504_1', '504_2', '504_3', '182_1', '300_0']) r.textures.set(k, { id: `tex-${k}` });
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  const batches = [];
  const ring = () => { const R = [6, 14, 40, 60, 230, 260, 700, 2000][Math.floor(rand() * 8)] * (focus ? 4 : 1); const a = rand() * Math.PI * 2, d = R * (0.6 + rand() * 0.5); return [Math.cos(a) * d, rand() * 6 - 3, Math.sin(a) * d]; };
  const scatter = (n, half) => Array.from({ length: n }, () => [(rand() * 2 - 1) * half, rand() * 3 - 1.5, (rand() * 2 - 1) * half]);
  for (let k = 0; k < 26; k++) {   // woods, pixel-wide and small
    const b = r.createBillboardBatch(504, 1 + (k % 3), { w: 0.5 + rand() * 4, h: (rand() < 0.1 ? -1 : 1) * (0.05 + rand() * 9) }, scatter(2 + Math.floor(rand() * 90), 5 + rand() * 300));
    b.sway = rand() < 0.4 ? 0 : rand() * 1.4;
    b.origin = ring();
    batches.push(b);
  }
  const walkers = [];
  for (let k = 0; k < 18; k++) {   // single flats - some walk
    const b = r.createBillboardBatch(k % 5 === 0 ? 182 : 504, k % 5 === 0 ? 1 : 2, { w: 0.2 + rand() * 1.5, h: 0.1 + rand() * 2.4 }, [[0, 0, 0]]);
    b.origin = ring();
    if (k % 3 === 0) walkers.push(b);
    batches.push(b);
  }
  const gib = r.createBillboardBatch(504, 3, { w: 0.8, h: 1.2 }, scatter(5, 3), { dynamic: true });
  gib.origin = [3, 1, -2];
  batches.push(gib);
  const lost = r.createBillboardBatch(504, 2, { w: 1, h: 2 }, [[0, 0, 0]]);
  lost.origin = [NaN, 0, 600];   // a sphere the planes never cull, NaN on one axis and far on another: every cascade takes it, as before
  batches.push(lost);
  const meshes = [];
  for (let m = 0; m < 10; m++) {
    const subs = [];
    let at = 0;
    for (let k = 0; k < 3 + Math.floor(rand() * 10); k++) {
      const prims = 1 + Math.floor(rand() * 30), c = ring();
      subs.push({ textureArchive: 300, textureRecord: 0, startIndex: at, primitiveCount: prims, _bounds: new Float32Array([c[0], c[1], c[2], 0.05 + rand() * 6]) });
      at += prims * 3;
    }
    const c = ring();
    meshes.push({ vao: { id: `vao-m${m}` }, buffers: [], bounds: new Float32Array([c[0], 2, c[2], m % 3 === 0 ? 700 : 0.1 + rand() * 30]), subMeshes: subs });
  }
  const loose = { vao: { id: 'vao-loose' }, buffers: [], bounds: null, subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 6 }] };   // no bounds: every replay draws it
  const nanAt = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, NaN, 0, 900, 1]);   // a mesh placed by a NaN, 900 off on z: its spheres cull nothing
  const tile = (x, z, s) => r.createTerrainSurface(new Float32Array([x, 0, z, x + s, 0, z, x + s, 0, z + s, x, 0, z + s, x + s / 2, 1, z + s / 2]), new Float32Array(15), new Uint32Array([0, 1, 4, 1, 2, 4, 2, 3, 4]));
  const tiles = [tile(-3, -3, 6.4), tile(30, 20, 6.4), tile(200, -150, 6.4), tile(1500, 900, 6.4)];
  const wind = [9 * (rand() * 2 - 1), 9 * (rand() * 2 - 1), 3.7, 1];
  let t = 0;
  const frame = () => {
    SHADOW_TUNING.override = steady; SHADOW_TUNING.sunPrepass = prepass;
    try {
      t++;
      for (const w of walkers) { w.origin = [w.origin[0] + Math.sin(t + w.size.w) * 0.7, w.origin[1], w.origin[2] + Math.cos(t * 0.7) * 0.7]; }
      gib.origin = [3 + t * 0.3, 1, -2];
      const eye = [t * 7.3, 1.6, -t * 4.1];   // walking: the anchor moves on as the eye leaves its hold
      if (focus) r.setFocus([eye[0] + 20, eye[1], eye[2] - 10], true);
      g.draws.length = 0;
      r.beginFrame(I, viewAt(eye), sun, WORLD_FRAME);
      const shadow = g.draws.slice();
      const st = { ...r.shadows.stats };
      r.setFlatWind(wind);
      for (const m of meshes) r.drawMesh(m, I, null);
      r.drawMesh(loose, I, null); r.drawMesh(meshes[1], nanAt, null);
      for (const s of tiles) r.drawTerrain(s, I, {}, {}, 6.4);
      r.drawBillboards(batches, RIGHT, UP);
      r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
      return { shadow, st };
    } finally { SHADOW_TUNING.override = false; SHADOW_TUNING.sunPrepass = undefined; }
  };
  return { r, frame, batches };
}

test('PERF-SUN1: the sun\'s cascades draw EXACTLY what they drew - every draw of every frame (program, VAO, framebuffer, count, offset), its order included, over random towns spread from the eye to past the far cascade (woods, single flats, walkers, a gib, a flat placed by a NaN, meshes with sub-spheres near and far, an unbounded mesh, one placed by a NaN, terrain), under four suns, steady and cadenced, about the camera and about a travel view\'s focus, the eye walking - against the same pass with the walk off (mutants: the far cascade\'s list found by the near planes; a nearer list found by the nearest planes; an unbounded record left out; a record\'s flats cut at its first one out; a cascade walking another one\'s list, or the far one the next one in\'s; the switch ignored; discard leaving the lists full)', () => {
  let compared = 0, sunDraws = 0;
  for (const seed of [31, 32, 33]) {
    for (const sun of SUNS) {
      for (const steady of [true, false]) {
        for (const focus of [false, true]) {
          const a = town(seed, { sun, steady, prepass: true, focus }), b = town(seed, { sun, steady, prepass: false, focus });
          for (let f = 0; f < 5; f++) {
            const x = a.frame(), y = b.frame();
            const at = `seed ${seed}, sun [${[...sun]}], ${steady ? 'steady' : 'cadenced'}, ${focus ? 'focus' : 'camera'}, frame ${f}`;
            assert.deepEqual(x.shadow, y.shadow, `${at}: the same draws in the same order`);
            const keep = (s) => { const { culled, ...rest } = s; return rest; };   // `culled` counts the replays' own culls - the walk's are never asked
            assert.deepEqual(keep(x.st), keep(y.st), `${at}: the same cascades and draws counted`);
            compared += x.shadow.length; sunDraws += x.st.sunDraws;
            // AUDIT 637 B4's law for the cascades' lists: the frame's passes over, discard() has emptied them - none holds a batch past it
            assert.ok(a.r.shadows._sunCands.every((c) => c.n === 0 && c.bb.every((l) => !l || l.length === 0)), `${at}: no list holds a flat past the frame`);
          }
        }
      }
    }
  }
  assert.ok(compared > 10000 && sunDraws > 5000, `the comparison drew something (${compared} draws, ${sunDraws} in the cascades)`);
});

test('PERF-SUN1: THE CASCADES NEST - a sphere any cascade\'s float32 planes take, the next one out\'s take too: at every side of every cascade (the sphere just inside it), by the eye and thirty to a hundred and twenty kilometres out, under four suns, at the camera\'s scale and the travel view\'s; and a sphere NaN or infinite on an axis taken by a cascade is taken by the next - the premise the nearer lists are found from the next one out\'s on', () => {
  const vps = SHADOW_CASCADES.map(() => new Float32Array(16)), planes = SHADOW_CASCADES.map(() => new Float32Array(24));
  const rand = rng(7);
  let taken = 0;
  for (const eye of [[0, 2, 0], [-40, 3, 25], [3000, 40, -2500], [30000, 60, 30000], [120000, 10, -90000]]) {
    for (const sun of SUNS) {
      for (const scale of [1, 4]) {
        const anchor = [NaN, NaN, NaN];
        sunAnchorFor(eye, anchor, sun, sunTexelWorld(LAST, scale));
        sunCascadeMatrices(eye, sun, vps, anchor, scale);
        for (let c = 0; c <= LAST; c++) spherePlanes(vps[c], planes[c]);
        for (let c = 0; c < LAST; c++) {
          const P = planes[c], Q = planes[c + 1], R = SHADOW_CASCADES[c] * scale, D = SHADOW_SUN_DEPTH * scale;
          for (let n = 0; n < 400; n++) {
            const rad = [0, 0.01, 0.4, 3, 40][n % 5];
            // a point in the cascade's box (along its own planes' normals - the box's axes - about the eye), put on one of
            // its planes from inside (just taken), then a hair either way
            const u = (rand() * 2 - 1) * R, v = (rand() * 2 - 1) * R, w = (rand() * 2 - 1) * D;
            const q = [0, 1, 2].map((i) => eye[i] + u * P[i] + v * P[8 + i] + w * P[16 + i]);
            const k = n % 6, a = P[k * 4], b = P[k * 4 + 1], cc = P[k * 4 + 2], d = P[k * 4 + 3];
            const s = a * q[0] + b * q[1] + cc * q[2] + d + rad - (rand() * 2 - 1) * 1e-3;
            const p = [q[0] - s * a, q[1] - s * b, q[2] - s * cc];
            if (!sphereInPlanes(P, p[0], p[1], p[2], rad)) continue;
            taken++;
            assert.ok(sphereInPlanes(Q, p[0], p[1], p[2], rad), `cascade ${c} takes [${p}] r ${rad} (eye ${eye}, sun ${[...sun]}, scale ${scale}) and cascade ${c + 1} must`);
          }
          for (const p of [[NaN, 0, 0], [eye[0], NaN, eye[2]], [Infinity, eye[1], eye[2]], [-Infinity, Infinity, 0], [eye[0], eye[1], Infinity]]) {
            if (sphereInPlanes(P, p[0], p[1], p[2], 1)) assert.ok(sphereInPlanes(Q, p[0], p[1], p[2], 1), `cascade ${c} takes [${p}] and cascade ${c + 1} must`);
          }
        }
      }
    }
  }
  assert.ok(taken > 10000, `the cascades took spheres at their edges (${taken})`);
});

test('PERF-SUN1: a flat past the far cascade is asked by NO cascade\'s replay - a wood 2,000 units out is looked at once by the walk, where each of the three cascades looked at it before; a flat inside the near cascade is still asked by all three (mutants: the cascades walking every flat again; no list at all)', () => {
  const run = (prepass) => {
    const { r, frame, batches } = town(41, { sun: SUNS[0], steady: true, prepass });
    const watch = (b) => {
      let reads = 0, on = false, conceal = b.conceal;
      Object.defineProperty(b, 'conceal', { get() { if (on) reads++; return conceal; }, set(v) { conceal = v; } });
      return { count: () => reads, set: (v) => { on = v; } };
    };
    const far = r.createBillboardBatch(504, 1, { w: 3, h: 7 }, Array.from({ length: 30 }, (_, i) => [i * 3, 0, (i % 7) * 4]));
    far.origin = [2000, 0, 2000];
    const near = r.createBillboardBatch(504, 2, { w: 1, h: 2 }, [[0, 0, 0]]);
    const farW = watch(far), nearW = watch(near);
    batches.push(far, near);
    const sp = r.shadows, render = sp.render.bind(sp);
    sp.render = (f) => { farW.set(true); nearW.set(true); try { return render(f); } finally { farW.set(false); nearW.set(false); } };
    let cascades = 0;
    for (let f = 0; f < 4; f++) {
      near.origin = [f * 7.3, 0.5, -f * 4.1];   // at the eye's foot as it walks
      cascades += frame().st.cascadesDrawn;
    }
    return { far: farW.count(), near: nearW.count(), cascades };
  };
  const base = run(false), now = run(true);
  assert.equal(now.cascades, base.cascades, 'the same cascades drawn');
  assert.ok(base.cascades >= 3 * 3, `the cascades were drawn (${base.cascades})`);
  assert.ok(base.far >= base.cascades - 3, `the base asked the far wood in every cascade's replay (${base.far} over ${base.cascades} cascades)`);
  assert.equal(now.far, 0, `now no cascade's replay asks it (${now.far})`);
  assert.equal(now.near, base.near, `the flat at the eye's foot is asked by every cascade still (${now.near}, the base ${base.near})`);
});
