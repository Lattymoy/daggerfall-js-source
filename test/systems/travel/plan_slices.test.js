// PLAN-SLICES (2026-10-26, the owner: "No band aids"; bible/06-Systems/Travel-View.md PLAN-SLICES) - A JOURNEY'S PLAN IN
// SLICES OF CELLS. The Overworld's planner ran as one call, and a plan past the Bay that found no way spent its whole count
// (up to 300,000 cells, seconds) inside one frame. Its body is a generator (travelRoute.js planRouteSteps), the world
// host's two journeys run through the slicer (systems/travel/planSlices.js), and a plan its first slice does not finish
// goes on a slice a frame while the Travel View says it is planning - its answer the very plan planRoute answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { planRoute, planRouteSteps, drainPlan, PLAN_YIELD_CELLS, searchByRoad, planSeaLanes } from '../../../src/systems/travel/travelRoute.js';
import { createPlanSlices, PLAN_FRAME_CELLS, PLAN_PENDING } from '../../../src/systems/travel/planSlices.js';
import { MAP_W, MAP_H, DIR } from '../../../src/world/road/roadNetwork.js';
import { beyondKey } from '../../../src/world/arenaRoads.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** A slicer whose frames are run by hand. */
const rig = (budget) => {
  const queue = [], said = [];
  const s = createPlanSlices({ budget, schedule: (fn) => queue.push(fn), onPending: () => said.push('planning') });
  const frames = (max = 2000) => { let n = 0; while (queue.length && n < max) { queue.shift()(); n++; } return n; };
  return { s, queue, said, frames };
};
/** The asks: a field walked, one round a wall, the roads past the Bay, a crossing with a boat to hand, a voyage. */
const asks = () => {
  const wall = (x, y) => x === 520 && y > 100 && y < 300;
  const roads = new Map();
  for (let x = 1100; x <= 1700; x++) roads.set(beyondKey(x, 100), (x > 1100 ? DIR.W : 0) | (x < 1700 ? DIR.E : 0));
  const pathsBeyond = (k, x, y) => (k === 'roads' ? roads.get(beyondKey(x, y)) ?? 0 : 0);
  const net = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) };
  const bay = (x, y) => y > 240 && y < 260 && x > 300 && x < 700;
  return [
    [{ x: 100, y: 100 }, { x: 140, y: 120 }, {}],
    [{ x: 500, y: 200 }, { x: 540, y: 200 }, { isWater: wall }],
    [{ x: 1100, y: 100 }, { x: 1700, y: 100 }, { ...net, pathsBeyond }],
    [{ x: 1100, y: 140 }, { x: 1600, y: 300 }, {}],
    [{ x: 500, y: 230 }, { x: 500, y: 270 }, { isWater: bay, sea: { start: 'land', again: true, goal: 'land' } }],
  ];
};

test('PLAN-SLICES the dials: a slice a frame of 20,000 cells, a yield every 1,024 - op counts, never a clock', () => {
  assert.equal(PLAN_FRAME_CELLS, 20000);
  assert.equal(PLAN_YIELD_CELLS, 1024);
});

test('PLAN-SLICES the same plan: the generator run to its end is planRoute\'s answer, and a journey sliced a hundred cells a frame answers it too - for a field, a wall, the roads past the Bay, the open ground past it, a crossing (mutants: a yield that drops a step, the slice\'s key)', () => {
  for (const [from, to, o] of asks()) {
    const once = planRoute(from, to, o);
    assert.deepEqual(drainPlan(planRouteSteps(from, to, o)), once, `${JSON.stringify(from)} -> ${JSON.stringify(to)}: drained`);
    const r = rig(100);
    let got;
    const v = r.s.journey(() => { got = r.s.plan(from, to, o); return 'went'; });
    r.frames();
    assert.deepEqual(got, once, 'sliced');
    assert.ok(v === 'went' || v === true);
  }
  assert.deepEqual(searchByRoad({ x: 1, y: 1 }, { x: 2, y: 2 }, {}), null, 'the drained wrappers stand: no layer, no way by the roads');
  assert.equal(planSeaLanes({ x: 1, y: 1 }, { x: 2, y: 2 }, {}), null);
});

test('PLAN-SLICES the Bay\'s short plans end in their first slice: the journey goes on in the same call, as it always did, and nothing is said (mutant: the budget unread)', () => {
  const r = rig(PLAN_FRAME_CELLS);
  // the Bay's roads: a road along row 100 and one down column 300 - a town by the road, one round a corner
  const net = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) };
  for (let x = 100; x <= 300; x++) net.roads[100 * MAP_W + x] |= (x > 100 ? DIR.W : 0) | (x < 300 ? DIR.E : 0);
  for (let y = 100; y <= 160; y++) net.roads[y * MAP_W + 300] |= (y > 100 ? DIR.N : 0) | (y < 160 ? DIR.S : 0);
  for (const [from, to, o] of [[{ x: 100, y: 100 }, { x: 140, y: 100 }, net], [{ x: 250, y: 100 }, { x: 300, y: 160 }, net], [{ x: 100, y: 100 }, { x: 104, y: 103 }, {}]]) {
    const v = r.s.journey(() => (r.s.plan(from, to, o) ? 'walked' : 'refused'));
    assert.equal(v, 'walked');
  }
  assert.equal(r.queue.length, 0, 'no frame asked');
  assert.deepEqual(r.said, []);
  assert.equal(r.s.planning(), false);
});

