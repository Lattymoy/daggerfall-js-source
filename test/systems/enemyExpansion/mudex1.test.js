// MUDEX1 (2026-10-20, Mac: "We need to make everything compatible. No if ands or vutts", then "Approve MUDEX") - MEANER
// MONSTERS BESIDE DAGGERFALL ENEMY EXPANSION IS MUDEX. Ralzar's Meaner Monsters finds DEX by its GUID and asks the player
// to switch to MUDEX, its author's form of it for that mod (MeanerMonsters.cs:159-164); the port makes the switch. MUDEX
// is two tables in DEX's own format, read by DEX's reader after DEX's own (BestiaryMod.GetDBAssets walks the enabled
// mods in load order, and MUDEX depends on DEX): its monsters edit the rows as DEX left them, its tables join or restate
// DEX's. Beside DEX, Meaner Monsters' own rows, its xml and PCAAO's edit of it stand aside. Each law with its mutant
// (tools/mutants/mudex1.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUDEX_TABLE_TEXT } from '../../../src/systems/enemyExpansion/mudexTableText.js';
import { mudexTextSource } from '../../../tools/mudexText.mjs';
import { installEnemyExpansion, _resetEnemyExpansion, dexRead, dexClassicRow, DEX_VENDOR } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { MUDEX_VENDOR, mudexLoaded, meanerMonstersAlone } from '../../../src/systems/enemyExpansion/dexSwitches.js';
import { ENEMY_BASICS, VANILLA_ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { makeEnemyEntity, _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { applyMeanerMonsters, MEANER_MONSTERS_EDIT, MEANER_MONSTERS_VENDOR, installMeanerMonsters } from '../../../src/characters/meanerMonsters.js';
import { meanerMonstersRow, meanerMonstersOn } from '../../../src/combat/pcaaoMeanerMonsters.js';
import { billboardXmlScale } from '../../../src/world/billboardXml.js';
import { latchModLoaded } from '../../../src/systems/modSettings.js';
import { _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rd = (p) => readFileSync(join(ROOT, p));
const silent = () => {};
const reset = () => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetExtraQuestRows(); latchModLoaded(DEX_VENDOR, undefined); };
const STATS = ['level', 'minDamage', 'maxDamage', 'minHealth', 'maxHealth', 'armorValue'];
const stats = (row) => STATS.map((k) => row[k]);

test('MUDEX1 the record: the two tables are the vendored files byte for byte, in the manifest\'s order, and the module is what tools/mudexText.mjs writes; the manifest needs DEX 1.3.4', () => {
  const manifest = JSON.parse(rd('vendor/mudex/MUDEX.dfmod.json').toString('utf8'));
  assert.equal(manifest.ModTitle, 'MUDEX'); assert.equal(manifest.ModVersion, '1.0.1'); assert.equal(manifest.ModAuthor, 'Ralzar');
  assert.deepEqual(manifest.Dependencies, [{ Name: 'daggerfall enemy expansion', IsOptional: false, IsPeer: false, Version: '1.3.4' }]);
  assert.deepEqual(Object.keys(MUDEX_TABLE_TEXT), manifest.Files.map((f) => f.split('/').pop()));
  for (const [name, text] of Object.entries(MUDEX_TABLE_TEXT)) assert.ok(Buffer.from(text, 'utf8').equals(rd(`vendor/mudex/${name}`)), `${name}: the game's text is the vendored bytes`);
  assert.equal(rd('src/systems/enemyExpansion/mudexTableText.js').toString('utf8'), mudexTextSource(), 'the module is current (node tools/mudexText.mjs)');
  assert.match(rd('vendor/mudex/README.md').toString('utf8'), /github\.com\/Ralzar81\/MUDEX` @\n`6b6665569ca97bba15990a3510ad43f116ac1041`/, 'the record names its commit');
});

test('MUDEX1 the switch: MUDEX loads for the game when DEX does and Meaner Monsters is on - never without DEX, never without Meaner Monsters; the install answers it and a reset lets it go', (t) => {
  t.after(reset);
  for (const [on, meaner, want] of [[true, true, true], [true, false, false], [false, true, false], [false, false, false]]) {
    reset();
    assert.equal(installEnemyExpansion({ on, meaner, log: silent }).mudex, want, `DEX ${on}, Meaner Monsters ${meaner}`);
    assert.equal(mudexLoaded(), want);
  }
  reset();
  installEnemyExpansion({ on: true, meaner: true, log: silent });
  _resetEnemyExpansion();
  assert.equal(mudexLoaded(), false, 'the reset lets MUDEX go with the mod');
  assert.equal(dexRead({ log: silent }), dexRead({ mudex: false, log: silent }), 'and the game\'s read is DEX\'s alone again');
});

test('MUDEX1 the monsters: its lines edit the rows as DEX\'s left them, field by field - written into the table and at a foe\'s mint - a classic DEX restats (the bear), one it leaves (the rat) and one of DEX\'s own (the Goblin); every field MUDEX names no value for stays DEX\'s', (t) => {
  t.after(reset);
  const dex = dexRead({ mudex: false, log: silent }), mudex = dexRead({ mudex: true, log: silent });
  const bearDex = dexClassicRow(4, VANILLA_ENEMY_BASICS[4]), bear = dexClassicRow(4, VANILLA_ENEMY_BASICS[4], { mudex: true });
  assert.deepEqual(stats(bear), [4, 1, 20, 50, 100, 7], 'MUDEX\'s Grizzly Bear line, over DEX\'s');
  for (const k of Object.keys(bear)) if (!STATS.includes(k)) assert.deepEqual(bear[k], bearDex[k], `bear.${k}: DEX's`);
  assert.equal(bearDex.maxDamage, 12, '(DEX\'s own bear: 1-12)');
  assert.deepEqual(stats(dexClassicRow(0, VANILLA_ENEMY_BASICS[0], { mudex: true })), [1, 1, 2, 15, 25, 8], 'the rat, which DEX leaves, is MUDEX\'s');
  assert.deepEqual(stats(mudex.enemies.get(256).row), [2, 4, 15, 10, 20, 2], 'the Goblin restated');
  assert.deepEqual(stats(dex.enemies.get(256).row), [2, 1, 6, 11, 20, 2], '(DEX\'s own Goblin)');
  assert.equal(mudex.enemies.get(256).careerName, dex.enemies.get(256).careerName, 'a line with no career keeps the enemy\'s');
  assert.equal(mudex.enemies.size, 50, 'MUDEX adds no enemy');
  installEnemyExpansion({ on: true, meaner: true, log: silent });
  assert.deepEqual(stats(ENEMY_BASICS[4]), stats(bear), 'written into the table while loaded');
  assert.deepEqual(stats(ENEMY_BASICS[256]), [2, 4, 15, 10, 20, 2]);
  const minted = makeEnemyEntity(4, ENEMY_BASICS[4], null, 1, () => 0.5);
  assert.deepEqual(stats(minted.basics), stats(bear), 'and at the mint - no Meaner Monsters row over it');
});

test('MUDEX1 the tables: a dungeon type gains MUDEX\'s themed tables beside its default, and the defaults MUDEX restates are its lines (ParseEncounterTables\' replacement arm) - the crypt six tables, a climate\'s night MUDEX\'s own; DEX alone, one', () => {
  const dex = dexRead({ mudex: false, log: silent }).encounters, mudex = dexRead({ mudex: true, log: silent }).encounters;
  assert.deepEqual(dex.byIndex.get(0).map((x) => x.name), ['DefaultCrypt']);
  assert.deepEqual(mudex.byIndex.get(0).map((x) => x.name), ['DefaultCrypt', 'MUDEX_Crypt_Lich', 'MUDEX_Crypt_Vampire', 'MUDEX_Crypt_Mummy', 'MUDEX_Crypt_Necromancer', 'MUDEX_Crypt_Spooky']);
  assert.deepEqual(mudex.tables.get('DefaultCrypt').enemyIds, [15, 19, 18, 24, 15, 32, 18, 24, 30, 19, 15, 23, 32, 19, 18, 23, 15, 19, 18, 23], 'MUDEX\'s crypt, not DEX\'s');
  assert.notDeepEqual(dex.tables.get('DefaultCrypt').enemyIds, mudex.tables.get('DefaultCrypt').enemyIds);
  assert.deepEqual(mudex.byIndex.get(34).map((x) => x.name), ['DefaultWoodlandsNight'], 'a climate keeps one table');
  assert.equal(mudex.byIndex.get(34)[0].enemyIds[0], 0, 'MUDEX\'s woodlands night (a rat first)');
  assert.equal(dex.byIndex.get(34)[0].enemyIds[0], 3, '(DEX\'s: a giant bat first)');
  for (let i = 0; i <= 37; i++) assert.ok(mudex.byIndex.get(i)?.length, `index ${i} has a table`);
});

test('MUDEX1 Meaner Monsters stands aside beside DEX - its rows, its xml and PCAAO\'s edit of it, switches on - and is itself without DEX', (t) => {
  t.after(() => { reset(); installMeanerMonsters(); });
  const on = () => true;
  installMeanerMonsters({ read: (k) => (k === 'Enabled' ? true : undefined) });
  latchModLoaded(DEX_VENDOR, false);
  assert.equal(meanerMonstersAlone(true), true, 'no DEX: itself');
  assert.notEqual(applyMeanerMonsters(4, ENEMY_BASICS[4]), ENEMY_BASICS[4], 'its bear');
  assert.deepEqual(billboardXmlScale(264, 3), { x: 1.2, y: 1.2 }, 'its werewolf\'s scale');
  assert.equal(meanerMonstersOn(on, on), true, 'PCAAO\'s edit of it live');
  latchModLoaded(DEX_VENDOR, true);
  assert.equal(meanerMonstersAlone(true), false, 'DEX loaded: MUDEX is its form');
  assert.equal(applyMeanerMonsters(4, ENEMY_BASICS[4]), ENEMY_BASICS[4], 'no row of its own');
  assert.equal(billboardXmlScale(264, 3), null, 'no xml (MUDEX ships none)');
  assert.equal(meanerMonstersOn(on, on), false, 'PCAAO\'s edit of it stands aside - the lookup for "Meaner Monsters" finds MUDEX in its place');
  assert.equal(meanerMonstersRow(4, ENEMY_BASICS[4]), ENEMY_BASICS[4]);
  assert.ok(MEANER_MONSTERS_EDIT[4] && MEANER_MONSTERS_VENDOR === 'meanerMonsters' && MUDEX_VENDOR === 'mudex');
});
