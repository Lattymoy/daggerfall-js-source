// DEX4a (2026-10-20, Mac: "I want to implement this as our next mod 1:1") - DAGGERFALL ENEMY EXPANSION'S SPELLS. The
// mod's SpellRecords.json merged into the standard spells as DFU's RebuildClassicSpellsDict merges an enabled mod's
// (systems/spell/standardSpells.js - TextAssetReader.Merge by index, then the first-wins fold), its spellbook tables
// (dexSpells.js - ParseSpellbookTables' thirteen and "Class", and each row's raw book) cast in place of DFU's lists at a
// foe's spawn (systems/enemySpells.js's door), and a cast's spell index on the wire wide enough for them. Each pinned
// against the C#'s own text, and each with a mutation it must fail under (tools/mutants/dex4a.json).
import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerSpellRecordsAsset, _resetSpellRecordsAssets, spellRecordFromJson, mergeSpellRecords, standardSpellsByIndex } from '../../../src/systems/spell/standardSpells.js';
import { readSpellsStd, spellsByIndexMap } from '../../../src/formats/spellsStd.js';
import { DEX_SPELLBOOK_TABLES, spellbookOf, createDexSpellbooks } from '../../../src/systems/enemyExpansion/dexSpells.js';
import { DEX_TABLE_TEXT } from '../../../src/systems/enemyExpansion/dexTableText.js';
import { installEnemyExpansion, _resetEnemyExpansion, dexRead, dexProperties, DEX_VENDOR } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { enemySpellIndices, assignEnemySpells, registerEnemySpellbook, _resetEnemySpellbooks, MONSTER_SPELL_LISTS, ENEMY_CLASS_SPELLS } from '../../../src/systems/enemySpells.js';
import { validFoeRecord, SPELL_INDEX_MAX } from '../../../src/net/wire.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { _resetFoeGhosts } from '../../../src/characters/enemy/foeLook.js';
import { _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';
import { _resetEncounterTableSelectors } from '../../../src/characters/encounterTableDoor.js';
import { _resetPlayerGps } from '../../../src/world/playerGps.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const spellsStd = () => new Uint8Array(readFileSync([join(ARENA2, 'SPELLS.STD'), join(ARENA2, 'spells.std')].find((p) => existsSync(p))));
const CS = readFileSync(join(ROOT, 'vendor/daggerfall-enemy-expansion/Scripts/BestiaryMod.cs'), 'utf8');
const DEX_JSON = JSON.parse(DEX_TABLE_TEXT['SpellRecords.json']);
const silent = () => {};
const reset = () => {
  _resetSpellRecordsAssets(); _resetEnemySpellbooks(); _resetEncounterTableSelectors(); _resetPlayerGps();
  _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetFoeGhosts(); _resetExtraQuestRows();
};
/** A foe as makeEnemyEntity mints the fields the spell lists read. */
const foe = (mobileType, level, castsMagic = false) => ({ mobileType, level, isClass: mobileType >= 128 && (mobileType / 128) % 2 >= 1, careerIndex: mobileType >= 256 ? mobileType : mobileType % 128, basics: { castsMagic } });

test('DEX4a TextAssetReader.Merge, by index: the first record of an index takes the item\'s fields over its own, an index the list lacks is a new record off SpellRecordData\'s defaults, appended - and the fold keeps the first', (t) => {
  t.after(reset);
  const e = (type, subType) => ({ type, subType, durationBase: 9, durationMod: 9, durationPerLevel: 9, chanceBase: 9, chanceMod: 9, chancePerLevel: 9, magnitudeBaseLow: 9, magnitudeBaseHigh: 9, magnitudeLevelBase: 9, magnitudeLevelHigh: 9, magnitudePerLevel: 9 });
  const list = [
    { index: 10, name: 'Ten', element: 1, rangeType: 2, cost: 30, icon: 4, effects: [e(4, 0), e(-1, -1), e(-1, -1)] },
    { index: 58, name: 'Holy Word', element: 4, rangeType: 3, cost: 70, icon: 5, effects: [e(1, 0), e(-1, -1), e(-1, -1)] },
    { index: 58, name: 'Holy Touch', element: 4, rangeType: 1, cost: 70, icon: 5, effects: [e(2, 0), e(-1, -1), e(-1, -1)] },
  ];
  registerSpellRecordsAsset('A', [{ index: 10, spellName: '!Ten', effects: [{ type: 11, subType: 8, magnitudeBaseLow: 4 }] }, { index: 58, icon: 77 }]);
  registerSpellRecordsAsset('B', [{ index: 600, spellName: 'New', rangeType: 4 }, { index: 10, cost: 5 }]);
  mergeSpellRecords(list);
  assert.equal(list.length, 4, 'the new one appended');
  assert.deepEqual({ ...list[0], effects: null }, { index: 10, name: '!Ten', element: 1, rangeType: 2, cost: 5, icon: 4, effects: null }, 'its own fields kept, the items\' over them, the later mod last');
  assert.deepEqual(list[0].effects, [{ type: 11, subType: 8, durationBase: 0, durationMod: 0, durationPerLevel: 0, chanceBase: 0, chanceMod: 0, chancePerLevel: 0, magnitudeBaseLow: 4, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 }], 'the item\'s effects whole, the struct\'s zeros under them');
  assert.equal(list[1].icon, 77, 'the FIRST record of a doubled index'); assert.equal(list[2].icon, 5);
  assert.deepEqual({ ...list[3], effects: list[3].effects.length }, { index: 600, name: 'New', element: -1, rangeType: 4, cost: -1, icon: -1, effects: 3 }, 'SpellRecordData\'s defaults: "", -1, three blank effects');
  assert.ok(list[3].effects.every((x) => x.type === 0 && x.magnitudePerLevel === 0), 'EffectRecordData\'s zeros');
  assert.equal(spellsByIndexMap(list).get(58).name, 'Holy Word', 'the fold still keeps the first');
  assert.notEqual(spellRecordFromJson({ icon: 1 }, list[0]), list[0], 'a copy, the base untouched');
  assert.throws(() => registerSpellRecordsAsset('C', {}), /no list/);
});

test('DEX4a with ARENA2: the standard list is SPELLS.STD\'s whole with no mod, and the mod\'s four join it - new indices, its own names (the hidden `!` kept), its fields', { skip: skipReal }, (t) => {
  t.after(reset);
  const plain = standardSpellsByIndex(spellsStd());
  assert.deepEqual([...plain], [...spellsByIndexMap(readSpellsStd(spellsStd()))], 'no asset: the list as it was');
  for (const item of DEX_JSON) assert.equal(plain.has(item.index), false, `${item.index} is the mod's own`);
  registerSpellRecordsAsset(DEX_VENDOR, DEX_JSON);
  const merged = standardSpellsByIndex(spellsStd());
  assert.equal(merged.size, plain.size + 4);
  assert.deepEqual([500, 501, 502, 503].map((i) => merged.get(i).name), ['!Blood Leech', '!Daemon Touch', '!Wrack', '!Bolt of Vengeance']);
  const wrack = merged.get(502);
  assert.deepEqual([wrack.element, wrack.rangeType, wrack.icon, wrack.cost, wrack.effects.length], [4, 1, 21, -1, 2]);
  assert.deepEqual([wrack.effects[1].type, wrack.effects[1].subType, wrack.effects[1].durationPerLevel, wrack.effects[1].chanceBase], [1, 2, 4, 0]);
  for (const [i, sp] of plain) assert.deepEqual(merged.get(i), sp, `${i} untouched`);
});

test('DEX4a ParseSpellbookTables: the thirteen tables are the C#\'s own arrays, by name, and "Class" its ladder of seven by minLevel - which are DFU\'s own career lists and EnemyClassSpells', () => {
  const arrays = new Map([...CS.matchAll(/int\[\] (\w+)Spells = \{([^}]*)\};/g)].map(([, n, body]) => [n, body.split(',').map((x) => Number(x.trim()))]));
  const adds = [...CS.matchAll(/spellbookTables\.Add\("(\w+)", MakeSingleSpellbookTable\((\w+)Spells\)\);/g)].map(([, name, arr]) => [name, arr]);
  assert.equal(adds.length, 13);
  for (const [name, arr] of adds) assert.deepEqual(DEX_SPELLBOOK_TABLES.get(name), [{ spellIds: arrays.get(arr), minLevel: 0 }], name);
  const ladder = CS.slice(CS.indexOf('spellbookTables.Add("Class"'), CS.indexOf('void EnemyDeath_OnEnemyDeath'));
  const books = [...ladder.matchAll(/spellIds = (\w+)Spells,(?:\s*minLevel = (\d+))?/g)].map(([, arr, min]) => ({ spellIds: arrays.get(arr), minLevel: Number(min ?? 0) }));
  assert.equal(books.length, 7);
  assert.deepEqual(DEX_SPELLBOOK_TABLES.get('Class'), books);
  assert.deepEqual([...DEX_SPELLBOOK_TABLES.keys()], [...adds.map(([n]) => n), 'Class'], 'in the C#\'s order');
  // the lists ARE EnemyEntity's: the thirteen careers', and the class ladder EnemyClassSpells[min(6, level / 3)]
  assert.deepEqual([...DEX_SPELLBOOK_TABLES.values()].slice(0, 13).map((tb) => tb[0].spellIds), Object.values(MONSTER_SPELL_LISTS).map((l) => [...l]));
  for (let level = 1; level <= 30; level++) assert.deepEqual(spellbookOf(DEX_SPELLBOOK_TABLES.get('Class'), level).spellIds, [...ENEMY_CLASS_SPELLS[Math.min(6, Math.trunc(level / 3))]], `level ${level}`);
});

