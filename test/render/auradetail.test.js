// AURA DETAIL (2026-10-28, the owner: "do another detailed pass on the auras themselves as I think we can push this
// further"; bible/07-Rendering/Rendering.md, AURA DETAIL) - EACH LOOK'S NEW WORK, RUN: the shader's own main(),
// with and without the one term a detail adds (`added`), so a pin judges what that detail draws and where its law puts
// it - Dagon's Fire's seams, licks, sparks and flares; the Radiance's ribbons and its sun; the Maelstrom's caustics and
// its eye's rim; Beaconlight's beams and the light passing round; the Burning Stair's tongues; Eternal's fire ring under
// the feet; Witchfire's star and its candles' flames. Every new rate whole over the clock. The pixels:
// tools/auraSheet.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions } from '../glsl.mjs';
import {
  AURA_FS, AURA_LOOK, AURA_GROUND_R, AURA_CLOCK_PERIOD, AURA_TURN_HZ, AURA_SPARKS, AURA_DETAIL_HZ, auraFlowsWhole,
  RADIANCE_HZ, RADIANCE_RIBBON, RADIANCE_SUN, MAELSTROM_EYE_R, MAELSTROM_R, maelstromRatesWhole, BEACON_HZ, BEACON_LIGHTS,
  BEACON_BEAM, STAIR_STEPS, STAIR_HZ, spireRatesWhole, ETERNAL_POOL_R, WITCH_CANDLES,
} from '../../src/render/auraRing.js';

const TAU = Math.PI * 2;
const fract = (/** @type {number} */ x) => x - Math.floor(x);
const lum = (/** @type {number[]} */ c) => c[0] + c[1] + c[2];
/** A look's shader at the clock `t`, its source with `cut` (old, new) applied - a detail's term taken out. */
const shaderOf = (/** @type {any} */ look, kind, t, cut = null, seed = 0) => {
  let src = AURA_FS;
  if (cut) { assert.equal(src.split(cut[0]).length, 2, `the term is there once: ${cut[0]}`); src = src.replace(cut[0], cut[1]); }
  return glslFunctions(src, {
    vP: [0, 0], vS: [0, 0, 0], vWorld: [0, 0, 0], uKind: kind, uAura: look.kind, uTime: t, uSeed: seed, uKindle: 1, uRingR: look.ringR,
    uGroundR: AURA_GROUND_R, uFlameH: look.flameH, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1.2, 5],
    uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], uYaw: 0, uTorn: -1, uSwing: [0, 0, 0, 0], uResLit: Array(48).fill(0), uResCap: Array(48).fill(-1),
    dFdx: () => [0.001, 0, 0], dFdy: () => [0, 0.001, 0],
  });
};
/** What a detail adds at each point: the look drawn whole, less the look drawn without it (`cut`). */
const added = (/** @type {any} */ look, kind, t, cut, /** @type {number[][]} */ pts, seed = 0) => {
  const whole = shaderOf(look, kind, t, null, seed), less = shaderOf(look, kind, t, cut, seed);
  const at = (/** @type {any} */ f, /** @type {number[]} */ p) => { f.globals.vP = p; f.main(); return lum(f.globals.o); };
  return pts.map((p) => at(whole, p) - at(less, p));
};
const polar = (/** @type {number} */ r, /** @type {number} */ a) => [Math.cos(a) * r, Math.sin(a) * r];

test('AURA DETAIL every new rate whole over the clock - the seams, licks, sparks and flares, the ribbons, the pool\'s caustics and lace, the stair\'s tongues and cracks (mutants: a rate that does not close)', () => {
  assert.equal(auraFlowsWhole(), true);
  assert.equal(maelstromRatesWhole(), true);
  assert.equal(spireRatesWhole(), true);
  assert.ok(Number.isInteger(Math.round(RADIANCE_HZ.ribbon * AURA_CLOCK_PERIOD * 1e6) / 1e6), 'the ribbons\' turn');
});

