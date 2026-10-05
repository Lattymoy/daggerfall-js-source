// LW-FIX3 (2026-10-05, bible/06-Systems/Living-World.md "LW-FIX3"): THE TOWN'S FIVE - the deep audit of the town core
// found a walk begun beyond the street's reach never searched (its walker never came on, though they passed beside the
// player), the watch's beat dropped five stops in six (home hours early), the regard's bound reading the regard as last
// noted (a new acquaintance forgotten as they were met), the chronicle's People never reached by its keys, and a walk
// home cut at 04:00 in plain view. Each pinned here, on the synthetic town (test/lwTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { keydown } from './chargenDom.mjs';   // the minimal DOM - globals
import { synthTown } from './lwTown.mjs';
import { LivingTown, LIVING_RANGE, CENSUS_PATHS, WALK_STRAY_M, walkGap } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN, MIN_STAY, schedule, walkMinutes, dayPlan, guardBeat } from '../src/systems/livingWorld/dayPlan.js';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { createRelations, RELATIONS_MAX, EVENTS } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { mountEnhancedChronicle } from '../src/ui/enhancedChronicle.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;

function bigTown(minute) {
  const { nav, buildings, doors } = synthTown({ blocksW: 6, blocksH: 6 });
  const clock = { t: minute };
  const town = new LivingTown(nav, {
    town: { mapId: 12345, blocks: 36, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM,
  });
  return { town, clock };
}

test('LW-FIX3 the walks coming near: a walk not searched yet that may pass near the player (its two ends\' box within LIVING_RANGE and WALK_STRAY_M) is searched by the census, the nearest first on CENSUS_PATHS a beat - every resident out of doors near the player by their day is on the street, walking or arrived early (mutants: the search, the gap)', () => {
  assert.deepEqual([CENSUS_PATHS, WALK_STRAY_M], [4, 48]);
  const e = { from: { x: 0, z: 0 }, to: { x: 100, z: 40 } };
  assert.equal(walkGap(e, [50, 0, 20]), 0, 'within the box');
  assert.equal(walkGap(e, [130, 0, 20]), 30, 'beside it');
  assert.equal(walkGap(e, [-30, 0, -40]), 50, 'off its corner');
  assert.equal(walkGap({ from: e.to, to: e.from }, [130, 0, 20]), 30, 'either way');
  const minute = 100 * DAY_MIN + 8.5 * 60, at = [200, 0, 120];   // the morning's going to work
  const live = bigTown(minute), truth = bigTown(minute);
  for (let i = 0; i < 120; i++) { live.clock.t += RATE / 30; live.town.update(1 / 30, at, 0, at, true); }
  const t = live.clock.t;
  const rows = new Set(live.town.pool.filter((r) => r.active && r.res).map((r) => r.res.id));
  // by their day, every path searched (the truth's own town: no budget asked)
  const near = [];
  for (const res of truth.town.peopleOf(truth.town.dayOf(t))) {
    const w = truth.town.where(res, t, true);
    if (w && Math.hypot(w.x - at[0], w.z - at[2]) < 70) near.push({ res, moving: w.moving });
  }
  assert.ok(near.length < live.town.maxPopulation, `under the cap: every one wanted (${near.length})`);
  assert.ok(near.filter((n) => n.moving).length >= 6, `walkers among them (${near.filter((n) => n.moving).length})`);
  const missing = near.filter((n) => !rows.has(n.res.id)).map((n) => n.res.id);
  assert.deepEqual(missing, [], 'each on the street');
  // and a walk searched for the census is wanted only within LIVING_RANGE, as any resident
  const edge = bigTown(minute), corner = [-40, 0, -40];
  let walkers = 0;
  for (let i = 0; i < 120; i++) {
    edge.clock.t += RATE / 30;
    edge.town.update(1 / 30, corner, 0, corner, true);
    for (const r of edge.town.pool) {   // every frame: a row is the census's own (never one stood for a beat and let go)
      if (!r.active || !r.res) continue;
      const w = edge.town.where(r.res, edge.clock.t, false);
      if (w?.moving) walkers++;
      assert.ok(!w || Math.hypot(w.x - corner[0], w.z - corner[2]) < LIVING_RANGE + 5, `${r.res.id} within the street's reach`);
    }
  }
  assert.ok(walkers > 0, 'walkers among them');
});

test('LW-FIX3 the watch\'s beat: each stop a stay\'s length at the least (MIN_STAY - a shorter one is dropped) and stops enough for the shift - the beat walked to the shift\'s end, every post of it (mutants: the stop\'s length)', () => {
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false }, buildings);
  let shifts = 0;
  for (const g of census.filter((r) => r.job === 'guard')) {
    for (const day of [100, 101, 102]) {
      const shift = (g.slot + day) % 3;
      if (shift === 2) continue;
      shifts++;
      const [from, until] = shift === 0 ? [6 * 60, 16 * 60] : [14 * 60, 24 * 60];
      const D = day * DAY_MIN;
      const watches = dayPlan(g, places, day, { mpm: MPM }).filter((e) => e.kind === 'watch');
      assert.ok(watches.every((w) => w.t1 - w.t0 >= MIN_STAY), `${g.id} day ${day}: no stop under a stay`);
      assert.ok(watches[0].t0 - D < from + 30, `${g.id} day ${day}: on the beat from the shift's start`);
      assert.ok(watches[watches.length - 1].t1 - D > until - 30, `${g.id} day ${day}: walked to the shift's end (${(watches[watches.length - 1].t1 - D) / 60})`);
      const posts = new Set(watches.map((w) => w.at));
      assert.equal(posts.size, guardBeat(g, places, day).length, 'every post of the beat');
    }
  }
  assert.ok(shifts >= 4);
});

