// EG6a (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 10.5 "The sweep"): THE COURSE SWEEP -
// tools/egSpanSolve.mjs crosses every course the span generator lays STEP BY STEP WITH THE REAL MOTOR (player/motor.js
// PlayerMotor at THE SPAN BUILD on player/collider.js Collider, over the circle's floors and its pieces as scenes/eliteGates/egSpan.js
// rides them - SD7b's harness the model); a course it does not cross fails, naming its seed, hall, road and step; CI runs
// 25 seeds a band on every pull request (verify.yml calling eg-sweep.yml), 500 nightly, 500 before every relay deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sweepSeed, sweepStand, sweepCourse, sweepCircleOf, sweepPath, sweepSeeds, runSweep, main, solveReport, SWEEP_BUILD, SWEEP_GOLDEN } from '../../tools/egSpanSolve.mjs';
import { egStepKey } from '../../src/scenes/eliteGates/egSpan.js';
import { egCourseOf, egSpanPairs } from '../../src/net/eliteGates/egSpanLaw.js';
import { egGive8 } from '../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's
egGive8(1, [2], 1);
egGive8(3, [4], 3);
egGive8(10, [1]);
/** Seed `seed`'s swept circle of band `band` given at spec law 8 (each sweep's own - more circles than the given halls hold). */
const give8 = (seed, band) => { const { c, geo } = sweepCircleOf(seed, band); egGive8(seed, [c], geo); };

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('EG6a THE SWEEP (section 10.5): every course of a seed\'s circle in each band - its every hall\'s every road, THE FORK\'s two - crossed step by step by the real motor at THE SPAN BUILD (SD7b\'s Speed 10, Running 0): drifting, beating, rising, crumbling, gusting, dropping, riding a Rail and a Drum, stepping down a passage\'s ledges and a Sinking Stair, under a Pendulum, over a Vent, a Moon branch and a slag crust - and the solver\'s chain is what it crosses (mutants: the Low Road\'s trunk lost; a riser jumped; a gust launched into; a Pendulum judged at the flight\'s middle alone)', () => {
  assert.deepEqual({ ...SWEEP_BUILD }, { speed: 10, running: 0, swimming: 30 }, 'THE SPAN BUILD - SD7b\'s worst build');
  const kinds = new Set();
  let courses = 0, forks = 0;
  // PIN MOVED (AUDIT EG III): spec law 6 draws seed 2's Wellhead circle (Gale-Swept II - two Gust sections) with no Vent left on
  // its courses; seed 6's circle crosses one in place of seed 1's (whose pieces seeds 2 and 6 cross too). PIN MOVED (AUDIT EG V,
  // f): spec law 8 draws seed 1's Shade circle with no Pendulum on its swept roads - seed 9's crosses one beside it
  for (const [band, seed] of [[0, 1], [0, 3], [0, 5], [1, 1], [1, 2], [1, 5], [2, 1], [2, 9], [3, 6], [3, 2]]) {
    give8(seed, band);
    for (const r of sweepSeed(seed, band)) {
      assert.ok(r.ok, `band ${band}: seed ${r.seed} hall ${r.h} road ${r.road} step ${r.step} - ${r.why}`);
      courses++;
      if (r.road === 1) forks++;
      const { c, geo } = sweepCircleOf(seed, band), S = sweepStand(seed, c, geo), spec = S.specs.find((q) => q.h === r.h);
      for (const p of sweepPath(spec, r.road)) for (const q of [p.a, p.b]) if (q) kinds.add(q.kind);
      S.span.clear();
    }
  }
  assert.ok(courses >= 25 && forks >= 4, `${courses} courses, ${forks} Low Roads`);
  for (const k of ['still', 'beat', 'riser', 'drift', 'crumble', 'gust', 'drop', 'ledge', 'bone', 'rail', 'drum', 'sink', 'pend', 'vent', 'moon', 'slag']) assert.ok(kinds.has(k), `a ${k} crossed`);
  // the chain the pilot crosses is the solver's own, road by road (the Low Road's the trunk to the fork, then its own)
  give8(1, 0);
  const { c, geo } = sweepCircleOf(1, 0), S = sweepStand(1, c, geo), fork = S.specs.find((q) => q.fork);
  const high = sweepPath(fork, 0), low = sweepPath(fork, 1);
  assert.ok(low.some((p) => (p.b ?? p.a).road === 0) && low.some((p) => (p.b ?? p.a).road === 1), 'the Low Road crossed from the trunk');
  assert.ok(!low.some((p) => (p.b ?? p.a).road === 0 && (p.a ? p.a.z + p.a.d / 2 : p.edge) >= fork.fork.z - 0.01), 'never the High Road');
  assert.ok(high.every((p) => ((p.b ?? p.a).road ?? 0) === 0));
  assert.ok(high.length <= egSpanPairs(fork).filter((p) => ((p.b ?? p.a).road ?? 0) === 0).length, 'the solver\'s pairs (a hop over no ground taken whole)');
  S.span.clear();
});

