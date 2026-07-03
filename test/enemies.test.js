import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { srand, randomRangeInclusive } from '../src/formats/dfRandom.js';
import { ENCOUNTER_TABLES } from '../src/characters/encounterTables.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import {
  chooseRandomEnemyType, collectDungeonEnemies, makeSlotRng,
} from '../src/characters/dungeonEnemies.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { layoutDungeon } from '../src/world/dungeonLayout.js';
import { dfMeshToModel } from '../src/world/meshReader.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('enemies: encounter tables extracted whole', () => {
  assert.equal(ENCOUNTER_TABLES.length, 45);
  for (const t of ENCOUNTER_TABLES) assert.equal(t.length, 20);
  // Underwater (19) leads with Slaughterfish; Crypt (0) with Rat.
  assert.equal(ENCOUNTER_TABLES[19][0], MOBILE_TYPES.Slaughterfish);
  assert.equal(ENCOUNTER_TABLES[19][1], MOBILE_TYPES.Slaughterfish);
  assert.equal(ENCOUNTER_TABLES[0][0], MOBILE_TYPES.Rat);
  // Every table entry maps to a known enemy record.
  for (const t of ENCOUNTER_TABLES) for (const id of t) assert.ok(ENEMY_BASICS[id], `basics for ${id}`);
});

test('enemies: chooseRandomEnemyType matches a manual classic replay', () => {
  const table = ENCOUNTER_TABLES[0];
  const level = 1;
  srand(4242);
  const picks = Array.from({ length: 8 }, () => chooseRandomEnemyType(table, level));
  srand(4242);
  const manual = Array.from({ length: 8 }, () => {
    let minI = 0;
    let maxI = table.length;
    const r = randomRangeInclusive(1, 100);
    if (r > 95 && level <= 5) maxI = level + 2;
    else if (r > 80) maxI = level + 1;
    else { minI = level - 3; maxI = level + 3; }
    if (minI < 0) { minI = 0; maxI = 5; }
    else if (maxI > 19) { minI = 14; maxI = 19; }
    return table[randomRangeInclusive(minI, maxI)];
  });
  assert.deepEqual(picks, manual);
});

test('enemies: fixed decode, 99 skip, passive, gender, water veto', () => {
  const block = (markers, waterLevel = 10000) => ({ markers, waterLevel, originX: 0, originZ: 0 });
  const base = { x: 1, y: 2, z: 3, rawY: 0, flags: 0, soundIndex: 7, actionByte: 0 };
  // Fixed: 0xff mask (garbage MSBs), 99 skipped.
  let out = collectDungeonEnemies([block([
    { ...base, record: 16, factionOrMobileId: (0xab << 8) | 32 },
    { ...base, record: 16, factionOrMobileId: 99 },
  ])], { locationId: 1, dungeonType: 0 });
  assert.equal(out.length, 1);
  assert.equal(out[0].mobileType, 32);
  assert.equal(out[0].fixed, true);
  assert.equal(out[0].spawnDistanceType, 7);
  assert.equal(out[0].reaction, 'hostile');
  // Passive action byte 99; human gender flags (>43).
  out = collectDungeonEnemies([block([
    { ...base, record: 16, factionOrMobileId: 50, actionByte: 99, flags: 1 },
  ])], { locationId: 1, dungeonType: 0 });
  assert.equal(out[0].reaction, 'passive');
  assert.equal(out[0].gender, 'female');
  // Water veto: Slaughterfish with no water is dropped; with water kept.
  const fishFixed = { ...base, record: 16, factionOrMobileId: MOBILE_TYPES.Slaughterfish, rawY: 500 };
  out = collectDungeonEnemies([block([fishFixed], 10000)], { locationId: 1, dungeonType: 0 });
  assert.equal(out.length, 0);
  out = collectDungeonEnemies([block([fishFixed], 400)], { locationId: 1, dungeonType: 0 });
  assert.equal(out.length, 1);
});

test('enemies: random slot semantics + water table routing', () => {
  const block = (markers, waterLevel) => ({ markers, waterLevel, originX: 10, originZ: 20 });
  const base = { x: 0, y: 0, z: 0, soundIndex: 0, actionByte: 0, factionOrMobileId: 0 };
  // slot = flags picks the pre-rolled table entry deterministically.
  const a = collectDungeonEnemies([block([{ ...base, record: 15, rawY: 0, flags: 5 }], 10000)],
    { locationId: 777, dungeonType: 0 });
  const b = collectDungeonEnemies([block([{ ...base, record: 15, rawY: 0, flags: 5 }], 10000)],
    { locationId: 777, dungeonType: 0 });
  assert.deepEqual(a, b);
  assert.equal(a[0].x, 10);
  assert.equal(a[0].z, 20);
  // Under the water level (classic: greater raw y = lower), the water
  // table serves - at level 1 its picks are Slaughterfish-banded, and
  // the veto keeps them (waterLevel - 20 <= rawY).
  const w = collectDungeonEnemies([block([{ ...base, record: 15, rawY: 900, flags: 3 }], 800)],
    { locationId: 777, dungeonType: 0 });
  assert.equal(w.length, 1);
  // slot 0 rerolls 1..6 on the deterministic stand-in stream.
  const rng = makeSlotRng(777);
  for (let i = 0; i < 200; i++) {
    const v = rng(1, 7);
    assert.ok(v >= 1 && v <= 6);
  }
});

test('enemies: Privateer\'s Hold corpus pin', { skip: skipReal }, () => {
  const blocks = new BlocksFile();
  blocks.load(readFileSync(join(ARENA2, 'BLOCKS.BSA')));
  const maps = new MapsFile();
  maps.load(readFileSync(join(ARENA2, 'MAPS.BSA')),
    readFileSync(join(ARENA2, 'CLIMATE.PAK')), readFileSync(join(ARENA2, 'POLITIC.PAK')));
  const arch = new Arch3dFile();
  arch.load(readFileSync(join(ARENA2, 'ARCH3D.BSA')));
  const dfLocation = maps.getLocationByName('Daggerfall', "Privateer's Hold");
  const pre = new Map();
  const getModel = (id) => {
    if (!pre.has(id)) pre.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 1, height: 1 })));
    return pre.get(id);
  };
  const dungeon = layoutDungeon(dfLocation, blocks, getModel);
  const enemies = collectDungeonEnemies(
    dungeon.blocks.map((b) => ({
      markers: b.layout.markers, waterLevel: b.layout.waterLevel,
      originX: b.originX, originZ: b.originZ,
    })),
    {
      locationId: dfLocation.dungeon.recordElement.header.locationId,
      dungeonType: dfLocation.mapTableData.dungeonType,
    });
  const fixed = enemies.filter((e) => e.fixed).length;
  console.log(`privateers hold: ${enemies.length} enemies (${fixed} fixed), types [${[...new Set(enemies.map((e) => e.mobileType))].sort((a, b) => a - b)}]`);
  // Pinned at C3 (playerLevel 1, LocationId-seeded classic tables).
  assert.equal(enemies.length, 42);
  assert.equal(fixed, 25);
  assert.deepEqual([...new Set(enemies.map((e) => e.mobileType))].sort((a, b) => a - b),
    [0, 1, 3, 4, 7, 15, 136, 138, 141]);
  for (const e of enemies) assert.ok(ENEMY_BASICS[e.mobileType], `basics ${e.mobileType}`);
});
