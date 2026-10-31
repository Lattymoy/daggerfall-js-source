// AUDIT RED-MOUNTAIN (2026-10-27, bible/01-Overview/audits/Audit-Red-Mountain.md; the owner: "Audit this") - every finding
// the five lanes reproduced, pinned where it was fixed. The fire's (F): the far draw's hiding from a far eye, past the
// built grid and over the crater's wander; one haze in both draws and an exact split between them; the plume's far side
// first; its foot inside its crater; the rivers' clock; the summits' air eased in past the grid; the doors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { glslFunctions } from '../glsl.mjs';
import {
  FIRE, LAVA_FS, PLUME_FS, PLUME_VS, FIRE_PROGRAMS, fireUniforms, fireCrown, setFireCommon, RedMountainFire, coneIn, fireCone,
} from '../../src/render/redMountainFire.js';
import { GhostfenceGlow, GLOW_PROGRAMS, FENCE_CURTAIN_FS, GLOW } from '../../src/render/ghostfenceGlow.js';
import { RED_MOUNTAIN_DIALS as D, dirOf, redMountainCrown, coneProfile } from '../../src/world/tamriel/redMountain.js';
import { RING_SEA_GLSL, SUMMIT_HAZE } from '../../src/render/horizonHaze.js';
import { FarRingRenderer, builtCore, summitFromOf } from '../../src/render/farRing.js';
import { playPrograms } from '../../src/render/playPrograms.js';
import { TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { BAY_H } from '../../src/world/tamriel/tamrielFrame.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const LAKE_Y = D.lift - D.depth + FIRE.lakeOver;
/** The lava's fragment stage on the cone at (0, 0), the land at 0: `hide(eye, p, margin)` its own hidden(). */
function lavaAt() {
  const fns = glslFunctions(LAVA_FS, { ...fireUniforms(), uCone: [0, 0, 0, 1], uTime: 0, vWorld: [0, 0, 0], vInfo: [0, 0, 0, 0], vLocal: [0, 0] });
  return { fns, hide: (eye, p, m = FIRE.margin.lava) => { fns.globals.uEye = eye; return fns.hidden(p, m); } };
}
/** A WebGL2 context that records: every call [name, ...args], a uniform's location its name, every program linked. */
function recordingGl() {
  const calls = [];
  const gl = new Proxy({ drawingBufferHeight: 1080 }, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k !== 'string') return undefined;
      if (/^[A-Z_0-9]+$/.test(k)) return k;
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'getUniformLocation') return { name: a[1] };
        if (k === 'getProgramParameter' || k === 'getShaderParameter' || k === 'getExtension') return k !== 'getExtension';
        return {};
      };
    },
  });
  return { gl, calls };
}

test('AUDIT RED-MOUNTAIN F1: the far draw hides the crater from a far eye - the ray asked up to 300 m short of the point (it stopped at 97%: from 100 km the crater wall lay in the 3 km never asked), the eye\'s own ground given back at the eye and none by the rim (given back the whole ray, an eye on land 1,500 m under the centre\'s saw the lake through the summit) (mutants: the stop; the slack untapered)', () => {
  const { hide } = lavaAt();
  for (const dist of [40000, 60000, 100000, 150000]) {
    assert.equal(hide([dist, 0, 0], [D.floor * FIRE.lake * 0.9, LAKE_Y, 0]), true, `the lake's near edge from ${dist / 1000} km at sea level`);
  }
  const low = [60000, -1500 + 1.7, 0];
  assert.equal(hide(low, [0, LAKE_Y, 0]), true, 'the lake from low land 60 km off');
  assert.equal(hide(low, [0, LAKE_Y + 300, 0], FIRE.margin.plume), true, 'the plume\'s foot under the rim, from there');
  assert.equal(hide(low, [0, D.lift + 2000, 0], FIRE.margin.plume), false, 'the plume over the rim, from there');
  // a ray past the summit cone's side, 4 km from its centre and under its flank there, crossing no rim: the flank's own
  // steps hide it, the eye's slack none by then
  const q = [0, 3000, 4000], past = [low[0] + 1.2 * (q[0] - low[0]), low[1] + 1.2 * (q[1] - low[1]), 1.2 * q[2]];
  assert.equal(hide(low, past, FIRE.margin.plume), true, 'behind the flank, the slack tapered to the rim');
  assert.equal(FIRE.stop, 300);
});

