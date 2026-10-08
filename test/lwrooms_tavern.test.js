// LW-ROOMS (2026-10-08, bible/06-Systems/Living-World.md "LW-ROOMS"; Mac: "With living world integration, NPCs still
// group up in taverns"): THE WHOLE ROOM. A building's room was sounded twelve ways out to 6.6 m from its way in, at the
// way in's own height - the door's middle - so a tavern's twelve stood within a few strides of its door as one crowd, and
// in a house or a shop the sounding passed over a table onto its top; the room filled the deal's tables as they came,
// stood as many as its fan found places whatever its floor, and one who stirred made for any free place, beside a table
// of strangers. And the day put
// people in the tavern for hours they never meant to spend there: a long gap between two stays at one place was waited
// out at it, and a labourer's lunch was laid after the stint at nine, before the one at eleven. Now the room's floor is
// walked from the way in cell by cell (scenes/livingIndoors.js soundRoom), its tables fill apart (spreadTables), it holds
// one to every INDOOR_FLOOR_M2 of floor, one who stirs makes for a place of their own (stirPlace), a long gap at one place
// is spent at home (dayPlan.js schedule) and the lunch comes after the stint at eleven. On mock rooms, the synthetic towns
// (test/lwTown.mjs) and the synthetic hall on the port's own collider (test/lwRoom.mjs; tools/livingRoomProbe.mjs
// measures both).
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from './lwTown.mjs';
import { tavernHall, HALL_TABLES, TABLE_TOP } from './lwRoom.mjs';
import { tavernDay, hallAstir } from '../tools/livingRoomProbe.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { schedule, walkMinutes, DAY_MIN, DAY_START_MIN, HOME_GAP } from '../src/systems/livingWorld/dayPlan.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import {
  createLivingIndoors, soundRoom, spreadTables, stirPlace, tablesOf, inSight, TABLE_SIGHT_M,
  INDOOR_REACH_M, INDOOR_CELLS, ROOM_STEPS, INDOOR_LEVEL_M, INDOOR_HOLD_MIN, INDOOR_APART_M, INDOOR_DOOR_M, INDOOR_MAX, INDOOR_FLOOR_M2, TABLE_GAP_M, INDOOR_WALK_M, TABLE_M,
} from '../src/scenes/livingIndoors.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const SYNTH4 = Object.freeze({ mapId: 24680, blocks: 16, region: 17, people: 3, port: false });
const DAY = 100, D0 = DAY * DAY_MIN + DAY_START_MIN;
const H = (hh) => DAY * DAY_MIN + Math.round(hh * 60);
const hm = (t) => `${Math.floor((t % DAY_MIN) / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const apart = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** A mock room: a box of `w` by `d` metres about the origin, every step slid along its walls; the floor `floor`'s. */
function box({ w = 12, d = 10, floor = () => 0, short = null } = {}) {
  const collider = {
    move(q, dx, dy, dz) {
      const x = Math.max(-w / 2 + 0.3, Math.min(w / 2 - 0.3, q[0] + dx)), z = Math.max(-d / 2 + 0.3, Math.min(d / 2 - 0.3, q[2] + dz));
      const cut = short?.(x, z) ?? 0;   // a step stopped `cut` short of where it was going (a table's edge in its way)
      q[0] = x - Math.sign(dx) * cut; q[2] = z - Math.sign(dz) * cut; q[1] += dy;
    },
    raycast: () => null,
  };
  return { collider, floorAt: (x, y, z) => floor(x, z) };
}

test('LW-ROOMS a long gap between two stays at one place indoors is spent at home, as one between two places is - home and back once it is longer than the walk home and back by HOME_GAP, waited out there when it is not; AUDIT LW-ROOMS: out of doors one stands on there between two, as ever; and the small town\'s tavern sees no stay of four hours by one who neither works nor lodges there (mutants: the same place, the out of doors)', () => {
  const home = { key: 'dh', cell: [0, 0], x: 0.8, z: 0.8, kind: 'door', building: 1 };
  const inn = { key: 'dt', cell: [30, 0], x: 48.8, z: 0.8, kind: 'door', building: 2 };
  const limit = walkMinutes(inn, home, MPM) + walkMinutes(home, inn, MPM) + HOME_GAP;
  const plan = (gap) => schedule([{ kind: 'tavern', at: inn, from: H(13), dur: 60 }, { kind: 'tavern', at: inn, from: H(14) + gap, dur: 120 }],
    { D0, D1: D0 + DAY_MIN, wake: H(6), bed: H(23), home, mpm: MPM, away: [] });
  const stays = (p) => p.filter((e) => e.kind === 'tavern').map((e) => [e.t0, e.t1]);
  const long = plan(limit + 1);
  assert.deepEqual(stays(long), [[H(13), H(14)], [H(14) + limit + 1, H(14) + limit + 121]], 'longer: two stays');
  assert.ok(long.some((e) => e.kind === 'home' && e.at === home && e.t0 >= H(14) && e.t1 <= H(14) + limit + 1), 'and home between');
  assert.deepEqual(stays(plan(limit)), [[H(13), H(14) + limit + 120]], 'no longer: waited out there');
  // AUDIT LW-ROOMS: two at one stall in the square - stood out there between (sent home too, the street's evening stood a
  // quarter thinner and its talk a fifth quieter on the game's own towns)
  const square = { key: 'ms', cell: [30, 0], x: 48.8, z: 0.8, kind: 'market' };
  const outLimit = walkMinutes(square, home, MPM) + walkMinutes(home, square, MPM) + HOME_GAP;
  const out = schedule([{ kind: 'stall', at: square, from: H(13), dur: 60 }, { kind: 'stall', at: square, from: H(14) + outLimit + 1, dur: 120 }],
    { D0, D1: D0 + DAY_MIN, wake: H(6), bed: H(23), home, mpm: MPM, away: [] });
  assert.deepEqual(out.filter((e) => e.kind === 'stall').map((e) => [e.t0, e.t1]), [[H(13), H(14) + outLimit + 121]], 'out of doors: stood out there');
  assert.ok(!out.some((e) => e.kind === 'home' && e.t0 > H(13) && e.t1 < H(14) + outLimit + 1), 'never home between');
  // the town of nine blocks, five days: the first cut's tavern had six stays of four hours and more (a sellsword with no
  // hall of their guild from one o'clock to the evening's drink, a labourer from their lunch to it)
  assert.equal(tavernDay(() => synthTown(), 9).long, 0, 'no afternoon sat out in the tavern');
});

test('LW-ROOMS a labourer\'s and a courier\'s lunch at the tavern comes after the stint at eleven - AUDIT LW-ROOMS: from its end, its half hour from their coming in, one a day; laid after the stint at nine (the first cut), the three in ten who lunch there walked on to the tavern and waited in it for noon - the town of sixteen blocks\' tavern held twenty-three before noon, read every minute; laid at noon, those done early waited in it for noon (mutants: the lunch, from the stint\'s end, one a day)', () => {
  const fx = synthTown({ blocksW: 4, blocksH: 4 });
  const town = new LivingTown(fx.nav, {
    town: SYNTH4, buildings: fx.buildings, doors: fx.doors, makePerson: (archive, guard) => new ResidentWalker(fx.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => H(10), rate: () => RATE, mpm: MPM,
  });
  const taverns = new Set(fx.buildings.filter((b) => b.type === BUILDING_TYPES.Tavern).map((b) => b.key));
  let lunches = 0;
  for (let day = DAY; day < DAY + 5; day++) {
    for (const res of town.peopleOf(day)) {
      if ((res.job !== 'labourer' && res.job !== 'courier') || taverns.has(res.home)) continue;
      const plan = town.planOf(res, day);
      assert.ok(plan.filter((e) => e.kind === 'tavern' && e.t0 < day * DAY_MIN + 17 * 60).length <= 1, `${res.id} day ${day}: one lunch at the most`);
      for (const [i, e] of plan.entries()) {
        if (e.kind !== 'tavern' || e.t0 >= day * DAY_MIN + 13 * 60) continue;
        lunches++;
        const at11 = plan.slice(0, i).some((x) => (x.kind === 'stall' || x.kind === 'work') && x.t1 > day * DAY_MIN + 11 * 60);   // waited for at its place, or begun late
        assert.ok(at11, `${res.id} day ${day}: the stint at eleven before their lunch`);
        assert.ok(e.t0 >= day * DAY_MIN + 11 * 60 + 25, `${res.id} day ${day}: in the tavern from ${hm(e.t0)} - never waiting there since the morning`);
        assert.ok(e.t1 - e.t0 <= 30 + 1e-9, `${res.id} day ${day}: in the tavern ${hm(e.t0)}-${hm(e.t1)} - their half hour, never waiting for noon`);
      }
    }
  }
  assert.ok(lunches >= 20, `lunches enough to read (${lunches})`);
  const { most } = tavernDay(() => synthTown({ blocksW: 4, blocksH: 4 }), 16);
  assert.ok(most['before noon'] <= 9, `the tavern before noon: ${most['before noon']} at the most (the first cut's 23, every one now at their lunch)`);
  // AUDIT LW-ROOMS: the probe's most inside at once is the minute's - read every quarter, it missed those come in at
  // 11:40-11:57 for the noon lunch (four where nine were)
  const pf = synthTown({ blocksW: 4, blocksH: 4 });   // the probe's own town
  const pt = new LivingTown(pf.nav, {
    town: { mapId: 12345, blocks: 16, region: 17, people: 3, port: false }, buildings: pf.buildings, doors: pf.doors,
    makePerson: (archive, guard) => new ResidentWalker(pf.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }), clock: () => 100 * DAY_MIN, rate: () => RATE, mpm: MPM,
  });
  const tavern = pf.buildings.find((b) => b.type === BUILDING_TYPES.Tavern).key;
  let mostSeen = 0;
  for (let day = 100; day < 105; day++) for (let m = 6 * 60; m < 12 * 60; m++) mostSeen = Math.max(mostSeen, pt.insideAt(tavern, day * DAY_MIN + m).length);
  assert.equal(most['before noon'], mostSeen, 'read every minute');
});

