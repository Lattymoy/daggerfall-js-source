// LW1 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVING WORLD'S PURE CORE - the census, the places, the
// town's ways, the day, the meetings, the lines and the regards. Every fixture is the producers' own output on a
// synthetic town (a navgrid of streets and building footprints, the buildings' summaries' columns, the doors'
// location-frame centres and normals).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CityNavigation, NAV_CELL, HALF_CELL } from '../src/world/cityNavigation.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { PERSON_TEXTURES, PERSON_FACE_RECORDS, NUM_PERSON_FACE_VARIANTS, GUARD_TEXTURE } from '../src/characters/mobilePerson.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { getSeed, setSeed, rand } from '../src/formats/dfRandom.js';
import { lwSeed, lwRng, pickWeighted, textSeed, LW_SALT } from '../src/systems/livingWorld/seed.js';
import { hash32 } from '../src/world/spawnedDungeons.js';
import {
  travellerCounts, townWatchCount, travellerRoster, watchRoster, householdCensus, townCensus, mintResident, residentName,
  raceOfPeople, CENSUS_MAX, ADVENTURER_CLASSES, MERCENARY_CLASSES, COURIER_CLASSES, isHome, hasShopJob,
} from '../src/systems/livingWorld/census.js';
import { townPlaces, streetNet, exitToward, exitNearest, SOCIAL_OUT, MARKET_OUT } from '../src/systems/livingWorld/places.js';
import { findTownPath, pathLine, pointOnLine, stepCost, createPathBook } from '../src/systems/livingWorld/townPaths.js';
import { dayPlan, entryAt, isOutdoor, walkMinutes, schedule, guardBeat, favourites, DAY_START_MIN, DAY_MIN, MIN_STAY, GEAR_MIN, HOME_GAP, WALK_DETOUR, WALK_EXTRA_M } from '../src/systems/livingWorld/dayPlan.js';
import { spotCircles, circleLine, circleStands, aloneStand, lineMinutes, ROUND_S, TALK_SHARE, CIRCLE_APART } from '../src/systems/livingWorld/meetups.js';
import { fillLine, firstNameOf, pickScript, TOWN_TALKS, JOB_TALKS, LIVING_GREETINGS, TOKEN_FALLBACK } from '../src/systems/livingWorld/lines.js';
import { createRelations, regardStanding, EVENTS, FRIEND_AT, ENEMY_AT, HOSTILE_AT, EASE_PER_DAY, RELATIONS_MAX, LIVING_WORLD_VENDOR } from '../src/systems/livingWorld/relations.js';
import { CREW_LINE_S } from '../src/systems/naval/crewLife.js';
import { synthTown } from './lwTown.mjs';

const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });
const MPM = 1.3 / 0.2;   // DFU's walking pace on the calendar's clock (CLASSIC_MINUTES_PER_SECOND)

test('LW1 seeds: the port\'s one mix under the living world\'s salt (hash32), mulberry32 over it; a weighted pick reads the weights and nothing above zero answers null; a text seed is FNV-1a (mutants: the salt dropped, the weights unread)', () => {
  assert.equal(LW_SALT, 0x11fe);
  assert.equal(lwSeed(1, 2, 3), hash32(0x11fe, 1, 2, 3));
  const a = lwRng(5, 6), b = lwRng(5, 6);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  const rng = () => 0.99;
  assert.equal(pickWeighted(rng, { x: 1, y: 0, z: 3 }), 'z');
  assert.equal(pickWeighted(() => 0.1, { x: 1, y: 0, z: 3 }), 'x');
  assert.equal(pickWeighted(() => 0.5, { x: 0, y: -1 }), null);
  assert.equal(textSeed('a'), Math.imul(0x811c9dc5 ^ 97, 0x01000193) >>> 0);
});

test('LW1 census: the travellers a town keeps by its size and its port (merchants from two blocks, sellswords from nine, adventurers from four, sailors at a port, pilgrims from two, couriers from sixteen, a pedlar everywhere and one more each six blocks to six - LW3); the watch two to twelve in a town, one in a hamlet of two, none in one (mutants: each threshold and clamp)', () => {
  const rows = [[1, false], [2, false], [4, false], [8, false], [9, false], [16, true], [36, false], [64, true]].map(([blocks, port]) => [travellerCounts({ mapId: 1, blocks, port }), townWatchCount({ mapId: 1, blocks })]);
  assert.deepEqual(rows, [
    [{ merchant: 0, mercenary: 0, adventurer: 0, sailor: 0, pilgrim: 0, courier: 0, pedlar: 1 }, 0],
    [{ merchant: 1, mercenary: 0, adventurer: 0, sailor: 0, pilgrim: 1, courier: 0, pedlar: 1 }, 1],
    [{ merchant: 1, mercenary: 0, adventurer: 1, sailor: 0, pilgrim: 1, courier: 0, pedlar: 1 }, 2],
    [{ merchant: 2, mercenary: 0, adventurer: 1, sailor: 0, pilgrim: 1, courier: 0, pedlar: 2 }, 3],
    [{ merchant: 2, mercenary: 1, adventurer: 1, sailor: 0, pilgrim: 1, courier: 0, pedlar: 2 }, 3],
    [{ merchant: 3, mercenary: 2, adventurer: 2, sailor: 3, pilgrim: 2, courier: 1, pedlar: 3 }, 5],
    [{ merchant: 5, mercenary: 4, adventurer: 4, sailor: 0, pilgrim: 2, courier: 2, pedlar: 6 }, 10],
    [{ merchant: 5, mercenary: 6, adventurer: 6, sailor: 6, pilgrim: 2, courier: 2, pedlar: 6 }, 12],
  ]);
});

