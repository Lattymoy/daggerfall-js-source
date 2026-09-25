// PERF-EXT (2026-09-25, two players via Mac: "fps issues in the exterior
// but fine in the interior", "me too my friend.. don't know why. I got a
// RX6600"; Mac: "I am not getting another player to do the work that youre
// suppose to do"). THE SHADOWS - the pass's cluster A: the lanterns' and the
// sun's replays, the static signature, the recorded meshes, the sun's kernel.
// Each pin is on the thing that made the frame cheaper - a draw not made, a
// walk not repeated, a tap not taken - and on the picture it must not move:
// never on a clock (a timing assertion on a shared runner is what broke this
// repo's deploy, STREAM1). The record is
// `bible/07-Rendering/Performance-Exterior.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, EL_MESH_FS, EL_BB_FS } from '../src/render/enhancedLighting.js';
import * as bounds from '../src/render/bounds.js';   // a namespace: on the base the placement grid is missing, and only its pins fail
import { sunCascadeMatrices, pointFaceMatrices, shadowFarFor, swayLean, spheresTouch, foldSignature, SHADOW_LIGHT_FLATS, SHADOW_NO_CAST_ARCHIVES, SHADOW_GLSL, SHADOW_SUN_SIZE, SHADOW_LO_REBUILDS } from '../src/render/shadowPass.js';
import { StaticBatchBuilder, keyResolver } from '../src/render/staticBatch.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const RIGHT = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
const LIGHT_DIR = new Float32Array([0.45, 0.8, 0.35]);

/** A recording fake GL that also holds the state a draw is made in: the bound program, VAO and framebuffer. */
function recordingGl() {
  const calls = [];
  const draws = [];   // [program, vao, framebuffer, count, offset] per drawElements
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
        else if (k === 'drawElements') draws.push([prog, vao, fb, args[1], args[3]]);
        calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? a.slice() : a))]);
      };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, draws, canvas };
}

/** The lane on a fake GL; `frame(draw, lights, lightDir)` runs one frame (the replay of last frame's records, then
 *  this frame's draws) and returns the pass's stats and the replay's draws. */
function stand({ sun = false } = {}) {
  const g = recordingGl();
  const r = new Renderer(g.canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  for (const k of ['504_1', '504_2', '504_3', '182_1', '300_0']) r.textures.set(k, { id: `tex-${k}` });
  if (sun) r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  else r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0);
  const frame = (draw, lights = new Float32Array(0)) => {
    r.setPointLights(lights, new Float32Array([1, 1, 1]));
    g.calls.length = 0; g.draws.length = 0;
    r.beginFrame(I, I, LIGHT_DIR, WORLD_FRAME);
    const st = { ...sp.stats, draws: g.draws.slice(), calls: g.calls.slice() };
    draw();
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return st;
  };
  return { r, sp, g, frame };
}
/** How many times texture `id` was bound while a framebuffer of `fbos` was the target, in a frame's calls. */
function bindsIn(calls, fbos, id) {
  let fb = null, n = 0;
  for (const c of calls) {
    if (c[0] === 'bindFramebuffer' && (c[1] === 36160 || c[1] === 36009)) fb = c[2];
    if (c[0] === 'bindTexture' && c[2]?.id === id && fbos.includes(fb)) n++;
  }
  return n;
}
/** A deterministic generator (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A pixel-wide wood: `n` placements scattered over [-half, half]^2 about the origin, none within `clear` of `(cx, cz)`. */
function wood(rand, n, half, clear = 0, cx = 0, cz = 0) {
  const out = [];
  while (out.length < n) {
    const x = (rand() * 2 - 1) * half, z = (rand() * 2 - 1) * half;
    if (Math.hypot(x - cx, z - cz) >= clear) out.push([x, 0, z]);
  }
  return out;
}

// ── PERF-EXT1: a flat batch reaches a shadow by its placements ────────────

test('PERF-EXT1: a lantern is not held by a wood none of whose trees stands in its cube - a pixel-wide swaying batch whose 41 trees all stand 150+ units off costs no dynamic face, no blit and no bind in any lantern face (the base: six faces and six blits a sway beat); one tree moved beside the lamp, and it is drawn; one in a face CORNER past the far sphere, and it is still drawn (the cube, not the sphere)', () => {
  const lantern = new Float32Array([0, 3, 0, 18]);   // far 20
  const run = (centers, size = { w: 3, h: 7 }) => {
    const { r, sp, frame } = stand();
    const trees = r.createBillboardBatch(504, 1, size, centers);
    trees.sway = 1; trees.origin = [0, 0, 0];
    const draw = () => { r.setFlatWind([6, 2, 1, 1]); r.drawBillboards([trees], RIGHT, UP); };
    let faces = 0, blits = 0, binds = 0, dyn = 0;
    for (let f = 0; f < 14; f++) {
      const st = frame(draw, lantern);
      if (f >= 4) { faces += st.dynFaces; blits += st.blits; binds += bindsIn(st.calls, sp.pointFbos, 'tex-504_1'); dyn += st.pointDraws; }
    }
    return { faces, blits, binds, dyn, trees };
  };
  const far = wood(rng(1), 41, 400, 150);
  const none = run(far);
  assert.ok(none.trees.bounds[3] > 150, 'the batch\'s sphere reaches the lamp - the sphere test alone holds the slot');
  assert.equal(none.faces, 0, `no dynamic face for a wood out of reach (${none.faces})`);
  assert.equal(none.blits, 0, `no blit (${none.blits})`);
  assert.equal(none.binds, 0, `its texture never bound in a lantern face (${none.binds})`);
  // one tree at the lamp's foot: the same wood holds the slot on the sway's beat and lands in its faces
  const near = run([...far.slice(1), [4, 0, 1]]);
  assert.ok(near.faces > 0 && near.binds > 0, `a tree in reach redraws the slot and is drawn (${near.faces} faces, ${near.binds} binds)`);
  // the corner: a 1 x 3 quad 17 along +X and 14.5 along +Z of the lamp - 22.3 from it, past its far 20 and the 1.6
  // of its own radius, yet inside the +X face's frustum. A face draws there, so the slot must redraw for it (the
  // shadow lens's prover: the far SPHERE, the hunter's first cut, loses it).
  const corner = run([...far.slice(1), [17, 1.5, 14.5]], { w: 1, h: 3 });
  assert.ok(corner.faces > 0 && corner.binds > 0, `a tree in a face's corner is drawn, as the base drew it (${corner.faces} faces, ${corner.binds} binds)`);
});

test('PERF-EXT1: the sun\'s near cascades skip a pixel-wide batch whose trees all stand 150+ units from the eye - its texture bound in the far cascade alone (the base: every cascade drawn) - and keep one with a tree at the eye in every cascade', () => {
  const { r, sp, frame } = stand({ sun: true });
  const rand = rng(2);
  const far = r.createBillboardBatch(504, 1, { w: 3, h: 7 }, wood(rand, 41, 230, 150));
  const near = r.createBillboardBatch(504, 2, { w: 3, h: 7 }, [...wood(rand, 40, 230, 150), [1, 0, 1]]);
  far.origin = [0, 0, 0]; near.origin = [0, 0, 0];
  const draw = () => r.drawBillboards([far, near], RIGHT, UP);
  frame(draw);
  let farBinds = 0, nearBinds = 0, cascades = 0;
  for (let f = 0; f < 4; f++) {
    const st = frame(draw);
    cascades += st.cascadesDrawn;
    for (let c = 0; c < 3; c++) {
      farBinds += bindsIn(st.calls, [sp.sunFbos[c]], 'tex-504_1') && c < 2 ? 1 : 0;
      nearBinds += bindsIn(st.calls, [sp.sunFbos[c]], 'tex-504_2') ? 1 : 0;
    }
  }
  assert.equal(farBinds, 0, `the far wood is in neither near cascade (${farBinds})`);
  assert.equal(nearBinds, cascades, `the wood with a tree at the eye is in every cascade drawn (${nearBinds} of ${cascades})`);
});

