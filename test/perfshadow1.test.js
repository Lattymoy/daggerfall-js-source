// PERF-SHADOW1 (2026-10-06, Mac: "I wanna look into how we can continue to improve performance, including for online"):
// A LANTERN'S SIX FACES SHARE ONE WALK. Measured in the real game (Knightstale, 15:00, the world host): the shadow pass
// was 7.2 ms of the frame's 16.1 ms of JavaScript, nearly all of it its replays walking every record and every flat -
// under Steady shadows (on by default) every lantern with a mover or a swaying tree by it redraws its six dynamic faces
// every frame, and each face, and the lantern's own dynamic scan, walked the whole frame. Now one walk a frame finds
// each ranked lantern's candidates (shadowPass.js _casterCandidates) and its faces and scan walk only those. These pins
// hold the faces to the draws they made - every draw of every frame, its program, VAO, framebuffer, count and offset,
// against the same pass with the pre-pass off (SHADOW_TUNING.facePrepass) over random towns - and hold the saving by
// count: a flat no lantern can reach is no longer asked by any lantern's face. Never on a clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { SHADOW_TUNING, SHADOW_POINT_CASTERS, pointFaceMatrices, cubeKeeps, cubeSlack, CUBE_REACH } from '../src/render/shadowPass.js';
import { spherePlanes, sphereInPlanes } from '../src/render/bounds.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const RIGHT = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
const LIGHT_DIR = new Float32Array([0.45, 0.8, 0.35]);

/** perfexta.test.js's recording GL: every draw with the program, VAO and framebuffer it was made in (and a count of
 *  the program binds, `uses.n`). */
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

/**
 * A random town, built twice from one seed (the same GL ids, the same producers): pixel-wide woods (createBillboardBatch
 * with many centres - the placement grid), still and swaying; single flats; walkers whose origin moves every frame; a
 * gib (dynamic); a flat whose origin is NaN; meshes with sub-mesh spheres in and out of reach; a dozen and more
 * lanterns. `frame()` runs one frame and answers its draws.
 */