test('LW1 census: a resident is a DFU townsperson drawn once - the climate\'s people for the billboard, one of the four outfits of their sex, the talk portrait PERSON_FACE_RECORDS[race][sex][outfit] + 0..23, the region\'s name bank; the watch rides GUARD_TEXTURE, male, outfit 0; the armed carry their job\'s class; ids are the town\'s and the slot\'s; the same for every reader and DFRandom\'s stream put back as it stood (mutants: a re-roll per call, the guard\'s sex, the face law, the stream left moved)', () => {
  const town = { mapId: 777, blocks: 16, region: 17, people: 2, port: true };
  const roster = travellerRoster(town);
  assert.deepEqual(roster.map((r) => `${r.id}:${r.job}`), ['L777.t0:merchant', 'L777.t1:merchant', 'L777.t2:merchant', 'L777.t3:mercenary', 'L777.t4:mercenary',
    'L777.t5:adventurer', 'L777.t6:adventurer', 'L777.t7:sailor', 'L777.t8:sailor', 'L777.t9:sailor', 'L777.t10:pilgrim', 'L777.t11:pilgrim', 'L777.t12:courier',
    'L777.t13:pedlar', 'L777.t14:pedlar', 'L777.t15:pedlar']);
  assert.deepEqual(travellerRoster(town).map((r) => r.name), roster.map((r) => r.name), 'the same people for every reader');
  assert.notDeepEqual(travellerRoster({ ...town, mapId: 778 }).map((r) => r.name), roster.map((r) => r.name), 'another town, other people');
  for (const r of roster) {
    assert.equal(r.race, 'Redguard');
    const set = PERSON_TEXTURES.Redguard[r.sex];
    assert.equal(r.archive, set[r.variant], `${r.id}: the outfit is the variant's`);
    const base = PERSON_FACE_RECORDS.Redguard[r.sex][r.variant];
    assert.ok(r.face >= base && r.face < base + NUM_PERSON_FACE_VARIANTS, `${r.id}: the face law`);
    assert.equal(r.gender, r.sex === 'female' ? GENDERS.Female : GENDERS.Male);
    assert.match(r.name, /^\S+( \S+)?$/);
    if (r.job === 'adventurer') assert.ok(ADVENTURER_CLASSES.includes(r.cls));
    else if (r.job === 'mercenary') assert.ok(MERCENARY_CLASSES.includes(r.cls));
    else if (r.job === 'courier') assert.ok(COURIER_CLASSES.includes(r.cls));
    else assert.equal(r.cls, null);
  }
  const watch = watchRoster(town);
  assert.equal(watch.length, 5);
  for (const g of watch) {
    assert.equal(g.archive, GUARD_TEXTURE); assert.equal(g.guard, true); assert.equal(g.sex, 'male'); assert.equal(g.variant, 0);
    assert.match(g.id, /^L777\.w\d$/);
  }
  setSeed(424242);
  const before = getSeed();
  mintResident(town, 'h', 3, 'keeper');
  residentName(99, 1, GENDERS.Female);
  assert.equal(getSeed(), before, 'the global stream put back');
  assert.equal(rand(), (setSeed(424242), rand()), 'and the next draw is the one it would have been');
  assert.equal(raceOfPeople(0), 'Nord'); assert.equal(raceOfPeople(3), 'Breton'); assert.equal(raceOfPeople(undefined), 'Breton');
});

