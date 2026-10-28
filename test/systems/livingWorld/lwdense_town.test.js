// LW-DENSE and LW-WIDE (2026-10-28, bible/06-Systems/Living-World.md "LW-DENSE", 06-Systems/Living-World-II.md "LW-WIDE";
// the owner: "Depending on the size of the city, the living world should be more dense", "Living world NPCs should be
// more dense in the entire world, more travellers, more dungeon divers"). THE CENSUS AND THE STREET BY THE TOWN'S SIZE:
// a town's people were trimmed at CENSUS_MAX whatever its size and its street held DFU's 24-96, so a city of 42 blocks
// kept six people a block and a village seventeen. THE ROAD'S FOURTH RANK: more travellers and the divers, appended
// after the first three ranks so every saved id stands. The towns and the map are the synthetic ones (test/lwTown.mjs,
// test/lwRoads.mjs); the game's own where ARENA2_PATH names the data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from '../../lwTown.mjs';
import { synthMap, livingMap } from '../../lwRoads.mjs';
import { skipReal, hostTown, townsOf, LOCATION_TYPES } from '../../lwRealTown.mjs';
import {
  CENSUS_MAX, CENSUS_PER_BLOCK, CENSUS_CAP, CROWD_FROM_BLOCKS, CROWD_MAX, censusMaxOf, crowdOf, householdCensus, townCensus,
  travellerRoster, travellerCounts, roadCounts, moreCounts, wideCounts, WIDE_JOBS, TRAVELLER_JOBS, ROAD_JOBS, MORE_JOBS, isWidePlace, isHome,
} from '../../../src/systems/livingWorld/census.js';
import { LivingTown, livingStreetCap, STREET_PER_BLOCK, STREET_MAX, walkNear } from '../../../src/systems/livingWorld/livingTown.js';
import { townPlaces } from '../../../src/systems/livingWorld/places.js';
import { maxPopulationFor } from '../../../src/systems/town/townPopulation.js';
import { companiesOf, companyOfPlace, COMPANY_DIVE_CHANCE } from '../../../src/systems/livingWorld/companies.js';
import { ownTrip, townTrips, partiesNear, CALENDAR_MPM, DIVE_CHANCE, WIDE_DIVE_CHANCE } from '../../../src/systems/livingWorld/trips.js';
import { lwRng } from '../../../src/systems/livingWorld/seed.js';
import { LIVING_ID_RE } from '../../../src/net/wire.js';
import { ResidentWalker } from '../../../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../../../src/characters/mobile/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../../../src/systems/worldTick.js';
import { DAY_MIN, favourites } from '../../../src/systems/livingWorld/dayPlan.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const O = () => ({ mpm: CALENDAR_MPM, memo: new Map() });
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const houses = (n, from = 5000) => Array.from({ length: n }, (_, k) => ({ key: from + k, type: k < 2 ? BUILDING_TYPES.Tavern : BUILDING_TYPES.House1, quality: 15 }));

test('LW-DENSE the census by the town\'s size: CENSUS_PER_BLOCK a block of its grid, never under CENSUS_MAX nor over CENSUS_CAP; from CROWD_FROM_BLOCKS its houses fuller, crowdOf more each to CROWD_MAX (mutants: the per block, the floor, the cap, the crowd\'s start, its rise, its top)', () => {
  assert.deepEqual([CENSUS_MAX, CENSUS_PER_BLOCK, CENSUS_CAP, CROWD_FROM_BLOCKS, CROWD_MAX], [260, 10, 520, 16, 2]);
  const sizes = [1, 4, 9, 16, 26, 36, 42, 52, 64, 100];
  assert.deepEqual(sizes.map((blocks) => censusMaxOf({ mapId: 1, blocks })), [260, 260, 260, 260, 260, 360, 420, 520, 520, 520]);
  assert.deepEqual(sizes.map((blocks) => crowdOf({ mapId: 1, blocks })), [0, 0, 0, 0, 0.625, 1.25, 1.625, 2, 2, 2]);
  assert.equal(crowdOf({ mapId: 1, blocks: 15 }), 0, 'under sixteen blocks: as it was');
});