function town(seed, { sun, steady, prepass, nanLight = false, crowd = 0 }) {
  const rand = rng(seed);
  const g = recordingGl();
  const r = new Renderer(g.canvas);
  r.setLightingLane(EL_LANE);
  for (const k of ['504_1', '504_2', '504_3', '182_1', '210_0', '216_0', '300_0']) r.textures.set(k, { id: `tex-${k}` });
  if (sun) r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  else r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0);
  const batches = [];
  const scatter = (n, half) => Array.from({ length: n }, () => [(rand() * 2 - 1) * half, rand() * 3 - 1.5, (rand() * 2 - 1) * half]);
  for (let k = 0; k < 30; k++) {   // woods
    const b = r.createBillboardBatch(504, 1 + (k % 3), { w: 0.5 + rand() * 4, h: (rand() < 0.1 ? -1 : 1) * (0.3 + rand() * 9) }, scatter(2 + Math.floor(rand() * 120), 20 + rand() * 260));
    b.sway = rand() < 0.4 ? 0 : rand() * 1.4;
    b.origin = [(rand() * 2 - 1) * 120, rand() * 4 - 2, (rand() * 2 - 1) * 120];
    batches.push(b);
  }
  const walkers = [];
  for (let k = 0; k < 14; k++) {   // single flats - some walk
    const b = r.createBillboardBatch(k % 5 === 0 ? 182 : 504, k % 5 === 0 ? 1 : 2, { w: 0.6 + rand() * 1.5, h: 0.2 + rand() * 2.4 }, [[0, 0, 0]]);
    b.origin = [(rand() * 2 - 1) * 70, rand() * 2, (rand() * 2 - 1) * 70];
    if (k % 3 === 0) walkers.push(b);
    if (k === 7) b.archive = 210;   // a flame: no lantern's occluder
    if (k === 8) b.archive = 216;   // a no-cast archive
    if (k === 9) b.noShadow = true;
    batches.push(b);
  }
  const gib = r.createBillboardBatch(504, 3, { w: 0.8, h: 1.2 }, scatter(5, 3), { dynamic: true });
  gib.origin = [3, 1, -2];
  batches.push(gib);
  const lost = r.createBillboardBatch(504, 2, { w: 1, h: 2 }, [[0, 0, 0]]);
  lost.origin = [NaN, 0, 600];   // a sphere the planes never cull, NaN on one axis and far on another: every face takes it, as before
  batches.push(lost);
  const lostWood = r.createBillboardBatch(504, 3, { w: 2, h: 4 }, scatter(40, 30));
  lostWood.origin = [0, NaN, 0];   // ...and a placed one: its quads are never asked by the cube, as no face's planes cull them
  batches.push(lostWood);
  // a wood along a line 250 out on z, 400 across: its sphere reaches every lantern's cube and no tree of it does - the
  // quads drop it from every list, and the records drawn after it move down each lantern's list
  const line = r.createBillboardBatch(504, 2, { w: 3, h: 7 }, Array.from({ length: 41 }, (_, i) => [i * 10 - 200, 0, 0]));
  line.origin = [0, 0, 250];
  const wide = r.createBillboardBatch(504, 1, { w: 2, h: 5 }, scatter(30, 25));
  wide.size.w = NaN;   // a width not a number: its sphere stands (the bounds it was born with), its quads' radius is NaN - which no face's planes cull
  wide.sway = 0.8; wide.origin = [5, 0, -6];
  batches.push(wide);
  const meshes = [];
  for (let m = 0; m < 8; m++) {
    const subs = [];
    let at = 0;
    for (let k = 0; k < 3 + Math.floor(rand() * 10); k++) {
      const prims = 1 + Math.floor(rand() * 30), out = rand() < 0.35;
      subs.push({ textureArchive: 300, textureRecord: 0, startIndex: at, primitiveCount: prims, _bounds: new Float32Array([(rand() * 2 - 1) * (out ? 500 : 40), rand() * 4, (rand() * 2 - 1) * (out ? 500 : 40), 0.5 + rand() * 4]) });
      at += prims * 3;
    }
    meshes.push({ vao: { id: `vao-m${m}` }, buffers: [], bounds: new Float32Array([(rand() * 2 - 1) * 60, 2, (rand() * 2 - 1) * 60, m % 3 === 0 ? 700 : 30]), subMeshes: subs });
  }
  const loose = { vao: { id: 'vao-loose' }, buffers: [], bounds: null, subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 6 }] };   // no bounds: every replay draws it
  const nanAt = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, NaN, 0, 900, 1]);   // a mesh placed by a NaN, 900 off on z: its spheres cull nothing
  const nL = SHADOW_POINT_CASTERS + 4;
  const lights = new Float32Array(nL * 4);
  for (let i = 0; i < nL; i++) lights.set([(rand() * 2 - 1) * 80, 1 + rand() * 4, (rand() * 2 - 1) * 80, 6 + rand() * 22], i * 4);
  if (nanLight) lights[0] = NaN;   // a lantern placed by a NaN still ranks (pickShadowCasters keeps a NaN distance first): its faces walk everything
  // AUDIT PERF-ON4 (sun lens 1, of PERF-SHADOW1's half): `crowd` small meshes about the nearest lantern - its list past the
  // 64 it starts with, so the growth is walked (a real tavern's or town's grows on its first frame)
  let hub = 0;   // the lantern nearest the eye - one the pass surely casts from
  for (let i = 1; i < nL; i++) if (Math.hypot(lights[i * 4], lights[i * 4 + 1], lights[i * 4 + 2]) < Math.hypot(lights[hub * 4], lights[hub * 4 + 1], lights[hub * 4 + 2])) hub = i;
  const crowdMeshes = Array.from({ length: crowd }, (_, k) => ({ vao: { id: `vao-c${k}` }, buffers: [], off: [(rand() * 2 - 1) * 2, rand() * 2 - 1, (rand() * 2 - 1) * 2], bounds: new Float32Array(4), subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 2, _bounds: new Float32Array(4) }] }));
  const wind = [9 * (rand() * 2 - 1), 9 * (rand() * 2 - 1), 3.7, 1];
  let t = 0;
  const frame = () => {
    SHADOW_TUNING.override = steady; SHADOW_TUNING.facePrepass = prepass;
    try {
      t++;
      for (const w of walkers) { w.origin = [w.origin[0] + Math.sin(t + w.size.w) * 0.7, w.origin[1], w.origin[2] + Math.cos(t * 0.7) * 0.7]; }
      gib.origin = [3 + t * 0.3, 1, -2];
      for (let i = 0; i < nL; i++) lights[i * 4] += Math.sin(t * 0.3 + i) * 0.05;   // a lantern swinging on its hook
      r.setPointLights(lights, new Float32Array(nL * 3).fill(1));
      g.draws.length = 0;
      r.beginFrame(I, I, LIGHT_DIR, WORLD_FRAME);
      const shadow = g.draws.slice();
      const st = { ...r.shadows.stats };
      r.setFlatWind(wind);
      r.drawBillboards([line], RIGHT, UP);
      for (const m of meshes) r.drawMesh(m, I, null);
      r.drawMesh(loose, I, null); r.drawMesh(meshes[1], nanAt, null);
      r.drawBillboards(batches, RIGHT, UP);
      for (const m of crowdMeshes) { const c = [lights[hub * 4] + m.off[0], lights[hub * 4 + 1] + m.off[1], lights[hub * 4 + 2] + m.off[2], 0.4]; m.bounds.set(c); m.subMeshes[0]._bounds.set(c); r.drawMesh(m, I, null); }
      r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
      return { shadow, st };
    } finally { SHADOW_TUNING.override = false; SHADOW_TUNING.facePrepass = undefined; }
  };
  return { r, frame, batches, lights };
}