test('AUDIT RED-MOUNTAIN F1 (the crown): the cone the far draw hides behind carries the crater\'s wander - the rim\'s lift by its direction, 64 samples round (the profile alone missed the ground by 160 m at the rim, 30 m with it) - so an eye on a low lobe of the rim sees the lake and a ray under a high lobe\'s crest is hidden (mutants: the crown unread; the crest uncrowned)', () => {
  const crown = fireCrown();
  assert.equal(crown.length, FIRE.crown);
  for (const i of [0, 17, 41]) { const [ux, uy] = dirOf(i / FIRE.crown); assert.equal(crown[i], Math.fround(redMountainCrown(ux, uy))); }
  let lo = 0, hi = 0;
  for (let i = 0; i < crown.length; i++) { if (crown[i] < crown[lo]) lo = i; if (crown[i] > crown[hi]) hi = i; }
  assert.ok(crown[hi] - crown[lo] > 0.04, `the rim wanders ${((crown[hi] - crown[lo]) * D.lift).toFixed(0)} m round`);
  const { fns, hide } = lavaAt();
  const [lx, lz] = dirOf(lo / FIRE.crown), r = D.rim + 5;
  const onLow = [lx * r, D.lift * crown[lo] + 1.7, lz * r];
  assert.equal(hide(onLow, [0, LAKE_Y, 0]), false, 'the lake from the low lobe\'s crest');
  // an eye high over the flank 20 km out on the high lobe: its ray to the lake's far side over the near rim at 4,460 m
  const [hx, hz] = dirOf(hi / FIRE.crown), far = [-hx * 1100, LAKE_Y, -hz * 1100];
  const ey = (4460 - LAKE_Y * ((20000 - D.rim) / 21100)) / (1 - (20000 - D.rim) / 21100), eye = [hx * 20000, ey, hz * 20000];
  assert.equal(hide(eye, far), true, 'under the high lobe\'s crest');
  fns.globals.uCrown = fns.globals.uCrown.map(() => [1, 1, 1, 1]);
  assert.equal(hide(onLow, [0, LAKE_Y, 0]), true, 'control: uncrowned, the low lobe\'s own eye loses the lake');
  assert.equal(hide(eye, far), false, 'control: uncrowned, the high lobe lets it through');
});

test('AUDIT RED-MOUNTAIN F2: past the streamed grid\'s built pixels the near draw has no depth either - the cone hides it there too; inside the built square (builtCore, the far ring\'s depth box) the world\'s depth does (it asked nothing in the near draw: lava behind the crater wall was drawn past the grid) (mutants: the box unread; the near draw\'s box empty; the core\'s ring)', () => {
  const { fns, hide } = lavaAt();
  const eye = [45000, 1500, 0], behind = [-(D.rim + 6000), 900, 0];
  assert.equal(hide(eye, behind), true, 'a river on the far flank, no depth box');
  fns.globals.uDepth = [-9000, -1000, -8000, 1000];
  assert.equal(hide(eye, behind), false, 'inside the box: the depth\'s to hide');
  fns.globals.uDepth = [40000, -1000, 50000, 1000];
  assert.equal(hide(eye, behind), true, 'the box about the eye: still the cone\'s');
  // the built square: a full map its radius, an unbuilt centre none, a hole two out the square one
  const all = new Set(); for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) all.add(`${10 + i},${20 + j}`);
  assert.equal(builtCore(all, 10, 20, 3), 3);
  assert.equal(builtCore(null, 10, 20, 3), 3, 'no map: the hole whole (inHole\'s)');
  assert.equal(builtCore(new Set(), 10, 20, 3), -1);
  const holed = new Set(all); holed.delete('12,19');
  assert.equal(builtCore(holed, 10, 20, 3), 1);
  // the box in the scene: the hole's pixels (12 +- 2, 13 +- 2) from base (10, 10) at the origin
  const box = FarRingRenderer.prototype._depthBox.call({ _depthR: 2, _holeX: 12, _holeY: 13, baseX: 10, baseY: 10 }, [0, 0, 0]);
  assert.deepEqual(Array.from(box), [0, -5 * TERRAIN_SIZE, 5 * TERRAIN_SIZE, 0].map(Math.fround));
  assert.equal(FarRingRenderer.prototype._depthBox.call({ _depthR: -1 }, [0, 0, 0]), null);
  assert.match(read('src/render/farRing.js'), /this\._depthR = builtCore\(built, holeX, holeY, holeRadius\);/);
  assert.match(read('src/render/farRing.js'), /depth: this\._depthBox\(origin\),/);
});