test('LW-ROOMS the room\'s floor walked: from the way in cell by cell on a lattice of INDOOR_APART_M - AUDIT LW-ROOMS: the eight ways (ROOM_STEPS), each step slid along what it meets and kept where it came to, in the cell it came to - to INDOOR_REACH_M and INDOOR_CELLS cells, through the collider (never through a wall); the whole of a long hall, every corner of it, to its far wall (the first cut\'s fan reached 6.6 m); walked on the floor under the way in, though the way in stands at the door\'s middle; on the port\'s own collider through a narrow doorway off the lattice\'s lines (LW-ROOMS\'s first walk, the four ways each kept where it reached its own point, stopped at it - of the game\'s 290 taverns 81 walked to under ten places, fifteen to one) (mutants: the eight ways, half of them, the reach, the cells, the floor under the way in, the cell walked already)', () => {
  assert.deepEqual([INDOOR_REACH_M, INDOOR_CELLS, INDOOR_LEVEL_M], [20, 400, 0.15]);
  assert.deepEqual(ROOM_STEPS, [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]]);
  const hall = box({ w: 18, d: 8.6 });
  const way = [-8.4, 1.05, 0];   // the host's landing: the door's middle, a metre up
  const spots = soundRoom(way, hall.collider, hall.floorAt, [], [way]);
  assert.ok(spots.length > 40, `the hall's places (${spots.length})`);
  for (const p of spots) {
    assert.equal(p[1], 0, 'on the floor');
    assert.ok(Math.abs(p[0]) <= 8.7 && Math.abs(p[2]) <= 4, 'inside its walls');
  }
  assert.ok(Math.max(...spots.map((p) => apart(p, way))) > 16, 'to its far wall');
  for (const corner of [[-8.7, 0, -4], [-8.7, 0, 4], [8.7, 0, -4], [8.7, 0, 4]]) assert.ok(spots.some((p) => apart(p, corner) < 0.5), `a place by the corner ${corner}`);
  // the reach: a hall longer than it
  const long = box({ w: 60, d: 8 });
  const end = [-29.4, 0, 0];
  const far = soundRoom(end, long.collider, long.floorAt, [], [end]);
  assert.ok(far.every((p) => apart(p, end) <= INDOOR_REACH_M + 1e-9) && far.some((p) => apart(p, end) > INDOOR_REACH_M - INDOOR_APART_M), 'to the reach and no farther');
  // the cells: an open floor wider than the reach every way, from its middle - every cell walked to but the way in's five
  const open = box({ w: 100, d: 100 });
  assert.equal(soundRoom([0, 0, 0], open.collider, open.floorAt).length, INDOOR_CELLS - 5, 'no more cells than INDOOR_CELLS');
  // a partition across the hall, its one doorway 0.9 m wide and off the lattice's lines: walked through it, to the far
  // side's floor (the four ways alone, slid or kept to their points: none of it)
  const parted = tavernHall({ partition: 3, doorway: [1.0, 1.9], tables: false, stair: false });
  const through = soundRoom(parted.landing, parted.collider, parted.floorAt, [], [parted.landing]);
  const beyond = through.filter((p) => p[0] > 3.3);
  assert.ok(beyond.length > 40, `through the doorway (${beyond.length} of ${through.length} places beyond the wall)`);
  assert.ok(beyond.some((p) => p[2] < -6) && beyond.some((p) => p[2] > 6) && beyond.some((p) => p[0] > 10), 'the far side\'s corners');
  assert.ok(through.every((p) => p[0] < 2.75 || p[0] > 3.55), 'none in the wall');
  assert.ok(through.every((p) => p[1] === 0), 'on the floor');
});