test('DEX4a GetSpellbook: the last book whose minLevel the level reaches - none below the first', () => {
  const tb = [{ spellIds: [1], minLevel: 2 }, { spellIds: [2], minLevel: 5 }, { spellIds: [3], minLevel: 5 }];
  assert.equal(spellbookOf(tb, 1), null);
  assert.deepEqual(spellbookOf(tb, 4).spellIds, [1]);
  assert.deepEqual(spellbookOf(tb, 5).spellIds, [3], 'LastOrDefault');
});

test('DEX4a the door: a row\'s table casts its book for the foe\'s level, whatever the name\'s case; a raw book is the row\'s own; a table no one made is said once and leaves DFU\'s list, as a level no book reaches does', () => {
  const props = new Map([[384, { spellbookTable: 'class' }], [257, { spellbookTable: '257' }], [300, { spellbookTable: 'Nobody' }], [301, { spellbookTable: 'Hidden' }], [302, { spellbookTable: null }]]);
  const log = [];
  const books = createDexSpellbooks(new Map([['257', [7, 10, 29, 44]], ['Hidden', [1]]]), (id) => props.get(id) ?? null, { ids: [384, 257, 300, 302], log: (l, m) => log.push(`${l} ${m}`) });
  assert.deepEqual(log, ["error [DEX] Unknown enemy spell table 'Nobody'"]);
  assert.deepEqual(books.spellbook(foe(384, 1), 1), [0x10, 0x14]); assert.deepEqual(books.spellbook(foe(384, 20), 20), [0x08, 0x0A, 0x0E, 0x1D, 0x1F, 0x22, 0x3C]);
  assert.deepEqual(books.spellbook(foe(384, 20), 9), [0x08, 0x32], 'the level asked, not the entity\'s (a grant\'s copy)');
  assert.deepEqual(books.spellbook(foe(257, 3), 3), [7, 10, 29, 44]);
  assert.equal(books.spellbook(foe(300, 3), 3), null); assert.equal(books.spellbook(foe(302, 3), 3), null); assert.equal(books.spellbook(foe(1, 3), 3), null, 'no props: DFU\'s');
  assert.deepEqual(books.spellbook(foe(301, 3), 3), [1], 'a raw table whatever its name');
});

