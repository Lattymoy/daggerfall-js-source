// DEX3 (2026-10-20, Mac: "I want to implement this as our next mod 1:1") - DAGGERFALL ENEMY EXPANSION'S ENCOUNTER TABLES.
// BestiaryMod.ParseEncounterTables (systems/enemyExpansion/dexTables.js) line for line, the first Update's defaults, and
// the picks (dexEncounters.js) - a dungeon's by its seed at the transition, a climate's on PlayerGPS's events
// (world/playerGps.js) - on the port's encounter table door (characters/encounterTableDoor.js), which every reader asks:
// the player's own rolls read the tables as the mod's events wrote them, and a roll every machine must agree on (a
// granted member's, a band's, a road's trouble) one of the mod's tables by its own die. Each pinned against the C#'s own
// law, and each with a mutation it must fail under (tools/mutants/dex3.json).
import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEX_TABLE_TEXT } from '../../../src/systems/enemyExpansion/dexTableText.js';
import { readEncounterTables, addDefaultEncounterTables, DEX_DEFAULT_TABLES } from '../../../src/systems/enemyExpansion/dexTables.js';
import { createDexEncounterSelector } from '../../../src/systems/enemyExpansion/dexEncounters.js';
import { installEnemyExpansion, _resetEnemyExpansion } from '../../../src/systems/enemyExpansion/dexInstall.js';
import {
  registerEncounterTableSelector, _resetEncounterTableSelectors, encounterTable, encounterTableChoices, encounterTableGeneration,
} from '../../../src/characters/encounterTableDoor.js';
import { onPlayerGpsEvents, readPlayerGps, resetPlayerGpsState, _resetPlayerGps } from '../../../src/world/playerGps.js';
import { ENCOUNTER_TABLES, CLIMATE_TABLE, chooseRandomEnemy, intermittentEnemySpawn } from '../../../src/systems/encounters.js';
import { rollGroupComposition, rollCampEncounter, rollCampEncountersOnChunkLoad } from '../../../src/systems/campEncounters.js';
import { collectDungeonEnemies, dungeonPlace } from '../../../src/characters/dungeonEnemies.js';
import { grantSpecies, grantSpeciesOf } from '../../../src/scenes/grantHost.js';
import { grantDice } from '../../../src/net/grantLaw.js';
import { srand, rand, getSeed } from '../../../src/formats/dfRandom.js';
import { MapsFile, DUNGEON_TYPES, CLIMATES } from '../../../src/formats/mapsFile.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { _resetFoeGhosts } from '../../../src/characters/enemy/foeLook.js';
import { _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const silent = () => {};
const shipped = () => Object.entries(DEX_TABLE_TEXT).filter(([n]) => n.endsWith('.tdb.csv')).map(([n, t]) => [n.replace(/\.csv$/, ''), t]);
const readShipped = (log = silent) => addDefaultEncounterTables(readEncounterTables(shipped(), log), (i) => ENCOUNTER_TABLES[i], log);
const reset = () => {
  _resetEncounterTableSelectors(); _resetPlayerGps();
  _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetFoeGhosts(); _resetExtraQuestRows();
};
/** A die that answers `values` in turn, and counts. */
const dice = (values) => { const f = () => { if (f.n >= values.length) throw new Error('a draw past the script'); return values[f.n++]; }; f.n = 0; return f; };
const noDraw = () => { throw new Error('no draw is spent'); };
/** DFRandom's first rand() after srand(seed), off the C#'s own LCG in BigInt - an oracle the port's dfRandom.js is not. */
const firstRand = (seed) => Number((((BigInt(seed >>> 0) * 1103515245n) + 12345n) & 0xffffffffn) >> 16n) & 0x7fff;
const twenty = (id) => Array.from({ length: 20 }, () => id);

test('DEX3 the reading: the shipped tables read clean - thirty-nine, one an index but the Laboratory\'s two, the thirty-eight defaults each named at its own index', () => {
  const log = [];
  const read = readEncounterTables(shipped(), (l, m) => log.push(`${l} ${m}`));
  assert.deepEqual(log, [], 'every line the C# reads, read');
  assert.equal(read.tables.size, 39);
  assert.deepEqual([...read.byIndex.keys()].sort((a, b) => a - b), Array.from({ length: 38 }, (_, i) => i));
  for (const [i, list] of read.byIndex) assert.equal(list.length, i === 9 ? 2 : 1, `index ${i}`);
  assert.deepEqual(read.byIndex.get(9).map((t) => t.name), ['DefaultLaboratory', 'DwarvenLab'], 'in reading order');
  // the defaults CreateDefaultTable names (the 19 DungeonTypes, the water, the six climates' three) are the mod's own
  // replacement lines, in the C#'s order, each at the index the C# makes it for
  const names = shipped()[0][1].split('\r\n').slice(1, 39).map((l) => l.split(',')[0]);
  assert.deepEqual([...DEX_DEFAULT_TABLES], names);
  DEX_DEFAULT_TABLES.forEach((n, i) => assert.deepEqual(read.tables.get(n).tableIndices, [i], n));
  assert.equal(DEX_DEFAULT_TABLES[18], 'DefaultCemetery'); assert.equal(DEX_DEFAULT_TABLES[19], 'DefaultUnderwater'); assert.equal(DEX_DEFAULT_TABLES[37], 'DefaultHauntedNight');
  // the first Update adds none: every default is named
  const before = read.tables.size;
  addDefaultEncounterTables(read, (i) => ENCOUNTER_TABLES[i], (l, m) => log.push(`${l} ${m}`));
  assert.equal(read.tables.size, before); assert.deepEqual(log, []);
});

test('DEX3 every id the tables name is an enemy the install stands - the classic\'s and the mod\'s fifty', (t) => {
  t.after(reset);
  installEnemyExpansion({ on: false, log: silent });
  const read = readShipped();
  for (const [name, table] of read.tables) for (const id of table.enemyIds) assert.ok(ENEMY_BASICS[id], `${name}: ${id}`);
  assert.ok([...read.tables.values()].some((tb) => tb.enemyIds.some((id) => id >= 256)), 'the mod\'s own among them');
});

test('DEX3 ParseEncounterTables line for line: a replacement moves only to other, named indices; a new table needs its indices and joins them before its ids parse; a short line, a short header, a new table with no indices refused', () => {
  const ids = (a, n = 19) => Array.from({ length: n }, (_, k) => a + k).join(',');
  const head = ['Name', 'Table Indices', ...Array.from({ length: 19 }, (_, k) => k + 1)].join(',');
  const headNo = ['Name', ...Array.from({ length: 20 }, (_, k) => k + 1)].join(',');
  const a = [head, `T1,3;4,${ids(100)}`, `T2,4,${ids(200)}`, `T1,5,${ids(300)}`, `T2,4,${ids(400)}`, `T3,6,1,2,x,${ids(10, 16)}`, 'Short,1,2', `T4,,${ids(500)}`, `T1,,${ids(700)}`].join('\r\n');
  const b = [headNo, `T2,${ids(600, 20)}`, `T9,${ids(900, 20)}`].join('\r\n');
  const c = ['Name,Table Indices,1,2', `T5,7,${ids(1)}`].join('\r\n');
  const log = [];
  const read = readEncounterTables([['A.tdb', a], ['B.tdb', b], ['C.tdb', c]], (l, m) => log.push(m));
  assert.deepEqual(read.byIndex.get(3), [], 'moved off its old indices (RemoveAll)');
  assert.deepEqual(read.byIndex.get(4).map((tb) => tb.name), ['T2'], 'T1 gone from 4; T2 named the same indices and stayed');
  assert.deepEqual(read.byIndex.get(5).map((tb) => tb.name), ['T1'], 'and added to the new');
  assert.deepEqual(read.tables.get('T1').tableIndices, [5], 'an empty cell moves nothing');
  assert.deepEqual(read.tables.get('T1').enemyIds, ids(700).split(',').map(Number), 'the last line\'s ids');
  assert.deepEqual(read.tables.get('T2').enemyIds, ids(600, 20).split(',').map(Number), 'a file with no indices column: the ids from column 2');
  assert.deepEqual(read.byIndex.get(6).map((tb) => [tb.name, tb.enemyIds]), [['T3', null]], 'added to its index before its ids threw');
  assert.equal(read.tables.has('T3'), false, 'and never to the tables');
  assert.deepEqual(read.tables.get('T4').tableIndices, [], 'a new table with an empty cell joins no index');
  assert.equal(read.tables.has('T9'), false); assert.equal(read.tables.has('T5'), false);
  assert.equal(log.length, 4);
  assert.match(log[0], /A\.tdb:6: /); assert.match(log[1], /A\.tdb:7: table database line has invalid format/);
  assert.match(log[2], /table indices not specified/); assert.match(log[3], /C\.tdb: table database has invalid format/);
});

test('AUDIT DEX C8 the names are OrdinalIgnoreCase (BestiaryMod.cs:88): a line in another case replaces the table, which keeps its first name - and the C#\'s RemoveAll, ordinal, leaves it on its old indices; the header\'s "Table Indices" in any case (InvariantCultureIgnoreCase)', () => {
  const ids = (a, n = 19) => Array.from({ length: n }, (_, k) => a + k).join(',');
  const head = ['Name', 'TABLE INDICES', ...Array.from({ length: 19 }, (_, k) => k + 1)].join(',');
  const log = [];
  const read = readEncounterTables([['A.tdb', [head, `Crypt,3,${ids(100)}`, `CRYPT,4,${ids(200)}`, `crypt,,${ids(300)}`].join('\n')]], (l, m) => log.push(m));
  assert.deepEqual(log, [], 'the header has its indices column - else the first line, a new table, would be refused');
  assert.equal(read.tables.size, 1, 'one table, three lines');
  const t = read.tables.get('cRyPt');
  assert.equal(t.name, 'Crypt', 'the name it was added under');
  assert.deepEqual(t.tableIndices, [4]); assert.deepEqual(t.enemyIds, ids(300).split(',').map(Number), 'the last line\'s ids');
  assert.deepEqual(read.byIndex.get(3).map((tb) => tb.name), ['Crypt'], 'RemoveAll(t => t.name == "CRYPT") removed nothing');
  assert.deepEqual(read.byIndex.get(4).map((tb) => tb.name), ['Crypt']);
  const noIdx = readEncounterTables([['B.tdb', [['Name', 'Table Index', ...Array.from({ length: 19 }, (_, k) => k + 1)].join(','), `New,${ids(1, 20)}`].join('\n')]], (l, m) => log.push(m));
  assert.equal(noIdx.tables.size, 0); assert.match(log[0], /table indices not specified/, 'any other header: no indices column');
});

test('DEX3 the first Update\'s defaults: an index the mod named no default for takes DFU\'s own table, copied; a default moved off its index leaves it empty, and says so', () => {
  const head = ['Name', 'Table Indices', ...Array.from({ length: 19 }, (_, k) => k + 1)].join(',');
  const read = readEncounterTables([['A.tdb', [head, `DefaultCrypt,40,${Array.from({ length: 19 }, () => 260).join(',')}`].join('\r\n')]]);
  const log = [];
  addDefaultEncounterTables(read, (i) => ENCOUNTER_TABLES[i], (l, m) => log.push(m));
  assert.deepEqual(log, ["[DEX] Encounter index 'DefaultCrypt' has no tables"]);
  assert.equal(read.byIndex.get(0), undefined, 'the named default is not made again');
  for (let i = 1; i < 38; i++) {
    const [tb] = read.byIndex.get(i);
    assert.equal(tb.name, DEX_DEFAULT_TABLES[i]); assert.equal(tb.tableIndices, null);
    assert.deepEqual(tb.enemyIds, ENCOUNTER_TABLES[i]); assert.notEqual(tb.enemyIds, ENCOUNTER_TABLES[i], 'a copy (Select(...).ToArray())');
  }
});

test('DEX3 a dungeon\'s table: srand((ushort)Unknown2 ^ ((byte)region << 8)) and one rand() % count - the same pick every read, the generator put back', () => {
  const read = readShipped();
  const sel = createDexEncounterSelector(read, { random: noDraw });
  const labs = read.byIndex.get(9).map((tb) => tb.enemyIds);
  const seen = new Set();
  for (const [unknown2, region] of [[138, 0], [62, 1], [73, 1], [114, 1], [175, 1], [219, 1], [0xffff, 61], [0, 0]]) {
    const want = labs[firstRand((unknown2 & 0xffff) ^ ((region & 0xff) << 8)) % 2];
    assert.equal(sel.table(9, { dungeon: { unknown2, region } }), want, `${unknown2}:${region}`);
    assert.equal(sel.table(9, { dungeon: { unknown2: unknown2 + 0x10000, region } }), want, 'the cast: a ushort');
    assert.equal(sel.table(9, { dungeon: { unknown2, region: region + 0x100 } }), want, 'the cast: a byte');
    assert.equal(sel.table(9, { local: true }), want, 'and the write stands for the player\'s later rolls');
    seen.add(want);
  }
  assert.equal(seen.size, 2, 'both tables are picked');
  assert.equal(sel.table(0, { dungeon: { unknown2: 5, region: 3 } }), read.byIndex.get(0)[0].enemyIds, 'one table: that one');
  srand(777); rand(); rand();
  const was = getSeed();
  sel.table(19, { dungeon: { unknown2: 99, region: 7 } });
  assert.equal(getSeed(), was, 'the shared stream as the pick found it');
  assert.equal(sel.table(25, { local: true }), null, 'an index no event has picked reads none of the mod\'s');
});

test('DEX3 with ARENA2: every one of MAPS.BSA\'s 4,232 dungeons has a type DFRegion.DungeonTypes defines (PreTransition\'s guard has no arm), and its 190 laboratories split between the mod\'s two', { skip: skipReal }, () => {
  const rd = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const maps = new MapsFile();
  maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const defined = new Set(Object.values(DUNGEON_TYPES));
  const sel = createDexEncounterSelector(readShipped(), { random: noDraw });
  const labs = readShipped().byIndex.get(9).map((tb) => tb.enemyIds.join());
  let n = 0;
  const picks = new Map();
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r);
    for (let l = 0; l < (reg?.locationCount ?? 0); l++) {
      const loc = maps.getLocation(r, l);
      if (!loc?.hasDungeon) continue;
      n++;
      assert.ok(defined.has(loc.mapTableData.dungeonType), `${loc.name}: ${loc.mapTableData.dungeonType}`);
      if (loc.mapTableData.dungeonType !== 9) continue;
      const pick = sel.table(9, dungeonPlace(loc)).join();
      const name = pick === labs[0] ? 'DefaultLaboratory' : pick === labs[1] ? 'DwarvenLab' : '?';
      picks.set(name, (picks.get(name) ?? 0) + 1);
    }
  }
  assert.equal(n, 4232);
  assert.equal([...picks.values()].reduce((s, v) => s + v, 0), 190);
  assert.equal(picks.has('?'), false);
  assert.ok(picks.get('DefaultLaboratory') > 0 && picks.get('DwarvenLab') > 0, JSON.stringify([...picks]));
});

