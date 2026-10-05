// LW8b (2026-10-05, bible/06-Systems/Living-World.md "LW8b", Mac: NPCs "have conversations with each other ... much
// like the crew on board ships"): THE ROOM'S TALK - the residents inside a building stand at its tables in twos and
// threes, facing one another, and talk as the street's circles do (their rounds, their share, their beat), in the
// room's own words beside the town's; one in no circle has the street's word for the player passing close; what is said
// goes over their heads on the crew's one layer. The town is the synthetic one (test/lwTown.mjs); the room a mock
// collider (test/lw8_indoors.test.js's).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown, GREET_RANGE, GREET_REST_MIN, GREET_S, LINE_RANGE, DEED_KNOWN_MIN } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { spotCircles, circleLine, ROUND_S, lineMinutes } from '../src/systems/livingWorld/meetups.js';
import {
  ROOM_TALKS, roomKindOf, pickScript, fillLine, TOKEN_FALLBACK, LIVING_GREETINGS,
  TOWN_TALKS, JOB_TALKS, WEATHER_TALKS, EVENING_TALKS, NIGHT_TALKS, ROAD_TALKS, CAMP_TALKS,
} from '../src/systems/livingWorld/lines.js';
import { seededRng } from '../src/systems/wind.js';
import { createLivingIndoors, tablesOf, TABLE_M, TABLE_MAX } from '../src/scenes/livingIndoors.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RATE = CLASSIC_MINUTES_PER_SECOND;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });
const flat = (spots) => spots.map(([x, z]) => [x, 0, z]);
const apart = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

test('LW8b the tables: in the building\'s deal each spot not yet at a table opens one and takes the nearest of the rest within TABLE_M of every one already at it, to TABLE_MAX - every spot at exactly one table (mutants: the reach, the most, every one, the nearest first, the deal, the one table)', () => {
  assert.equal(TABLE_M, 2.2);
  assert.equal(TABLE_MAX, 3);
  const ids = (n) => Array.from({ length: n }, (_, i) => i);
  // a row 1.3 m apart: in twos (the third 2.6 m off the opener), and a far pair
  const row = flat([[0, 0], [1.3, 0], [2.6, 0], [3.9, 0], [5.2, 0], [20, 0], [20, 1.5]]);
  assert.deepEqual(tablesOf(row, ids(7)), [[0, 1], [2, 3], [4], [5, 6]]);
  // a square 1.3 m a side (its diagonal 1.84): three at the most
  const square = flat([[0, 0], [1.3, 0], [0, 1.3], [1.3, 1.3]]);
  assert.deepEqual(tablesOf(square, ids(4)), [[0, 1, 2], [3]]);
  // within reach of the opener but not of one already there: not at it
  const wide = flat([[0, 0], [-2, 0], [2, 0]]);
  assert.deepEqual(tablesOf(wide, ids(3)), [[0, 1], [2]]);
  // the nearest first: the far one of the deal's earlier is out of reach of the nearer
  const near = flat([[0, 0], [-2, 0], [1.3, 0]]);
  assert.deepEqual(tablesOf(near, ids(3)), [[0, 2], [1]]);
  // the deal: its order opens the tables
  assert.deepEqual(tablesOf(row, [6, 5, 4, 3, 2, 1, 0]), [[6, 5], [4, 3], [2, 1], [0]]);
  // every spot at exactly one table, each within TABLE_M of every other at it
  const many = flat(Array.from({ length: 30 }, (_, i) => [((i * 7) % 11) * 1.4, Math.floor(i / 6) * 1.5]));
  const tables = tablesOf(many, ids(30).reverse());
  assert.deepEqual(tables.flat().sort((a, b) => a - b), ids(30), 'every spot once');
  for (const tb of tables) {
    assert.ok(tb.length >= 1 && tb.length <= TABLE_MAX);
    for (const i of tb) for (const j of tb) assert.ok(apart(many[i], many[j]) <= TABLE_M + 1e-9, `${i} and ${j} together`);
  }
});