test('LW1 census: the households are the town\'s buildings - each house its family, each shop its keeper (a smith at the armourer and the weaponsmith, a clerk at the bank, a scholar at the library and the bookseller), the tavern its innkeeper and servers living there, the temple two priests living there, the guild hall two members, the palace two of its court living there; trades dealt to the houses\' people first; the rest the town\'s common work; never past CENSUS_MAX; the whole town gives the watch the palace and every traveller a house (mutants: a trade unminted, the tavern\'s staff housed elsewhere, the cap)', () => {
  const { buildings } = synthTown();
  const homes = buildings.filter((b) => isHome(b.type)).map((b) => b.key);
  const hh = householdCensus(TOWN, buildings);
  const byJob = (job) => hh.filter((r) => r.job === job);
  assert.equal(byJob('innkeeper').length, 1);
  assert.equal(byJob('innkeeper')[0].home, 1000); assert.equal(byJob('innkeeper')[0].work, 1000);
  assert.ok(byJob('server').every((r) => r.home === 1000 && r.work === 1000) && byJob('server').length >= 1);
  assert.deepEqual(byJob('priest').map((r) => [r.home, r.work]), [[1001, 1001], [1001, 1001]]);
  assert.equal(byJob('keeper').filter((r) => r.work === 1002).length, 1, 'the general store');
  assert.deepEqual(byJob('smith').map((r) => r.work).sort(), [1003, 1004], 'the armourer and the weaponsmith');
  assert.equal(byJob('clerk')[0].work, 1008);
  assert.equal(byJob('guildsman').length, 2);
  assert.deepEqual(byJob('courtier').map((r) => r.home), [1007, 1007]);
  for (const r of [...byJob('keeper'), ...byJob('smith'), ...byJob('clerk'), ...byJob('guildsman')]) assert.ok(homes.includes(r.home), `${r.id} lives in a house`);
  const common = hh.filter((r) => ['labourer', 'farmer', 'fisher', 'crafter', 'homemaker', 'beggar'].includes(r.job));
  assert.ok(common.length > 0 && common.every((r) => homes.includes(r.home) && r.work === null));
  assert.deepEqual(householdCensus(TOWN, buildings).map((r) => r.name), hh.map((r) => r.name), 'the same households for every reader');
  assert.ok(hh.every((r, i) => r.id === `L12345.${i}` && r.roll === 'h'));
  // the cap: a city of houses keeps the trades whole and trims the common hands
  const city = [];
  for (let k = 0; k < 400; k++) city.push({ key: 5000 + k, type: k < 3 ? BUILDING_TYPES.Tavern : BUILDING_TYPES.House1, quality: 15 });
  const big = householdCensus({ mapId: 9, blocks: 64 }, city);
  assert.equal(big.length, CENSUS_MAX);
  assert.equal(big.filter((r) => r.job === 'innkeeper').length, 3);
  const whole = townCensus(TOWN, buildings);
  const guards = whole.filter((r) => r.job === 'guard');
  assert.equal(guards.length, townWatchCount(TOWN));
  assert.ok(guards.every((g) => g.home === 1007), 'the watch at the palace');
  assert.ok(whole.filter((r) => r.roll === 't').every((r) => homes.includes(r.home) || r.home === 1000), 'a traveller in a house (an adventurer at the tavern)');
  assert.equal(hasShopJob(BUILDING_TYPES.Bank), true); assert.equal(hasShopJob(BUILDING_TYPES.Temple), false);
});

test('LW1 places: every door\'s cell is the street-net cell just before it (out along its normal, the other way where the normal faces in); social spots before the tavern, temple, guild hall and palace and the square; market spots before the shops; the square the most open net cell by the middle; an exit per side on the border (mutants: the normal never reversed, the net unread, the square\'s openness, an exit off the border)', () => {
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  assert.equal(places.doors.size, buildings.length);
  const { label, id } = streetNet(nav);
  for (const [key, spot] of places.doors) {
    const d = doors.find((x) => x.key === key);
    assert.equal(label[spot.cell[1] * nav.width + spot.cell[0]], id, `${key}: on the street net`);
    assert.ok(spot.z < d.z && Math.abs(spot.x - d.x) < NAV_CELL, `${key}: before the door, outside`);
    assert.equal(spot.kind, 'door'); assert.equal(spot.building, key);
  }
  const flipped = townPlaces(nav, synthTown({ flipNormals: true }).doors, buildings);
  assert.deepEqual([...flipped.doors.values()].map((s) => s.cell), [...places.doors.values()].map((s) => s.cell), 'a normal facing in finds the same cell');
  assert.deepEqual(flipped.social.map((s) => s.cell), places.social.map((s) => s.cell), 'and its spots stand out before it, not in the building');
  assert.deepEqual(flipped.market.map((s) => s.cell), places.market.map((s) => s.cell));
  assert.deepEqual(places.social.map((s) => s.key), ['sq', 's1000', 's1001', 's1006', 's1007']);
  assert.deepEqual(places.market.map((s) => s.key), ['m1002', 'm1003', 'm1004', 'm1005', 'm1008']);
  const tavernDoor = places.doors.get(1000), tavernSpot = places.social[1];
  assert.equal(Math.round((tavernDoor.z - tavernSpot.z) / NAV_CELL), 4, 'four cells before the tavern');
  assert.equal(Math.round((places.doors.get(1002).z - places.market[0].z) / NAV_CELL), 2, 'two before the shop');
  assert.deepEqual([SOCIAL_OUT, MARKET_OUT], [4, 2]);
  assert.deepEqual(places.square.cell, [96, 96], 'the crossing of the middle streets');
  // the square is the most OPEN ground near the middle, not the middle itself: a plaza cleared off-centre wins
  const tight = new CityNavigation(3, 3);
  const TW = tight.width;
  const open = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tight.grid[y * TW + x] = (15 << 4); };
  open(95, 97, 0, 191); open(0, 191, 95, 97);   // two narrow streets crossing at the middle
  open(120, 131, 60, 71); open(125, 127, 71, 95);   // a plaza off the middle, a lane to it
  const pp = townPlaces(tight, [], []);
  assert.ok(pp.square.cell[0] >= 123 && pp.square.cell[0] <= 128 && pp.square.cell[1] >= 63 && pp.square.cell[1] <= 68, `the plaza, not the crossing (${pp.square.cell})`);
  assert.deepEqual(places.exits.map((e) => [e.key, e.cell]), [['xn', [96, 191]], ['xs', [96, 0]], ['xe', [191, 96]], ['xw', [0, 96]]]);
  assert.equal(exitToward(places, Math.PI / 2).key, 'xe');
  assert.equal(exitToward(places, 0.1).key, 'xn');
  assert.equal(exitNearest(places, [10, 90]).key, 'xw');
});