test('LW-ROOMS a step onto a floor within INDOOR_LEVEL_M of the one it left: never up a stair, however its first steps stand within reach of the floor; a ramp walked, never past 1.2 m of the way in\'s floor; AUDIT LW-ROOMS: a step stopped short is kept where it came to, in its own cell, but one stopped back in a cell walked already is none - every step past a table\'s edge falls short to one place (mutants: the level, the 1.2, the cell walked already)', () => {
  const stair = box({ floor: (x, z) => (z > 2 ? 0.25 * Math.ceil((z - 2) / 0.3) : 0) });
  const up = soundRoom([0, 0, 0], stair.collider, stair.floorAt);
  assert.ok(up.length > 20 && up.every((p) => p[1] === 0 && p[2] <= 2), 'off the stair');
  const ramp = box({ w: 44, d: 6, floor: (x) => (x > -15 ? 0.1 * (x + 15) : 0) });
  const way = [-21.4, 0, 0];
  const climbed = soundRoom(way, ramp.collider, ramp.floorAt, [], [way]);
  assert.ok(climbed.some((p) => p[1] > 1), 'up the ramp');
  assert.ok(climbed.every((p) => p[1] <= 1.2 + 1e-9), 'never past 1.2 m');
  // every step past x 3 stopped 0.4 m short (a table's edge in its way): the first in a cell of its own, kept and drawn
  // in beside the place before it (INDOOR_APART_M apart, never both); each next back in that cell, none
  const blocked = box({ short: (x) => (x > 3 ? 0.4 : 0) });
  const kept = soundRoom([0, 0, 0], blocked.collider, blocked.floorAt);
  assert.ok(kept.length > 20 && kept.every((p) => p[0] <= 3), `no place past the edge (${kept.filter((p) => p[0] > 3).map((p) => p[0].toFixed(2))})`);
});