test('PERF-SHADOW1: a lantern\'s faces draw EXACTLY what they drew - every draw of every frame (program, VAO, framebuffer, count, offset), its order included, over random towns of woods still and swaying, walkers, a gib, flats placed by a NaN, a width not a number, meshes with sub-spheres in and out of reach and sixteen lanterns, by night and by day, steady and not, against the same pass with the pre-pass off (mutants: the cube\'s reach without its 1 + sqrt 2, without its slack, a placed batch asked by the far alone, a NaN sphere culled - wholly, or on one axis by another - a NaN placed batch or a NaN radius asked of its quads, an unbounded record left out, a lantern placed by a NaN given candidates, a record moved without its list, a list not cut to the flats it kept, a flat under a second lantern left out of its list, the dynamic scan or a face walking past its candidates; AUDIT PERF-ON4: a grown list losing what it held)', () => {
  let compared = 0, pointDraws = 0, grown = 0;
  for (const seed of [11, 12, 13, 14]) {
    for (const sun of [false, true]) {
      for (const steady of [true, false]) {
        const odd = { nanLight: seed === 12, crowd: seed >= 13 ? 80 : 0 };   // a lantern placed by a NaN; AUDIT PERF-ON4: a lantern's list grown past 64
        const a = town(seed, { sun, steady, prepass: true, ...odd }), b = town(seed, { sun, steady, prepass: false, ...odd });
        for (let f = 0; f < 6; f++) {
          const x = a.frame(), y = b.frame();
          assert.deepEqual(x.shadow, y.shadow, `seed ${seed}, ${sun ? 'day' : 'night'}, ${steady ? 'steady' : 'cadenced'}, frame ${f}: the same draws in the same order`);
          const keep = (s) => { const { culled, ...rest } = s; return rest; };   // `culled` counts the faces' own culls - the pre-pass's are never asked
          assert.deepEqual(keep(x.st), keep(y.st), `seed ${seed} frame ${f}: the same faces, slots, blits and draws counted`);
          compared += x.shadow.length; pointDraws += x.st.pointDraws;
        }
        if (odd.crowd) { grown++; assert.ok(a.r.shadows._cands.some((c) => c.rec.length > 64), `a lantern's list grew past 64 (${a.r.shadows._cands.map((c) => c.rec.length)})`); }
      }
    }
  }
  assert.ok(compared > 5000 && pointDraws > 1000, `the comparison drew something (${compared} draws, ${pointDraws} in lantern faces)`);
  assert.equal(grown, 8, 'the crowded towns grew a list');
});

