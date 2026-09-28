// LA-AUDIT (2026-09-27, the audit before LA's merge - Mac: "Audit before we merge"): SIX LENSES ON THE OVERHAUL, EVERY
// FINDING PROVED BY A DRIVER BEFORE ANYTHING WAS FIXED, AND EACH FIX PINNED HERE. `07-Rendering/Enhanced-Lighting-Arc.md`
// AUDIT (LA) has the lenses, the numbers and what was declined.
//   A1  the dungeon's lo maps drew the whole level a face - the batch's shadow cells, culled by cell;
//   A5  the dungeons (and World of Daggerfall's towns) still cut the light cap - they fade it now, as the street does;
//   B1  the contact march's self-check had no term for its own lift - the floor's contact shadows fell out at 1080p;
//   B2  the shafts in half floats kept what the bytes clamped - heavy fog's haze 2.5x as bright;
//   B3  the bright pass's blocks drifted off the pixel grid on a rect that is not four bloom texels a side;
//   B5  the eye's sixteen bits read through a lowp sampler - decoded off by up to 16 steps on a half-float fetch;
//   B6  LA-POST5's share window let EL7's halo back - the AO blur follows the surface's own run now;
//   C1  the floating origin's shift moved a gated input without moving the stamp;
//   F1  the flicker probe passed a black, frozen scene - its verdict is pure now, and asks for a picture;
//   F2  the street's lantern pool fill had no pin of its own - it is cityLights.js's fillLanternPool;
//   F6  LA-SHADOW2's handover and LA-SHADOW4's lo compare were pinned by source text - driven here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from './glsl.mjs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { StaticBatchBuilder, shadowCells, SHADOW_CELL_SIZE } from '../src/render/staticBatch.js';
import {
  SHADOW_GLSL, SHADOW_CASCADES, SHADOW_POINT_CASTERS, sunCascadeMatrices, sunTexelWorld, casterWord,
} from '../src/render/shadowPass.js';
import {
  AirPass, AIR_ADAPT_GLSL, AIR_CONTACT_GLSL, AIR_CONTACT_LIFT, AIR_CONTACT_LENGTH, AIR_CONTACT_THICKNESS, AIR_CONTACT_FLOOR,
  AIR_BRIGHT_THRESHOLD, AIR_AO_RADIUS, AIR_AO_STORE, AIR_HAZE_GAIN, AIR_HAZE_REACH, SHAFT_FS, projInfo, unpackAdapt, AIR_ADAPT_STEPS, AIR_ADAPT_LOG_RANGE,
} from '../src/render/airPass.js';
import { capFadeColors, capFadePairs, fillLanternPool, rangesFor } from '../src/world/cityLights.js';
import { sunDirection } from '../src/world/worldClock.js';
import { perspective, lookAt, multiply } from '../src/world/mat4.js';
import { summarize, judge, LUM_BLACK } from '../tools/lightFlickerVerdict.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const viewAt = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);

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
/** A float rounded to half precision (a lowp/mediump fetch on a GPU that keeps them at 16 bits). */
function f16(x) {
  if (x === 0 || !Number.isFinite(x)) return x;
  const e = Math.max(Math.floor(Math.log2(Math.abs(x))), -14), step = 2 ** (e - 10);
  return Math.round(x / step) * step;
}

// ═══ A1. THE SHADOW CELLS ════════════════════════════════════════════════════════════════════════════════════════
/** Two rooms of floor quads 200 units apart, their textures alternating so every texture group spans both rooms (the
 *  dungeon's shape: one sub-mesh per texture, each across the level). */
function twoRooms({ cells = true } = {}) {
  const b = new StaticBatchBuilder(cells ? { shadowCell: SHADOW_CELL_SIZE } : {});
  const quad = (x, z) => ({
    positions: new Float32Array([x, 0, z, x + 4, 0, z, x + 4, 0, z + 4, x, 0, z + 4]), normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array(8), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [{ textureArchive: 0, textureRecord: 0, startIndex: 0, primitiveCount: 2 }],
  });
  for (const ox of [0, 200]) for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) b.add(quad(ox + i * 4, -j * 4 - 4), I, () => `${(i + j) % 3}_0`);
  return b.finish();
}

