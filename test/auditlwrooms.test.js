// AUDIT LW-ROOMS (2026-10-08, bible/01-Overview/Audit-LW-Rooms.md; Mac: "Audit this", of LW-ROOMS): THE ROOM'S MEASURE
// AND ITS COMPANY, AUDITED. Four lenses on the head LW-ROOMS left, the game's own interiors their ground: the room laid out
// anew for a door left open, a reader's quest or the hour; its people stood on a bench's edge; the walk stopped at a lip
// the room's people step over; one stirring drawn back beside strangers by a farthest place round a corner, or into
// another table's company; one alone facing a wall; comings and goings in plain view far off; a word and the talk ray
// through a wall. Each fix's pin here, on the synthetic hall on the port's own collider (test/lwRoom.mjs - an action door
// on the port's own ActionSystem, a lip, a dais, as the game's rooms have them), mock rooms and the hosts' own lines
// lifted and run; each red on the code as it stood (tools/mutants/auditlwrooms.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tavernHall } from './lwRoom.mjs';
import { hallAstir } from '../tools/livingRoomProbe.mjs';
import {
  createLivingIndoors, soundRoom, stirPlace, faceOf, inView, inSight, spreadTables,
  CROWD_M, INDOOR_CLEAR_M, INDOOR_SEEN_M, INDOOR_APART_M, INDOOR_TICK_S, OPEN_M, TABLE_GAP_M,
} from '../src/scenes/livingIndoors.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { GREET_RANGE } from '../src/systems/livingWorld/livingTown.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lift = (src, re, what) => { const m = src.match(re); assert.ok(m, what); return m[1]; };
const apart = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const RES = (i) => ({ id: `L9.${String(i).padStart(2, '0')}`, name: `R${i}`, job: 'labourer', cls: null });
const TWELVE = Array.from({ length: 12 }, (_, i) => RES(i));

/** The indoor layer over the room `h` ({ collider, floorAt, landing }) and a mock town whose `inside` are in the tavern all
 *  day; `extra` more of the layer's deps. */
function hallLayer(h, { inside = [], extra = {}, greeting = () => null } = {}) {
  const st = { inside, clock: 100 * DAY_MIN + 1200, greets: /** @type {string[]} */ ([]) };
  const synced = [];
  const sprites = { sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); }, persons: () => [], batches: () => [], clear() { synced.length = 0; } };
  const town = {
    insideAt: () => st.inside.map((res) => ({ res, e: { kind: 'tavern', t0: 0, t1: 1e12 } })),
    dayOf: (t) => Math.floor((t - 240) / DAY_MIN), talkBeat: () => null, lineCtx: () => ({ weather: null, hour: 20, news: null }), typeOf: () => BUILDING_TYPES.Tavern,
    greetingFor: (res) => { st.greets.push(res.id); return greeting(res); }, o: { relations: () => createRelations() },
  };
  const layer = createLivingIndoors({
    sprites, building: () => ({ key: 7000, town }), collider: () => h.collider, floorAt: h.floorAt, origin: () => h.landing, waysIn: () => [h.landing],
    staticFeet: () => [], clock: () => st.clock, ready: () => true, ...extra,
  });
  return { layer, synced, st };
}
/** A mock room: a box of `w` by `d` metres about the origin, every step slid along its walls; the floor `floor`'s. */
function box({ w = 12, d = 10, floor = () => 0 } = {}) {
  const collider = {
    move(q, dx, dy, dz) { q[0] = Math.max(-w / 2 + 0.3, Math.min(w / 2 - 0.3, q[0] + dx)); q[2] = Math.max(-d / 2 + 0.3, Math.min(d / 2 - 0.3, q[2] + dz)); q[1] += dy; },
    raycast: () => null,
  };
  return { collider, floorAt: (x, y, z) => floor(x, z) };
}

