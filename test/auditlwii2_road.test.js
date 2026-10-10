// AUDIT LW-II-2 (2026-10-10, the second audit of THE LIVING WORLD II, lane R - the road: LW9, LW10, LW13): every pin red
// on the code as it stood (its mutants, tools/mutants/auditlwii2_road.json), on the synthetic map (test/lwRoads.mjs - the
// census's rosters, townTrips, livingMap's lives and trouble as the host composes them). No game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livingMap } from './lwRoads.mjs';
import {
  townTrips, partyAt, membersAt, handsOn, awayOf, whenWalked, ownTrip, setsOut, memoTrip, leaderOf, wildTrip, innAhead, innGuestsOf,
  divesIn, patrolCover, walkedMinutes, CALENDAR_MPM, INN_TYPE, HALT_CATCH_UP, NATIVE_PIXEL, NATIVE_PER_M, WILD_TRIES, PATROL_COVER_DAYS,
  ROAD_TRIP_CHANCE, WALK_TO_H,
} from '../src/systems/livingWorld/trips.js';
import { CAMP_SHARE } from '../src/systems/livingWorld/trouble.js';
import { createLivingRoads, campGroups, passingPairs, walkingAt, PASS_N } from '../src/scenes/livingRoads.js';
import { createRoadTeams, WAGONS_DRAWN } from '../src/world/roadTeams.js';
import { trainOf, teamOf, WAGON_TAIL_N, CAMP_PARK_N } from '../src/systems/livingWorld/wagons.js';
import { companiesOf, namedIn, headOf, holyDayOf } from '../src/systems/livingWorld/companies.js';
import { stopsOf, routeOf, clearedOf } from '../src/systems/livingWorld/deepRoute.js';
import { travellerRoster, townCensus, moreCounts, HUNTER_CLASSES, RETAINER_CLASSES } from '../src/systems/livingWorld/census.js';
import { fillLine, COMPANY_GREETINGS, ROAD_GREETINGS } from '../src/systems/livingWorld/lines.js';
import { lineMinutes } from '../src/systems/livingWorld/meetups.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { lwRng, textSeed } from '../src/systems/livingWorld/seed.js';
import { DAY_MIN, DAY_START_MIN, dayPlan, PILGRIM_TEMPLE_H } from '../src/systems/livingWorld/dayPlan.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { getHolidayId, holidayRegion } from '../src/systems/holidays.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { synthTown } from './lwTown.mjs';
import { townPlaces } from '../src/systems/livingWorld/places.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });
const onRoad = (at) => at.phase === 'out' || at.phase === 'back';

/**
 * The roads' layer read once at minute `t` about the player's place `here` (native): what it hands its sprites (each body
 * and fire by key, its feet) and its teams (each horse and wagon).
 * @param {any} world @param {number} t @param {{ x: number, z: number }} here @param {{ relations?: any }} [o]
 */
function layOut(world, t, here, { relations = createRelations() } = {}) {
  const lists = [], synced = [];
  const sprites = { sync: (list) => lists.push(list.map((m) => ({ ...m }))), batches: () => [], persons: () => [], bodyOf: () => null, clear: () => {} };
  const teams = { sync: (hs, ws) => synced.push({ hs, ws }), batches: () => [], draw: () => 0, clear: () => {}, hitchN: () => undefined };
  const roads = createLivingRoads({ world, mpm: CALENDAR_MPM, clock: () => t, baseRate: () => RATE, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40], here: () => here, sprites: /** @type {any} */ (sprites), relations: () => relations, memo: new Map(), teams: /** @type {any} */ (teams) });
  roads.frame(1 / 30, [here.x / 40, 1.6, here.z / 40]);
  const list = lists[lists.length - 1], team = synced[synced.length - 1];
  return { roads, list, horses: team.hs, wagons: team.ws, feet: new Map(list.map((m) => [m.key, m.feet])) };
}

/** The night's camps (the parties camped on the road, none lodged) of every town at minute `t`, each party once. */
function campedAt(map, t, o) {
  const camped = [];
  for (const town of map.towns) {
    for (const tr of townTrips(town, t, map.world, o) ?? []) {
      const at = partyAt(tr, t);
      if (onRoad(at) && at.camp && !at.inn && !camped.some((c) => c.trip.id === tr.id)) camped.push({ trip: tr, at, members: membersAt(tr, t) });
    }
  }
  return camped;
}