test('PERF-EXT1: EVERY BATCH A REPLAY SKIPS BY ITS PLACEMENTS RASTERISES NOTHING - over random woods (sway, wind, origins, heights, sizes) replayed into the sun\'s three cascades and eight lanterns\' faces (their caches and their live layers), each quad of a batch the base would have drawn and this one did not, its corners placed as BB_VS places them at the gust\'s two extremes, lies wholly beyond one clip plane; and the skip happens (the base skips none)', () => {
  const rand = rng(3);
  const { r, sp, g, frame } = stand({ sun: true });
  const wind = [9 * (rand() * 2 - 1), 9 * (rand() * 2 - 1), 3.7, 1];
  const batches = [];
  for (let k = 0; k < 24; k++) {
    const size = { w: 0.5 + rand() * 4, h: 0.6 + rand() * 9 };
    const centers = wood(rand, 2 + Math.floor(rand() * 90), 40 + rand() * 300);
    for (const c of centers) c[1] = rand() * 6 - 3;
    const b = r.createBillboardBatch(504, 1 + (k % 3), size, centers);
    b.sway = k % 4 === 0 ? 0 : rand() * 1.2;   // a quarter still (the caches), the rest swaying (the live layers)
    b.origin = [(rand() * 2 - 1) * 50, rand() * 4 - 2, (rand() * 2 - 1) * 50];
    batches.push(b);
  }
  const lights = new Float32Array(8 * 4);
  for (let i = 0; i < 8; i++) lights.set([(rand() * 2 - 1) * 60, 1 + rand() * 4, (rand() * 2 - 1) * 60, 8 + rand() * 20], i * 4);
  const vaoOf = new Map(batches.map((b) => [b.vao, b]));
  // every replay the pass makes: its matrix, its light, its texel and filter, and the batches it drew
  const reps = [];
  const replay = sp.replay.bind(sp);
  sp.replay = (f, vp, lightPos, recordBasis, minRadius, texel, filter, self) => {
    const at = g.draws.length, right = [...sp._right];
    const n = replay(f, vp, lightPos, recordBasis, minRadius, texel, filter, self);
    const drawn = new Set(g.draws.slice(at).filter((d) => d[0] === sp.programs.bb.p && vaoOf.has(d[1])).map((d) => vaoOf.get(d[1])));
    reps.push({ vp: Float64Array.from(vp), light: lightPos ? [...lightPos] : null, texel, filter, drawn, right });
    return n;
  };
  const draw = () => { r.setFlatWind(wind); r.drawBillboards(batches, RIGHT, UP); };
  for (let f = 0; f < 6; f++) frame(draw, lights);
  const wl = Math.hypot(wind[0], wind[1]), wdir = [wind[0] / wl, wind[1] / wl];
  let checked = 0, skipped = 0, proven = 0;
  for (const { vp, light, texel, filter, drawn, right: sunRight } of reps) {
    const planes = bounds.spherePlanes(Float32Array.from(vp));
    const minH = texel > 0 ? Math.max(0.5, texel * 4) : 0.5;
    for (const b of batches) {
      if (filter !== 0 && (filter === 1) === !!b._shDyn) continue;   // the base's own reasons: the filter, the height, the sphere
      if (b.size.h < minH || !bounds.batchVisible(planes, b)) continue;
      checked++;
      if (drawn.has(b)) continue;
      skipped++;
      const o = b.origin, w = b.size.w, h = b.size.h;
      let right = sunRight;
      if (light) { const dx = light[0] - o[0], dz = light[2] - o[2], l = Math.hypot(dx, dz) || 1; right = [dz / l, 0, -dx / l]; }
      const pts = b._place.pts;
      for (let i = 0; i < pts.length; i += 3) {
        const root = [pts[i] + o[0], pts[i + 1] + o[1], pts[i + 2] + o[2]];
        const outs = [0, 0, 0, 0, 0, 0];
        for (const gust of [0, 1]) {
          const push = b.sway > 0 ? wl * (0.55 + gust * 0.75) * 0.0015 * b.sway : 0;
          for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
            const top = cy + 0.5;
            const p = [root[0] + right[0] * cx * w + wdir[0] * push * top * top * h, root[1] + top * h, root[2] + right[2] * cx * w + wdir[1] * push * top * top * h];
            const X = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], Y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
            const Z = vp[2] * p[0] + vp[6] * p[1] + vp[10] * p[2] + vp[14], W = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
            if (X < -W) outs[0]++; if (X > W) outs[1]++; if (Y < -W) outs[2]++; if (Y > W) outs[3]++; if (Z < -W) outs[4]++; if (Z > W) outs[5]++;
          }
        }
        assert.ok(outs.some((n) => n === 8), `a skipped quad of batch ${b.record} at (${pts[i]}, ${pts[i + 1]}, ${pts[i + 2]}) lies wholly beyond one plane: ${outs}`);
        proven++;
      }
    }
  }
  assert.ok(reps.some((x) => x.light) && reps.some((x) => !x.light), `the sun's cascades and the lanterns' faces were both replayed (${reps.length})`);
  assert.ok(checked > 200, `the replays were read (${checked} batch-volume pairs)`);
  assert.ok(skipped > 50 && proven > 500, `and the placements skipped batches the sphere kept (${skipped} batches, ${proven} quads proven out)`);
});

test('PERF-EXT1: the grid is the STATIC batch\'s alone - every placement once, as the float32 the vertex buffer holds, each cell\'s sphere around its own; none for one flat or a batch built dynamic; a move and a free drop it; and a batch moved into reach still casts where it now is, in a sun cascade and a lantern face (the draw lens\'s prover: a grid kept past a move lost a gib\'s shadow)', () => {
  const { r, sp, frame } = stand({ sun: true });
  const rand = rng(4);
  const centers = wood(rand, 300, 400);
  const b = r.createBillboardBatch(504, 1, { w: 2, h: 5 }, centers);
  const q = b._place;
  assert.ok(q && q.G === bounds.PLACEMENT_GRID, `a static batch of 300 carries its grid (G ${q?.G})`);
  assert.equal(r.createBillboardBatch(504, 1, { w: 2, h: 5 }, centers.slice(0, bounds.PLACEMENT_ONE_CELL))._place.G, 1, 'sixteen or fewer: one cell');
  assert.equal(q.start[q.G * q.G], 300, 'every placement filed');
  const want = centers.map((c) => Array.from(Float32Array.from(c)).join()).sort();
  const got = []; for (let i = 0; i < q.pts.length; i += 3) got.push(Array.from(q.pts.subarray(i, i + 3)).join());
  assert.deepEqual(got.sort(), want, 'each once, at the float32 the GPU reads');
  for (let k = 0; k < q.G * q.G; k++) {
    for (let i = q.start[k] * 3; i < q.start[k + 1] * 3; i += 3) {
      assert.ok(Math.hypot(q.pts[i] - q.cs[k * 4], q.pts[i + 1] - q.cs[k * 4 + 1], q.pts[i + 2] - q.cs[k * 4 + 2]) <= q.cs[k * 4 + 3], `cell ${k}'s sphere holds its placements`);
    }
  }
  assert.equal(r.createBillboardBatch(504, 1, { w: 2, h: 5 }, [[0, 0, 0]])._place, null, 'one flat: its sphere is its quad');
  assert.equal(r.createBillboardBatch(504, 1, { w: 2, h: 5 }, centers, { dynamic: true })._place, null, 'a batch whose centres move has none');
  // a STATIC batch built 300 units off and moved to the lamp's foot and the eye's: judged where it is
  const born = [0, 1, 2, 3, 4].map((i) => [300 + i, 0, 300]);
  const flown = r.createBillboardBatch(504, 3, { w: 0.8, h: 1.2 }, born);
  assert.ok(flown._place, 'born with a grid');
  r.moveBillboardBatch(flown, [0, 1, 2, 3, 4].map((i) => [1 + i * 0.3, 0, 1]));
  assert.equal(flown._place, null, 'a move drops it');
  const gib = r.createBillboardBatch(504, 2, { w: 0.8, h: 1.2 }, born, { dynamic: true });
  r.moveBillboardBatch(gib, [0, 1, 2, 3, 4].map((i) => [1 + i * 0.3, 0, -1]));
  const draw = () => r.drawBillboards([flown, gib], RIGHT, UP);
  const lamp = new Float32Array([0, 2, 0, 14]);
  frame(draw, lamp);
  let sun3 = 0, face3 = 0, sun2 = 0, face2 = 0;
  for (let f = 0; f < 3; f++) {
    const st = frame(draw, lamp);
    sun3 += bindsIn(st.calls, sp.sunFbos, 'tex-504_3'); face3 += bindsIn(st.calls, [...sp.pointFbos, ...sp.cacheFbos], 'tex-504_3');
    sun2 += bindsIn(st.calls, sp.sunFbos, 'tex-504_2'); face2 += bindsIn(st.calls, [...sp.pointFbos, ...sp.cacheFbos], 'tex-504_2');
  }
  assert.ok(sun3 > 0 && face3 > 0, `the moved batch casts in a cascade (${sun3}) and a lantern face (${face3})`);
  assert.ok(sun2 > 0 && face2 > 0, `the gib too (${sun2}, ${face2})`);
  r.destroyBillboardBatch(b);
  assert.equal(b._place, null, 'and a free takes the grid with the batch');
});