test('LW1 town ways: the grid\'s A* keeps to the streets (a road step costs 1, grass 1.3, stone 2.1), steps four ways as DFU\'s walkers do, answers null where no way runs, and the same path every time; the walked line keeps the turns, its length the sum of its legs; a point along it faces its leg (mutants: the cost unread, a diagonal step, the turn kept wrong)', () => {
  assert.equal(stepCost(15), 1); assert.equal(stepCost(12), 1.3); assert.equal(stepCost(4), 2.1);
  const nav = new CityNavigation(1, 1);
  const W = nav.width;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) nav.grid[y * W + x] = (12 << 4);
  // a road along y=10 and up x=40: the way from (0,10) to (40,30) takes it rather than the grass diagonal
  for (let x = 0; x <= 40; x++) nav.grid[10 * W + x] = (15 << 4);
  for (let y = 10; y <= 30; y++) nav.grid[y * W + 40] = (15 << 4);
  const cells = findTownPath(nav, [0, 10], [40, 30]);
  assert.equal(cells.length, 61);
  for (let i = 1; i < cells.length; i++) assert.equal(Math.abs(cells[i][0] - cells[i - 1][0]) + Math.abs(cells[i][1] - cells[i - 1][1]), 1, 'four ways');
  assert.ok(cells.every(([x, y]) => y === 10 || x === 40), 'on the road the whole way');
  assert.deepEqual(findTownPath(nav, [0, 10], [40, 30]), cells, 'the same answer');
  const line = pathLine(cells);
  const P = (gx, gy) => [gx * NAV_CELL + HALF_CELL, gy * NAV_CELL + HALF_CELL];
  assert.deepEqual(line.pts, [P(0, 10), P(40, 10), P(40, 30)]);
  assert.equal(line.pts.length, 3, 'start, the one turn, the end');
  assert.ok(Math.abs(line.len - 60 * NAV_CELL) < 1e-9);
  const mid = pointOnLine(line, 40 * NAV_CELL + 5);
  assert.ok(Math.abs(mid.x - (40 * NAV_CELL + HALF_CELL)) < 1e-9 && Math.abs(mid.yaw) < 1e-9, 'up the second leg, facing +z');
  const first = pointOnLine(line, 3);
  assert.ok(Math.abs(first.yaw - Math.PI / 2) < 1e-9, 'along the first, facing +x');
  // a wall across the grid: no way
  for (let y = 0; y < 64; y++) nav.grid[y * W + 50] = 0;
  assert.equal(findTownPath(nav, [45, 5], [55, 5]), null);
  assert.equal(findTownPath(nav, [50, 5], [55, 5]), null, 'an end on no ground');
  const book = createPathBook(nav);
  book.budget(1);
  assert.ok(book.want([0, 10], [40, 30]));
  assert.equal(book.want([0, 0], [10, 0]), undefined, 'the frame\'s searches spent');
  assert.ok(book.get([0, 10], [40, 30]), 'kept');
});

test('LW1 the day turns at 04:00 (DAY_START_MIN) and runs 1440 minutes (mutants: the turn moved)', () => {
  assert.deepEqual([DAY_START_MIN, DAY_MIN], [240, 1440]);
});