test('AUDIT LW-ROOMS A1/B1 the room measured as its build hung it - every door shut, whichever this visit, a load or a peer left open: the same places, tables and people in the same places; each door as its swing has it after (LW-ROOMS laid the room out anew for a door left open, its every drinker elsewhere - 283 of the game\'s 285 taverns with doors) (mutants: the doors unshut, the base, the swing after, the host)', () => {
  const h = tavernHall({ partition: 3, doorway: [1.0, 2.0], tables: false, stair: false, door: true });
  const key = [...h.actions.objects.keys()][0];
  const across = () => h.collider.raycast([2, 1, 1.5], [1, 0, 0], 3);   // through the doorway
  const room = () => {
    const r = hallLayer(h, { inside: TWELVE, extra: { doorsShut: (fn) => h.actions.withDoorsShut(fn) } });
    r.layer.frame(0.016, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
    return { spots: r.layer.spots(), tables: r.layer.tableOf(), stood: r.layer.stood().map((s) => [s.id, s.at]) };
  };
  assert.ok(Number.isFinite(across()), 'hung shut');
  const shut = room();
  assert.ok(shut.spots.length > 100 && shut.spots.every((p) => p[0] < 3), 'the near side: the door shut');
  h.actions.restoreSaveData([{ key, state: 'end', t: 1 }]);   // left open - the last visit, a load, a peer
  assert.equal(across(), Infinity, 'the doorway open');
  assert.deepEqual(room(), shut, 'the same room, the same people in the same places');
  assert.equal(across(), Infinity, 'and open after it');
  assert.ok(soundRoom(h.landing, h.collider, h.floorAt, [], [h.landing]).some((p) => p[0] > 3.3), 'walked as it is, through the open door');
  assert.ok(Number.isFinite(h.actions.withDoorsShut(across)), 'shut within');
  // the host: the interior's own actions
  const w = rd('src/scenes/world.js');
  const doorsShut = new Function('modes', `return ${lift(w, /\n\s*doorsShut: (\(fn\) => \(modes\?\.interiorCtx\?\.actions\?\.withDoorsShut \? modes\.interiorCtx\.actions\.withDoorsShut\(fn\) : fn\(\)\)),/, 'the host\'s doors shut')}`);
  assert.ok(doorsShut({ interiorCtx: { actions: h.actions } })(across) < 3, 'the host\'s: shut within');
  assert.equal(doorsShut({})(() => 7), 7, 'no room: as it is');
});

test('AUDIT LW-ROOMS B2/B1 the room\'s measure every reader\'s alike: the building\'s own people every one, at their post at the hour or not, and every bed\'s stand kept clear of its places; the reader\'s own quest\'s people in none of it - only never stood on, nor walked to (one reader\'s quest person anywhere on the floor stood all twelve elsewhere; a drinker stood within 0.7 m of a lodger\'s stand in 38 taverns) (mutants: the hour, the quest measured, the quest stood on, the quest walked to, the beds)', () => {
  const h = tavernHall();
  const plain = hallLayer(h, { inside: TWELVE });
  plain.layer.frame(0.016, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
  const quest = plain.layer.stood()[0].at;   // the room's first place to fill
  const far = plain.layer.spots().reduce((a, p) => (apart(p, h.door) > apart(a, h.door) ? p : a));
  for (const q of [quest, far]) {
    const r = hallLayer(h, { inside: TWELVE, extra: { questFeet: () => [q] } });
    r.layer.frame(0.016, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
    assert.deepEqual(r.layer.spots(), plain.layer.spots(), 'the same room');
    if (q === far) assert.deepEqual(r.layer.stood(), plain.layer.stood(), 'the same people in the same places');
    for (let s = 0; s < 600; s += 0.5) {
      r.layer.frame(0.5, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
      for (const x of r.layer.stood()) assert.ok(apart(x.at, q) >= INDOOR_CLEAR_M, `${x.id} never on the quest's person`);
    }
  }
  // the host's static people: every one (test/lwfix6_rooms.test.js lifts the line); a bed's stand on the floor
  const bed = [-4, 0, 2];
  const r = hallLayer(h, { extra: { beds: () => [bed] } });
  r.layer.frame(0.016, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
  const stand = r.layer.beds()[0].feet;
  assert.ok(apart(stand, bed) > 0.5, 'a stand beside it');
  assert.ok(plain.layer.spots().some((p) => apart(p, stand) < INDOOR_CLEAR_M), 'a place there, no bed');
  assert.ok(r.layer.spots().every((p) => apart(p, stand) >= INDOOR_CLEAR_M), 'none at the lodger\'s stand');
});

test('AUDIT LW-ROOMS A3/D5 the walk steps as a body walks - over a lip the room\'s people step over, to the floor beyond (LW-ROOMS\'s walk never stepped up: 314 of 1,494 of the game\'s houses walked to under ten places, 204 now) - and stands nobody where the body stood up on an edge, the floor under its middle beside it (1,938 such places in 1,235 of the game\'s rooms) (mutants: the step up, the edge)', () => {
  const lip = tavernHall({ lip: 3, lipH: 0.35, tables: false, stair: false });
  const over = soundRoom(lip.landing, lip.collider, lip.floorAt, [], [lip.landing]);
  assert.ok(over.filter((p) => p[0] > 3.3).length > 40, `over the lip (${over.filter((p) => p[0] > 3.3).length} beyond)`);
  assert.ok(over.every((p) => p[1] === 0), 'on the floor');
  // every step as the room's people walk theirs: the collider's own step up and its retries off a wedge (the game's houses:
  // a body sliding into a door's jamb stuck there unladdered - 110 more of them walked to ten places and more)
  const flags = [];
  const told = { move(q, dx, dy, dz, height, snap, keepFloor, noStep) { flags.push(!!noStep); q[0] = Math.max(-5.7, Math.min(5.7, q[0] + dx)); q[2] = Math.max(-4.7, Math.min(4.7, q[2] + dz)); q[1] += dy; }, raycast: () => null };
  assert.ok(soundRoom([0, 0, 0], told, () => 0).length > 20 && flags.length > 100 && flags.every((f) => !f), 'never unladdered');
  const edge = tavernHall({ lip: 2.9, lipH: 0.5, tables: false, stair: false });
  const kept = soundRoom(edge.landing, edge.collider, edge.floorAt, [], [edge.landing]);
  assert.ok(kept.length > 150, `the hall walked (${kept.length})`);
  assert.ok(kept.every((p) => p[0] <= 2.56 || p[0] >= 3.54), `no body in the lip (${kept.filter((p) => p[0] > 2.56 && p[0] < 3.54).map((p) => p[0].toFixed(2))})`);
  // a mock's body left up 0.6 m past x 3, the floor under its middle the room's: walked through, never stood at
  const up = { move(q, dx, dy, dz) { q[0] = Math.max(-5.7, Math.min(5.7, q[0] + dx)); q[2] = Math.max(-4.7, Math.min(4.7, q[2] + dz)); q[1] = q[0] > 3 && q[0] < 4.5 ? 0.6 : 0; }, raycast: () => null };
  const through = soundRoom([0, 0, 0], up, () => 0);
  assert.ok(through.every((p) => p[0] <= 3 || p[0] >= 4.5) && through.some((p) => p[0] >= 4.5), 'none up on it, and on past it');
});

test('AUDIT LW-ROOMS A2/D2 one stirring keeps to a place of their own they can walk to - the farthest from everyone they can walk to sets how far is theirs (the farthest of all, round a corner, left them none and the dice picked beside strangers); company only at a table CROWD_M from every other table\'s people; the hall a table\'s own crowd at the most, on the way in and astir, at every size (LW-ROOMS: 13 by 11 stood ten in one; the game\'s taverns 80 of 290 at five or more, 4 now) (mutants: the farthest of all, company\'s crowd, the any)', () => {
  assert.equal(CROWD_M, 2.5);
  // a row of places 1.3 m apart; me at 0, one at 3; the farthest free place (11) round a corner, 10 and 9 walkable
  const row = Array.from({ length: 12 }, (_, i) => [i * 1.3, 0, 0]);
  const room = { spots: row, tableOf: row.map((_, i) => i) };
  const walk = (a, b) => b[0] < 13.5;   // 11 at 14.3 m round a corner
  const near = (i) => Math.abs(row[i][0] - row[0][0]) <= 7;
  const standing = [{ id: 'me', spot: 0, walking: false }, { id: 'a', spot: 3, walking: false }];
  const picks = new Set(Array.from({ length: 24 }, (_, n) => stirPlace(room, standing, 'me', 0, n, (a, b) => walk(a, b))));
  const clear = (i) => Math.abs(row[i][0] - row[3][0]);
  const best = Math.max(...row.map((_, i) => i).filter((i) => i !== 0 && i !== 3 && near(i)).map(clear));
  for (const i of picks) assert.ok(i >= 0 && clear(i) >= Math.min(TABLE_GAP_M, best), `a place of their own (${i}, ${clear(i).toFixed(1)} m clear)`);
  // the farthest unwalkable: its own walkable reach
  const corner = Array.from({ length: 6 }, (_, i) => [i * 1.3, 0, 0]).concat([[0, 0, 6.5]]);
  const r2 = { spots: corner, tableOf: corner.map((_, i) => i) };
  const st2 = [{ id: 'me', spot: 0, walking: false }, { id: 'a', spot: 2, walking: false }];
  const blocked = (a, b) => b !== corner[6];   // the farthest from everyone, round a corner
  for (let n = 0; n < 24; n++) assert.equal(stirPlace(r2, st2, 'me', 0, n, blocked), 5, 'the farthest they can walk to');
  // company: one alone at table 2 (spot 5), its free place 4 within CROWD_M of table 3's (spot 7); one alone at table 9 far off
  const line = Array.from({ length: 14 }, (_, i) => [i * 1.3, 0, 0]);
  const tables = [0, 1, 2, 2, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9];
  const lr = { spots: line, tableOf: tables };
  const crowd = [{ id: 'me', spot: 0, walking: false }, { id: 'b', spot: 5, walking: false }, { id: 'c', spot: 7, walking: false }, { id: 'c2', spot: 6, walking: false }];
  const to = stirPlace(lr, crowd, 'me', 0, 0, () => true);
  assert.ok(to >= 0 && (tables[to] !== 2 || [6, 7].every((k) => apart(line[to], line[k]) >= CROWD_M)), `never into a crowd of two tables (${to})`);
  // the hall at every size
  for (const [w, d] of [[12, 10], [13, 11], [14, 12], [16, 12], [20, 15], [30, 20]]) {
    const r = hallAstir({ w, d });
    assert.ok(r.first.crowd <= 3 && r.most <= 3, `${w}x${d}: a table's own at the most (on the way in ${r.first.crowd}, astir ${r.most})`);
  }
});

test('AUDIT LW-ROOMS A4/B5 one alone faces their table - its middle where it has more places than theirs - else the room\'s most open way there (LW-ROOMS faced every one alone the middle of the whole floor\'s places: the line to it crossed a wall from half of them, 807 of the game\'s taverns\' places nose to a wall) (mutants: the table, the open way, the face unread)', () => {
  const spots = [[0, 0, 0], [1.3, 0, 0], [0, 0, 1.3], [5, 0, 5]];
  assert.deepEqual(faceOf(spots, [0, 1, 2], 0, null), [1.3 / 3, 0, 1.3 / 3], 'their table\'s middle');
  // alone at their table, a wall a metre to the east and the west: along the room
  const walls = { raycast: (o, dir) => (Math.abs(dir[0]) > 0.5 ? 1 : OPEN_M + 1) };
  const f = faceOf(spots, [3], 3, walls);
  assert.ok(Math.abs(f[0] - 5) < 1e-9 && Math.abs(f[2] - 5) > 0.5, `along the room (${f})`);
  // the hall: every place's face clear of a wall within a metre (or its table's middle nearer), and one alone stands so
  const h = tavernHall({ partition: 3, doorway: [1.0, 2.0] });
  const r = hallLayer(h, { inside: [RES(1)] });
  r.layer.frame(0.016, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
  const sp = r.layer.spots(), of = r.layer.tableOf();
  const tableOf = (i) => sp.map((_, k) => k).filter((k) => of[k] === of[i]);
  const face = sp.map((_, i) => faceOf(sp, tableOf(i), i, h.collider));
  for (const [i, p] of sp.entries()) {
    const d = apart(face[i], p);
    const hit = h.collider.raycast([p[0], p[1] + 1.4, p[2]], [(face[i][0] - p[0]) / d, 0, (face[i][2] - p[2]) / d], Math.min(1, d));
    assert.equal(hit, Infinity, `${p.map((v) => v.toFixed(1))}: facing the room, not a wall`);
  }
  let alone = 0;
  for (let s = 0; s < 900; s += 0.5) {
    r.layer.frame(0.5, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
    const x = r.synced[0];
    if (!x || x.moving) continue;
    const i = sp.findIndex((p) => p === x.feet || (p[0] === x.feet[0] && p[2] === x.feet[2]));
    assert.ok(Math.abs(x.yaw - Math.atan2(face[i][0] - x.feet[0], face[i][2] - x.feet[2])) < 1e-9, 'facing their face');
    alone++;
  }
  assert.ok(alone > 100, `stood alone (${alone})`);
});

test('AUDIT LW-ROOMS A5/B8 a coming or a going past INDOOR_SEEN_M waits while the room shows it the player (LW-ROOMS: anything past it went in plain view - 110 places in 49 of the game\'s taverns, far down the room from its way in); hidden by a wall, it goes (mutants: the far view, the view\'s height)', () => {
  assert.equal(INDOOR_SEEN_M, 14);
  const h = tavernHall({ w: 40, d: 8, tables: false, stair: false, partition: 8, doorway: [2.0, 4.0] });
  /** twelve in at once on the way in, then every one's day done, the player at `eye` looking `yaw` */
  const run = (eye, yaw) => {
    const r = hallLayer(h, { inside: TWELVE });
    r.layer.frame(0.016, h.door, 0, [h.door[0], 1.6, h.door[2]]);
    const at = new Map(r.layer.stood().map((s) => [s.id, s.at]));
    r.st.inside = [];
    r.layer.frame(INDOOR_TICK_S, [eye[0], 0, eye[2]], yaw, eye);
    return { at, left: new Set(r.layer.stood().map((s) => s.id)) };
  };
  // from the hall's west end, looking down it: the far in plain view stay
  const eye = [-19, 1.6, 0];
  const a = run(eye, Math.PI / 2);
  const farView = [...a.at].filter(([, p]) => apart(p, eye) > INDOOR_SEEN_M && inView(h.collider, eye, p));
  assert.ok(farView.length > 0, 'some far down the hall in plain view');
  for (const [id, p] of farView) assert.ok(a.left.has(id), `${id} at ${p[0].toFixed(1)}: far, in plain view - stays`);
  // from beyond the wall, looking back: the far it hides go
  const back = [19, 1.6, 0];
  const b2 = run(back, -Math.PI / 2);
  const hidden = [...b2.at].filter(([, p]) => apart(p, back) > INDOOR_SEEN_M && !inView(h.collider, back, p));
  assert.ok(hidden.length > 0, 'some far behind the wall');
  for (const [id, p] of hidden) assert.ok(!b2.left.has(id), `${id} at ${p[0].toFixed(1)}: far, behind the wall - gone`);
  assert.equal(inView(h.collider, eye, [-2, 0, 0]), true, 'the room shows it');
  assert.equal(inView(h.collider, eye, [10, 0, -2]), false, 'the wall hides it');
  assert.equal(inView(null, eye, [10, 0, -2]), true, 'a collider that casts no ray hides nothing');
});

test('AUDIT LW-ROOMS B3/B4 a word only to one the room shows the player, on the player\'s floor - and the talk ray never through the room\'s walls (a word through a wall was said unheard, its rest keeping the drinker quiet when the player came round; the press reached a drinker behind a wall) (mutants: the word\'s view, its floor, the ray\'s wall)', () => {
  const h = tavernHall({ partition: 3, doorway: [6.0, 9.0], tables: false, stair: false });
  const r = hallLayer(h, { inside: TWELVE, greeting: () => 'Hello.' });
  r.layer.frame(0.016, h.door, Math.PI, [h.door[0], 1.6, h.door[2]]);
  const placesOf = new Map(r.layer.stood().map((s) => [s.id, s.at]));
  const wallward = [...placesOf].filter(([, p]) => p[0] > 3.3);
  assert.ok(wallward.length > 0, 'some beyond the wall');
  for (const [id, p] of wallward) {
    const feet = [2.55, 0, p[2]];
    if (apart(feet, p) > GREET_RANGE) continue;
    r.st.greets.length = 0;
    r.layer.frame(0.016, feet, Math.PI / 2, [feet[0], 1.6, feet[2]]);
    assert.ok(!r.st.greets.includes(id), `${id}: no word through the wall`);
  }
  // another floor: a mock room of no rays, one upstairs within reach on the flat
  const two = { move(q, dx, dy, dz) { q[0] = Math.max(-5.7, Math.min(5.7, q[0] + dx)); q[2] = Math.max(-4.7, Math.min(4.7, q[2] + dz)); q[1] += dy; } };
  const up = hallLayer({ collider: two, floorAt: (x, y) => (y >= 2.9 ? 3 : 0), landing: [0, 3, 0] }, { inside: [RES(1)], greeting: () => 'Hello.' });
  up.layer.frame(0.016, [0, 3, 0], Math.PI, [0, 4.6, 0]);
  const p = up.layer.stood()[0].at;
  up.st.greets.length = 0;
  up.layer.frame(0.016, [p[0] + 1, 0, p[2]], 0, [p[0] + 1, 1.6, p[2]]);
  assert.deepEqual(up.st.greets, [], 'none to one on another floor');
  up.layer.frame(0.016, [p[0] + 1, 3, p[2]], 0, [p[0] + 1, 4.6, p[2]]);
  assert.deepEqual(up.st.greets, [RES(1).id], 'on their floor: a word');
  // the talk ray: the room's own wall the nearer
  const w = rd('src/scenes/world.js');
  const act = new Function('livingIndoors', 'townTalk', 'modes', `return ${lift(w, /\n\s*livingPersonsAct: (\(eye, dir, nearer\) => [^\n]*?\)\)),   \/\/ LW8/, 'the host\'s talk ray')}`);
  const said = [];
  const act1 = act({ size: 1, seats: () => [] }, { tryActivate: (e, d, s, nearer) => { said.push(nearer); return true; } }, { interiorCollider: h.collider });
  act1([2, 1.6, -4], [1, 0, 0], Infinity);
  assert.ok(Math.abs(said[0] - 1) < 1e-3, `the wall a metre off (${said[0]})`);
  act1([2, 1.6, -4], [1, 0, 0], 0.4);
  assert.equal(said[1], 0.4, 'a nearer winner keeps it');
});

test('AUDIT LW-ROOMS D6/D7/D11 the walk\'s laws no pin could fail: never past 1.2 m of the floor under the way in, though the way in stands at the door\'s middle; the tables spread by their middles; two places INDOOR_APART_M apart to a centimetre, a wall\'s drawn-in one beside the lattice\'s none; a dais a step up no floor of the room; the reach twenty metres, the floor one to every eight square metres (mutants: the way in\'s floor, the opener, the centimetre, the level, the reach, the floor\'s share)', () => {
  // the ramp, its way in at the landing's height (a metre up)
  const ramp = box({ w: 44, d: 6, floor: (x) => (x > -15 ? 0.1 * (x + 15) : 0) });
  const way = [-21.4, 1.05, 0];
  const climbed = soundRoom(way, ramp.collider, ramp.floorAt, [], [way]);
  assert.ok(climbed.some((p) => p[1] > 1) && climbed.every((p) => p[1] <= 1.2 + 1e-9), 'never past 1.2 m of the floor under the way in');
  // the middles: B's opener 4.5 m from A's, its middle 2.55 m
  const spots = [[0, 0, 0], [2, 0, 0], [4.5, 0, 0], [2.6, 0, 0], [10, 0, 0], [11, 0, 0]];
  assert.deepEqual(spreadTables(spots, [[0, 1], [2, 3], [4, 5]]), [[0, 1], [4, 5], [2, 3]], 'by the middles');
  // a wall drawing the last cell in to 1.22 m of the lattice's: one of the two
  const drawn = box({ w: 2 * (3.9 + 1.22 + 0.3), d: 10 });
  const ds = soundRoom([0, 0, 0], drawn.collider, drawn.floorAt);
  for (const p of ds) for (const q of ds) if (p !== q) assert.ok(apart(p, q) >= INDOOR_APART_M - 0.01, `${p} and ${q} apart`);
  // the sight from the places' own floor - upstairs, over its tables, never through the floor
  const slab = { raycast: (o, dir, max) => (o[1] < 3 ? 0.01 : Infinity) };   // a floor at 3 m: a ray under it meets it at once
  assert.equal(inSight(slab, [0, 3, 0], [2, 3, 0]), true, 'two upstairs see one another');
  assert.equal(inSight(slab, [0, 0, 0], [2, 0, 0]), false, 'from under the floor, none');
  // a dais 0.3 m up: none on it
  const dais = tavernHall({ dais: [-6, -2, 0, 4], tables: false, stair: false });
  const ons = soundRoom(dais.landing, dais.collider, dais.floorAt, [], [dais.landing]);
  assert.ok(ons.length > 150 && ons.every((p) => p[1] === 0), `none on the dais (${ons.filter((p) => p[1] !== 0).length})`);
  // the reach, its own number
  const long = box({ w: 60, d: 8 });
  const end = [-29.4, 0, 0];
  const far = soundRoom(end, long.collider, long.floorAt, [], [end]);
  assert.ok(far.every((p) => apart(p, end) <= 20 + 1e-9) && far.some((p) => apart(p, end) > 19), 'twenty metres');
  // the floor's share: thirty places hold seven
  const sprites = { sync() {}, persons: () => [], batches: () => [], clear() {} };
  const r9 = box({ w: 9, d: 8 });
  const town = { insideAt: () => Array.from({ length: 20 }, (_, i) => ({ res: RES(i), e: { kind: 'tavern' } })), dayOf: (t) => Math.floor((t - 240) / DAY_MIN), o: { relations: () => null } };
  const layer = createLivingIndoors({ sprites, building: () => ({ key: 7000, town }), collider: () => r9.collider, floorAt: r9.floorAt, origin: () => [0, 0, 0], staticFeet: () => [], clock: () => 100 * DAY_MIN + 1200 });
  layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  assert.deepEqual([layer.spots().length, layer.size], [30, 7], 'thirty places, seven');
});