test('PERF-EXT1: THE REACH QUERY IS THE CELLS\', NOT A SCAN - a 10,000-tree batch across a pixel: twenty lanterns in and about it and the sun\'s two near cascades answer what a scan of every placement answers, reading under a third of what the scan reads', () => {
  const { r } = stand();
  const rand = rng(5);
  const centers = wood(rand, 10000, 409.6);
  const b = r.createBillboardBatch(504, 1, { w: 3, h: 7 }, centers);
  b.origin = [0, 0, 0];
  assert.ok(b._place, 'the wood carries its placements');
  let reads = 0;
  const pts = b._place.pts;
  b._place.pts = new Proxy(pts, { get(t, k) { if (typeof k === 'string' && /^\d+$/.test(k)) reads++; const v = Reflect.get(t, k, t); return typeof v === 'function' ? v.bind(t) : v; } });
  const rad = bounds.placementRadius(bounds.quadHalfDiagonal(b.size), 0);
  const scan = 3 * centers.length;
  let total = 0, queries = 0;
  for (let k = 0; k < 20; k++) {
    const L = [(rand() * 2 - 1) * 520, 3, (rand() * 2 - 1) * 520], R = 20 + rad;
    reads = 0;
    const hit = bounds.placementsInCube(b, rad, L[0], L[1], L[2], 20);
    assert.equal(hit, centers.some((c) => Math.abs(c[0] - L[0]) <= R && Math.abs(c[1] + 3.5 - L[1]) <= R && Math.abs(c[2] - L[2]) <= R), `the cube at ${L}: the scan's answer`);
    total += reads; queries++;
  }
  const vps = sunCascadeMatrices([100, 1.7, -50], [0.45, 0.8, 0.35], [0, 1, 2].map(() => new Float32Array(16)));
  for (const vp of [vps[0], vps[1]]) {
    const planes = bounds.spherePlanes(vp);
    reads = 0;
    const hit = bounds.placementsInVolume(b, rad, planes);
    assert.equal(hit, centers.some((c) => bounds.sphereInPlanes(planes, c[0], c[1] + 3.5, c[2], rad)), 'a near cascade: the scan\'s answer');
    total += reads; queries++;
  }
  assert.ok(total < queries * scan / 3, `${queries} queries read ${total} floats; a scan reads ${queries * scan}`);
  // a cascade about an eye well off the wood: every cell's sphere misses it, and no placement is read at all
  const off = bounds.spherePlanes(sunCascadeMatrices([900, 1.7, 0], [0.45, 0.8, 0.35], [0, 1, 2].map(() => new Float32Array(16)))[0]);
  reads = 0;
  assert.equal(bounds.placementsInVolume(b, rad, off), false, 'nothing of the wood in a cascade 900 off');
  assert.equal(reads, 0, `and the cells said so without a placement read (${reads})`);
});

test('PERF-EXT1: a still wood with no tree in a lantern\'s cube is not in its static set - the host dropping it (culled, streamed out) rebuilds no cache (the base: six faces, its sphere counted); a wood with one tree by the lamp is, and does', () => {
  const run = (centers) => {
    const { r, frame } = stand();
    const trees = r.createBillboardBatch(504, 1, { w: 3, h: 7 }, centers);
    trees.origin = [0, 0, 0];   // no sway: a still wood, the cache's
    const post = { vao: { id: 'vao-post' }, buffers: [], bounds: new Float32Array([0, 1, 0, 1.5]), subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 12 }] };
    const at = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 1, 1]);
    let list = [trees];
    const draw = () => { r.drawMesh(post, at, null); r.drawBillboards(list, RIGHT, UP); };
    const lamp = new Float32Array([0, 3, 0, 18]);
    for (let f = 0; f < 4; f++) frame(draw, lamp);
    list = [];
    let rebuilt = 0;
    for (let f = 0; f < 3; f++) rebuilt += frame(draw, lamp).staticFaces;
    return rebuilt;
  };
  const far = wood(rng(6), 41, 400, 150);
  assert.equal(run(far), 0, 'a wood out of reach leaves the set without a rebuild');
  assert.equal(run([...far.slice(1), [3, 0, -2]]), 6, 'one in reach leaves it with one');
});

test('PERF-EXT1: WHAT MOVES, SAID EXACTLY - a lantern beside a distant wood behaves in wind as it does in calm, frame for frame (dynamic faces, blits, point draws, static faces): a walker leaving its reach is erased the next frame, as calm erases it, not held to the sway\'s next beat; the base in wind redraws on the beat for a wood none of whose trees is in reach', () => {
  const trace = (wind) => {
    const { r, frame } = stand();
    const trees = r.createBillboardBatch(504, 1, { w: 3, h: 7 }, wood(rng(7), 41, 400, 150));
    trees.sway = 1; trees.origin = [0, 0, 0];
    const walker = r.createBillboardBatch(182, 1, { w: 0.9, h: 1.8 }, [[0, 0, 0]]);
    walker.origin = [5, 0, 0];
    const draw = () => { r.setFlatWind(wind); r.drawBillboards([trees, walker], RIGHT, UP); };
    const lamp = new Float32Array([0, 3, 0, 18]);
    const out = [];
    for (let f = 0; f < 40; f++) {
      const st = frame(draw, lamp);
      out.push([st.dynFaces, st.blits, st.pointDraws, st.staticFaces].join('/'));
      walker.origin = [5 + f * 1.5, 0, 0];   // out of reach at about the twelfth frame
    }
    return out;
  };
  assert.deepEqual(trace([8, 2, 1, 1]), trace([0, 0, 1, 1]), 'the wind\'s wood changes nothing a lantern out of its reach does');
});

test('PERF-EXT1: THE BOUND IS BB_VS\'S - a crown the lift alone carries into a lantern\'s cube (a 24-unit tree 40 below the lamp) and a wide quad the wind alone can lean into it (0.07 of lean, 0.03 past the still bound) each hold the slot; nudged out of reach, neither does', () => {
  const run = (size, centers, lamp, wind, sway) => {
    const { r, frame } = stand();
    const b = r.createBillboardBatch(504, 1, size, [...centers, [-300, 0, lamp[2]]]);
    b.sway = sway; b.origin = [0, 0, 0];
    const draw = () => { r.setFlatWind(wind); r.drawBillboards([b], RIGHT, UP); };
    let faces = 0;
    for (let f = 0; f < 10; f++) { const st = frame(draw, new Float32Array(lamp)); if (f >= 2) faces += st.dynFaces; }
    return faces;
  };
  // the lift: the lamp at y 40 (range 18, far 20: the cube from y 20); the tree stands 0..24, so only its crown is in
  // reach - its base 40 below the lamp is not, and a quad sphere left at its base would miss by 7.8
  const tall = { w: 1, h: 24 };
  assert.ok(run(tall, [[5, 0, 0]], [0, 40, 0, 18], [8, 0, 1, 1], 1) > 0, 'the crown in reach holds the slot');
  assert.equal(run(tall, [[5, -5, 0]], [0, 40, 0, 18], [8, 0, 1, 1], 1), 0, 'five lower, the crown is out of reach too');
  // the lean: the lamp faces the batch from 100 along -z, so each quad's width runs along x, and a wind along -x leans
  // its crown toward the lamp by up to wl * 1.3 * 0.0015 * sway * h (0.0702 here); the quad at x 25.05 is 0.025 past
  // the still sphere's reach (20 + hypot(10, 1) / 2) and inside the leaning one
  const wide = { w: 10, h: 1 };
  assert.ok(run(wide, [[25.05, 0, -100]], [0, 0, -100, 18], [-30, 0, 1, 1], 1.2) > 0, 'a quad the wind can lean into the cube holds the slot');
  assert.equal(run(wide, [[25.2, 0, -100]], [0, 0, -100, 18], [-30, 0, 1, 1], 1.2), 0, 'past the lean\'s reach it does not');
  assert.ok(Math.abs(swayLean(30, 1.2, 1) - 0.0702) < 1e-9, 'the lean this pin is built on');
});

// ── PERF-EXT2: a run of sub-meshes is one depth draw ──────────────────────

/** A box of `s` at (x, y, z) in createMesh's CPU shape, one sub-mesh on (archive, record). */
function box(x, y, z, s, archive, record) {
  const positions = [], normals = [], uvs = [], indices = [];
  for (let i = 0; i < 8; i++) { positions.push(x + (i & 1 ? s : -s), y + (i & 2 ? s : -s), z + (i & 4 ? s : -s)); normals.push(0, 1, 0); uvs.push(0, 0); }
  for (const [a, b, c, d] of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) indices.push(a, b, c, a, c, d);
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint32Array(indices), subMeshes: [{ textureArchive: archive, textureRecord: record, startIndex: 0, primitiveCount: 12 }] };
}
/** Every replay the pass makes, with the mesh draws it made: [count, byte offset] per drawElements on the mesh program. */
function watchReplays(sp, g) {
  const reps = [];
  const replay = sp.replay.bind(sp);
  sp.replay = (...a) => {
    const at = g.draws.length;
    const n = replay(...a);
    reps.push({ vp: Float32Array.from(a[1]), light: a[2], minRadius: a[4], filter: a[6], mesh: g.draws.slice(at).filter((d) => d[0] === sp.programs.mesh.p).map((d) => [d[1], d[3], d[4]]) });
    return n;
  };
  return reps;
}

