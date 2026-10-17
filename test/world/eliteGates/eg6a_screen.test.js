// EG6a (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 10.1 and 10.3): THE STEPS' READERS ON
// THE SPIRE'S COURSES - scenes/eliteGates/egSpan.js reads the islands' waystones off every course the span generator lays (net/eliteGates/egSpanLaw.js
// egCourseOf, a road at a time: the Steps' sdWaystonesOf over each course's checkpoints but the arrival plate); a Gust's
// breath and its banners keep to its own run of pieces on its own road's line (world/eliteGates/egLook.js egGustSections,
// EG_GUST_REACH_M); and the ghosts are drawn once a frame. The stones' look, the ghosts and their pass are EG-ZL's
// (test/world/eliteGates/egz_tells.test.js) - at the merge each was built twice, and EG-ZL's is the one kept.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEgSpan, EG_FLOOR_KEY, EG_GUST_REACH_M, EG_GUST_STOREY_M, egGustStorey } from '../../../src/scenes/eliteGates/egSpan.js';
import { egGustSections } from '../../../src/world/eliteGates/egLook.js';
import { egCircleSpecs, egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { egCourseOf } from '../../../src/net/eliteGates/egSpanLaw.js';
import { sdVaneAt } from '../../../src/world/superDungeon/sdStepsModel.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { gustAt } from '../../../src/world/superDungeon/sdSteps.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(1, [2], 1);
  egGive8(25, [6], 7);
  egGive8(1, [9], 0);   // PIN MOVED (THE ASCENT): the Gust test's fork (seed 1, circle 9) law 8's too
});

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** The span over a fake renderer (a mesh a model, every free heard). */
function rig(seed, c, geo) {
  const draws = [], dropped = [];
  const renderer = { createMesh: (m) => ({ m }), destroyMesh: (x) => dropped.push(x), uploadTexture: () => {}, uploadEmissionTexture: () => {} };
  const span = createEgSpan({ renderer, seed, c, geo });
  span.stand({ dynamicDraws: draws, collider: { addMesh: () => {} } });
  return { span, draws, dropped };
}
const body = (p, groundKey = EG_FLOOR_KEY, grounded = true) => ({ pos: [...p], grounded, groundKey, height: 1.8, jumping: false, carryBy: () => {}, collider: { move: (feet, dx) => { feet[0] += dx; } } });
const shown = (q) => q.filter((g) => g.lit && !g.lit.hidden).map((g) => [g.h, g.x, g.z]);
/** Stand at `p` two frames (the marks are posed at the frame's start, so the stone lit shows the frame after). */
const stand = (span, t, p) => { span.ride(t, 1 / 60, body(p), true); span.ride(t + 1 / 60, 1 / 60, body(p), true); };

test('EG6a THE WAYSTONES READ OFF THE COURSES (section 10.1: the course is the Steps\' own record): every course the generator laid, a road at a time (egCourseOf), gives its checkpoints but the arrival plate a stone - every island, the Low Road\'s its own; my cast-back\'s stone lit as I stand on the High Road\'s island, then the Low Road\'s, and none on the arrival plate (mutants: the arrival plate given a stone)', () => {
  const { span } = rig(1, 2, 1);
  const want = [];
  for (const spec of egCircleSpecs(1, 2, 1)) for (const road of [0, 1]) {
    const c = egCourseOf(spec, road);
    if (c) c.checkpoints.forEach((q, k) => { if (road === 1 || k > 0) want.push([spec.h, q.x, q.z]); });
  }
  assert.ok(want.length >= 4 && want.some((q) => q[1] === 15), 'the islands, the Low Road\'s among them');
  assert.deepEqual(span.marks.stones.map((g) => [g.h, g.x, g.z]), want, 'a stone a checkpoint, the arrival plate none');
  const spec = egHallOf(1, 7, 1), isle = spec.islands.filter((q) => q.road === 0)[1], low = spec.islands.find((q) => q.road === 1);
  stand(span, 10, realmToDungeon(spec.x0 + isle.x, isle.y, isle.z));
  assert.deepEqual(shown(span.marks.stones), [[7, isle.x, isle.z]], 'the High Road\'s island I would be cast back to');
  stand(span, 11, realmToDungeon(spec.x0 + low.x, low.y, low.z));
  assert.deepEqual(shown(span.marks.stones), [[7, 15, low.z]], 'the Low Road\'s island now');
  stand(span, 12, realmToDungeon(spec.x0, 0, 0));
  assert.deepEqual(shown(span.marks.stones), [], 'on the arrival plate, none');
  span.clear();
});

