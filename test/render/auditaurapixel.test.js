// @ts-check
// The pixel law's harder cases, the riders and the sprite's arm and chest, each pinned on the code that runs - the
// shaders RUN (test/glsl.mjs), the pass over a logging GL, the bench's own glue. The GPU's frames are
// tools/auraProbe.mjs's, tools/armoryProbe.mjs's and tools/armorySpriteProbe.mjs's.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from '../glsl.mjs';
import { AURA_PIXEL_GLSL, AURA_PIXEL_STEPS, AURA_CARD_TEXELS, AURA_CLOTH_TEXELS, AURA_STRAND_TEXELS, AURA_TEXEL_M } from '../../src/render/auraPixel.js';
import { AURA_FS, AURA_LOOK, AURA_GROUND_R, RADIANCE_R, RADIANCE_H, AuraRingRenderer } from '../../src/render/auraRing.js';
import { armoryDraws, armoryPrograms, armWornSide, ARMORY_PIECE_INDEX } from '../../src/render/armoryPass.js';
import { newPose, POSE_AT } from '../../src/render/armoryPose.js';
import { createAuraHost, peerMounted } from '../../src/scenes/auraHost.js';
import { createHorseCartPool } from '../../src/scenes/horseCartPool.js';
import { HCC_WIRE_KIND } from '../../src/systems/horse/horseCartWire.js';

const TAU = Math.PI * 2;
const near = (/** @type {number} */ a, /** @type {number} */ b, e = 1e-6) => Math.abs(a - b) <= e;
const LV = Array.from({ length: AURA_PIXEL_STEPS + 1 }, (_, k) => (k / AURA_PIXEL_STEPS) ** 2);
/** Derivatives of a surface whose coordinate moves `dp` (per screen x, y) as its world point moves `dw`. */
const deriv = (/** @type {number[][]} */ dp, /** @type {number[][]} */ dw) => ({
  dFdx: (/** @type {number[]} */ v) => (v.length === 2 ? dp[0] : dw[0]),
  dFdy: (/** @type {number[]} */ v) => (v.length === 2 ? dp[1] : dw[1]),
});

test('AUDIT AURA-PIXEL A1/A5/D3: a card at its least count however small it grows (16 for 0.16 m would be 8), a big glow measured; the cloth at its own count; a wing\'s strand snapped along it and never across, so its core is never lost (mutants: a card measured alone; the strand snapped across; the cloth measured)', () => {
  const s = 0.0004;
  const run = (/** @type {number} */ kind, /** @type {number} */ aura, /** @type {number[]} */ vP, /** @type {number} */ metres) => {
    const f = glslFunctions(AURA_FS, { uKind: kind, uAura: aura, vP, vWorld: [0, 1, 0], gl_FragCoord: [10.5, 10.5, 0, 1], ...deriv([[s / metres, 0], [0, s / metres]], [[s, 0, 0], [0, s, 0]]) });
    return { t: f.auraSnapOf(), cell: f.globals.auraCell };
  };
  const p = [0.37, 0.71];
  for (const m of [0.16, 0.2, 0.26]) assert.deepEqual(run(2, 1, p, m).cell, p.map((v) => Math.floor(v * AURA_CARD_TEXELS)), `a ${m} m card: ${AURA_CARD_TEXELS} a side whatever its size`);
  assert.deepEqual(run(2, 4, p, 1.2).cell, p.map((v) => Math.floor(v * 64)), 'the wings\' 1.2 m backlight measured: never coarser than a flat\'s pixel');
  assert.deepEqual(run(1, 3, p, 1.9).cell, p.map((v) => Math.floor(v * AURA_CLOTH_TEXELS)), 'the cloak\'s cloth at its own count');
  const strand = run(1, 4, p, 0.03);
  assert.ok(near(strand.t[0], p[0], 0) && near(strand.t[1], (Math.floor(p[1] * AURA_STRAND_TEXELS) + 0.5) / AURA_STRAND_TEXELS, 1e-9), `a strand: across as it is, along snapped (${strand.t})`);
});