test('DEX3 PlayerGPS\'s events: the climate first, then the rect - each on its edge, the trackers starting where PlayerGPS.Start leaves them', (t) => {
  t.after(reset);
  const heard = [];
  onPlayerGpsEvents({
    climateIndexChanged: (c) => heard.push(`climate ${c}`), enterLocationRect: (c) => heard.push(`enter ${c}`), exitLocationRect: (c) => heard.push(`exit ${c}`),
  });
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: true });
  assert.deepEqual(heard, [`climate ${CLIMATES.Woodlands}`, `enter ${CLIMATES.Woodlands}`], 'the first reading: the climate off 0, the rect off false');
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: true });
  readPlayerGps({});
  assert.equal(heard.length, 2, 'no edge, no event; a reading with nothing in it raises nothing');
  readPlayerGps({ climateIndex: CLIMATES.Desert, inLocationRect: false });
  assert.deepEqual(heard.slice(2), [`climate ${CLIMATES.Desert}`, `exit ${CLIMATES.Desert}`], 'the exit reads the climate RaiseEvents already moved');
});

test('DEX3 a climate\'s tables: a climate change and a rect\'s exit pick its day and night, an entry its city night - UnityEngine.Random over the index\'s tables, written until the next', (t) => {
  t.after(reset);
  const two = (i) => [{ name: `a${i}`, enemyIds: twenty(1000 + i) }, { name: `b${i}`, enemyIds: twenty(2000 + i) }];
  const byIndex = new Map(Array.from({ length: 18 }, (_, k) => [20 + k, two(20 + k)]));
  const random = dice([0.9, 0.1, 0.6, 0.2, 0.7, 0.4, 0.3, 0.8, 0.5, 0.99, 0.0]);
  const sel = createDexEncounterSelector({ byIndex }, { random });
  onPlayerGpsEvents(sel.gps);
  const at = (i) => sel.table(i, { local: true })?.[0];
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: false });
  assert.equal(random.n, 2); assert.deepEqual([at(33), at(34), at(32)], [2033, 1034, undefined], 'the day, then the night (:1812-1816); the city night unpicked');
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: true });
  assert.equal(random.n, 3); assert.equal(at(32), 2032, 'the entry: its city night (:1861-1864)');
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: false });
  assert.equal(random.n, 5); assert.deepEqual([at(33), at(34)], [1033, 2034], 'the exit: the day and night again (:1831-1834)');
  readPlayerGps({ climateIndex: CLIMATES.Desert, inLocationRect: true });
  assert.equal(random.n, 8); assert.deepEqual([at(21), at(22), at(20)], [1021, 1022, 2020], 'a new climate and an entry in one reading: its day and night, then its city night');
  readPlayerGps({ climateIndex: CLIMATES.Desert2, inLocationRect: true });
  assert.equal(random.n, 10); assert.deepEqual([at(21), at(22)], [2021, 2022], 'Desert2 is a climate of its own, the same tables');
  readPlayerGps({ climateIndex: CLIMATES.Ocean, inLocationRect: false });
  assert.equal(random.n, 10, 'the Ocean picks nothing, nor its exit (SelectClimateTables has no arm for it)');
  assert.deepEqual([...CLIMATE_TABLE].map(([c, band]) => [c, band]).filter(([c]) => c === CLIMATES.Swamp || c === CLIMATES.MountainWoods), [[CLIMATES.Swamp, [32, 33, 34]], [CLIMATES.MountainWoods, [32, 33, 34]]], 'the swamp and the mountain woods are the woodlands\' (:1812-1816)');
  assert.deepEqual(sel.choices(33), [twenty(1033), twenty(2033)]);
  assert.equal(sel.choices(5), null);
});