test('AUDIT LW-II-2 R1: a party with nobody standing lays nothing - a caravan its hands struck down to the last (handsOn) draws no body, no horse, no wagon and no fire on the march or at its camp, and keeps no camp: the party camped beside it keeps a camp and a fire of its own (mutants: R1 the laying, R1 the camp)', () => {
  const map = livingMap();
  const o = O();
  // a shared camp of a night, a merchant's caravan its first (the earlier trip id) and another party round its fire
  let found = null;
  for (let day = 300; day < 360 && !found; day++) {
    const t = day * DAY_MIN + 23 * 60;
    const camped = campedAt(map, t, o).filter((c) => !c.at.halt);
    const g = campGroups(camped);
    for (const c of camped) {
      const cg = g.get(c.trip.id);
      if (c.trip.kind !== 'merchant' || !cg.first || cg.n === c.members.length) continue;
      // struck down on its walk that day
      let struck = null;
      for (let h = 8; h < 19 && struck == null; h++) { const m = day * DAY_MIN + h * 60; const at = partyAt(c.trip, m); if (onRoad(at) && !at.camp && !at.halt) struck = m; }
      if (struck == null) continue;
      const other = camped.find((q) => q !== c && g.get(q.trip.id).x === cg.x && g.get(q.trip.id).z === cg.z);
      found = { t, dead: c, other, struck, camped };
      break;
    }
  }
  assert.ok(found, 'a caravan first at a shared camp, walking that day');
  const { dead, other, struck } = found;
  const id = dead.trip.id;
  // the host's own composition: the trip's fate, then its hand deaths (world.js fate -> handsOn)
  const world = { ...map.world, fate: (tr) => { const f = map.world.fate(tr); return tr.id === id ? handsOn(f, () => struck) : f; } };
  const mine = (key) => key.startsWith(`${id}:`);
  for (const [t, what] of [[struck + 45, 'on the march'], [found.t, 'at its camp']]) {
    const at = partyAt(dead.trip, t);
    const here = { x: at.x, z: at.z };
    const alive = layOut(map.world, t, here);   // the road as it was: its people, its team (and at camp its fire) laid
    assert.ok(alive.horses.some((h) => mine(h.key)) && alive.wagons.some((w) => mine(w.key)), `${what}: its team laid while it stands`);
    assert.ok(dead.trip.party.some((m) => alive.feet.has(m.id)), `${what}: its people laid while they stand`);
    const gone = layOut(world, t, here);
    const trip = gone.roads.parties().find((p) => p.trip.id === id)?.trip;
    assert.ok(trip && membersAt(trip, t).length === 0, `${what}: nobody of it standing (its hands' deaths)`);
    assert.ok(!dead.trip.party.some((m) => gone.feet.has(m.id)), `${what}: no body`);
    assert.ok(!gone.horses.some((h) => mine(h.key)), `${what}: no horse`);
    assert.ok(!gone.wagons.some((w) => mine(w.key)), `${what}: no wagon`);
    assert.ok(!gone.feet.has(`fire:${id}`), `${what}: no fire of its`);
  }
  // the party beside it: a camp of its own now - its fire where its own camp's first stands, its people about it
  const without = campGroups(found.camped.filter((c) => c !== dead));
  const og = without.get(other.trip.id);
  const first = found.camped.find((c) => c !== dead && without.get(c.trip.id).first && without.get(c.trip.id).x === og.x && without.get(c.trip.id).z === og.z);
  const night = layOut(world, found.t, { x: other.at.x, z: other.at.z });
  const fire = night.feet.get(`fire:${first.trip.id}`);
  assert.ok(fire && Math.abs(fire[0] - og.x / 40) < 1e-9 && Math.abs(fire[2] - og.z / 40) < 1e-9, 'its camp\'s fire, at its camp');
  assert.ok(Math.abs(og.x - dead.at.x) + Math.abs(og.z - dead.at.z) > 1, 'never the dead caravan\'s place');
});

test('AUDIT LW-II-2 R4: a party beset at its camp by night keeps its camp - its team parked through the fight, its people in their places in the camp\'s ring through the halt, every other party of a shared camp in its own; a shared camp\'s fire burns on while a party of it is not halted, a lone camp\'s is out for its halt (mutants: R4 the park, R4 the park\'s camp, R4 the halt\'s camp, R4 the halt\'s ring, R4 the lit)', () => {
  const map = livingMap();
  const o = O();
  // the camp troubles of the nights - a team's party halted at a camp shared (its first, and not its first) and a lone one
  const cases = [];
  const all = () => cases.some((c) => c.shared && c.first) && cases.some((c) => c.shared && !c.first) && cases.some((c) => !c.shared);
  for (let day = 300; day < 370 && !all(); day++) {
    const camped = campedAt(map, day * DAY_MIN + 23 * 60 + 2, o);
    const g = campGroups(camped);
    for (const c of camped) {
      const cg = g.get(c.trip.id);
      if (!c.at.halt || !c.trip.enc?.camp || !(teamOf(c.trip).wagons + teamOf(c.trip).packs)) continue;
      const shared = cg.n > c.members.length;
      if (cases.some((x) => x.shared === shared && (!shared || x.first === cg.first))) continue;
      cases.push({ trip: c.trip, shared, first: cg.first, g: cg });
    }
  }
  assert.ok(all(), 'camp troubles at a shared camp (its first and not) and at a lone one');
  for (const { trip, shared, g } of cases) {
    const h = trip.halt;
    const here = { x: g.x, z: g.z };
    const times = { before: h.t0 - 5, fight: (h.t0 + h.fightEnd) / 2, halt: (h.fightEnd + h.t1) / 2, after: h.t1 + 3 };
    const read = Object.fromEntries(Object.entries(times).map(([k, t]) => [k, layOut(map.world, t, here)]));
    assert.ok(partyAt(trip, times.fight).fight && partyAt(trip, times.halt).halt && !partyAt(trip, times.halt).fight, `${trip.id}: the fight, then the halt`);
    // its team: parked where it stood camped, through the fight and the halt
    const team = (r) => [...r.horses, ...r.wagons].filter((x) => x.key.startsWith(`${trip.id}:`)).map((x) => `${x.key}@${x.feet.map((v) => v.toFixed(6)).join(',')}`).sort();
    assert.ok(team(read.before).length > 0, `${trip.id}: its team parked at its camp`);
    for (const k of ['fight', 'halt', 'after']) assert.deepEqual(team(read[k]), team(read.before), `${trip.id} (${shared ? 'shared' : 'lone'}): its team where it was parked, at the ${k}`);
    assert.ok([...read.fight.horses, ...read.fight.wagons].filter((x) => x.key.startsWith(`${trip.id}:`)).every((x) => !x.moving), 'standing');
    // its people: where they stood camped, at the halt and after it (at the fight, at the fight)
    for (const m of trip.party) {
      const was = read.before.feet.get(m.id);
      assert.ok(was, `${m.id} camped`);
      for (const k of ['halt', 'after']) assert.deepEqual(read[k].feet.get(m.id), was, `${trip.id}: ${m.id} in its place in the camp's ring at the ${k}`);
    }
    // every other party camped with it: nobody moved
    for (const [key, feet] of read.before.feet) {
      if (/^fire:/.test(key) || trip.party.some((m) => m.id === key)) continue;
      for (const k of ['fight', 'halt']) if (read[k].feet.has(key)) assert.deepEqual(read[k].feet.get(key), feet, `${key} unmoved at the ${k}`);
    }
    // the fire: a shared camp's burns on (another party of it not halted); a lone camp's is out for the halt
    const fireAt = (r) => [...r.feet].filter(([key, f]) => /^fire:/.test(key) && Math.abs(f[0] - g.x / 40) < 1e-9 && Math.abs(f[2] - g.z / 40) < 1e-9).length;
    assert.equal(fireAt(read.before), 1, `${trip.id}: its camp's fire before`);
    assert.equal(fireAt(read.after), 1, `${trip.id}: and after`);
    for (const k of ['fight', 'halt']) assert.equal(fireAt(read[k]), shared ? 1 : 0, `${trip.id} (${shared ? 'shared' : 'lone'}): the fire at the ${k}`);
  }
});