test('LW1 the day: every resident\'s day covers 04:00 to 04:00 once, entry to entry; a walk leaves from where they were and a stay is reached by a walk; the keeper keeps the shop 08:00-18:00, the innkeeper serves at the tavern from 11:00 to bed, the farmer is in the fields 06:00-17:00, the watch walks its beat by shift ((slot + day) mod 3) and only the beat is outdoors; the same day for every reader (mutants: a gap, a jump, the keeper\'s hours, the farmer\'s fields indoors, the shift law)', () => {
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus(TOWN, buildings);
  for (const r of census) {
    for (const day of [100, 101, 102]) {
      const plan = dayPlan(r, places, day, { mpm: MPM });
      const D0 = day * DAY_MIN + DAY_START_MIN;
      assert.equal(plan[0].t0, D0, `${r.id} ${day}: from 04:00`);
      assert.equal(plan[plan.length - 1].t1, D0 + DAY_MIN, `${r.id} ${day}: to 04:00`);
      for (let i = 1; i < plan.length; i++) {
        assert.equal(plan[i].t0, plan[i - 1].t1, `${r.id} ${day}: contiguous at ${i}`);
        if (plan[i].kind === 'walk') assert.equal(plan[i].from, plan[i - 1].at, `${r.id} ${day}: the walk leaves from where they were`);
        else if (plan[i - 1].kind !== 'walk') assert.equal(plan[i].at, plan[i - 1].at, `${r.id} ${day}: no stay changes place without a walk`);
      }
      assert.ok(plan.every((e) => e.t1 > e.t0));
    }
  }
  const one = (job) => census.find((r) => r.job === job);
  const keeper = census.find((r) => r.job === 'keeper' && r.work === 1002);
  const kp = dayPlan(keeper, places, 100, { mpm: MPM });
  const D = 100 * DAY_MIN;
  assert.ok(kp.some((e) => e.kind === 'work' && e.at === places.doors.get(1002) && e.t0 === D + 8 * 60), 'opens at eight');
  assert.ok(kp.some((e) => e.kind === 'work' && e.t1 === D + 18 * 60), 'shuts at six');
  // every shop's people shut at six, whatever their lunch - and some days a late lunch is what six cuts short
  let bound = 0;
  for (const r of census.filter((x) => ['keeper', 'smith', 'clerk', 'scholar', 'helper', 'guildsman'].includes(x.job))) {
    for (let d = 100; d < 120; d++) {
      const plan = dayPlan(r, places, d, { mpm: MPM });
      const works = plan.filter((e) => e.kind === 'work');
      for (const e of works) assert.ok(e.t1 <= d * DAY_MIN + 18 * 60, `${r.id} ${d}: shut by six`);
      const last = works[works.length - 1];
      if (last && last.t1 === d * DAY_MIN + 18 * 60 && last.t1 - last.t0 < 330) bound++;
    }
  }
  assert.ok(bound > 0, 'the six o\'clock close binds on a late-lunch day');
  let opensAtEleven = 0;
  for (let d = 100; d < 120; d++) {
    const ip = dayPlan(one('innkeeper'), places, d, { mpm: MPM });
    const sv = ip.find((e) => e.kind === 'work');
    assert.ok(sv.t0 >= d * DAY_MIN + 11 * 60, `${d}: never serving before eleven`);
    if (!ip.some((e) => e.kind === 'market')) { assert.equal(sv.t0, d * DAY_MIN + 11 * 60, `${d}: no errand, serving at eleven`); opensAtEleven++; }
  }
  assert.ok(opensAtEleven > 0);
  const inn = dayPlan(one('innkeeper'), places, 100, { mpm: MPM });
  const serving = inn.find((e) => e.kind === 'work');
  assert.ok(serving.t0 >= D + 11 * 60 && serving.t0 <= D + 12 * 60, 'serves from eleven (after a morning\'s errand, as soon as they are back)');
  assert.equal(serving.at, places.doors.get(1000));
  assert.equal(inn[inn.indexOf(serving) + 1].kind, 'sleep', 'serves till bed');
  const fp = dayPlan(one('farmer'), places, 100, { mpm: MPM });
  const fields = fp.find((e) => e.kind === 'fields');
  assert.deepEqual([fields.t0 - D, fields.at.kind, isOutdoor(fields)], [6 * 60, 'exit', false], 'in the fields at six, out of town, unseen');
  assert.ok(fields.t1 - D >= 17 * 60 && fields.t1 - D < 18 * 60, 'till five (and the walk to the evening\'s spot after)');
  for (const g of census.filter((r) => r.job === 'guard')) {
    for (const day of [100, 101, 102]) {
      const gp = dayPlan(g, places, day, { mpm: MPM });
      const watches = gp.filter((e) => e.kind === 'watch');
      const shift = (g.slot + day) % 3;
      if (shift === 2) { assert.equal(watches.length, 0, 'a rest day'); continue; }
      assert.ok(watches.length >= 3, 'the beat walked');
      const [from, until] = shift === 0 ? [6 * 60, 16 * 60] : [14 * 60, 24 * 60];
      assert.ok(watches[0].t0 >= day * DAY_MIN + from && watches[watches.length - 1].t1 <= day * DAY_MIN + until, 'within the shift');
      const beat = guardBeat(g, places, day);
      assert.ok(watches.every((w) => beat.includes(w.at)));
    }
  }
  assert.deepEqual(dayPlan(keeper, places, 100, { mpm: MPM }).map((e) => [e.kind, e.t0, e.t1]), kp.map((e) => [e.kind, e.t0, e.t1]), 'the same day for every reader');
  assert.equal(entryAt(kp, D + 9 * 60), kp.findIndex((e) => e.kind === 'work'));
  assert.equal(entryAt(kp, D + DAY_START_MIN - 1), -1, 'before the day');
});