test('AUDIT DEX C1 PlayerGPS.ResetState: a load\'s start and a fast travel\'s end drop the rect flag and raise nothing, so the arrival in a town - another climate\'s, or the very town left - raises its entry and draws its city night; the jump core plays it on the two jumps that raise it in DFU', (t) => {
  t.after(reset);
  const two = (i) => [{ name: `a${i}`, enemyIds: twenty(1000 + i) }, { name: `b${i}`, enemyIds: twenty(2000 + i) }];
  const byIndex = new Map(Array.from({ length: 18 }, (_, k) => [20 + k, two(20 + k)]));
  const random = dice([0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.1]);
  const sel = createDexEncounterSelector({ byIndex }, { random });
  const heard = [];
  onPlayerGpsEvents(sel.gps);
  onPlayerGpsEvents({ climateIndexChanged: (c) => heard.push(`climate ${c}`), enterLocationRect: (c) => heard.push(`enter ${c}`), exitLocationRect: (c) => heard.push(`exit ${c}`) });
  const at = (i) => sel.table(i, { local: true })?.[0];
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: true });
  assert.equal(random.n, 3, 'a woodlands town: its day, its night, its city night');
  for (const jump of [null, undefined, 'recall']) resetPlayerGpsState(jump);
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: true });
  assert.equal(heard.length, 2, 'a jump that names no DFU event (a Recall, a guild\'s teleport, a respawn) keeps the flag - no second entry');
  resetPlayerGpsState('travel');
  assert.equal(heard.length, 2, 'ResetState raises nothing - no exit across the jump');
  readPlayerGps({ climateIndex: CLIMATES.Mountain, inLocationRect: true });
  assert.deepEqual(heard.slice(2), [`climate ${CLIMATES.Mountain}`, `enter ${CLIMATES.Mountain}`], 'the arrival in a mountain town: the climate, then the entry');
  assert.equal(random.n, 6); assert.deepEqual([at(24), at(25), at(23)], [2024, 2025, 2023], 'and the mountain\'s city night is drawn (:1849-1850) - not left at whatever the index held');
  readPlayerGps({ climateIndex: CLIMATES.Mountain, inLocationRect: true });
  assert.equal(random.n, 6, 'no jump, no edge');
  resetPlayerGpsState('load');
  readPlayerGps({ climateIndex: CLIMATES.Mountain, inLocationRect: true });
  assert.deepEqual(heard.slice(4), [`enter ${CLIMATES.Mountain}`], 'a load in the town it was saved in: a second entry, no climate (ResetState leaves lastClimateIndex)');
  assert.equal(random.n, 7); assert.equal(at(23), 1023, 'and its city night drawn again');
  const world = readFileSync(join(import.meta.dirname, '../../../src/scenes/world.js'), 'utf8');
  const core = world.slice(world.indexOf('async function _teleportToPixel('), world.indexOf('routByJump();', world.indexOf('async function _teleportToPixel(')));
  assert.match(core, /_wasInLocationRect = false;[^\n]*\n\s*resetPlayerGpsState\(modEvent\);/, 'the jump core hands the GPS every jump\'s kind beside the host\'s own flag - which reset is the module\'s (HOST-SPLIT, at DEX\'s merge)');
  assert.deepEqual([...new Set([...world.matchAll(/\bmodEvent: '(\w+)'/g)].map((m) => m[1]))].sort(), ['load', 'travel'], 'and the only events a jump names are the two PlayerGPS resets on (OnStartLoad, OnPostFastTravel) - a Recall or a teleport names none, and DFU keeps the flag across it');
});

