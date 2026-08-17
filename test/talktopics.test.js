// T3c: building names + the Where-is topics (GenerateBuildingName /
// GetCompleteBuildingData / DirectionVector2DirectionHintString /
// GetReactionToPlayer_0_1_2, verbatim).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { generateBuildingName, BUILDING_TYPES, isNamedBuildingType, TAVERNS_A, TAVERNS_B, STORES_A } from '../src/world/buildingNames.js';
import { mergeNamedBuildings, buildBuildingDirectory, compassHint, reactionTier, ANSWERS_TO_DIRECTIONS, whereIsAnswer, KNOWLEDGE_MODIFIERS, makeBuildingKey, npcKnowsAboutItem, BUILDING_KEY_0 } from '../src/systems/talkTopics.js';
import { srand, rand, randomRange, randomRangeInclusive } from '../src/formats/dfRandom.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { layoutLocation } from '../src/world/locationLayout.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('buildingNames: the seeded draws, macros, and singleton forms', () => {
  // The tavern draw order is B FIRST then A - reproduce by hand
  srand(1234);
  const b = TAVERNS_B[randomRange(0, TAVERNS_B.length)];
  const a = TAVERNS_A[randomRange(0, TAVERNS_A.length)];
  assert.equal(generateBuildingName(1234, BUILDING_TYPES.Tavern, {}), `${a} ${b}`);
  // The same seed always gives the same name
  assert.equal(generateBuildingName(1234, BUILDING_TYPES.Tavern, {}),
    generateBuildingName(1234, BUILDING_TYPES.Tavern, {}));
  // Banks: "The Bank of <region>"
  assert.equal(generateBuildingName(7, BUILDING_TYPES.Bank, { regionName: 'Daggerfall' }), 'The Bank of Daggerfall');
  // Guild halls take the faction name (singleton)
  assert.equal(generateBuildingName(7, BUILDING_TYPES.GuildHall, { factionId: 40, factionName: () => 'The Mages Guild' }), 'The Mages Guild');
  // Houses return empty (quest renames pend); HouseForSale is fixed
  assert.equal(generateBuildingName(7, BUILDING_TYPES.House1, {}), '');
  assert.equal(generateBuildingName(7, BUILDING_TYPES.HouseForSale, {}), 'House for sale');
  // %cn lands the location name; StoresA carries the macro forms
  assert.ok(STORES_A.includes('%cn'));
  assert.ok(isNamedBuildingType(BUILDING_TYPES.Tavern));
  assert.ok(!isNamedBuildingType(BUILDING_TYPES.House1));
});

test('talkTopics: the compass bands, the tier roll, and the answer table shape', () => {
  // (east, north) bands, verbatim
  assert.equal(compassHint(1, 0), 'east');
  assert.equal(compassHint(1, 1), 'northeast');
  assert.equal(compassHint(0, 1), 'north');
  assert.equal(compassHint(-1, 1), 'northwest');
  assert.equal(compassHint(-1, 0), 'west');
  assert.equal(compassHint(-1, -1), 'southwest');
  assert.equal(compassHint(0, -1), 'south');
  assert.equal(compassHint(1, -1), 'southeast');
  // 30 records: 15 doesn't-know + 15 knows
  assert.equal(ANSWERS_TO_DIRECTIONS.length, 30);
  assert.equal(ANSWERS_TO_DIRECTIONS[15], 7261);   // knows, Commoners, tier 0
  // The tier is stable per NPC seed; personality 50 -> reaction 15
  // beats any roll <= 15 into tier 1+ (rollToBeat is 0..20)
  const t1 = reactionTier(50, 42);
  assert.equal(reactionTier(50, 42), t1, 'NPC-stable');
  assert.ok(t1 >= 0 && t1 <= 2);
  // whereIsAnswer picks from the knows half for Commoners
  const a = whereIsAnswer([0, 0, 0], { position: [10, 0, 0] }, 50, 42);
  assert.equal(a.direction, 'east');
  assert.ok([7261, 7276, 7291].includes(a.textId));
});

test('talkTopics: the knowledge roll (T3e) - seed-stable, both table halves reachable', () => {
  // Commoners on a local building: rollToBeat = knowledgeModifiers[0]
  // + 10 = 15 (rand 1..20 <= 15 knows - 75% per NPC/building pair)
  assert.equal(KNOWLEDGE_MODIFIERS[0] + 10, 15);
  // MakeBuildingKey verbatim incl. the 0 -> 1<<24 sentinel
  assert.equal(makeBuildingKey(2, 1, 3), (2 << 16) + (1 << 8) + 3);
  assert.equal(makeBuildingKey(0, 0, 0), BUILDING_KEY_0);
  // hand-reproduce the seeded roll; the same (NPC, building) pair
  // always answers the same
  const byHand = (seed, key) => { srand((seed + key) >>> 0); return randomRangeInclusive(1, 20) <= 15; };
  let knowCount = 0;
  for (let s = 0; s < 200; s++) {
    const k = npcKnowsAboutItem(s, 12345);
    assert.equal(k, byHand(s, 12345));
    assert.equal(npcKnowsAboutItem(s, 12345), k, 'seed-stable');
    if (k) knowCount++;
  }
  assert.ok(knowCount > 100 && knowCount < 200, `both halves reachable: ${knowCount}/200 know`);
  // whereIsAnswer draws the matching table HALF (first 15 = doesn't)
  const b = { position: [10, 0, 0], buildingKey: 12345 };
  for (let s = 0; s < 50; s++) {
    const a = whereIsAnswer([0, 0, 0], b, 50, s);
    assert.equal(ANSWERS_TO_DIRECTIONS.indexOf(a.textId) >= 15, a.knows);
  }
});