test('LW1 the day: a walk takes the grid\'s Manhattan distance times WALK_DETOUR and WALK_EXTRA_M at the pace, at least a minute and none in place; a long gap is spent at home; an away window bends the day - geared at home GEAR_MIN, walked out armed to arrive as it opens, away, walked home armed as it closes (mutants: the detour, the extra, the gap rule, the gear, the armed walks)', () => {
  const a = { cell: [0, 0] }, b = { cell: [30, 40] };
  assert.equal(walkMinutes(a, b, MPM), Math.ceil((70 * NAV_CELL * WALK_DETOUR + WALK_EXTRA_M) / MPM));
  assert.equal(walkMinutes(a, { cell: [0, 0] }, MPM), 0);
  assert.equal(walkMinutes(a, { cell: [1, 0] }, 100), 1);
  assert.deepEqual([WALK_DETOUR, WALK_EXTRA_M, MIN_STAY, GEAR_MIN, HOME_GAP], [1.2, 2, 8, 30, 30]);
  const home = { key: 'h', kind: 'door', cell: [0, 0], x: 0, z: 0, yaw: 0 };
  const shop = { key: 's', kind: 'door', cell: [20, 0], x: 32, z: 0, yaw: 0 };
  const square = { key: 'q', kind: 'square', cell: [10, 0], x: 16, z: 0, yaw: 0 };
  const exit = { key: 'x', kind: 'exit', cell: [0, 60], x: 0, z: 96, yaw: 0 };
  const D0 = 240, D1 = D0 + DAY_MIN;
  const plan = schedule([{ kind: 'shop', at: shop, from: 9 * 60, dur: 20 }, { kind: 'social', at: square, from: 15 * 60, dur: 30 }],
    { D0, D1, wake: 6 * 60, bed: 22 * 60, home, mpm: MPM, away: [] });
  const kinds = plan.map((e) => e.kind);
  assert.deepEqual(kinds, ['sleep', 'home', 'walk', 'shop', 'walk', 'home', 'walk', 'social', 'walk', 'home', 'sleep'], 'home between the shop and the square');
  const away = schedule([], { D0, D1, wake: 6 * 60, bed: 22 * 60, home, mpm: MPM, away: [{ t0: 10 * 60, t1: 16 * 60, exit, armed: true }] });
  const walkOut = walkMinutes(home, exit, MPM);
  assert.deepEqual(away.map((e) => [e.kind, e.t0, e.t1, !!e.armed]), [
    ['sleep', D0, 6 * 60, false], ['home', 6 * 60, 10 * 60 - walkOut - GEAR_MIN, false], ['gear', 10 * 60 - walkOut - GEAR_MIN, 10 * 60 - walkOut, false],
    ['walk', 10 * 60 - walkOut, 10 * 60, true], ['away', 10 * 60, 16 * 60, true], ['walk', 16 * 60, 16 * 60 + walkOut, true],
    ['home', 16 * 60 + walkOut, 22 * 60, false], ['sleep', 22 * 60, D1, false],
  ]);
  const whole = schedule([], { D0, D1, wake: 6 * 60, bed: 22 * 60, home, mpm: MPM, away: [{ t0: 0, t1: D1 + 500, exit, armed: false }] });
  assert.deepEqual(whole.map((e) => [e.kind, e.t0, e.t1]), [['away', D0, D1]], 'a day on the road');
});

