// FIXED-PVE STAGE 7 (bible/05-Combat/Fixed-PvE.md section 9): the fixed-level zones over all 71 regions, a place's
// spawn table, and the population manager that keeps a cell's count fixed whoever comes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONE_BANDS, ZONE_STARTS, zoneAreaOf, zoneBaseTier, zoneStartPx, zoneCenterPx, zoneBase, ZONE_SHARE, DEEP_DUNGEONS, pveZoneAt, districtRoll, recommendedScore } from '../../../src/systems/pve/pveZones.js';
import { spawnTable, POPULATIONS, POP_DENSITY, RESPAWN_S, RARE_CHANCE } from '../../../src/systems/pve/pveSpawnTable.js';
import { populationLedger, wakeCell, slotFell, populationDue, sleepCells, CELL_IDLE_S } from '../../../src/systems/pve/pvePopulation.js';
import { ORSINIUM_REGION, PROVINCE_KEYS } from '../../../src/systems/pve/pveBestiary.js';
import { encounterPool, bandGroups, meetsHostile, readabilityProblems } from '../../../src/systems/pve/pveEncounter.js';
import { MOB_TEMPLATES, GROUP_TEMPLATES, templateProblems, groupProblems } from '../../../src/systems/pve/pveTemplates.js';
import { CLIMATES, REGION_NAMES, BAY_REGION_COUNT, CYRODIIL_REGION } from '../../../src/formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay } from '../../../src/world/tamriel/tamrielFrame.js';

const SKYRIM = BAY_REGION_COUNT + 2, HIGH_ROCK = BAY_REGION_COUNT;
/** The first district pixel whose draw keeps `ok`. */
function pixelWhere(ok) {
  for (let px = -4000; px < 4000; px += 96) for (let py = -4000; py < 4000; py += 96) if (ok(districtRoll(px, py))) return [px, py];
  throw new Error('no such district');
}
/** The first district pixel whose draw keeps `ok` and whose base band in `region`'s area is `tier`. */
function pixelAt(region, tier, ok) {
  for (let px = -4000; px < 4000; px += 8) for (let py = -4000; py < 4000; py += 96) if (ok(districtRoll(px, py)) && zoneBase(px, py, region) === tier) return [px, py];
  throw new Error('no such district');
}
const plainRoll = (r) => r >= ZONE_SHARE.enclave + ZONE_SHARE.farming;
const plain = pixelWhere(plainRoll);

test('CENTER-HARDEST: every area starts low at its own town and climbs to the Imperial City, the top band', () => {
  assert.deepEqual([ZONE_BANDS[0][0], ZONE_BANDS[ZONE_BANDS.length - 1][1]], [1, 45]);
  for (let i = 1; i < ZONE_BANDS.length; i++) assert.ok(ZONE_BANDS[i][0] <= ZONE_BANDS[i - 1][1], 'no wall between bands');
  for (let r = 0; r < REGION_NAMES.length; r++) assert.ok(zoneAreaOf(r), `${REGION_NAMES[r]} has an area`);
  assert.deepEqual([zoneAreaOf(17), zoneAreaOf(SKYRIM), zoneAreaOf(CYRODIIL_REGION), zoneAreaOf(71)], ['IliacBay', 'Skyrim', 'Imperial', null]);
  for (const area of Object.keys(ZONE_STARTS).filter((a) => a !== 'Imperial')) assert.equal(zoneBaseTier(...zoneStartPx(area), area), 0, `${area} starts in the first band`);
  assert.deepEqual([zoneStartPx('IliacBay'), zoneStartPx('HighRock'), zoneStartPx('Hammerfell')], [[109, 158], [109, 158], [109, 158]], 'the Bay\'s peoples wake at Privateer\'s Hold');
  assert.deepEqual([ZONE_STARTS.Skyrim, ZONE_STARTS.Morrowind, ZONE_STARTS.Imperial, zoneStartPx('Imperial')], ['Solitude', 'Mournhold', 'Imperial City', null], 'where each start wakes');
  const [cx, cy] = zoneCenterPx();
  for (const area of Object.keys(ZONE_STARTS)) assert.equal(zoneBaseTier(cx, cy, area), ZONE_BANDS.length - 1, 'the center is the top');
  const town = (n) => { const c = CITIES.find((x) => x.name === n); return zoneBaseTier(...pictureToBay(c.at[0], c.at[1]), c.province); };
  assert.ok(town('Whiterun') > town('Solitude') && town('Falkreath') > town('Whiterun'), 'Skyrim climbs south toward the heart');
  assert.ok(zoneBaseTier(859, 244, 'IliacBay') > zoneBaseTier(207, 213, 'IliacBay'), 'Wayrest stands above Daggerfall');
  assert.ok(town('Blacklight') > town('Mournhold'), 'the back country climbs away from the start');
  assert.ok(['Anvil', 'Bravil', 'Leyawiin', 'Cheydinhal'].every((n) => town(n) >= 3), 'all Cyrodiil stands high');
  assert.equal(pveZoneAt({ px: 0, py: 0, region: 71 }), null);
  assert.equal(pveZoneAt({ px: 0, py: 0, region: 17, place: 'sky' }), null);
});