/** A mock room: a box of `w` by `d` metres about the origin, a flat floor at 0. */
function room({ w = 12, d = 10 } = {}) {
  const collider = {
    move(q, dx, dy, dz) { q[0] = Math.max(-w / 2 + 0.3, Math.min(w / 2 - 0.3, q[0] + dx)); q[2] = Math.max(-d / 2 + 0.3, Math.min(d / 2 - 0.3, q[2] + dz)); q[1] += dy; },
    raycast: () => null,
  };
  return { collider, floorAt: () => 0 };
}

const BASE = PERSON_MOVE_SPEED / (PERSON_MOVE_SPEED / RATE);   // the town's base rate: the clock's minutes a real second
const BEAT = Object.freeze({ roundMin: ROUND_S * BASE, lineMin: lineMinutes(BASE) });
const CTX = (t) => ({ town: 'Synth', region: 'Daggerfall', weather: null, hour: Math.floor(((t % DAY_MIN) + DAY_MIN) % DAY_MIN / 60), news: null, player: 'Mac' });

/** An indoors layer over a mock town (the LivingTown's talk doors), the mock room and mock sprites. `inside`: [{ res, t0, t1 }]. */
function talkRig({ inside = [], clock = 100 * DAY_MIN + 1200, type = BUILDING_TYPES.Tavern, greeting = () => null } = {}) {
  const r = room();
  const synced = [];
  const sprites = {
    sync(list) { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); },
    persons: () => synced.map((x) => ({ person: { living: { id: x.res.id, res: x.res }, pos: x.feet, nameNPC: x.res.name }, pos: x.feet })),
    batches: () => synced.map((x) => x.key),
    clear() { synced.length = 0; },
  };
  const st = { inside, clock, type, greets: [] };
  const town = {
    insideAt: (key) => (key === 7000 ? st.inside.map((x) => ({ res: x.res, e: { kind: 'tavern', t0: x.t0, t1: x.t1 } })) : []),
    dayOf: (t) => Math.floor((t - 240) / DAY_MIN),
    talkBeat: () => BEAT,
    lineCtx: CTX,
    typeOf: (key) => (key === 7000 ? st.type : -1),
    greetingFor: (res, t, stopped) => { st.greets.push([res.id, t, stopped]); return greeting(res); },
    o: { relations: () => createRelations() },
  };
  const layer = createLivingIndoors({
    sprites, building: () => ({ key: 7000, town }), collider: () => r.collider, floorAt: r.floorAt, origin: () => null,
    staticFeet: () => [], clock: () => st.clock, ready: () => true,
  });
  return { layer, synced, st };
}
const RES = (i, job = 'labourer') => ({ id: `L9.${i}`, name: `Res${i} Lane`, job, cls: null });
const ALL_DAY = (res) => ({ res, t0: 0, t1: 1e9 });

test('LW8b standing together: the room fills table by table - the first in stand at one table - and those at a table face its middle, one alone the room (mutants: the fill, the facing, the alone)', () => {
  const rig = talkRig({ inside: [ALL_DAY(RES(1)), ALL_DAY(RES(2))] });
  rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const [a, b] = rig.layer.stood();
  assert.ok(a.table >= 0 && a.table === b.table, 'the first two at one table');
  assert.ok(apart(a.at, b.at) <= TABLE_M, 'near enough to talk');
  const mid = [(a.at[0] + b.at[0]) / 2, (a.at[2] + b.at[2]) / 2];
  for (const x of rig.synced) assert.ok(Math.abs(x.yaw - Math.atan2(mid[0] - x.feet[0], mid[1] - x.feet[2])) < 1e-9, 'facing one another');
  // the room fills a table before the next: as many as its first table holds stand at it
  const spots = rig.layer.spots();
  const full = talkRig({ inside: [1, 2, 3, 4, 5, 6].map((i) => ALL_DAY(RES(i))) });
  full.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const by = new Map();
  for (const s of full.layer.stood()) by.set(s.table, [...(by.get(s.table) ?? []), s]);
  assert.ok([...by.values()].filter((at) => at.length < 2).length <= 1, 'in twos and threes, at most one alone');
  for (const at of by.values()) for (const s of at) for (const o of at) assert.ok(apart(s.at, o.at) <= TABLE_M + 1e-9);
  // one alone faces into the room
  const lone = talkRig({ inside: [ALL_DAY(RES(1))] });
  lone.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const c = spots.reduce((s, p) => [s[0] + p[0], s[1] + p[2]], [0, 0]).map((v) => v / spots.length);
  assert.ok(Math.abs(lone.synced[0].yaw - Math.atan2(c[0] - lone.synced[0].feet[0], c[1] - lone.synced[0].feet[2])) < 1e-9, 'alone: into the room');
});