test('LW1 favourites: a resident keeps to the same two social spots, tavern, temple and market every day (their seed alone), the nearer ones first (mutants: a daily re-draw)', () => {
  const { nav, buildings, doors } = synthTown();
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus(TOWN, buildings);
  const keys = (rs, pl = places) => rs.map((x) => { const f = favourites(x, pl, pl.doors.get(x.home)); return [...f.social.map((s) => s.key), f.market?.key, f.tavern?.key].join(','); });
  // A second reader's own places: LW-PERF keeps the favourites by the town's places, so a second reading off the SAME
  // places is the kept one and could not fail a daily re-draw (the mutant survived it); a reader who builds the town
  // afresh works them out again, and must find the same.
  assert.deepEqual(keys(census.slice(0, 40), townPlaces(nav, doors, buildings)), keys(census.slice(0, 40)), 'the seed\'s alone - the same for every reader');
  const r = census[20];
  const home = places.doors.get(r.home);
  const f1 = favourites(r, places, home);
  assert.equal(f1.tavern, places.doors.get(1000));
  assert.equal(f1.temple, places.doors.get(1001));
  assert.ok(f1.social.length >= 1 && f1.social.every((s) => places.social.includes(s)));
});

test('LW1 meetings: the residents at a spot for the WHOLE of a round pair off in an order drawn from the spot, the round and their ids - two by two, the odd three together, one alone none; a circle talks TALK_SHARE of rounds; its script a line every CREW_LINE_S of the clock from the round\'s start, the first member first, each in turn, then quiet; the circles stand about the spot, CIRCLE_APART apart, facing in (mutants: a late arrival counted, the trio, the beat, the speaker\'s turn)', () => {
  const who = (i, job = 'keeper') => ({ id: `L1.${i}`, name: `Name${i} Sur`, job });
  const roundMin = ROUND_S * 0.2;
  const t = 1000 * roundMin + 1;
  const start = 1000 * roundMin, end = start + roundMin;
  const present = [0, 1, 2, 3, 4].map((i) => ({ who: who(i), t0: start - 5, t1: end + 2 * roundMin }));
  present.push({ who: who(9), t0: start + 1, t1: end + 2 * roundMin });   // came mid-round: waits for the next
  const circles = spotCircles('sq', present, t, roundMin);
  assert.deepEqual(circles.map((c) => c.members.length), [2, 3]);
  assert.ok(circles.every((c) => c.members.every((m) => m.id !== 'L1.9')));
  assert.deepEqual(spotCircles('sq', present, t, roundMin).map((c) => c.members.map((m) => m.id)), circles.map((c) => c.members.map((m) => m.id)), 'the same circles for every reader');
  assert.deepEqual(spotCircles('sq', present.slice(0, 1), t, roundMin), [], 'one alone keeps their own counsel');
  const next = spotCircles('sq', present, t + roundMin, roundMin);
  assert.equal(next.flatMap((c) => c.members).length, 6, 'the late one joins the next round');
  assert.equal(TALK_SHARE, 0.7);
  const talking = circles.find((c) => c.talks) ?? { ...circles[0], talks: true };
  const lineMin = lineMinutes(0.2);
  assert.equal(lineMin, CREW_LINE_S * 0.2);
  const l0 = circleLine(talking, talking.start, lineMin, {});
  const l1 = circleLine(talking, talking.start + lineMin, lineMin, {});
  assert.equal(l0.who, talking.members[0]); assert.equal(l0.index, 0);
  assert.equal(l1.who, talking.members[1]); assert.equal(l1.index, 1);
  const script = pickScript(talking.seed, { jobs: talking.members.map((m) => m.job), hour: 12 });
  assert.equal(circleLine(talking, talking.start + lineMin * script.length + 1e-6, lineMin, {}), null, 'quiet after its last line');
  assert.ok(circleLine(talking, talking.start + lineMin * script.length - 1e-6, lineMin, {}), 'the last line still said');
  assert.equal(circleLine({ ...talking, talks: false }, talking.start, lineMin, {}), null);
  const stands = circleStands({ x: 10, z: 20 }, circles[0]);
  assert.ok(Math.abs(Math.hypot(stands[0].x - stands[1].x, stands[0].z - stands[1].z) - CIRCLE_APART) < 1e-9);
  const cx = (stands[0].x + stands[1].x) / 2, cz = (stands[0].z + stands[1].z) / 2;
  for (const s of stands) assert.ok(Math.abs(Math.atan2(cx - s.x, cz - s.z) - s.yaw) < 1e-9, 'facing in');
  const alone = aloneStand({ x: 0, z: 0 }, 'L1.5');
  assert.deepEqual(aloneStand({ x: 0, z: 0 }, 'L1.5'), alone);
  assert.ok(Math.hypot(alone.x, alone.z) >= 1 && Math.hypot(alone.x, alone.z) <= 3.5);
});