test('AUDIT LW-II-2 R2: two parties passing say their exchange ONCE, in order, the warned party first - its warning the beat they came near (the first beat begun with them near), the other\'s reply the next, then nothing while they walk on near; every reader hears the same line at the same minute, however late it came; a party with nobody standing passes nobody (mutants: R2 the once, R2 the beat they met, R2 the silence after, R2 the warned first, R2 nobody standing)', () => {
  const map = livingMap();
  const o = O();
  const lineMin = lineMinutes(RATE);
  // a real crossing on the synthetic map: a warned party - the later trip id - walking within PASS_N of another
  let found = null;
  for (let day = 300; day < 304 && !found; day++) {
    for (let m = 7 * 60; m < 19 * 60 && !found; m += 2) {
      const t = day * DAY_MIN + m;
      const walking = [];
      for (const town of map.towns) for (const tr of townTrips(town, t, map.world, o) ?? []) { const at = walkingAt(tr, t); if (at && !walking.some((w) => w.trip.id === tr.id)) walking.push({ trip: tr, at }); }
      const pair = passingPairs(walking, t).find((p) => p.warned && p.warned.trip.id > (p.warned === p.a ? p.b : p.a).trip.id);
      if (pair) found = { pair, t };
    }
  }
  assert.ok(found, 'a warned party passing another, the warned the later trip id');
  const { pair } = found;
  assert.equal(pair.warned, pair.a, 'the warned party first');
  const near = (t) => { const a = walkingAt(pair.a.trip, t), b = walkingAt(pair.b.trip, t); return !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) <= PASS_N; };
  // when they came near (to an eighth of a beat), the first beat begun with them near, and how long they walk near
  const step = lineMin / 8;
  let tc = found.t;
  while (near(tc - step)) tc -= step;
  let B0 = Math.ceil((tc - step) / lineMin);
  while (!near(B0 * lineMin)) B0++;
  let last = B0;
  while (last < B0 + 40 && near((last + 1) * lineMin)) last++;
  assert.ok(last >= B0 + 3, `near for a while (${last - B0} beats)`);
  const foe = pair.warned.trip.enc.bandName ?? 'foes';
  const lines = pair.script.map((l) => fillLine(l, { foe }));
  const here = (() => { const a = partyAt(pair.a.trip, found.t); return { x: a.x, z: a.z }; })();
  /** A reader of the road's words, its parties read at minute `t0` (both on the road; no word to the player: no frame time). */
  const reader = (world, t0) => {
    let clock = t0;
    const eye = [0, 1.6, 0];
    const sprites = { sync: () => {}, batches: () => [], persons: () => [], bodyOf: (id) => ({ person: { id, pos: eye } }), clear: () => {} };
    const roads = createLivingRoads({ world, mpm: CALENDAR_MPM, clock: () => clock, baseRate: () => RATE, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40], here: () => here, sprites: /** @type {any} */ (sprites), relations: () => createRelations(), memo: new Map() });
    roads.frame(0, eye);
    return (t) => { clock = t; return roads.speech(eye, 30).filter((s) => lines.includes(s.text)).map((s) => ({ text: s.text, who: s.person.id })); };
  };
  const FR = [0.04, 0.2, 0.35, 0.5, 0.65, 0.8, 0.96];
  const heard = [];
  const hear = reader(map.world, found.t);
  for (let j = B0 - 3; j <= last + 3; j++) for (const f of FR) for (const s of hear((j + f) * lineMin)) heard.push({ j, f, ...s });
  const firstOf = (side, t) => membersAt(side.trip, t)[0].id;
  const expect = [
    ...FR.map((f) => ({ j: B0, f, text: lines[0], who: firstOf(pair.a, (B0 + f) * lineMin) })),
    ...FR.map((f) => ({ j: B0 + 1, f, text: lines[1], who: firstOf(pair.b, (B0 + 1 + f) * lineMin) })),
  ];
  assert.deepEqual(heard, expect, 'the warning the beat they came near (the warned party\'s), the reply the next, and never again');
  // a reader come late hears the line of the minute - the reply - and nothing after it
  const late = reader(map.world, (B0 + 1.3) * lineMin);
  assert.deepEqual(late((B0 + 1.5) * lineMin), [{ text: lines[1], who: firstOf(pair.b, (B0 + 1.5) * lineMin) }], 'a late reader: the same line');
  assert.deepEqual(late((B0 + 2.5) * lineMin), [], 'and the same silence');
  // the warned party struck down to the last before they met (its hands' deaths): the other passes nobody
  const struck = tc - 1;
  const world = { ...map.world, fate: (tr) => { const f = map.world.fate(tr); return tr.id === pair.a.trip.id ? handsOn(f, () => struck) : f; } };
  const none = reader(world, found.t);
  for (let j = B0 - 3; j <= last + 3; j++) for (const f of FR) assert.deepEqual(none((j + f) * lineMin), [], `nobody standing, no passing (beat ${j - B0})`);
});

/** The synthetic map with a roadside tavern (INN_TYPE) two pixels east of every town - inns on the ways between them. */
function innMap() {
  const map = livingMap();
  let id = 7000;
  for (const t of [...map.towns]) {
    const inn = { mapId: id++, px: t.px + 2, py: t.py, blocks: 1, type: INN_TYPE, region: 17, people: 3, name: `Inn${id}`, port: false };
    map.towns.push(inn);
    map.byId.set(inn.mapId, inn);
  }
  return map;
}

/** THE INN MAP READ ONCE for the pins on it: every party of its towns over days 300 to 330, each once. */
let innRead = null;
function innTrips() {
  if (innRead) return innRead;
  const map = innMap();
  const o = O();
  const trips = new Map();
  for (let day = 300; day < 330; day++) {
    for (const town of map.towns) {
      if (town.type === INN_TYPE) continue;
      for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o) ?? []) if (!trips.has(tr.id) && !tr.sea) trips.set(tr.id, tr);
    }
  }
  innRead = { map, o, trips: [...trips.values()] };
  return innRead;
}