test('LW8b the room\'s circles and words: two at a table the whole round meet as the street\'s circle on the table\'s own key - on the street\'s share, beat and words, the room\'s own among them (the tavern\'s); one come in mid-round meets none that round; a quiet round nothing; what is heard is within LINE_RANGE (mutants: the circle, the whole round, the key, the room, the beat, the reach)', () => {
  const T0 = 100 * DAY_MIN + 1200;
  const res = [RES(1, 'smith'), RES(2, 'farmer')];
  const rig = talkRig({ inside: res.map(ALL_DAY), clock: T0 });
  rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const [a] = rig.layer.stood();
  const present = rig.layer.stood().map((s) => ({ who: s.res, t0: 0, t1: 1e9 }));
  const key = `in:7000:${a.table}`;
  let said = 0, quiet = 0, roomWords = 0;
  for (let round = 0; round < 80; round++) {
    for (let beat = 0; beat < 3; beat++) {
      const t = T0 + round * BEAT.roundMin + (beat + 0.5) * BEAT.lineMin;
      rig.st.clock = t;
      rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
      const [circle] = spotCircles(key, present, t, BEAT.roundMin);
      assert.ok(circle, 'the table\'s circle');
      const want = circleLine(circle, t, BEAT.lineMin, { ...CTX(t), room: 'tavern' });
      const got = rig.layer.speech([0, 1.6, 0]);
      if (!want) { assert.deepEqual(got, [], 'a quiet round, or the script said'); quiet++; continue; }
      assert.equal(got.length, 1);
      assert.equal(got[0].text, want.text, 'the street\'s words on the table\'s key');
      assert.equal(got[0].person.living.id, want.who.id, 'over its speaker');
      said++;
      const plain = circleLine(circle, t, BEAT.lineMin, { ...CTX(t), room: null });
      if (plain?.text !== want.text) roomWords++;
    }
  }
  assert.ok(said > 40 && quiet > 10, `said ${said}, quiet ${quiet}`);
  assert.ok(roomWords > 10, `the room's own words (${roomWords})`);
  // heard within LINE_RANGE of the eye
  for (let round = 0; ; round++) {
    const t = T0 + round * BEAT.roundMin + 0.5 * BEAT.lineMin;
    rig.st.clock = t;
    rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
    if (!rig.layer.speech([0, 1.6, 0]).length) continue;
    assert.deepEqual(rig.layer.speech([LINE_RANGE + 12, 1.6, 0]), [], 'out of earshot');
    break;
  }
  // one come in mid-round: no circle that round - and the next whole round, one
  const late = talkRig({ inside: [ALL_DAY(res[0]), { res: res[1], t0: T0 + 1, t1: 1e9 }], clock: T0 });
  late.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  for (let beat = 0; beat < 3; beat++) {
    late.st.clock = T0 + (beat + 0.5) * BEAT.lineMin;
    late.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
    assert.deepEqual(late.layer.speech([0, 1.6, 0]), [], 'not there the whole round: no circle');
  }
  // a building of no room's kind: the town's talk alone
  assert.equal(roomKindOf(BUILDING_TYPES.Ship), null);
  const ship = talkRig({ inside: res.map(ALL_DAY), clock: T0, type: BUILDING_TYPES.Ship });
  ship.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  for (let round = 0; round < 40; round++) {
    const t = T0 + round * BEAT.roundMin + 0.5 * BEAT.lineMin;
    ship.st.clock = t;
    ship.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
    const [circle] = spotCircles(key, present, t, BEAT.roundMin);
    const want = circleLine(circle, t, BEAT.lineMin, { ...CTX(t), room: null });
    assert.deepEqual(ship.layer.speech([0, 1.6, 0]).map((l) => l.text), want ? [want.text] : []);
  }
});

