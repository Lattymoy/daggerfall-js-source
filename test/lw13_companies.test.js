// LW13 (bible/06-Systems/Living-World-II.md "LW13"): THE COMPANIES - a town's adventurers dealt into companies (their
// sizes, the mix of the three runs, the one left over alone), named, led by their first place's trip (one trip a cycle,
// every place's holder walking it; a fated member sending the company out; a company the likelier to dive), hired on a
// merchant's train with no sellsword; pilgrims in bands, and to a temple town's holy day; seen - in file by role, the
// mark by name, the greeting naming it, its head's word; the People page's companies; a pilgrim's day at a temple
// town. Pure and synthetic: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  companiesOf, companyOfPlace, companyName, namedIn, roleOf, byRole, headOf, holyDayOf, holyDepartMin, holyDraw, COMPANY_SIZE, COMPANY_CITY_MAX,
  COMPANY_CITY_ADVENTURERS, COMPANY_DIVE_CHANCE, ROLE_RUNS, ROLE_ORDER, HOLY_CHANCE, COMPANY_WORDS, COMPANY_BEASTS,
} from '../src/systems/livingWorld/companies.js';
import {
  ownTrip, townTrips, formCaravans, leaderOf, placeCycle, cycleOf, awayOf, holyTrip, CALENDAR_MPM, DIVE_CHANCE, HOLY_IN_H, WALK_FROM_H, TRIP_PACE, NATIVE_PER_M,
} from '../src/systems/livingWorld/trips.js';
import { travellerRoster } from '../src/systems/livingWorld/census.js';
import { lwRng } from '../src/systems/livingWorld/seed.js';
import { getHolidayId, holidayRegion } from '../src/systems/holidays.js';
import { partyLabel, partyPlaces } from '../src/scenes/livingRoads.js';
import { COMPANY_GREETINGS, fillLine } from '../src/systems/livingWorld/lines.js';
import { peoplePage } from '../src/systems/livingWorld/people.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { dayPlan, DAY_MIN, PILGRIM_TEMPLE_H } from '../src/systems/livingWorld/dayPlan.js';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { synthTown } from './lwTown.mjs';
import { synthMap } from './lwRoads.mjs';

const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });
const town = (mapId, px, py, blocks, region = 17) => ({ mapId, px, py, blocks, type: 0, region, people: 3, name: `T${mapId}`, port: false });
function miniWorld(towns) {
  const rosters = new Map();
  return {
    townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r).sort((a, b) => a.mapId - b.mapId),
    routeOf: (a, b) => {
      const k = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));
      const pixels = [];
      for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(a.px + ((b.px - a.px) * i) / k), y: Math.round(a.py + ((b.py - a.py) * i) / k) });
      return { pixels, kinds: pixels.slice(1).map(() => 'road') };
    },
    rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
    templeTown: (t) => t.blocks >= 16,
  };
}

