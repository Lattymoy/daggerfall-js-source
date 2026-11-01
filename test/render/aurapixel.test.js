// @ts-check
// The auras in Daggerfall's pixels: every look answered at its texel's middle and cut to a few levels, an armory piece to
// the levels alone - the shader's own functions RUN (test/glsl.mjs), the passes' switch over a GL that logs. And no aura
// floats its cards over a rider. The GPU's pixels are tools/auraProbe.mjs's and tools/armoryProbe.mjs's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions } from '../glsl.mjs';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { AURA_PIXEL_GLSL, AURA_TEXEL_M, AURA_PIXEL_STEPS, AURA_CARD_TEXELS, auraTexelsPer } from '../../src/render/auraPixel.js';
import { AURA_FS, AURA_LOOK, AURA_OWN_PIXELS, AURA_RING_R, AURA_GROUND_R, AURA_LIFT_M, AuraRingRenderer, auraPrograms } from '../../src/render/auraRing.js';
import { ArmoryRenderer, armoryPrograms, ARMORY_PIECE_INDEX } from '../../src/render/armoryPass.js';
import { newPose } from '../../src/render/armoryPose.js';

const TAU = Math.PI * 2;
const near = (/** @type {number} */ a, /** @type {number} */ b, e = 1e-9) => Math.abs(a - b) <= e;
/** Derivatives of a surface whose coordinate moves `dp` (per screen x, per screen y) as its world point moves `dw`. */
const deriv = (/** @type {number[][]} */ dp, /** @type {number[][]} */ dw) => ({
  dFdx: (/** @type {number[]} */ v) => (v.length === 2 ? dp[0] : dw[0]),
  dFdy: (/** @type {number[]} */ v) => (v.length === 2 ? dp[1] : dw[1]),
});
/** The ground's: its coordinate in metres, `s` metres a pixel. */
const ground = (/** @type {number} */ s) => deriv([[s, 0], [0, s]], [[s, 0, 0], [0, 0, s]]);

test('AURA-PIXEL the texel: a Daggerfall flat\'s pixel (GLOBAL_SCALE) at most and half of it at least, a power of two to a unit so grids nest and a ring closes on a whole number; a card never under its least (PIN MOVED, AUDIT AURA-PIXEL D3: the armory\'s texel retired) (mutants: rounded down, past the flat\'s pixel; not a power of two)', () => {
  assert.equal(AURA_TEXEL_M, GLOBAL_SCALE);
  assert.deepEqual([auraTexelsPer(0.16, AURA_CARD_TEXELS), auraTexelsPer(1.2, AURA_CARD_TEXELS)], [32, 64], 'a small card its least, a big glow measured');
  assert.deepEqual([auraTexelsPer(1), auraTexelsPer(AURA_TEXEL_M), auraTexelsPer(AURA_TEXEL_M * 1.01), auraTexelsPer(TAU * 0.95)], [64, 1, 2, 256]);
  for (let m = 0.03; m < 12; m *= 1.37) {
    const n = auraTexelsPer(m), texel = m / n;
    assert.ok(Number.isInteger(Math.log2(n)), `${m} m: ${n} a power of two`);
    assert.ok(texel <= AURA_TEXEL_M + 1e-12 && texel > AURA_TEXEL_M / 2, `${m} m: a texel of ${texel}`);
  }
});