test('AUDIT AURA-PIXEL A2: under the law a look\'s own lines are at least a texel wide - a point half a texel off the Golden Radiance\'s fine ring is lit by it, where per pixel it is dark; and the texel\'s side is what the snap hands the looks (mutants: auraPx never set; the radiance\'s pixel not floored by it)', () => {
  const s = 0.0015;
  const f = glslFunctions(AURA_FS, {
    vP: [0, 0], vWorld: [0, 0.05, 0], vS: [0, 0, 0], uKind: 0, uAura: 2, uTime: 30, uSeed: 0.37, uKindle: 1, uRingR: RADIANCE_R, uGroundR: AURA_GROUND_R, uFlameH: RADIANCE_H,
    uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 3, 3], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], gl_FragCoord: [10.5, 10.5, 0, 1],
    ...deriv([[s, 0], [0, s]], [[s, 0, 0], [0, 0, s]]),
  });
  f.auraTexel([0.3, 0.1], [0.3, 0.05, 0.1], AURA_TEXEL_M, [1, 1]);
  const texel = f.globals.auraPx;
  assert.ok(near(texel, 1 / 64, 1e-9), `the ground's texel handed on: ${texel}`);
  const r = RADIANCE_R - 0.071 + texel / 2, a = 0.9, p = [Math.cos(a) * r, Math.sin(a) * r];
  f.globals.auraPx = 0; const off = f.radianceGround(p);
  f.globals.auraPx = texel; const on = f.radianceGround(p);
  assert.ok(on[0] - off[0] > 0.02, `half a texel off the ring: lit under the law (${off[0].toFixed(3)} -> ${on[0].toFixed(3)})`);
});

test('AUDIT AURA-PIXEL D3: the levels weighed in light - over the dither\'s sixteen cells a light\'s mean holds, and a faint glow is not dotted out to the first level (mutants: weighed by the root; the dither\'s offset dropped)', () => {
  const f = glslFunctions(AURA_PIXEL_GLSL, {});
  const mean = (/** @type {number} */ l) => { let m = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { f.globals.auraCell = [x, y]; m += f.auraLevels([l, l * 0.5, 0])[0]; } return m / 16; };
  for (const l of [0.3, 0.05, 0.6]) assert.ok(Math.abs(mean(l) - l) < 0.035 * l + 0.004, `${l}: its mean ${mean(l).toFixed(4)}`);
  assert.equal(mean(0.0003), 0, 'a glow under a thirtieth of the first level: nothing lit');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { f.globals.auraCell = [x, y]; const o = f.auraLevels([0.3, 0.1, 0.05]); assert.ok(LV.some((v) => near(v, o[0])) && near(o[1] / o[0], 1 / 3), 'on a level, its hue'); }
});

test('AUDIT AURA-PIXEL D4: per pixel where a texel is under the pixel on ONE axis; the Crystal Resonance never resampled; the Insignia Armlet\'s cover cut to tenths, its colour kept (mutants: any() as all(); the resonance routed through the snap; the armlet not covering)', () => {
  const f = glslFunctions(AURA_PIXEL_GLSL, { gl_FragCoord: [7.5, 9.5, 0, 1], ...deriv([[0.001, 0], [0, 0.2]], [[0.001, 0, 0], [0, 0, 0.2]]) });
  assert.deepEqual([f.auraSnap([0.3, 0.4], [32, 32]), f.globals.auraCell], [[0.3, 0.4], [7, 9]], 'one axis under the pixel: per pixel');
  // the Resonance, its main RUN with the law on: two points of one texel answer apart
  const res = (/** @type {number[]} */ vP) => {
    const g = glslFunctions(AURA_FS, {
      vP, vWorld: [0, 0.3, 0.8], vS: [0, 0, 0], uKind: 1, uAura: AURA_LOOK.resonance.kind, uTime: 7.3, uSeed: 0.2, uKindle: 1, uRingR: AURA_LOOK.resonance.ringR, uGroundR: AURA_GROUND_R, uFlameH: AURA_LOOK.resonance.flameH,
      uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1.2, 5], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], uResLit: Array(48).fill(10), uResCap: Array(48).fill(-1), uPixel: 1,
      gl_FragCoord: [10.5, 10.5, 0, 1], ...deriv([[0.001 / (TAU * 0.8), 0], [0, 0.001 / 0.6]], [[0.001, 0, 0], [0, 0.001, 0]]),
    });
    g.main();
    return g.globals.o;
  };
  // a column's square ends at u 0.01458; the strip's texel 3 of 256 spans 0.01172..0.01563 - one point either side, one texel
  const a = res([0.0140, 0.25]), b = res([0.0152, 0.25]);
  assert.ok(a[3] > 0.5 && b[3] < 0.5, `its own squares, answered per pixel: in ${a[3]}, out ${b[3]}`);
  // the armlet's crest with the law on: its cover in tenths, its colour whole
  const fs = armoryPrograms(ARMORY_PIECE_INDEX.insigniaarmlet)[0][1];
  const g = glslFunctions(fs, {
    vArm: [0.2, -0.1], vS: [0, 0, 1, 0], vWorld: [0, 1.3, 0.1], uMesh: 2, uPart: 1, uTime: 3, uSeed: 0, uKindle: 1, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1.3, 3],
    uFace: 1, uScale: 1, uSize: 0.05, uGain: 1, uMirror: 1, uInk: [0.1, 0.1, 0.1], uField: [0.5, 0.1, 0.1], uPixel: 1, gl_FragCoord: [10.5, 10.5, 0, 1],
    texture: () => [0.4, 0.2, 0.1, 0.55],
  });
  g.main();
  const o = g.globals.o;
  assert.ok(near(o[3] * 10, Math.round(o[3] * 10)) && Math.abs(o[3] - 0.55) <= 0.1 && near(o[1] / o[0], 0.5, 1e-3), `cut to tenths, its colour kept: ${o.map((v) => v.toFixed(3))}`);
});