test('AUDIT LW-II-2 R3: a trouble met while a party still lodges at its inn of a morning falls as it sets out again, at the inn\'s place - no step back into its halt, never lodged again after it, and the inn\'s guest out as it sets out, after its last lodged minute (mutants: R3 the move, R3 the minute, R3 the place)', () => {
  const { map, o, trips } = innTrips();
  let lodged = 0, checked = 0;
  for (const tr of trips) {
    if (!tr.halt || !tr.way.inns) continue;
    checked++;
    const h = tr.halt, dir = h.leg === 'out' ? 1 : -1;
    const before = partyAt(tr, h.t0 - 1), at = partyAt(tr, h.t0);
    assert.ok(dir * (at.s - before.s) >= -1e-6, `${tr.id}: no step back into its halt (${((at.s - before.s) / NATIVE_PER_M).toFixed(1)} m)`);
    if (!before.inn) continue;
    lodged++;
    for (let m = h.t0; m < h.t1 + 240; m++) assert.equal(partyAt(tr, m).inn, undefined, `${tr.id}: never back in the inn (${m - h.t0} min on)`);
    const inn = map.towns.find((t) => t.mapId === before.inn.mapId);
    const g = (innGuestsOf(inn, Math.floor((h.t0 - DAY_START_MIN) / DAY_MIN), map.world, o) ?? []).find((x) => x.trip.id === tr.id);
    assert.ok(g, `${tr.id}: the inn's guest`);
    assert.equal(g.outT, h.t0, 'out as it sets out, into its halt');
    for (let m = g.outT; m < g.outT + 300; m++) assert.notEqual(partyAt(tr, m).inn?.mapId, inn.mapId, `${tr.id}: gone from its inn ${m - g.outT} min after its going`);
  }
  assert.ok(checked > 100 && lodged > 0, `troubles on ways with an inn (${checked}), of them met as a party set out from its inn (${lodged})`);
});

test('AUDIT LW-II-2 R5: a traveller\'s town has them gone the minute the road has them - a party setting out before first light at the light (AUDIT LW-II E5: at home on the road till then), one by day as it sets out, a passage on its tide (mutants: R5 the light, R5 the tide)', () => {
  const map = livingMap({ dives: true, sea: true });
  const o = O();
  const seen = new Set();
  let early = 0, tide = 0;
  for (let day = 300; day < 330; day++) {
    for (const town of map.towns) {
      for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o) ?? []) {
        if (seen.has(tr.id)) continue;
        seen.add(tr.id);
        const before = whenWalked(tr.outT0, 0) > tr.outT0;
        for (const m of tr.party) {
          const w = awayOf(m, [tr])[0];
          if (tr.sea) { assert.equal(w.t0, tr.outT0, `${tr.id}: a passage leaves on its tide`); if (before) tide++; continue; }
          assert.equal(partyAt(tr, w.t0).phase, 'out', `${tr.id}: on the road the minute its town has ${m.id} gone`);
          assert.equal(partyAt(tr, w.t0 - 0.01).phase, 'home', `${tr.id}: at home till then`);
          if (before) early++;
        }
      }
    }
  }
  assert.ok(early > 0 && tide > 0, `travellers setting out before first light (${early}), passages on a tide before it (${tide})`);
});

test('AUDIT LW-II-2 R6: a hunter a halt left owing ground at the wild\'s edge walks on to its point at the catch-up pace (a half again its own) and only there camps - one place a minute, ever on along its way; none jumps to its camp, held where it fell or behind its walk (mutants: R6 the walk on, R6 the pace, R6 the held)', () => {
  const map = livingMap();
  for (const t of map.towns) { const r = (Math.imul(t.mapId, 2654435761) >>> 0) % 10; if (r < 3) { t.type = 3; t.blocks = 1; } }   // farms: a hunter each
  const o = O();
  const seen = new Set();
  let owed = 0, held = 0, paced = 0;
  for (let day = 300; day < 340; day++) {
    for (const town of map.towns) {
      for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o) ?? []) {
        if (!tr.wild || seen.has(tr.id) || !tr.halt || tr.halt.leg !== 'out' || tr.turned) continue;   // (one turned home never comes to the wild)
        seen.add(tr.id);
        const h = tr.halt, end = tr.way.len - tr.trim1, most = (1 + HALT_CATCH_UP) * tr.pace + 1e-6;
        let prev = partyAt(tr, Math.ceil(h.t0));
        for (let m = Math.ceil(h.t0) + 1; m < tr.backT0; m++) {
          const at = partyAt(tr, m);
          assert.ok(at.s - prev.s >= -1e-6 && at.s - prev.s <= most, `${tr.id}: one place a minute (${((at.s - prev.s) / NATIVE_PER_M).toFixed(1)} m at ${m - h.t0} min on)`);
          prev = at;
        }
        const camp = partyAt(tr, tr.backT0 - 1);
        assert.ok(camp.camp && Math.abs(camp.s - end) < 1e-6, `${tr.id}: the hunt's camp at its point`);
        const s1 = partyAt(tr, tr.outT1).s;
        if (end - s1 <= 1) continue;
        owed++;
        if (h.t1 >= tr.outT1) held++;
        const next = partyAt(tr, tr.outT1 + 1);
        if (next.s < end && walkedMinutes(tr.outT1, tr.outT1 + 1) === 1) { paced++; assert.ok(Math.abs(next.s - s1 - (1 + HALT_CATCH_UP) * tr.pace) < 1e-6, `${tr.id}: on at the catch-up pace`); }
      }
    }
  }
  assert.ok(owed > 0 && held > 0 && paced > 0, `hunters owing ground at the wild's edge (${owed}; held there by their halt ${held}; paced ${paced})`);
});

