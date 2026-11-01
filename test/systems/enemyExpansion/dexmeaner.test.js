// OUR MEANER MONSTERS BESIDE DAGGERFALL ENEMY EXPANSION (src/systems/enemyExpansion/
// dexMeaner.js). They took the place of Ralzar's MUDEX 1.0.1, which
// MUDEX1 carried from 2026-10-20: two tables in DEX's own formats, read by DEX's reader after its own when Meaner
// Monsters is on beside it. Every monster row is proved to be the rule's answer over DEX's row, the courts are held to
// their laws, and Meaner Monsters still stands aside beside DEX. Each law with its mutant (tools/mutants/dexmeaner.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEX_MEANER_TABLE_TEXT, DEX_MEANER_MONSTERS, DEX_MEANER_COURTS, MEANER_FLOOR, NEWCOMER_LEVEL, TOUCH_ARMS,
  meanerStats, meanerTraits, courtTable,
} from '../../../src/systems/enemyExpansion/dexMeaner.js';
import { installEnemyExpansion, _resetEnemyExpansion, dexRead, dexClassicRow, DEX_VENDOR } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { DEX_MEANER_LATCH, dexMeanerLoaded, meanerMonstersAlone } from '../../../src/systems/enemyExpansion/dexSwitches.js';
import { createDexEncounterSelector } from '../../../src/systems/enemyExpansion/dexEncounters.js';
import { ENEMY_BASICS, VANILLA_ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { makeEnemyEntity, _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { applyMeanerMonsters, MEANER_MONSTERS_EDIT, MEANER_MONSTERS_VENDOR, installMeanerMonsters } from '../../../src/characters/meanerMonsters.js';
import { meanerMonstersRow, meanerMonstersOn } from '../../../src/combat/pcaaoMeanerMonsters.js';
import { billboardXmlScale } from '../../../src/world/billboardXml.js';
import { latchModLoaded } from '../../../src/systems/modSettings.js';
import { FOE_SHARE_FLOOR } from '../../../src/systems/skillSoftcap.js';
import { _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';

const silent = () => {};
const reset = () => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetExtraQuestRows(); latchModLoaded(DEX_VENDOR, undefined); };
const STATS = ['level', 'minDamage', 'maxDamage', 'minHealth', 'maxHealth', 'armorValue'];
const stats = (row) => STATS.map((k) => row[k]);
const RIDERS = [386, 387, 392, 397, 398];
const LYSANDUS = 275;

/** Every monster of the bestiary as DEX leaves it: [id, row, props] - DFU's 0-42 (not the horse) and DEX's own. */
function bestiary() {
  const dex = dexRead({ meaner: false, log: silent });
  const out = [];
  for (const [ids, v] of Object.entries(VANILLA_ENEMY_BASICS)) if (+ids < 128 && v.maxHealth != null) out.push([+ids, dexClassicRow(+ids, v), dex.classic.get(+ids)?.props ?? null]);
  for (const [id, e] of dex.enemies) if (id < 384) out.push([id, e.row, e.props]);
  return out;
}

test('OWN-WORK2 the rule\'s numbers: the floor is the bestiary\'s own average a level, through the origin, to the half (1.94 damage, 4.59 health over 77 monsters); a newcomer is a level the progression share never scales; the touch is the six arms that ready a spell or drain', () => {
  const all = bestiary();
  assert.equal(all.length, 77);
  const fit = (k) => all.reduce((s, [, r]) => s + r.level * (r[`min${k}`] + r[`max${k}`]) / 2, 0) / all.reduce((s, [, r]) => s + r.level ** 2, 0);
  assert.equal(fit('Damage').toFixed(2), '1.94');
  assert.equal(fit('Health').toFixed(2), '4.59');
  assert.deepEqual(MEANER_FLOOR, { damage: Math.round(fit('Damage') * 2) / 2, health: Math.round(fit('Health') * 2) / 2 });
  assert.deepEqual(MEANER_FLOOR, { damage: 2, health: 4.5 });
  assert.equal(NEWCOMER_LEVEL, FOE_SHARE_FLOOR);
  assert.equal(NEWCOMER_LEVEL, 4);
  assert.deepEqual([...TOUCH_ARMS], [3, 5, 10, 11, 12, 13]);
});

test('OWN-WORK2 the rule over a row: a newcomer\'s blow cut to the floor, its health left; past it a blow and health raised to the floor, a caster\'s and a touch\'s blow left; the dice keep their shape, a level never moves', () => {
  const row = (level, d0, d1, h0, h1) => ({ level, minDamage: d0, maxDamage: d1, minHealth: h0, maxHealth: h1 });
  assert.deepEqual(meanerStats(row(1, 1, 4, 9, 16)), { damage: [1, 3], health: null }, 'the rat: a mean of 2.5 cut to 2');
  assert.equal(meanerStats(row(2, 1, 6, 11, 20)), null, 'the goblin: 3.5 is under the floor, and a newcomer is never raised');
  assert.equal(meanerStats(row(4, 1, 12, 13, 34)), null, 'the bear at level 4: 6.5, under its 8 - a newcomer still');
  assert.deepEqual(meanerStats(row(5, 1, 6, 13, 34)), { damage: [3, 17], health: null }, 'the orc: 3.5 raised to 10');
  assert.deepEqual(meanerStats(row(5, 1, 6, 13, 34), { casts: true }), null, 'a caster\'s blow is left');
  assert.deepEqual(meanerStats(row(5, 1, 6, 13, 34), { touch: true }), null, 'and a touch\'s');
  assert.deepEqual(meanerStats(row(11, 17, 66, 17, 66), { casts: true }), { damage: null, health: [20, 79] }, 'a caster\'s health is raised all the same');
  assert.equal(meanerStats(row(20, 70, 100, 30, 170)), null, 'the lich: past both floors, untouched');
});

test('OWN-WORK2 every monster row is the rule\'s answer over DEX\'s row - no row the rule does not make, none it makes missing; ids are the bestiary\'s, each once', () => {
  const want = [];
  for (const [id, r, props] of bestiary()) {
    const m = meanerStats(r, meanerTraits(id, r, props));
    if (m) want.push([id, ...(m.damage ?? [null, null]), ...(m.health ?? [null, null])]);
  }
  assert.deepEqual([...DEX_MEANER_MONSTERS].map((x) => [...x]).sort((a, b) => a[0] - b[0]), want.sort((a, b) => a[0] - b[0]));
  assert.equal(DEX_MEANER_MONSTERS.length, 48);
  assert.equal(new Set(DEX_MEANER_MONSTERS.map(([id]) => id)).size, 48);
  // the traits as the game holds them: DFU's casters, DEX's CastsMagic, the arms
  const dex = dexRead({ meaner: false, log: silent });
  assert.deepEqual(meanerTraits(21, VANILLA_ENEMY_BASICS[21]), { casts: true, touch: false }, 'the Orc Shaman casts');
  assert.deepEqual(meanerTraits(10, VANILLA_ENEMY_BASICS[10]), { casts: false, touch: true }, 'the Nymph drains');
  assert.deepEqual(meanerTraits(271, dex.enemies.get(271).row, dex.enemies.get(271).props), { casts: false, touch: true }, 'the Blood Spider\'s leech');
  assert.deepEqual(meanerTraits(288, dex.enemies.get(288).row, dex.enemies.get(288).props), { casts: true, touch: false }, 'the Scamp casts');
  assert.deepEqual(meanerTraits(17, VANILLA_ENEMY_BASICS[17]), { casts: false, touch: false }, 'a disease is no touch');
});

test('OWN-WORK2 the table text: the monster lines name no level and no name, the courts their twenty slots; the read writes our lines field by field over DEX\'s rows, in the table and at a foe\'s mint, and adds no enemy', (t) => {
  t.after(reset);
  const [mHeader, ...mLines] = DEX_MEANER_TABLE_TEXT['DexMeaner_Monsters.mdb.csv'].trimEnd().split('\r\n');
  assert.equal(mHeader, 'ID,MinDamage,MaxDamage,MinHealth,MaxHealth');
  assert.equal(mLines[4], '7,3,17,,', 'the orc: its blow alone');
  assert.equal(mLines.length, 48);
  const [cHeader, ...cLines] = DEX_MEANER_TABLE_TEXT['DexMeaner_Courts.tdb.csv'].trimEnd().split('\r\n');
  assert.equal(cHeader.split(',').length, 22);
  assert.equal(cLines[0], 'Court_Crypt_Lich,0,266,266,266,266,274,274,274,388,388,388,18,18,18,18,23,23,23,32,32,32');
  const dex = dexRead({ meaner: false, log: silent }), ours = dexRead({ meaner: true, log: silent });
  assert.deepEqual(stats(dexClassicRow(7, VANILLA_ENEMY_BASICS[7], { meaner: true })), [5, 3, 17, 13, 34, 7], 'the orc, DEX leaves it: ours over DFU\'s row');
  const wolfDex = dex.enemies.get(262).row, wolf = ours.enemies.get(262).row;
  assert.deepEqual(stats(wolf), [5, 2, 18, 13, 32, 7], 'DEX\'s own Wolf: its blow and its health');
  for (const k of Object.keys(wolf)) if (!STATS.includes(k)) assert.deepEqual(wolf[k], wolfDex[k], `wolf.${k}: DEX's`);
  assert.deepEqual(stats(dexClassicRow(9, VANILLA_ENEMY_BASICS[9], { meaner: true })), [9, 4, 32, 17, 66, 3], 'the werewolf as DEX restats it, then ours');
  assert.equal(ours.enemies.get(262).careerName, dex.enemies.get(262).careerName, 'a line with no career keeps the enemy\'s');
  assert.deepEqual([...ours.enemies.keys()], [...dex.enemies.keys()], 'ours add no enemy');
  // no level moves: every table's order, the progression share and the provinces' wild stay DEX's
  for (const [id, r] of bestiary()) {
    const level = id < 128 ? dexClassicRow(id, VANILLA_ENEMY_BASICS[id], { meaner: true }).level : ours.enemies.get(id).row.level;
    assert.equal(level, r.level, `${id}: its level`);
  }
  installEnemyExpansion({ on: true, meaner: true, log: silent });
  assert.deepEqual(stats(ENEMY_BASICS[7]), [5, 3, 17, 13, 34, 7], 'written into the table while loaded');
  assert.deepEqual(stats(ENEMY_BASICS[262]), [5, 2, 18, 13, 32, 7]);
  const minted = makeEnemyEntity(7, ENEMY_BASICS[7], null, 1, () => 0.5);
  assert.deepEqual(stats(minted.basics), [5, 3, 17, 13, 34, 7], 'and at the mint - no Meaner Monsters row over it');
});

test('OWN-WORK2 the switch: ours load for the game when DEX does and Meaner Monsters is on - never without DEX, never without Meaner Monsters; the install answers it and a reset lets it go', (t) => {
  t.after(reset);
  for (const [on, meaner, want] of [[true, true, true], [true, false, false], [false, true, false], [false, false, false]]) {
    reset();
    assert.equal(installEnemyExpansion({ on, meaner, log: silent }).meaner, want, `DEX ${on}, Meaner Monsters ${meaner}`);
    assert.equal(dexMeanerLoaded(), want);
  }
  reset();
  installEnemyExpansion({ on: true, meaner: true, log: silent });
  _resetEnemyExpansion();
  assert.equal(dexMeanerLoaded(), false, 'the reset lets ours go with the mod');
  assert.equal(dexRead({ log: silent }), dexRead({ meaner: false, log: silent }), 'and the game\'s read is DEX\'s alone again');
  assert.equal(DEX_MEANER_LATCH, 'dexMeaner');
});

test('OWN-WORK2 the courts: two for each of DFU\'s nineteen dungeon types, six kinds each, least to master - a monster never before a lower one, no aquatic kind, rider or unique foe; each table its six in equal runs', () => {
  const dex = dexRead({ meaner: false, log: silent });
  const levelOf = (id) => (id < 128 ? dexClassicRow(id, VANILLA_ENEMY_BASICS[id]).level : dex.enemies.get(id).row.level);
  assert.equal(DEX_MEANER_COURTS.length, 38);
  for (let type = 0; type <= 18; type++) assert.equal(DEX_MEANER_COURTS.filter(([, ty]) => ty === type).length, 2, `type ${type}`);
  assert.equal(new Set(DEX_MEANER_COURTS.map(([n]) => n)).size, 38);
  for (const [name, , kinds] of DEX_MEANER_COURTS) {
    assert.equal(kinds.length, 6, name);
    assert.equal(new Set(kinds).size, 6, `${name}: six kinds`);
    let last = 0;
    for (const id of kinds) {
      assert.ok(VANILLA_ENEMY_BASICS[id] || dex.enemies.has(id), `${name}: ${id} is an enemy`);
      assert.ok(!RIDERS.includes(id) && id !== LYSANDUS && id !== 39, `${name}: ${id} no rider, unique foe or horse`);
      const row = VANILLA_ENEMY_BASICS[id] ?? dex.enemies.get(id).row;
      assert.notEqual(row.behaviour, 'Aquatic', `${name}: ${id} not aquatic`);
      if ((id >= 128 && id < 256) || id >= 384) continue;   // a person stands at the player's level
      assert.ok(levelOf(id) >= last, `${name}: ${id} (level ${levelOf(id)}) after a level ${last}`);
      last = levelOf(id);
    }
  }
  assert.deepEqual(courtTable([1, 2, 3, 4, 5, 6]), [1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6]);
});

test('OWN-WORK2 the courts read: a dungeon type gains its two beside DEX\'s default, the default DEX\'s own; the water\'s and the climates\' tables stay DEX\'s alone; a dungeon past the Bay picks among the three as one in the Bay does', () => {
  const dex = dexRead({ meaner: false, log: silent }).encounters, ours = dexRead({ meaner: true, log: silent }).encounters;
  assert.deepEqual(dex.byIndex.get(0).map((x) => x.name), ['DefaultCrypt']);
  assert.deepEqual(ours.byIndex.get(0).map((x) => x.name), ['DefaultCrypt', 'Court_Crypt_Lich', 'Court_Crypt_Hungry']);
  assert.deepEqual(ours.byIndex.get(9).map((x) => x.name), ['DefaultLaboratory', 'DwarvenLab', 'Court_Lab_Mages', 'Court_Lab_Golems']);
  for (let i = 0; i <= 18; i++) {
    assert.deepEqual(ours.byIndex.get(i).slice(0, -2).map((x) => [x.name, x.enemyIds]), dex.byIndex.get(i).map((x) => [x.name, x.enemyIds]), `type ${i}: DEX's tables first, unchanged`);
    assert.equal(ours.byIndex.get(i).length, dex.byIndex.get(i).length + 2);
  }
  for (let i = 19; i <= 37; i++) assert.deepEqual(ours.byIndex.get(i).map((x) => [x.name, x.enemyIds]), dex.byIndex.get(i).map((x) => [x.name, x.enemyIds]), `index ${i}: DEX's`);
  assert.deepEqual(ours.tables.get('Court_Mine_Dwemer').enemyIds, courtTable([0, 6, 289, 286, 270, 290]));
  // the seeded pick (SelectDungeonTable): a dungeon of Daggerfall's region 17 and one of a province's region 65
  const sel = createDexEncounterSelector(ours);
  const choices = sel.choices(0).map((ids) => ids.join());
  for (const region of [17, 65]) {
    const seen = new Set();
    for (let u = 0; u < 60; u++) {
      const ids = createDexEncounterSelector(ours).table(0, { dungeon: { unknown2: u * 977, region } });
      assert.ok(choices.includes(ids.join()), `region ${region}: one of the crypt's three`);
      assert.deepEqual(createDexEncounterSelector(ours).table(0, { dungeon: { unknown2: u * 977, region } }), ids, 'the same pick on every visit');
      seen.add(ids.join());
    }
    assert.equal(seen.size, 3, `region ${region}: each of the three is some dungeon's`);
  }
});

test('OWN-WORK2 Meaner Monsters stands aside beside DEX - its rows, its xml and PCAAO\'s edit of it, switches on - and is itself without DEX', (t) => {
  t.after(() => { reset(); installMeanerMonsters(); });
  const on = () => true;
  installMeanerMonsters({ read: (k) => (k === 'Enabled' ? true : undefined) });
  latchModLoaded(DEX_VENDOR, false);
  assert.equal(meanerMonstersAlone(true), true, 'no DEX: itself');
  assert.notEqual(applyMeanerMonsters(4, ENEMY_BASICS[4]), ENEMY_BASICS[4], 'its bear');
  assert.deepEqual(billboardXmlScale(264, 3), { x: 1.2, y: 1.2 }, 'its werewolf\'s scale');
  assert.equal(meanerMonstersOn(on, on), true, 'PCAAO\'s edit of it live');
  latchModLoaded(DEX_VENDOR, true);
  assert.equal(meanerMonstersAlone(true), false, 'DEX loaded: ours stand in');
  assert.equal(applyMeanerMonsters(4, ENEMY_BASICS[4]), ENEMY_BASICS[4], 'no row of its own');
  assert.equal(billboardXmlScale(264, 3), null, 'no xml (ours scale no sprite)');
  assert.equal(meanerMonstersOn(on, on), false, 'PCAAO\'s edit of it stands aside with it');
  assert.equal(meanerMonstersRow(4, ENEMY_BASICS[4]), ENEMY_BASICS[4]);
  assert.ok(MEANER_MONSTERS_EDIT[4] && MEANER_MONSTERS_VENDOR === 'meanerMonsters');
});