test('AURA DETAIL Dagon\'s Fire: the Deadlands stone cracked within the ring, its seams burning and flowing, never under the feet; the licks out over the ground past the band, never within; sparks thrown up where their law puts them, rising; a flare standing the fire taller at its place on its beat (mutants: the seams dropped; the licks within; a spark falling; the flare at no place)', () => {
  const L = AURA_LOOK.dagonfire, R = L.ringR, n = 48;
  const ring = (/** @type {number} */ r) => Array.from({ length: n }, (_, i) => polar(r, (i / n) * TAU));
  const SEAMS = ['seamHeat * 0.55 +', '0.0 * 0.55 +'], LICKS = ['* licks * 0.35;', '* 0.0;'];
  const within = added(L, 0, 13.3, SEAMS, ring(R * 0.6)), feet = added(L, 0, 13.3, SEAMS, ring(0.05));
  assert.ok(within.filter((d) => d > 0.05).length >= 4 && within.filter((d) => d < 0.01).length >= n / 3, `seams: lines through the stone, not a sheet (${within.filter((d) => d > 0.05).length} of ${n} lit)`);
  assert.ok(feet.every((d) => Math.abs(d) < 1e-6), 'dark under the feet');
  const later = added(L, 0, 17.3, SEAMS, ring(R * 0.6));
  assert.ok(within.filter((d, i) => Math.abs(d - later[i]) > 0.03).length >= 6, 'flowing - four seconds on, other seams');
  const out = added(L, 0, 13.3, LICKS, ring(R + 0.2)), inside = added(L, 0, 13.3, LICKS, ring(R * 0.5));
  assert.ok(out.some((d) => d > 0.05) && inside.every((d) => Math.abs(d) < 1e-6), 'the licks past the band, none within');
  // spark 0, where its law puts it, and higher a moment on
  const SPARKS = ['col += vec3(1.0, 0.62, 0.18) * sparks * 1.1;', ''];
  const h1 = fract(Math.sin(0 * 73.13 + 0) * 43758.5453), h2 = fract(Math.sin(0 * 29.71 + 1.9) * 24634.6345);
  const sparkAt = (/** @type {number} */ t) => {
    const mv = fract(t * AURA_DETAIL_HZ.spark + h2), circ = TAU * R;
    const u = h1 - 0.05 * Math.sin(TAU * (mv * 1.5 + h1)) / circ;
    return { mv, p: [fract(u - t * AURA_TURN_HZ), mv * 0.85] };   // the wall's u is carried round with the ring's turn
  };
  const t0 = (0.3 - h2 + 3) / AURA_DETAIL_HZ.spark % (1 / AURA_DETAIL_HZ.spark);
  const s0 = sparkAt(t0), s1 = sparkAt(t0 + 0.4);
  assert.ok(Math.abs(s0.mv - 0.3) < 1e-9 && s1.mv > s0.mv, 'its law climbs');
  const [on, off] = added(L, 1, t0, SPARKS, [s0.p, [s0.p[0], s0.p[1] + 0.2]]);
  assert.ok(on > 0.3 && on > off * 4, `the spark where its law puts it (${on.toFixed(3)} vs ${off.toFixed(3)} above it)`);
  assert.ok(added(L, 1, t0 + 0.4, SPARKS, [s1.p])[0] > 0.3, 'and higher a moment on');
  // flare 0 at its beat: the fire at its place stood taller than it would be
  const FLARE = ['float th = 0.28 + v * 0.62 - flare * 0.12;', 'float th = 0.28 + v * 0.62;'];
  const fh = fract(Math.sin(0 * 47.3 + 0) * 43758.5), tf = fract((0.25 - fh) / AURA_DETAIL_HZ.flare / (1 / AURA_DETAIL_HZ.flare)) * (1 / AURA_DETAIL_HZ.flare) + 10;
  const fu = (0.35 * fh) / 5, wall = (/** @type {number} */ u) => Array.from({ length: 12 }, (_, i) => [fract(u - tf * AURA_TURN_HZ), 0.1 + i * 0.05]);
  const there = added(L, 1, tf, FLARE, wall(fu)).reduce((a, b) => a + Math.max(0, b), 0), between = added(L, 1, tf, FLARE, wall(fu + 0.1)).reduce((a, b) => a + Math.abs(b), 0);
  assert.ok(there > 0.2 && between < there * 0.001, `the flare at its place (${there.toFixed(3)}), next to nothing between two (${between.toFixed(5)})`);
});