test('LW-DENSE the crowd: a city\'s houses hold their crowdOf share more of the town\'s common work, homed there, minted after everyone the town kept before as households (\'h\', their slots after) - every id before them unchanged, every id the wire\'s; a town under sixteen blocks as it was, to the person (mutants: the crowd unminted, its homes, its jobs, the ids moved, the cap)', () => {
  const city = houses(160);
  const small = householdCensus({ mapId: 9, blocks: 16 }, city);   // the common work's weights a city's from sixteen blocks
  const big = householdCensus({ mapId: 9, blocks: 42 }, city);
  assert.equal(small.length, CENSUS_MAX, 'a town of sixteen blocks: CENSUS_MAX, as before');
  assert.deepEqual(big.slice(0, small.length).map((r) => [r.id, r.name, r.job, r.home]), small.map((r) => [r.id, r.name, r.job, r.home]), 'every one of the first CENSUS_MAX as they were');
  assert.equal(big.length, censusMaxOf({ mapId: 9, blocks: 42 }), 'to the city\'s own cap');
  assert.ok(big.every((r, i) => r.id === `L9.${i}` && r.roll === 'h' && LIVING_ID_RE.test(r.id)), 'households, the wire\'s ids');
  const homes = new Set(city.filter((b) => isHome(b.type)).map((b) => b.key));
  const crowdJobs = new Set(['labourer', 'farmer', 'fisher', 'crafter', 'homemaker', 'beggar']);
  assert.ok(big.slice(small.length).every((r) => homes.has(r.home) && r.work === null && crowdJobs.has(r.job)), 'the crowd: at a house, at the common work');
  // a city whose houses leave room under its cap: each house about its crowdOf share more
  const fewer = houses(60, 7000);
  const plain = householdCensus({ mapId: 11, blocks: 15 }, fewer), full = householdCensus({ mapId: 11, blocks: 32 }, fewer);
  const extra = full.length - plain.length, per = extra / (fewer.length - 2);
  assert.ok(Math.abs(per - crowdOf({ mapId: 11, blocks: 32 })) < 0.25, `the crowd ${per.toFixed(2)} a house (crowdOf ${crowdOf({ mapId: 11, blocks: 32 })})`);
  assert.deepEqual(full.slice(0, plain.length).map((r) => r.id), plain.map((r) => r.id));
  assert.deepEqual(householdCensus({ mapId: 11, blocks: 32 }, fewer).map((r) => r.name), full.map((r) => r.name), 'the same for every reader');
  // the town whole: the watch and the travellers after the households, as before
  const whole = townCensus({ mapId: 11, blocks: 32 }, fewer);
  assert.ok(whole.slice(full.length).every((r) => r.roll === 'w' || r.roll === 't'));
});

test('LW-DENSE the street by the town\'s size: DFU\'s own cap under sixteen blocks; from there STREET_PER_BLOCK a block to STREET_MAX, never under DFU\'s (mutants: the per block, the top, the start)', () => {
  assert.deepEqual([STREET_PER_BLOCK, STREET_MAX], [3, 160]);
  const sizes = [1, 4, 9, 12, 15, 16, 32, 42, 49, 64, 100];
  assert.deepEqual(sizes.map(livingStreetCap), [24, 24, 24, 24, 24, 48, 96, 126, 147, 160, 160]);
  for (const b of sizes) assert.ok(livingStreetCap(b) >= maxPopulationFor(b), `${b}: never under DFU's`);
  const fx = synthTown({ blocksW: 8, blocksH: 8 });
  const lt = new LivingTown(fx.nav, { town: { mapId: 4242, blocks: 64, region: 17, people: 3, port: false }, buildings: fx.buildings, doors: fx.doors,
    makePerson: (archive, guard) => new ResidentWalker(fx.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => 100 * DAY_MIN + 600, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE });
  assert.equal(lt.maxPopulation, 160, 'the town\'s street holds it');
});

/** How soon (s) every resident out of doors within 70 m of a player standing still is on the street (LW-PERF's measure). */
function fillOf(blocks, hour, upTo = 3) {
  const make = () => {
    const { nav, buildings, doors } = synthTown({ blocksW: blocks, blocksH: blocks });
    const clock = { t: 100 * DAY_MIN + hour * 60 };
    const town = new LivingTown(nav, { town: { mapId: 12345, blocks: blocks * blocks, region: 17, people: 3, port: false }, buildings, doors,
      makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }), clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE });
    return { town, clock };
  };
  const live = make(), truth = make(), at = [blocks * 24 * 1.6 * 0.4, 0, blocks * 24 * 1.6 * 0.4];
  for (let i = 0; i < 30 * upTo; i++) {
    live.clock.t += RATE / 30;
    live.town.update(1 / 30, at, 0, at, true);
    if (i % 15 !== 14) continue;
    const t = live.clock.t, rows = new Set(live.town.pool.filter((r) => r.active && r.res).map((r) => r.res.id));
    truth.clock.t = t;
    const near = truth.town.peopleOf(truth.town.dayOf(t)).filter((res) => { const w = truth.town.where(res, t, true); return w && Math.hypot(w.x - at[0], w.z - at[2]) < 70; });
    if (near.length && near.every((res) => rows.has(res.id))) return (i + 1) / 30;
  }
  return Infinity;
}