/** A GL that logs each call, its uniform locations their names. */
function namedGl() {
  const calls = /** @type {any[]} */ ([]);
  const gl = new Proxy({ TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, FRONT: 14, BACK: 15 }, {
    get(tg, k) {
      if (k in tg) return /** @type {any} */ (tg)[k];
      return (/** @type {any[]} */ ...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; if (k === 'getExtension') return null; return {}; };
    },
  });
  return { gl, calls };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('AUDIT AURA-PIXEL D5: a probe\'s \'levels\' hands the pass 2 - the levels alone, so a frame can tell the snap\'s blocks from the levels\' runs; and the shader with 2 snaps nothing (mutants: levels treated as the whole law)', () => {
  const { gl, calls } = namedGl(), r = new AuraRingRenderer(gl);
  r.pixel = 'levels';
  r.draw([{ at: [0, 0, 0], aura: 'dagonfire' }], I, I, [0, 1, 3], 10);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uPixel').map((c) => c[2]), [2]);
  const at = (/** @type {number[]} */ vP) => {
    const f = glslFunctions(AURA_FS, { vP, vWorld: [vP[0], 0.05, vP[1]], vS: [0, 0, 0], uKind: 0, uTime: 13.5, uSeed: 0.37, uKindle: 1, uRingR: 0.85, uGroundR: AURA_GROUND_R, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 2, 3], uFocus: [0, 0, 0, 0], uPixel: 2, gl_FragCoord: [10.5, 10.5, 0, 1], ...deriv([[0.002, 0], [0, 0.002]], [[0.002, 0, 0], [0, 0, 0.002]]) });
    f.main();
    return f.globals.o;
  };
  assert.notDeepEqual(at([0.8302, 0.1101]), at([0.8398, 0.1201]), 'one texel, two answers: not snapped');
});

const QUIET = { warn() {}, error() {}, info() {} };
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
test('AUDIT AURA-PIXEL B1: a peer driving from a wagon\'s bench - as the bench\'s own glue stands them, rd 0 - is mounted, and their aura floats no cards, as a horse\'s rider\'s does not (mutants: the bench forgotten)', async () => {
  const bakeOf = (/** @type {string} */ kind) => JSON.parse(readFileSync(new URL(`../../src/assets/wagons/${kind}.json`, import.meta.url), 'utf8'));
  const renderer = { createMesh: (/** @type {any} */ model) => ({ model }), updateMeshVertices() {}, destroyMesh() {}, drawMesh() {}, uploadTexture() {}, createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch() {} };
  const pool = createHorseCartPool(/** @type {any} */ ({ renderer, meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'cart', bakedWagon: async (/** @type {string} */ k) => bakeOf(k), log: QUIET, peerAnchor: () => [0, 0.9, 10] }));
  pool.partsOf('openWagon'); pool.partsOf('cart'); await flush();
  pool.applyOwner('ann', { w: [HCC_WIRE_KIND.Trailing, 0, 1, 10 - 7.1, 0, 0, 0, 1, 0, 0], wk: 1 }, (/** @type {any} */ q) => q, 0);
  for (let i = 0; i < 3; i++) pool.frame(1 / 30, [0, 2, -5]);
  const seen = [{ id: 'ann', shown: { x: 0, y: 0.9, z: 10, yaw: 1, rd: 2, mv: 1 } }, { id: 'bob', shown: { x: 4, y: 0, z: 10, yaw: 0, rd: 1 } }];
  pool.driverGlue(seen);
  assert.deepEqual([seen[0].shown.rd, /** @type {any} */ (seen[0].shown).bench, peerMounted(seen[0].shown), peerMounted({ rd: 0 })], [0, 2, true, false]);
  const { gl, calls } = namedGl();
  const host = createAuraHost(/** @type {any} */ ({
    renderer: { gl, _proj: I, _view: I, _camPos: [0, 2, 0], markForeignPass() {} }, online: () => ({ auraOf: () => 'oblivionward', armoryOf: () => null }), travelActive: () => false, quiet: () => false, camYaw: () => 0,
    player: () => ({ feetAt: () => [0, 0, 0], bodyFeetAt: () => [0, 0, 0], bodyYawFor: () => 0, height: 1.8, riding: false }),
    spawned: () => false, beast: () => false, veiled: () => false, toScene: (/** @type {any} */ s) => [s.x, s.y, s.z], sprites: () => [], bodies: () => null,
  }));
  host.frame(seen);
  host.draw();
  assert.ok(calls.some((c) => c[0] === 'drawArrays') && !calls.some((c) => c[0] === 'drawArrays' && c[3] === AURA_LOOK.oblivionward.glyphs * 6), 'neither floats its cards');
});