test('PLAN-SLICES a long plan: the journey answers "taken up" at once, the view told it is planning once, the plan made a slice a frame (none past its budget by more than a yield\'s cells), and the journey\'s own function run again when it lands - each plan it had asked answered at once (mutants: the pending, the replay, the say once)', () => {
  const r = rig(4096);
  // a plan past the Bay handed the roads where none joins its ends: the roads' search, the ladder's spend, the walk across
  // country - some hundred thousand cells
  const lone = new Map([[beyondKey(3000, 3000), DIR.E], [beyondKey(3001, 3000), DIR.W]]);
  const from = { x: 1100, y: 100 }, to = { x: 1700, y: 700 };
  const o = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H), pathsBeyond: (k, x, y) => (k === 'roads' ? lone.get(beyondKey(x, y)) ?? 0 : 0) };
  const once = planRoute(from, to, o);
  let runs = 0, first = null, got = null;
  const tally = [];
  const v = r.s.journey(() => {
    runs++;
    first = r.s.plan({ x: 100, y: 100 }, { x: 110, y: 100 }, {});   // a short one first
    got = r.s.plan(from, to, o);
    tally.push(got ? 'done' : 'none');
    return 'went';
  });
  assert.equal(v, true, 'taken up');
  assert.deepEqual(r.said, ['planning']);
  assert.equal(r.s.planning(), true);
  const frames = r.frames();
  assert.ok(frames > 1, `${frames} frames`);
  const all = { n: 0 };
  planRoute(from, to, { ...o, tally: all });
  // each slice spends its budget and no more than a yield's cells past it: the frames the cells' count says
  assert.ok(all.n > 20 * 4096, `a long plan (${all.n} cells)`);
  assert.ok(frames >= Math.floor(all.n / (4096 + PLAN_YIELD_CELLS)) && frames <= Math.ceil(all.n / 4096) + 1, `${frames} frames for ${all.n} cells`);
  assert.deepEqual(got, once, 'the plan planRoute makes');
  assert.ok(first && first.pixels.length === 11);
  assert.equal(runs, frames + 1, 'run once at the ask and once a frame - the short plan answered at once each time');
  assert.deepEqual(tally, ['done'], 'the journey went on once, when its plan landed');
  assert.equal(r.s.planning(), false);
  assert.deepEqual(r.said, ['planning'], 'said once');
});

test('PLAN-SLICES a journey begun while one is planning takes its place; an error is the journey\'s own; outside a journey a plan is the one call\'s (mutants: the superseded, the error swallowed)', () => {
  const r = rig(500);
  const [from, to, o] = asks()[3];
  let landed = 0;
  r.s.journey(() => { r.s.plan(from, to, o); landed++; });
  const v = r.s.journey(() => (r.s.plan({ x: 100, y: 100 }, { x: 101, y: 100 }, {}) ? 'second' : null));
  assert.equal(v, 'second');
  r.frames();
  assert.equal(landed, 0, 'the first never lands');
  assert.throws(() => r.s.journey(() => { throw new Error('boom'); }), /boom/);
  assert.equal(r.s.planning(), false);
  assert.deepEqual(r.s.plan(from, to, o), planRoute(from, to, o), 'outside a journey');
  assert.equal(typeof PLAN_PENDING, 'object');
});

test('PLAN-SLICES the host\'s wiring: the world host plans through the slicer, its two journeys run in it, OWS2\'s two asks out of it; the Travel View\'s readout says the plan is being made', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /import \{ planRouteSliced as planRoute, planJourney \} from '\.\.\/systems\/travel\/planSlices\.js';/);
  assert.match(w, /function travelViewRouteTo\(summary, \{ roads = false, voyage = false, noWay = null \} = \{\}\) \{\n\s+return planJourney\(\(\) => \{/);
  assert.match(w, /function travelViewWalkTo\(point, pix, \{ door = null, water = false, roads = false, outside = false \} = \{\}\) \{\n\s+return planJourney\(\(\) => \{/);
  assert.doesNotMatch(w, /function tvMooredDry|const tvSeaAsk = /);
  assert.match(read('src/scenes/travelView.js'), /trip: planning\(\) \? planningLine\(\) : \(deps\.trip\?\.\(\) \?\? ''/);
  assert.match(read('src/scenes/travelView.js'), /const planningLine = \(\) => t\('travelView\.planning', 'Planning the way\.\.\.'\);/);
});

test('PLAN-SLICES a voyage by the sea lanes is sliced too: its two floods\' and its lanes\' cells counted in the plan\'s tally, the same plan at its end (mutants: a flood uncounted, the lanes uncounted)', () => {
  const sea = () => true;   // the open sea everywhere past the Bay's table
  const from = { x: 1200, y: 300 }, to = { x: 1700, y: 300 };
  const o = { isWater: (x, y) => sea(x, y) && !(x === to.x && y === to.y), sea: { start: 'sea', goal: 'land', again: false, voyage: false } };
  const tally = { n: 0 };
  const once = planRoute(from, to, { ...o, tally });
  assert.ok(once, 'a voyage');
  assert.ok(tally.n >= 2 * 513 * 513 - 513, `both floods' cells (${tally.n})`);
  const r = rig(PLAN_FRAME_CELLS);
  let got;
  r.s.journey(() => { got = r.s.plan(from, to, o); });
  const frames = r.frames();
  assert.ok(frames >= 25, `a slice a frame (${frames})`);
  assert.deepEqual(got, once);
});