test('LW-ROOMS two places stand INDOOR_APART_M apart, to a centimetre: the lattice\'s own two each a place, though its sums round them nearer; one a wall drew in beside another, one of the two (AUDIT LW-ROOMS: PIN MOVED - whichever the walk came to first: the eight ways come to some first) (mutants: the centimetre, the apart)', () => {
  const r = box({ w: 12, d: 10 });
  const all = soundRoom([0, 0, 0], r.collider, r.floorAt);
  assert.equal(all.length, 9 * 7 - 5, 'every cell of the lattice a place but the way in\'s five');
  const drawn = box({ w: 10.6, d: 10 });   // its walls 0.2 m short of the lattice's sixth cell either way: walked to, drawn in
  const spots = soundRoom([0, 0, 0], drawn.collider, drawn.floorAt);
  for (const p of spots) for (const q of spots) if (p !== q) assert.ok(apart(p, q) >= INDOOR_APART_M - 0.01, `${p} and ${q} apart`);
  assert.ok(spots.some((p) => Math.abs(Math.abs(p[0]) - 5) < 1e-9) && spots.some((p) => Math.abs(Math.abs(p[0]) - 3.9) < 1e-9), 'drawn in by the wall, or the lattice\'s own');
});

test('LW-ROOMS the room fills its tables apart: in the building\'s deal, each next the first whose middle stands TABLE_GAP_M from every one before it, then the rest in the deal\'s order; twelve come in stand at four tables, each TABLE_GAP_M from every other; a table\'s people see one another - TABLE_SIGHT_M over the floor, over a table, never through a wall - so no table stands either side of a partition (mutants: the gap, the rest, the spread unread, the sight, its height, the sight unread)', () => {
  assert.deepEqual([TABLE_GAP_M, TABLE_SIGHT_M], [4, 1.4]);
  const row = Array.from({ length: 10 }, (_, i) => [i, 0, 0]);
  assert.deepEqual(spreadTables(row, [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]]), [[0, 1], [4, 5], [8, 9], [2, 3], [6, 7]]);
  assert.deepEqual(spreadTables(row, [[2, 3], [0, 1], [8, 9], [6, 7], [4, 5]]), [[2, 3], [8, 9], [0, 1], [6, 7], [4, 5]], 'the deal\'s own order');
  assert.deepEqual(spreadTables(row, []), []);
  // in a hall: twelve come in at once - AUDIT LW-ROOMS: in the deals of a dozen buildings (one building's deal laid its
  // first four tables apart by itself, the spread unread)
  const hall = box({ w: 24, d: 18 });
  const way = [0, 0, -8.4];
  const sprites = { sync() {}, persons: () => [], batches: () => [], clear() {} };
  const people = Array.from({ length: 12 }, (_, i) => ({ id: `L9.${i}`, name: `R${i}`, job: 'labourer', cls: null }));
  const town = { insideAt: () => people.map((res) => ({ res, e: { kind: 'tavern' } })), dayOf: (t) => Math.floor((t - 240) / DAY_MIN), o: { relations: () => null } };
  for (let key = 7000; key < 7012; key++) {
    const layer = createLivingIndoors({ sprites, building: () => ({ key, town }), collider: () => hall.collider, floorAt: hall.floorAt, origin: () => way, staticFeet: () => [], clock: () => H(20) });
    layer.frame(0.016, way, Math.PI, [0, 1.6, -8.4]);
    const tables = new Map();
    for (const s of layer.stood()) tables.set(s.table, [...(tables.get(s.table) ?? []), s.at]);
    assert.equal(tables.size, 4, `${key}: four tables of three`);
    const mids = [...tables.values()].map((at) => [at.reduce((a, p) => a + p[0], 0) / at.length, 0, at.reduce((a, p) => a + p[2], 0) / at.length]);
    for (const a of mids) for (const b of mids) if (a !== b) assert.ok(apart(a, b) >= TABLE_GAP_M, `${key}: tables at ${a} and ${b} apart`);
  }
  // the sight, on the port's own collider: over a table, never through a wall (AUDIT LW-ROOMS: PIN MOVED - the hall's
  // partition has a narrow doorway mid-way: the eight ways walk its far side from it, a table's reach across the wall)
  const h = tavernHall({ partition: 3, doorway: [1.0, 1.9] });
  assert.equal(inSight(h.collider, [-3, 0, -2.4], [-3, 0, 0.4]), true, 'over a table (the one at -3, -1)');
  assert.equal(inSight(h.collider, [2.4, 0, -4], [4, 0, -4]), false, 'never through the partition');
  assert.equal(inSight({ move() {} }, [0, 0, 0], [3, 0, 0]), true, 'a collider that casts no ray hides nothing');
  assert.equal(inSight(box({}).collider, [0, 0, 0], [3, 0, 0]), true, 'nor one whose ray meets nothing');
  assert.equal(tablesOf([[0, 0, 0], [1.3, 0, 0]], [0, 1], () => false).length, 2, 'out of sight: two tables');
  // a partitioned hall: its places either side of the wall a table's reach apart, out of sight of one another, and every
  // two at a table in sight
  const sprites2 = { sync() {}, persons: () => [], batches: () => [], clear() {} };
  const town2 = { insideAt: () => [], dayOf: (t) => Math.floor((t - 240) / DAY_MIN), o: { relations: () => null } };
  for (let key = 7000; key < 7006; key++) {   // AUDIT LW-ROOMS: the deals of six buildings (one's laid no table across the wall unseen)
    const parted = createLivingIndoors({ sprites: sprites2, building: () => ({ key, town: town2 }), collider: () => h.collider, floorAt: h.floorAt, origin: () => h.landing, waysIn: () => [h.landing], staticFeet: () => [], clock: () => H(20) });
    parted.frame(0.016, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
    const sp = parted.spots(), of = parted.tableOf();
    const west = (p) => p[0] < 3;
    const across = sp.filter((p) => west(p) && sp.some((q) => !west(q) && apart(p, q) <= TABLE_M && !inSight(h.collider, p, q)));
    assert.ok(across.length >= 5, `places a table's reach apart either side of it (${across.length})`);
    const tables2 = new Map();
    sp.forEach((p, i) => tables2.set(of[i], [...(tables2.get(of[i]) ?? []), i]));
    assert.ok(tables2.size > 40, `the hall's tables (${tables2.size})`);
    for (const at of tables2.values()) for (const i of at) for (const j of at) if (i < j) assert.ok(inSight(h.collider, sp[i], sp[j]), `${key}: two at a table out of sight (${sp[i].map((v) => v.toFixed(1))} | ${sp[j].map((v) => v.toFixed(1))})`);
  }
});