test('LW-FIX3 the regard\'s bound: past RELATIONS_MAX the faintest regard AS IT STANDS today goes first, never the one just noted - a crowd\'s old crime, eased to nothing, never outweighs a new acquaintance (mutants: the eased read, the one just noted)', () => {
  const rel = createRelations();
  for (let i = 0; i < RELATIONS_MAX; i++) rel.note(`L1.${i}`, 'crime', 0);   // a crowd's witnesses, long ago
  rel.note('L2.1', 'talk', 200);
  rel.note('L2.1', 'polite', 200);
  assert.ok(rel.known('L2.1'), 'met');
  assert.equal(rel.regard('L2.1', 200), EVENTS.talk + EVENTS.polite);
  assert.equal(rel.size(), RELATIONS_MAX);
  // the regard as it stands: a deed long eased to nothing goes before a word of yesterday
  const eased = createRelations();
  eased.note('L4.0', 'slain', 0);
  for (let i = 1; i < RELATIONS_MAX; i++) eased.note(`L4.${i}`, 'talk', 299);
  eased.note(`L4.${RELATIONS_MAX}`, 'talk', 300);
  assert.equal(eased.known('L4.0'), false, 'the old deed, eased to nothing, gone');
  assert.ok(eased.known('L4.1') && eased.known(`L4.${RELATIONS_MAX - 1}`) && eased.known(`L4.${RELATIONS_MAX}`), 'yesterday\'s words kept');
  // every one held strongly today: the one just met is kept, the longest unseen of the faintest goes
  const full = createRelations();
  for (let i = 0; i < RELATIONS_MAX; i++) full.note(`L1.${i}`, 'slain', i < 10 ? 0 : 5);
  full.note('L3.1', 'polite', 5);
  assert.ok(full.known('L3.1'), 'the one just noted, kept');
  assert.equal(full.size(), RELATIONS_MAX);
  assert.equal(full.known('L1.0'), false, 'the faintest today, unseen longest, gone');
  assert.ok(full.known('L1.10'));
});

test('LW-FIX3 the chronicle\'s keys walk every section it shows - the People among them, after the History and before the Quests again (mutants: the sections)', () => {
  globalThis.window ??= globalThis;
  const page = { friends: [], enemies: [], known: [] };
  const host = globalThis.document.createElement('div');
  const view = mountEnhancedChronicle(host, { section: 'history', people: () => page });
  const on = () => {
    const out = [];
    const walk = (n) => { if (String(n.className ?? '').split(' ').includes('cr-row') && String(n.className).includes(' on')) out.push(n.textContent); for (const c of n.children ?? []) walk(c); };
    walk(host);
    return out.join('|');
  };
  try {
    assert.match(on(), /History/);
    keydown('ArrowDown');
    assert.match(on(), /People/, 'down from the History: the People');
    keydown('ArrowDown');
    assert.match(on(), /Quests/, 'and round to the Quests');
    keydown('ArrowUp');
    assert.match(on(), /People/, 'up from the Quests: the People');
    keydown('ArrowUp');
    assert.match(on(), /History/);
  } finally { view.destroy(); }
});

test('LW-FIX3 a walk home after an away window that would run past the day\'s end (04:00) is never begun: away to the end, and the next day has them home - nobody cut off mid-step in the street (mutants: the walk held)', () => {
  const home = { key: 'h', kind: 'door', cell: [0, 0], x: 0, z: 0, yaw: 0 };
  const exit = { key: 'x', kind: 'exit', cell: [0, 60], x: 0, z: 96, yaw: 0 };
  const D0 = 240, D1 = D0 + DAY_MIN;
  const back = walkMinutes(exit, home, MPM);
  assert.ok(back > 2);
  const late = schedule([], { D0, D1, wake: 6 * 60, bed: 22 * 60, home, mpm: MPM, away: [{ t0: 20 * 60, t1: D1 - 2, exit, armed: true }] });
  assert.deepEqual(late.slice(-1).map((e) => [e.kind, e.t1]), [['away', D1]], 'away to the day\'s end');
  assert.ok(late.every((e) => e.t1 <= D1), 'nothing past it');
  const next = schedule([], { D0: D1, D1: D1 + DAY_MIN, wake: D1 + 6 * 60, bed: D1 + 22 * 60, home, mpm: MPM, away: [{ t0: 20 * 60, t1: D1 - 2, exit, armed: true }] });
  assert.deepEqual([next[0].kind, next[0].at, next[0].t0], ['sleep', home, D1], 'home asleep as the next day begins');
  // one with the time to walk home walks it, as ever
  const early = schedule([], { D0, D1, wake: 6 * 60, bed: 22 * 60, home, mpm: MPM, away: [{ t0: 20 * 60, t1: D1 - back - 1, exit, armed: true }] });
  assert.deepEqual(early.slice(-2).map((e) => [e.kind, e.t0, e.t1]), [['walk', D1 - back - 1, D1 - 1], ['sleep', D1 - 1, D1]]);
});