test('DEX3 a table whose ids would not parse is in its index\'s list and is never written, nor a choice - the C#\'s Select throws before the write', () => {
  const byIndex = new Map([[33, [{ name: 'bad', enemyIds: null }, { name: 'good', enemyIds: twenty(7) }]]]);
  const random = dice([0.0, 0.9, 0.0]);
  const sel = createDexEncounterSelector({ byIndex }, { random });
  sel.gps.climateIndexChanged(CLIMATES.Woodlands);
  assert.equal(random.n, 1, 'an index with no tables draws nothing (SelectTable returns first)');
  assert.equal(sel.table(33, { local: true }), null, 'the pick landed on the broken table: nothing written');
  sel.gps.climateIndexChanged(CLIMATES.Woodlands);
  assert.deepEqual(sel.table(33, { local: true }), twenty(7));
  sel.gps.climateIndexChanged(CLIMATES.Woodlands);
  assert.deepEqual(sel.table(33, { local: true }), twenty(7), 'a pick on it later leaves the last write standing');
  assert.deepEqual(sel.choices(33), [twenty(7)]);
});

test('DEX3 the door: no selector, DFU\'s own table for every read and no draw; a selector\'s writes for the player\'s own rolls and a dungeon\'s, one of its choices by the roll\'s own die for any other', (t) => {
  t.after(reset);
  for (let i = 0; i < ENCOUNTER_TABLES.length; i++) {
    assert.equal(encounterTable(i, null, noDraw), ENCOUNTER_TABLES[i]); assert.equal(encounterTable(i, { local: true }), ENCOUNTER_TABLES[i]);
    assert.deepEqual(encounterTableChoices(i), [ENCOUNTER_TABLES[i]]);
  }
  assert.equal(encounterTable(45), null); assert.deepEqual(encounterTableChoices(45), []);
  const A = twenty(1), B = twenty(2), W = twenty(3);
  const gen = encounterTableGeneration();
  assert.throws(() => registerEncounterTableSelector({ table: () => null }), /choices/);
  registerEncounterTableSelector({ table: (i) => (i === 33 ? W : null), choices: (i) => (i === 33 ? [A, B] : null) });
  assert.equal(encounterTableGeneration(), gen + 1, 'the generation moves with the selectors');
  assert.equal(encounterTable(33, { local: true }), W); assert.equal(encounterTable(34, { local: true }), ENCOUNTER_TABLES[34], 'unwritten: DFU\'s');
  assert.equal(encounterTable(33, { dungeon: { unknown2: 1, region: 2 } }), W);
  assert.throws(() => encounterTable(33), /its own die/, 'a roll every machine agrees on never picks without one');
  assert.equal(encounterTable(33, null, () => 0.75), B); assert.equal(encounterTable(33, { climateIndex: 1 }, () => 0.2), A);
  assert.equal(encounterTable(34, null, noDraw), ENCOUNTER_TABLES[34], 'one choice: no draw');
  assert.deepEqual(encounterTableChoices(33), [A, B]);
  _resetEncounterTableSelectors();
  assert.equal(encounterTableGeneration(), gen + 2);
  assert.equal(encounterTable(33, { local: true }), ENCOUNTER_TABLES[33]);
});