test('DEX4a enemySpellIndices asks a mod\'s spellbook first: its book (an empty one too) in place of DFU\'s list, DFU\'s where it answers none', (t) => {
  t.after(reset);
  assert.deepEqual(enemySpellIndices(foe(1, 5)), [...MONSTER_SPELL_LISTS[1]]);
  registerEnemySpellbook((e) => (e.mobileType === 1 ? [503] : e.mobileType === 18 ? [] : null));
  assert.deepEqual(enemySpellIndices(foe(1, 5)), [503]);
  assert.deepEqual(enemySpellIndices(foe(18, 5)), [], 'an empty book casts nothing');
  assert.deepEqual(enemySpellIndices(foe(21, 5)), [...MONSTER_SPELL_LISTS[21]]);
  assert.throws(() => registerEnemySpellbook(null), /function/);
});

test('DEX4a the install: loaded, its spells in the standard list and its books cast - the Homunculus\'s, King Lysandus\'s Bolt of Vengeance, the Fire Daemon\'s FireDaedra, the classes\' ladder; not loaded, DFU\'s lists', (t) => {
  t.after(reset);
  const stdOf = () => mergeSpellRecords([...[7, 8, 10, 14, 16, 20, 25, 29, 44, 50].map((index) => ({ index, name: `s${index}`, element: 0, rangeType: 2, cost: 1, icon: 0, effects: [{ type: 4, subType: 0 }] }))]);
  installEnemyExpansion({ on: false, log: silent });
  assert.deepEqual(enemySpellIndices(foe(275, 20, true)), [], 'not loaded: a custom monster casts nothing of DFU\'s');
  assert.equal(spellsByIndexMap(stdOf()).has(503), false, 'nor are its spells merged');
  reset();
  const log = [];
  installEnemyExpansion({ on: true, log: (l, m) => log.push(m) });
  assert.deepEqual(log, [], 'every table a row names is made');
  const std = spellsByIndexMap(stdOf());
  assert.equal(std.get(503).name, '!Bolt of Vengeance');
  assert.deepEqual(enemySpellIndices(foe(257, 5, true)), [7, 10, 29, 44]);
  assert.deepEqual(enemySpellIndices(foe(275, 20, true)), [503]);
  assert.deepEqual(enemySpellIndices(foe(276, 22, true)), [0x0E, 0x19]);
  assert.deepEqual(enemySpellIndices(foe(384, 10, true)), [0x08, 0x32], 'the Druid at 10: the ladder\'s fourth');
  assert.deepEqual(enemySpellIndices(foe(1, 5)), [...MONSTER_SPELL_LISTS[1]], 'a classic Imp: DFU\'s own');
  const lysandus = { ...foe(275, 20, true), skillOverrides: {} };
  assignEnemySpells(lysandus, std);
  assert.deepEqual(lysandus.spells.map((s) => s.index), [503]);
  assert.equal(lysandus.maxMagicka, 300, 'its magicka set as SetEnemySpells sets it');
  // every spell a table of the mod's names is in the standard list with the mod's merged (no `Failed to locate`)
  const read = dexRead({ log: silent });
  const named = new Set([...DEX_SPELLBOOK_TABLES.values()].flat().flatMap((b) => b.spellIds).concat([...read.spellbooks.values()].flat()));
  for (const id of [...read.enemies.keys()]) if (dexProperties(id)?.spellbookTable) assert.ok(enemySpellIndices(foe(id, 10, true)).length > 0, `${id}`);
  assert.ok([...named].every((id) => id < 256 || std.has(id)), 'the mod\'s own indices are its merged four');
  assert.ok(ENEMY_BASICS[275], 'Lysandus stands in the table');
});

test('DEX4a a cast on the wire carries a standard spell index to a u16: the mod\'s 500-503 cross, past it a record is refused whole', () => {
  assert.equal(SPELL_INDEX_MAX, 0xffff);
  for (const s of [0, 255, 500, 503, 0xffff]) assert.equal(validFoeRecord({ i: 1, s })?.s, s);
  for (const s of [-1, 0x10000, 1.5, '503']) assert.equal(validFoeRecord({ i: 1, s }), null, String(s));
});