test('LW-ROOMS a room holds what its floor does: one to every INDOOR_FLOOR_M2 of its places (a lattice cell each), INDOOR_MAX in all - AUDIT LW-ROOMS: and a household, INDOOR_HOLD_MIN, at the least (a house of nine places held two of its family of three); one up in their room by their bed is on none of the floor (mutants: the hold, the cap, the lodger, the least, its number)', () => {
  assert.deepEqual([INDOOR_FLOOR_M2, INDOOR_HOLD_MIN], [8, 3]);
  const rig = ({ w, d, inside, lodgers = [], beds = [] }) => {
    const r = box({ w, d });
    const sprites = { sync() {}, persons: () => [], batches: () => [], clear() {} };
    const town = {
      insideAt: () => inside.map(([res, kind]) => ({ res, e: { kind } })), lodgersAt: () => lodgers,
      dayOf: (t) => Math.floor((t - 240) / DAY_MIN), o: { relations: () => null },
    };
    const layer = createLivingIndoors({ sprites, building: () => ({ key: 7000, town }), collider: () => r.collider, floorAt: r.floorAt, origin: () => [0, 0, 0], staticFeet: () => [], clock: () => H(20), beds: () => beds });
    layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
    return layer;
  };
  const R = (i) => [{ id: `L9.${String(i).padStart(2, '0')}`, name: `R${i}`, job: 'labourer', cls: null }, 'tavern'];
  // a small room: twelve places, so three (AUDIT LW-ROOMS: PIN MOVED - the eight ways walk two its walls drew in)
  const small = rig({ w: 6, d: 5, inside: Array.from({ length: 10 }, (_, i) => R(i)) });
  assert.equal(small.spots().length, 12);
  assert.equal(small.size, Math.ceil((12 * INDOOR_APART_M ** 2) / INDOOR_FLOOR_M2));
  assert.equal(small.size, 3);
  // AUDIT LW-ROOMS: a closet of six places, its floor's two: a household's three
  const closet = rig({ w: 5, d: 4, inside: Array.from({ length: 10 }, (_, i) => R(i)) });
  assert.equal(closet.spots().length, 6);
  assert.equal(Math.ceil((6 * INDOOR_APART_M ** 2) / INDOOR_FLOOR_M2), 2);
  assert.equal(closet.size, INDOOR_HOLD_MIN, 'a household at the least');
  // a great hall: INDOOR_MAX
  assert.equal(rig({ w: 24, d: 18, inside: Array.from({ length: 20 }, (_, i) => R(i)) }).size, INDOOR_MAX);
  // a lodger up by their bed: the floor's three and they
  const lodger = { id: 'L9.00', name: 'Up', job: 'visitor', cls: null };
  const up = rig({ w: 6, d: 5, inside: [[lodger, 'home'], R(1), R(2), R(3), R(4)], lodgers: [lodger], beds: [[2, 0, 1.5]] });
  const stood = up.stood();
  assert.equal(stood.length, 4, 'three on the floor and one by their bed');
  assert.equal(stood.find((s) => s.id === lodger.id)?.bed, 0);
  assert.equal(stood.filter((s) => s.bed < 0).length, 3);
});