test('AUDIT RED-MOUNTAIN F4/F6: one haze in both draws, the far ring\'s own (its hold eased down over the summits, the summits\' thinner air eased in past the grid\'s edge), and an exact split - the far draw drops what is nearer than the world\'s far plane (the near draw\'s fog against the ring\'s ramp made a step there, and 0.98 to 1 of the far plane was drawn twice) (mutants: the haze\'s summit hold; the split; the ease)', () => {
  const ring = glslFunctions(RING_SEA_GLSL, { vWorld: [0, 0, 0], uOrigin: [0, -1500, 0], uSummitFrom: 3500, vSea: 0, vSeaBody: [0, 0, 0], uEye: [0, 0, 0], uSkyZenith: [0, 0, 0], uSkyHorizon: [0, 0, 0], uSeaF0: 0, uSeaLook: 0, uLightDir: [0, 1, 0], uMoonDir: [0, 1, 0], uMoonScale: 0 });
  const { fns } = lavaAt();
  Object.assign(fns.globals, { uHaze: [1000, 3200, 18000, 30000], uHold: [0.85, -1500, 3500] });
  for (const [d, alt] of [[2000, 500], [3500, 6000], [6000, 6000], [12000, 6500], [25000, 4000], [40000, 6800]]) {
    ring.globals.vWorld = [0, alt - 1500, 0];
    const want = Number(ring.horizonHaze(d, 1000, 3200, 18000, 30000, ring.summitHold(0.85, d)));
    assert.ok(Math.abs(Number(fns.hazeAt(d, alt - 1500)) - want) < 1e-9, `the ring's haze at ${d} m, ${alt} m up`);
  }
  // the summits' air: the ordinary hold at the grid's edge, the summit's past the ease
  ring.globals.vWorld = [0, 6600 - 1500, 0];
  assert.equal(Number(ring.summitHold(0.85, 3500)), 0.85, 'beside the grid as the ground beside it');
  assert.ok(Math.abs(Number(ring.summitHold(0.85, 3500 + SUMMIT_HAZE.ease)) - 0.85 * (1 - SUMMIT_HAZE.keep)) < 1e-9);
  assert.equal(summitFromOf(5), 5.5 * TERRAIN_SIZE);
  assert.match(read('src/render/farRing.js'), /gl\.uniform1f\(this\.u\.uSummitFrom, summitFromOf\(this\._floraRadius\)\);/);
  // the split: the far draw keeps what lies past the world's far plane alone
  fns.globals.uSplit = 4000;
  fns.globals.gl_FragCoord = [0, 0, 0.5, 1 / 3990];
  assert.equal(fns.nearDrawn(), true);
  fns.globals.gl_FragCoord = [0, 0, 0.5, 1 / 4010];
  assert.equal(fns.nearDrawn(), false);
  // both draws hand the same haze; the far its split and no depth, the near its box and no split
  const { gl, calls } = recordingGl();
  const pass = { eye: [0, 0, 0], fog: { color: [0.5, 0.5, 0.5], start: 1000, end: 3200 }, rim: [18000, 30000], hold: 0.85, ringOrigin: [0, -1500, 0], summitFrom: 3500, worldFar: 4000, depth: new Float32Array([-1, -2, 3, 4]) };
  const U = Object.fromEntries(['uVP', 'uEye', 'uCone', 'uDepth', 'uFogColor', 'uHaze', 'uHold', 'uSplit'].map((n) => [n, { name: n }]));
  const of = (isFar) => { calls.length = 0; setFireCommon(gl, U, pass, isFar, new Float32Array(16), null); return Object.fromEntries(calls.map((c) => [c[1].name, c.slice(2)])); };
  const far = of(true), near = of(false);
  assert.deepEqual(far.uHaze, near.uHaze); assert.deepEqual(far.uHold, near.uHold);
  assert.deepEqual(far.uHaze, [1000, 3200, 18000, 30000]); assert.deepEqual(far.uHold, [0.85, -1500, 3500]);
  assert.deepEqual(far.uSplit, [4000]); assert.deepEqual(near.uSplit, [0]);
  assert.deepEqual(far.uDepth, [1, 1, -1, -1], 'the far draw: no depth anywhere'); assert.deepEqual(near.uDepth, [-1, -2, 3, 4]);
  assert.deepEqual(far.uCone.at(-1), 0, 'no cone: nothing asked');
  for (const fs of [LAVA_FS, PLUME_FS, FENCE_CURTAIN_FS]) assert.match(fs, /nearDrawn\(\) \|\| hidden\(vWorld/);
});

test('AUDIT RED-MOUNTAIN F3: the plume is drawn its far side first and its near side over it, in each lens - the fragment stage keeps one side by uFace (drawn unsorted, its far face lay over its near on half the column); the lava before it; nothing drawn when the plume lies wholly past the far lens (mutants: the side\'s test; the draws\' order; the reach)', () => {
  const fs = glslFunctions(PLUME_FS, { ...fireUniforms(), uTime: 0, uLight: 1, uLightDir: [0, 1, 0], uFoot: [0, 0, 0], vUV: [0.3, 0.4], vWorld: [1000, 3000, 0], vNormal: [1, 0, 0], uEye: [50000, 2000, 0], uFace: 1 });
  const kept = () => { try { fs.main(); return true; } catch (e) { if (e.name === 'GlslDiscard') return false; throw e; } };
  assert.equal(kept(), true, 'its near side, facing the eye, in the near side\'s draw');
  fs.globals.uFace = -1;
  assert.equal(kept(), false, 'not in the far side\'s');
  fs.globals.vNormal = [-1, 0, 0];
  assert.equal(kept(), true, 'its far side in the far side\'s draw');
  const { gl, calls } = recordingGl();
  const fire = new RedMountainFire(/** @type {any} */ (gl));
  fire.mesh = { px: 0, py: 0, centre: [0, 3800, 0], base: 0, count: 9, lava: new Float32Array(90) };
  const pass = { ringOrigin: [0, 0, 0], baseX: 0, baseY: 0, view: new Float32Array(16), worldProj: Float32Array.from({ length: 16 }, (_, i) => (i === 10 ? -1 : i === 14 ? -8000 : 0)), worldFar: 4000, fovY: 1, aspect: 1.5, far: 200000, eye: [30000, 1000, 0],
    fog: { color: [0, 0, 0], start: 0, end: 3000 }, rim: [1e5, 2e5], hold: 0.85, summitFrom: 3500, depth: null, light: 0.5, lightDir: [0, 1, 0], seconds: 12 };
  calls.length = 0;
  fire.draw(pass);
  const seq = calls.filter((c) => c[0] === 'drawArrays' || (c[0] === 'uniform1f' && c[1].name === 'uFace') || c[0] === 'depthRange').map((c) => (c[0] === 'drawArrays' ? `draw ${c[3]}` : c[0] === 'depthRange' ? `range ${c[1]}` : `face ${c[2]}`));
  const plume = fire.plumeCount;
  assert.deepEqual(seq, ['range 1', 'draw 9', 'face -1', `draw ${plume}`, 'face 1', `draw ${plume}`, 'range 0', 'draw 9', 'face -1', `draw ${plume}`, 'face 1', `draw ${plume}`, 'range 0'], 'per lens: the lava, the far side, the near side');
  calls.length = 0;
  fire.draw({ ...pass, eye: [200000 + 30000, 1000, 0] });
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 0, 'past the far lens\'s reach, nothing');
});