test('talkTopics: the answer is invariant under a pure frame translation (T3d)', () => {
  // The streaming host resolves doors and the player in the pixel's
  // LOCATION frame through the floating-origin translation - a pure
  // translation of BOTH positions must never change the answer.
  const building = { position: [10, 0, 30] };
  const base = whereIsAnswer([2, 0, -5], building, 50, 7);
  const t = [1234.5, -20, -987.25];
  const shifted = whereIsAnswer(
    [2 - t[0], 0 - t[1], -5 - t[2]],
    { position: [10 - t[0], 0 - t[1], 30 - t[2]] }, 50, 7);
  assert.deepEqual(shifted, base);
  assert.equal(base.direction, 'north');   // dx 8, dz 35 -> the 67.5..112.5 band
});

test('talkTopics audit pin: the pool merge is bounded by the SUBRECORD count', () => {
  // DFU scans SubRecords.Length entries - a named-type entry PAST the
  // subrecord count is header garbage and must never draw from the
  // pool (it would misalign every later name).
  const mkData = (type, seed = 0) => ({ nameSeed: seed, factionId: 0, sector: 0, locationId: 0, quality: 0, buildingType: type });
  const dfBlock = { rmbBlock: {
    fldHeader: { buildingDataList: [mkData(15), mkData(17), mkData(15), mkData(15)] },   // tavern, house, tavern(garbage), tavern(garbage)
    subRecords: [{}, {}],   // only TWO real subrecords
  } };
  const blocks = [{ dfBlock, originX: 0, originZ: 0 }];
  const pool = [
    { nameSeed: 111, factionId: 0, sector: 0, locationId: 0, quality: 5, buildingType: 15 },
    { nameSeed: 222, factionId: 0, sector: 0, locationId: 0, quality: 6, buildingType: 15 },
  ];
  const merged = mergeNamedBuildings(pool, blocks);
  const list = merged.get(blocks[0]);
  assert.equal(list[0].nameSeed, 111, 'the real tavern draws the first pool entry');
  assert.equal(list[2].nameSeed, 0, 'the garbage entry past the subrecord count draws NOTHING');
  assert.equal(list[3].nameSeed, 0);
});

test('talkTopics: the named-building pool merge over the real Daggerfall city', { skip: skipReal }, () => {
  const maps = new MapsFile();
  maps.load(
    new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))),
    new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))),
    new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  const blocksFile = new BlocksFile();
  blocksFile.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const dfLocation = maps.getLocationByName('Daggerfall', 'Daggerfall');
  const loc = layoutLocation(dfLocation, maps, blocksFile);
  const merged = mergeNamedBuildings(dfLocation.exterior.buildings, loc.blocks);
  assert.equal(merged.size, loc.blocks.length);
  // The city pool distributes: SOME named building landed a real seed
  let named = 0, taverns = 0;
  for (const b of loc.blocks) {
    for (const d of merged.get(b)) {
      if (isNamedBuildingType(d.buildingType)) named++;
      if (d.buildingType === BUILDING_TYPES.Tavern) taverns++;
    }
  }
  assert.ok(named > 20, `named buildings merged: ${named}`);
  assert.ok(taverns > 3, `taverns present: ${taverns}`);
  // The directory names real taverns via fake single doors per block
  const doors = loc.blocks.flatMap((b) =>
    merged.get(b).map((d, i) => ({ dfBlock: b.dfBlock, recordIndex: i, position: [b.originX + 50, 0, b.originZ + 50] })));
  const dir = buildBuildingDirectory(dfLocation.exterior.buildings, loc.blocks, doors, {
    locationName: 'Daggerfall', regionName: 'Daggerfall', nameBank: 0, regentRuler: 1,
  });
  const tavernNames = dir.filter((d) => d.buildingType === BUILDING_TYPES.Tavern).map((d) => d.name);
  assert.ok(tavernNames.length > 3, `tavern names: ${tavernNames.length}`);
  for (const n of tavernNames) {
    assert.match(n, /^The .+ .+$/, `a classic two-part tavern name: ${n}`);
  }
});
