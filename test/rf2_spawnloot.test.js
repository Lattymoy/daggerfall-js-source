// RF2 - THE ONE ENEMY-LOOT SEAM (2026-09-14, Mac's refactor pass: "Lets
// tackle each one at a time" - the second).
//
// Four hosts stood the same four lines each - GenerateItems on the
// player's level and gender, equipEnemy, the map/potion/recipe trio,
// loot rarity's roll - and the first departure from DFU's rules had
// to visit all four. hostCombat.spawnEnemyLoot is the one seam: the
// chain in DFU's order, the port's arm after it, one call per host.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnEnemyLoot } from '../src/scenes/hostCombat.js';
import { equipTableOf } from '../src/systems/equip.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { rarityOf } from '../src/systems/lootRarity.js';
import { isMap } from '../src/systems/useItem.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const player = { level: 5, gender: 'female', stats: { luck: 50 }, activeEffects: [] };
const foe = (careerIndex = 7, isClass = false) => ({ items: [], level: 5, careerIndex, isClass, stats: { strength: 50, speed: 50 }, skills: 30 });   // as makeEnemyEntity stamps them: the Orc's career index picks equipment variant 0

test('RF2: spawnEnemyLoot runs SetEnemyCareer\'s chain in DFU\'s order - the table, the kit on, the trio - and answers the list', () => {
  _resetForTests();
  const orc = 7;   // Orc: a loot table AND an equipment variant
  const e = foe();
  const items = spawnEnemyLoot(e, orc, { ...ENEMY_BASICS[orc], mapChance: 100 }, player, { rolls: () => 0 });   // a sure map, to see WHERE it lands
  assert.equal(items, e.items);
  const worn = equipTableOf(e).filter(Boolean);
  assert.ok(worn.length > 0, 'the kit is on');
  assert.ok(worn.every((it) => e.items.includes(it)), 'and in the list, as AssignEnemyStartingEquipment leaves it');
  assert.ok(e.weapon, 'the right hand feeds the attack path');
  // the trio rides the given stream: rolls of 0 land a map (mapChance) and a potion and a recipe after the kit
  const lastWorn = Math.max(...worn.map((it) => e.items.indexOf(it)));
  const map = e.items.findIndex(isMap);
  assert.ok(map > lastWorn, 'a map lands after the equipment, as EnemyEntity.cs:388 has it');
  // no table: the watch's kind carries no lootTableKey and the list is its equipment
  const g = foe(146 & 127, true);
  spawnEnemyLoot(g, 146, ENEMY_BASICS[146] ?? {}, player, { rolls: () => 0.999 });
  // (a second piece for an occupied slot stays in the list unworn - the port's placement skips it, as DFU's alwaysEquip swap leaves the loser in Items - so the claim is about the TABLE roll, not the table)
  assert.ok(!g.items.some((it) => it.group === 'Currency' || /Ingredients|Books|ReligiousItems/.test(it.group)), 'a foe with no table rolls no table loot: its list is its kit');
  assert.ok(g.items.length > 0 && g.items.every((it) => ['Weapons', 'Armor', 'MensClothing', 'WomensClothing'].includes(it.group)), 'and the kit is weapons, armour and clothes');
});

test('RF2: the port\'s arm rides the seam - loot rarity rolls the carried loot and never the kit, and off it does nothing', () => {
  _resetForTests(); setPref('lootRarity', true);
  const e = foe();
  spawnEnemyLoot(e, 7, { ...ENEMY_BASICS[7], level: 21, affinity: 'Daedra' }, { ...player, stats: { luck: 100 } }, { rolls: () => 0.0001 });
  const worn = new Set(equipTableOf(e).filter(Boolean));
  for (const it of e.items) {
    if (worn.has(it)) assert.equal(it.rarity, undefined, 'the kit it wears stays DFU\'s');
  }
  const carried = e.items.filter((it) => !worn.has(it) && ['Weapons', 'Armor', 'Jewellery'].includes(it.group) && it.templateIndex !== 131);
  for (const it of carried) assert.notEqual(rarityOf(it), 'common', 'the loot it carries rolled at the boss\'s tier');
  _resetForTests(); setPref('lootRarity', false);   // LR5: the row ships ON, so OFF is a press - a bare reset would leave this half testing the ON path
  const f = foe();
  spawnEnemyLoot(f, 7, ENEMY_BASICS[7], player, { rolls: () => 0.0001 });
  assert.ok(f.items.every((it) => !it.rarity), 'off: nothing rolled');
});

test('RF2: one seam, one home - each host calls it once per spawn branch and none stands the chain itself', () => {
  const hc = read('src/scenes/hostCombat.js');
  // MOD (the loot rebalance): the chain's SHAPE is what this pins, and it is
  // unchanged - table roll, equip, extras, the port's arm last. What moved is
  // arguments: the humanoid item-chance scale into generateItems, and `rolls`
  // into equipEnemy so its worn-gear drop is on the caller's stream too.
  assert.match(hc, /export function spawnEnemyLoot\(entity, mobileType, basics, player, \{ rolls = Math\.random \} = \{\}\) \{\n  const itemChanceScale = isHumanoid\(entity\) \? HUMANOID_LOOT_ITEM_SCALE : 1;\n  entity\.items = generateItems\(basics\?\.lootTableKey \?\? '-', \{ level: player\.level, gender: player\.gender \}, undefined, \{ itemChanceScale \}\);\n  equipEnemy\(entity, mobileType, player\.level, rolls\);\n  addEnemyLootExtras\(entity\.items, basics, rolls\);\n  rollCorpseLoot\(entity, basics, \{ rolls, luck: liveStat\(player, 'luck'\) \}\);\n  return entity\.items;\n\}/, 'the chain, in DFU\'s order, the port\'s arm last');
  for (const [f, n] of [['src/scenes/dungeonContext.js', 2], ['src/scenes/exteriorFoes.js', 1], ['src/scenes/cityGuards.js', 1]]) {
    const src = read(f);
    assert.equal((src.match(/^\s*spawnEnemyLoot\(entity, /gm) ?? []).length, n, `${f}: once per branch`);
    assert.doesNotMatch(src, /^\s*(equipEnemy|addEnemyLootExtras|rollCorpseLoot)\(/m, `${f}: nothing of the chain on its own`);
    assert.doesNotMatch(src, /generateItems\(basics/, `${f}: no table roll of its own`);
  }
  assert.doesNotMatch(read('src/scenes/dungeonContext.js'), /generateItems: generateLootItems,/, 'the dead deps-bag entry is gone with its one reader');
  assert.match(read('src/scenes/exteriorFoes.js'), /if \(puppet\) entity\.items = \[\];/, 'a puppet still stands with an empty list and never reaches the seam');
});