test('AURA DETAIL the Radiance: two ribbons of light winding up the column - lit along their helix, dark between, risen as the clock turns them; the sun under the feet - its twelve points out past the gaps between them (mutants: the ribbons dropped; the ribbons straight; the sun\'s points flat)', () => {
  const L = AURA_LOOK.radiance, t = 13.5, RIB = ['col += (RAD_HEART * 0.6 + RAD_GOLD * 0.5) * ribbon', 'col += 0.0 * ribbon'];
  // a ribbon's middle at height v: wind = 1/2 (fract(2u + 2.5v - t/10))
  const uOn = (/** @type {number} */ v, /** @type {number} */ tt) => fract((0.5 - v * RADIANCE_RIBBON.turns * 2 + tt * RADIANCE_HZ.ribbon) / 2);
  for (const v of [0.15, 0.3, 0.45]) {
    const [on, mid] = added(L, 1, t, RIB, [[uOn(v, t), v], [uOn(v, t) + 0.25, v]]);
    assert.ok(on > 0.05 && on > mid * 5, `at ${v} up the column: on the ribbon ${on.toFixed(3)}, between them ${mid.toFixed(3)}`);
  }
  assert.ok(Math.abs(fract(uOn(0.15, t) - uOn(0.45, t) + 0.5) - 0.5) > 0.1, 'a helix - the ribbon\'s place round the column moves as it climbs');
  assert.ok(added(L, 1, t + 2.5, RIB, [[uOn(0.3, t + 2.5), 0.3]])[0] > 0.05, 'turning with the clock');
  // the sun: its points where the law turns them
  const SUN = ['col += RAD_GOLD * star * 0.22 * breath +', 'col += RAD_GOLD * 0.0 * 0.22 * breath +'];
  const pointA = (/** @type {number} */ k) => (k / RADIANCE_SUN.points) * TAU - t * TAU * RADIANCE_HZ.rays;
  const r = RADIANCE_SUN.r * 0.6;
  const tips = added(L, 0, t, SUN, [0, 3, 7].map((k) => polar(r, pointA(k)))), gaps = added(L, 0, t, SUN, [0, 3, 7].map((k) => polar(r, pointA(k + 0.5))));
  tips.forEach((d, i) => assert.ok(d > gaps[i] * 2 && d > 0.02, `point ${i}: ${d.toFixed(3)} against the gap beside it ${gaps[i].toFixed(3)}`));
});

test('AURA DETAIL the Maelstrom: light rippling over the pool\'s floor in a net within the open water, none past the lip; a thin ring of foam round the eye (mutants: the caustics dropped; the eye\'s rim off it)', () => {
  const L = AURA_LOOK.maelstrom, t = 31.5, n = 64;
  const CAUS = ['col += mix(MS_TIDE, MS_FOAM, 0.35) * caus * open * 0.3 * breath;', ''];
  const net = added(L, 0, t, CAUS, Array.from({ length: n }, (_, i) => polar(0.5, (i / n) * TAU)));
  assert.ok(Math.max(...net) > 0.06 && net.filter((d) => d < Math.max(...net) * 0.25).length >= n / 4, `a net, bright lines and dark between (peak ${Math.max(...net).toFixed(3)})`);
  assert.ok(added(L, 0, t, CAUS, Array.from({ length: 12 }, (_, i) => polar(MAELSTROM_R + 0.1, (i / 12) * TAU))).every((d) => Math.abs(d) < 1e-6), 'none past the lip');
  const RIM = ['col += MS_FOAM * exp(-er * er) * 0.28 * breath;', ''];
  const [rim, inEye, outEye] = added(L, 0, t, RIM, [polar(MAELSTROM_EYE_R, 1), polar(MAELSTROM_EYE_R - 0.04, 1), polar(MAELSTROM_EYE_R + 0.04, 1)]);
  assert.ok(rim > 0.2 && inEye < rim * 0.01 && outEye < rim * 0.01, `a thin ring at the eye's edge (${rim.toFixed(3)}, ${inEye.toFixed(4)}, ${outEye.toFixed(4)})`);
});