test('AUDIT LW-II-2 R7: a noble\'s fated retainer sends the procession out whatever the noble\'s own chance said, as AUDIT LW-II F2 made a patrol\'s rider do - and walks in it, to meet the road (mutants: R7 the retainers)', () => {
  const map = livingMap();
  const o = O();
  const forced = { ...map.world, fated: () => true };
  let fated = 0, overChance = 0;
  for (const city of map.towns) {
    const roster = map.world.rosterOf(city);
    const noble = roster.find((r) => r.job === 'noble');
    if (!noble) continue;
    for (const r of roster.filter((x) => x.job === 'retainer' && leaderOf(x, roster)?.slot === noble.slot)) {
      for (let k = 0; k < 300; k++) {
        if (!map.world.fated(r, k)) continue;
        const holder = map.world.holderOf(noble, k);
        if (!holder || !memoTrip(holder, city, k, forced, O())) continue;   // no noble that cycle, or no procession that fits it
        fated++;
        if (lwRng(holder.town, holder.slot, k, 0x74726970)() >= ROAD_TRIP_CHANCE.noble) overChance++;   // 'trip': the noble's own chance said stay
        assert.equal(setsOut(r, city, k, map.world, o), true, `${r.id}@${k}: a road under the fated retainer`);
        const trip = ownTrip(holder, city, k, map.world, o);
        const procession = (townTrips(city, trip.outT0 + 60, map.world, o) ?? []).find((t) => t.id === trip.id);
        assert.ok(procession?.party.some((m) => m.slot === r.slot), `${r.id}@${k}: walking in the procession`);
      }
    }
  }
  assert.ok(fated > 0 && overChance > 0, `fated retainers (${fated}), of them where the noble's chance said stay (${overChance})`);
});

test('AUDIT LW-II-2 R8: a company hired on a merchant\'s train is a company still - one of it greets the player as the company, by its name off its town (namedIn, as its own trip\'s), and it answers by its head\'s regard (the highest of its own walking); the merchant is none of it (mutants: R8 the hired, R8 its own, R8 its town\'s name)', () => {
  const map = livingMap();
  const o = O();
  // a train with a company hired on it, whose name its town's (the name's town form), walking by day
  let found = null;
  const seen = new Set();
  for (let day = 300; day < 360 && !found; day++) {
    for (const town of map.towns) {
      for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o) ?? []) {
        if (!tr.hiredBy || seen.has(tr.id)) continue;
        seen.add(tr.id);
        const c = companiesOf(map.world.rosterOf(town)).find((x) => x.key === tr.hiredBy);
        if (namedIn(c, town.name).name === namedIn(c, '').name) continue;
        for (let m = Math.ceil(whenWalked(tr.outT0, 0)) + 20; m < tr.outT1 && !found; m += 20) { const at = partyAt(tr, m); if (onRoad(at) && !at.camp && !at.halt) found = { tr, t: m, at, town, c }; }
        if (found) break;
      }
      if (found) break;
    }
  }
  assert.ok(found, 'a company named for its town, hired on a train on the road');
  const { tr, t, at, town, c } = found;
  assert.equal(tr.company, undefined, 'the train no company\'s own trip');
  const name = namedIn(c, town.name).name;
  const slots = new Set(c.places.map((p) => p.slot));
  const ofIt = membersAt(tr, t).filter((m) => slots.has(m.slot));
  assert.ok(ofIt.length >= 2, 'its company walking');
  const head = headOf(ofIt);
  const member = ofIt.find((m) => m.id !== head.id);
  const merchant = tr.leader;
  /** What the road says to a player standing at `who`'s side in the train (a fresh regard, `rel` for the refusals). */
  const at_ = (who, rel = createRelations()) => {
    const p = trainOf(tr, at, membersAt(tr, t), t).people.find((x) => x.res.id === who.id);
    const eye = [p.x / 40, 1.6, p.z / 40];
    const sprites = { sync: () => {}, batches: () => [], persons: () => [], bodyOf: (id) => ({ person: { id, pos: eye } }), clear: () => {} };
    const roads = createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => t, baseRate: () => RATE, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40], here: () => ({ x: p.x, z: p.z }), sprites: /** @type {any} */ (sprites), relations: () => rel, memo: new Map() });
    roads.frame(1 / 30, eye);
    return { roads, said: (id) => roads.speech(eye, 30).filter((s) => s.person.id === id).map((s) => s.text) };
  };
  const [word] = at_(member).said(member.id);
  assert.ok(COMPANY_GREETINGS.stranger.map((l) => fillLine(l, { company: name, player: '' })).includes(word), `its greeting the company's, by its name ("${word}")`);
  const [plain] = at_(merchant).said(merchant.id);
  assert.ok(ROAD_GREETINGS.stranger.includes(plain), `the merchant's its own ("${plain}")`);
  // the head an enemy: the company will not talk, its merchant will
  const rel = createRelations();
  rel.note(head.id, 'slain', Math.floor((t - DAY_START_MIN) / DAY_MIN));
  assert.equal(rel.standing(member.id, Math.floor((t - DAY_START_MIN) / DAY_MIN)), 'neutral', 'the member\'s own regard nothing');
  const { roads } = at_(member, rel);
  assert.ok(roads.refuses({ living: { id: member.id }, nameNPC: member.name }), 'one of it refuses, by its head\'s regard');
  assert.equal(roads.refuses({ living: { id: merchant.id }, nameNPC: merchant.name }), null, 'its merchant talks');
});