const WOOD_DAY = { climateIndex: CLIMATES.Woodlands, inLocationRect: false, isDay: true, playerLevel: 1 };

test('DEX3 the readers: chooseRandomEnemy reads the table first - the player\'s own as written, any other by its die among the choices - and spends no draw where there is one table', (t) => {
  t.after(reset);
  const plain = dice([0.0, 0.0]);
  assert.equal(chooseRandomEnemy(WOOD_DAY, plain), ENCOUNTER_TABLES[33][0]); assert.equal(plain.n, 2, 'DFU\'s two draws, Dice100 and the pick');
  const A = twenty(11), B = twenty(12), W = twenty(13);
  registerEncounterTableSelector({ table: (i) => (i === 33 ? W : null), choices: (i) => (i === 33 ? [A, B] : null) });
  assert.equal(chooseRandomEnemy(WOOD_DAY, dice([0.75, 0.0, 0.0])), 12, 'agreed: the die picks the table, then Dice100, then the pick');
  assert.equal(chooseRandomEnemy({ ...WOOD_DAY, local: true }, dice([0.0, 0.0])), 13, 'the player\'s own: as written');
  assert.equal(chooseRandomEnemy({ ...WOOD_DAY, table: A }, dice([0.0, 0.0])), 11, 'handed in');
});

