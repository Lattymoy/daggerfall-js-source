// FIXED-PVE STAGE 7 (bible/05-Combat/Fixed-PvE.md section 9): the fixed-level zones over all 71 regions, a place's
// spawn table, and the population manager that keeps a cell's count fixed whoever comes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONE_BANDS, REGION_TIER, DISTRICT_STEP, ZONE_SHARE, DEEP_DUNGEONS, pveZoneAt, districtRoll, recommendedScore } from '../../../src/systems/pve/pveZones.js';
import { spawnTable, POPULATIONS, POP_DENSITY, RESPAWN_S, RARE_CHANCE } from '../../../src/systems/pve/pveSpawnTable.js';
import { populationLedger, wakeCell, slotFell, populationDue, sleepCells, CELL_IDLE_S } from '../../../src/systems/pve/pvePopulation.js';
import { ORSINIUM_REGION, PROVINCE_KEYS } from '../../../src/systems/pve/pveBestiary.js';
import { encounterPool, bandGroups, meetsHostile, readabilityProblems } from '../../../src/systems/pve/pveEncounter.js';
import { MOB_TEMPLATES, GROUP_TEMPLATES, templateProblems, groupProblems } from '../../../src/systems/pve/pveTemplates.js';
import { CLIMATES, REGION_NAMES, BAY_REGION_COUNT, CYRODIIL_REGION } from '../../../src/formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';

const SKYRIM = BAY_REGION_COUNT + 2, HIGH_ROCK = BAY_REGION_COUNT;
/** The first district pixel whose draw keeps `ok`. */
function pixelWhere(ok) {
  for (let px = -4000; px < 4000; px += 96) for (let py = -4000; py < 4000; py += 96) if (ok(districtRoll(px, py))) return [px, py];
  throw new Error('no such district');
}
const plain = pixelWhere((r) => r >= ZONE_SHARE.enclave + ZONE_SHARE.farming && DISTRICT_STEP[r % DISTRICT_STEP.length] === 0);

test('STAGE 7: every region has a band, the bands overlap and climb to 45, and a province holds more than one', () => {
  assert.equal(REGION_TIER.length, REGION_NAMES.length, 'the Bay\'s 62 and the provinces\' nine');
  for (const t of REGION_TIER) assert.ok(t >= 0 && t < ZONE_BANDS.length);
  assert.deepEqual([ZONE_BANDS[0][0], ZONE_BANDS[ZONE_BANDS.length - 1][1]], [1, 45]);
  for (let i = 1; i < ZONE_BANDS.length; i++) assert.ok(ZONE_BANDS[i][0] <= ZONE_BANDS[i - 1][1], 'no wall between bands');
  for (const region of [SKYRIM, ORSINIUM_REGION]) {
    const tiers = new Set();
    for (let px = -2000; px < 2000; px += 96) tiers.add(pveZoneAt({ px, py: 500, region }).tier);
    assert.ok(tiers.size >= 2, `${REGION_NAMES[region]} holds several bands`);
  }
  assert.equal(pveZoneAt({ px: 0, py: 0, region: 71 }), null);
  assert.equal(pveZoneAt({ px: 0, py: 0, region: 17, place: 'sky' }), null);
});