test('LA-AUDIT A1: THE LEVEL\'S SHADOW CELLS - the batch\'s triangles again, sorted by the grid cell of their centroid into a second index buffer (a permutation, the cells tiling it in order, each cell\'s triangles in the merge\'s order, the cells y then z then x); createMesh puts it on a second VAO over the same vertex buffers with each cell\'s sphere, and destroyMesh frees it; a builder asked for none makes none, and the dungeon asks (mutants: the cells never built; the sort unstable; the cell by a corner, not the centroid)', () => {
  const m = twoRooms();
  const tris = (ix) => { const out = []; for (let t = 0; t < ix.length / 3; t++) out.push(`${ix[t * 3]},${ix[t * 3 + 1]},${ix[t * 3 + 2]}`); return out; };
  assert.deepEqual(tris(m.shadowIndices).sort(), tris(m.indices).sort(), 'the same triangles');
  let at = 0;
  const where = new Map(tris(m.indices).map((k, t) => [k, t]));
  const cellOf = (t) => {
    const ix = m.shadowIndices, P = m.positions, c = [0, 1, 2].map((a) => (P[ix[t * 3] * 3 + a] + P[ix[t * 3 + 1] * 3 + a] + P[ix[t * 3 + 2] * 3 + a]) / 3);
    return c.map((v) => Math.floor(v / SHADOW_CELL_SIZE));
  };
  let lastKey = null;
  for (const c of m.shadowCells) {
    assert.equal(c.startIndex, at, 'the cells tile the buffer in order');
    const first = cellOf(c.startIndex / 3);
    let prevAt = -1;
    for (let t = c.startIndex / 3; t < c.startIndex / 3 + c.primitiveCount; t++) {
      assert.deepEqual(cellOf(t), first, 'every triangle of a cell has its centroid in it');
      const was = where.get(tris(m.shadowIndices.subarray(t * 3, t * 3 + 3))[0]);
      assert.ok(was > prevAt, 'and they keep the merge\'s order'); prevAt = was;
    }
    const key = [first[1], first[2], first[0]];
    if (lastKey) assert.ok(key[0] > lastKey[0] || (key[0] === lastKey[0] && (key[1] > lastKey[1] || (key[1] === lastKey[1] && key[2] > lastKey[2]))), 'the cells run y, then z, then x');
    lastKey = key;
    at += c.primitiveCount * 3;
  }
  assert.equal(at, m.indices.length);
  // a quad straddling a line: its two triangles' centroids decide, not a corner
  const s = shadowCells(new Float32Array([15, 0, 0, 17, 0, 0, 17, 0, 1, 15, 0, 1]), new Uint32Array([0, 1, 2, 0, 2, 3]), 16);
  assert.equal(s.cells.length, 2, 'a centroid at 16.33 is the next cell\'s, one at 15.67 this one\'s');
  assert.equal(twoRooms({ cells: false }).shadowIndices, undefined, 'none asked, none built');
  // the upload
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  calls.length = 0;
  const mesh = r.createMesh(m);
  const data = calls.filter((c) => c[0] === 'bufferData');
  assert.equal(data.length, 5, 'three vertex buffers, the lit indices, the cells\' indices');
  assert.deepEqual([...data[4][2]], [...m.shadowIndices], 'the cells\' buffer');
  assert.ok(mesh.shadowVao && mesh.shadowVao !== mesh.vao, 'a VAO of its own');
  const vap = calls.filter((c) => c[0] === 'vertexAttribPointer').map((c) => c.slice(1).join());
  assert.equal(vap.length, 6);
  assert.deepEqual(vap.slice(3), vap.slice(0, 3), 'the second VAO over the same three buffers, in the same layout');
  assert.ok(mesh.shadowVao && mesh.shadowCells.length === m.shadowCells.length && mesh.shadowCells.every((c) => c._bounds?.length === 4 && c._bounds[3] > 0));
  calls.length = 0;
  r.destroyMesh(mesh);
  assert.deepEqual(calls.filter((c) => c[0] === 'deleteVertexArray').map((c) => c[1]), [mesh.vao, mesh.shadowVao]);
  assert.match(rd('src/scenes/dungeonContext.js'), /const staticBuilder = new StaticBatchBuilder\(\{ shadowCell: SHADOW_CELL_SIZE \}\);/);
});

test('LA-AUDIT A1: A FACE DRAWS THE CELLS IT CAN SEE - a lamp in one room of a two-room level redraws its six faces from the cells\' buffer and never touches the other room, where the texture sub-meshes (each across both rooms) drew both rooms six times; the lit pass still draws the sub-meshes; a recentre carries the cells\' spheres (mutants: the replay by sub-mesh; the cells\' VAO not bound; a cell never culled; the spheres left behind)', () => {
  const run = (cells) => {
    const m = twoRooms({ cells });
    const { calls, canvas } = recordingGl();
    const r = new Renderer(canvas);
    r.setLightingLane(EL_LANE);
    r.textures.set('0_0', { id: 't0' }); r.textures.set('1_0', { id: 't1' }); r.textures.set('2_0', { id: 't2' });
    r.setLighting(new Float32Array([0.2, 0.2, 0.2]), 0);
    const mesh = r.createMesh(m);
    const L = new Float32Array([12, 2, -12, 10]);   // a lamp in the first room
    const frame = () => { r.setPointLights(L, new Float32Array([1, 1, 1])); calls.length = 0; r.beginFrame(I, viewAt(12, 1.7, 0), new Float32Array([0, -1, 0]), WORLD_FRAME); const got = calls.slice(); r.drawMesh(mesh, I, null); r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); return got; };
    frame();
    const got = frame();   // the records of the first frame, replayed for the lamp's six faces
    const P = m.positions, ix = cells ? m.shadowIndices : m.indices;
    let far = 0, near = 0, boundCells = false;
    for (const c of got) {
      if (c[0] === 'bindVertexArray' && c[1] === mesh.shadowVao) boundCells = true;
      if (c[0] !== 'drawElements') continue;
      for (let k = c[4] / 4; k < c[4] / 4 + c[2]; k++) { if (P[ix[k] * 3] > 100) far++; else near++; }
    }
    return { far, near, boundCells, r, mesh };
  };
  const now = run(true), base = run(false);
  assert.equal(now.far, 0, 'not one index of the far room');
  assert.ok(now.near > 0 && now.boundCells, 'the near room, from the cells\' buffer');
  assert.ok(base.far >= base.near && base.far > 0, `the base: every face drew the far room too (${base.far} of its indices)`);
  // the lit pass is the sub-meshes on the mesh's own VAO, as before
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.textures.set('0_0', { id: 't0' }); r.textures.set('1_0', { id: 't1' }); r.textures.set('2_0', { id: 't2' });
  const m = twoRooms(), mesh = r.createMesh(m);
  r.beginFrame(I, I, new Float32Array([0, -1, 0]), WORLD_FRAME);
  calls.length = 0;
  r.drawMesh(mesh, I, null);
  assert.ok(calls.some((c) => c[0] === 'bindVertexArray' && c[1] === mesh.vao) && !calls.some((c) => c[0] === 'bindVertexArray' && c[1] === mesh.shadowVao), 'the lit pass binds the mesh\'s own VAO');
  assert.equal(calls.filter((c) => c[0] === 'drawElements').length, m.subMeshes.length, 'one draw a texture');
  // the recentre: the record's cell spheres move with the world
  const sp = now.r.shadows, rec = sp.records.slice(0, sp.count).find((x) => x.mesh === now.mesh);
  const before = rec.cellSpheres.slice(0, 8);
  now.r.shadowOriginShift([-819.2, 0, 409.6]);
  assert.ok(Math.abs(rec.cellSpheres[0] - (before[0] - 819.2)) < 1e-3 && Math.abs(rec.cellSpheres[2] - (before[2] + 409.6)) < 1e-3 && rec.cellSpheres[3] === before[3], 'the spheres follow the recentre');
});