test('LW13 the deal: a town\'s adventurers in slot order, each company COMPANY_SIZE off its first place\'s seed (to COMPANY_CITY_MAX where the town keeps COMPANY_CITY_ADVENTURERS), each next place of a run it lacks where there is one, one left over alone; every census id as it was (mutants: the size, the city, the mix, the left over, the order)', () => {
  assert.deepEqual([...COMPANY_SIZE], [2, 4]);
  assert.equal(COMPANY_CITY_MAX, 5); assert.equal(COMPANY_CITY_ADVENTURERS, 5);
  assert.deepEqual({ ...ROLE_RUNS }, { mage: [128, 133], thief: [134, 139], warrior: [140, 145] });
  assert.deepEqual([...ROLE_ORDER], ['warrior', 'thief', 'mage']);
  assert.deepEqual([127, 128, 133, 134, 139, 140, 145, 146, null].map(roleOf), [null, 'mage', 'mage', 'thief', 'thief', 'warrior', 'warrior', null, null]);
  let cities = 0, mixed = 0, lone = 0;
  for (let id = 1; id < 400; id++) {
    const blocks = 9 + (id % 60);
    const roster = travellerRoster(town(id, 0, 0, blocks));
    const advs = roster.filter((r) => r.job === 'adventurer').sort((a, b) => a.slot - b.slot);
    const cs = companiesOf(roster);
    assert.equal(companiesOf(roster), cs, 'dealt once a roster');
    const dealt = cs.flatMap((c) => c.places);
    assert.equal(new Set(dealt.map((p) => p.slot)).size, dealt.length, 'each place in one company');
    assert.ok(advs.length - dealt.length <= 1, 'one left over at most');
    if (advs.length - dealt.length === 1) { lone++; assert.equal(companyOfPlace(advs.find((a) => !dealt.includes(a)), roster), null); }
    if (advs.length < 2) assert.equal(cs.length, 0, 'a lone adventurer keeps none');
    const max = advs.length >= COMPANY_CITY_ADVENTURERS ? COMPANY_CITY_MAX : COMPANY_SIZE[1];
    cs.forEach((c, i) => {
      assert.equal(c.key, `C${id}.${i}`);
      assert.ok(c.places.length >= 2 && c.places.length <= max, `${c.key}: ${c.places.length}`);
      if (c.places.length === 5) cities++;
      // its first the lowest slot left; each next of a run it lacks where one was left
      const before = advs.filter((a) => !cs.slice(0, i).some((x) => x.places.includes(a)));
      assert.equal(c.places[0], before[0]);
      if (new Set(c.places.map((p) => roleOf(p.cls))).size > 1) mixed++;
    });
    assert.ok(roster.every((r) => /^L\d+\.t\d+$/.test(r.id)), 'the census\'s ids');
  }
  assert.ok(cities > 0 && mixed > 50 && lone > 10, `${cities} ${mixed} ${lone}`);
  // the mix: a run it lacks taken before the next in order
  const roster = [0, 1, 2, 3].map((slot) => ({ id: `L9.t${slot}`, town: 9, slot, job: 'adventurer', cls: [128, 129, 140, 135][slot], name: `A${slot}` }));
  const c = companiesOf(roster);
  if (c[0].places.length >= 2) assert.equal(c[0].places[1].slot, 2, 'a warrior before a second mage');
  if (c[0].places.length >= 3) assert.equal(c[0].places[2].slot, 3, 'then a thief');
});

