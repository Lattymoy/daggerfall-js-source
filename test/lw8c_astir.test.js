// LW8c (2026-10-05, bible/06-Systems/Living-World.md "LW8c", Mac: NPCs "perform activities"): THE ROOM ASTIR - one in
// no talking circle now and then gets up and crosses the room, to company where one stands alone, along a line the
// room's collider lets them walk, at a stroll, facing the way they go; a talking circle stays put; a wall, nobody
// through it. On mock rooms and a mock town's doors (test/lw8b_talk.test.js's shape).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivingIndoors, stirPlace, INDOOR_STIR_S, INDOOR_WALK_M, INDOOR_WALK_SPEED, TABLE_M } from '../src/scenes/livingIndoors.js';
import { ROUND_S, lineMinutes, spotCircles } from '../src/systems/livingWorld/meetups.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';

const BASE = 2;   // the town's clock minutes a real second (mock)
const BEAT = Object.freeze({ roundMin: ROUND_S * BASE, lineMin: lineMinutes(BASE) });

/** A mock room: a box `w` by `d` about the origin; `wall` an x no walk crosses (a partition with the way in on its side). */
function room({ w = 14, d = 10, wall = null, st = {} } = {}) {
  const collider = {
    move(q, dx, dy, dz) {
      if (st.block) return;   // the room shut: nobody walks
      let x = Math.max(-w / 2 + 0.3, Math.min(w / 2 - 0.3, q[0] + dx));
      if (wall != null && (q[0] < wall) !== (x < wall)) x = q[0] < wall ? wall - 0.3 : wall + 0.3;   // the partition
      q[0] = x; q[2] = Math.max(-d / 2 + 0.3, Math.min(d / 2 - 0.3, q[2] + dz)); q[1] += dy;
    },
    raycast: () => null,
  };
  return { collider, floorAt: () => 0 };
}

/** The layer over a mock town (no circles unless `stays`), the room and mock sprites. */
function rig({ inside = [], stays = false, wall = null, clock = 100 * DAY_MIN + 1200 } = {}) {
  const st = { inside, clock, block: false };
  const r = room({ wall, st });
  const synced = [];
  const sprites = {
    sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); },
    persons: () => synced.map((x) => ({ person: { living: { id: x.res.id, res: x.res }, pos: x.feet }, pos: x.feet })),
    batches: () => [], clear() { synced.length = 0; },
  };
  const town = {
    insideAt: () => st.inside.map((res) => ({ res, e: stays ? { kind: 'tavern', t0: 0, t1: 1e12 } : { kind: 'tavern' } })),
    dayOf: (t) => Math.floor((t - 240) / DAY_MIN), talkBeat: () => BEAT,
    lineCtx: () => ({ weather: null, hour: 20, news: null }), typeOf: () => BUILDING_TYPES.Tavern, greetingFor: () => null,
    o: { relations: () => createRelations() },
  };
  const layer = createLivingIndoors({
    sprites, building: () => ({ key: 7000, town }), collider: () => r.collider, floorAt: r.floorAt, origin: () => null,
    staticFeet: () => [], clock: () => st.clock, ready: () => true,
  });
  return { layer, synced, st };
}
const RES = (i) => ({ id: `L9.${i}`, name: `Res${i} Lane`, job: 'labourer', cls: null });
const run = (r, seconds, dt = 0.5) => { for (let t = 0; t < seconds; t += dt) r.layer.frame(dt, [0, 0, -4.6], 0, [0, 1.6, -4.6]); };

test('LW8c the room astir: one in no circle stays put a while (INDOOR_STIR_S, their own), then crosses to a free place within INDOOR_WALK_M at INDOOR_WALK_SPEED, facing the way they go - the place theirs from the moment they set out - and stands there, at no table on the way (mutants: the wait, the reach, the pace, the facing, the claim, the arrival)', () => {
  assert.deepEqual([...INDOOR_STIR_S], [30, 90]);
  assert.equal(INDOOR_WALK_M, 7);
  assert.equal(INDOOR_WALK_SPEED, 1.2);
  const r = rig({ inside: [RES(1)] });
  r.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  const home = r.layer.stood()[0].at;
  run(r, INDOOR_STIR_S[0] - 1);
  assert.equal(r.layer.stood()[0].walking, false, 'not before their wait');
  let steps = 0;
  while (!r.layer.stood()[0].walking && steps++ < 400) run(r, 0.5);
  assert.ok(r.layer.stood()[0].walking, 'up within INDOOR_STIR_S');
  assert.ok(steps * 0.5 + INDOOR_STIR_S[0] - 1 <= INDOOR_STIR_S[1] + 1);
  const to = r.layer.stood()[0].at;
  assert.notDeepEqual(to, home);
  assert.ok(Math.hypot(to[0] - home[0], to[2] - home[2]) <= INDOOR_WALK_M + 1e-9, 'within reach');
  // on the way: along the line at the stroll's pace, facing the way they go, moving
  const a = r.synced[0].feet;
  run(r, 1, 1);
  const b = r.synced[0].feet;
  const dist = Math.hypot(to[0] - home[0], to[2] - home[2]);
  if (dist > INDOOR_WALK_SPEED * 1.5) {
    assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[2] - a[2]) - INDOOR_WALK_SPEED) < 1e-6, 'a stroll');
    assert.ok(r.synced[0].moving, 'walking');
    assert.ok(Math.abs(r.synced[0].yaw - Math.atan2(to[0] - home[0], to[2] - home[2])) < 1e-9, 'facing the way');
  }
  // arrived: standing at the place, not moving
  run(r, dist / INDOOR_WALK_SPEED + 1, 0.25);
  assert.equal(r.layer.stood()[0].walking, false);
  assert.deepEqual(r.synced[0].feet, to);
  assert.equal(r.synced[0].moving, false);
  // the place theirs from the moment they set out: a newcomer never takes it
  const two = rig({ inside: [RES(1)] });
  two.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  steps = 0;
  while (!two.layer.stood()[0].walking && steps++ < 400) run(two, 0.5);
  const claimed = two.layer.stood()[0].at;
  two.st.inside = [RES(1), RES(2), RES(3), RES(4), RES(5), RES(6), RES(7), RES(8)];
  two.layer.frame(1, [0, 0, -4.6], Math.PI, [0, 1.6, -4.6]);
  const others = two.layer.stood().filter((s) => s.id !== 'L9.1');
  assert.ok(others.length > 0 && !others.some((s) => s.at === claimed), 'their place, while they walk to it');
});

