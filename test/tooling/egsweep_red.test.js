// EG-SWEEP-RED (2026-10-19; bible/11-Multiplayer/Elite-Gates.md section 31's EG-SWEEP-RED record): THE FOUR COURSES THE 500-SEED
// SWEEP DID NOT CROSS before world219's deploy. EG-PERFECT's spec law 10 (#1030) merged green on the pull request's 25 seeds a
// band, and the relay's deploy (relay-deploy.yml, 500 seeds a band - section 10.5 "The sweep") refused it three times over the
// same four: seed 342's Hall 37 and seed 464's Hall 47 in band 1, seed 140's Hall 76 and seed 500's Hall 77 in band 3. One was
// the game's: two Gust span links laid one after the other were blown as one run, on the first's line stretched to the second's
// height - a bridge 12 m over the first course blown sideways, and the second course never blown at all. Three were the pilot's:
// a plan whose next launch off a Beat had no slack (a jump a frame late left none), and two jumps onto a Rail running away at
// the last of the solver's window, which counts a catch at the far edge that a face moving away never gives.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf } from '../../src/net/eliteGates/egLaw.js';
import { egRouteSolved, egJumpReach, EG_BODY_R } from '../../src/net/eliteGates/egSpanLaw.js';
import { egGustSections } from '../../src/world/eliteGates/egLook.js';
import { egGustStorey, EG_GUST_REACH_M } from '../../src/scenes/eliteGates/egSpan.js';
import { sweepStand, sweepCourse, sweepCircleOf } from '../../tools/egSpanSolve.mjs';

/** Seed `seed`'s course of hall `h` in band `band` (road 0) crossed by the sweep's pilot from the sweep's own start (sweepSeed:
 *  the course its circle sweeps `k`-th) - the deploy's FAIL line's `from`. */
const crossed = (seed, band, h, k) => {
  const { c, geo } = sweepCircleOf(seed, band), S = sweepStand(seed, c, geo), spec = S.specs.find((q) => q.h === h);
  const r = sweepCourse(S, spec, 0, 1_800_000_000 + (seed % 36) + 0.37 + 200 * k);
  S.span.clear();
  return { spec, r };
};

test('EG-SWEEP-RED THE BREATH KEEPS TO ITS OWN SPAN LINK (world/eliteGates/egLook.js egGustSections - the screen\'s breath and its streamers, and the pilot\'s): seed 342\'s Hall 37 lays two Gust links one after the other on road 0 - the first course at y 0 on the hall\'s line, the next 12 m up on x 14.85 - and each is its own section: the bridge the way takes 12 m over the first (link 20, x -1.15) stands in no breath, and every Gust of the second blows; the course the sweep fell off crossed (mutants: a run unbroken at its span link)', () => {
  const spec = egHallOf(342, 37, 0), G = egGustSections([spec]);
  assert.equal(spec.law, 10, 'spec law 10 (THE BROKEN WAY) laid it');
  assert.deepEqual(G.map(({ road, span, x, y, y1, z0, z1 }) => ({ road, span, x, y, y1, z0: +z0.toFixed(2), z1: +z1.toFixed(2) })), [
    { road: 0, span: 0, x: 0, y: 0, y1: 0, z0: 4.11, z1: 26.16 },
    { road: 0, span: 1, x: 14.85, y: 12, y1: 12, z0: 7.71, z1: 29.47 },
  ], 'two sections, each on its own link\'s line and storey');
  // the screen's own push (scenes/eliteGates/egSpan.js ride: about the section's line, within its z, on its storey) - the hall's frame
  const blows = (x, y, z) => G.some((q) => Math.abs(x - q.x) <= EG_GUST_REACH_M && z >= q.z0 && z <= q.z1 && egGustStorey(q, y));
  const bridge = egRouteSolved(spec, 0).find((L) => L.g.i === 20).g;
  assert.deepEqual([bridge.kind, bridge.from, bridge.to], ['bridge', [-1.15, 12, 28.62], [-1.15, 12, 4.12]]);
  for (let z = 5; z <= 28; z++) assert.equal(blows(-1.15, 12, z), false, `the bridge 12 m over the first course, z ${z}: no breath`);
  for (const q of spec.steps.filter((s) => s.kind === 'gust')) assert.equal(blows(q.x, q.y, q.z), true, `Gust ${q.i} (span link ${q.span}) blows`);
  const { r } = crossed(342, 1, 37, 1);
  assert.ok(r.ok, `seed 342 hall 37 road 0: ${r.step} - ${r.why}`);
});

test('EG-SWEEP-RED A PLAN\'S CHAIN HELD FOR A LAUNCH A HOLD LATE (tools/egSpanSolve.mjs launch): seed 464\'s Hall 47 turns a bridge onto one Beat (link 8, heading -x) - the first launch into its window lands with its next launch off it at the one moment the Beat still holds, and the pilot\'s run-up is a frame late (0.03 s) at every edge; the plan waits for a Beat it can leave, and the course is crossed (mutants: the chain asked at the launch alone)', () => {
  const link = egRouteSolved(egHallOf(464, 47, 5), 0).find((L) => L.g.i === 8);
  assert.deepEqual([link.g.kind, link.g.steps[0].hd, link.pairs.map((p) => p.b?.kind ?? 'ground')], ['span', 3, ['beat', 'ground']], 'a turned bridge broken onto one Beat');
  const { r } = crossed(464, 1, 47, 1);
  assert.ok(r.ok, `seed 464 hall 47 road 0: ${r.step} - ${r.why}`);
});

test('EG-SWEEP-RED A RAIL RUNNING AWAY IS LANDED ON WITHIN THE REACH UNCAUGHT (tools/egSpanSolve.mjs lands): the solver\'s reach counts the capsule over both edges, the far one a corner caught and stepped up onto - a Rail\'s face moving away from the body gives no such catch; seed 140\'s Hall 76 (two Rails in one phase, 2.4 m apart and running apart) and seed 500\'s Hall 77 (a Rail running away from the ground) are each jumped where the reach a radius short still lands, and crossed (mutants: a receding landing judged at the whole reach; the reach uncaught at the whole reach)', () => {
  assert.ok(Math.abs(egJumpReach(0).reach - EG_BODY_R - 2.912) < 1e-3, `the reach uncaught on the level: ${(egJumpReach(0).reach - EG_BODY_R).toFixed(3)} m`);
  const rails = (seed, h, geo, ids) => egHallOf(seed, h, geo).steps.filter((q) => ids.includes(q.i)).map(({ kind, amp, period, phase, gap }) => ({ kind, amp, period, phase, gap }));
  assert.deepEqual(rails(140, 76, 5, [18, 19]), [{ kind: 'rail', amp: 2, period: 6.3, phase: 0.7, gap: 2.4 }, { kind: 'rail', amp: 2, period: 6.3, phase: 0.7, gap: 2.4 }], 'two Rails in one phase');
  assert.deepEqual(rails(500, 77, 5, [9]), [{ kind: 'rail', amp: 2, period: 6, phase: 0, gap: 2.8 }], 'a Rail off the ground');
  for (const [seed, h, k] of [[140, 76, 0], [500, 77, 1]]) {
    const { r } = crossed(seed, 3, h, k);
    assert.ok(r.ok, `seed ${seed} hall ${h} road 0: ${r.step} - ${r.why}`);
  }
});