test('STAGE 7: a town is safe, a road keeps its region\'s band, a dungeon is deeper, an enclave warns', () => {
  const [px, py] = plain;
  const at = (o) => pveZoneAt({ px, py, region: HIGH_ROCK, ...o });
  assert.equal(at({}).tier, REGION_TIER[HIGH_ROCK]);
  assert.deepEqual([at({ place: 'town' }).tier, at({ place: 'town' }).safe], [0, true]);
  assert.equal(at({ place: 'dungeon', dungeon: DUNGEON_TYPES.Crypt }).tier, REGION_TIER[HIGH_ROCK] + 1);
  assert.equal(at({ place: 'dungeon', dungeon: DEEP_DUNGEONS[0] }).tier, REGION_TIER[HIGH_ROCK] + 2);
  assert.equal(at({ place: 'dungeon', dungeon: DEEP_DUNGEONS[0] }).warning, true);
  const up = pixelWhere((r) => r >= ZONE_SHARE.enclave + ZONE_SHARE.farming && DISTRICT_STEP[r % DISTRICT_STEP.length] === 1);
  assert.equal(pveZoneAt({ px: up[0], py: up[1], region: 2, place: 'road' }).tier, REGION_TIER[2], 'a road never climbs past its region');
  assert.equal(pveZoneAt({ px: up[0], py: up[1], region: 2 }).tier, REGION_TIER[2] + 1);
  const low = pixelWhere((r) => r >= ZONE_SHARE.enclave + ZONE_SHARE.farming && DISTRICT_STEP[r % DISTRICT_STEP.length] === -1);
  assert.equal(pveZoneAt({ px: low[0], py: low[1], region: 2, place: 'road' }).tier, REGION_TIER[2] - 1);
  const [ex, ey] = pixelWhere((r) => r < ZONE_SHARE.enclave);
  const enclave = pveZoneAt({ px: ex, py: ey, region: 2 });
  assert.deepEqual([enclave.enclave, enclave.warning, enclave.tier, enclave.farming], [true, true, REGION_TIER[2] + 3, false]);
  assert.equal(pveZoneAt({ px: ex, py: ey, region: 2, place: 'road' }).enclave, false, 'only the wild is an enclave');
  const [fx, fy] = pixelWhere((r) => r === ZONE_SHARE.enclave + ZONE_SHARE.farming - 1);
  assert.equal(pveZoneAt({ px: fx, py: fy, region: 2 }).farming, true);
  assert.equal(pveZoneAt({ px: fx, py: fy, region: 2, place: 'road' }).farming, false);
  assert.equal(pveZoneAt({ px: ex, py: ey, region: CYRODIIL_REGION }).tier, ZONE_BANDS.length - 1, 'the top band caps an enclave');
});

test('STAGE 7: the recommended score climbs with the band and is advice only', () => {
  const s = ZONE_BANDS.map(recommendedScore);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1]);
  assert.equal(Object.keys(pveZoneAt({ px: 0, py: 0, region: 17 })).includes('score'), false, 'the zone holds no player number');
});

const orsinium = { px: plain[0], py: plain[1], region: ORSINIUM_REGION, province: 'HighRock', climate: CLIMATES.Mountain, factions: ['orc-clans'] };

test('STAGE 7: a spawn table is the place\'s alone - settlement, ambient, encounters and groups split by disposition', () => {
  const t = spawnTable(orsinium);
  assert.deepEqual(spawnTable({ ...orsinium }), t, 'the same place, the same table');
  const keys = (pop) => t.lists[pop].map((x) => x.key);
  assert.deepEqual(keys('settlement'), ['orc-stronghold']);
  assert.deepEqual(keys('ambient'), ['orc-hunter', 'orc-shaman'], 'the protected live in the settlement, not the wild');
  assert.deepEqual(keys('encounter'), ['orc-defender', 'orc-grunt']);
  assert.deepEqual(keys('group'), ['orc-warband']);
  assert.deepEqual([keys('farming'), keys('patrol')], [[], []], 'no farming ground, no road');
  assert.deepEqual(keys('rare'), ['harpy-matron', 'old-sabretooth'], 'the strong beasts of the band, rarely');
  assert.equal(spawnTable({ ...orsinium, region: 71 }), null);
  const dungeon = spawnTable({ ...orsinium, place: 'dungeon', dungeon: DUNGEON_TYPES.OrcStronghold });
  assert.deepEqual(dungeon.lists.settlement, [], 'a dungeon holds no settlement');
  assert.ok(dungeon.lists.rare.some((x) => x.key === 'orc-warlord'), 'a warlord is a rare foe one band deeper');
});