test('PERF-EXT2: a pixel\'s static batch of thirty texture groups (StaticBatchBuilder, createMesh - the producer\'s own shape) is ONE depth draw a cascade over its whole index range from 0 (the base: thirty a cascade); with its middle group out of a cascade, two draws at the exact ranges either side', () => {
  const { r, sp, g, frame } = stand({ sun: true });
  const sb = new StaticBatchBuilder();
  for (let k = 0; k < 30; k++) sb.add(box((k % 6) - 2.5, 0.5, Math.floor(k / 6) - 2, 0.3, 300, k), I, keyResolver(null));
  const merged = sb.finish();
  assert.equal(merged.subMeshes.length, 30, 'thirty groups, end to end');
  const mesh = r.createMesh(merged);
  const reps = watchReplays(sp, g);
  const draw = () => r.drawMesh(mesh, I, null);
  frame(draw); frame(draw);
  const sun = reps.filter((x) => !x.light);
  assert.ok(sun.length >= 2, `the cascades replayed (${sun.length})`);
  for (const x of sun) assert.deepEqual(x.mesh.map((d) => [d[1], d[2]]), [[merged.triangles * 3, 0]], 'one draw, every index, from 0');
  // three groups of 200 triangles, the middle one's sphere 1,000 off: two runs, [0, 600) and [1200, 1800)
  const sub = (k, far) => ({ textureArchive: 300, textureRecord: k, startIndex: k * 600, primitiveCount: 200, _bounds: new Float32Array(far ? [1000, 0, 1000, 1] : [0, 1, 0, 1]) });
  const gap = { vao: { id: 'vao-gap' }, buffers: [], bounds: new Float32Array([0, 1, 0, 2000]), subMeshes: [sub(0, false), sub(1, true), sub(2, false)] };
  reps.length = 0;
  const draw2 = () => r.drawMesh(gap, I, null);
  frame(draw2); frame(draw2);
  const gapSun = reps.filter((y) => !y.light && y.mesh.some((d) => d[0] === gap.vao));
  assert.ok(gapSun.length >= 2, `the cascades replayed it (${gapSun.length})`);
  for (const x of gapSun) assert.deepEqual(x.mesh.filter((d) => d[0] === gap.vao).map((d) => [d[1], d[2] / 4]), [[600, 0], [600, 1200]], 'the run breaks at the culled group, the ranges exact');
});

test('PERF-EXT2: EVERY REPLAY DRAWS EXACTLY THE VISIBLE SUB-MESHES\' TRIANGLES - over random meshes (runs that meet, gaps between them, empty groups, spheres in and out of each volume) replayed into the sun\'s cascades and eight lanterns\' faces, the triangles each replay drew are, as a multiset, the ones its visible sub-meshes hold; and in fewer draws than sub-meshes (the base: one a sub-mesh)', () => {
  const rand = rng(8);
  const { r, sp, g, frame } = stand({ sun: true });
  const meshes = [];
  for (let m = 0; m < 12; m++) {
    const subs = [];
    let at = 0;
    for (let k = 0; k < 4 + Math.floor(rand() * 20); k++) {
      if (rand() < 0.2) at += 3 * (1 + Math.floor(rand() * 5));   // a gap: this group does not start where the last ended
      const prims = rand() < 0.1 ? 0 : 1 + Math.floor(rand() * 40);
      const out = rand() < 0.3;
      subs.push({ textureArchive: 300, textureRecord: k, startIndex: at, primitiveCount: prims, _bounds: new Float32Array([(rand() * 2 - 1) * (out ? 600 : 30), rand() * 4, (rand() * 2 - 1) * (out ? 600 : 30), 0.5 + rand() * 4]) });
      at += prims * 3;
    }
    meshes.push({ vao: { id: `vao-r${m}` }, buffers: [], bounds: new Float32Array([0, 2, 0, 900]), subMeshes: subs });
  }
  const lights = new Float32Array(8 * 4);
  for (let i = 0; i < 8; i++) lights.set([(rand() * 2 - 1) * 30, 1 + rand() * 3, (rand() * 2 - 1) * 30, 8 + rand() * 12], i * 4);
  const reps = watchReplays(sp, g);
  const draw = () => { for (const m of meshes) r.drawMesh(m, I, null); };
  for (let f = 0; f < 3; f++) frame(draw, lights);
  let checked = 0, drawn = 0, subsDrawn = 0;
  for (const x of reps) {
    if (x.filter === 2) continue;   // a lantern's live layers draw the movers; these meshes are still, the caches' and the cascades'
    const planes = bounds.spherePlanes(x.vp);
    for (const m of meshes) {
      const rec = { bounded: true, sphere: m.bounds, subSpheres: new Float32Array(m.subMeshes.flatMap((s) => [...s._bounds])) };
      const want = [];
      if (bounds.sphereInPlanes(planes, 0, 2, 0, 900)) m.subMeshes.forEach((s, k) => { if (bounds.subMeshVisible(planes, rec, k)) { subsDrawn++; for (let t = 0; t < s.primitiveCount; t++) want.push(s.startIndex + t * 3); } });
      const got = [];
      for (const [vao, n, off] of x.mesh) if (vao === m.vao) { drawn++; for (let t = 0; t < n / 3; t++) got.push(off / 4 + t * 3); }
      assert.deepEqual(got.sort((a, b) => a - b), want.sort((a, b) => a - b), `mesh ${m.vao.id}: the triangles drawn are the visible sub-meshes'`);
      checked++;
    }
  }
  assert.ok(checked > 100, `replays read (${checked} mesh-volume pairs)`);
  assert.ok(drawn <= subsDrawn * 0.75, `and in fewer draws: ${drawn} for ${subsDrawn} visible sub-meshes`);
});

// ── PERF-EXT3: every lantern's static signature in one walk ───────────────

/** THE BASE'S WALK, one lantern at a time - SC1's static signature with PERF-EXT1's cube, transcribed: the oracle the
 *  one walk must answer as. `name` gives an item its id, as the pass's shId does on the item's first fold. */
function signatureAlone(sp, x, y, z, far, name) {
  let h = 0, n = 0;
  const c = new Float64Array(4);
  for (let i = 0; i < sp.count; i++) {
    const r = sp.records[i];
    if (r.kind === 2) {   // REC_BB
      const wl = Math.hypot(r.flatWind[0], r.flatWind[1]);
      for (const b of r.batches) {
        if (!b?.vao || b._dead || b._shDyn || b.noShadow || b.conceal || b.archive === SHADOW_LIGHT_FLATS || SHADOW_NO_CAST_ARCHIVES.has(b.archive)) continue;
        const s = bounds.batchSphere(b, c);
        if (s && !spheresTouch(s[0], s[1], s[2], s[3], x, y, z, far)) continue;
        if (b._place) { const bh = b.size.h; if (!bounds.placementsInCube(b, bounds.placementRadius(bounds.quadHalfDiagonal(b.size), b.sway > 0 ? swayLean(wl, b.sway, bh < 0 ? -bh : bh) : 0), x, y, z, far)) continue; }
        h = foldSignature(h, name(b)); h = foldSignature(h, Math.round(b._shOx * 64) + Math.round(b._shOz * 64) * 7919); n++;
      }
      continue;
    }
    if (r.dynamic) continue;
    const m = r.kind === 1 ? r.surface : r.mesh;   // REC_TERRAIN
    if (!m?.vao || m._dead) continue;
    if (r.bounded && !spheresTouch(r.sphere[0], r.sphere[1], r.sphere[2], r.sphere[3], x, y, z, far)) continue;
    h = foldSignature(h, name(m)); h = foldSignature(h, Math.round(r.matrix[12] * 64) + Math.round(r.matrix[14] * 64) * 7919 + Math.round(r.matrix[13] * 64) * 104729); n++;
  }
  return [h, n];
}
/** A mesh bundle of one bounded sub-mesh (the replay needs a VAO and a range). */
const meshAt = (id, radius) => ({ vao: { id }, buffers: [], bounds: radius > 0 ? new Float32Array([0, 1, 0, radius]) : null, subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 12, _bounds: radius > 0 ? new Float32Array([0, 1, 0, radius]) : undefined }] });
/** `b.bounds` behind a getter that counts, while `on()` says so. */
function countBounds(b, on, counter) {
  let v = b.bounds;
  Object.defineProperty(b, 'bounds', { get() { if (on()) counter.n++; return v; }, set(x) { v = x; }, configurable: true, enumerable: true });
}