// ═══ A5. THE DUNGEON'S CAP FADES ═════════════════════════════════════════════════════════════════════════════════
test('LA-AUDIT A5: THE CAP FADES IN THE DUNGEONS AND IN THE MOD\'S TOWNS - capFadePairs gives each kept light ITS OWN colour times its share (the hand\'s whole), is capFadeColors for one shared colour, and fades nothing when the cap cuts nothing; both dungeon hosts and the World of Daggerfall arm pick one light past the cap on the lane and hand the renderer the faded colours, and the gate\'s court keeps its cut (mutants: the pairs\' own colours dropped; a host\'s extra light dropped; the fade not handed over)', () => {
  const pos = [0, 0, 0];
  const lit = new Float32Array([0, 0, 1, 5, /* the hand */ 5, 0, 0, 18, 10, 0, 0, 18, 20, 0, 0, 18]);
  const colors = new Float32Array([1, 1, 1, 0.8, 0.5, 0.2, 0.4, 0.6, 1.0, 9, 9, 9]);
  const out = capFadePairs(lit, 1, pos, 3, colors);
  const share = [1, (20 - 5) / 16, (20 - 10) / 16];
  assert.deepEqual([...out].map((v) => +v.toFixed(5)), [1, 1, 1, 0.8 * share[1], 0.5 * share[1], 0.2 * share[1], 0.4 * share[2], 0.6 * share[2], 1.0 * share[2]].map((v) => +Math.fround(v).toFixed(5)));
  const same = new Float32Array(12).fill(0.7);
  assert.deepEqual([...capFadePairs(lit, 1, pos, 3, same)], [...capFadeColors(lit, 1, pos, 3, [0.7, 0.7, 0.7])], 'one colour for all: capFadeColors');
  assert.equal(capFadePairs(lit, 1, pos, 4, colors), null, 'nothing cut, nothing faded');
  assert.equal(capFadePairs(lit, 3, pos, 3, colors), null, 'the hand fills the cap');
  const wm = rd('src/scenes/worldModes.js'), dg = rd('src/scenes/dungeon.js'), w = rd('src/scenes/world.js');
  assert.match(wm, /const _dgFade = !!renderer\.lightingLane && !isGateArena\(dungeonLoc\);/);
  assert.match(wm, /const _dgNear = nearestLights\(dungeonCtx\.lights, cam\.pos, renderer\.maxPointLights \+ \(_dgFade \? 1 : 0\), /);
  assert.match(wm, /renderer\.setPointLights\(_dgLit\.data, null, \(_dgFade && capFadePairs\(_dgLit\.data, _dgLit\.data\.length \/ 4 - _dgNear\.data\.length \/ 4, cam\.pos, renderer\.maxPointLights, _dgLit\.colors\)\) \|\| _dgLit\.colors\);/);
  assert.match(dg, /const _near = nearestLights\(ctx\.lights, cam\.pos, renderer\.maxPointLights \+ \(renderer\.lightingLane \? 1 : 0\), /);
  assert.match(dg, /renderer\.setPointLights\(_lit, DUNGEON_LANTERN_F32, renderer\.lightingLane \? capFadeColors\(_lit, _lit\.length \/ 4 - _near\.length \/ 4, cam\.pos, renderer\.maxPointLights, DUNGEON_LANTERN_F32\) : null\);/);
  assert.match(w, /return nearestLights\(_sceneLights, cam\.pos, renderer\.maxPointLights \+ \(renderer\.lightingLane \? 1 : 0\), _litRanges, \(l, i\) =>/);
  assert.match(w, /renderer\.setPointLights\(data, CITY_LIGHT_COLOR_F32, \(renderer\.lightingLane && capFadePairs\(data, lead, cam\.pos, renderer\.maxPointLights, colors\)\) \|\| colors\);/);
});

// ═══ F2. THE STREET'S POOL ═══════════════════════════════════════════════════════════════════════════════════════
test('LA-AUDIT F2: THE LANTERN POOL GROWS WITH THE TOWN - fillLanternPool writes every lantern\'s range however many the pixels hold (a pool born with 64 slots takes 300), each from its pixel\'s slot; rangesFor keeps what it held and hands back the same array when it has room; the World of Daggerfall arm grows the same way (mutants: the growth dropped; the mod\'s growth dropped)', () => {
  const anim = Float32Array.from({ length: 4096 }, (_, i) => 16 + (i % 7) * 0.4);
  const pixels = Array.from({ length: 10 }, (_, k) => ({ px: 100 + k, py: 200, lights: Array.from({ length: 30 }, (_, j) => [k, 0, j]) }));
  const pool = [], { n, ranges } = fillLanternPool(pixels, () => [0, 0, 0], pool, new Float32Array(64), anim);
  assert.equal(n, 300);
  assert.ok(ranges.length >= 300 && [...ranges.subarray(0, 300)].every((v) => v >= 16), 'every lantern past the 64th has its range');
  const kept = new Float32Array(8).fill(3);
  assert.equal(rangesFor(kept, 8), kept, 'room enough: the same array');
  const grown = rangesFor(kept, 9);
  assert.ok(grown.length >= 9 && grown[7] === 3, 'grown, with what it held');
  assert.match(rd('src/scenes/world.js'), /_litRanges = rangesFor\(_litRanges, total\);/);
});

// ═══ B1. THE CONTACT MARCH'S LIFT ════════════════════════════════════════════════════════════════════════════════
/** The previous frame, ray-cast at W x H (la_post's prevFrame, any size): the eye 1.7 up looking down -z, a floor, a
 *  crate (x -0.5..0.5, y 0..0.4) whose near face stands D + 0.15 off, 24-bit depth. */
function crateFrame(W, H, D) {
  const proj = perspective(Math.PI / 3, W / H, 0.2, 6000), pi = projInfo(proj), eyeY = 1.7;
  const cast = (px, py) => {
    const nx = (px + 0.5) / W * 2 - 1, ny = (py + 0.5) / H * 2 - 1, d = [nx / proj[0], ny / proj[5], -1];
    let t = ny < 0 ? eyeY * proj[5] / -ny : 6000, t0 = D + 0.15, t1 = D + 0.45;
    for (const [o, dd, lo, hi] of [[0, d[0], -0.5, 0.5], [eyeY, d[1], 0, 0.4]]) {
      if (Math.abs(dd) < 1e-12) { if (o < lo || o > hi) t0 = Infinity; continue; }
      const a = (lo - o) / dd, b = (hi - o) / dd; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    }
    return t0 <= t1 ? Math.min(t, t0) : t;
  };
  const q24 = (v) => Math.round(Math.min(Math.max(v, 0), 1) * 16777215) / 16777215;
  const view = lookAt([0, eyeY, 0], [0, eyeY, -1], [0, 1, 0]);
  return { proj, pi, cast, bind: { uPrevVP: Array.from(multiply(proj, view)), uPrevProjInfo: Array.from(pi), uContactParams: [AIR_CONTACT_LENGTH, AIR_CONTACT_THICKNESS, AIR_CONTACT_FLOOR, 1], uPrevRect: [0, 0, 1, 1], uCamPos: [0, eyeY, 0], textureSize: () => [W, H],
    texture: (name, uv) => [q24(((pi[3] / cast(Math.min(W - 1, Math.max(0, Math.floor(uv[0] * W))), Math.min(H - 1, Math.max(0, Math.floor(uv[1] * H)))) - pi[2]) + 1) / 2), 0, 0, 1] } };
}
test('LA-AUDIT B1: THE MARCH\'S SELF-CHECK CREDITS ITS OWN LIFT - at 1080p and 1440p every ground row before a crate that the thickness-held base shadowed is still shadowed (LA-POST6 without the lift lost 101 of 400 at 1080p), and the lift is the start\'s own offset (mutant: the lift term dropped)', () => {
  const BASE = AIR_CONTACT_GLSL.replace('> tol) return 1.0;', '> uContactParams.y) return 1.0;');
  assert.notEqual(BASE, AIR_CONTACT_GLSL);
  assert.equal(AIR_CONTACT_LIFT, 0.02);
  assert.ok(AIR_CONTACT_GLSL.includes(`vec3 start = wp + n * 0.02;`) && AIR_CONTACT_GLSL.includes(' + 0.02 / ct + '), 'one lift, in the start and in the tolerance');
  for (const [W, H] of [[1920, 1080], [2560, 1440]]) {
    let had = 0, lost = 0;
    for (const D of [5, 7.5, 9, 10, 14, 20, 26]) {
      const { proj, cast, bind } = crateFrame(W, H, D);
      const now = glslFunctions(AIR_CONTACT_GLSL, bind, { fp32: true }), base = glslFunctions(BASE, bind, { fp32: true });
      const light = [0, 0.3, -(D + 1.2)], px = W / 2;
      for (let py = 0; py < H / 2; py++) {
        const ny = (py + 0.5) / H * 2 - 1, dist = 1.7 * proj[5] / -ny;
        if (!(dist > D - 1.0 && dist < D + 0.1) || cast(px, py) < dist - 1e-6) continue;
        const wp = [Math.fround(((px + 0.5) / W * 2 - 1) / proj[0] * dist), 0, Math.fround(-dist)];
        const L = light.map((v, i) => v - wp[i]), l = Math.hypot(...L), tl = L.map((v) => v / l);
        const b = base.contactShadow(wp, [0, 1, 0], tl, l), v = now.contactShadow(wp, [0, 1, 0], tl, l);
        if (b < 0.99) { had++; if (v > 0.99) lost++; }
      }
    }
    assert.ok(had > 50, `${W}x${H}: the base shadowed ${had} rows`);
    assert.equal(lost, 0, `${W}x${H}: no shadowed row lost`);
  }
});

// ═══ B2. THE SHAFTS HELD AT 1 ════════════════════════════════════════════════════════════════════════════════════
test('LA-AUDIT B2: THE SHAFTS ARE HELD AT 1 AS THE BYTES HELD THEM - heavy fog\'s jittered haze march writes over 1 on some pixels of its tile, and SHAFT_FS hands the image no pixel over 1 (mutant: the hold dropped)', () => {
  const W = 320, H = 200, pi = projInfo(perspective(Math.PI / 3, W / H, 0.2, 6000));
  const L = [0, 0.3, -1], ln = Math.hypot(...L), lightDir = L.map((v) => v / ln);
  const raw = SHAFT_FS.replace('outColor = vec4(min(c, vec3(1.0)), 1.0);', 'outColor = vec4(c, 1.0);');
  assert.notEqual(raw, SHAFT_FS);
  let most = 0, mostRaw = 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const bind = { vUV: [0.5, 0.5 + 0.15 * pi[1]], gl_FragCoord: [x + 0.5, y + 0.5, 0, 1], uProjInfo: Array.from(pi), uRect: [0, 0, W, H], uCanvas: [W, H], uViewRot: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      uEye: [0, 1.7, 0], uLightDir: lightDir, uSunColor: [1, 0.95, 0.85], uHaze: [0.05, AIR_HAZE_GAIN, AIR_HAZE_REACH, 0.65], uCloudShadowRect: [-4000, -4000, 1 / 8000, 1],
      uSun: [0.5, 0.6], uShaftParams: [0.96, 0.35, 0.35, 1.6], uSunOn: 0, uCloudSkyOn: 0, textureLod: () => [1, 0, 0, 1], texture: () => [1, 1, 1, 1] };
    const f = glslFunctions(SHAFT_FS, bind), g = glslFunctions(raw, bind);
    f.main(); g.main();
    most = Math.max(most, ...f.globals.outColor.slice(0, 3)); mostRaw = Math.max(mostRaw, ...g.globals.outColor.slice(0, 3));
  }
  assert.ok(mostRaw > 2, `the march itself writes ${mostRaw.toFixed(2)} on a pixel of the tile`);
  assert.equal(most, 1, 'the image holds no pixel over 1');
});

// ═══ B3. THE BRIGHT PASS ON ONE GRID ═════════════════════════════════════════════════════════════════════════════
function brightPass() {
  const { gl } = recordingGl();
  const ap = new AirPass(gl, { build: (vs, fs) => ({ vs, fs }), vs: { mesh: 'M', bb: 'B' } });
  return ap.programs.bright[0].p.fs;
}
const bilinear = (W, H, at) => (uv) => {
  const x = uv[0] * W - 0.5, y = uv[1] * H - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const px = (i, j) => at(Math.min(Math.max(i, 0), W - 1), Math.min(Math.max(j, 0), H - 1));
  const a = px(x0, y0), b = px(x0 + 1, y0), c = px(x0, y0 + 1), d = px(x0 + 1, y0 + 1);
  return [0, 1, 2, 3].map((k) => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy);
};
/** The bloom energy of a 3x3 flame at (fx, fy) - every bloom texel about it, as resize sizes the image for `rect`. */
function flameEnergy(FS, rect, W, H, fx, fy) {
  const bw = Math.max(1, Math.round(rect[2] * 0.25)), bh = Math.max(1, Math.round(rect[3] * 0.25));
  const at = (x, y) => (x >= fx && x < fx + 3 && y >= fy && y < fy + 3 ? [1, 1, 1, 1] : [0, 0, 0, 1]);
  const f = glslFunctions(FS, { uRect: rect, uCanvas: [W, H], uThreshold: AIR_BRIGHT_THRESHOLD, uBloomSize: [bw, bh], vUV: [0, 0], gl_FragCoord: [0, 0, 0.5, 1], texture: (n, uv) => bilinear(W, H, at)(uv) }, { fp32: true });
  let e = 0;
  const i0 = Math.floor((fx - rect[0]) / (rect[2] / bw)) - 2, j0 = Math.floor((fy - rect[1]) / (rect[3] / bh)) - 2;
  for (let j = Math.max(0, j0); j < Math.min(bh, j0 + 5); j++) for (let i = Math.max(0, i0); i < Math.min(bw, i0 + 5); i++) {
    f.globals.vUV = [(i + 0.5) / bw, (j + 0.5) / bh]; f.globals.gl_FragCoord = [i + 0.5, j + 0.5, 0.5, 1]; f.main(); e += f.globals.outColor[0];
  }
  return e;
}
test('LA-AUDIT B3: THE BRIGHT PASS\'S BLOCKS ARE WHOLE 4x4s ON ONE GRID - on a 1366-wide rect (the image 342 texels, 1368 pixels\' worth) and a docked HUD\'s 637 rows, a 3x3 flame blooms 0.25 at every place where the drifting centres ran it 0.25 to 0.5 (and snapped ones gathered the drift into a column read twice or a row read by none); a rect of any size takes nothing from outside itself (mutants: the grid not centred; the edge blocks not held in)', () => {
  const FS = brightPass();
  for (let x = 290; x < 360; x++) { const e = flameEnergy(FS, [0, 0, 1366, 64], 1366, 64, x, 24); assert.ok(Math.abs(e - 0.25) < 1e-4, `x=${x}: ${e}`); }
  for (let x = 1000; x < 1040; x++) { const e = flameEnergy(FS, [0, 0, 1366, 64], 1366, 64, x, 24); assert.ok(Math.abs(e - 0.25) < 1e-4, `x=${x}: ${e}`); }
  for (let y = 270; y < 330; y++) { const e = flameEnergy(FS, [0, 131, 64, 637], 64, 768, 24, 131 + y); assert.ok(Math.abs(e - 0.25) < 1e-4, `row ${y}: ${e}`); }
  // the registration: each block's centre (its four taps' mean) within a pixel of where the image maps its texel
  for (const [rect, W, H] of [[[0, 0, 1366, 64], 1366, 64], [[0, 131, 64, 637], 64, 768], [[7, 0, 1365, 8], 1380, 8]]) {
    const bw = Math.max(1, Math.round(rect[2] * 0.25)), bh = Math.max(1, Math.round(rect[3] * 0.25));
    let taps = [];
    const f = glslFunctions(FS, { uRect: rect, uCanvas: [W, H], uThreshold: AIR_BRIGHT_THRESHOLD, uBloomSize: [bw, bh], vUV: [0, 0], gl_FragCoord: [0, 0, 0.5, 1], texture: (n, uv) => { taps.push(uv); return [0, 0, 0, 1]; } }, { fp32: true });
    let worst = 0;
    for (const [i, j] of [[0, 0], [bw >> 1, bh >> 1], [bw - 1, bh - 1], [bw - 2, 0], [1, bh - 2]]) {
      taps = []; f.globals.vUV = [(i + 0.5) / bw, (j + 0.5) / bh]; f.globals.gl_FragCoord = [i + 0.5, j + 0.5, 0.5, 1]; f.main();
      const cx = taps.reduce((a, t) => a + t[0], 0) / taps.length * W, cy = taps.reduce((a, t) => a + t[1], 0) / taps.length * H;
      worst = Math.max(worst, Math.abs(cx - (rect[0] + (i + 0.5) * rect[2] / bw)), Math.abs(cy - (rect[1] + (j + 0.5) * rect[3] / bh)));
    }
    assert.ok(worst <= 1.0001, `${JSON.stringify(rect)}: a block's centre ${worst.toFixed(3)} px from its texel's`);
  }
  // the footprint: every tap's two-by-two of pixels (a bilinear read at a pixel corner) inside the rect, every texel of
  // rects 6 to 1366 wide and odd heights, off the canvas's edge or not (a leak of one row passes the threshold's energy
  // test unseen - a quarter half white is under it)
  for (const [W, H, rect] of [[64, 48, [0, 13, 64, 35]], [70, 40, [13, 2, 45, 37]], [1380, 40, [7, 3, 1366, 30]], [40, 1380, [3, 7, 30, 1366]], ...[6, 7, 9, 10, 11, 13, 22, 23, 29, 30, 31].map((w) => [w + 8, w + 9, [4, 5, w, w + 1]])]) {
    const bw = Math.max(1, Math.round(rect[2] * 0.25)), bh = Math.max(1, Math.round(rect[3] * 0.25));
    let taps = [];
    const f = glslFunctions(FS, { uRect: rect, uCanvas: [W, H], uThreshold: AIR_BRIGHT_THRESHOLD, uBloomSize: [bw, bh], vUV: [0, 0], gl_FragCoord: [0, 0, 0.5, 1], texture: (n, uv) => { taps.push(uv); return [0, 0, 0, 1]; } }, { fp32: true });
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      taps = []; f.globals.vUV = [(i + 0.5) / bw, (j + 0.5) / bh]; f.globals.gl_FragCoord = [i + 0.5, j + 0.5, 0.5, 1]; f.main();
      for (const [u, v] of taps) {
        const cx = Math.round(u * W), cy = Math.round(v * H);   // the corner the read sits on: pixels cx-1, cx and cy-1, cy
        assert.ok(cx - 1 >= rect[0] && cx <= rect[0] + rect[2] - 1 && cy - 1 >= rect[1] && cy <= rect[1] + rect[3] - 1, `${JSON.stringify(rect)} texel ${i},${j}: a read at ${cx},${cy} reaches outside`);
      }
    }
  }
});

// ═══ B5. THE EYE'S SIXTEEN BITS, AT ANY FETCH ════════════════════════════════════════════════════════════════════
test('LA-AUDIT B5: THE EYE READS ITS STATE EXACTLY THROUGH A HALF-FLOAT FETCH - airAdaptLog2 rounds each byte before it scales it, so over the eye\'s whole range a fetch at half precision decodes what unpackAdapt does, where the unrounded decode ran up to 16 steps off; the eye\'s samplers are highp (mutants: a byte unrounded; a sampler back to lowp)', () => {
  const dec = glslFunctions(AIR_ADAPT_GLSL, {}, { fp32: true });
  const OLD = glslFunctions(AIR_ADAPT_GLSL.replace('(floor(t.r * 255.0 + 0.5) * 256.0 + floor(t.g * 255.0 + 0.5))', 'dot(t.rg, vec2(65280.0, 255.0))'), {}, { fp32: true });
  let worst = 0, worstOld = 0;
  for (let hi = 0; hi < 256; hi += 3) for (let lo = 0; lo < 256; lo += 5) {
    const t = [f16(hi / 255), f16(lo / 255), 0, 1], want = Math.log2(unpackAdapt(hi, lo));
    worst = Math.max(worst, Math.abs(dec.airAdaptLog2(t) - want));
    worstOld = Math.max(worstOld, Math.abs(OLD.airAdaptLog2(t) - want));
  }
  const step = (AIR_ADAPT_LOG_RANGE[1] - AIR_ADAPT_LOG_RANGE[0]) / AIR_ADAPT_STEPS;
  assert.ok(worst < 0.01 * step, `the rounded decode: ${(worst / step).toFixed(4)} of a step`);
  assert.ok(worstOld > 10 * step, `the unrounded decode ran ${(worstOld / step).toFixed(1)} steps off`);
  const air = rd('src/render/airPass.js');
  assert.match(AIR_ADAPT_GLSL, /uniform highp sampler2D uAdapt;/);
  assert.equal((air.match(/uniform highp sampler2D uPrev;/g) ?? []).length, 2, 'LUM_FS\'s and ADAPT_FS\'s');
});

// ═══ B6. THE AO WINDOW FOLLOWS THE SURFACE ═══════════════════════════════════════════════════════════════════════
test('LA-AUDIT B6: A PILLAR BEFORE A WALL GIVES THE WALL NO HALO - at 1080p, the pillar 10, 20 and 40 units off and the wall 1 or 1.5 behind it (inside LA-POST5\'s share, past the radius), the wall\'s AO texel at the silhouette reads the wall\'s own 1.000 where the share window read 0.737 (mutants: the one-surface test loosened to the radius; the gentler side\'s line taken from the steeper)', () => {
  const { gl } = recordingGl();
  const ap = new AirPass(gl, { build: (vs, fs) => ({ vs, fs }), vs: { mesh: 'M', bb: 'B' } });
  const BOX = ap.programs.box.p.fs;
  const SHARE = BOX.replace(/float w = abs\(viewDist\(depthAt\(uv\)\) - \(here \+ rise\)\) <= win \? 1\.0 : 0\.0;/, 'float w = abs(viewDist(depthAt(uv)) - here) <= max(uBlurRange, here * 0.15) ? 1.0 : 0.0;');
  assert.notEqual(SHARE, BOX);
  const W = 1920, H = 1080, AW = W / 2, AH = H / 2, pi = projInfo(perspective(Math.PI / 3, W / H, 0.2, 6000));
  const depth01 = (d) => ((pi[3] / d - pi[2]) + 1) / 2, edge = AW / 2;
  const run = (src, D, gap) => {
    const f = glslFunctions(src, { vUV: [(edge + 0.5) / AW, 0.5], uTexel: [1 / AW, 1 / AH], uBlurRange: AIR_AO_RADIUS, uStrength: 1, uProjInfo: Array.from(pi), uRect: [0, 0, W, H], uCanvas: [W, H],
      textureLod: (n, uv) => [depth01(Math.floor(uv[0] * W) < edge * 2 ? D : D + gap), 0, 0, 1],
      texture: (n, uv) => { const x = uv[0] * AW - 0.5, x0 = Math.floor(x), fx = x - x0, v = (i) => (i < edge ? 0.3 : 1.0) * AIR_AO_STORE; return [v(x0) * (1 - fx) + v(x0 + 1) * fx, 0, 0, 1]; } });
    f.main(); return f.globals.outColor[0];
  };
  for (const D of [10, 20, 40]) for (const gap of [1.0, 1.5]) {
    assert.equal(run(BOX, D, gap), 1, `pillar ${D} off, wall ${gap} behind: the wall's own`);
    assert.ok(run(SHARE, D, gap) < 0.8, `the share window: ${run(SHARE, D, gap).toFixed(3)}`);
  }
});

// ═══ C1. THE RECENTRE MOVES THE STAMP ════════════════════════════════════════════════════════════════════════════
test('LA-AUDIT C1: THE FLOATING ORIGIN\'S SHIFT MOVES THE STAMP - a billboard call after a shift sends the lane\'s frame block again (the air\'s held view-projection moved under it), where a second call with nothing moved sends only its own (mutant: the stamp not moved)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.setLighting(new Float32Array([0.2, 0.2, 0.2]), 0);
  r.beginFrame(I, I, new Float32Array([0, -1, 0]), WORLD_FRAME);
  const batch = r.createBillboardBatch(5, 1, { w: 1, h: 1.6 }, [[0, 0, -5]]);
  const sent = () => { calls.length = 0; r.drawBillboards([batch], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); return new Set(calls.filter((c) => /^uniform/.test(c[0])).map((c) => c[1])); };
  sent();
  const second = sent();
  assert.ok(!second.has('uCasterOf') && !second.has('uContactParams') && second.size < 8, `a second call sends its own: ${[...second].join(', ')}`);
  const s0 = r._frameStamp;
  r.shadowOriginShift([-819.2, 0, 0]);
  assert.equal(r._frameStamp, s0 + 1);
  const third = sent();
  assert.ok(third.has('uCasterOf') && third.has('uContactParams') && third.has('uPointCount') && third.size > 20, `the block again, after the shift (${third.size})`);
});