test('AUDIT RED-MOUNTAIN F5/F9: the fire\'s and the glow\'s programs started at the boot\'s idle with the passes play meets, their passes built through compiledPass doors (four programs compiled on first draw, mid-frame, anywhere); the cone apart from the fire, so the glow hides behind it with ?redfire=off, and with no cone the glow has no far draw (nothing past the far plane would hide it) (mutants: the cone off with the fire; the far draw without a cone)', () => {
  const pp = playPrograms();
  for (const pair of [...FIRE_PROGRAMS, ...GLOW_PROGRAMS]) assert.ok(pp.includes(pair), 'started early');
  const ring = read('src/render/farRing.js');
  const coneNow = ring.slice(ring.indexOf('  _coneNow() {'), ring.indexOf('  _fireNow(cone) {'));
  assert.ok(coneNow.length > 0 && !/_fireOff/.test(coneNow), 'the cone stands with the fire off');
  const { gl, calls } = recordingGl();
  const glow = new GhostfenceGlow(/** @type {any} */ (gl));
  glow.mesh = { px: 0, py: 0, curtainOf: new Int32Array(6), haloOf: new Int32Array(6) };
  glow._frame = { cx: 0, cy: BAY_H * 128 };   // its centre at the mesh pixel's south-west corner
  glow._feetFor = () => {};
  const pass = { ringOrigin: [0, 0, 0], baseX: 0, baseY: 0, view: new Float32Array(16), worldProj: Float32Array.from({ length: 16 }, (_, i) => (i === 10 ? -1 : i === 14 ? -8000 : 0)), worldFar: 4000, fovY: 1, aspect: 1.5, far: 200000, eye: [0, 0, 0],
    fog: { color: [0, 0, 0], start: 0, end: 3000 }, rim: [1e5, 2e5], hold: 0.85, summitFrom: 3500, depth: null, light: 0, seconds: 0, ground: { ring: {} }, morph: null };
  const draws = (cone) => { calls.length = 0; glow.draw({ ...pass, cone }); return calls.filter((c) => c[0] === 'drawArrays').length; };
  assert.equal(draws([0, 0, 0]), 4, 'with the cone: both lenses');
  assert.equal(draws(null), 2, 'without: the world\'s lens alone');
  // the cone in the scene, the fire's own place for it
  const cone = { px: 3, py: 4, centre: [100, 4000, 200], base: 3300 };
  assert.deepEqual(coneIn(cone, [10, 20, 30], 1, 1), [10 + 2 * TERRAIN_SIZE + 100, 30 - 3 * TERRAIN_SIZE + 200, 20 + 3300]);
  assert.equal(typeof fireCone, 'function');
});

test('AUDIT RED-MOUNTAIN F8/F10: the rivers\' flow on a whole number of turns a period (x1.6 wrapped mid-phase: every 90 s it jumped); the plume\'s foot within its crater\'s floor, lumps and all, its swell from the rim up (it was wider than the crater and draped the summit) (mutants: the clock\'s turns; the swell\'s start; the foot)', () => {
  const lava = glslFunctions(LAVA_FS, { ...fireUniforms(), uTime: 0, vWorld: [0, 4000, 0], vInfo: [0.4, 0.3, 200, 1], vLocal: [10, 20], uEye: [0, 4100, 0] });
  const colour = (t) => { lava.globals.uTime = t; lava.main(); return Array.from(lava.globals.o).map(Number); };
  const a = colour(0), b = colour(1 - 1e-9);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-5, `the river's colour across the period's wrap: ${v} and ${b[i]}`));
  assert.ok(FIRE.plume.footR * (1 + FIRE.plume.lump) < D.floor, 'the foot inside the floor');
  const pv = glslFunctions(PLUME_VS, { uFoot: [0, 0, 0], uEye: [0, 0, 60000], uTime: 0.3, uVP: Array(16).fill(0), aUV: [0, 0] });
  for (const h of [0, 0.04, D.depth / FIRE.plume.height]) {
    for (const u of [0, 0.25, 0.5, 0.75]) {
      const at = pv.placeAt([u, h]).map(Number), axis = pv.axisAt(h).map(Number);
      assert.ok(Math.hypot(at[0] - axis[0], at[2] - axis[2]) <= FIRE.plume.footR * (1 + FIRE.plume.lump) + 1e-6, `under the rim at ${h}: no wider than its foot`);
    }
  }
  const top = pv.placeAt([0.37, 1]).map(Number), axis = pv.axisAt(1).map(Number);
  assert.ok(Math.hypot(top[0] - axis[0], top[2] - axis[2]) > FIRE.plume.topR * (1 - FIRE.plume.lump) - 1, 'its top as wide as it was');
});

test('AUDIT RED-MOUNTAIN F7: the plume closed into the sky by the ring\'s rim as the land under it is - its least share of the haze (hazeFloor) kept only short of the rim (it hung half-drawn in an empty sky past the land\'s end) (mutant: the rim\'s close)', () => {
  const fs = glslFunctions(PLUME_FS, { ...fireUniforms(), uHaze: [0, 3000, 18000, 30000], uHold: [0.85, 0, 1e9], uTime: 0, uLight: 1, uLightDir: [0, 1, 0], uFoot: [0, 0, 0], vUV: [0.3, 0.4], vNormal: [1, 0, 0], uFace: 1 });
  const alphaAt = (d) => { fs.globals.uEye = [d, 3000, 0]; fs.globals.vWorld = [0, 3000, 0]; fs.main(); return Number(fs.globals.o[3]); };
  const mid = alphaAt(12000), past = alphaAt(30001);
  assert.ok(mid > 0, 'drawn short of the rim');
  assert.equal(past, 0, 'none past it');
});