test('PERF-EXT3: EIGHT LANTERNS, ONE WALK - on a still night with every cache valid, the shadow pass reads each still flat\'s bounds as often under eight lanterns as under one (the base: once a lantern - eight whole walks of the records a frame), and the eight slots still answer from their caches', () => {
  const run = (nLights) => {
    const { r, sp, frame } = stand();
    const rand = rng(9);
    const flats = [];
    for (let i = 0; i < 60; i++) {
      const b = r.createBillboardBatch(504, 1 + (i % 3), { w: 1, h: 2 }, [[(rand() * 2 - 1) * 20, 0, (rand() * 2 - 1) * 20]]);
      b.origin = [0, 0, 0];
      flats.push(b);
    }
    let inPass = false;
    const counter = { n: 0 };
    for (const b of flats) countBounds(b, () => inPass, counter);
    const render = sp.render.bind(sp);
    sp.render = (f) => { inPass = true; try { return render(f); } finally { inPass = false; } };
    const lights = new Float32Array(nLights * 4);
    for (let k = 0; k < nLights; k++) lights.set([(k % 4) * 6 - 9, 2, Math.floor(k / 4) * 6 - 3, 12], k * 4);
    const draw = () => r.drawBillboards(flats, RIGHT, UP);
    for (let f = 0; f < 6; f++) frame(draw, lights);
    counter.n = 0;
    const st = frame(draw, lights);
    return { reads: counter.n, st };
  };
  const one = run(1), eight = run(8);
  assert.equal(one.st.cachedSlots, 1); assert.equal(eight.st.cachedSlots, 8, 'eight lanterns, every one served from its cache');
  assert.equal(eight.st.staticFaces, 0, 'nothing redrawn');
  assert.ok(one.reads >= 60, `one lantern: every still flat's sphere asked (${one.reads})`);
  assert.equal(eight.reads, one.reads, `eight lanterns read the flats' bounds ${eight.reads} times, one lantern ${one.reads}: one walk`);
});

test('PERF-EXT3: THE ONE WALK ANSWERS AS THE WALK A LANTERN - over 200 random frames of records (still, moving, swaying, dead, noShadow, concealed, no-cast and light flats, unbounded batches, pixel-wide woods with their placements; still, moving and unbounded meshes and terrain) and one to eight random lanterns, every lantern\'s (hash, count) from ONE call is exactly the base\'s walk of that lantern alone, over the same items (the walk names every item the oracle folds)', () => {
  const { r, sp } = stand();
  const rand = rng(10);
  const flats = [];
  for (let i = 0; i < 160; i++) {
    const n = i % 5 === 0 ? 20 + Math.floor(rand() * 40) : 1;
    const cs = n > 1 ? wood(rand, n, 60) : [[rand() * 80 - 40, 0, rand() * 80 - 40]];
    const b = r.createBillboardBatch([504, 182, 210, 216, 504][i % 5 === 0 ? 0 : i % 5], i % 9, { w: 1 + rand() * 3, h: (i % 13 === 0 ? -1 : 1) * (1 + rand() * 6) }, cs);
    b.origin = [rand() * 10, 0, rand() * 10];
    if (i % 3 === 0) b.sway = rand();
    if (i % 17 === 0) b.noShadow = true;
    if (i % 23 === 0) b.conceal = { mode: 1, alpha: 0.5, t: 0, phase: 0 };
    if (i % 29 === 0) b._dead = true;
    if (i % 7 === 3) b.bounds = null;
    flats.push(b);
  }
  const meshes = [];
  for (let i = 0; i < 50; i++) { const m = meshAt(`vao-m${i}`, i % 11 === 0 ? 0 : 2 + rand() * 10); const at = I.slice(); at[12] = rand() * 80 - 40; at[13] = rand() * 4; at[14] = rand() * 80 - 40; meshes.push({ m, at }); }
  const tile = { vao: { id: 'vao-tile' }, indexCount: 6, bounds: new Float32Array([0, 0, 0, 30]) };
  const cp = new Float64Array(32), out = new Int32Array(16);
  let compared = 0, folded = 0;
  for (let frame = 0; frame < 200; frame++) {
    sp.discard(); sp.frameNo++;
    const lists = [[], [], []];
    for (const b of flats) if (rand() < 0.8) lists[Math.floor(rand() * 3)].push(b);
    for (const b of flats) if (rand() < 0.05) b.origin[0] += 0.5;   // a few move
    for (const L of lists) sp.recordBillboards(L, rand() < 0.5 ? new Float32Array([rand() * 12, rand() * 4, 1, 1]) : null, RIGHT, UP);
    for (const { m, at } of meshes) if (rand() < 0.7) { if (rand() < 0.1) at[12] += 0.3; sp.recordMesh(m, at, null); }
    if (rand() < 0.5) sp.recordTerrain(tile, I, null, null, 6.4);
    const nC = 1 + Math.floor(rand() * 8);
    for (let k = 0; k < nC; k++) cp.set([rand() * 80 - 40, rand() * 5, rand() * 80 - 40, shadowFarFor(4 + rand() * 20)], k * 4);
    sp._staticSignatures(cp, nC, out, true);   // by the quads, as outside a room drawn whole (the review)
    for (let k = 0; k < nC; k++) {
      const [h, n] = signatureAlone(sp, cp[k * 4], cp[k * 4 + 1], cp[k * 4 + 2], cp[k * 4 + 3], (o) => { assert.ok(o._shId > 0, 'an item the lantern folds was named by the walk'); return o._shId; });
      assert.equal(out[k * 2 + 1], n, `frame ${frame}, lantern ${k}: the count`);
      assert.equal(out[k * 2], h, `frame ${frame}, lantern ${k}: the hash`);
      compared++; folded += n;
    }
  }
  assert.ok(compared > 700 && folded > 3000, `${compared} signatures compared over ${folded} folds`);
});

test('PERF-EXT3: THE SAME CACHE, FRAME FOR FRAME - a scripted night of 120 frames (a walker crossing the lamps and stopping, a lantern lit nearest of all - rank 0 in the last slot, a wood hidden and shown, a crate moved, a batch freed) replayed through the pass - which asks ONCE a frame, for every lit lantern (the base: once a lantern) - and through a twin whose signatures are the base\'s walk, lantern by lantern: every frame\'s static faces, dynamic faces, blits, cached slots, point draws and the slots whose caches were drawn agree', () => {
  const build = () => {
    const { r, sp, frame } = stand();
    const rand = rng(11);
    const flats = [];
    for (let i = 0; i < 40; i++) { const b = r.createBillboardBatch(504, 1 + (i % 3), { w: 1, h: 2 }, [[rand() * 50 - 25, 0, rand() * 50 - 25]]); b.origin = [0, 0, 0]; flats.push(b); }
    const still = r.createBillboardBatch(504, 1, { w: 3, h: 7 }, wood(rand, 60, 200, 0));
    still.origin = [0, 0, 0];
    const sway = r.createBillboardBatch(504, 2, { w: 3, h: 7 }, wood(rand, 60, 200, 0));
    sway.sway = 1; sway.origin = [0, 0, 0];
    const walker = r.createBillboardBatch(182, 1, { w: 0.9, h: 1.8 }, [[0, 0, 0]]);
    walker.origin = [-30, 0, 2];
    const room = meshAt('vao-room', 12), crate = meshAt('vao-crate', 1);
    const crateAt = I.slice(); crateAt[12] = 3; crateAt[14] = 3;
    return { r, sp, frame, flats, still, sway, walker, room, crate, crateAt };
  };
  const script = (w) => {
    const lamps = [[-12, 3, -8], [0, 3, -8], [12, 3, -8], [-12, 3, 8], [0, 3, 8], [12, 3, 8], [24, 3, 0], [2, 3, -1]];   // the eighth, lit late, the nearest: rank 0 in slot 7 - a rank is no slot
    const out = [];
    for (let f = 0; f < 120; f++) {
      const lit = f < 40 ? 7 : 8;   // a lantern lit at frame 40
      const lights = new Float32Array(lit * 4);
      for (let k = 0; k < lit; k++) lights.set([...lamps[k], 14], k * 4);
      if (f >= 10 && f < 50) w.walker.origin = [-30 + (f - 10) * 1.2, 0, 2];   // crosses, then stands (the hold, then the cache)
      if (f >= 55 && f < 60) w.crateAt[12] += 0.5;   // the crate shoved
      if (f === 100) w.r.destroyBillboardBatch(w.flats[5]);
      const hidden = f >= 70 && f < 90;   // the wood culled away and back
      const draw = () => {
        w.r.setFlatWind([6, 2, 1, 1]);
        w.r.drawMesh(w.room, I, null); w.r.drawMesh(w.crate, w.crateAt, null);
        w.r.drawBillboards([...w.flats.filter((b) => !b._dead), ...(hidden ? [] : [w.still]), w.sway, w.walker], RIGHT, UP);
      };
      const st = w.frame(draw, lights);
      const rebuilt = new Set();   // the slots whose cache was drawn: a static face's framebuffer bound as the target
      for (const c of st.calls) if (c[0] === 'bindFramebuffer' && c[1] === 36160 && w.sp.cacheFbos.includes(c[2])) rebuilt.add(Math.floor(w.sp.cacheFbos.indexOf(c[2]) / 6));
      out.push([st.staticFaces, st.dynFaces, st.blits, st.cachedSlots, st.pointDraws, [...rebuilt].join('+')].join('/'));
    }
    return out;
  };
  const w = build(), twin = build();
  // the twin asks as the base did: each ranked caster's own light (DISC6's held list is this frame's casters in rank
  // order) at the shadow's far - never the pass's gathered (x, y, z, far)
  let twinIds = 1e6;
  twin.sp._staticSignatures = function (_cp, nC, sig) {
    const held = this._heldCasters;
    for (let k = 0; k < nC; k++) {
      const [h, n] = signatureAlone(this, held[k * 4], held[k * 4 + 1], held[k * 4 + 2], shadowFarFor(14), (o) => (o._shId ??= ++twinIds));
      sig[k * 2] = h; sig[k * 2 + 1] = n;
    }
  };
  const asks = [];
  const ask = w.sp._staticSignatures.bind(w.sp);
  w.sp._staticSignatures = (cp, nC, sig, quads) => {
    asks.push(nC);
    for (let k = 0; k < nC; k++) assert.deepEqual([...cp.subarray(k * 4, k * 4 + 4)], [...w.sp._heldCasters.subarray(k * 4, k * 4 + 3), shadowFarFor(14)], 'each rank asked at its own light and the shadow\'s far');
    assert.notEqual(quads, false, 'a street is asked by its quads (the review: only a room drawn whole by the sphere)');
    return ask(cp, nC, sig, quads);
  };
  const a = script(w), b = script(twin);
  assert.deepEqual(asks, [...new Array(39).fill(7), ...new Array(80).fill(8)], 'one ask a frame, for every lit lantern at once (the first frame has no records to replay)');
  assert.deepEqual(a, b, 'the one walk and the walk a lantern keep the same caches');
  // and what the twin cannot say, sharing the rank loop: the lantern lit nearest of all takes rank 0 in the last slot,
  // and ITS cache alone is drawn - each slot reads its own light's signature, not the one at its index
  const [lit0, , , , , litSlots] = a[40].split('/');
  assert.equal(`${lit0} ${litSlots}`, '6 7', `the frame the lantern is lit, its own slot's six faces alone (${a[40]})`);
  const rebuilds = a.filter((x) => Number(x.split('/')[0]) > 0).length;
  assert.ok(rebuilds >= 5, `the night rebuilt caches on ${rebuilds} frames (the lantern lit, the walker stopping, the wood, the crate, the free)`);
});