test('LW-DENSE the street fills near first: a walk not searched yet is asked by where it would have one, walked straight (`walkNear`), the nearest first, and one within sight with the street\'s own - the great city\'s street of 160 kept its near ones waiting five seconds behind its far ones; LW-PERF\'s 2.5 s held (mutants: the order by the box, the near asked after the street\'s)', () => {
  const e = { from: { x: 0, z: 0 }, to: { x: 100, z: 0 }, t0: 10, t1: 20 };
  assert.equal(walkNear(e, 15, [50, 0, 30]), 30, 'halfway along');
  assert.equal(walkNear(e, 5, [0, 0, 40]), 40, 'not yet set out');
  assert.equal(walkNear(e, 25, [100, 0, 0]), 0, 'arrived');
  const great = fillOf(8, 8.5), city = fillOf(6, 8.5);
  assert.ok(great <= 1.5, `the great city's near ones on its street in ${great} s`);
  assert.ok(city <= 2.5, `a city's in ${city} s`);
});

test('LW-DENSE the favourites\' nearness kept by the home: each one\'s shops by manhattan nearness to their home, the key\'s order a tie, as a fresh sort - kept, the same list for a household, and never changed (mutants: kept by the list alone)', () => {
  const { nav, buildings, doors } = synthTown({ blocksW: 6, blocksH: 6 });
  const places = townPlaces(nav, doors, buildings);
  const census = townCensus({ mapId: 4343, blocks: 36, region: 17, people: 3, port: false }, buildings);
  const d = (s, h) => Math.abs(s.cell[0] - h.cell[0]) + Math.abs(s.cell[1] - h.cell[1]);
  const homes = new Map();
  let read = 0;
  for (const res of census.filter((r) => r.roll === 'h')) {
    const home = places.doors.get(res.home) ?? null;
    if (!home) continue;
    const { shops } = favourites(res, places, home);
    assert.ok(Object.isFrozen(shops), 'never changed');
    for (let i = 1; i < shops.length; i++) assert.ok(d(shops[i - 1], home) <= d(shops[i], home), `${res.id}: nearest first`);
    if (homes.has(home)) assert.equal(shops, homes.get(home), 'a household\'s one list');
    homes.set(home, shops);
    read++;
  }
  assert.ok(read > 100 && homes.size > 20, `${read} residents, ${homes.size} homes`);
});