test('LW8b the word to the player: one in no circle within GREET_RANGE has the town\'s word (livingTown.js greetingFor) once in GREET_REST_MIN of the clock, standing GREET_S; one in a circle, or further, none (mutants: the circle, the range, the rest, the stand)', () => {
  const T0 = 100 * DAY_MIN + 1200;
  const rig = talkRig({ inside: [ALL_DAY(RES(1))], clock: T0, greeting: (r) => `Hello from ${r.id}.` });
  rig.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const at = rig.layer.stood()[0].at;
  const by = [at[0] + GREET_RANGE - 0.2, 0, at[2]];
  rig.st.greets.length = 0;
  rig.layer.frame(0.016, by, 0, [by[0], 1.6, by[2]]);
  assert.deepEqual(rig.st.greets, [['L9.1', T0, false]], 'asked once, within reach');
  assert.deepEqual(rig.layer.speech(by).map((l) => l.text), ['Hello from L9.1.']);
  rig.layer.frame(GREET_S - 0.1, by, 0, by);
  assert.equal(rig.layer.speech(by).length, 1, 'still standing');
  rig.layer.frame(0.2, by, 0, by);
  assert.equal(rig.layer.speech(by).length, 0, 'gone after GREET_S');
  rig.st.clock = T0 + GREET_REST_MIN - 1;
  rig.layer.frame(0.016, by, 0, by);
  assert.equal(rig.st.greets.length, 1, 'resting');
  rig.st.clock = T0 + GREET_REST_MIN;
  rig.layer.frame(0.016, by, 0, by);
  assert.equal(rig.st.greets.length, 2, 'rested: again');
  // further off: none
  const far = talkRig({ inside: [ALL_DAY(RES(1))], clock: T0, greeting: () => 'Hi.' });
  far.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const fa = far.layer.stood()[0].at;
  far.st.greets.length = 0;
  const off = [fa[0] + GREET_RANGE + 0.2, 0, fa[2]];
  far.layer.frame(0.016, off, 0, off);
  assert.deepEqual(far.st.greets, [], 'out of reach');
  // in a circle: none
  const two = talkRig({ inside: [ALL_DAY(RES(1)), ALL_DAY(RES(2))], clock: T0, greeting: () => 'Hi.' });
  two.layer.frame(0.016, [0, 0, 0], 0, [0, 1.6, 0]);
  const ta = two.layer.stood()[0].at;
  two.st.greets.length = 0;
  two.layer.frame(0.016, ta, 0, ta);
  assert.deepEqual(two.st.greets, [], 'in a circle: their own talk');
});

function makeTown(extra = {}) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: 100 * DAY_MIN + 600 };
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE, ...extra,
  });
  return { town, clock, buildings };
}