test('LW13 the name and the head: "The <word> Company", "<beasts> of <town>" or "<first>\'s company", the same for every reader; the head the highest level walking (mutants: the forms, the head)', () => {
  assert.ok(COMPANY_WORDS.length >= 8 && COMPANY_BEASTS.length >= 6);
  const names = new Set();
  for (let i = 0; i < 120; i++) names.add(companyName(`C1.${i}`, 'Ada Lark', 'Wayrest').replace(/^The \w+ Company$/, 'word').replace(/^\w+ of Wayrest$/, 'beasts').replace(/^Ada's company$/, 'first'));
  assert.deepEqual([...names].sort(), ['beasts', 'first', 'word']);
  assert.equal(companyName('C1.0', 'Ada Lark', 'Wayrest'), companyName('C1.0', 'Ada Lark', 'Wayrest'));
  for (let i = 0; i < 60; i++) assert.ok(!/ of $/.test(companyName(`C1.${i}`, 'Ada', '')), 'no town, no "of"');
  assert.equal(namedIn({ key: 'C1.0', places: [{ name: 'Ada Lark' }] }, 'Wayrest').name, companyName('C1.0', 'Ada Lark', 'Wayrest'));
  assert.equal(headOf([{ id: 'a', level: 3 }, { id: 'b', level: 9 }, { id: 'c', level: 9 }]).id, 'b');
  assert.equal(headOf([]), null);
});

/** A town of companies, its world. */
const companyTown = () => {
  const home = town(1, 100, 100, 40), b = town(2, 108, 100, 20);
  return { home, b, world: miniWorld([home, b]) };
};

test('LW13 one trip a cycle: a company\'s places ride its first\'s (leaderOf, placeCycle), its first\'s trip carries every place\'s holder that cycle, named; no member has a trip of their own; their away windows the company\'s (mutants: the leader, the riders, the name)', () => {
  const { home, world } = companyTown();
  const roster = world.rosterOf(home);
  const cs = companiesOf(roster);
  assert.ok(cs.length >= 1);
  for (const c of cs) {
    assert.equal(leaderOf(c.places[0], roster), null);
    for (const p of c.places.slice(1)) {
      assert.equal(leaderOf(p, roster)?.slot, c.places[0].slot);
      assert.equal(placeCycle(p, roster, 4000, 1), cycleOf(c.places[0], 4000, 1).k, 'its cycle the first\'s');
      for (let k = 600; k < 640; k++) assert.equal(ownTrip(p, home, k, world, O()), null, 'no trip of its own');
    }
  }
  const o = O();
  let seen = 0;
  for (let day = 4200; day < 4260; day += 2) {
    for (const tr of townTrips(home, day * DAY_MIN + 600, world, o) ?? []) {
      if (tr.kind !== 'adventurer') continue;
      const c = cs.find((x) => x.places[0].slot === tr.leader.slot);
      if (!c) { assert.equal(tr.party.length, 1); continue; }
      seen++;
      assert.deepEqual(tr.party.map((m) => m.slot), c.places.map((p) => p.slot), 'every place walking');
      assert.equal(tr.company.key, c.key);
      assert.equal(tr.company.name, namedIn(c, home.name).name);
      for (const m of tr.party) assert.equal(awayOf(m, [tr])[0].t0, tr.outT0, 'away with it');
    }
  }
  assert.ok(seen > 3, `${seen} company trips`);
});

test('LW13 a fated member sends the company out, whatever its first\'s chance said; a company dives COMPANY_DIVE_CHANCE of its cycles (a lone adventurer DIVE_CHANCE) (mutants: the fated, the dive chance)', () => {
  assert.equal(COMPANY_DIVE_CHANCE, 0.75);
  const { home, world } = companyTown();
  const roster = world.rosterOf(home);
  const c = companiesOf(roster)[0];
  const first = c.places[0], follower = c.places[1];
  let forced = 0;
  for (let k = 500; k < 700; k++) {
    if (lwRng(first.town, first.slot, k, 0x74726970)() < 0.7) continue;   // its own chance sent it anyway (TRIP_CHANCE.adventurer)
    const own = ownTrip(first, home, k, { ...world, fated: () => false }, O());
    const fatedTrip = ownTrip(first, home, k, { ...world, fated: (r) => r.slot === follower.slot }, O());
    assert.equal(own, null);
    if (fatedTrip) forced++;
  }
  assert.ok(forced > 10, `${forced} cycles sent out by a fated member`);
  // the dive: a company's first by its own dice at COMPANY_DIVE_CHANCE
  const deep = synthMap({ dives: true });
  let dives = 0, cand = 0, between = 0;
  for (const t of deep.towns) {
    const r = deep.world.rosterOf(t);
    for (const co of companiesOf(r)) {
      for (let k = 300; k < 340; k++) {
        const tr = ownTrip(co.places[0], t, k, deep.world, O());
        if (!tr) continue;
        const roll = lwRng(co.places[0].town, co.places[0].slot, k, 0x64697665)();
        if (tr.dive) { dives++; assert.ok(roll < COMPANY_DIVE_CHANCE); if (roll >= DIVE_CHANCE) between++; }
        if (roll < COMPANY_DIVE_CHANCE && roll >= DIVE_CHANCE) cand++;
      }
    }
  }
  assert.ok(dives > 20 && cand > 5 && between > 3, `${dives} ${cand} ${between}: a company dives where a lone adventurer would not`);
});

/** A town's roster of one merchant, a company of three and two pilgrims; their trips as given. */
function smallTown(trips) {
  const T = { mapId: 7, blocks: 12, name: 'Seven' };
  const roster = [
    { id: 'L7.t0', town: 7, slot: 0, job: 'merchant', cls: null, name: 'Mo Merchant', level: 3 },
    { id: 'L7.t1', town: 7, slot: 1, job: 'adventurer', cls: 144, name: 'Wy Warrior', level: 5 },
    { id: 'L7.t2', town: 7, slot: 2, job: 'adventurer', cls: 130, name: 'Ma Mage', level: 8 },
    { id: 'L7.t3', town: 7, slot: 3, job: 'adventurer', cls: 136, name: 'Ro Rogue', level: 4 },
    { id: 'L7.t4', town: 7, slot: 4, job: 'pilgrim', cls: null, name: 'Pi One', level: 1 },
    { id: 'L7.t5', town: 7, slot: 5, job: 'pilgrim', cls: null, name: 'Pi Two', level: 1 },
  ];
  const mk = (slot, to, day, extra = {}) => ({ id: `L7.t${slot}:${day}`, k: cycleOf(roster[slot], day, 1).k, kind: roster[slot].job, leader: roster[slot], party: [roster[slot]], to: { mapId: to }, outT0: day * DAY_MIN + 480, outT1: day * DAY_MIN + 900, backT0: (day + 2) * DAY_MIN, backT1: (day + 3) * DAY_MIN, ...extra });
  const made = trips(mk);
  const tripOf = (res, k) => made.find((t) => t.leader.slot === res.slot && t.k === k) ?? null;
  return { T, roster, made, run: () => formCaravans(T, made, roster, tripOf, 1) };
}

test('LW13 hired: a company setting out the day a merchant\'s train with no sellsword does, for the same town, walks in it - its trip dropped, the train marked; to another town, or another day, its own (mutants: the hire, the same town, the same day, the dive)', () => {
  const day = 3000;
  const hired = smallTown((mk) => [mk(0, 50, day), mk(1, 50, day)]).run();
  assert.equal(hired.length, 1, 'one party');
  assert.deepEqual(hired[0].party.map((m) => m.slot), [0, 1, 2, 3]);
  assert.equal(hired[0].hiredBy, 'C7.0');
  const apart = smallTown((mk) => [mk(0, 50, day), mk(1, 51, day)]).run();
  assert.equal(apart.length, 2);
  assert.deepEqual(apart.find((t) => t.kind === 'adventurer').party.map((m) => m.slot), [1, 2, 3]);
  assert.ok(apart.find((t) => t.kind === 'adventurer').company, 'named');
  const later = smallTown((mk) => [mk(0, 50, day), mk(1, 50, day + 1)]).run();
  assert.equal(later.length, 2, 'another day');
  const diving = smallTown((mk) => [mk(0, 50, day), mk(1, 50, day, { dive: { t0: 1, t1: 2 } })]).run();
  assert.equal(diving.length, 2, 'a dive is no hire');
});

test('LW13 pilgrim bands: a town\'s pilgrims setting out the same day for the same town go together, the first place leading; another day, alone; in a merchant\'s train, the train\'s (mutants: the band, the lead, the train)', () => {
  const day = 3000;
  const band = smallTown((mk) => [mk(4, 60, day), mk(5, 60, day)]).run();
  assert.equal(band.length, 1);
  assert.deepEqual(band[0].party.map((m) => m.slot), [4, 5]);
  assert.equal(band[0].leader.slot, 4);
  const apart = smallTown((mk) => [mk(4, 60, day), mk(5, 60, day + 1)]).run();
  assert.equal(apart.length, 2);
  const train = smallTown((mk) => [mk(0, 60, day), mk(4, 60, day), mk(5, 60, day)]).run();
  assert.equal(train.length, 1, 'both in the train');
  assert.deepEqual(train[0].party.map((m) => m.slot).sort(), [0, 4, 5]);
});

test('LW13 the holy day: a pilgrim\'s cycle with a temple town\'s own holy day (its region\'s alone, never every region\'s) goes to it on its own draw (HOLY_CHANCE) - in by HOLY_IN_H of the day, home the morning after, its town\'s pilgrims setting out at one minute; the temple town full of them (mutants: the region, the draw, the arrival, the minute)', () => {
  assert.equal(HOLY_CHANCE, 0.8); assert.equal(HOLY_IN_H, 10);
  // the region's own: day 2 of the year is Scour Day for region 24 (holidays.js's tables), the first every region's
  const t24 = { mapId: 2, region: 24 };
  const Y = 410 * 360;
  assert.equal(holidayRegion(getHolidayId((Y + 1) * DAY_MIN + 720, 24)), 25);
  assert.equal(holyDayOf([t24], Y - 1, 5)?.day, Y + 1);
  assert.equal(holyDayOf([{ mapId: 3, region: 17 }], Y - 1, 5), null, 'New Life is every region\'s: no pilgrimage');
  assert.equal(holyDayOf([t24], Y + 1, 5), null, 'never its window\'s first day');
  let yes = 0;
  for (let k = 0; k < 2000; k++) if (holyDraw({ town: 1, slot: 3 }, k)) yes++;
  assert.ok(Math.abs(yes / 2000 - HOLY_CHANCE) < 0.04);
  // pilgrims of a town to a temple town keeping its holy day
  const home = town(1, 100, 100, 12), temple = town(2, 106, 100, 20, 24);
  const world = miniWorld([home, temple]);
  const pilgrims = world.rosterOf(home).filter((r) => r.job === 'pilgrim');
  assert.ok(pilgrims.length >= 2);
  let found = 0, drawnOut = 0;
  const outs = new Map();
  const holyDays = [];
  for (let d = 0; d < 360; d++) { const id = getHolidayId(d * DAY_MIN + 720, 24); if (id && holidayRegion(id) === 25) holyDays.push(d); }
  assert.ok(holyDays.length >= 2, 'region 24 keeps its own holy days');
  for (let year = 400; year < 404; year++) for (const hd of holyDays) {
    for (const p of pilgrims) {
      const day = year * 360 + hd;
      const c = cycleOf(p, day, 1);
      if (holyDayOf([temple], c.start, c.len)?.day !== day) continue;   // another of the region's holy days first, or its window's edge
      if (!holyDraw(p, c.k)) { drawnOut++; assert.equal(holyTrip(p, home, c.k, world, { start: c.start, len: c.len, pace: TRIP_PACE.pilgrim * CALENDAR_MPM * NATIVE_PER_M }), null, 'its draw said stay'); continue; }
      const tr = holyTrip(p, home, c.k, world, { start: c.start, len: c.len, pace: TRIP_PACE.pilgrim * CALENDAR_MPM * NATIVE_PER_M });
      if (!tr) continue;
      found++;
      const own = ownTrip(p, home, c.k, world, O());
      if (own) assert.deepEqual(own, tr, 'its cycle\'s trip the pilgrimage');
      assert.equal(tr.to.mapId, 2);
      assert.equal(tr.holy.day, day);
      assert.ok(tr.outT1 <= day * DAY_MIN + HOLY_IN_H * 60, 'in by the morning');
      assert.ok(tr.backT0 >= (day + 1) * DAY_MIN && tr.backT0 < (day + 1) * DAY_MIN + 10 * 60, 'home the morning after');
      assert.equal(tr.outT0 % DAY_MIN, holyDepartMin(home, day), 'one minute for its town');
      assert.ok(holyDepartMin(home, day) >= WALK_FROM_H * 60 - 60 && holyDepartMin(home, day) < 7.5 * 60);
      if (outs.has(day)) assert.equal(outs.get(day), tr.outT0, 'the band sets out together');
      outs.set(day, tr.outT0);
    }
  }
  assert.ok(found >= 3 && drawnOut >= 1, `${found} pilgrimages, ${drawnOut} kept home by their draw`);
});

test('LW13 seen: a company in file by role (warriors, thieves, mages), its mark by name ("The Lantern Company, to Mournoth"), its greeting naming it, its word its head\'s; the People page\'s companies (mutants: the order, the label, the greeting, the head, the page)', () => {
  const party = [{ id: 'm', cls: 130 }, { id: 't', cls: 136 }, { id: 'w', cls: 144 }];
  assert.deepEqual(byRole(party).map((m) => m.id), ['w', 't', 'm']);
  const way = { pts: [[0, 0], [0, 100000]], cum: [0, 100000], len: 100000, kinds: ['road'] };
  const trip = { id: 'L1.t1:2', way, party, company: { key: 'C1.0', name: 'The Lantern Company' }, to: { name: 'Mournoth' }, kind: 'adventurer' };
  const places = partyPlaces(trip, { phase: 'out', s: 50000, x: 0, z: 50000 });
  assert.deepEqual(places.map((p) => p.res.id), ['w', 't', 'm'], 'in file by role');
  assert.ok(places[0].z > places[1].z && places[1].z > places[2].z);
  const lone = partyPlaces({ ...trip, company: undefined }, { phase: 'out', s: 50000, x: 0, z: 50000 });
  assert.deepEqual(lone.map((p) => p.res.id), ['m', 't', 'w'], 'others as they walk');
  assert.equal(partyLabel(trip), 'The Lantern Company, to Mournoth');
  assert.equal(partyLabel(trip, '', 'Orcs'), 'The Lantern Company beset by Orcs');
  assert.equal(partyLabel({ ...trip, to: null }), 'The Lantern Company');
  for (const pool of Object.values(COMPANY_GREETINGS)) for (const l of pool) assert.ok(fillLine(l, { company: 'The Lantern Company', player: 'Bo' }).includes('The Lantern Company'));
  const roads = readFileSync(new URL('../src/scenes/livingRoads.js', import.meta.url), 'utf8');
  assert.match(roads, /const word = company\?\.head\?\.id \?\? m\.res\.id;/);
  assert.match(roads, /const s = rel\.standing\(companyAt\(id, deps\.clock\(\)\)\?\.head\?\.id \?\? id, dayOf\(deps\.clock\(\)\)\);/);
  assert.match(roads, /return p \? \{ name: p\.trip\.company\.name, head: headOf\(membersAt\(p\.trip, t\)\) \} : null;/);
  // the People page: the companies the known walk with
  const home = town(1, 100, 100, 40);
  home.name = 'Wayrest';
  const roster = travellerRoster(home);
  const c = companiesOf(roster)[0];
  const rel = createRelations();
  for (const p of c.places.slice(0, 2)) rel.note(p.id, 'talk', 10);
  const page = peoplePage(rel, 10, (id) => (id === 1 ? home : null));
  const name = namedIn(c, 'Wayrest').name;
  assert.ok(page.known.slice(0, 2).every((r) => r.company === name));
  assert.deepEqual(page.companies, [{ name, town: 'Wayrest', members: page.known.filter((r) => r.company === name).map((r) => r.name) }]);
  const chron = readFileSync(new URL('../src/ui/enhancedChronicle.js', import.meta.url), 'utf8');
  assert.match(chron, /if \(p\.company\) top\.append\(el\('span', 'sb-chip', p\.company\)\);/);
  assert.match(chron, /line\.append\(el\('span', 'sb-chip', `Companies \\u00b7 \$\{page\.companies\.length\}`\)\);/);
});

test('LW13 a pilgrim come to a temple town keeps its temple - the morning long and again before the evening (PILGRIM_TEMPLE_H) - where a visitor keeps the market (mutants: the visit, the hours)', () => {
  assert.deepEqual([...PILGRIM_TEMPLE_H], [8.5, 15.5]);
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 4242, blocks: 9, region: 17, people: 3 }, buildings);
  const home = census.find((r) => r.home != null && places.doors.get(r.home));
  const day = 200, D0 = day * DAY_MIN + 240;
  const as = (job) => ({ ...home, job, cls: null, pious: 0.1 });
  const visit = (job) => dayPlan(as(job), places, day, { mpm: CALENDAR_MPM, visitor: true, home: places.doors.get(home.home), away: [{ t0: D0 - DAY_MIN, t1: D0 + 2 * 60, exit: places.exits[0] ?? null, armed: false }, { t0: D0 + 20 * 60, t1: D0 + 2 * DAY_MIN, exit: places.exits[0] ?? null, armed: false }] });
  const temple = visit('pilgrim').filter((e) => e.kind === 'temple');
  assert.ok(temple.length >= 2, 'the temple twice');
  assert.ok(temple.reduce((a, e) => a + (e.t1 - e.t0), 0) >= 150, 'the morning long');
  assert.ok(temple.some((e) => e.t0 >= D0 + 4 * 60 && e.t0 <= D0 + 6 * 60), 'from half past eight');
  assert.equal(visit('courier').filter((e) => e.kind === 'temple').length, 0, 'a visitor of little piety keeps none');
});