test('STAGE 7: a town holds no hostile population unless an event says so, and no territorial beast', () => {
  const at = { px: plain[0], py: plain[1], region: 17, province: 'HighRock', climate: CLIMATES.Woodlands, place: 'town', factions: ['bandits'] };
  const town = spawnTable(at);
  assert.ok(spawnTable({ ...at, place: 'wild' }).lists.encounter.length > 0, 'bandits hold the land round it');
  for (const pop of ['farming', 'encounter', 'group', 'patrol', 'rare']) assert.deepEqual(town.lists[pop], [], pop);
  assert.deepEqual(town.lists.ambient.map((x) => x.key), ['wild-rat']);
  const wild = spawnTable({ ...at, place: 'wild' });
  assert.ok(wild.lists.ambient.some((x) => x.key === 'grizzly'), 'the wild keeps its bears');
  const raid = spawnTable({ ...at, event: 'hostile' });
  assert.ok(raid.lists.encounter.length > 0, 'an event turns the town');
});

test('STAGE 7: past the Bay - a farming ground and a road patrol in a province, bandits only where they hold the land', () => {
  const [fx, fy] = pixelWhere((r) => r >= ZONE_SHARE.enclave && r < ZONE_SHARE.enclave + ZONE_SHARE.farming && DISTRICT_STEP[r % DISTRICT_STEP.length] === 0);
  const at = { px: fx, py: fy, region: BAY_REGION_COUNT + 1, province: 'Hammerfell', climate: CLIMATES.Desert, factions: ['bandits'] };
  const t = spawnTable({ ...at, region: 2, province: 'HighRock', climate: CLIMATES.Woodlands });
  assert.equal(t.zone.farming, true);
  assert.deepEqual(t.lists.farming, t.lists.encounter, 'a farming ground draws the band\'s plain foes');
  const road = spawnTable({ ...at, region: 5, province: 'HighRock', climate: CLIMATES.Woodlands, place: 'road' });
  assert.deepEqual(road.lists.patrol.map((x) => x.key), ['bandit-camp'], 'a road\'s patrol is a group that walks it');
  assert.equal(road.lists.farming.length, 0);
  const province = spawnTable({ ...at, region: BAY_REGION_COUNT, province: 'HighRock', climate: CLIMATES.Woodlands, place: 'road' });
  assert.equal(province.zone.pastBay, true);
  assert.ok(province.lists.patrol.length + province.lists.rare.length > 0, 'High Rock past the Bay has its bandits');
  assert.deepEqual(spawnTable({ ...at, region: 5, province: 'HighRock', climate: CLIMATES.Woodlands, place: 'road', factions: [] }).lists.patrol, [], 'no band holds it');
  const night = spawnTable({ ...orsinium, place: 'wild', night: true, event: 'incursion' });
  assert.ok(night, 'the hour and an event reach the bestiary');
});

const table = (lists) => ({ lists: { settlement: [], ambient: [], farming: [], encounter: [], group: [], patrol: [], rare: [], ...lists } });

test('STAGE 7: a cell stands its density and no more, whoever comes, and the same foes on every machine', () => {
  const t = table({ encounter: [{ key: 'a', w: 1 }, { key: 'b', w: 1 }], ambient: [{ key: 'r', w: 1 }] });
  const L = populationLedger();
  const stood = wakeCell(L, 'c:1:1', t, 1000);
  assert.equal(stood.length, POP_DENSITY.encounter + POP_DENSITY.ambient);
  assert.deepEqual(wakeCell(L, 'c:1:1', t, 1001), [], 'a second player wakes nothing more');
  assert.deepEqual(populationDue(L, 1002), []);
  const L2 = populationLedger();
  assert.deepEqual(wakeCell(L2, 'c:1:1', t, 1000), stood, 'deterministic');
  assert.equal(POPULATIONS.length, Object.keys(POP_DENSITY).length);
  assert.deepEqual(wakeCell(populationLedger(), 'c:9:9', table({}), 0), [], 'an empty table stands nothing');
});

