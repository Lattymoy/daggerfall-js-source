// AUDIT-WH R5 - THE HOVER'S COST, RE-RUNNABLE.
//
//   node tools/hoverCost.mjs
//
// The slice's records say "measured rather than guessed" about a dozen
// numbers - the ray at ~3 us, the pick at ~21 ns a target, the list
// build at 95-97% of a hover, the streaming city's door list at ~200
// us and ~4,500 allocations a frame - and the measurements lived in a
// chat log. A number nobody can re-run is a guess with a decimal point
// on it, which is the exact criticism PX21c's 10 Hz throttle earned.
//
// So this is the harness. It drives the PURE halves the plaque is
// actually made of, against synthetic scenes sized like real ones, and
// prints a table with its own scale factor so a number measured on one
// machine can be compared with a number measured on another.
//
// What it does NOT measure, and says so rather than pretending: the
// DOM paint (no document here), `buildingUnderRay` (needs a built
// city) and the interior/dungeon list builds (they need a context).
// Those are named in the record with the numbers Lane E took, and this
// harness covers the three the port can stand up headless.

import { performance } from 'node:perf_hooks';
import {
  pickActivatableHit, liveFoeTargets, foeAabb, rayAabb,
  RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE,
} from '../src/player/activate.js';
import { resolveHover, frameSignature, composeNamer, composeContents } from '../src/systems/worldHover.js';
import { raceWinner } from '../src/player/activationRace.js';

const OPEN = { raycast: () => Infinity };
const box = (z) => ({ min: [-0.5, 0, z], max: [0.5, 2, z + 1] });

/** A scene's worth of activation targets, spread down +Z. */
const targets = (n, prefix = 'door') => Array.from({ length: n }, (_, i) => ({
  key: `${prefix}:${i}`, aabb: box(2 + i * 0.7), distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE,
}));

/** A pool of live foes, in the shape the two pools hand over. */
const foes = (n) => Array.from({ length: n }, (_, i) => ({
  entity: {}, mobileType: (i % 40) + 1, ai: { feet: [0, 0, 2 + i * 0.7], height: 1.9, isHostile: i % 3 === 0 },
}));

function bench(label, fn, { iters = 2000, warm = 500 } = {}) {
  for (let i = 0; i < warm; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const us = ((performance.now() - t0) / iters) * 1000;
  return { label, us };
}

/** The machine's own speed, so two runs are comparable. A tight loop
 *  of the arithmetic everything below is made of. */
function scale() {
  const a = box(2);
  return bench('rayAabb x1000', () => { for (let i = 0; i < 1000; i++) rayAabb([0, 0, 0], [0, 0, 1], a); }, { iters: 200, warm: 50 }).us;
}

const rows = [];
const eye = [0, 0, 0], dir = [0, 0, 1];

// 1. THE RAY. One pick over a list already held.
for (const n of [18, 60, 150, 300]) {
  const t = targets(n);
  rows.push(bench(`pick over ${String(n).padStart(3)} held targets`, () => pickActivatableHit(eye, dir, t, OPEN)));
}

// 2. THE LIST. What a host pays to BUILD one - the half the records
//    call 95-97% of a hover, and the reason the seam takes a thunk.
for (const n of [20, 60, 150]) {
  const pool = foes(n);
  rows.push(bench(`build ${String(n).padStart(3)} live-foe targets`, () => liveFoeTargets(pool, 'mobileFoe')));
}
rows.push(bench('one foeAabb', () => foeAabb({ ai: { feet: [0, 0, 3], height: 1.9 } }), { iters: 20000, warm: 2000 }));

// 3. THE MODEL. The race, the resolve and the signature - the whole of
//    what happens after the pick, per frame.
const pick = { key: 'loot:3', distance: 2, reach: 3.2 };
const items = Array.from({ length: 6 }, (_, i) => ({ name: `Item ${i}`, stackCount: i % 3 }));
const name = composeNamer([() => null, () => null, () => ({ title: 'Loot Pile' })]);
const contents = composeContents([() => null, () => items]);
rows.push(bench('raceWinner over 8 picks', () => raceWinner({
  camp: null, water: { key: 'water:0', distance: 9 }, wagon: null, torch: { key: 't', distance: 5 },
  corpse: { key: 'c', distance: 4 }, pile: null, ground: pick, person: { key: 'p', distance: 6 }, foe: null,
}), { iters: 20000, warm: 2000 }));
rows.push(bench('resolveHover, 6-row pile', () => resolveHover(pick, { name, contents })));
const frame = resolveHover(pick, { name, contents });
rows.push(bench('frameSignature, 6 rows', () => frameSignature(frame), { iters: 20000, warm: 2000 }));

const s = scale();
const FRAME_MS = 16.7;
console.log(`\nWORLD-HOVER cost, ${new Date().toISOString().slice(0, 10)}`);
console.log(`machine scale: ${s.toFixed(1)} us / 1000 rayAabb  (divide by this to compare runs)\n`);
for (const r of rows) {
  const pct = (r.us / 1000 / FRAME_MS) * 100;
  console.log(`  ${r.label.padEnd(34)} ${r.us.toFixed(3).padStart(9)} us   ${pct.toFixed(4).padStart(8)}% of a 16.7 ms frame`);
}
console.log('\nNOT measured here (each needs a browser or a built scene, and the record');
console.log('carries Lane E\'s numbers for them): the DOM paint, buildingUnderRay over a');
console.log('built city, and the interior/dungeon list builds (worldAabb per container,');
console.log('objectAabb per action object - 0.018-0.117 ms and 0.068-0.582 ms normalized).\n');