test('AURA DETAIL Beaconlight: each beacon throws a beam up as it is lit - a fresh one\'s higher than one long lit, and gone between beacons; the light passing round the ring from the beacon last lit toward the next (mutants: the beams dropped; every beam as high; the light passing the wrong way)', () => {
  const L = AURA_LOOK.beaconlight, N = BEACON_LIGHTS;
  const BEAM = ['col += (SP_WHITE * 0.55 + SP_BEACON * 0.45) * shaft', 'col += 0.0 * shaft'];
  const t = 3 / BEACON_HZ.kindle + (3 / N) / BEACON_HZ.kindle + 0.05;   // beacon 3 just lit (beaconLit: fract(t * kindle - k / N) a hair past 0)
  const [freshHi, oldHi, oldLow] = added(L, 1, t, BEAM, [[3 / N, BEACON_BEAM.up * 0.6], [4 / N, BEACON_BEAM.up * 0.6], [4 / N, 0.05]]);
  assert.ok(freshHi > 0.1 && freshHi > oldHi * 3, `the beam just lit stands high (${freshHi.toFixed(3)}), the one long lit dim (${oldHi.toFixed(3)})`);
  assert.ok(oldLow > 0.02 && oldHi < oldLow * 0.05, `the one long lit sunk to the stone (${oldLow.toFixed(3)} at its foot, ${oldHi.toFixed(4)} at the chest)`);
  assert.ok(Math.abs(added(L, 1, t, BEAM, [[3.5 / N, 0.2]])[0]) < 1e-6, 'nothing between two beacons');
  const COMET = ['col += (SP_WHITE * 0.7 + SP_BEACON * 0.5) * exp(-behind * 18.0)', 'col += 0.0 * exp(-behind * 18.0)'];
  const head = fract(t * BEACON_HZ.kindle);
  const [justBehind, justAhead] = added(L, 0, t, COMET, [polar(L.ringR, (head - 0.02) * TAU), polar(L.ringR, (head + 0.02) * TAU)]);
  assert.ok(justBehind > 0.2 && justAhead < justBehind * 0.05, `the light just behind its head (${justBehind.toFixed(3)}), none just ahead (${justAhead.toFixed(4)})`);
  // the beacons themselves, the passing light taken out (its head stands on the one just lit): beaconLit's order
  const less = shaderOf(L, 0, t, COMET), at = (/** @type {number} */ k) => { less.globals.vP = polar(L.ringR, (k / N) * TAU); less.main(); return lum(less.globals.o); };
  assert.ok(at(3) > at(4) * 1.5, `the beacon just lit (${at(3).toFixed(3)}) over the one about to be (${at(4).toFixed(3)})`);
});