test('PERF-SHADOW1: a flat no lantern can reach is asked by NO lantern face and by no lantern\'s dynamic scan - a moving wood 2,000 units from every lantern is looked at by the main pass and the air pass alone, where the base looked at it from every face and every lantern\'s scan (mutants: the faces or the scan walking every flat again; no candidates at all)', () => {
  const run = (prepass) => {
    const { r, frame, batches, lights } = town(21, { sun: false, steady: true, prepass });
    // a wood 2,000 units from every lantern, walking (a mover: the dynamic faces' and the dynamic scan's)
    const far = r.createBillboardBatch(504, 1, { w: 3, h: 7 }, Array.from({ length: 40 }, (_, i) => [i * 3, 0, (i % 7) * 4]));
    far.sway = 1;
    let t = 0;
    let reads = 0, conceal = false;
    Object.defineProperty(far, 'conceal', { get() { reads++; return conceal; }, set(v) { conceal = v; } });
    batches.push(far);
    for (let i = 0; i < lights.length; i += 4) assert.ok(Math.hypot(lights[i] - 2000, lights[i + 2] - 2000) > 1500);
    const step = () => { t++; far.origin = [2000 + t * 0.25, 0, 2000]; return frame(); };
    for (let f = 0; f < 3; f++) step();
    reads = 0;
    let faces = 0;
    const F = 5;
    for (let f = 0; f < F; f++) { const st = step().st; faces += st.dynFaces + st.staticFaces; }
    return { reads, faces, perFrame: reads / F };
  };
  const base = run(false), now = run(true);
  assert.ok(base.faces >= F_MIN, `the lanterns redrew their faces (${base.faces})`);
  assert.equal(now.faces, base.faces, 'the same faces redrawn');
  assert.ok(base.perFrame >= SHADOW_POINT_CASTERS, `the base asked the far wood from every lantern's scan and face (${base.perFrame} a frame)`);
  assert.ok(now.perFrame <= 3, `now the main pass and the air pass alone ask it (${now.perFrame} a frame; the base ${base.perFrame})`);
});
const F_MIN = 8 * 6;

test('PERF-SHADOW1: THE CUBE IS NEVER THE NARROWER TEST - at the edge where a face\'s far plane meets its side, every sphere any of a lantern\'s six float32 faces takes is one the pre-pass keeps, beside the origin and thirty to a hundred and twenty kilometres out, where the planes\' rounding takes spheres PAST the exact bound far + r (1 + sqrt 2) (mutants: the 1 + sqrt 2 dropped; the slack dropped)', () => {
  const vps = Array.from({ length: 6 }, () => new Float32Array(16));
  const planes = Array.from({ length: 6 }, () => new Float32Array(24));
  let taken = 0, past = 0;
  for (const P of [[0, 2, 0], [-40, 3, 25], [3000, 40, -2500], [30000, 60, 30000], [120000, 10, -90000]]) {
    for (const F of [4, 8, 12, 20, 36]) {
      pointFaceMatrices(P, F, vps);
      for (let f = 0; f < 6; f++) spherePlanes(vps[f], planes[f]);
      const lim = Float64Array.from([P[0], P[1], P[2], F, cubeSlack(P[0], P[1], P[2], F)]);
      for (const r of [0.05, 0.4, 1.3, 3.7]) {
        const B = F + r * CUBE_REACH;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          if (a === b) continue;
          for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
            for (let u = 0; u <= 6; u++) for (let v = -24; v <= 24; v++) {
              // along the face's axis a: just inside its far bound F + r; across it on b: about the side plane's reach
              const d = [0, 0, 0];
              d[a] = sa * (F + r - u * 2e-4);
              d[b] = sb * (B + v * 1e-4);
              const x = P[0] + d[0], y = P[1] + d[1], z = P[2] + d[2];
              let take = false;
              for (let f = 0; f < 6 && !take; f++) take = sphereInPlanes(planes[f], x, y, z, r);
              if (!take) continue;
              taken++;
              if (Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])) > B) past++;
              assert.ok(cubeKeeps(lim, 0, x, y, z, r), `a face takes [${d}] r ${r} about ${P} (far ${F}) and the cube must keep it`);
            }
          }
        }
      }
    }
  }
  assert.ok(taken > 1000, `the faces took spheres at the edge (${taken})`);
  assert.ok(past > 0, `and some PAST the exact bound - the slack is what keeps those (${past})`);
});