test('AURA-PIXEL the shader\'s texel RUN: a point on the ground answers at its texel\'s middle, the texel the dither\'s cell; a ring\'s strip in whole texels round it; a texel no bigger than the pixel, or a surface edge on, answered per pixel, the dither on the screen\'s (mutants: the scale inverted; the per-pixel fall-back gone; the texel not passed)', () => {
  const at = (/** @type {any} */ d, /** @type {number[]} */ p, /** @type {number[]} */ w, least = [1, 1]) => {
    const f = glslFunctions(AURA_PIXEL_GLSL, { gl_FragCoord: [100.5, 50.5, 0, 1], ...d });
    return { p: f.auraTexel(p, w, AURA_TEXEL_M, least), cell: f.globals.auraCell };
  };
  const n = auraTexelsPer(1), p = [0.1234, -0.567];
  const g = at(ground(0.002), p, [p[0], 0, p[1]]);
  assert.deepEqual(g.cell, [Math.floor(p[0] * n), Math.floor(p[1] * n)]);
  assert.ok(near(g.p[0], (Math.floor(p[0] * n) + 0.5) / n) && near(g.p[1], (Math.floor(p[1] * n) + 0.5) / n), `${g.p}`);
  // a card 0.16 m a side (its uv 0..1): its least, 32, over the 8 its measure would give
  const cs = 0.0004, card = at(deriv([[cs / 0.16, 0], [0, cs / 0.16]], [[cs, 0, 0], [0, cs, 0]]), [0.37, 0.71], [0, 1, 0], [AURA_CARD_TEXELS, AURA_CARD_TEXELS]);
  assert.deepEqual(card.cell, [Math.floor(0.37 * AURA_CARD_TEXELS), Math.floor(0.71 * AURA_CARD_TEXELS)], 'a card at its least');
  // a strip round a ring of radius R and height H: (the share round, the share up)
  const R = 0.85, H = 0.62, s = 0.003, u = [0.4321, 0.777];
  const strip = at(deriv([[s / (TAU * R), 0], [0, s / H]], [[s, 0, 0], [0, s, 0]]), u, [R, u[1] * H, 0]);
  assert.deepEqual(strip.cell, [Math.floor(u[0] * auraTexelsPer(TAU * R)), Math.floor(u[1] * auraTexelsPer(H))]);
  // far off - a texel under the pixel - and edge on: the point itself, the screen's cell
  for (const [why, d] of [['far', ground(0.05)], ['edge on', deriv([[0.01, 0], [0.02, 0]], [[0.01, 0, 0], [0.02, 0, 0]])]]) {
    const r = at(d, p, [p[0], 0, p[1]]);
    assert.deepEqual([r.p, r.cell], [p, [100, 50]], why);
  }
});

test('AURA-PIXEL the levels RUN: an added light\'s brightest channel cut to the square of a tenth, its hue kept, the dither choosing between the two levels about it; a covering look\'s cover cut to tenths and its colour kept whole, a faint one its light alone (mutants: the levels linear; the hue lost; the cover\'s colour scaled away)', () => {
  const f = glslFunctions(AURA_PIXEL_GLSL, {});
  const LV = Array.from({ length: AURA_PIXEL_STEPS + 1 }, (_, k) => (k / AURA_PIXEL_STEPS) ** 2);
  const seen = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    f.globals.auraCell = [x, y];
    const o = f.auraPixel([0.5, 0.25, 0.1, 1], false), m = Math.max(o[0], o[1], o[2]);
    assert.ok(LV.some((v) => near(v, m, 1e-6)), `on a level: ${m}`);
    assert.ok(near(o[1] / o[0], 0.5, 1e-6) && near(o[2] / o[0], 0.2, 1e-6) && o[3] === 1, 'its hue, and added whole');
    seen.add(m.toFixed(4));
    const c = f.auraPixel([0.3 * 0.63, 0.1 * 0.63, 0.5 * 0.63, 0.63], true);
    assert.ok(Number.isInteger(Math.round(c[3] * 1e6) / 1e6 * AURA_PIXEL_STEPS) && Math.abs(c[3] - 0.63) <= 0.1 + 1e-9, `its cover in tenths: ${c[3]}`);
    assert.ok(near(c[0] / c[3], 0.3, 1e-6) && near(c[1] / c[3], 0.1, 1e-6) && near(c[2] / c[3], 0.5, 1e-6), 'its colour whole');
    const faint = f.auraPixel([0.2, 0.1, 0.05, 0.04], true);
    assert.ok((faint[3] === 0 || near(faint[3], 0.1, 1e-6)) && LV.some((v) => near(v, Math.max(...faint.slice(0, 3)), 1e-6)), `a faint cover: ${faint}`);
  }
  assert.deepEqual([...seen].sort(), ['0.4900', '0.6400'], 'the dither between the levels either side of 0.5');
});