test('EG6a A GUST\'S BREATH AND ITS BANNERS (section 10.3): over each run of a hall\'s Gust pieces, an island\'s reach either side, on its own road\'s line - the Crumbles between two runs and THE FORK\'s other road stand in no breath (the course sweep found both blowing), and the other road\'s island beside a run carries no banner of its (mutants: the runs one section; the breath across the hall; the banner on the other road\'s island)', () => {
  const spec = egHallOf(25, 27, 7);
  const G = egGustSections([spec]);
  // PIN MOVED (AUDIT EG III): spec law 6 lays Gale-Swept on the Low Road too (its run on its own line, x 15, 4.5 m down) - the
  // High Road's two runs as before, the second where law 6 lays it
  assert.deepEqual(G.map((g) => [g.spec.h, g.road, g.x, g.y, +g.z0.toFixed(2), +g.z1.toFixed(2)]), [[27, 0, 0, 0, 48.58, 69.47], [27, 0, 0, 0, 84.02, 100.3], [27, 1, 15, -4.5, 87.06, 103.03]], 'two runs, two sections - and the Low Road\'s its own');
  assert.equal(EG_GUST_REACH_M, 6);
  const { span } = rig(25, 6, 7);
  let t = 0;
  for (let k = 0; k < 1200; k++) if (gustAt(k * 0.01).push) { t = k * 0.01; break; }
  const pushed = (x, z) => { const B = body(realmToDungeon(spec.x0 + x, 0, z)); const x0 = B.pos[0]; span.ride(t, 0.05, B, true); return B.pos[0] !== x0; };
  assert.equal(pushed(0, 60), true, 'on a run\'s line, blown');
  assert.equal(pushed(0, 80), false, 'the Crumbles between the runs: still');
  assert.equal(pushed(spec.fork.lowX, 60), false, 'the Low Road under it: still');
  assert.equal(pushed(EG_GUST_REACH_M - 0.5, 100), true, 'an island\'s reach across');
  span.clear();
  // seed 1's circle 9: the High Road's run reaches past the Low Road's island at x 15 - a banner on its own islands alone
  const fork = egCircleSpecs(1, 9, 0).find((q) => q.h === 42), low = fork.islands.find((q) => q.road === 1);
  const run = egGustSections([fork]).find((g) => g.road === 0);
  assert.ok(low.z + low.r >= run.z0 && low.z - low.r <= run.z1 && Math.abs(low.x - run.x) > EG_GUST_REACH_M, 'the Low Road\'s island beside the High Road\'s run');
  const R = rig(1, 9, 0), at = sdVaneAt({ checkpoints: [low, low, low] }), off = realmToDungeon(fork.x0 + at[0], at[1], at[2]);
  const vanes = R.span.marks.vanes.filter(Boolean).map((d) => [d.object.matrix[12], d.object.matrix[13], d.object.matrix[14]]);
  assert.ok(vanes.length >= 1, 'the run\'s own islands bannered');
  assert.ok(!vanes.some((v) => Math.hypot(v[0] - off[0], v[2] - off[2]) < 0.01), 'none on the Low Road\'s island');
  R.span.clear();
});

test('EG6a THE GHOSTS DRAWN ONCE A FRAME: the dungeon host\'s door (egSpanDraw) is called by the breach client\'s pass alone (EG-ZL - scenes/eliteGates/egClient.js drawPass); the world host\'s Spire pass draws the telegraphs and the spoils and no ghost a second time (at the merge both drew them) (mutants: the world host drawing them again)', () => {
  const D = read('src/scenes/dungeonContext.js'), W = read('src/scenes/world.js'), C = read('src/scenes/eliteGates/egClient.js');
  assert.match(D, /\n {4}egSpanDraw\(proj, view, fog\) \{ return !!egSpan\?\.drawPass\(proj, view, fog\); \},/);
  assert.match(C, /egSpanDraw\?\.\(proj, view, fog\)/, 'the breach client\'s pass draws them');
  const fight = W.split('\n').find((l) => l.includes('drawEgFight: ({ proj, view, eye }) =>'));
  assert.ok(fight && fight.includes('egClient?.drawPass(') && !fight.includes('egSpanDraw'), 'the world host\'s pass, no second draw');
});

test('EG6a A GUST PUSHES ITS OWN STOREY (THE ASCENT; the relay deploy\'s 500-seed sweep, band 3 seed 210 - a bridge 21 m over a Gust\'s floor, pushed off it): a law 9 section pushes from EG_GUST_STOREY_M.under under its lowest step to .over over its highest; the laws before stack no storeys and push at every height (mutant: the section matched in plan alone)', () => {
  const g = { spec: { law: 9 }, y: 0, y1: 1.2 };
  assert.equal(egGustStorey(g, 0.5), true, 'on the course');
  assert.equal(egGustStorey(g, 1.2 + EG_GUST_STOREY_M.over), true, 'a jump over its top step');
  assert.equal(egGustStorey(g, 21), false, 'a bridge a storey over it');
  assert.equal(egGustStorey(g, -EG_GUST_STOREY_M.under - 0.1), false, 'a floor under it');
  assert.equal(egGustStorey({ spec: { law: 8 }, y: 0, y1: 1.2 }, 21), true, 'the laws before: every height');
  assert.equal(egGustSections(egCircleSpecs(210, 16, 0)).every((s) => s.y1 >= s.y), true, 'every section knows its top');
});