test('LW-DENSE the game\'s own towns (ARENA2): a city keeps more people the bigger it is and its street holds more of them - Ripmarket\'s square of a morning past the 48 DFU\'s cap held; a village as it was (mutants: the cap unread on the street)', { skip: skipReal }, () => {
  const all = townsOf([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownVillage]);
  const at = (name, hour) => {
    const h = hostTown(/** @type {any} */ (all.find((l) => l.name === name)));
    const clock = { t: 120 * DAY_MIN + hour * 60 };
    const lt = new LivingTown(h.nav, { town: h.town, buildings: h.buildings, doors: h.doors,
      makePerson: (archive, guard) => new ResidentWalker(h.nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
      clock: () => clock.t, rate: () => RATE, mpm: PERSON_MOVE_SPEED / RATE });
    const sq = lt.places.square, p = [sq?.x ?? 0, 0, sq?.z ?? 0];
    let n = 0, frames = 0;
    for (let i = 0; i < 20 * 30; i++) { clock.t += RATE / 30; const seats = lt.update(1 / 30, p, 0, p, true); if (i >= 10 * 30) { n += seats.length; frames++; } }
    return { blocks: h.town.blocks, census: lt.residents.length, street: n / frames, cap: lt.maxPopulation };
  };
  const rip = at('Ripmarket', 10);
  assert.ok(rip.blocks >= 36 && rip.census > 400 && rip.street > 80 && rip.cap > maxPopulationFor(rip.blocks), `Ripmarket ${JSON.stringify(rip)}`);
  const village = all.find((l) => l.mapTableData.locationType === LOCATION_TYPES.TownVillage && l.exterior.exteriorData.width * l.exterior.exteriorData.height === 4);
  const v = at(/** @type {any} */ (village).name, 10);
  assert.ok(v.census <= CENSUS_MAX + 40 && v.cap === maxPopulationFor(v.blocks), `a village as it was ${JSON.stringify(v)}`);
});

test('LW-WIDE the fourth rank: WIDE_JOBS after MORE_JOBS - more divers, pedlars, pilgrims, couriers and the country\'s hunters by the town\'s size, never a merchant or a sellsword; its first slot kept (`wideFrom`), every id before it as the three ranks deal them (mutants: each count, the order, the start)', () => {
  assert.deepEqual([...WIDE_JOBS], ['adventurer', 'pedlar', 'pilgrim', 'courier', 'hunter']);
  const rows = [[3, 1], [2, 4], [1, 8], [0, 9], [0, 16], [0, 42], [0, 64], [6, 1]].map(([type, blocks]) => wideCounts({ mapId: 1, type, blocks }));
  assert.deepEqual(rows, [
    { adventurer: 0, pedlar: 0, pilgrim: 0, courier: 0, hunter: 1 },
    { adventurer: 1, pedlar: 1, pilgrim: 1, courier: 0, hunter: 2 },
    { adventurer: 2, pedlar: 2, pilgrim: 1, courier: 0, hunter: 2 },
    { adventurer: 2, pedlar: 2, pilgrim: 1, courier: 1, hunter: 0 },
    { adventurer: 4, pedlar: 3, pilgrim: 1, courier: 1, hunter: 0 },
    { adventurer: 9, pedlar: 6, pilgrim: 2, courier: 2, hunter: 0 },
    { adventurer: 10, pedlar: 6, pilgrim: 3, courier: 3, hunter: 0 },
    { adventurer: 0, pedlar: 0, pilgrim: 0, courier: 0, hunter: 0 },
  ]);
  for (const [type, blocks] of [[0, 42], [1, 8], [2, 4], [3, 1]]) {
    const t = { mapId: 900 + blocks, px: 100, py: 100, blocks, type, region: 17, people: 3, name: 'W', port: false };
    const r = travellerRoster(t);
    const first = sum(travellerCounts(t)) + sum(roadCounts(t)) + sum(moreCounts(t));
    assert.equal(r.wideFrom, first, `${type}/${blocks}: after the three ranks`);
    assert.ok(r.slice(0, first).every((x) => [...TRAVELLER_JOBS, ...ROAD_JOBS, ...MORE_JOBS].includes(x.job)), 'the three ranks\' own');
    assert.deepEqual(r.slice(first).map((x) => x.job), WIDE_JOBS.flatMap((j) => Array(wideCounts(t)[j]).fill(j)), 'the fourth in its order');
    assert.ok(r.every((x, i) => x.id === `L${t.mapId}.t${i}` && LIVING_ID_RE.test(x.id)), 'the wire\'s ids');
    assert.ok(r.every((x) => isWidePlace(x, r) === x.slot >= first) && !isWidePlace(r[0], null), 'a place of the fourth rank by its slot');
    assert.ok(isWidePlace({ ...r[r.length - 1], id: `${r[r.length - 1].id}~3` }, r) === (r.length > first), 'a newcomer to it too');
  }
});

test('LW-WIDE the divers: the fourth rank\'s adventurers in companies of their own, `wide`, after the first ranks\' (which are as they were); they dive WIDE_DIVE_CHANCE of their cycles (mutants: the deal mixed, the chance, the chance unread)', () => {
  assert.equal(WIDE_DIVE_CHANCE, 0.9);
  assert.ok(WIDE_DIVE_CHANCE > COMPANY_DIVE_CHANCE && COMPANY_DIVE_CHANCE > DIVE_CHANCE);
  const t = { mapId: 951, px: 100, py: 100, blocks: 42, type: 0, region: 17, people: 3, name: 'W', port: false };
  const r = travellerRoster(t);
  const cs = companiesOf(r);
  const wide = cs.filter((c) => c.wide);
  assert.ok(wide.length >= 2, `the divers in companies (${wide.length})`);
  assert.ok(wide.every((c) => c.places.every((p) => isWidePlace(p, r))) && cs.filter((c) => !c.wide).every((c) => c.places.every((p) => !isWidePlace(p, r))), 'each of one rank');
  assert.ok(cs.findIndex((c) => c.wide) === cs.filter((c) => !c.wide).length, 'after the first ranks\'');
  const deep = synthMap({ dives: true });
  let cycles = 0, dives = 0, firstCycles = 0, firstDives = 0, between = 0;
  for (const town of deep.towns) {
    const roster = deep.world.rosterOf(town);
    for (const res of roster) {
      if (res.job !== 'adventurer' || companyOfPlace(res, roster)?.places[0].slot !== res.slot && companyOfPlace(res, roster)) continue;   // a company's first, or one alone
      for (let k = 300; k < 330; k++) {
        const tr = ownTrip(res, town, k, deep.world, O());
        if (!tr) continue;
        if (isWidePlace(res, roster)) { cycles++; if (tr.dive) dives++; } else { firstCycles++; if (tr.dive) firstDives++; }
        const d = lwRng(res.town, res.slot, k, 0x64697665)();
        if (tr.dive && isWidePlace(res, roster)) assert.ok(d < WIDE_DIVE_CHANCE, 'a dive where its own dice said');
        if (tr.dive && isWidePlace(res, roster) && d >= COMPANY_DIVE_CHANCE) between++;   // a dive a company's chance would not have made
      }
    }
  }
  assert.ok(cycles > 20 && dives / cycles > firstDives / Math.max(1, firstCycles), `the divers dive the likelier (${dives}/${cycles} against ${firstDives}/${firstCycles})`);
  assert.ok(between > 0, `dives on dice between the company's chance and theirs (${between})`);
});

test('LW-WIDE the road: on the synthetic map, mixed as the game\'s is, half again as many parties about a point by day with the fourth rank, and more than twice the dives under way (mutants: the rank unminted)', () => {
  const map = livingMap({ dives: true });
  map.towns.forEach((t, i) => {
    const r = (Math.imul(t.mapId, 2654435761) >>> 0) % 10;
    if (r < 2) { t.type = 3; t.blocks = 1; } else if (r < 4) { t.type = 2; t.blocks = 4 + (r % 5); } else if (r < 5) { t.type = 1; t.blocks = 2; } else if (r < 6 && i % 2) { t.type = 6; t.blocks = 1; }
  });
  const o = O();
  let all = 0, old = 0, n = 0, divesAll = 0, divesOld = 0;
  for (let day = 300; day < 307; day++) for (const h of [8, 12, 18]) for (const [px, py] of [[115, 115], [120, 120], [125, 125], [130, 115]]) {
    const got = partiesNear(px, py, day * DAY_MIN + h * 60, map.world, o, 3).parties;
    all += got.length; n++;
    for (const p of got) if (!isWidePlace(p.trip.leader, map.world.rosterOf(p.trip.from))) old++;
  }
  for (let day = 300; day < 314; day++) for (const town of map.towns) for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o) ?? []) {
    if (!tr.dive || tr.outT0 >= (day + 1) * DAY_MIN || tr.outT0 < day * DAY_MIN) continue;
    divesAll++;
    if (!isWidePlace(tr.leader, map.world.rosterOf(town))) divesOld++;
  }
  assert.ok(all / n >= 1.4 * (old / n), `parties within 3 px: ${(old / n).toFixed(2)} before, ${(all / n).toFixed(2)} with the fourth rank`);
  assert.ok(divesAll >= 2 * divesOld && divesOld > 0, `dives set out in a fortnight: ${divesOld} before, ${divesAll} with`);
});