/** The fire's ground, the shader's own main(), at `vP` (m), the law on or off. */
const fireAt = (/** @type {number[]} */ vP, /** @type {number} */ pixel) => {
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: [vP[0], AURA_LIFT_M, vP[1]], vS: [0, 0, 0], uKind: 0, uTime: 13.5, uSeed: 0.37, uKindle: 1, uRingR: AURA_RING_R, uGroundR: AURA_GROUND_R,
    uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 2, 3], uFocus: [0, 0, 0, 0], uPixel: pixel, gl_FragCoord: [10.5, 10.5, 0, 1], ...ground(0.002),
  });
  f.main();
  return f.globals.o;
};

test('AURA-PIXEL an aura\'s main() RUN: with the law on, every point of a texel answers as its middle does, on a level; off, the look per pixel as it was; the looks that cover are AURA_LOOK\'s shaded ones and the Crystal Resonance keeps its own squares (mutants: the look at the fragment; the levels uncut; a second list of covers)', () => {
  const n = auraTexelsPer(1), cell = [Math.floor(0.83 * n), Math.floor(0.11 * n)];
  const a = fireAt([(cell[0] + 0.1) / n, (cell[1] + 0.2) / n], 1), b = fireAt([(cell[0] + 0.9) / n, (cell[1] + 0.7) / n], 1);
  assert.deepEqual(a, b, 'one texel, one answer');
  assert.ok(Math.max(a[0], a[1], a[2]) > 0.05, `the band lit: ${a}`);
  const mid = fireAt([(cell[0] + 0.5) / n, (cell[1] + 0.5) / n], 0), m = Math.max(...a.slice(0, 3));
  assert.ok(Array.from({ length: AURA_PIXEL_STEPS + 1 }, (_, k) => (k / AURA_PIXEL_STEPS) ** 2).some((v) => near(v, m, 1e-6)), `on a level: ${m}`);
  assert.ok(Math.abs(Math.sqrt(m) - Math.sqrt(Math.max(...mid.slice(0, 3)))) <= 1 / AURA_PIXEL_STEPS + 1e-9, 'the level beside the texel\'s own light');
  assert.notDeepEqual(fireAt([(cell[0] + 0.1) / n, (cell[1] + 0.2) / n], 0), fireAt([(cell[0] + 0.9) / n, (cell[1] + 0.7) / n], 0), 'off, per pixel');
  for (const look of Object.values(AURA_LOOK)) {
    const f = glslFunctions(AURA_FS, { uAura: look.kind });
    assert.equal(f.auraCovers(), !!look.shade, `look ${look.kind}: covers as it shades`);
    assert.equal(f.auraOwnPixels(), AURA_OWN_PIXELS.includes(look.kind));
  }
  assert.deepEqual([...AURA_OWN_PIXELS], [AURA_LOOK.resonance.kind]);
  for (const k of [0, 5, 15]) assert.ok(auraPrograms(k)[0][1].includes('uniform float uPixel;'), 'a uniform in every look\'s program, so a pass that never sets it draws per pixel');
  assert.ok(armoryPrograms(ARMORY_PIECE_INDEX.emberheart)[0][1].includes('uniform float uPixel;'));
});

test('AURA-PIXEL an armory piece\'s main() RUN (PIN MOVED, AUDIT AURA-PIXEL D3/A3: a piece takes the levels alone): the Crystal Spurs with the law on - two points a texel apart answer apart, never snapped, each on a level; off, the piece as it was (mutants: the piece snapped; its levels uncut)', () => {
  const fs = armoryPrograms(ARMORY_PIECE_INDEX.crystalspurs)[0][1];
  const at = (/** @type {number[]} */ vArm, /** @type {number} */ pixel) => {
    const f = glslFunctions(fs, {
      vArm, vS: [1, 0.1, 0, 0], vWorld: [0, 1, 0], uMesh: 0, uPart: 0, uTime: 3, uSeed: 0, uKindle: 1, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1, 3],
      uFace: 1, uScale: 1, uSize: 0, uGain: 1, uMirror: 1, uInk: [0, 0, 0], uField: [0, 0, 0], uPixel: pixel, gl_FragCoord: [10.5, 10.5, 0, 1],
    });
    f.main();
    return f.globals.o;
  };
  const one = [3.1 / 8, 2.15 / 4], two = [3.85 / 8, 2.9 / 4];
  assert.notDeepEqual(at(one, 1), at(two, 1), 'never snapped');
  const LV = Array.from({ length: AURA_PIXEL_STEPS + 1 }, (_, k) => (k / AURA_PIXEL_STEPS) ** 2);
  for (const p of [one, two]) { const m = Math.max(...at(p, 1).slice(0, 3)); assert.ok(m > 0.02 && LV.some((v) => near(v, m, 1e-6)), `lit, on a level: ${m}`); }
  assert.ok(LV.every((v) => !near(v, Math.max(...at(one, 0).slice(0, 3)), 1e-6)), 'off, its own light');
});