test('STAGE 7: a fallen slot waits its population\'s time; a lasting death stays; sleep is never a free respawn', () => {
  const t = table({ encounter: [{ key: 'a', w: 1 }] });
  const L = populationLedger();
  const [first] = wakeCell(L, 'c:2:2', t, 0);
  slotFell(L, first.id, 10);
  slotFell(L, first.id, 11);   // twice: the second finds it down already
  assert.equal(L.cells.get('c:2:2').slots.get(first.id).turn, Math.floor(0 / RESPAWN_S.encounter) + 1);
  assert.equal(populationDue(L, 10 + RESPAWN_S.encounter - 1).filter((s) => s.id === first.id).length, 0);
  assert.equal(populationDue(L, 10 + RESPAWN_S.encounter).filter((s) => s.id === first.id).length, 1);
  slotFell(L, first.id, 400);
  L.cells.get('c:2:2').seenAt = 300;
  assert.deepEqual(sleepCells(L, 300 + CELL_IDLE_S - 1), []);
  assert.deepEqual(sleepCells(L, 300 + CELL_IDLE_S), ['c:2:2']);
  const back = wakeCell(L, 'c:2:2', t, 300 + CELL_IDLE_S + 1);
  assert.equal(back.some((s) => s.id === first.id), false, 'it still waits after the sleep');
  assert.equal(populationDue(L, 400 + RESPAWN_S.encounter).some((s) => s.id === first.id), true);
  slotFell(L, first.id, 2000, { lasting: true });
  assert.equal(L.gone.has(first.id), true);
  sleepCells(L, 99999);
  assert.equal(wakeCell(L, 'c:2:2', t, 100000).some((s) => s.id === first.id), false, 'a lasting death outlives every sleep');
  slotFell(L, 'c:none|encounter|0', 1);   // an unknown slot is let be
  const M = populationLedger();
  const [one] = wakeCell(M, 'c:3:3', t, 0);
  slotFell(M, one.id, 0);
  assert.deepEqual(wakeCell(M, 'c:3:3', t, RESPAWN_S.encounter), [], 'a second player\'s touch stands nothing');
  assert.equal(populationDue(M, RESPAWN_S.encounter).length, 1, 'the slot is due all the same');
  slotFell(M, one.id, RESPAWN_S.encounter + 50);
  assert.deepEqual(sleepCells(M, RESPAWN_S.encounter + CELL_IDLE_S), ['c:3:3']);
  assert.equal(M.waits.size, 1, 'a sleeping cell keeps its wait');
  sleepCells(M, 1e9);
  assert.equal(M.waits.size, 0, 'spent waits are let go');
});

test('STAGE 7: a rare slot stands a foe on few of its turns', () => {
  const L = populationLedger();
  let stood = 0;
  for (let i = 0; i < 400; i++) stood += wakeCell(L, `r:${i}`, table({ rare: [{ key: 'x', w: 1 }] }), 0).length;
  assert.ok(stood > 0 && stood < 400 * RARE_CHANCE * 3, `${stood} of 400`);
});

test('ROSTER: every province, every land climate and every band holds plain foes and a group where outlaws hold the land', () => {
  const lands = [CLIMATES.Woodlands, CLIMATES.MountainWoods, CLIMATES.Mountain, CLIMATES.Desert, CLIMATES.Swamp, CLIMATES.Rainforest, CLIMATES.Subtropical];
  const gaps = [];
  for (const province of PROVINCE_KEYS) for (const climate of lands) ZONE_BANDS.forEach((band, tier) => {
    const p = encounterPool(band, { province, climate, factions: ['bandits'] });
    if (!p.pool.some((x) => meetsHostile(x.t) && x.t.category === 'normal')) gaps.push(`${province} ${climate} band ${tier}: no plain foe`);
    if (!bandGroups(p).length) gaps.push(`${province} ${climate} band ${tier}: no group`);
  });
  assert.deepEqual(gaps, []);
  for (const t of MOB_TEMPLATES) assert.deepEqual([...templateProblems(t), ...readabilityProblems(t)], [], t.key);
  for (const g of GROUP_TEMPLATES) assert.deepEqual(groupProblems(g), [], g.key);
});