test('STAGE 7: a town is safe, a road keeps its base band, a dungeon is deeper, an enclave warns', () => {
  const [px, py] = pixelAt(HIGH_ROCK, 1, plainRoll), base = zoneBase;
  const at = (o) => pveZoneAt({ px, py, region: HIGH_ROCK, ...o });
  const B = base(px, py, HIGH_ROCK);
  assert.equal(at({}).tier, B);
  assert.equal(at({}).area, 'HighRock');
  assert.deepEqual([at({ place: 'town' }).tier, at({ place: 'town' }).safe], [0, true]);
  assert.equal(at({ place: 'dungeon', dungeon: DUNGEON_TYPES.Crypt }).tier, Math.min(5, B + 1));
  assert.equal(at({ place: 'dungeon', dungeon: DEEP_DUNGEONS[0] }).tier, Math.min(5, B + 2));
  assert.equal(at({ place: 'dungeon', dungeon: DEEP_DUNGEONS[0] }).warning, B + 2 <= 5);
  const up = pixelAt(CYRODIIL_REGION, 3, plainRoll);
  assert.equal(pveZoneAt({ px: up[0], py: up[1], region: CYRODIIL_REGION, place: 'road' }).tier, 3, 'a road keeps its band');
  assert.equal(pveZoneAt({ px: up[0], py: up[1], region: CYRODIIL_REGION }).tier, 3, 'the wild stands on its ring');
  const [ex, ey] = pixelWhere((r) => r < ZONE_SHARE.enclave);
  const enclave = pveZoneAt({ px: ex, py: ey, region: 2 });
  assert.deepEqual([enclave.enclave, enclave.warning, enclave.tier, enclave.farming], [true, true, Math.min(5, base(ex, ey, 2) + 3), false]);
  assert.equal(pveZoneAt({ px: ex, py: ey, region: 2, place: 'road' }).enclave, false, 'only the wild is an enclave');
  const [fx, fy] = pixelWhere((r) => r === ZONE_SHARE.enclave + ZONE_SHARE.farming - 1);
  assert.equal(pveZoneAt({ px: fx, py: fy, region: 2 }).farming, true);
  assert.equal(pveZoneAt({ px: fx, py: fy, region: 2, place: 'road' }).farming, false);
  const [cx, cy] = zoneCenterPx().map(Math.floor);
  assert.ok(pveZoneAt({ px: cx, py: cy, region: CYRODIIL_REGION }).tier >= ZONE_BANDS.length - 2, 'the heart stands at the top');
});

test('SAFE-ROAD: Cyrodiil\'s roads hold no hostile foe, so the Imperial start walks out of the heart; other roads keep their patrols', () => {
  const [cx, cy] = zoneCenterPx().map(Math.floor);
  const road = pveZoneAt({ px: cx, py: cy, region: CYRODIIL_REGION, place: 'road' });
  assert.deepEqual([road.safe, road.area], [true, 'Imperial']);
  assert.equal(pveZoneAt({ px: cx, py: cy, region: CYRODIIL_REGION }).safe, false, 'the wild is not');
  const t = spawnTable({ px: cx, py: cy, region: CYRODIIL_REGION, province: 'Imperial', climate: CLIMATES.Woodlands, place: 'road', factions: ['bandits'] });
  for (const pop of ['farming', 'encounter', 'group', 'patrol', 'rare']) assert.deepEqual(t.lists[pop], [], pop);
  assert.equal(pveZoneAt({ px: cx, py: cy, region: SKYRIM, place: 'road' }).safe, false);
});

test('GROUP-PARTY: the heart\'s inner ring is the party zone - wild and dungeons, never a road or a town, nowhere else', async () => {
  const { PARTY_ZONE_FROM, zoneProgress } = await import('../../../src/systems/pve/pveZones.js');
  const [cx, cy] = zoneCenterPx().map(Math.floor);
  assert.equal(PARTY_ZONE_FROM, 0.9);
  const at = (o) => pveZoneAt({ px: cx, py: cy, region: CYRODIIL_REGION, ...o });
  assert.ok(zoneProgress(cx + 20, cy, 'Imperial') >= 0.9);
  assert.deepEqual([at({}).party, at({}).warning, at({ place: 'dungeon', dungeon: DUNGEON_TYPES.Crypt }).party], [true, true, true]);
  assert.deepEqual([at({ place: 'road' }).party, at({ place: 'town' }).party], [false, false]);
  const sk = CITIES.find((c) => c.name === 'Skingrad').at, [sx, sy] = pictureToBay(sk[0], sk[1]).map(Math.floor);
  assert.equal(pveZoneAt({ px: sx, py: sy, region: CYRODIIL_REGION }).party, false, 'Skingrad lies outside it');
  assert.equal(pveZoneAt({ px: cx + 20, py: cy, region: SKYRIM }).party, false);
  assert.ok(zoneProgress(cx + 60, cy, 'Imperial') >= 0.9);
  assert.equal(pveZoneAt({ px: cx + 60, py: cy, region: CYRODIIL_REGION }).party, false, 'off the top ring by the heart is no party zone');
});