test('EG6a A COURSE NOT CROSSED FAILS, NAMING ITS SEED, HALL, ROAD AND STEP: a piece gone from the collider is fallen short of, and the run says which; the CLI\'s exit says so; the seeds a run asks (mutants: a fall called a crossing; the failure unnamed; the exit always clean)', () => {
  give8(3, 0);
  const { c, geo } = sweepCircleOf(3, 0), S = sweepStand(3, c, geo), spec = S.specs.find((q) => egCourseOf(q, 0)?.steps.length >= 6);

  const gone = egCourseOf(spec, 0).steps.find((q, k) => k >= 3 && q.kind !== 'riser');
  S.col.removeBucket(egStepKey(spec.h, gone.i));
  const r = sweepCourse(S, spec, 0, 1_800_000_000 + 7.37);
  assert.equal(r.ok, false, 'not crossed');
  assert.deepEqual([r.seed, r.h, r.road, r.step], [3, spec.h, 0, gone.i], `named: ${r.why}`);
  S.span.clear();
  // the run: each course not crossed said by its seed, hall, road and step; the exit code
  const lines = [];
  const fake = (seed, band) => [{ ok: true, seed, h: 1, road: 0, step: null, why: '', c: 1, geo: 0, t0: 0 }, ...(seed === 2 && band === 1 ? [{ ok: false, seed, h: 37, road: 1, step: 14, why: 'fell short', c: 8, geo: 2, t0: 5 }] : [])];
  assert.deepEqual(runSweep([0, 1], [1, 2], fake, (l) => lines.push(l)), { bad: 1, n: 5 });
  assert.ok(lines.some((l) => /^FAIL seed 2 hall 37 road 1 step 14 .*fell short/.test(l)), lines.join('\n'));
  assert.equal(lines.at(-1), '1 of 5 courses NOT crossed');
  assert.deepEqual(runSweep([0], [1], fake, () => {}), { bad: 0, n: 1 });
  assert.equal(main(['--sweep', '--band', '7'], () => {}), 2, 'a band that is none');
  assert.equal(main(['--sweep', '--band', '1', '--seeds', '2'], () => {}, fake), 1, 'a course not crossed: the exit says so');
  assert.equal(main(['--sweep', '--band', '0', '--seeds', '2'], () => {}, fake), 0, 'every one crossed: a clean exit');
  assert.equal(main([], () => {}), 2, 'the usage');
  assert.deepEqual(sweepSeeds(3), [1, 2, 3]);
  assert.deepEqual(sweepSeeds(2, 10, true), [10, 11, ...SWEEP_GOLDEN]);
  assert.deepEqual([...SWEEP_GOLDEN], [77, 0xbeef, 3, 12345], 'the law pin\'s seeds (test/net/eliteGates/egz_frag.test.js)');
  assert.deepEqual([sweepCircleOf(7, 0), sweepCircleOf(1, 0), sweepCircleOf(12, 3)], [{ c: 3, geo: 7 }, { c: 2, geo: 1 }, { c: 18, geo: 3 }]);
  assert.deepEqual(sweepCircleOf(5, 0), { c: 1, geo: 0 }, 'the first circle has no decree');
  // the solver's reading of a hall (the CLI's other half)
  const rep = solveReport(1, 7, 1).join('\n');
  assert.match(rep, /proof: proven/);
  assert.match(rep, /road 1: \d+ steps/);
  assert.match(rep, /the fast build: [\d.]+ s - EG_CROSS_MIN \d+ ms/);
});