test('AUDIT LW-II-2 R11 x LW10: past WAGONS_DRAWN the team is capped whole - the nearest wagons drawn (handed in any order), a wagon\'s horse posed only where its wagon is, a pack horse (no wagon of its own) posed wherever it stands; a horse the cap takes is freed (mutants: R11 the cap, R11 the pack horse, LW10P the nearest)', () => {
  const map = livingMap();
  const o = O();
  // a merchant's caravan and a pedlar walking out, as the census and the trips make them
  let merchant = null, pedlar = null;
  for (let day = 300; day < 330 && !(merchant && pedlar); day++) {
    for (const town of map.towns) {
      for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o) ?? []) {
        if (tr.kind === 'merchant' && !tr.sea && teamOf(tr).wagons === 1 && tr.way.len > 4 * NATIVE_PIXEL) merchant ??= tr;
        if (tr.kind === 'pedlar' && !tr.sea && teamOf(tr).packs === 1 && tr.way.len > 2 * NATIVE_PIXEL) pedlar ??= tr;
      }
    }
  }
  assert.ok(merchant && pedlar, 'a caravan and a pedlar');
  // eight caravans of it in file along its way (each its own trip: its own team's keys), the pedlar on its own road
  const t = merchant.outT0 + 60;
  const shown = (eye) => {
    const horses = [], wagons = [];
    const lay = (trip, s) => {
      const train = trainOf(trip, { phase: 'out', s }, trip.party, t);
      const dist = (q) => Math.hypot(q.x / 40 - eye[0], q.z / 40 - eye[2]);
      for (const h of train.horses) horses.push({ key: h.key, feet: [h.x / 40, 0, h.z / 40], yaw: h.yaw, moving: true, speed: 1, distM: dist(h) });
      for (const w of train.wagons) wagons.push({ key: w.key, feet: [w.x / 40, 0, w.z / 40], front: [w.x / 40 + Math.sin(w.yaw), 0, w.z / 40 + Math.cos(w.yaw)], yaw: w.yaw, moving: true, tier: w.tier, s: w.s, hitched: true, distM: dist(w) });
    };
    for (let i = 0; i < 8; i++) lay({ ...merchant, id: `${merchant.id}#${i}` }, merchant.trim0 + 2000 + i * 400);
    lay(pedlar, pedlar.trim0 + 0);
    return { horses, wagons: wagons.reverse() };   // the farthest first: the cap's own sort
  };
  const made = [], destroyed = [], posed = [], drawn = [];
  const renderer = { createBillboardBatch: () => { const b = { origin: null, size: { w: 1, h: 1 } }; made.push(b); return b; }, destroyBillboardBatch: (b) => destroyed.push(b) };
  const pres = {
    horseArt: { ensureStationary: () => true, ensureWalk: () => {}, hasWalk: () => true },
    poseHorse: (b, eye, horse) => posed.push(horse.position.join(',')),
    wagonParts: () => ({ wheelRadius: 0.4, bounds: { min: [-1, 0, -2], max: [1, 1.5, 2] } }),
    drawWagon: (r, tex, pos) => { drawn.push(pos); return true; },
  };
  const teams = createRoadTeams({ renderer, presentation: () => pres, collider: () => null });
  const check = (eye) => {
    const { horses, wagons } = shown(eye);
    posed.length = 0; drawn.length = 0;
    teams.sync(horses, wagons, { dt: 0.1, eye });
    teams.draw({});
    const near = [...wagons].sort((a, b) => a.distM - b.distM).slice(0, WAGONS_DRAWN);
    assert.equal(drawn.length, WAGONS_DRAWN, 'six wagons drawn');
    assert.deepEqual(drawn.map((p) => `${p[0]},${p[2]}`).sort(), near.map((w) => `${w.feet[0]},${w.feet[2]}`).sort(), 'the nearest six');
    const want = horses.filter((h) => !/:h0$/.test(h.key) || !wagons.some((w) => w.key === h.key.replace(/:h0$/, ':w0')) || near.some((w) => w.key === h.key.replace(/:h0$/, ':w0')));
    assert.ok(want.some((h) => h.key.startsWith(pedlar.id)), 'the pack horse among them');
    assert.equal(teams.shown().horses, want.length, 'a horse to each wagon drawn, and the pack horse');
    assert.deepEqual([...posed].sort(), want.map((h) => h.feet.join(',')).sort(), 'posed where they stand');
    return want.length;
  };
  const p0 = trainOf(merchant, { phase: 'out', s: merchant.trim0 }, merchant.party, t).horses[0];
  assert.equal(check([p0.x / 40, 1.6, p0.z / 40]), WAGONS_DRAWN + 1);
  const freedBefore = destroyed.length;
  const p1 = trainOf(merchant, { phase: 'out', s: merchant.trim0 + 2000 + 8 * 400 }, merchant.party, t).horses[0];
  check([p1.x / 40, 1.6, p1.z / 40]);
  assert.equal(destroyed.length - freedBefore, 2, 'the two horses the cap took now freed');
  teams.clear();
  assert.equal(destroyed.length, made.length, 'every batch freed at clear');
});

test('AUDIT LW-II-2 D3: a dive turned home on the road before it came to its dungeon clears nothing there - the dungeon\'s build never reads it (divesIn), where it reads every dive that went in; one turned inside (its leader fallen) has its hours cut at its turning, and its reach ends before it (mutants: D3 the turned, D3 the cut inside)', () => {
  const map = livingMap({ dives: true });
  const o = O();
  const seen = new Set();
  let turned = 0, listed = 0, inside = null;
  for (let day = 300; day < 350 && !(turned && inside); day++) {
    for (const town of map.towns) {
      for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o) ?? []) {
        if (!tr.dive || seen.has(tr.id)) continue;
        seen.add(tr.id);
        if (!inside && tr.enc?.leg === 'dive' && tr.enc.shape === 'fell') inside = tr;
        if (!tr.turned && listed >= 40) continue;   // (enough of those that went in)
        const dungeon = map.dungeons.find((d) => d.mapId === tr.to.mapId);
        const read = divesIn(dungeon, tr.dive.t0 - 1, tr.dive.t1 + 1, map.world, o);
        assert.equal(read.pending, false);
        const has = read.dives.some((d) => d.id === tr.id);
        if (tr.turned) {
          turned++;
          assert.ok(tr.outT1 <= tr.dive.t0, `${tr.id}: turned before it came`);
          assert.equal(has, false, `${tr.id}: turned on the road, never read by its dungeon`);
        } else {
          listed++;
          assert.equal(has, true, `${tr.id}: a dive that went in, read`);
        }
      }
    }
  }
  assert.ok(turned > 0 && listed > 0 && inside, `dives turned on the road (${turned}), dives that went in (${listed}), one turned inside`);
  // turned inside: its hours cut at its turning (the leader's fall, the company out at the fight's end), and a dungeon of
  // stops close together reached no farther than the turning
  assert.equal(inside.dive.t1, inside.enc.t1, 'its hours inside end as it comes out');
  const markers = Array.from({ length: 40 }, (_, i) => ({ record: i % 4 === 3 ? 19 : 15, x: 6 + i * 3, y: 0, z: 10, position: i + 1, loadID: i + 1 }));
  const stops = stopsOf([{ originX: 0, originZ: 0, layout: { markers } }], 200, { x: 0, z: 0 });
  const route = routeOf(stops, { x: 0, z: 0 }, inside);
  assert.ok(route.legs.length > 1, 'it walked some of its dungeon');
  assert.ok(route.legs.every((l) => l.tOut <= inside.enc.t0), 'its reach ends before its turning');
  const cleared = clearedOf([route], inside.enc.t1 + 30);
  assert.deepEqual([...cleared].sort(), route.legs.map((l) => l.stop.key).sort(), 'what it cleared, the stops it reached before it turned');
});