test('DEX3 the player\'s own rolls are its PlayerGPS reading: the decision raises the events every minute it runs out of doors - never indoors - and reads as written; a dungeon\'s rest reads the transition\'s pick', (t) => {
  t.after(reset);
  const heard = [];
  onPlayerGpsEvents({ climateIndexChanged: (c) => heard.push(c) });
  const W = twenty(13);
  registerEncounterTableSelector({ table: (i, place) => (i === 33 && place?.local ? W : null), choices: () => null });
  const out = { gameMinutes: 12, skyMinutes: 720, inside: false, inLocationRect: false, climateIndex: CLIMATES.Woodlands, playerLevel: 1 };
  assert.equal(intermittentEnemySpawn(out, noDraw), null, 'not the spawn\'s minute');
  assert.deepEqual(heard, [CLIMATES.Woodlands], 'the reading raised all the same');
  assert.equal(intermittentEnemySpawn({ ...out, gameMinutes: 0 }, dice([0.0, 0.0, 0.0])).mobileType, 13, 'the wilderness by day: the table as written');
  intermittentEnemySpawn({ ...out, climateIndex: CLIMATES.Desert, inside: true }, noDraw);
  assert.deepEqual(heard, [CLIMATES.Woodlands], 'indoors the place is no GPS reading');
  // AUDIT DEX C5: the camps' two rolls the hosts call - the street's minute (exterior.js rollCampEncounter) and the
  // world's chunk (world.js rollCampEncountersOnChunkLoad)
  rollCampEncounter({ ...out, climateIndex: CLIMATES.Mountain }, noDraw);
  assert.deepEqual(heard, [CLIMATES.Woodlands, CLIMATES.Mountain], 'a camp\'s minute is the player\'s reading too - its window shut or not');
  rollCampEncountersOnChunkLoad({ ...out, climateIndex: CLIMATES.Rainforest }, dice([0.99]));
  assert.deepEqual(heard, [CLIMATES.Woodlands, CLIMATES.Mountain, CLIMATES.Rainforest], 'and a chunk\'s - its chance missed or not');
  _resetEncounterTableSelectors();
  const sel = createDexEncounterSelector(readShipped(), { random: noDraw });
  registerEncounterTableSelector(sel);
  const pick = encounterTable(9, { dungeon: { unknown2: 138, region: 0 } });
  const rest = intermittentEnemySpawn({ gameMinutes: 0, inside: true, inDungeon: true, isResting: true, enemyAlertActive: true, dungeonType: 9, playerLevel: 1 }, dice([0.0, 0.0, 0.0]));
  assert.equal(rest.mobileType, pick[0], 'the rest roll: the population\'s pick, as the transition wrote it');
});