test('AURA DETAIL the Burning Stair: tongues of fire licking up off each step\'s lip, none mid-tread; the lower steps\' taller (mutants: the tongues dropped; the tongues all one height)', () => {
  const L = AURA_LOOK.burningstair, t = 12.0, TONGUE = ['* tongue * 0.9 * flare;', '* 0.0 * flare;'];
  // step k's lip on the wall: s = fract(u - t * descend) * STEPS is whole
  const lipU = (/** @type {number} */ k) => fract(k / STAIR_STEPS + t * STAIR_HZ.descend);
  const low = (/** @type {number} */ k, /** @type {number} */ m) => [lipU(k), m / L.flameH];
  const lipHot = added(L, 1, t, TONGUE, [low(STAIR_STEPS - 1, 0.03)])[0], mid = added(L, 1, t, TONGUE, [[lipU(5) + 0.5 / STAIR_STEPS, 0.03 / L.flameH]])[0];
  assert.ok(lipHot > 0.2 && mid < lipHot * 0.05, `a tongue at the lip (${lipHot.toFixed(3)}), none mid-tread (${mid.toFixed(4)})`);
  const [hotHigh, coldHigh] = added(L, 1, t, TONGUE, [low(STAIR_STEPS - 1, 0.11), low(0, 0.11)]);
  assert.ok(hotHigh > coldHigh + 0.1, `the lowest step's tongue taller than the highest's (${hotHigh.toFixed(3)} vs ${coldHigh.toFixed(3)} at 11 cm)`);
});

test('AURA DETAIL Eternal: a ring of its blue-violet fire lying round the pool\'s middle, none under the feet nor at the pool\'s edge (mutants: the ring dropped; the ring at the feet)', () => {
  const L = AURA_LOOK.eternal, RING = ['* exp(-rd * rd) * (0.35 + 0.65 * tn) * 0.3 * breath;', '* 0.0;'];
  const shader = (/** @type {number} */ r) => added(L, 0, 13.3, RING, Array.from({ length: 16 }, (_, i) => polar(r, (i / 16) * TAU))).reduce((a, b) => a + b, 0) / 16;
  const ring = shader(ETERNAL_POOL_R * 0.62), feet = shader(0.08), edge = shader(ETERNAL_POOL_R * 0.95);
  assert.ok(ring > 0.01 && ring > feet * 20 && ring > edge * 20, `the ring round the middle (${ring.toFixed(4)}; the feet ${feet.toFixed(5)}, the edge ${edge.toFixed(5)})`);
});

test('AURA DETAIL Witchfire: a seven-pointed star drawn candle to candle - lit along a line from a candle to the third on, dark off it; each candle\'s flame standing over its wick on the wall, none between candles (mutants: the star dropped; the star to the next candle; the flames off their candles)', () => {
  const L = AURA_LOOK.witchfire, R = L.ringR, t = 13.3, STAR = ['* lines * 0.4 * breath +', '* 0.0 * 0.4 * breath +'];
  const cand = (/** @type {number} */ k) => polar(R, (k / WITCH_CANDLES) * TAU);
  const c0 = cand(0), c3 = cand(3), c1 = cand(1);
  const onLine = [c0[0] * 0.65 + c3[0] * 0.35, c0[1] * 0.65 + c3[1] * 0.35], toNext = [(c0[0] + c1[0]) / 2 * 0.97, (c0[1] + c1[1]) / 2 * 0.97];
  const [on, off] = added(L, 0, t, STAR, [onLine, toNext]);
  assert.ok(on > 0.15 && off < on * 0.05, `on the line to the third candle (${on.toFixed(3)}), none toward the next (${off.toFixed(4)})`);
  const FLAME = ['col += mix(WF_TALLOW, vec3(1.0), 0.3) * drop * 0.9 +', 'col += mix(WF_TALLOW, vec3(1.0), 0.3) * 0.0 * 0.9 +'];
  const [wick, between] = added(L, 1, t, FLAME, [[2 / WITCH_CANDLES, 0.03 / L.flameH], [2.5 / WITCH_CANDLES, 0.03 / L.flameH]]);
  assert.ok(wick > 0.2 && Math.abs(between) < 1e-6, `a flame over candle 2's wick (${wick.toFixed(3)}), none between candles`);
});
