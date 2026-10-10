// AUDIT LW-II-2 (2026-10-10, the second audit of THE LIVING WORLD II, lane R - the road: LW9, LW10, LW13): every pin red
// on the code as it stood (its mutants, tools/mutants/auditlwii2_road.json), on the synthetic map (test/lwRoads.mjs - the
// census's rosters, townTrips, livingMap's lives and trouble as the host composes them). No game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livingMap, synthMap } from './lwRoads.mjs';
import {
  townTrips, partyAt, membersAt, handsOn, awayOf, whenWalked, ownTrip, setsOut, memoTrip, leaderOf, wildTrip, innsAlong, innAhead,
  innGuestsOf, divesIn, patrolCover, walkedMinutes, wayOf, CALENDAR_MPM, INN_TYPE, HALT_CATCH_UP, NATIVE_PIXEL, NATIVE_PER_M,
  WILD_TRIES, PATROL_COVER_DAYS, ROAD_TRIP_CHANCE, ROAD_RANGE_PX,
} from '../src/systems/livingWorld/trips.js';
import { troubleOf, CAMP_SHARE } from '../src/systems/livingWorld/trouble.js';
import { createLivingRoads, campGroups, passingPairs, walkingAt, passingLine, PASS_N, CAMP_SHARE_N } from '../src/scenes/livingRoads.js';
import { createRoadTeams, WAGONS_DRAWN } from '../src/world/roadTeams.js';
import { trainOf, teamOf, WAGON_TAIL_N, CAMP_PARK_N, HITCH_N } from '../src/systems/livingWorld/wagons.js';
import { companiesOf, namedIn, headOf, holyDayOf } from '../src/systems/livingWorld/companies.js';
import { stopsOf, routeOf, clearedOf } from '../src/systems/livingWorld/deepRoute.js';
import { travellerRoster, moreCounts, HUNTER_CLASSES, RETAINER_CLASSES } from '../src/systems/livingWorld/census.js';
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
import { townCensus } from '../src/systems/livingWorld/census.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });
const onRoad = (at) => at.phase === 'out' || at.phase === 'back';

/**
 * The roads' layer read once at minute `t` about the player's place `here` (native): what it hands its sprites (each body
 * and fire by key, its feet) and its teams (each horse and wagon).
 * @param {any} world @param {number} t @param {{ x: number, z: number }} here @param {{ relations?: any, eye?: number[] }} [o]
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

test('AUDIT LW-II-2 R3: a trouble met while a party still lodges at its inn of a morning falls as it sets out again, at the inn\'s place - no step back into its halt, never lodged again after it, and the inn\'s guest out as it sets out, after its last lodged minute (mutants: R3 the move, R3 the minute, R3 the place)', () => {
  const map = innMap();
  const o = O();
  const seen = new Set();
  let lodged = 0, checked = 0;
  for (let day = 300; day < 330; day++) {
    for (const town of map.towns) {
      if (town.type === INN_TYPE) continue;
      for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o) ?? []) {
        if (seen.has(tr.id) || tr.sea || !tr.halt || !tr.way.inns) continue;
        seen.add(tr.id);
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
    }
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