test('AUDIT DEX C7 one reading of the rect: the chunk-load camps hand PlayerGPS their pixel\'s climate and no rect - their ring of any town about the pixel is the camp gate\'s (DISC19-F), and the minute\'s roll reads PlayerGPS\'s own', (t) => {
  t.after(reset);
  const heard = [];
  onPlayerGpsEvents({ climateIndexChanged: (c) => heard.push(`climate ${c}`), enterLocationRect: (c) => heard.push(`enter ${c}`), exitLocationRect: (c) => heard.push(`exit ${c}`) });
  const wild = { gameMinutes: 12, skyMinutes: 720, inside: false, inLocationRect: false, climateIndex: CLIMATES.Woodlands, playerLevel: 1 };
  intermittentEnemySpawn(wild, noDraw);
  assert.deepEqual(heard, [`climate ${CLIMATES.Woodlands}`], 'the minute\'s roll, out of any rect');
  assert.equal(rollCampEncountersOnChunkLoad({ ...wild, inLocationRect: true, climateIndex: CLIMATES.Swamp }, noDraw), null, 'a chunk by a town\'s ring: the gate shuts, no draw');
  assert.deepEqual(heard, [`climate ${CLIMATES.Woodlands}`, `climate ${CLIMATES.Swamp}`], 'its climate raised, its ring no entry');
  intermittentEnemySpawn({ ...wild, climateIndex: CLIMATES.Swamp }, noDraw);
  assert.equal(heard.length, 2, 'and the next minute\'s roll, still out of the rect, sees no edge - no exit from an entry never raised');
  const world = readFileSync(join(import.meta.dirname, '../../../src/scenes/world.js'), 'utf8');
  const chunk = world.slice(world.indexOf('rollCampEncountersOnChunkLoad({'), world.indexOf('}, Math.random, { fovDegrees', world.indexOf('rollCampEncountersOnChunkLoad({')));
  assert.match(chunk, /inLocationRect: _inAnyLocationRect\(/, 'the world\'s chunk roll gates on the ring of any town (the reading this test hands it)');
  assert.match(chunk, /climateIndex: maps\.getClimateIndex\(r\.current\.x, r\.current\.y\)/, 'and its climate is the pixel just entered');
});

test('DEX3 a group\'s one table: rollGroupComposition reads it once, for the seed and every mate', (t) => {
  t.after(reset);
  let asked = 0;
  const orcs = [MOBILE_TYPES.Orc, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcShaman, MOBILE_TYPES.OrcWarlord];
  const A = Array.from({ length: 20 }, (_, k) => orcs[k % 4]), B = twenty(MOBILE_TYPES.Rat);
  registerEncounterTableSelector({ table: () => null, choices: (i) => { if (i !== 33) return null; asked++; return [A, B]; } });
  const r = (() => { let s = 7; return () => ((s = (Math.imul(s, 48271) % 2147483647 + 2147483647) % 2147483647) / 2147483647); })();
  const hit = rollGroupComposition({ climateIndex: CLIMATES.Woodlands, inLocationRect: false, gameMinutes: 720, playerLevel: 1, size: 4 }, r);
  assert.equal(asked, 1, 'one read of the choices, however many seeds it tries');
  assert.equal(hit.mobileTypes.length, 4);
  assert.ok(hit.mobileTypes.every((m) => orcs.includes(m)), 'the die picked the orcs\' table, and the mates are from it');
  assert.ok(new Set(hit.mobileTypes).size > 1, 'its faction-mates, not the seed four times');
});

test('DEX3 a granted member\'s species is a roll every machine agrees on: its die picks among the mod\'s tables, and no machine\'s own events move it; the reader\'s species bounds take every choice', (t) => {
  t.after(reset);
  const gr = { s: 0x5eed, m: 720, l: 1 };
  const before = [0, 1, 2].map((i) => grantSpecies(gr, i, CLIMATES.Woodlands, false));
  const A = twenty(256), B = twenty(257);
  const byIndex = new Map([[33, [{ enemyIds: A }, { enemyIds: B }]], [34, [{ enemyIds: twenty(258) }]], [32, [{ enemyIds: twenty(259) }]]]);
  const sel = createDexEncounterSelector({ byIndex }, { random: () => 0.9 });
  registerEncounterTableSelector(sel); onPlayerGpsEvents(sel.gps);
  const want = (i) => { const d = grantDice(gr.s, i).species; return chooseRandomEnemy({ ...WOOD_DAY, table: [A, B][Math.floor(d() * 2)] }, d); };
  const got = [0, 1, 2].map((i) => grantSpecies(gr, i, CLIMATES.Woodlands, false));
  assert.deepEqual(got, [0, 1, 2].map(want));
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: false });
  assert.deepEqual(sel.table(33, { local: true }), B, 'this machine\'s event wrote B');
  assert.deepEqual([0, 1, 2].map((i) => grantSpecies(gr, i, CLIMATES.Woodlands, false)), got, 'and the grant reads no machine\'s write');
  assert.ok(before.every((m) => ENCOUNTER_TABLES[33].includes(m)), 'without the mod: DFU\'s table');
  const set = grantSpeciesOf(CLIMATES.Woodlands);
  for (const id of [256, 257, 258, 259]) assert.ok(set.has(id), `${id}`);
  _resetEncounterTableSelectors();
  assert.ok(!grantSpeciesOf(CLIMATES.Woodlands).has(256), 'kept by the selectors\' generation');
});