// ── THE FENCE STOOD AND DRAWN (N) ─────────────────────────────────

test('AUDIT RED-MOUNTAIN N1: the curtain\'s solid follows its ground - on a gullied pixel every point of every run\'s line has the solid 4 m under its ground and its top 22 m over it (one flat quad a run on its two feet left 20 runs open 1.8 m and more under it, worst 32.9 m, and ridges buried its top: walked through at 22 runs) (mutants: the pieces\' cuts; their ground\'s extremes; the margins)', async () => {
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const { ghostfenceFrame, ghostfencePanel, ghostfenceRunCuts, sampleToPixel } = await import('../../src/world/tamriel/ghostfence.js');
  const { standGhostfence, CURTAIN_SOLID_TOP } = await import('../../src/scenes/ghostfenceBuild.js');
  const { CURTAIN } = await import('../../src/world/tamriel/ghostfenceModel.js');
  const { surfaceHeightAt } = await import('../../src/world/terrain/terrainSurface.js');
  const { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } = await import('../../src/world/terrain/terrainSampler.js');
  const f = ghostfenceFrame(), W = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, hDim = 129, S = TERRAIN_SIZE / 128;
  // gullies: a plane cut every few samples by a trench 30 m deep, and a ridge 25 m high beside it
  const samples = new Float32Array(hDim * hDim);
  for (let x = 0; x < hDim; x++) for (let z = 0; z < hDim; z++) samples[x * hDim + z] = 0.4 + (0.3 * x * S + 0.2 * z * S + (x % 5 === 2 ? -30 : x % 5 === 4 ? 25 : 0) + (z % 7 === 3 ? -20 : 0)) / W;
  let checked = 0;
  for (const k of [...f.band].slice(0, 12)) {
    const [px, py] = k.split(',').map(Number), parts = [];
    standGhostfence({ px, py, pkey: k, key: k, samples, renderer: null, addStatic: () => {}, unionBox: () => {}, late: { add: (key, pos, idx, m) => { if (m[12] === 0 && m[13] === 0 && m[14] === 0) parts.push(pos); } }, translation: null });   // the curtain's (in the pixel's frame), not the pylons' (on their feet)
    const quads = parts.flatMap((p) => Array.from({ length: p.length / 12 }, (_, q) => p.subarray(12 * q, 12 * q + 12)));
    const ox = px * 128, oy = (BAY_H - py) * 128;
    for (const i of f.runsBy.get(k)) {
      const [[ax, ay], [bx, by]] = ghostfencePanel(f, i), len = Math.hypot(bx - ax, by - ay) * S;
      for (let s = 0; s <= len; s += 0.25) {
        const t = s / len, gx = ax + (bx - ax) * t, gy = ay + (by - ay) * t;
        if (sampleToPixel(gx, gy).join() !== k) continue;
        const x = (gx - ox) * S, z = (gy - oy) * S, g = surfaceHeightAt(samples, Math.max(0, Math.min(TERRAIN_SIZE, x)), Math.max(0, Math.min(TERRAIN_SIZE, z)));
        const q = quads.find((c) => { const u = ((x - c[0]) * (c[3] - c[0]) + (z - c[2]) * (c[5] - c[2])) / ((c[3] - c[0]) ** 2 + (c[5] - c[2]) ** 2); const ex = c[0] + (c[3] - c[0]) * u - x, ez = c[2] + (c[5] - c[2]) * u - z; return u >= -1e-4 && u <= 1 + 1e-4 && ex * ex + ez * ez < 1e-4; });
        assert.ok(q, `run ${i} at ${s.toFixed(2)} m: a piece over it`);
        assert.ok(q[1] <= g + CURTAIN.from + 1e-2 && q[7] >= g + CURTAIN_SOLID_TOP - 1e-2, `run ${i} at ${s.toFixed(2)} m: the solid ${q[1].toFixed(1)}..${q[7].toFixed(1)} about its ground ${g.toFixed(1)}`);
        checked++;
      }
    }
    assert.ok(ghostfenceRunCuts(f, f.runsBy.get(k)[0]).length >= 18);
  }
  assert.ok(checked > 5000, `${checked} points`);
});

