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
import { EL_LANE } from '../src/render/enhancedLighting.js';
import * as bounds from '../src/render/bounds.js';   // a namespace: on the base the placement grid is missing, and only its pins fail
import { sunCascadeMatrices, pointFaceMatrices, shadowFarFor, swayLean } from '../src/render/shadowPass.js';

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
  const rad = bounds.placementRadius(b.size, 0);
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