test('LW8c company and the room\'s walls: one alone makes for a table where one stands alone; a talking circle stays put; no walk crosses what the room\'s collider will not let them, and with nowhere to go they stay (mutants: the company, the talking, the walls, the none)', () => {
  // company: whoever stirs first, alone at their table, makes for the one alone at another
  const r = rig({ inside: [RES(1), RES(2), RES(3), RES(4), RES(5)] });
  r.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  const before = r.layer.stood();
  const count = (list, table) => list.filter((s) => s.table === table && !s.walking).length;
  let mover = null, steps = 0, snapshot = before;
  while (!mover && steps++ < 800) { snapshot = r.layer.stood(); run(r, 0.25, 0.25); mover = r.layer.stood().find((s) => s.walking) ?? null; }
  assert.ok(mover, 'one stirs');
  const was = snapshot.find((s) => s.id === mover.id);
  const lone = [...new Set(snapshot.map((s) => s.table))].filter((tb) => tb !== was.table && count(snapshot.filter((s) => s.id !== mover.id), tb) === 1);
  const near = lone.some((tb) => r.layer.spots().some((p, i) => i >= 0 && Math.hypot(p[0] - was.at[0], p[2] - was.at[2]) <= INDOOR_WALK_M));
  if (lone.length && near) assert.ok(lone.includes(mover.table), `to the company of one alone (table ${mover.table}, lone ${lone})`);
  // a talking circle stays put
  const talk = rig({ inside: [RES(1), RES(2)], stays: true });
  talk.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  const [x, y] = talk.layer.stood();
  assert.equal(x.table, y.table);
  const present = [x, y].map((s) => ({ who: s.res, t0: 0, t1: 1e12 }));
  let t0 = talk.st.clock;
  while (!spotCircles(`in:7000:${x.table}`, present, t0, BEAT.roundMin)[0]?.talks) t0 += BEAT.roundMin;
  talk.st.clock = t0;   // a round they talk
  for (let s = 0; s < INDOOR_STIR_S[1] + 5; s += 0.5) talk.layer.frame(0.5, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  assert.ok(talk.layer.stood().every((s) => !s.walking), 'talking: they stay');
  // walls: a partition at x = 0 - every walk keeps to its own side
  const walled = rig({ inside: [RES(1), RES(2), RES(3)], wall: 0 });
  walled.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  const side = new Map(walled.layer.stood().map((s) => [s.id, Math.sign(s.at[0])]));
  for (let s = 0; s < 400; s += 0.5) {
    walled.layer.frame(0.5, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
    for (const s2 of walled.layer.stood()) assert.equal(Math.sign(s2.at[0]), side.get(s2.id), `${s2.id} never through the wall`);
  }
  // nowhere to go (every line shut): they stay, and try again later
  const shut = rig({ inside: [RES(1)] });
  shut.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  const own = shut.layer.stood()[0].at;
  assert.ok(shut.layer.spots().some((p) => p !== own && Math.hypot(p[0] - own[0], p[2] - own[2]) <= INDOOR_WALK_M), 'places within reach');
  shut.st.block = true;
  for (let s = 0; s < INDOOR_STIR_S[1] * 2; s += 0.5) shut.layer.frame(0.5, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  assert.equal(shut.layer.stood()[0].walking, false, 'nowhere to go: they stay');
  assert.equal(shut.layer.stood()[0].at, own);
  shut.st.block = false;
  let k = 0;
  while (!shut.layer.stood()[0].walking && k++ < 400) shut.layer.frame(0.5, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  assert.ok(shut.layer.stood()[0].walking, 'the way open again: up');
  assert.ok(TABLE_M > 0);
});

test('LW8c their own: each waits their own while (spread over INDOOR_STIR_S, never one beat for the room); every walk within INDOOR_WALK_M; a stir that found nowhere waits its while again before the next (mutants: the own wait, the reach, the retry)', () => {
  const r = rig({ inside: [1, 2, 3, 4, 5, 6].map(RES) });
  r.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  const first = new Map();
  const walks = [];
  let prev = new Map(r.layer.stood().map((x) => [x.id, x]));
  for (let t = 0.5; t <= 600; t += 0.5) {
    r.layer.frame(0.5, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
    for (const x of r.layer.stood()) {
      const was = prev.get(x.id);
      if (x.walking && was && !was.walking) { if (!first.has(x.id)) first.set(x.id, t); walks.push([was.at, x.at]); }
    }
    prev = new Map(r.layer.stood().map((x) => [x.id, x]));
  }
  const times = [...first.values()];
  assert.ok(times.length >= 4, `most stir (${times.length})`);
  assert.ok(times.every((t) => t >= INDOOR_STIR_S[0] - 0.5 && t <= INDOOR_STIR_S[1] + 0.5), `within their wait (${times})`);
  assert.ok(Math.max(...times) - Math.min(...times) > 10, `their own, spread (${times})`);
  assert.ok(walks.length > 8, `walks (${walks.length})`);
  for (const [a, b] of walks) assert.ok(Math.hypot(b[0] - a[0], b[2] - a[2]) <= INDOOR_WALK_M + 1e-9, 'within reach');
  // the retry: a stir that found nowhere waits again - the way opening, nobody is up that same beat
  const shut = rig({ inside: [RES(1)] });
  shut.layer.frame(0.016, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  shut.st.block = true;
  for (let t = 0; t < INDOOR_STIR_S[1] + 1; t += 0.5) shut.layer.frame(0.5, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  shut.st.block = false;
  shut.layer.frame(0.5, [0, 0, -4.6], 0, [0, 1.6, -4.6]);
  assert.equal(shut.layer.stood()[0].walking, false, 'not before their next while');
});

test('LW8c where they make for (stirPlace): a table where one stands alone, the nearest free place at it - never a table of two, never one walking, never their own; else a free place their own dice pick within INDOOR_WALK_M; never along a line the room will not let them walk; nowhere, -1 (mutants: the company, the one alone, the walking, their own table, the nearest, the reach, the dice, the line, the none)', () => {
  // two rows of places: tables T0 {0,1,2}, T1 {3,4,5}, T2 {6} (7.2 m: beyond reach), T3 {7,8,9}, T4 {10}
  const spots = [[0, 0, 0], [1.2, 0, 0], [2.4, 0, 0], [3.6, 0, 0], [4.8, 0, 0], [6, 0, 0], [7.2, 0, 0], [0, 0, 2.4], [1.2, 0, 2.4], [2.4, 0, 2.4], [3.6, 0, 2.4]];
  const tableOf = [0, 0, 0, 1, 1, 1, 2, 3, 3, 3, 4];
  const room = { spots, tableOf };
  const ok = () => true;
  const S = (id, spot, walking = false) => ({ id, spot, walking });
  const over = (standing, walkable = ok) => Array.from({ length: 24 }, (_, n) => stirPlace(room, standing, 'me', 0, n, walkable));
  // me at 0; two at T3 (7, 8 - its free 9 the nearer), one alone at T1 (3): the nearest free place at T1, whatever the dice
  const company = [S('me', 0), S('a', 7), S('b', 8), S('c', 3)];
  assert.deepEqual([...new Set(over(company))], [4], 'to the one alone - the nearest free place at their table');
  // the one alone walking: no company - the dice, over the free places within reach
  const walking = over([S('me', 0), S('a', 7), S('b', 8), S('c', 3, true)]);
  assert.ok(new Set(walking).size >= 3, 'the dice spread');
  for (const i of walking) assert.ok(i >= 0 && spots[i][0] <= INDOOR_WALK_M && ![0, 7, 8, 3].includes(i), 'a free place within reach');
  // their own table: one alone at mine is no company to go to - the dice still free to land there
  const mine = over([S('me', 0), S('d', 1)]);
  assert.ok(new Set(mine).size > 1, 'not drawn to my own table');
  // beyond reach: one alone at T2 (7.2 m) - no company; never past INDOOR_WALK_M
  for (const i of over([S('me', 0), S('e', 6)])) assert.ok(spots[i][0] <= INDOOR_WALK_M && i !== 6);
  // the line: the company's nearer place shut - its next; all shut, nowhere
  assert.deepEqual([...new Set(over(company, (a, b) => b !== spots[4]))], [5], 'along a line they may walk');
  for (const i of over([S('me', 0)], (a, b) => b[0] < 2)) assert.ok(spots[i][0] < 2, 'only where the line lets them');
  assert.equal(stirPlace(room, company, 'me', 0, 1, () => false), -1, 'nowhere');
});