// ── PERF-EXT4: a recorded mesh's matrix scale, once ────────────────────────

test('PERF-EXT4: A MATRIX\'S SCALE ONCE A RECORD - recording a mesh of forty bounded sub-meshes (and one without bounds) under a rotated, non-uniformly scaled, translated matrix takes exactly three Math.hypot (the base: three a sphere, 123), and its sphere and every sub-mesh\'s are, bit for bit, the base\'s transform (the centre through the matrix, the radius by the longest column, by Math.hypot)', () => {
  const { sp } = stand();
  const rand = rng(12);
  // a rotation about an oblique axis, the columns scaled 0.8 / 2.5 / 1.3 (the y column the longest), a translation
  const ax = [0.36, 0.48, 0.8], th = 0.7, c = Math.cos(th), s = Math.sin(th), t = 1 - c;
  const R = [[t * ax[0] * ax[0] + c, t * ax[0] * ax[1] - s * ax[2], t * ax[0] * ax[2] + s * ax[1]], [t * ax[0] * ax[1] + s * ax[2], t * ax[1] * ax[1] + c, t * ax[1] * ax[2] - s * ax[0]], [t * ax[0] * ax[2] - s * ax[1], t * ax[1] * ax[2] + s * ax[0], t * ax[2] * ax[2] + c]];
  const S = [0.8, 2.5, 1.3];
  const m = new Float32Array(16);
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) m[col * 4 + row] = R[row][col] * S[col];
  m[12] = 812.25; m[13] = -3.5; m[14] = -409.6; m[15] = 1;
  const subMeshes = [];
  for (let k = 0; k < 41; k++) subMeshes.push({ textureArchive: 300, textureRecord: k, startIndex: k * 36, primitiveCount: 12, _bounds: k === 17 ? undefined : new Float32Array([rand() * 40 - 20, rand() * 8, rand() * 40 - 20, 0.5 + rand() * 6]) });
  const mesh = { vao: { id: 'vao-scaled' }, buffers: [], bounds: new Float32Array([0.5, 4, -1.25, 31.7]), subMeshes };
  const hypot = Math.hypot;
  let calls = 0;
  Math.hypot = (...a) => { calls++; return hypot(...a); };
  try { sp.recordMesh(mesh, m, null); } finally { Math.hypot = hypot; }
  assert.equal(calls, 3, `one scale for the record's 41 spheres: ${calls} Math.hypot`);
  const r = sp.records[sp.count - 1];
  assert.equal(r.mesh, mesh);
  // the base's transform, transcribed (bounds.js transformSphere before PERF-EXT4) - into float32, as the record keeps it
  const base = (b) => {
    const out = new Float32Array(4);
    out[0] = m[0] * b[0] + m[4] * b[1] + m[8] * b[2] + m[12];
    out[1] = m[1] * b[0] + m[5] * b[1] + m[9] * b[2] + m[13];
    out[2] = m[2] * b[0] + m[6] * b[1] + m[10] * b[2] + m[14];
    out[3] = b[3] * Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
    return out;
  };
  const same = (got, want, what) => { for (let k = 0; k < 4; k++) assert.ok(Object.is(got[k], want[k]), `${what}[${k}]: ${got[k]} is the base's ${want[k]}`); };
  same(r.sphere, base(mesh.bounds), 'the mesh\'s sphere');
  for (let i = 0; i < subMeshes.length; i++) {
    if (!subMeshes[i]._bounds) { assert.equal(r.subSpheres[i * 4 + 3], -1, 'an unbounded sub-mesh is always drawn'); continue; }
    same(r.subSpheres.subarray(i * 4, i * 4 + 4), base(subMeshes[i]._bounds), `sub-mesh ${i}`);
  }
  assert.ok(Math.abs(r.sphere[3] - 31.7 * 2.5) < 1e-3, `the radius took the longest column, y (${r.sphere[3]})`);
  same(bounds.transformSphere(m, mesh.bounds, new Float32Array(4)), base(mesh.bounds), 'transformSphere itself');
});

// ── PERF-EXT5: the sun's 3x3 kernel in four taps ──────────────────────────

/** sunShadowTap's body, sliced from the block every lane shader pastes. */
const sunTapBody = () => {
  const m = /float sunShadowTap\(vec3 wp, vec3 n, bool soft\) \{([\s\S]*?)\n\}/.exec(SHADOW_GLSL);
  assert.ok(m, 'sunShadowTap is where this pin thinks it is');
  return m[1].split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');   // the code, not its comments
};