test('AUDIT RED-MOUNTAIN N2: the Ghostfence\'s glow drawn after the water and the flats (it writes no depth: drawn before them, farther flats and water painted over it) - the far ring arms the renderer\'s one-shot slot, run at the end of the frame\'s next drawBillboards and let go by the next frame; the glow puts the world\'s state back after it (mutants: the slot unrun; the frame\'s let-go; the glow drawn in the ring\'s pass)', () => {
  const r = read('src/render/renderer.js');
  assert.match(r, /afterFlats\(fn\) \{ this\._afterFlats = fn; \}/);
  const body = r.slice(r.indexOf('  drawBillboards(batches, camRight, camUp) {'), r.indexOf('  /** Draw one placed mesh: bind per-submesh texture, indexed draw per range. */'));
  assert.match(body, /this\._use\(this\.program\);\n {4}const after = this\._afterFlats;\n {4}if \(after\) \{ this\._afterFlats = null; after\(\); this\.markForeignPass\(\); this\._use\(this\.program\); \}[^\n]*\n {2}\}\n\n$/);
  assert.match(r, /beginFrame\(proj, view, lightDir, opts = null\) \{\n {4}this\._close2D\(\);[^\n]*\n {4}this\._afterFlats = null;/);
  const ring = read('src/render/farRing.js');
  assert.match(ring, /if \(fence && this\.renderer\?\.afterFlats\) this\.renderer\.afterFlats\(\(\) => fence\.draw\(pass\)\);/);
  const w = read('src/scenes/world.js');
  assert.ok(w.indexOf('frameRing();') < w.indexOf('frameWater();') && w.indexOf('frameWater();') < w.indexOf('renderer.drawBillboards(allBatches, camRight, bbUp);'), 'the ring, the water, the flats');
  const g = read('src/render/ghostfenceGlow.js');
  assert.match(g, /gl\.depthMask\(true\);\n\s*gl\.depthFunc\(gl\.LESS\);\n\s*gl\.enable\(gl\.CULL_FACE\);/);
});

// ── THE FENCE'S LAW AND THE LAND (G, L) ───────────────────────────

test('AUDIT RED-MOUNTAIN G1/G2: no spawned ruin on the Ghostfence\'s line (createSpawnGround, every spawn reader\'s ground: 42 stood on it) and the Overworld\'s route planner across it only at Ghostgate (routeGround\'s openBlocked: an open step into its line refused but at the gate; it walked straight across) (mutants: the spawns\' refusal; the planner\'s; the gate\'s open set)', async () => {
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const { ghostfenceFrame, ghostfenceShuts, insideGhostfence } = await import('../../src/world/tamriel/ghostfence.js');
  const { createSpawnGround } = await import('../../src/world/spawnedDungeons.js');
  const { routeGround, planRoute } = await import('../../src/systems/travel/travelRoute.js');
  const f = ghostfenceFrame();
  const unread = new Proxy({}, { get: () => { throw new Error('the ground read'); } });
  const ground = createSpawnGround(unread);
  for (const k of [...f.band].slice(0, 20)) { const [x, y] = k.split(',').map(Number); assert.equal(ground(x, y), false, `no ruin on the line at ${k}, its ground unread`); }
  assert.match(read('src/world/spawnedDungeons.js'), /dry\.set\(key, d = !onGhostfence\(px, py\) && !redMountainLavaIn\(px, py\) && spawnGroundDry\(woods, px, py\)\);/);   // PIN MOVED (LAVA-CLEAR): nor on the lava's pixels
  const { openBlocked } = routeGround(() => 0, () => 100, 20);
  const shut = [...f.band].find((k) => !f.open.has(k)).split(',').map(Number), gate = f.gatePixel.split(',').map(Number);
  assert.equal(openBlocked(shut[0] + 1, shut[1], shut[0], shut[1]), true, 'onto the line');
  assert.equal(openBlocked(gate[0], gate[1] + 1, gate[0], gate[1]), false, 'onto Ghostgate');
  assert.equal(openBlocked(0, 0, 1, 1), false, 'anywhere else');
  assert.equal(ghostfenceShuts(shut[0], shut[1]), true);
  // a route from outside the fence to inside it: through Ghostgate's pixels alone
  const [cx, cy] = [Math.floor(f.cx / 128), Math.floor(BAY_H + 1 - f.cy / 128)];
  const from = { x: f.x1 + 6, y: cy }, to = { x: cx + 3, y: cy };
  assert.ok(!insideGhostfence(from.x, from.y) && insideGhostfence(to.x, to.y));
  const plan = planRoute(from, to, { isWater: () => false, openBlocked });
  assert.ok(plan?.pixels.length, 'a way in');
  const onLine = plan.pixels.filter((p) => f.band.has(`${p.x},${p.y}`));
  assert.ok(onLine.length > 0 && onLine.every((p) => f.open.has(`${p.x},${p.y}`)), `onto the line only at the gate: ${onLine.map((p) => `${p.x},${p.y}`)}`);
  const straight = planRoute(from, to, { isWater: () => false });
  assert.ok(straight.pixels.some((p) => f.band.has(`${p.x},${p.y}`) && !f.open.has(`${p.x},${p.y}`)), 'control: unrefused, it crosses the line');
});