/** A GL that logs each call, its uniform locations their names. */
function namedGl() {
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, FRONT: 14, BACK: 15 }, {
    get(tg, k) {
      if (k in tg) return tg[k];
      return (/** @type {any[]} */ ...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; if (k === 'getExtension') return null; return {}; };
    },
  });
  return { gl, calls, set: (/** @type {string} */ name) => calls.filter((c) => c[0] === 'uniform1f' && c[1] === name).map((c) => c[2]) };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('AURA-PIXEL the passes turn the law on - the auras\' and the armory\'s - and a probe that sets `pixel` false draws per pixel (mutants: never set; set off)', () => {
  const a = namedGl(), r = new AuraRingRenderer(a.gl);
  r.draw([{ at: [0, 0, 0], aura: 'oblivionward' }], I, I, [0, 1, 3], 10);
  assert.deepEqual(a.set('uPixel'), [1]);
  a.calls.length = 0; r.pixel = false;
  r.draw([{ at: [0, 0, 0], aura: 'oblivionward' }], I, I, [0, 1, 3], 11);
  assert.deepEqual(a.set('uPixel'), [0]);
  const b = namedGl(), p = new ArmoryRenderer(/** @type {any} */ (b.gl));
  const wearer = { kit: 'a0000', at: [0, 0, 0], yaw: 0, pose: newPose(), kindle: 1, torn: -1, _d: 3 };
  p.draw([wearer], I, I, [0, 1.6, 3], 1, null, true);
  assert.ok(p.drawn === 1 && b.set('uPixel').length > 0 && b.set('uPixel').every((v) => v === 1), `${b.set('uPixel')}`);
  b.calls.length = 0; p.pixel = false;
  p.draw([wearer], I, I, [0, 1.6, 3], 2, null, true);
  assert.ok(b.set('uPixel').length > 0 && b.set('uPixel').every((v) => v === 0));
});

test('GLYPHS-MOUNTED (2026-10-31, the owner: "glyphs shouldnt show when mounted"): every look that floats cards draws none over a rider - a horse, a cart or a dragon - and its ground and wall as before; afoot, its cards (mutants: the rider\'s cards drawn; the walker\'s gone)', () => {
  const floats = Object.entries(AURA_LOOK).filter(([, l]) => l.glyphs && !l.mesh);
  assert.deepEqual(floats.map(([k]) => k).sort(), ['lilacwarren', 'oblivionward', 'sagesmoke', 'vampirichaze']);
  for (const [aura, look] of [...floats, ['seraphwings', AURA_LOOK.seraphwings]]) {
    const { gl, calls } = namedGl(), r = new AuraRingRenderer(gl);
    const draws = () => calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]);
    r.draw([{ at: [0, 0, 0], aura, mounted: true }], I, I, [0, 1, 3], 10);
    assert.ok(!draws().includes(look.glyphs * 6) && draws()[0] === 6 && draws().length === 2, `${aura} on a rider: ${draws()}`);
    calls.length = 0;
    r.draw([{ at: [0, 0, 0], aura }], I, I, [0, 1, 3], 11);
    assert.deepEqual(draws().slice(-1), [look.glyphs * 6], `${aura} afoot`);
  }
});