test('PERF-SHADOW1: A WOOD IS ASKED OF ITS QUADS ONCE A LANTERN, NOT ONCE A FACE - a pixel-wide wood whose sphere holds four lanterns\' cubes and none of whose trees stands in them is dropped from each lantern\'s lists by one cube query (its grid\'s box missed: no placement walked), where every face asked it of its placements before, and its record with it - a face binds no program for a list left empty; and it is drawn exactly as before, by no face (mutants: the quads never asked; no lantern told it has a placed batch to ask; a record left with no flat kept in the list)', () => {
  const run = (prepass) => {
    const g = recordingGl();
    const r = new Renderer(g.canvas);
    r.setLightingLane(EL_LANE);
    r.textures.set('504_1', { id: 'tex-504_1' });
    r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0);
    r.setShadowCache(false);   // the old path: every lantern's six faces every frame, under Steady shadows
    // forty-one trees along x, 200 across, at z = 0 - a sphere of about a hundred; four lanterns 60 off the line,
    // inside it, their cubes (far 12, a quad's reach 3.8) clear of the line by some 30
    const wood = r.createBillboardBatch(504, 1, { w: 3, h: 7 }, Array.from({ length: 41 }, (_, i) => [i * 5 - 100, 0, 0]));
    wood.origin = [0, 0, 0];
    assert.ok(wood._place, 'a placed batch');
    const lights = new Float32Array([0, 2.5, 60, 12, 30, 2.5, -55, 12, -40, 3, 62, 12, 55, 2, -50, 12]);
    const s = wood.bounds;
    for (let i = 0; i < lights.length; i += 4) assert.ok(Math.hypot(lights[i] - s[0], lights[i + 1] - s[1] - 3.5, lights[i + 2] - s[2]) + 12 * Math.sqrt(3) < s[3], `the sphere holds lantern ${i / 4}'s whole cube`);
    let walks = 0, binds = 0, on = false;
    const q = wood._place;
    wood._place = new Proxy(q, { get(t, k) { if (on && k === 'pts') walks++; return t[k]; } });   // a placement walked: placementsInVolume always, placementsInCube past its grid box
    const sp = r.shadows, render = sp.render.bind(sp);
    sp.render = (f) => { on = true; const u = g.uses.n; try { return render(f); } finally { on = false; if (counting) binds += g.uses.n - u; } };
    let counting = false;
    const draws = [];
    let faces = 0;
    SHADOW_TUNING.override = true; SHADOW_TUNING.facePrepass = prepass;
    try {
      for (let f = 0; f < 6; f++) {
        r.setPointLights(lights, new Float32Array(12).fill(1));
        g.draws.length = 0;
        if (f === 2) { walks = 0; counting = true; }
        r.beginFrame(I, I, LIGHT_DIR, WORLD_FRAME);
        draws.push(g.draws.slice());
        faces += sp.stats.facesDrawn;
        r.drawBillboards([wood], RIGHT, UP);
        r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
      }
    } finally { SHADOW_TUNING.override = false; SHADOW_TUNING.facePrepass = undefined; }
    return { walks, binds, draws, faces };
  };
  const base = run(false), now = run(true);
  assert.deepEqual(now.draws, base.draws, 'the same draws');
  assert.ok(base.faces >= 4 * 6 * 5, `the lanterns drew their faces every frame (${base.faces})`);
  assert.ok(base.walks >= 4 * 6 * 4, `the base walked the wood's placements from every face (${base.walks} in four frames)`);
  assert.equal(now.walks, 0, `now no face walks them: one cube query a lantern misses the grid (${now.walks})`);
  assert.ok(base.binds >= 4 * 6 * 4, `the base bound the flats' program in every face (${base.binds})`);
  assert.equal(now.binds, 0, `now a lantern whose lists are empty binds none (${now.binds})`);
});