test('LW8b the town\'s doors for a room: its talk\'s beat (the street\'s round and line), a building\'s type, what its talk knows at a minute (the hour, the road\'s news and the deeds\' at THAT minute, the name) and the word a resident has for the player - a friend\'s, an enemy\'s, a stranger\'s now and then and always to one stopped, the word said noting them seen (mutants: the beat, the type, the hour, the deeds\' minute, the pools, the stranger, the seen)', () => {
  const rel = createRelations();
  const { town, buildings } = makeTown({ relations: () => rel, townName: 'Synth', regionName: 'Daggerfall', weather: () => 'rain', playerName: () => 'Mac' });
  assert.deepEqual(town.talkBeat(), { roundMin: ROUND_S * BASE, lineMin: lineMinutes(BASE) });
  const tavern = buildings.find((b) => b.type === BUILDING_TYPES.Tavern).key;
  assert.equal(town.typeOf(tavern), BUILDING_TYPES.Tavern);
  assert.equal(town.typeOf(-99), -1);
  const t = 100 * DAY_MIN + 1200 + 37;
  const ctx = town.lineCtx(t);
  assert.equal(ctx.hour, Math.floor((t % DAY_MIN) / 60));
  assert.deepEqual([ctx.town, ctx.region, ctx.weather, ctx.player], ['Synth', 'Daggerfall', 'rain', 'Mac']);
  // a deed known by THIS minute, though the town's own last minute is earlier
  const victim = town.residents.find((r) => r.roll === 'h');
  town._now = t - 500;
  rel.turn('slain', `L${TOWN.mapId}.${victim.slot}@3`, { t: t - DEED_KNOWN_MIN - 10, seen: true, who: victim.name });
  assert.ok(town.lineCtx(t).news?.some((n) => n.kind === 'slain' && n.who === victim.name), 'the deeds at the minute asked');
  assert.ok(!town.lineCtx(t - 30).news?.some((n) => n.kind === 'slain'), 'not yet known at an earlier one');
  // the word for the player
  const [f, e, s] = town.residents.filter((r) => r.roll === 'h' && r.id !== victim.id);
  const day = town.dayOf(t);
  rel.note(f.id, 'saved', day - 5); rel.note(f.id, 'helped', day - 5);
  rel.note(e.id, 'struck', day - 5);
  const fw = town.greetingFor(f, t, false);
  assert.ok(LIVING_GREETINGS.friend.map((x) => fillLine(x, { player: 'Mac' })).includes(fw), 'a friend\'s');
  assert.equal(rel.entries().find((x) => x.id === f.id).seen, day, 'the word said: seen today');
  assert.ok(LIVING_GREETINGS.enemy.map((x) => fillLine(x, { player: 'Mac' })).includes(town.greetingFor(e, t, false)), 'an enemy\'s');
  let spoke = 0, silent = 0;
  for (let m = 0; m < 400; m++) { const w = town.greetingFor(s, t + m * 11, false); if (w == null) silent++; else { spoke++; assert.ok(LIVING_GREETINGS.stranger.map((x) => fillLine(x, { player: 'Mac' })).includes(w)); } }
  assert.ok(spoke > 50 && silent > spoke, `a stranger now and then (${spoke} of 400)`);
  for (let m = 0; m < 40; m++) assert.ok(town.greetingFor(s, t + m * 11, true) != null, 'always to one stopped before them');
});

