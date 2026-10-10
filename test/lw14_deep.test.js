// LW14 (bible/06-Systems/Living-World-II.md "LW14"): THE DEEP'S OWN - a dungeon's stops in a company's order (its random
// foes and treasure, never a fixed foe, a quest's marker or fixed treasure; the blocks breadth first from the start's,
// nearest first within), the dive's timeline over them (its reach by the dive's middle, the way out by its end, the
// deep's own fight), where they are at a minute, what they leave (built dead and emptied, piles empty, for a day), the
// dice's end at its true stop; the company met where its route has it, heard, its three choices, the trail, the
// retreat, the rival's word; the host's seams. Pure and synthetic: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  stopsOf, routeOf, stopAt, pointAt, clearedOf, stopOfMinute, deepFightOf, stopDwellOf as dwellOf, STOP_FOE, STOP_TREASURE, DEEP_FOE_MIN, DEEP_TREASURE_MIN,
  DEEP_DETOUR, DEEP_WALK_M, DEEP_RISK, DEEP_FIGHT_MIN, DIVE_CLEAR_MIN,
} from '../src/systems/livingWorld/deepRoute.js';
import {
  createDungeonDivers, DEEP_NEAR_M, DEEP_SEE_M, DEEP_HEAR_M, DEEP_KEEP_M, RETREAT_HP, RETREAT_BACK_M, POACHED_LINE, DIVER_TRAIL_STEP_M, DIVER_TRAIL_MAX,
  DEEP_FLOOR_DY, DIVER_ARRIVE_SLACK_M,
} from '../src/scenes/dungeonDivers.js';
import { TREASURE_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { createDeepRemains } from '../src/scenes/deepRemains.js';
import { activateMobileEnemy } from '../src/player/mobileEnemyActivate.js';
import { createRelations, EVENTS } from '../src/systems/livingWorld/relations.js';
import { divesIn, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { synthMap, livingMap } from './lwRoads.mjs';

const SIDE = 100;
/** A block of the grid (gx, gz) with markers [record, x, z, extra]. */
const block = (gx, gz, marks) => ({ originX: gx * SIDE, originZ: gz * SIDE, layout: { markers: marks.map(([record, x, z, extra = {}], i) => ({ record, x, y: 0, z, position: 100 + i, loadID: gx * 1000 + gz * 100 + i, ...extra })) } });
/** A dungeon of four blocks in an L - start (0,0), east (1,0), south (0,1), and (2,0) east of east - and one apart (5,5). */
const dungeon = () => [
  block(0, 0, [[10, 50, 50], [STOP_FOE, 60, 50], [STOP_TREASURE, 90, 90], [16, 55, 55], [11, 52, 52], [18, 51, 51], [STOP_FOE, 10, 10, { archive: 216 }]]),
  block(1, 0, [[STOP_FOE, 30, 50], [STOP_TREASURE, 10, 50]]),
  block(0, 1, [[STOP_FOE, 50, 10]]),
  block(2, 0, [[STOP_FOE, 50, 50]]),
  block(5, 5, [[STOP_TREASURE, 50, 50]]),
];
const ENTRY = { x: 50, z: 50 };

test('LW14 the stops: the random foes (15) and treasure (19) alone - never a fixed foe (16), a quest\'s marker (11, 18) or fixed treasure (216) - from the start\'s block, the blocks breadth first by the grid (east, west, south, north), nearest first within each from where they came in; a block the grid does not join last (mutants: the records, the order, the nearest)', () => {
  assert.deepEqual([STOP_FOE, STOP_TREASURE], [15, 19]);
  const stops = stopsOf(dungeon(), SIDE, ENTRY);
  assert.deepEqual(stops.map((s) => s.key), ['0:101', '0:102', '1:101', '1:100', '2:100', '3:100', '4:100']);
  assert.deepEqual(stops.map((s) => s.kind), ['foe', 'treasure', 'treasure', 'foe', 'foe', 'foe', 'treasure']);
  assert.deepEqual([stops[0].x, stops[0].z, stops[2].x, stops[2].z], [60, 50, 110, 50], 'the dungeon\'s frame');
  assert.equal(stops[0].loadID, 1, 'a foe\'s identity');
  assert.deepEqual(stopsOf(dungeon(), SIDE, ENTRY), stops, 'every reader the same');
  // from another block's entry: that block first
  assert.equal(stopsOf(dungeon(), SIDE, { x: 150, z: 50 })[0].block, 1);
  assert.deepEqual(stopsOf([], SIDE, ENTRY), []);
});

test('LW14 the timeline: each stop its minutes (a foe\'s DEEP_FOE_MIN by its seed, a treasure\'s DEEP_TREASURE_MIN), the walk between DEEP_DETOUR times the floor at DEEP_WALK_M a minute; the reach by the dive\'s middle, the way out back to the start by its end; where they are at a minute (mutants: the dwell, the walk, the reach, the way out)', () => {
  assert.deepEqual([...DEEP_FOE_MIN], [25, 40]);
  assert.deepEqual([DEEP_TREASURE_MIN, DEEP_DETOUR, DEEP_WALK_M], [10, 1.6, 30]);
  const stops = stopsOf(dungeon(), SIDE, ENTRY);
  const trip = { id: 'L1.t1:9', enc: { id: 'x', inside: true }, dive: { t0: 1000, t1: 1000 + 400 } };   // a fated trouble: no deep fight of its own   // PIN MOVED (AUDIT LW-II-2 D8): a fated trouble is one met INSIDE (trouble.js diveTrouble mints `inside: true`) - a road's takes nothing from the deep
  const r = routeOf(stops, ENTRY, trip);
  assert.ok(r.legs.length >= 2);
  let t = 1000, at = ENTRY;
  for (const l of r.legs) {
    const walk = (Math.hypot(l.stop.x - at.x, l.stop.z - at.z) * DEEP_DETOUR) / DEEP_WALK_M;
    assert.ok(Math.abs(l.tIn - (t + walk)) < 1e-9, 'walked');
    assert.equal(l.tOut - l.tIn, dwellOf(l.stop));
    if (l.stop.kind === 'treasure') assert.equal(l.tOut - l.tIn, DEEP_TREASURE_MIN);
    else assert.ok(l.tOut - l.tIn >= DEEP_FOE_MIN[0] && l.tOut - l.tIn <= DEEP_FOE_MIN[1]);
    assert.ok(l.tOut <= 1200, 'the reach by the middle');
    t = l.tOut; at = l.stop;
  }
  assert.ok(r.legs.length < stops.length, 'not every stop in one dive');
  assert.equal(r.out.t1, 1400);
  assert.deepEqual(r.out.path[r.out.path.length - 1], ENTRY, 'back to the start');
  // where they are
  assert.equal(stopAt(r, 999), null, 'not in yet');
  assert.equal(stopAt(r, 1400), null, 'out');
  const first = r.legs[0];
  assert.ok(stopAt(r, first.tIn - 0.01).between, 'walking to it');
  assert.equal(stopAt(r, first.tIn + 0.5).at, first.stop);
  assert.equal(stopAt(r, first.tIn + 0.5).fighting, first.stop.kind === 'foe');
  const o = pointAt(r, 1399.9);
  assert.ok(Math.hypot(o.x - ENTRY.x, o.z - ENTRY.z) < 15, 'at the end of the way out, by the start');
  assert.ok(stopAt(r, (r.out.t0 + 1400) / 2).out, 'on the way out');
  assert.equal(routeOf(stops, ENTRY, { id: 'x', dive: null }), null);
});

test('LW14 the deep\'s own fight: DEEP_RISK of the dives with no fated trouble meet one at a foe stop of the seed\'s - DEEP_FIGHT_MIN more there, the rest of the reach after it; a fated dive\'s trouble its own (mutants: the risk, the minutes, the fated)', () => {
  assert.deepEqual([DEEP_RISK, DEEP_FIGHT_MIN], [0.5, 20]);
  let n = 0;
  for (let i = 0; i < 2000; i++) if (deepFightOf({ id: `L1.t${i}:3` }) != null) n++;
  assert.ok(Math.abs(n / 2000 - DEEP_RISK) < 0.04);
  assert.equal(deepFightOf({ id: 'L1.t0:3', enc: { id: 'e', inside: true } }), null);   // PIN MOVED (AUDIT LW-II-2 D8): the fated trouble met inside, as diveTrouble mints it
  const stops = stopsOf(dungeon(), SIDE, ENTRY);
  for (let i = 0; i < 60; i++) {
    const id = `L1.t${i}:5`;
    if (deepFightOf({ id }) == null) continue;
    const plain = routeOf(stops, ENTRY, { id, enc: { id: 'e', inside: true }, dive: { t0: 0, t1: 600 } });   // PIN MOVED (AUDIT LW-II-2 D8): a fated trouble is one met inside
    const fought = routeOf(stops, ENTRY, { id, dive: { t0: 0, t1: 600 } });
    const longer = fought.legs.findIndex((l, j) => plain.legs[j] && l.tOut - l.tIn > plain.legs[j].tOut - plain.legs[j].tIn);
    if (longer < 0) continue;
    assert.equal(fought.legs[longer].stop.kind, 'foe');
    assert.equal((fought.legs[longer].tOut - fought.legs[longer].tIn) - (plain.legs[longer].tOut - plain.legs[longer].tIn), DEEP_FIGHT_MIN);
    return;
  }
  assert.fail('no deep fight found');
});

test('LW14 what they leave: the stops a dive left within DIVE_CLEAR_MIN before the build - none it is at, none after a day - the same for two readers; the dice\'s end at the stop its minute reaches (mutants: the window, the left, the stop)', () => {
  assert.equal(DIVE_CLEAR_MIN, DAY_MIN);
  const stops = stopsOf(dungeon(), SIDE, ENTRY);
  const r = routeOf(stops, ENTRY, { id: 'L1.t1:9', enc: { id: 'x', inside: true }, dive: { t0: 1000, t1: 1400 } });   // PIN MOVED (AUDIT LW-II-2 D8): a fated trouble is one met inside
  const [a, b] = r.legs;
  const mid = (b.tIn + b.tOut) / 2;
  assert.deepEqual([...clearedOf([r], mid)], [a.stop.key], 'the one left, not the one at');
  assert.deepEqual([...clearedOf([r], b.tOut)].sort(), [a.stop.key, b.stop.key].sort());
  assert.deepEqual([...clearedOf([r], a.tOut + DIVE_CLEAR_MIN - 1)].includes(a.stop.key), true);
  assert.equal(clearedOf([r], a.tOut + DIVE_CLEAR_MIN).has(a.stop.key), false, 'a day on, as Daggerfall built it');
  const r2 = routeOf(stopsOf(dungeon(), SIDE, ENTRY), ENTRY, { id: 'L1.t1:9', enc: { id: 'x', inside: true }, dive: { t0: 1000, t1: 1400 } });   // PIN MOVED (AUDIT LW-II-2 D8): a fated trouble is one met inside
  assert.deepEqual([...clearedOf([r2], b.tOut)], [...clearedOf([r], b.tOut)], 'two readers alike');
  assert.equal(stopOfMinute(r, a.tIn + 1), a.stop);
  assert.equal(stopOfMinute(r, b.tIn - 0.001), b.stop, 'the nearer of the two walked between');
  assert.equal(stopOfMinute(r, a.tOut + 0.001), a.stop, 'just left: the one behind');
  assert.equal(stopOfMinute(null, 5), null);
});

test('LW14 the dives a build reads: every party of the towns within reach whose hours inside touch the window, once each, the oldest first (mutants: the window, the dungeon)', () => {
  const map = livingMap({ dives: true });
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  let found = null;
  for (const d of map.dungeons) {
    const t = 300 * DAY_MIN + 600;
    const got = divesIn(d, t - DIVE_CLEAR_MIN, t, map.world, o);
    if (got.dives.length) { found = { d, t, got }; break; }
  }
  assert.ok(found, 'a dungeon dived');
  const { d, t, got } = found;
  for (const tr of got.dives) {
    assert.equal(tr.to.mapId, d.mapId);
    assert.ok(tr.dive.t0 < t && tr.dive.t1 > t - DIVE_CLEAR_MIN);
  }
  // a narrow window: only the hours inside that touch it (one ended before it is not read)
  for (let k = 0; k < 40; k++) {
    const tt = t + k * 180;
    for (const tr of divesIn(d, tt - 30, tt, map.world, o).dives) { assert.ok(tr.dive.t0 < tt && tr.dive.t1 > tt - 30, `${tr.id} touches the window`); }
  }
  assert.equal(new Set(got.dives.map((x) => x.id)).size, got.dives.length);
  assert.ok(got.dives.every((x, i) => i === 0 || got.dives[i - 1].dive.t0 <= x.dive.t0));
  // AUDIT LW-II F9: a window a hundred days on holds its own dives - each touching it, none of the first window's
  const later = divesIn(d, t + 100 * DAY_MIN, t + 100 * DAY_MIN + 600, synthMap({ dives: true }).world, o).dives;
  assert.ok(later.every((x) => x.dive.t0 < t + 100 * DAY_MIN + 600 && x.dive.t1 > t + 100 * DAY_MIN), 'each touches its window');
  assert.ok(later.every((x) => !(x.dive.t0 < t && x.dive.t1 > t - DIVE_CLEAR_MIN)), 'none of the first');
});

/** A divers host over one company with a route, its deps recorded. */
function diversOver({ player = [0, 0, 0], clear = false, rel = createRelations(), route = null, extra = {}, n = 3 } = {}) {
  const trip = { id: 'L1.t1:7', leader: { id: 'L1.t1', name: 'Ada Lark' }, party: [], to: { name: 'Mournoth' }, backT0: 1e9, dive: { t0: 0, t1: 1e9 }, company: { name: 'The Lantern Company' } };
  const members = Array.from({ length: n }, (_, i) => ({ id: `L1.t${i + 1}`, name: `Mem${i} Lark`, cls: 140 + i, level: 5 + i, sex: 'male' }));
  trip.party = members;
  const st = { feet: player, said: [], rung: [], spawned: [], chose: null, now: 0 };
  const deps = {
    spawn: (type, feet) => { const rec = { type, feet, dead: false, ai: { feet: [...feet] }, entity: { health: 100, maxHealth: 100 } }; st.spawned.push(rec); return Promise.resolve(rec); },
    remove: (rec) => { rec.removed = true; }, inPool: (rec) => !rec.removed,
    leader: () => ({ feet: st.feet, yaw: 0 }), spot: (from, dx, dz) => [from[0] + dx, from[1], from[2] + dz], owner: () => true,
    relations: () => rel, turnKeyOf: (res) => res.id, dies: () => false, day: () => 0, say: (s) => st.said.push(s),
    route: () => route, floor: (x, y, z) => [x, 0, z], clearLine: () => clear, ring: (f) => st.rung.push(f),
    choose: (lines, options) => { st.chose = { lines, options }; return true; }, stopPile: (key) => st.piles?.[key] ?? null, realNow: () => st.now,   // PIN MOVED (AUDIT LW-II-2 D4): the window mounted, as the dungeon's showOverlay answers (offers answers whether it did)
  };
  return { host: createDungeonDivers({ ...deps, ...extra }), st, trip, members, rel };
}
const tick = () => new Promise((r) => setImmediate(r));
/** A route of three stops along x - a foe at 10, a treasure at 30, a foe at 60 - and the minutes at each. */
const lineRoute = () => {
  const s = (key, kind, x) => ({ key, kind, x, y: 0, z: 0, block: 0, loadID: 0 });
  const legs = [{ stop: s('0:1', 'foe', 10), tIn: 10, tOut: 40, fight: true }, { stop: s('0:2', 'treasure', 30), tIn: 50, tOut: 60, fight: false }, { stop: s('0:3', 'foe', 60), tIn: 80, tOut: 110, fight: true }];
  return { legs, entry: { x: 0, z: 0 }, out: { t0: 200, t1: 300, path: [{ x: 60, z: 0 }, { x: 0, z: 0 }] }, t0: 0 };
};

test('LW14 met where the route has them: within DEEP_NEAR_M of their place, or DEEP_SEE_M with a clear line - stood about it and holding there (no follow); farther, a fight heard within DEEP_HEAR_M rings steel and says so once; no route, met behind the player as before (mutants: the near, the seen, the hold, the heard)', async () => {
  assert.deepEqual([DEEP_NEAR_M, DEEP_SEE_M, DEEP_HEAR_M, DEEP_KEEP_M], [15, 35, 60, 70]);
  assert.deepEqual([DIVER_TRAIL_STEP_M, DIVER_TRAIL_MAX], [0.75, 64], 'crewAshore.js\'s own trail');
  const route = lineRoute();
  // far, fighting at 10 (minute 20): heard
  const far = diversOver({ player: [10, 0, 50], route });
  far.host.frame([{ trip: far.trip, members: far.members }], 20);
  assert.equal(far.host.size, 0);
  assert.deepEqual(far.st.said, ['You hear fighting ahead.']);
  assert.equal(far.st.rung.length, 1);
  far.host.frame([{ trip: far.trip, members: far.members }], 21);
  assert.equal(far.st.said.length, 1, 'said once');
  assert.equal(far.st.rung.length, 1, 'not every frame');
  far.st.now = 10;
  far.host.frame([{ trip: far.trip, members: far.members }], 22);
  assert.equal(far.st.rung.length, 2, 'now and then');
  const deaf = diversOver({ player: [10, 0, DEEP_HEAR_M + 5], route });
  deaf.host.frame([{ trip: deaf.trip, members: deaf.members }], 20);
  assert.deepEqual(deaf.st.said, [], 'too far to hear');
  // seen with a clear line
  const seen = diversOver({ player: [10, 0, 30], route, clear: true });
  seen.host.frame([{ trip: seen.trip, members: seen.members }], 20);
  assert.equal(seen.host.size, 1);
  await tick();
  assert.equal(seen.st.spawned.length, 3);
  assert.ok(seen.st.spawned.every((r) => Math.hypot(r.feet[0] - 10, r.feet[2]) < 6), 'about their stop');
  assert.ok(seen.st.spawned.every((r) => !r.ai.follow), 'holding there');
  assert.match(seen.st.said[0], /You come upon The Lantern Company, at work in Mournoth/);
  const blocked = diversOver({ player: [10, 0, 30], route, clear: false });
  blocked.host.frame([{ trip: blocked.trip, members: blocked.members }], 20);
  assert.equal(blocked.host.size, 0, 'no line, not met at 30 m');
  const near = diversOver({ player: [10, 0, DEEP_NEAR_M - 1], route });
  near.host.frame([{ trip: near.trip, members: near.members }], 20);
  assert.equal(near.host.size, 1, 'near: met without a line');
  // no route: behind the player, following
  const old = diversOver({ player: [0, 0, 0], route: null });
  old.host.frame([{ trip: old.trip, members: old.members }], 20);
  await tick();
  assert.ok(old.st.spawned.every((r) => r.ai.follow), 'as before: they follow');
  assert.equal(typeof old.st.spawned[0].ai.follow.trail, 'function', 'along the trail');
});

test('LW14 the door: JOIN US (they follow along the player\'s trail), LEAD ON (on to their next stop, then the one after), PART WAYS (they keep to their own, asked no more); the activation\'s door for one of them (mutants: each choice, the trail, the door)', async () => {
  const route = lineRoute();
  const { host, st, trip, members } = diversOver({ player: [10, 0, 5], route });
  host.frame([{ trip, members }], 20);
  await tick();
  const rec = st.spawned[0];
  rec.living = { id: members[0].id, res: members[0] };
  assert.equal(host.offers({ living: { id: 'nobody' } }, () => {}), false);
  assert.equal(host.offers({ living: { id: members[0].id, res: members[0] } }, () => {}), true);
  assert.deepEqual(st.chose.options.map((o) => o.code), ['KeyJ', 'KeyL', 'KeyP', 'KeyA', 'Escape']);
  // lead on: to the next stop (30), then on to 60
  st.chose.options[1].action();
  assert.ok(st.spawned.every((r) => r.ai.follow && r.ai.follow.feet()[0] === 30), 'on to the next stop');
  for (const r of st.spawned) r.ai.feet = [30, 0, 0];
  host.frame([{ trip, members }], 25);
  assert.ok(st.spawned.every((r) => r.ai.follow.feet()[0] === 60), 'and the one after');
  // join us: along the trail
  host.offers({ living: { id: members[0].id, res: members[0] } }, () => {});
  st.chose.options[0].action();
  assert.ok(st.spawned.every((r) => typeof r.ai.follow.trail === 'function' && r.ai.follow.feet() === st.feet));
  assert.equal(host.offers({ living: { id: members[0].id, res: members[0] } }, () => {}), false, 'joined: no more to ask');
  // the trail: a crumb each DIVER_TRAIL_STEP_M, DIVER_TRAIL_MAX kept
  for (let i = 0; i < 200; i++) { st.feet = [10 + i * DIVER_TRAIL_STEP_M, 0, 5]; host.frame([{ trip, members }], 26); }
  assert.equal(host.trail().length, DIVER_TRAIL_MAX);
  // part ways
  const p = diversOver({ player: [10, 0, 5], route });
  p.host.frame([{ trip: p.trip, members: p.members }], 20);
  await tick();
  p.host.offers({ living: { id: p.members[0].id, res: p.members[0] } }, () => {});
  p.st.chose.options[2].action();
  assert.equal(p.host.offers({ living: { id: p.members[0].id, res: p.members[0] } }, () => {}), false, 'parted: asked no more');
  // the activation's door
  let opened = 0;
  const foe = { living: { id: 'x', res: { name: 'X' } }, shipmate: true, entity: { name: 'X' } };
  assert.equal(activateMobileEnemy(foe, 2, 'talk', {}, { openLiving: () => { opened++; return true; }, hud: () => {}, midScreen: () => {} }), true);
  assert.equal(opened, 1);
  activateMobileEnemy(foe, 2, 'steal', { skills: {} }, { openLiving: () => { opened++; return true; }, hud: () => {}, midScreen: () => {}, modal: () => {} });
  assert.equal(opened, 1, 'never in Steal');
});

test('LW14 hurt and the rival: one under RETREAT_HP falls back RETREAT_BACK_M; the company under half its strength makes for the way out; past DEEP_KEEP_M let go; a find at the stop they make for taken by the player costs each `poached` (EVENTS, once a day), with a word - never a friend\'s (mutants: the retreat, the half, the keep, the rival)', async () => {
  assert.deepEqual([RETREAT_HP, RETREAT_BACK_M], [0.3, 4]);
  assert.equal(EVENTS.poached, -4);
  const route = lineRoute();
  const { host, st, trip, members, rel } = diversOver({ player: [10, 0, 5], route });
  host.frame([{ trip, members }], 20);
  await tick();
  st.spawned.forEach((r, i) => { r.living = { id: members[i].id, res: members[i] }; });
  host.offers({ living: st.spawned[0].living }, () => {});
  st.chose.options[0].action();   // join: each follows
  st.spawned[1].entity.health = 20;
  host.frame([{ trip, members }], 21);
  assert.equal(st.spawned[1].ai.follow.stop, st.spawned[0].ai.follow.stop + 1.2 + RETREAT_BACK_M, 'falls back');
  st.spawned[0].dead = true; st.spawned[1].dead = true;
  host.frame([{ trip, members }], 22);
  assert.equal(host.size, 0);
  assert.match(st.said.at(-1), /have had enough - they make for the way out/);
  // let go past DEEP_KEEP_M (not joined)
  const k = diversOver({ player: [10, 0, 5], route });
  k.host.frame([{ trip: k.trip, members: k.members }], 20);
  k.st.feet = [10, 0, DEEP_KEEP_M + 5];
  k.host.frame([{ trip: k.trip, members: k.members }], 21);
  assert.equal(k.host.size, 0);
  // the rival: the treasure at 30 is the stop they make for from 20
  const r = diversOver({ player: [12, 0, 1], route });
  r.st.piles = { '0:2': { items: [1, 2, 3] } };
  r.host.frame([{ trip: r.trip, members: r.members }], 20);
  await tick();
  r.st.spawned.forEach((x, i) => { x.living = { id: r.members[i].id, res: r.members[i] }; });
  r.st.feet = [30, 0, 1];   // at their next stop's pile, before them
  r.host.frame([{ trip: r.trip, members: r.members }], 20.5);
  r.st.piles['0:2'].items.pop();
  r.host.frame([{ trip: r.trip, members: r.members }], 21);
  assert.deepEqual(r.st.said.slice(-1), [POACHED_LINE('Mem2')], 'the head\'s word');
  assert.ok(r.members.every((m) => r.rel.regard(m.id, 0) === EVENTS.poached));
  r.st.piles['0:2'].items.pop();
  r.host.frame([{ trip: r.trip, members: r.members }], 22);
  assert.ok(r.members.every((m) => r.rel.regard(m.id, 0) === EVENTS.poached), 'once a day');
  const back = createRelations(JSON.parse(JSON.stringify(r.rel.snapshot())));
  back.note(r.members[0].id, 'poached', 0);
  assert.equal(back.regard(r.members[0].id, 0), EVENTS.poached, 'the day kept in the save');
  // taken from afar - not the player's hand at it
  const afar = diversOver({ player: [12, 0, 1], route });
  afar.st.piles = { '0:2': { items: [1, 2, 3] } };
  afar.host.frame([{ trip: afar.trip, members: afar.members }], 20);
  await tick();
  afar.st.spawned.forEach((x, i) => { x.living = { id: afar.members[i].id, res: afar.members[i] }; });
  afar.host.frame([{ trip: afar.trip, members: afar.members }], 20.5);
  afar.st.piles['0:2'].items.pop();
  afar.host.frame([{ trip: afar.trip, members: afar.members }], 21);
  assert.ok(!afar.st.said.some((s) => /ours to find/.test(s)), 'the player nowhere near it');
  // a friend minds nothing
  const f = diversOver({ player: [12, 0, 1], route });
  for (const m of f.members) for (let i = 0; i < 3; i++) f.rel.note(m.id, 'saved', 0);
  f.st.piles = { '0:2': { items: [1, 2] } };
  f.host.frame([{ trip: f.trip, members: f.members }], 20);
  await tick();
  f.st.spawned.forEach((x, i) => { x.living = { id: f.members[i].id, res: f.members[i] }; });
  f.st.feet = [30, 0, 1];
  f.host.frame([{ trip: f.trip, members: f.members }], 20.5);
  f.st.piles['0:2'].items.pop();
  f.host.frame([{ trip: f.trip, members: f.members }], 21);
  assert.ok(!f.st.said.some((s) => /ours to find/.test(s)));
});

test('LW14 the remains at the true stop: the deep\'s fallen laid where the dice\'s end fell on the dive\'s route, else at the resting place their key deals (mutants: the place)', () => {
  const laid = [];
  const host = createDeepRemains({
    spots: () => [[1, 0, 1], [2, 0, 2]], laid: () => false, mark: () => {}, lay: (res, feet) => { laid.push(feet); return {}; }, there: () => true,
    feet: () => null, say: () => {}, townName: () => '', placeOf: (r) => (r.key === 'deep:a' ? [70, 0, 7] : null),
  });
  host.frame([{ key: 'deep:a', res: { name: 'A' } }, { key: 'deep:b', res: { name: 'B' } }]);
  assert.deepEqual(laid[0], [70, 0, 7]);
  assert.ok([[1, 0, 1], [2, 0, 2]].some((s) => s[0] === laid[1][0]));
});

test('LW14 the host\'s seams: the build\'s stops and its cleared set (the outer host\'s word through the modes host), the dead built emptied and the piles empty, the pool\'s stops and floors, the world\'s routes and remains and door, the activation\'s door underground (mutants: each seam)', () => {
  const d = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(d, /const _deepStops = stopsOf\(dungeon\.blocks, RDB_SIDE, dungeon\.startMarker \?\? null\);/);
  assert.match(d, /const _deepCleared = opts\.deepCleared\?\.\(dfLocation, _deepStops, dungeon\.startMarker \?\? null\) \?\? new Set\(\);/);
  assert.match(d, /if \(!f\.entity \|\| f\.src\?\.fixed \|\| !_deepFoeCleared\.has\(`\$\{f\.src\?\.blockIndex\}:\$\{f\.src\?\.loadID\}`\)\) continue;\n\s*f\.entity\.items = \[\];\n\s*setFoeDead\(f, true\);/);   // PIN MOVED (AUDIT LW-II D1/D3): by the placed block, at the build's end
  assert.match(d, /if \(stopKey && _deepCleared\.has\(stopKey\)\) items\.length = 0;/);
  assert.match(d, /deepStops: \(\) => _deepStops,/);
  assert.match(d, /stopPile: \(key\) => lootPiles\.find\(\(p\) => p\.stopKey === key\) \?\? null,/);
  const m = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(m, /deepCleared: \(loc, stops, entry\) => host\.deepCleared\?\.\(loc, stops, entry\) \?\? null,/);
  assert.match(m, /openLiving: \(rec\) => !!host\.openLivingDiver\?\.\(rec\),/);
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const dives = divesIn\(here, tBuild - DIVE_CLEAR_MIN, tBuild, livingTripWorld,/);
  assert.match(w, /return deepClearedOf\(dives\.map\(\(tr\) => deepRouteOf\(stops, from, tr\)\), tBuild\);/);
  assert.match(w, /deepCleared: \(loc, stops, entry\) => livingDeepCleared\(loc, stops, entry\),/);
  assert.match(w, /route: livingDeepRoute,/);
  assert.match(w, /const s = stopOfMinute\(livingDeepRoute\(r\.trip\), r\.t\);\n\s+const at = s \? d\.floorAt\?\.\(s\.x, s\.y, s\.z\) \?\? null : null;/);   // PIN MOVED (AUDIT LW-II D9): kept by the remains' key
  assert.match(w, /openLivingDiver: \(rec\) => \(livingWorldOn\(\) && rec\?\.living \? !!livingDivers\?\.offers\(rec,/);
});

test('AUDIT LW-II LW14: a company\'s strength is who stood (the bodies come one by one, an enemy keeps away) - none had enough before one fell; LEAD ON arrives each at its own stop; on the way out nothing ahead is theirs; another floor heard, never met; let go and met again as left, one drawing on the player never let go; the rival\'s word once a pile; remains with no resting places; the door at the treasure\'s reach, never in Info; the way out on its floors (mutants: D2, D4, D6, D7, D8, D11, D12, D13)', async () => {
  const route = lineRoute();
  // D2: the bodies arrive one by one - nobody hurt, nobody leaves
  const later = [];
  const slow = diversOver({ player: [10, 0, 5], route, extra: { spawn: (type, feet) => new Promise((res) => later.push(() => res({ type, feet, dead: false, ai: { feet: [...feet] }, entity: { health: 100, maxHealth: 100 } }))) } });
  slow.host.frame([{ trip: slow.trip, members: slow.members }], 20);
  later.shift()();
  await tick();
  slow.host.frame([{ trip: slow.trip, members: slow.members }], 21);
  assert.equal(slow.host.size, 1, 'the first in: still a company');
  while (later.length) later.shift()();
  await tick();
  slow.host.frame([{ trip: slow.trip, members: slow.members }], 22);
  assert.deepEqual([slow.host.size, slow.host.companies()[0].size], [1, 3]);
  assert.ok(!slow.st.said.some((x) => /had enough/.test(x)));
  // ...nor while any is still coming: three in of five, two of them down - the two coming yet
  const later5 = [];
  const five = diversOver({ player: [10, 0, 5], route, n: 5, extra: { spawn: (type, feet) => new Promise((res) => later5.push(() => res({ type, feet, dead: false, ai: { feet: [...feet] }, entity: { health: 100, maxHealth: 100 } }))) } });
  five.host.frame([{ trip: five.trip, members: five.members }], 20);
  for (let i = 0; i < 3; i++) later5.shift()();
  await tick();
  const in3 = [...five.host.companies()[0].allies.values()];
  in3[0].dead = true; in3[1].dead = true;
  five.host.frame([{ trip: five.trip, members: five.members }], 21);
  assert.equal(five.host.size, 1, 'two still coming: not yet beaten');
  while (later5.length) later5.shift()();
  await tick();
  five.host.frame([{ trip: five.trip, members: five.members }], 22);
  assert.equal(five.host.size, 1, 'three of five standing');
  // ...an enemy kept away is no strength it lost
  const e = diversOver({ player: [10, 0, 5], route });
  while (e.rel.standing(e.members[2].id, 0) !== 'enemy') e.rel.note(e.members[2].id, 'struck', 0);
  assert.equal(e.rel.standing(e.members[2].id, 0), 'enemy');
  e.host.frame([{ trip: e.trip, members: e.members }], 20);
  await tick();
  e.host.frame([{ trip: e.trip, members: e.members }], 21);
  assert.deepEqual([e.host.size, e.st.spawned.length], [1, 2], 'two stood, none gone');
  // D4: LEAD ON - each at its own follow stop and a step more has arrived; a new walk, a new chance to fall back
  const l = diversOver({ player: [10, 0, 5], route });
  l.host.frame([{ trip: l.trip, members: l.members }], 20);
  await tick();
  l.st.spawned.forEach((r, i) => { r.living = { id: l.members[i].id, res: l.members[i] }; });
  l.st.spawned[2].fellBack = true;
  l.host.offers({ living: l.st.spawned[0].living }, () => {});
  l.st.chose.options[1].action();
  assert.ok(l.st.spawned.every((r) => !r.fellBack), 'lead on: fallen back no longer');
  for (const r of l.st.spawned) r.ai.feet = [30 + r.ai.follow.stop + DIVER_ARRIVE_SLACK_M - 0.6, 0, 0];
  l.host.frame([{ trip: l.trip, members: l.members }], 25);
  assert.ok(l.st.spawned.every((r) => r.ai.follow.feet()[0] === 60), 'arrived, each at its stop: on to the next');
  // D6: on the way out nothing ahead is theirs - a pile they passed is the player's
  const tr = lineRoute();
  tr.legs[0].stop.kind = 'treasure';
  const w = diversOver({ player: [30, 0, 1], route: tr });   // at 250 they walk out past 30
  w.st.piles = { '0:1': { items: [1, 2] } };
  w.host.frame([{ trip: w.trip, members: w.members }], 250);
  await tick();
  assert.equal(w.host.size, 1, 'met on the way out');
  w.st.spawned.forEach((r, i) => { r.living = { id: w.members[i].id, res: w.members[i] }; });
  w.st.feet = [10, 0, 1];   // at the pile of the stop they passed
  w.host.frame([{ trip: w.trip, members: w.members }], 251);
  w.st.piles['0:1'].items.pop();
  w.host.frame([{ trip: w.trip, members: w.members }], 252);
  assert.ok(!w.st.said.some((x) => /ours to find/.test(x)), 'on the way out');
  assert.ok(w.members.every((m) => w.rel.regard(m.id, 0) === 0));
  // D7: another floor - heard, never met
  assert.equal(DEEP_FLOOR_DY, 3);
  const up = diversOver({ player: [10, DEEP_FLOOR_DY + 3, 5], route });
  up.host.frame([{ trip: up.trip, members: up.members }], 20);
  assert.equal(up.host.size, 0, 'a floor above');
  assert.deepEqual(up.st.said, ['You hear fighting ahead.']);
  const same = diversOver({ player: [10, 1, 5], route });
  same.host.frame([{ trip: same.trip, members: same.members }], 20);
  assert.equal(same.host.size, 1);
  // D8: let go and met again as it was left - parted, and hurt
  const k = diversOver({ player: [10, 0, 5], route });
  k.host.frame([{ trip: k.trip, members: k.members }], 20);
  await tick();
  k.st.spawned.forEach((r, i) => { r.living = { id: k.members[i].id, res: k.members[i] }; });
  k.st.spawned[1].entity.health = 40;
  k.host.offers({ living: k.st.spawned[0].living }, () => {});
  k.st.chose.options[2].action();   // part ways
  k.st.feet = [10, 0, DEEP_KEEP_M + 5];
  k.host.frame([{ trip: k.trip, members: k.members }], 21);
  assert.equal(k.host.size, 0, 'let go');
  k.st.feet = [10, 0, 5];
  k.host.frame([{ trip: k.trip, members: k.members }], 22);
  await tick();
  const again = k.st.spawned.slice(3);
  again.forEach((r, i) => { r.living = { id: k.members[i].id, res: k.members[i] }; });
  assert.equal(k.host.offers({ living: again[0].living }, () => {}), false, 'parted still');
  assert.equal(again[1].entity.health, 40, 'hurt still');
  // ...one drawing on the player is never let go behind them
  const h = diversOver({ player: [10, 0, 5], route, extra: { spawnFoe: (type, feet) => Promise.resolve({ type, feet, dead: false, ai: { feet: [...feet] }, entity: {} }) } });
  while (h.rel.standing(h.members[0].id, 0) !== 'hostile') h.rel.note(h.members[0].id, 'struck', 0);
  assert.equal(h.rel.standing(h.members[0].id, 0), 'hostile');
  h.host.frame([{ trip: h.trip, members: h.members }], 20);
  await tick();
  h.st.feet = [10, 0, DEEP_KEEP_M + 50];
  h.host.frame([{ trip: h.trip, members: h.members }], 21);
  assert.equal(h.host.size, 1, 'outrun, it is still after you');
  // D12: the rival's word once a pile (its regard once a day as ever)
  const r = diversOver({ player: [12, 0, 1], route });
  r.st.piles = { '0:2': { items: [1, 2, 3] } };
  r.host.frame([{ trip: r.trip, members: r.members }], 20);
  await tick();
  r.st.spawned.forEach((x, i) => { x.living = { id: r.members[i].id, res: r.members[i] }; });
  r.st.feet = [30, 0, 1];
  r.host.frame([{ trip: r.trip, members: r.members }], 20.5);
  for (let i = 0; i < 3; i++) { r.st.piles['0:2'].items.pop(); r.host.frame([{ trip: r.trip, members: r.members }], 21 + i); }
  assert.equal(r.st.said.filter((x) => /ours to find/.test(x)).length, 1);
  // D13: no resting places - the route's place still lays them; none at all, none laid (never a throw)
  const laid = [];
  const rem = createDeepRemains({ spots: () => [], laid: () => false, mark: () => {}, lay: (res, feet) => { laid.push(feet); return {}; }, there: () => true, feet: () => null, say: () => {}, townName: () => '', placeOf: (x) => (x.key === 'deep:a' ? [70, 0, 7] : null) });
  rem.frame([{ key: 'deep:a', res: { name: 'A' } }, { key: 'deep:b', res: { name: 'B' } }]);
  assert.deepEqual(laid, [[70, 0, 7]]);
  // D11: the door at the treasure's reach, never in Info
  let opened = 0;
  const said = [];
  const foe = { living: { id: 'x', res: { name: 'X' } }, shipmate: true, entity: { name: 'X' } };
  assert.equal(activateMobileEnemy(foe, TREASURE_ACTIVATION_DISTANCE + 1, 'talk', {}, { openLiving: () => { opened++; return true; }, hud: () => {}, midScreen: (x) => said.push(x) }), true);
  assert.deepEqual([opened, said.length], [0, 1], 'too far');
  activateMobileEnemy(foe, 1, 'info', {}, { openLiving: () => { opened++; return true; }, hud: () => {}, midScreen: () => {} });
  assert.equal(opened, 0, 'Info sees him');
  // D7: the way out on its floors
  const stops = [{ key: '0:1', kind: 'treasure', x: 10, y: -8, z: 0, block: 0, loadID: 1 }];
  const ro = routeOf(stops, { x: 0, z: 0 }, { id: 'T', dive: { t0: 0, t1: 600 }, seed: 1 });
  assert.equal(ro.out.path[0].y, -8);
  const mid = (ro.out.t0 + ro.out.t1) / 2;
  assert.equal(pointAt(ro, mid).y, -8, 'floored where it walks');
});

test('AUDIT LW-II LW14: the build\'s clear at its END, every binding a corpse reads stood before it, keyed by the placed block; the piles it passed lie picked over; online none - the room\'s dungeon is the room\'s; the remains\' places kept (mutants: D1, D3, D5, D9, D10)', () => {
  const d = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  const clear = d.indexOf('for (const f of foes) {\n    if (!f.entity || f.src?.fixed || !_deepFoeCleared.has(');
  assert.ok(clear > 0);
  for (const bound of ['const _wallNow = () =>', 'const billboardBatches = [];', 'const flatAnims = new FlatAnimator();', 'let _ctxDead = false;', 'function settleLootFlat(i) {']) {
    assert.ok(d.indexOf(bound) > 0 && d.indexOf(bound) < clear, `${bound} stands before the clear`);
  }
  assert.ok(clear < d.lastIndexOf('  return api;'), 'and the build returns after it');
  assert.match(d, /\.map\(\(s\) => `\$\{s\.block\}:\$\{s\.loadID\}`\)\);/);
  assert.match(d, /for \(const \[i, p\] of lootPiles\.entries\(\)\) if \(p\.stopKey && _deepCleared\.has\(p\.stopKey\) && !p\.items\.length\) settleLootFlat\(i\);/);
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /if \(!livingWorldOn\(\) \|\| params\.has\('online'\) \|\| !stops\?\.length \|\| !loc\?\.mapTableData\) return null;/);
  assert.match(w, /if \(_livingRemainsPlace\.has\(r\.key\)\) return _livingRemainsPlace\.get\(r\.key\);/);
});