test('LW-ROOMS one stirring with no company to go to makes for a place of their own: TABLE_GAP_M from everyone else\'s (where they stand, or make for), their dice\'s pick of them; where none in reach is, the farthest from everyone any is; one up by their bed stands in none of the room (mutants: the own, the farthest, the lodger)', () => {
  // a row of places, 1.2 m apart, two to a table
  const spots = Array.from({ length: 12 }, (_, i) => [i * 1.2, 0, 0]);
  const room = { spots, tableOf: spots.map((_, i) => i >> 1) };
  const S = (id, spot, walking = false) => ({ id, spot, walking });
  const over = (standing, from) => Array.from({ length: 24 }, (_, n) => stirPlace(room, standing, 'me', from, n, () => true));
  // me at 6 (7.2 m); two at the far table (10, 11): the places in reach TABLE_GAP_M from them are 1-5, and the dice range
  // over them
  const own = over([S('me', 6), S('a', 10), S('b', 11)], 6);
  assert.ok(own.every((i) => i >= 1 && i <= 5), `places of their own (${own})`);
  assert.ok(new Set(own).size >= 3, 'the dice\'s');
  // me at 0; two at 4 and 5 (4.8 m, 6 m): none in reach is 4 m from them - the farthest is
  assert.deepEqual([...new Set(over([S('me', 0), S('a', 4), S('b', 5)], 0))], [1], 'the farthest from everyone');
  // AUDIT LW-ROOMS: two as far from everyone as the farthest, under TABLE_GAP_M of them - the dice's pick of the two
  const tie = { spots: [[3, 0, -3.9], [0, 0, 0], [6, 0, 0], [3, 0, 1.3], [3, 0, -1.3]], tableOf: [0, 1, 2, 3, 4] };
  const tiePicks = new Set(Array.from({ length: 24 }, (_, n) => stirPlace(tie, [S('me', 0), S('a', 1), S('b', 2)], 'me', 0, n, () => true)));
  assert.deepEqual([...tiePicks].sort(), [3, 4], 'either of the two');
  // one up in their room (no place of this room): stands in none of it
  assert.deepEqual(over([S('me', 0), S('a', 4), S('b', 5), S('up', -1)], 0), over([S('me', 0), S('a', 4), S('b', 5)], 0), 'one up by their bed counts nowhere');
  assert.ok(INDOOR_WALK_M < 7.2 + 1e-9, 'the far end out of reach of the near');
});