test('PERF-EXT5: THE SUN\'S KERNEL IS FOUR TAPS - sunShadowTap fetches the map five times in all (the far cascade\'s one, the kernel\'s four; the base: a loop of nine), no loop, the four at the positions and weights the twin below proves, and every u-name in it a uniform the lane shaders declare (a local named like a uniform is how a shader goes black)', () => {
  const body = sunTapBody();
  assert.equal((body.match(/texture\(uSunShadow/g) ?? []).length, 5, 'one far tap and four kernel taps');
  assert.doesNotMatch(body, /\bfor \(/, 'no loop');
  assert.match(body, new RegExp(`vec2 st = p\\.xy \\* ${SHADOW_SUN_SIZE}\\.0 - 0\\.5;`), 'texel space, the centres on the integers');
  assert.match(body, /vec2 b = floor\(st\), f = st - b;/);
  assert.match(body, /vec2 wA = 2\.0 - f, wB = 1\.0 \+ f;/, 'the two pairs\' weights');
  assert.match(body, /vec2 tA = \(b - 0\.5 \+ 1\.0 \/ wA\) \* texelUv, tB = \(b \+ 1\.5 \+ f \/ wB\) \* texelUv;/, 'each tap inside its pair where the bilinear split is the kernel\'s');
  const taps = [...body.matchAll(/(w[AB])\.x \* (w[AB])\.y \* texture\(uSunShadow, vec4\((t[AB])\.x, (t[AB])\.y, lc, ref\)\)/g)].map((x) => x.slice(1).join(' '));
  assert.deepEqual(taps.sort(), ['wA wA tA tA', 'wA wB tA tB', 'wB wA tB tA', 'wB wB tB tB'], 'each tap weighed by its own pair on each axis');
  assert.match(body, /return lit \/ 9\.0;/);
  assert.doesNotMatch(body, /\b(?:float|vec2|vec3|vec4|int|mat4)\s+u[A-Z]/, 'no local named like a uniform');
  for (const fs of [EL_MESH_FS, EL_BB_FS]) {   // the block and the lane shader it is pasted into, which declares the eye
    for (const name of new Set(body.match(/\bu[A-Z]\w*/g))) assert.match(fs, new RegExp(`uniform [\\w ]+ ${name}\\b`), `${name} is a uniform the shader declares`);
  }
});

test('PERF-EXT5: THE FOUR TAPS ARE THE NINE - on random depth maps (clamped at the edges, LEQUAL, as the pass sets the sun map) the shader\'s four bilinear taps equal the base\'s nine to 1e-12 with exact sub-texel weights, and within a 255th of the sun\'s light with the 8-bit weights a D3D11-class card quantises to (truncated or rounded) - a penumbra\'s last bit at most', () => {
  // the twin is the shader's own arithmetic: the lines it transcribes are the ones sunShadowTap runs
  assert.match(sunTapBody(), /vec2 tA = \(b - 0\.5 \+ 1\.0 \/ wA\) \* texelUv, tB = \(b \+ 1\.5 \+ f \/ wB\) \* texelUv;/, 'sunShadowTap takes the four taps');
  const N = 64, rand = rng(13);
  const q = (x, mode) => (mode === 'exact' ? x : mode === 'trunc' ? Math.floor(x * 256) / 256 : Math.round(x * 256) / 256);
  /** One hardware tap: a bilinear PCF of the 2x2 under texel-space (u, v) (centres at k + 0.5), indices clamped. */
  const tap = (D, u, v, ref, mode) => {
    const x = u - 0.5, y = v - 0.5, i = Math.floor(x), j = Math.floor(y), fx = q(x - i, mode), fy = q(y - j, mode);
    const cmp = (a, b) => (ref <= D[Math.min(N - 1, Math.max(0, b)) * N + Math.min(N - 1, Math.max(0, a))] ? 1 : 0);
    return (1 - fx) * (1 - fy) * cmp(i, j) + fx * (1 - fy) * cmp(i + 1, j) + (1 - fx) * fy * cmp(i, j + 1) + fx * fy * cmp(i + 1, j + 1);
  };
  /** The base's loop: nine taps a texel apart about p. */
  const nine = (D, u, v, ref, mode) => { let lit = 0; for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) lit += tap(D, u + x, v + y, ref, mode); return lit / 9; };
  /** The shader's four, line for line (texel space: tA / texelUv). */
  const four = (D, u, v, ref, mode) => {
    const st = [u - 0.5, v - 0.5], b = st.map(Math.floor), f = [st[0] - b[0], st[1] - b[1]];
    const wA = f.map((x) => 2 - x), wB = f.map((x) => 1 + x);
    const tA = [b[0] - 0.5 + 1 / wA[0], b[1] - 0.5 + 1 / wA[1]], tB = [b[0] + 1.5 + f[0] / wB[0], b[1] + 1.5 + f[1] / wB[1]];
    return (wA[0] * wA[1] * tap(D, tA[0], tA[1], ref, mode) + wB[0] * wA[1] * tap(D, tB[0], tA[1], ref, mode)
      + wA[0] * wB[1] * tap(D, tA[0], tB[1], ref, mode) + wB[0] * wB[1] * tap(D, tB[0], tB[1], ref, mode)) / 9;
  };
  const worst = { exact: 0, trunc: 0, round: 0 };
  let penumbra = 0;
  for (let m = 0; m < 30; m++) {
    const D = new Float32Array(N * N);
    const edge = m % 2 === 0;   // half the maps an occluder's straight edge, half noise
    const ang = rand() * Math.PI, ox = rand() * N, oy = rand() * N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) D[j * N + i] = edge ? ((i - ox) * Math.cos(ang) + (j - oy) * Math.sin(ang) > 0 ? 0.2 : 0.9) : (rand() < 0.5 ? rand() * 0.3 : 0.5 + rand() * 0.5);
    for (let k = 0; k < 2000; k++) {
      const u = rand() * N, v = rand() * N, ref = 0.1 + rand() * 0.8;   // the whole map, its clamped edges included
      for (const mode of ['exact', 'trunc', 'round']) worst[mode] = Math.max(worst[mode], Math.abs(nine(D, u, v, ref, mode) - four(D, u, v, ref, mode)));
      const e = nine(D, u, v, ref, 'exact');
      if (e > 0 && e < 1) penumbra++;
    }
  }
  assert.ok(worst.exact < 1e-12, `exact weights: the same light (${worst.exact})`);
  assert.ok(worst.trunc < 1 / 255 && worst.round < 1 / 255, `8-bit weights: within a 255th (truncated ${(worst.trunc * 255).toFixed(2)}, rounded ${(worst.round * 255).toFixed(2)} of one)`);
  assert.ok(penumbra > 5000, `the samples reached the penumbrae (${penumbra})`);
});

// ── PERF-EXT (the review of the shadows) ───────────────────────────────────
// The reviewer re-measured the interior, where the players said the game was
// fine, and found PERF-EXT1's cube query paid there a lamp a batch a frame;
// and two margins of the quad's bound that no pin held.

/** Every read of a batch's placement grid while the pass renders, counted: the grid behind a Proxy (none on a tree
 *  without one - the base's batches carry no `_place`). */
function countPlacements(sp, batches) {
  const counter = { n: 0, on: false };
  for (const b of batches) {
    if (!b._place) continue;
    const q = b._place;
    b._place = new Proxy(q, { get(t, k) { if (counter.on) counter.n++; return t[k]; } });
  }
  const render = sp.render.bind(sp);
  sp.render = (f) => { counter.on = true; try { return render(f); } finally { counter.on = false; } };
  return counter;
}

test('PERF-EXT (the review): A ROOM DRAWN WHOLE ASKS NO PLACEMENT - a still tavern of twenty lamps and twenty batches of six flats under everyLightCasts (DISC15: every lamp\'s lo signature asked every frame, and a still room never spends SHADOW_LO_REBUILDS) reads no batch\'s placements a frame (the first cut: a cube query a lamp a batch, 0.240 -> 0.558 ms of beginFrame in the reviewer\'s 40-lamp room); the same room not drawn whole still asks its quads; and a flat freed in the room rebuilds, within the budget, every lo map a quad of it stood in and none its sphere does not reach', () => {
  const build = () => {
    const { r, sp } = stand();
    const rand = rng(13);
    const batches = [];
    for (let k = 0; k < 20; k++) {   // a record's flats about the hall: a row of barrels, a set of chairs, 16 units across
      const cs = [], cx = rand() * 48 - 24, cz = rand() * 48 - 24;
      for (let i = 0; i < 6; i++) cs.push([cx + rand() * 16 - 8, rand() * 2, cz + rand() * 16 - 8]);
      const b = r.createBillboardBatch(504, 1 + (k % 3), { w: 0.8 + rand(), h: 1 + rand() * 1.5 }, cs);
      b.origin = [0, 0, 0];
      batches.push(b);
    }
    const L = new Float32Array(20 * 4);
    for (let i = 0; i < 20; i++) L.set([rand() * 56 - 28, 2.5, rand() * 56 - 28, 8 + rand() * 4], i * 4);   // a 60 x 60 hall's lamps
    let list = batches.slice();
    const frame = (every) => {
      r.setPointLights(L, new Float32Array([1, 1, 1]));
      if (every) r.everyLightCasts();
      r.beginFrame(I, I, LIGHT_DIR, WORLD_FRAME);
      const st = { ...sp.stats };
      r.drawBillboards(list, RIGHT, UP);
      r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
      return st;
    };
    return { r, sp, batches, L, frame, drop: (b) => { list = list.filter((x) => x !== b); } };
  };
  // drawn whole: the lo tier holds every lamp, and a still frame reads no placement
  const room = build();
  for (let f = 0; f < 6; f++) room.frame(true);
  const counter = countPlacements(room.sp, room.batches);
  for (let f = 0; f < 3; f++) {
    const st = room.frame(true);
    assert.equal(st.loSlots, 20, 'every lamp keeps its lo map');
    assert.equal(st.loFaces, 0, 'a still room redraws none');
  }
  assert.equal(counter.n, 0, `a still room drawn whole read ${counter.n} placements in three frames (the first cut: every lamp's lo walk, a cube query a batch)`);
  // not drawn whole (a street, a dungeon): the eight still ask the quads
  const street = build();
  for (let f = 0; f < 6; f++) street.frame(false);
  const streetCount = countPlacements(street.sp, street.batches);
  street.frame(false);
  assert.ok(streetCount.n > 0, `outside a room drawn whole the signature asks the quads (${streetCount.n} reads)`);
  // correct by the sphere: a flat freed rebuilds every lo map it was drawn into, and none it could not reach
  const far = (i) => shadowFarFor(room.L[i * 4 + 3]);
  const c = new Float64Array(4);
  let pick = null, must = -1, may = 0;
  for (const b of room.batches) {
    const rad = bounds.placementRadius(bounds.quadHalfDiagonal(b.size), 0);
    let m = 0, y = 0;
    for (let i = 0; i < 20; i++) {
      const x = room.L[i * 4], ly = room.L[i * 4 + 1], z = room.L[i * 4 + 2];
      const s = bounds.batchSphere(b, c);
      if (spheresTouch(s[0], s[1], s[2], s[3], x, ly, z, far(i))) y++;
      if (bounds.placementsInCube(b, rad, x, ly, z, far(i))) m++;
    }
    if (y > m && m > must) { pick = b; must = m; may = y; }
  }
  assert.ok(pick && must >= 1 && may > must, `a batch with quads in ${must} lamps' cubes and its sphere touching ${may}`);
  room.drop(pick); room.r.destroyBillboardBatch(pick);
  let faces = 0;
  for (let f = 0; f < 20; f++) {
    const st = room.frame(true);
    assert.ok(st.loFaces <= 6 * SHADOW_LO_REBUILDS, `frame ${f}: within the rebuild budget (${st.loFaces} faces)`);
    faces += st.loFaces;
  }
  assert.ok(faces >= 6 * must && faces <= 6 * may, `the freed flat rebuilt ${faces / 6} lo maps: at least the ${must} it stood in, at most the ${may} its sphere reached`);
});