test('AUDIT RED-MOUNTAIN L1: the snow never lies on Red Mountain\'s ash - each lattice point\'s lines lifted to bare ground by the share of the volcano\'s zone about it (the fire cancelled the cone\'s own height alone: on the coldest day the crater, the rim and the flank lay white, 100 %, 98 %, 99.9 %); L6: the summit that centres it read in squared distances (Math.hypot in a ground source) (mutants: the share; the lift; the host unwired)', async () => {
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const { ashShareAt, bareLine } = await import('../../src/world/peaks/snowcap.js');
  const { tamrielBiomeAt } = await import('../../src/world/tamriel/tamrielBiomes.js');
  const { redMountainFrame } = await import('../../src/world/tamriel/redMountain.js');
  const rm = redMountainFrame(), cx = Math.floor(rm.bx), cy = Math.floor(rm.by);
  for (const [x, y] of [[cx, cy], [cx + 1, cy + 1], [cx + 40, cy], [100, 100]]) {
    const want = [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]].filter(([a, b]) => tamrielBiomeAt(a, b)?.key === 'morrowindRedMountain').length / 4;
    assert.equal(ashShareAt(x, y), x === 100 ? 0 : want, `the ash's share at ${x},${y}`);
  }
  assert.equal(ashShareAt(cx + 1, cy + 1), 1, 'the summit wholly the volcano\'s');
  assert.deepEqual(bareLine([100, 200, 300], 0.5, 8200), [4150, 4200, 4250]);
  assert.deepEqual(bareLine([100, 200, 300], 0, 8200), [100, 200, 300]);
  const host = read('src/scenes/snowCoverHost.js');
  assert.equal((host.match(/bareLine\(mergeCapLine\(snowlineOf\([^\n]*\), l\.cap\), l\.ash, BARE_LINE\[0\]\);/g) ?? []).length, 2, 'the frames\' lines and the builds\'');
  assert.match(host, /ash: ashOf\(pt\.i \* S, pt\.j \* S\)/);
  const relief = read('src/world/tamriel/tamrielRelief.js'), body = relief.slice(relief.indexOf('export function namedSummit('), relief.indexOf('\n}\n', relief.indexOf('export function namedSummit(')));
  assert.ok(!/Math\.hypot|\*\*/.test(body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), 'namedSummit squared');
});

const A = process.env.ARENA2_PATH;
const HAVE = !!A && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((n) => existsSync(join(A, n)));

test('AUDIT RED-MOUNTAIN L5 with ARENA2: no carved water within the volcano\'s reach on the freeware\'s trace - a lake or a river the waters\' law carved there would cut the cone away (none does today; the pin holds it so)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(A, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { redMountainFrame, RED_MOUNTAIN_REACH } = await import('../../src/world/tamriel/redMountain.js');
  const { tamrielWatersShaper } = await import('../../src/world/tamriel/tamrielWaters.js');
  const G = await import('../../src/world/tamriel/tamrielGround.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  setTamrielTrace(trace);
  try {
    G.dropGroundCache();
    G.groundMaps(maps);
    const f = redMountainFrame(), cx = Math.floor(f.bx), cy = Math.floor(f.by), r = Math.ceil(RED_MOUNTAIN_REACH / TERRAIN_SIZE);
    const wet = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (tamrielWatersShaper(cx + dx, cy + dy, 128)) wet.push(`${cx + dx},${cy + dy}`);
    assert.deepEqual(wet.slice(0, 5), [], `${wet.length} carved pixels within the reach`);
  } finally { setTamrielTrace(null); setTamrielFit(null); G.dropGroundCache(); }
});

// ── THE RECORD (R) ────────────────────────────────────────────────

test('AUDIT RED-MOUNTAIN R1: the plume\'s look and the glow\'s run on their own sources - its puffs thin at the column\'s edge and none under their noise\'s floor, its body faded in over its foot and out to its top, lit by the frame with its sunward side brighter, the fire in its foot falling with height and outshone by day, its billows the same about its foot wherever the world stands it; the curtain\'s strands thickest low and gone at its foot and top, the glow\'s night and its fade (the billows\' check asked nothing: it moved a foot the function never read) (mutants: the puff\'s floor; the edge; the body; the sun\'s side; the ember\'s fall; the day; the curtain\'s body; the fade)', () => {
  const fs = glslFunctions(PLUME_FS, { ...fireUniforms(), uTime: 0, uLight: 1, uLightDir: [0, 1, 0], uFoot: [0, 0, 0], vUV: [0, 0], vWorld: [0, 0, 0], vNormal: [1, 0, 0], uFace: 1 });
  const n = (v) => Number(v);
  assert.equal(n(fs.puffOf(0.3, 1)), 0, 'under the noise\'s floor, no puff');
  assert.equal(n(fs.puffOf(0.7, 1)), 1);
  assert.ok(n(fs.puffOf(0.5, 1)) > 0 && n(fs.puffOf(0.5, 1)) < 1 && n(fs.puffOf(0.45, 1)) < n(fs.puffOf(0.55, 1)), 'growing with its noise');
  assert.equal(n(fs.puffOf(0.7, 0)), 0, 'none at the column\'s edge');
  assert.equal(n(fs.bodyOf(0)), 0); assert.equal(n(fs.bodyOf(1)), 0); assert.equal(n(fs.bodyOf(0.3)), 1);
  assert.ok(n(fs.bodyOf(FIRE.plume.foot / FIRE.plume.height / 2)) < 1, 'faded in over its foot');
  assert.ok(Math.abs(n(fs.litOf(0, 1)) - FIRE.lightMin) < 1e-9, 'at night its least');
  assert.ok(Math.abs(n(fs.litOf(1, -1)) - FIRE.shade) < 1e-9 && n(fs.litOf(1, 1)) === 1, 'its side from the sun the darker');
  const ember = (h, light) => fs.emberOf(h, 1, 1, light).map(Number)[0];
  assert.ok(Math.abs(ember(0.3, 0) / ember(0.1, 0) - Math.exp(-0.2 * FIRE.plume.height / FIRE.emberM)) < 1e-6, 'falling with height');
  assert.ok(Math.abs(ember(0.1, 1) / ember(0.1, 0) - FIRE.dayGlow) < 1e-6, 'a day leaves dayGlow of it');
  // the billows about the foot: the column the same wherever its foot stands
  const pv = glslFunctions(PLUME_VS, { uFoot: [100, 2000, -300], uEye: [100, 2000, 60000], uTime: 0.3, uVP: Array(16).fill(0), aUV: [0, 0] });
  const rel = (uv) => { const p = pv.placeAt(uv).map(Number), f = pv.globals.uFoot; return [p[0] - f[0], p[1] - f[1], p[2] - f[2]]; };
  const here = [[0.1, 0.2], [0.6, 0.5], [0.9, 0.9]].map(rel);
  pv.globals.uFoot = [5100, 2600, 4700]; pv.globals.uEye = [5100, 2600, 65000];
  [[0.1, 0.2], [0.6, 0.5], [0.9, 0.9]].map(rel).forEach((p, i) => p.forEach((v, k) => assert.ok(Math.abs(v - here[i][k]) < 1e-6, 'the same about its foot')));
  // the curtain
  const cf = glslFunctions(FENCE_CURTAIN_FS, { ...fireUniforms(), uTime: 0, uLight: 0, vWorld: [0, 0, 0], vSide: [0, 0] });
  assert.equal(n(cf.curtainOf([10, 0], 0.9)), 0, 'none at its foot'); assert.equal(n(cf.curtainOf([10, 1], 0.9)), 0, 'none at its top');
  assert.ok(n(cf.curtainOf([10, 0.4], 0.9)) > n(cf.curtainOf([10, 0.85], 0.9)), 'thickest low');
  assert.ok(n(cf.curtainOf([10, 0.4], 0.9)) > n(cf.curtainOf([10, 0.4], 0.1)), 'brighter where its flow rises');
  assert.equal(n(cf.nightOf(0)), 1); assert.ok(Math.abs(n(cf.nightOf(1)) - GLOW.dayGlow) < 1e-9);
  const lightAt = (d) => { Object.assign(cf.globals, { uEye: [d, 0, 0], vWorld: [0, 0, 0], vSide: [10, 0.4] }); try { cf.main(); return Number(cf.globals.o[1]); } catch (e) { if (e.name === 'GlslDiscard') return 0; throw e; } };
  assert.ok(lightAt(GLOW.fade[0] / 2) > 0 && lightAt((GLOW.fade[0] + GLOW.fade[1]) / 2) < lightAt(GLOW.fade[0] / 2), 'faded with the distance');
  assert.equal(lightAt(GLOW.fade[1] + 1), 0, 'none past its fade');
});