test('LW-ROOMS the synthetic hall on the port\'s own collider (test/lwRoom.mjs; tools/livingRoomProbe.mjs): its places the whole of it - the farthest far beyond the first cut\'s 6.6 m - each on the floor, none on a table\'s top, in a table, on the counter or on the stair; twelve inside stand at tables apart, the biggest crowd a table\'s own on the way in and through ten minutes of the room astir (the first cut\'s: all twelve one crowd, the way in 4.6 m off) (mutants: the floor under the way in, the walls, the level)', () => {
  const h = tavernHall();
  const spots = soundRoom(h.landing, h.collider, h.floorAt, [], [h.landing]);
  assert.ok(spots.length > 150, `the hall's places (${spots.length})`);
  assert.ok(Math.max(...spots.map((p) => apart(p, h.door))) > 15, 'its far end');
  for (const p of spots) {
    assert.ok(Math.abs(p[1]) < 1e-6, `${p}: on the floor, under the table tops at ${TABLE_TOP}`);
    for (const [fx, fz] of HALL_TABLES) assert.ok(Math.abs(p[0] - fx) > 0.7 || Math.abs(p[2] - fz) > 0.5, `${p}: not in a table`);
    assert.ok(apart(p, h.door) >= INDOOR_DOOR_M, 'clear of the way in');
  }
  const r = hallAstir({ w: 24, d: 18 });
  assert.equal(r.first.stood, 12);
  assert.ok(r.first.crowd <= 3 && r.most <= 3, `a table's own at the most (on the way in ${r.first.crowd}, astir ${r.most})`);
  assert.ok(r.door > 8, `about the hall, not at its door (${r.door.toFixed(1)} m)`);
});