test('EG6a THE SWEEP IN CI: verify.yml (every pull request, every deploy) runs eg-sweep.yml at its `sweep` seeds a band - 25 by default, the law pin\'s golden seeds beside them - in four band jobs beside the shards; eg-sweep.yml runs 500 nightly on its schedule; the relay\'s deploy asks verify for 500 before it drops a player (mutants: the sweep left out of verify; the nightly at a pull request\'s 25; the relay deployed on 25)', () => {
  const v = read('.github/workflows/verify.yml');
  assert.match(v, /\n {6}sweep:\n {8}description: [^\n]+\n {8}type: number\n {8}default: 25\n/, 'verify\'s input: 25 seeds a band');
  assert.match(v, /\n {2}sweep:\n {4}uses: \.\/\.github\/workflows\/eg-sweep\.yml\n {4}with:\n {6}ref: \$\{\{ inputs\.ref \}\}\n {6}seeds: \$\{\{ inputs\.sweep \}\}\n/, 'its sweep job, on the commit it verifies');
  const w = read('.github/workflows/eg-sweep.yml');
  assert.match(w, /\non:\n {2}workflow_call:\n {4}inputs:\n {6}ref:[\s\S]*?\n {6}seeds:\n[\s\S]*?default: 25\n {2}schedule:\n {4}- cron: "[\d* ]+"\n {2}workflow_dispatch:\n {4}inputs:\n {6}seeds:\n[\s\S]*?default: 500\n/);
  assert.match(w, /matrix:\n {8}band: \[0, 1, 2, 3\]/, 'every band');
  assert.match(w, /fail-fast: false/);
  assert.match(w, /ref: \$\{\{ inputs\.ref \}\}/);
  // PIN MOVED (SWEEP-FAST): and its part of the band's seeds (test/tooling/sweepfast.test.js)
  assert.match(w, /run: node tools\/egSpanSolve\.mjs --sweep --band \$\{\{ matrix\.band \}\} --seeds \$\{\{ inputs\.seeds \|\| 500 \}\} --golden --part \$\{\{ matrix\.part \}\}\/\$\{\{ matrix\.parts \}\}\n/, 'a scheduled run (no inputs) sweeps the nightly\'s 500');
  const r = read('.github/workflows/relay-deploy.yml');
  assert.match(r, /\n {2}verify:\n {4}needs: drift\n {4}if: needs\.drift\.outputs\.deploying == 'true'\n {4}uses: \.\/\.github\/workflows\/verify\.yml\n {4}with:\n {6}build: false\n {6}sweep: 500\n/, '500 seeds a band before a relay deploy');
  assert.match(r, /\n {2}deploy:\n {4}needs: \[drift, verify\]\n/, 'and the deploy waits on it');
});

test('EG6a THE SWEEP\'S HARD COURSES (found sweeping seeds 1 to 500 of every band): a Drum\'s widest roll and a gap of 3.19 m to a round island, the jump pressed at the edge (short of it the motor falls short); a vault\'s side lane laid across the gap before a step, landed on at the step\'s height; two Rails whose travels meet, the next stood on as it slides under (mutants: the jump pressed short of the edge; the side lane refused; the Rail jumped past)', () => {
  const crossed = (seed, band, h) => {
    give8(seed, band);
    const out = sweepSeed(seed, band);
    for (const r of out) assert.ok(r.ok, `band ${band}: seed ${seed} hall ${r.h} road ${r.road} step ${r.step} - ${r.why}`);
    assert.ok(out.some((r) => r.h === h && r.road === 0), `hall ${h} swept`);
    const { c, geo } = sweepCircleOf(seed, band), S = sweepStand(seed, c, geo), spec = S.specs.find((q) => q.h === h);
    S.span.clear();
    return spec;
  };
  // the widest: a Drum rolled away at the envelope's widest gap; a still island 3.19 m off a Drift step
  // PIN MOVED (EG-HERO-LAY, spec law 7): seed 295's Hall 2 lays the Colonnade's hero in its passage's place (its drums its
  // own, 2.6 and 3 m apart); seed 10's Hall 2 keeps the kit's at the envelope's widest
  const drum = crossed(10, 0, 2), d7 = drum.steps.find((q) => q.i === 7);
  assert.deepEqual([d7.kind, d7.gap], ['drum', 3.2]);
  const isle = crossed(147, 0, 12), s1 = isle.steps.find((q) => q.i === 1);
  assert.deepEqual([s1.kind, s1.after], ['drift', 3.19]);
  // the hall's own ground at the step's height across the gap before it: a vault's side lane, from the course's line
  const vault = crossed(362, 0, 12), g3 = vault.steps.find((q) => q.i === 3), lane = vault.lanes.find((l) => l.role === 'side');
  assert.ok(lane && Math.abs(lane.ax) < 1e-9 && lane.y === g3.y && lane.az + lane.hw > g3.z - g3.d / 2 - g3.gap && lane.az - lane.hw < g3.z - g3.d / 2, 'the side lane lies across the gap');
  // two Rails side by side whose travels meet. PIN MOVED (AUDIT EG V, f): spec law 8 lays seed 470's Hall 52 through a passage
  // on the way to its fork - seed 22's Hall 62 keeps two such Rails (its steps 4 and 5)
  const rails = crossed(22, 2, 62), r2 = rails.steps.find((q) => q.i === 4), r3 = rails.steps.find((q) => q.i === 5);
  assert.deepEqual([r2.kind, r3.kind], ['rail', 'rail']);
  assert.ok(r2.amp + r3.amp > r3.gap, `their travels meet (${r2.amp} + ${r3.amp} over a gap of ${r3.gap})`);
});