test('DEX3 the population reads the dungeon\'s two tables through the door - the place it hands is the dungeon\'s seed - and the fill is DFU\'s own over them', (t) => {
  t.after(reset);
  const block = (markers, waterLevel = 10000) => ({ markers, waterLevel, originX: 0, originZ: 0 });
  const base = { x: 1, y: 2, z: 3, rawY: 0, soundIndex: 0, actionByte: 0 };
  const blocks = [block(Array.from({ length: 12 }, (_, k) => ({ ...base, x: k, record: 15, factionOrMobileId: 0, flags: 0 })))];
  const opts = { locationId: 4242, dungeonType: 9, playerLevel: 3, alternate: false };
  const vanilla = collectDungeonEnemies(blocks, opts);
  const places = [];
  registerEncounterTableSelector({ table: (i, place) => { places.push([i, place]); return i === 9 ? twenty(260) : null; }, choices: () => null });
  const dfLocation = { regionIndex: 17, dungeon: { recordElement: { header: { locationId: 4242, unknown2: 1234 } } } };
  assert.deepEqual(dungeonPlace(dfLocation), { locationId: 4242, dungeon: { unknown2: 1234, region: 17 } });
  const modded = collectDungeonEnemies(blocks, { ...opts, ...dungeonPlace(dfLocation) });
  assert.deepEqual(places, [[9, { dungeon: { unknown2: 1234, region: 17 }, local: true }], [19, { dungeon: { unknown2: 1234, region: 17 }, local: true }]], 'the type\'s and the water\'s, once each');
  assert.deepEqual(modded.map((e) => [e.x, e.z]), vanilla.map((e) => [e.x, e.z]), 'the same slots');
  assert.ok(modded.every((e) => e.mobileType === 260), 'every random foe from the table read');
  _resetEncounterTableSelectors();
  registerEncounterTableSelector({ table: (i, place) => (i === 9 && place.local ? twenty(261) : null), choices: (i) => (i === 9 ? [twenty(1), twenty(2)] : null) });
  assert.ok(collectDungeonEnemies(blocks, opts).every((e) => e.mobileType === 261), 'handed no dungeon: the player\'s own, as written - never a roll that wants a die');
});

test('AUDIT DEX C6 the dungeon hands its population the place - its LocationId and the seed a mod\'s pick is made by (dungeonPlace)', () => {
  const dc = readFileSync(join(import.meta.dirname, '../../../src/scenes/dungeonContext.js'), 'utf8');
  const at = dc.indexOf('const _layoutEnemies = collectDungeonEnemies(');
  assert.ok(at > 0, 'the population is built where it was');
  const call = dc.slice(at, dc.indexOf('});', at));
  assert.match(call, /\n\s*\.\.\.dungeonPlace\(dfLocation\),/, 'the place spread into the options - without it the population reads DFU\'s tables, never the mod\'s pick');
  assert.match(call, /dungeonType: dfLocation\.mapTableData\.dungeonType,/);
});

test('DEX3 the install: loaded, the mod\'s tables on the door and its handlers on PlayerGPS; not loaded, DFU\'s', (t) => {
  t.after(reset);
  const read = readShipped();
  installEnemyExpansion({ on: false, log: silent });
  assert.deepEqual(encounterTableChoices(9), [ENCOUNTER_TABLES[9]]);
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: false });
  assert.equal(encounterTable(33, { local: true }), ENCOUNTER_TABLES[33]);
  reset();
  installEnemyExpansion({ on: true, log: silent });
  assert.deepEqual(encounterTableChoices(9), read.byIndex.get(9).map((tb) => tb.enemyIds));
  assert.equal(encounterTable(33, { local: true }), ENCOUNTER_TABLES[33], 'before any event: DFU\'s, as EncounterTables stands before the mod writes it');
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: false });
  assert.deepEqual(encounterTable(33, { local: true }), read.tables.get('DefaultWoodlandsDay').enemyIds);
  assert.deepEqual(encounterTable(34, { local: true }), read.tables.get('DefaultWoodlandsNight').enemyIds);
  assert.equal(encounterTable(32, { local: true }), ENCOUNTER_TABLES[32], 'no entry yet: the city night unwritten');
  readPlayerGps({ climateIndex: CLIMATES.Woodlands, inLocationRect: true });
  assert.deepEqual(encounterTable(32, { local: true }), read.tables.get('DefaultWoodlandsCityNight').enemyIds);
  assert.deepEqual(encounterTable(9, { dungeon: { unknown2: 62, region: 1 } }), read.byIndex.get(9)[firstRand(62 ^ (1 << 8)) % 2].enemyIds);
});