test('LW8b the room\'s own words: each room\'s scripts two or three lines in the crew\'s shape with tokens the reader fills; a building\'s kind - the tavern, the temple, the guild hall, the palace, a house, a shop, a bank, a library - else none; inside, the room\'s talk two shares of three of the town\'s (the road\'s talk keeps its own); without a room every script the street drew before (mutants: the kinds, the shares, the road, the street)', () => {
  assert.deepEqual(Object.keys(ROOM_TALKS), ['tavern', 'temple', 'shop', 'guild', 'palace', 'home']);
  for (const [kind, scripts] of Object.entries(ROOM_TALKS)) {
    assert.ok(scripts.length >= 5, kind);
    for (const sc of scripts) {
      assert.ok(sc.length >= 2 && sc.length <= 3, `${kind}: ${sc[0]}`);
      for (const line of sc) for (const [, k] of line.matchAll(/\{(\w+)\}/g)) assert.ok(k in TOKEN_FALLBACK, `${kind}: {${k}}`);
    }
  }
  assert.equal(roomKindOf(BUILDING_TYPES.Tavern), 'tavern');
  assert.equal(roomKindOf(BUILDING_TYPES.Temple), 'temple');
  assert.equal(roomKindOf(BUILDING_TYPES.GuildHall), 'guild');
  assert.equal(roomKindOf(BUILDING_TYPES.Palace), 'palace');
  for (const h of ['House1', 'House2', 'House3', 'House4', 'House5', 'House6']) assert.equal(roomKindOf(BUILDING_TYPES[h]), 'home', h);
  for (const k of ['Alchemist', 'Armorer', 'Bank', 'Bookseller', 'ClothingStore', 'FurnitureStore', 'GemStore', 'GeneralStore', 'Library', 'PawnShop', 'WeaponSmith']) assert.equal(roomKindOf(BUILDING_TYPES[k]), 'shop', k);
  for (const k of ['HouseForSale', 'Ship', 'Town4', 'None']) assert.equal(roomKindOf(BUILDING_TYPES[k]), null, k);
  // the shares: two of three
  const inRoom = (kind, o) => { let n = 0; for (let seed = 1; seed <= 3000; seed++) if (ROOM_TALKS[kind].includes(pickScript(seed, o))) n++; return n / 3000; };
  const share = inRoom('tavern', { room: 'tavern' });
  assert.ok(share > 0.6 && share < 0.73, `the tavern's two shares of three (${share.toFixed(3)})`);
  assert.equal(inRoom('tavern', { room: 'tavern', road: 'walk' }), 0, 'the road keeps its own talk');
  assert.equal(inRoom('tavern', { room: 'temple' }), 0, 'each room its own');
  // the street unchanged: every script it drew before
  const before = (seed, { jobs = [], weather = null, hour = 12, road = null } = {}) => {
    const rng = seededRng(seed);
    const pools = road === 'camp' ? [CAMP_TALKS, CAMP_TALKS, CAMP_TALKS] : road === 'walk' ? [ROAD_TALKS, ROAD_TALKS, ROAD_TALKS] : [TOWN_TALKS, TOWN_TALKS];
    for (const j of jobs) { const p = JOB_TALKS[j]; if (p) pools.push(p); }
    const w = weather ? WEATHER_TALKS[weather] : null;
    if (w) pools.push(w);
    if (!road && hour >= 18 && hour < 23) pools.push(EVENING_TALKS);
    if (!road && (hour >= 23 || hour < 5)) pools.push(NIGHT_TALKS, NIGHT_TALKS);
    const pool = pools[Math.floor(rng() * pools.length)];
    return pool[Math.floor(rng() * pool.length)];
  };
  for (const o of [{}, { jobs: ['smith', 'farmer'], weather: 'rain', hour: 20 }, { hour: 2 }, { road: 'walk' }, { road: 'camp', jobs: ['merchant'] }]) {
    for (let seed = 1; seed <= 1500; seed++) assert.equal(pickScript(seed, o), before(seed, o));
  }
});

test('LW8b the streaming host: the building mode\'s HUD pass hands the room\'s talk its matrices (`host.livingSpeech`), and the host lays it on the crew\'s one layer - only once a room was stood, covered under a window, out of a building or paused, each line over its speaker\'s head within the crew\'s range and sight, a known one by name (mutants: the hook, the host\'s door, the cover, the head, the range, the sight)', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /host\.drawPeerNames\?\.\(\{ proj, view, eye: mwv\.eye \}\);   \/\/ ONLINE1: the names over the heads, under the HUD\n      host\.livingSpeech\?\.\(\{ proj, view, eye: mwv\.eye, dt \}\);/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /livingSpeech: \(\{ proj, view, eye, dt \}\) => livingRoomLines\(proj, view, eye, dt\),/);
  const fn = w.slice(w.indexOf('function livingRoomLines('), w.indexOf('/** WILD-ALERT (2026-10-04'));
  assert.match(fn, /if \(!livingIndoors \|\| typeof document === 'undefined'\) return;/);
  assert.match(fn, /const covered = townTalk\.overlayActive \|\| gamePaused\(\) \|\| !!townTalk\.hudHidden \|\| _mode\(\) !== 'interior';/);
  assert.match(fn, /for \(const l of livingIndoors\.speech\(eye\)\)/);
  assert.match(fn, /const over = \[l\.person\.pos\[0\], l\.person\.pos\[1\] \+ LIVING_HEAD_M, l\.person\.pos\[2\]\];/);
  assert.match(fn, /if \(d > CREW_SAY_RANGE\) continue;/);
  assert.match(fn, /if \(crewSight\.blocked\(player\.collider, eye, key, over\)\) continue;/);
  assert.match(fn, /name: livingRelations\.known\(id\) \? firstNameOf\(l\.person\.nameNPC\) : null/);
  assert.match(fn, /drawCrewLines\(points, \{ covered, dt: gamePaused\(\) \? 0 : dt, scale: enhancedHudScale\(\) \}\);/);
});