test('AUDIT LW-II-2 P6: a patrol keeps the road behind it - a trip from or to a town its round went from or to, setting out within PATROL_COVER_DAYS of the round\'s coming home (none walking while it does), is covered; past them, not (mutants: P6 the days before)', () => {
  assert.equal(PATROL_COVER_DAYS, 2);
  const map = livingMap();
  const o = O();
  let checked = 0;
  for (const city of map.towns) {
    if (city.type !== 0 || city.blocks < 16) continue;
    const roster = map.world.rosterOf(city);
    const first = roster.find((r) => r.job === 'patrol' && !leaderOf(r, roster));
    for (let k = 20; first && k < 30; k++) {
      const holder = map.world.holderOf(first, k);
      const round = holder && memoTrip(holder, city, k, map.world, o);
      if (!round) continue;
      const trip = (days) => ({ id: `x:${k}`, from: city, to: round.to, outT0: round.backT1 + days * DAY_MIN, backT1: round.backT1 + days * DAY_MIN + 60, party: [] });
      // past the days: no round of any patrol keeps it (so none walks in the days before it either, nor while it does)
      if (patrolCover(trip(PATROL_COVER_DAYS + 0.5), map.world, o) !== false) continue;
      assert.equal(patrolCover(trip(1), map.world, o), true, `${round.id}: a trip setting out the day after its round came home, covered`);
      assert.equal(patrolCover(trip(PATROL_COVER_DAYS - 0.05), map.world, o), true, 'to the last of its days');
      checked++;
    }
  }
  assert.ok(checked > 3, `rounds come home with no other walking after (${checked})`);
});

test('AUDIT LW-II-2 P17: the road\'s census - a pilgrim more from four blocks and a courier more from nine (moreCounts); a hunter an Archer or a Ranger of levels 2 to 8, a retainer a Knight, a Warrior or an Archer of levels 4 to 12, every one of them dealt (mutants: P17 the pilgrim\'s blocks, the courier\'s, the hunter\'s classes and level, the retainer\'s)', () => {
  assert.deepEqual([3, 4, 5, 8, 9].map((blocks) => moreCounts({ mapId: 1, blocks })), [
    { pedlar: 1, pilgrim: 0, courier: 0 }, { pedlar: 1, pilgrim: 1, courier: 0 }, { pedlar: 1, pilgrim: 1, courier: 0 },
    { pedlar: 1, pilgrim: 1, courier: 0 }, { pedlar: 1, pilgrim: 1, courier: 1 },
  ]);
  assert.deepEqual([...HUNTER_CLASSES], [MOBILE_TYPES.Archer, MOBILE_TYPES.Ranger]);
  assert.deepEqual([...RETAINER_CLASSES], [MOBILE_TYPES.Knight, MOBILE_TYPES.Warrior, MOBILE_TYPES.Archer]);
  const hunters = [], retainers = [];
  for (let i = 0; i < 300; i++) {
    hunters.push(...travellerRoster({ mapId: 20000 + i, px: 10, py: 10, blocks: 1, type: 3, region: 17, people: 3 }).filter((r) => r.job === 'hunter'));
    retainers.push(...travellerRoster({ mapId: 30000 + i, px: 10, py: 10, blocks: 16, type: 0, region: 17, people: 3 }).filter((r) => r.job === 'retainer'));
  }
  const spread = (list) => ({ cls: [...new Set(list.map((r) => r.cls))].sort((a, b) => a - b), lo: Math.min(...list.map((r) => r.level)), hi: Math.max(...list.map((r) => r.level)) });
  assert.deepEqual(spread(hunters), { cls: [...HUNTER_CLASSES].sort((a, b) => a - b), lo: 2, hi: 8 }, 'the hunters dealt');
  assert.deepEqual(spread(retainers), { cls: [...RETAINER_CLASSES].sort((a, b) => a - b), lo: 4, hi: 12 }, 'the retainers dealt');
});

test('AUDIT LW-II-2 P17: a hunter\'s wild is the first of WILD_TRIES seeded tries that stands dry - a first try into the wet is followed by the next (mutants: P17 the tries)', () => {
  assert.equal(WILD_TRIES, 6);
  const home = { mapId: 41, px: 100, py: 100, blocks: 1, type: 3, region: 17, people: 3, name: 'Farm' };
  const hx = 100.5 * NATIVE_PIXEL;
  const world = { townsNear: (px, py, r) => (Math.max(Math.abs(px - 100), Math.abs(py - 100)) <= r ? [home] : []), dryAt: (nx) => nx > hx };   // dry east of the farm, wet west
  const hunter = travellerRoster(home).find((r) => r.job === 'hunter');
  // the tries' own dice, scripted: west (wet), then east (dry); then the day, the hour, the morning's hunt
  const rolls = [0.75, 0.5, 0.25, 0.5, 0, 0.5, 0.5];
  let i = 0;
  const trip = wildTrip(hunter, home, 3, /** @type {any} */ (world), { start: 12, len: 4, pace: 260, rng: () => rolls[i++] });
  assert.ok(trip, 'the second try\'s point');
  assert.ok(trip.wild.x > hx + 2 * NATIVE_PIXEL - 1, 'east, two pixels on (the second try)');
  assert.equal(i, rolls.length, 'every roll read: the second try taken');
});