test('AUDIT AURA-PIXEL C4/D2: on a card a chest piece seen edge on is gone; and from behind and to a side the Sigil\'s back stands between the back\'s far edge and the near arm\'s inner edge, never on the arm (mutants: the edge-on floor kept on a card; the back on the chest mark)', () => {
  const card = newPose();
  Object.assign(card, { card: true, limbs: 'upper', bands: { L: null, R: null }, chestSpan: [-0.2, 0.2] });
  card.dx[POSE_AT.shR / 3] = 0.15; card.dx[POSE_AT.elR / 3] = 0.15; card.dx[POSE_AT.shL / 3] = -0.15; card.dx[POSE_AT.elL / 3] = -0.15;
  const w = { at: [0, 0, 0], yaw: 0, pose: card, seed: 0.37, kindle: 1, torn: -1, mounted: false, _d: 3 }, right = [1, 0, 0];
  const side = armoryDraws('emberheart', w, [3, 1.3, 0], true, right).find((d) => d.mesh === 2);
  assert.ok(side && side.face === 0, `edge on: gone (${side?.face})`);
  const rig = armoryDraws('emberheart', { ...w, pose: newPose() }, [3, 1.3, 0], true, right).find((d) => d.mesh === 2);
  assert.ok(rig && rig.face > 0.25, `a rig\'s keeps its edge-on light (${rig?.face})`);
  // behind and to the wearer's right (the eye at -z, +x): the left arm is hidden, the right one hangs over the back
  const eye = [2.1, 1.3, -2.1], back = armoryDraws('eternalsigil', w, eye, true, right).filter((d) => d.mesh === 2)[1];
  const across = back.A[0] + (back.A[2] * (eye[0] - back.A[0])) / (back.A[2] - eye[2]);   // where the eye's line through it meets the card
  const worn = /** @type {const} */ (['left', 'right']).map((a) => armWornSide(card, [0, 0, 1], [0, 1.3, 0.1], eye, a)).filter(Boolean);
  assert.equal(worn.length, 1, 'the far arm, never read clear, hidden');
  const arm = card.dx[POSE_AT[`sh${worn[0]}`] / 3], want = ((arm > 0 ? -0.2 : 0.2) + (arm - Math.sign(arm) * 0.06)) / 2;   // mid-way from the far edge to the arm's inner edge
  assert.ok(Math.abs(across - want) < 0.005 && Math.abs(across) > 0.04, `between the back's far edge and the arm's inner edge: ${across.toFixed(3)}, want ${want.toFixed(3)}`);
});

test('AUDIT AURA-PIXEL C3: the cut\'s inner side judged from the chest on the card, never from the chest lifted before it - a band just off the chest, seen at a three-quarter, still keeps its arm and cuts the body (mutants: the lifted chest)', () => {
  const card = newPose();
  Object.assign(card, { card: true, limbs: 'upper', bands: { L: { y: 1.3, dx: 0.05, w: 0.04 }, R: { y: 1.3, dx: -0.05, w: 0.04 } } });
  const k = Math.SQRT1_2, eye = [-3 * k, 1.4, 3 * k], right = [k, 0, k];   // the billboard's right for an eye to the front and the wearer's right
  const w = { at: [0, 0, 0], yaw: 0, pose: card, seed: 0.37, kindle: 1, torn: -1, mounted: false, _d: 3 };
  const on = (/** @type {number} */ dx, /** @type {number} */ y) => [right[0] * dx, y, right[2] * dx];
  const kept = (/** @type {number[]} */ c, /** @type {number[]} */ p) => c[0] * p[0] + c[1] * p[1] + c[2] * p[2] + c[3] >= 0;
  const clips = [...new Set(armoryDraws('ashbound', w, eye, true, right).map((d) => d.clip))];
  assert.equal(clips.length, 2);
  for (const c of clips) {
    const own = [0.05, -0.05].find((dx) => kept(c, on(dx, 1.3)));
    assert.ok(own !== undefined && !kept(c, on(own > 0 ? own - 0.04 : own + 0.04, 1.3)), `each keeps its own arm and cuts toward the chest (${c.map((v) => v.toFixed(3))})`);
  }
});