test('PERF-EXT (the review): A QUAD\'S HALF-DIAGONAL ONCE A SIZE - a swaying wood beside a lantern for ten frames takes Math.hypot of its size once (the first cut: at every ask, 230 to 800 a frame on the provers\' harnesses); and a size its host rewrites in place is asked again - a crown grown taller, then a quad grown wider, each carries the wood into a lamp\'s cube it did not reach', () => {
  const far = shadowFarFor(18), wl = 8, sway = 1;
  const reach = (w, h) => far + bounds.placementRadius(bounds.quadHalfDiagonal({ w, h }), swayLean(wl, sway, Math.abs(h)));
  const run = (size, grown, X) => {
    const { r, frame } = stand();
    // the quad at the origin, the lamp X off along -x; the other placement 300 beyond the lamp, so the batch's
    // sphere holds the lamp and only the quad at the origin can answer
    const b = r.createBillboardBatch(504, 1, { ...size }, [[0, 0, 0], [-300, 0, 0]]);
    b.sway = sway; b.origin = [0, 0, 0];
    const draw = () => { r.setFlatWind([wl, 0, 1, 1]); r.drawBillboards([b], RIGHT, UP); };
    const lamp = new Float32Array([-X, 2, 0, 18]);
    const hypot = Math.hypot;
    const phase = (key) => {
      let faces = 0, asked = 0;
      Math.hypot = (...a) => { if (a.length === 2 && a[0] === key.w && a[1] === key.h) asked++; return hypot(...a); };
      try { for (let f = 0; f < 10; f++) faces += frame(draw, lamp).dynFaces; } finally { Math.hypot = hypot; }
      return { faces, asked };
    };
    const before = phase(size);
    b.size.w = grown.w; b.size.h = grown.h;   // written through, as a host writes a walker's (world.js PERF-TOWN1)
    const after = phase(grown);
    return { before, after };
  };
  const W = 1.0625, H = 2.03125;
  // taller: the crown's reach grows past the lamp
  const tall = { w: W, h: 6.03125 };
  const X1 = (reach(W, H) + reach(tall.w, tall.h)) / 2;
  const t = run({ w: W, h: H }, tall, X1);
  assert.equal(t.before.faces, 0, `at ${X1.toFixed(3)} the ${H} quad is out of the cube (reach ${reach(W, H).toFixed(3)})`);
  assert.equal(t.before.asked, 1, `ten frames of a swaying wood took its half-diagonal ${t.before.asked} times`);
  assert.ok(t.after.faces > 0, `grown to ${tall.h} (reach ${reach(tall.w, tall.h).toFixed(3)}) it holds the slot`);
  assert.equal(t.after.asked, 1, `the new size asked once (${t.after.asked})`);
  // wider: the same, by w alone
  const wide = { w: 5.0625, h: H };
  const X2 = (reach(W, H) + reach(wide.w, wide.h)) / 2;
  const w = run({ w: W, h: H }, wide, X2);
  assert.equal(w.before.faces, 0, 'the narrow quad is out');
  assert.ok(w.after.faces > 0, `widened to ${wide.w} it holds the slot`);
  assert.equal(w.after.asked, 1, 'the new width asked once');
});

test('PERF-EXT (the review): ONE HOME EACH - the flat\'s half-height lift is written once in src/render (bounds.js batchLift, which batchSphere and both placement queries call) and its half-diagonal once (quadHalfDiagonal, which the birth\'s sphere, a move\'s and placementRadius call); the first cut wrote the lift out again in each query, and the half-diagonal a third time', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../src/render/', import.meta.url);
  const src = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]));
  const count = (re) => Object.entries(src).flatMap(([f, t]) => (t.match(re) ?? []).map(() => f));
  assert.deepEqual(count(/size\??\.h(?: \?\? 0\))? \* 0\.5/g), ['bounds.js'], 'one lift: half the height, at its home');
  assert.deepEqual(count(/Math\.hypot\([\w.]*size\.w, [\w.]*size\.h\)/g), ['bounds.js'], 'one half-diagonal, at its home');
  const b = src['bounds.js'];
  for (const fn of ['batchSphere', 'placementsInCube', 'placementsInVolume']) {
    const body = b.slice(b.indexOf(`export function ${fn}(`), b.indexOf('\n}', b.indexOf(`export function ${fn}(`)));
    assert.match(body, /batchLift\(b\)/, `${fn} lifts by the home`);
  }
  assert.equal((src['renderer.js'].match(/quadHalfDiagonal\((?:batch\.)?size\)/g) ?? []).length, 2, 'the birth and the move take the half-diagonal from the home');
  assert.match(b, /return \(half \+ lean\) \* \(1 \+ 1e-5\) \+ 1e-3;/, 'placementRadius is handed it');
});

test('PERF-EXT (the review): THE BOUND\'S TWO MARGINS - the pad: at 1,600 units, where float32 cannot tell a quad from one 6e-5 nearer (the card holds uOrigin + aCenter no finer), a quad whose unpadded bound misses a lantern\'s cube by 6e-5 is still in it, and one 2e-3 out is not; the lean by |h|: an upside-down wide quad (h -1, a flame\'s sign) the wind leans 0.07 toward the lamp is in the lamp\'s reach as the upright one is, and nudged 0.15 further is not', () => {
  // the pad, where the pass asks it (bounds.js placementsInCube, placementRadius)
  const { r } = stand();
  const size = { w: 1, h: 2 }, px = 1578.5, far = 20, miss = 6e-5;
  const hd = bounds.quadHalfDiagonal(size);
  const cube = (gap) => {
    const b = r.createBillboardBatch(504, 1, size, [[0.5, 0, 0], [-300, 0, 0]]);
    b.origin = [px + far + hd + gap - 0.5, 0, 0];   // the quad's centre far + hd + gap along +x from the lamp, level with it
    return bounds.placementsInCube(b, bounds.placementRadius(hd, 0), px, 1, 0, far);
  };
  const xq = px + far + hd + miss;
  assert.equal(Math.fround(px), px, 'the lamp is where float32 puts it');
  assert.equal(Math.fround(xq), Math.fround(xq - miss), 'float32 cannot tell this quad from one 6e-5 nearer - on the tangent');
  assert.equal(cube(miss), true, 'missed by 6e-5 unpadded, the pad keeps it in');
  assert.equal(cube(2e-3), false, 'past the pad it is out');
  // |h|, through the pass: a still quad (its signed lean reads as none to recordBillboards) is the cache's, a leaning
  // one is the dynamics' - either way the lamp is HELD while it stands there, or rebuilt when it goes
  const held = (x, h) => {
    const s = stand();
    const b = s.r.createBillboardBatch(504, 1, { w: 10, h }, [[x, 0, -100], [-300, 0, -100]]);
    b.sway = 1.2; b.origin = [0, 0, 0];
    const post = { vao: { id: 'vao-post' }, buffers: [], bounds: new Float32Array([0, 1, 0, 1.5]), subMeshes: [{ textureArchive: 300, textureRecord: 0, startIndex: 0, primitiveCount: 12 }] };
    const at = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -2, 0, -99, 1]);
    let list = [b];
    // an upright crown leans with the wind and an upside-down one against it (BB_VS: `* uSize.y`): each toward the lamp
    const draw = () => { s.r.setFlatWind([h < 0 ? 30 : -30, 0, 1, 1]); s.r.drawMesh(post, at, null); s.r.drawBillboards(list, RIGHT, UP); };
    const lamp = new Float32Array([0, 0, -100, 18]);
    let n = 0;
    for (let f = 0; f < 10; f++) { const st = s.frame(draw, lamp); if (f >= 3) n += st.dynFaces; }
    list = [];
    for (let f = 0; f < 3; f++) n += s.frame(draw, lamp).staticFaces;
    return n;
  };
  assert.ok(Math.abs(swayLean(30, 1.2, 1) - 0.0702) < 1e-9, 'the lean these are built on');
  assert.ok(held(25.05, 1) > 0, 'upright, the lean carries it into reach');
  assert.ok(held(25.05, -1) > 0, 'upside down, the lean carries it just as far');
  assert.equal(held(25.2, -1), 0, 'upside down, past the lean\'s reach it is not');
});