test('AUDIT RED-MOUNTAIN R5: the gullies down the flank - none at the rim\'s lip, cut and ridged within their depth (0.8 of it under the smooth cone, 1.2 over) and varied round the mountain past it, none past their reach - on the law itself, away from the foyada (they were unpinned) (mutants: the lip\'s ease; the depth; the reach)', async () => {
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const { redMountainFrame, redMountainGround, redMountainLand, redMountainSmooth } = await import('../../src/world/tamriel/redMountain.js');
  const { STREAMING_TERRAIN_SCALE: UNIT } = await import('../../src/world/terrain/terrainSampler.js');
  const f = redMountainFrame(), ground = redMountainGround(() => 0, {}), M = TERRAIN_SIZE / 128;
  const nearFoyada = (gx, gy) => f.foyada.some((l) => { for (let i = 0; i < l.pts.length; i += 2) if (((l.pts[i] - gx) * M) ** 2 + ((l.pts[i + 1] - gy) * M) ** 2 < 700 * 700) return true; return false; });
  const gullyAt = (d, turn) => {
    const [ux, uy] = dirOf(turn), r = D.rim + d, gx = f.cx + (ux * r) / M, gy = f.cy + (uy * r) / M;
    if (nearFoyada(gx, gy)) return null;
    return (redMountainLand(gx, gy, 0, 0, ground) - redMountainSmooth(gx, gy)) * UNIT;
  };
  const ring = (d) => Array.from({ length: 180 }, (_, k) => gullyAt(d, k / 180)).filter((v) => v !== null);
  assert.ok(ring(2).every((g) => Math.abs(g) < 0.5), 'none at the rim\'s lip');
  const mid = ring(3000);
  assert.ok(mid.every((g) => g >= -0.8 * D.gully.depth - 1e-6 && g <= 1.2 * D.gully.depth + 1e-6), 'within their depth');
  assert.ok(Math.max(...mid) - Math.min(...mid) > D.gully.depth, `cut and ridged round the mountain: ${Math.min(...mid).toFixed(1)}..${Math.max(...mid).toFixed(1)} m`);
  assert.ok(ring(D.gully.reach + 200).every((g) => Math.abs(g) < 1e-6), 'none past their reach');
});

test('AUDIT RED-MOUNTAIN R2: the rim\'s crest asked on its own - an eye 20 km out, 300 m over the flank, its ray to the plume over the crater\'s far side passing under the crowned crest between the profile\'s samples: the crest hides it, the steps alone would not (the record marked it equivalent; 198 of 2,640 rays round the mountain turn on it) (mutant: the crest unasked)', () => {
  const crown = fireCrown(), { fns, hide } = lavaAt();
  fns.globals.uEye = [0, 0, 0];
  const eye = [20000, coneProfile(20000 - D.rim) * crown[0] + 300, 0];
  assert.equal(hide(eye, [-300, 4900, 0], FIRE.margin.plume), true, 'under the crest');
  assert.equal(hide(eye, [-300, 9000, 0], FIRE.margin.plume), false, 'control: the plume high over it, seen');
});