test('LW1 lines: a token is filled from where and when it is said and a missing one takes its fallback, never a brace; the script is a seeded draw over the pools that fit (a trade\'s, the weather\'s, the evening\'s); greetings by regard (mutants: the fallback dropped, a trade\'s pool unread)', () => {
  assert.equal(fillLine('Morning, {b}. {town} is quiet.', { b: 'Ulf', town: 'Ilessan' }), 'Morning, Ulf. Ilessan is quiet.');
  assert.equal(fillLine('In {place} and {region}, {nobody}.', {}), `In ${TOKEN_FALLBACK.place} and ${TOKEN_FALLBACK.region}, .`);
  assert.doesNotMatch(fillLine('{player}', {}), /[{}]/);
  assert.equal(firstNameOf('Barbayne Woodsmith'), 'Barbayne');
  const all = new Set();
  for (let s = 0; s < 400; s++) all.add(pickScript(s, { jobs: ['smith'] }));
  assert.ok(JOB_TALKS.smith.every((sc) => all.has(sc)), 'the smith\'s talk is drawn');
  assert.ok([...all].some((sc) => TOWN_TALKS.includes(sc)), 'and the town\'s');
  assert.deepEqual(pickScript(7, { jobs: ['farmer'], weather: 'rain', hour: 19 }), pickScript(7, { jobs: ['farmer'], weather: 'rain', hour: 19 }));
  for (const k of ['friend', 'known', 'stranger', 'enemy']) assert.ok(LIVING_GREETINGS[k].length >= 4);
  assert.ok(LIVING_GREETINGS.friend.every((g) => g.includes('{player}') || !g.includes('{')), 'a friend may call you by name');
});

test('LW1 regards: a stranger reads 0; a word counts once a day, a blow and a crime cost, help and a life saved earn; friend at FRIEND_AT, enemy at ENEMY_AT, hostile at HOSTILE_AT; a regard eases toward zero EASE_PER_DAY a day unseen and never across it; the save\'s record round-trips and a bad one reads as nobody known; the vendor is LivingWorld (mutants: talk counted twice, the ease crossing zero, a bad record kept)', () => {
  assert.equal(LIVING_WORLD_VENDOR, 'LivingWorld');
  assert.deepEqual([FRIEND_AT, ENEMY_AT, HOSTILE_AT, EASE_PER_DAY], [40, -40, -70, 0.5]);
  assert.deepEqual(EVENTS, { talk: 3, polite: 1, gift: 8, helped: 20, saved: 35, struck: -45, crime: -15, slain: -75, insulted: -6 });   // LW7: one of their own slain turns them hostile
  const rel = createRelations();
  assert.equal(rel.regard('L1.0', 10), 0);
  assert.equal(rel.known('L1.0'), false);
  assert.equal(rel.note('L1.0', 'talk', 10), 3);
  assert.equal(rel.note('L1.0', 'talk', 10), 3, 'once a day');
  assert.equal(rel.note('L1.0', 'talk', 11), 3 - EASE_PER_DAY + 3, 'a day apart eased, then the day\'s word');
  rel.note('L1.0', 'saved', 11);
  assert.equal(rel.standing('L1.0', 11), 'friend');
  assert.equal(rel.regard('L1.0', 31), 40.5 - 20 * EASE_PER_DAY);
  assert.equal(rel.regard('L1.0', 500), 0, 'eased to nothing, never across');
  rel.note('L1.1', 'struck', 5);
  assert.equal(rel.standing('L1.1', 5), 'enemy');
  rel.note('L1.1', 'crime', 5);
  assert.equal(rel.standing('L1.1', 5), 'enemy');
  rel.note('L1.1', 'slain', 5);
  assert.equal(rel.standing('L1.1', 5), 'hostile');
  assert.equal(rel.regard('L1.1', 5), -100, 'clamped');
  assert.deepEqual([regardStanding(40), regardStanding(39.9), regardStanding(-40), regardStanding(-70)], ['friend', 'neutral', 'enemy', 'hostile']);
  const back = createRelations(JSON.parse(JSON.stringify(rel.snapshot())));
  assert.equal(back.regard('L1.0', 11), rel.regard('L1.0', 11));
  assert.equal(back.regard('L1.1', 5), -100);
  assert.equal(back.note('L1.0', 'talk', 11), rel.regard('L1.0', 11), 'the day\'s word already counted');
  assert.equal(createRelations({ v: 2, people: { a: { r: 50 } } }).size(), 0);
  assert.equal(createRelations({ v: 1, people: { a: { r: 'x' }, b: null } }).size(), 0);
  const many = createRelations();
  for (let i = 0; i < RELATIONS_MAX + 20; i++) many.note(`L1.${i}`, 'talk', i);
  assert.equal(many.size(), RELATIONS_MAX);
});