test('AUDIT LW-II-2 P17: a night lodged at an inn meets no trouble at a camp - the camp\'s share of a trouble falls on that day\'s WALK instead, at its own seeded minute and place (or, met while the party still lodges, as it sets out again: R3) (mutants: P17 the inn\'s walk minute)', () => {
  const { map, o, trips } = innTrips();
  let diverted = 0;
  for (const tr of trips) {
    if (!tr.enc || tr.dive || !tr.way.inns) continue;
    if (tr.party.some((m) => map.trouble.diced(m, tr) || map.trouble.dies(m, tr))) continue;   // (a fated trouble's dice are its own)
    // the trouble's own stream (trouble.js troubleOf): its roll, its leg, its walk's minute, the camp's share
    const rng = lwRng(textSeed(tr.id), 0x54524f55);   // 'TROU'
    rng(); rng();
    const leg = tr.enc.leg, dir = leg === 'out' ? 1 : -1;
    const legStart = leg === 'out' ? tr.outT0 : tr.backT0;
    const walkMin = (tr.way.len - tr.trim0 - tr.trim1) / tr.pace;
    const wm = (0.15 + 0.7 * rng()) * walkMin;
    const firstLight = whenWalked(legStart, 0);
    const firstDay = Math.max(0, Math.floor(firstLight / DAY_MIN) * DAY_MIN + WALK_TO_H * 60 - firstLight);
    if (!(rng() < CAMP_SHARE && firstDay > 0 && firstDay < walkMin)) continue;   // no camp's share
    const sCamp = leg === 'out' ? tr.trim0 + tr.pace * firstDay : tr.way.len - tr.trim1 - tr.pace * firstDay;
    if (!innAhead(tr.way, sCamp, dir, tr.trim0, tr.way.len - tr.trim1)) continue;   // a camp's night, not an inn's
    diverted++;
    // the walk's own minute - or, the party lodged then (the trip as the dice found it), the minute it sets out again
    const raw = memoTrip(tr.leader, tr.from, tr.k, map.world, o);
    let t0 = whenWalked(legStart, wm);
    let s = leg === 'out' ? tr.trim0 + tr.pace * wm : tr.way.len - tr.trim1 - tr.pace * wm;
    if (partyAt(raw, t0).inn) { for (t0 = Math.ceil(t0); partyAt(raw, t0).inn; t0++); s = partyAt(raw, t0).s; }
    assert.equal(tr.enc.camp, false, `${tr.id}: no camp's trouble at an inn's night`);
    assert.ok(Math.abs(tr.enc.t0 - t0) < 1e-6 && Math.abs(tr.enc.s - s) < 1e-6, `${tr.id}: met on its walk, at its own minute and place`);
  }
  assert.ok(diverted > 0, `troubles whose camp was an inn's night (${diverted})`);
});

test('AUDIT LW-II-2 P17: an inn on a way is never one of its own ends - a trip to a roadside tavern lodges at no inn of its own end on the way (mutants: P17 the ends)', () => {
  const { trips } = innTrips();
  let toInn = 0;
  for (const tr of trips) {
    assert.ok(!tr.way.inns?.some((i) => i.town.mapId === tr.to.mapId || i.town.mapId === tr.from.mapId), `${tr.id}: no end of its own an inn on its way`);
    if (tr.to.type === INN_TYPE) toInn++;
  }
  assert.ok(toInn > 0, `trips to a roadside tavern (${toInn})`);
});

test('AUDIT LW-II-2 P17: the train\'s spacings and the camp\'s park as the record has them - a second team WAGON_TAIL_N (2.75 m) behind the first wagon\'s axle, a parked wagon CAMP_PARK_N (3 m) beyond the camp\'s ring (mutants: P17 the tail, the park)', () => {
  assert.equal(WAGON_TAIL_N / NATIVE_PER_M, 2.75);
  assert.equal(CAMP_PARK_N / NATIVE_PER_M, 3);
});

test('AUDIT LW-II-2 P17: a pilgrims\' holy day is one from its cycle\'s second day to its LAST BUT ONE - never its last; a pilgrim come to a temple town keeps its temple again before the evening, from PILGRIM_TEMPLE_H\'s 15:30 (mutants: P17 the holy day\'s last edge, the pilgrim\'s evening)', () => {
  // the region's own: day 2 of the year is Scour Day for region 24 (holidays.js's tables), the first every region's
  const t24 = { mapId: 2, region: 24 };
  const Y = 410 * 360;
  assert.equal(holidayRegion(getHolidayId((Y + 1) * DAY_MIN + 720, 24)), 25);
  assert.equal(holyDayOf([t24], Y - 1, 4)?.day, Y + 1, 'its last but one');
  assert.equal(holyDayOf([t24], Y - 1, 3), null, 'never its last');
  // the evening's visit
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 4242, blocks: 9, region: 17, people: 3 }, buildings);
  const home = census.find((r) => r.home != null && places.doors.get(r.home));
  const day = 200, D0 = day * DAY_MIN + DAY_START_MIN;
  const plan = dayPlan({ ...home, job: 'pilgrim', cls: null, pious: 0.1 }, places, day, { mpm: CALENDAR_MPM, visitor: true, home: places.doors.get(home.home), away: [{ t0: D0 - DAY_MIN, t1: D0 + 2 * 60, exit: places.exits[0] ?? null, armed: false }, { t0: D0 + 20 * 60, t1: D0 + 2 * DAY_MIN, exit: places.exits[0] ?? null, armed: false }] });
  const evening = plan.filter((e) => e.kind === 'temple' && e.t0 >= D0 + 10 * 60);
  assert.equal(PILGRIM_TEMPLE_H[1], 15.5);
  assert.ok(evening.length && evening.every((e) => e.t0 >= day * DAY_MIN + 15 * 60 && e.t0 <= day * DAY_MIN + 15.5 * 60), `before the evening, from half past three (${evening.map((e) => ((e.t0 % DAY_MIN) / 60).toFixed(2))})`);
});