// ═══ F1. THE PROBE'S VERDICT ═════════════════════════════════════════════════════════════════════════════════════
/** A pass's rows as the page records them: n frames at `lum`, the eye moving `step` a frame, turning `turn` a frame. */
const rows = (n, { lum = 40, c4 = 0.2, c12 = 0, step = 0, turn = 0, mode = 'exterior', lights = null, flashAt = -1, hurtAt = -1 } = {}) =>
  Array.from({ length: n }, (_, k) => ({ k: k + 1, ms: 5, c12, c4: k ? c4 : 0, flip: 0, lum, cam: [k * step, 1.7, 0], yaw: k * turn, mode, lights: 48, lIn: lights ? 1 : 0, lOut: lights ? 1 : 0, lInW: lights?.in ?? 0, lOutW: lights?.out ?? 0,
    hp: hurtAt >= 0 && k >= hurtAt ? 30 : 37, flash: k === flashAt ? 0.05 : 0 }));
test('LA-AUDIT F1 + D: THE PROBE JUDGES A PICTURE, AND ONLY THE LIGHTING\'S - summarize and judge (tools/lightFlickerVerdict.mjs, the probe\'s own): a black, frozen run - every pass reading 0 - FAILS (black, not walked, not turned), as do a boot that never came, a street with no tavern, a pass in the wrong mode, a plan that threw, a short pass, and (lens D) a pass the HUD flashed red in or the player lost health in; a real run stands; the churn weighs a join by its share, so a faded join is no switch; each pass starts at full health (mutants: the black check dropped; walks unjudged; the mode unchecked; the plan\'s exception unread; the weight dropped; the flash unjudged; the health unjudged; the reset dropped)', () => {
  const F = 60;
  const good = (sc, mode) => [summarize(`${sc}-still`, rows(F - 1, { c4: 0, mode })), summarize(`${sc}-walk`, rows(2 * F - 1, { step: 0.05, mode })), summarize(`${sc}-turn`, rows(2 * F - 1, { turn: 0.02, mode }))];
  const run = (over = {}) => ({ scenes: ['street', 'tavern'], all: [...good('street', 'exterior'), ...good('tavern', 'interior')], errors: [], frames: F, stillMax: 1, booted: true, streetTavern: true, ...over });
  assert.deepEqual(judge(run()), [], 'a real run stands');
  const frozen = ['street', 'tavern'].flatMap((sc) => ['still', 'walk', 'turn'].map((k) => summarize(`${sc}-${k}`, rows(k === 'still' ? F - 1 : 2 * F - 1, { lum: 0, c4: 0, mode: sc === 'street' ? 'exterior' : 'interior' }))));
  const bad = judge(run({ all: frozen }));
  assert.ok(bad.some((b) => /black/.test(b)) && bad.some((b) => /did not walk/.test(b)) && bad.some((b) => /did not turn/.test(b)), bad.join(' | '));
  assert.ok(LUM_BLACK > 0);
  assert.ok(judge(run({ booted: false })).some((b) => /never booted/.test(b)));
  assert.ok(judge(run({ streetTavern: false })).some((b) => /no tavern/.test(b)));
  const wrongMode = run(); wrongMode.all[3] = summarize('tavern-still', rows(F - 1, { c4: 0, mode: 'exterior' }));
  assert.ok(judge(wrongMode).some((b) => /tavern-still: in exterior, not interior/.test(b)));
  const threw = run(); threw.all[1] = summarize('street-walk', rows(2 * F - 1, { step: 0.05 }), 'TypeError: __pose is not a function');
  assert.ok(judge(threw).some((b) => /the plan threw/.test(b)));
  const short = run(); short.all[0] = summarize('street-still', rows(20, { c4: 0 }));
  assert.ok(judge(short).some((b) => /20 of 59 frames/.test(b)));
  const moving = run(); moving.all[0] = summarize('street-still', rows(F - 1, { c4: 0.5, c12: 0.03 }));
  assert.ok(judge(moving).some((b) => /moved 12\+ levels standing still/.test(b)));
  // LA-AUDIT D: the HUD's red (a bleed's 0.05 on one frame) and a blow's lost health are no lighting flicker
  const bled = run(); bled.all[0] = summarize('street-still', rows(F - 1, { c4: 0, flashAt: 6 }));
  assert.deepEqual(judge(bled), ['street-still: the HUD flashed red (0.05) - a blow or a bleed, not the lighting']);
  const hurt = run(); hurt.all[2] = summarize('street-turn', rows(2 * F - 1, { turn: 0.02, hurtAt: 40 }));
  assert.deepEqual(judge(hurt), ['street-turn: the player lost 7 health during the pass']);
  // the churn: ten joins at no share and ten leaves at no share weigh nothing; the count still sees them
  const faded = summarize('street-walk', rows(11, { lights: { in: 0, out: 0 } })), hard = summarize('street-walk', rows(11, { lights: { in: 1, out: 1 } }));
  assert.deepEqual([faded.churn, faded.churnW, hard.churnW], [22, 0, 22]);
  const probe = rd('tools/lightFlickerProbe.mjs');
  assert.match(probe, /const bad = judge\(\{ scenes: SCENES, all, errors, frames: FRAMES, stillMax: STILL_MAX, booted, streetTavern \}\);/);
  assert.match(probe, /const summary = summarize\(name, rows, out\.err\);/);
  assert.match(probe, /if \(!booted\) fail\(`the world never booted \(\$\{BOOT_S\} s\)`\);/);
  assert.match(probe, /await ev\(\(\) => \{ const e = window\.__playerEntity; if \(e && e\.maxHealth > 0\) e\.health = e\.maxHealth; \}\);\n\s+await ev\(\(\[src, keep, keep4\]\) => \{ const P = window\.__lfp;/, 'LA-AUDIT D: each pass starts whole');
  assert.match(probe, /hp: window\.__playerEntity\?\.health \?\? null, flash: window\.__lfpFlash \? \+window\.__lfpFlash\.alpha\.toFixed\(3\) : null/, 'and every row carries the health and the HUD\'s flash');
  assert.match(probe, /const j = i >> 2, w = PK && PK\[j\] \? 0 : PC && PC\.length >= j \* 3 \+ 3 \? Math\.min\(1, Math\.max\(PC\[j \* 3\], PC\[j \* 3 \+ 1\], PC\[j \* 3 \+ 2\]\)\) : 1;/);
});

// ═══ F6. THE HANDOVER AND THE LO COMPARE, DRIVEN ═════════════════════════════════════════════════════════════════
test('LA-AUDIT F6: SHADOW_GLSL DRIVEN, NOT READ - sunShadowTap over the real cascade matrices on a map answering a constant a layer changes by under a hundredth a centimetre from 0.5 to 238 units (the base\'s hard handover stepped 0.4) and reads no map past the far fade; the lo lookups compare at the far the WORD carries, whatever the light\'s live range (F-H3: a lookup that took the range\'s own quantum passed every pin) (mutants: the handover hard; the lo compare at the live range, in either lookup)', () => {
  const vp = sunCascadeMatrices([0, 0, 0], sunDirection(9 * 60), SHADOW_CASCADES.map(() => new Float32Array(16)));
  const LAYER = [0.1, 0.5, 0.9];
  let reads = 0;
  const tap = (src) => glslFunctions(src, { uSunShadowParams: [...SHADOW_CASCADES, 1], uSunTexel: [sunTexelWorld(0), sunTexelWorld(1), sunTexelWorld(2), 0], uSunVP: vp.map((m) => Array.from(m)), uCamPos: [0, 0, 0],
    texture: (name, c) => { reads++; return LAYER[Math.round(c[2])]; } }, {});
  const walk = (src) => { const f = tap(src); let prev = null, worst = 0; for (let d = 0.5; d <= 238; d += 0.01) { const v = f.sunShadowTap([0, 0, d], [0, 1, 0], true); if (prev !== null) worst = Math.max(worst, Math.abs(v - prev)); prev = v; } return worst; };
  assert.ok(walk(SHADOW_GLSL) < 0.01, 'no step');
  const HARD = SHADOW_GLSL.replace('return t > 0.0 ? mix(lit, sunCascadeTap(c + 1, wp, n, soft), t) : lit;', 'return lit;');
  assert.notEqual(HARD, SHADOW_GLSL);
  assert.ok(walk(HARD) > 0.3, 'the hard handover steps');
  const f = tap(SHADOW_GLSL);
  reads = 0; f.sunShadowTap([0, 0, 230], [0, 1, 0], true);
  assert.equal(reads, 0, 'past the fade, no read');
  // the lo compare: slot j's word carries a far of 16; the light's live range 11.2 or 15.9 - the compare the same
  const refs = (range, one) => {
    const got = [];
    const g = glslFunctions(SHADOW_GLSL, { uPointShadowParams: Array.from({ length: SHADOW_POINT_CASTERS }, () => [0, 0, 0, 0]), texture: (name, c) => { got.push(c[3]); return 1; } }, {});
    const k = casterWord(SHADOW_POINT_CASTERS + 3, 16), L = [2, 1, -3, range], wp = [4.5, 0.2, -6.25];
    if (one) g.casterShadowOne(k, L, wp); else g.casterShadowAt(k, L, wp, [0, 1, 0]);
    return got;
  };
  for (const one of [false, true]) {
    const a = refs(11.2, one), b = refs(15.9, one);
    assert.ok(a.length > 0 && a.every((v) => Number.isFinite(v)));
    assert.deepEqual(a, b, `${one ? 'casterShadowOne' : 'casterShadowAt'}: the compare is the word's far's, not the range's`);
  }
});