test('REGION-HOTSPOT: each area has three hot spots, far from its start and each other - 36-45 on them, 1-8 outside their rings', async () => {
  const { hotspotRung, ladderTier, LADDER_RUNGS, areaHotspots, AREA_HOTSPOTS, HOTSPOT_REACH } = await import('../../../src/systems/pve/pveZones.js');
  const { hotspotCandidates, BAY_HOTSPOTS } = await import('../../../src/systems/pve/pveHotspots.js');
  assert.deepEqual([[0, 0], [60, 0], [120, 0], [300, 0]].map(([x, y]) => hotspotRung(x, y, [[0, 0]])), [1, 0.5, 0, 0]);
  assert.equal(hotspotRung(200, 0, [[0, 0], [180, 0]]), 1 - 20 / HOTSPOT_REACH, 'the nearest hot spot rules');
  assert.deepEqual([0.16, 0.17, 0.34, 0.5, 0.67, 0.84, 1].map((r) => ladderTier(r, 0)), [0, 1, 2, 3, 4, 5, 5]);
  assert.equal(LADDER_RUNGS.length, ZONE_BANDS.length - 1);
  assert.ok(ladderTier(0.6, 1) > ladderTier(0.6, 0), 'the rings widen toward the center');
  assert.equal(ladderTier(0, 1), 0, 'outside the rings is the first band even at the heart');
  assert.equal(BAY_HOTSPOTS.length, BAY_REGION_COUNT);
  for (const area of Object.keys(ZONE_STARTS)) {
    const hots = areaHotspots(area), cands = hotspotCandidates(area), start = zoneStartPx(area);
    assert.equal(hots.length, AREA_HOTSPOTS, area);
    assert.ok(hots.every((h) => cands.some((c) => c[0] === h[0] && c[1] === h[1]) || (!start && h === hots[0])), `${area}: on its own land`);
    if (start) {
      const far = Math.max(...cands.map((c) => Math.hypot(c[0] - start[0], c[1] - start[1])));
      assert.equal(Math.hypot(hots[0][0] - start[0], hots[0][1] - start[1]), far, `${area}: the first is the farthest from the start`);
      assert.equal(zoneBase(...start.map(Math.floor), area === 'IliacBay' ? 17 : BAY_REGION_COUNT), 0, `${area}: its start is level 1-8`);
    }
  }
  assert.deepEqual(areaHotspots('Imperial')[0], zoneCenterPx(), 'the heart\'s first is the center');
  assert.ok(areaHotspots('Skyrim').every((h) => (h[0] + 8192) % 96 === 48 && (h[1] + 8192) % 96 === 48), 'past the Bay a district\'s middle');
  const [hx, hy] = areaHotspots('IliacBay')[0];
  const ring = (f) => zoneBase(Math.round(hx - HOTSPOT_REACH * f), hy, 0);
  assert.deepEqual([ring(0), ring(1.1)], [ZONE_BANDS.length - 1, 0], '36-45 on the hot spot, 1-8 past its reach');
  assert.ok([0, 0.2, 0.4, 0.6, 0.8, 1].map(ring).every((t, i, a) => i === 0 || t <= a[i - 1]), 'the bands fall walking out');
  assert.equal(zoneBase(207, 213, 17), 0, 'Daggerfall city stands far from every hot spot');
  assert.strictEqual(areaHotspots('IliacBay'), areaHotspots('IliacBay'), 'picked once');
});

test('STAGE 7: the recommended score climbs with the band and is advice only', () => {
  const s = ZONE_BANDS.map(recommendedScore);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1]);
  assert.equal(Object.keys(pveZoneAt({ px: 0, py: 0, region: 17 })).includes('score'), false, 'the zone holds no player number');
});

const [ox, oy] = pixelAt(ORSINIUM_REGION, 3, plainRoll);
const orsinium = { px: ox, py: oy, region: ORSINIUM_REGION, province: 'HighRock', climate: CLIMATES.Mountain, factions: ['orc-clans'] };

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
  const [tx, ty] = pixelAt(17, 0, plainRoll);
  const at = { px: tx, py: ty, region: 17, province: 'HighRock', climate: CLIMATES.Woodlands, place: 'town', factions: ['bandits'] };
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
  const [fx, fy] = pixelAt(5, 1, (r) => r >= ZONE_SHARE.enclave && r < ZONE_SHARE.enclave + ZONE_SHARE.farming);
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
