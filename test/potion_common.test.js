// POTION-COMMON (2026-10-01, the field: "make health potions more common"; the economy arc - bible/06-Systems/
// Economy-Arc.md: "Potions are the solo answer to healing, so they are easy to come by"). A Potion of Healing was a
// twentieth of DFU's random potion - 0.15% of looting foes, 0.2% of J-O piles - and no ordinary shop sold one. Beside
// that random potion (kept): a looting foe carries one 6 times in 100, a J-O pile holds one 12 times in 100, and an
// alchemist's and a general store's shelf stock a few a day, counted by the shop's quality and drawn from no roll.
// MAGICKA-COMMON (LOOT-EASE, 2026-10-05, Mac: "majicka potions should be more common loot drops, same with health
// pots"): the healing potion 10 in 100 a foe and 18 a pile, and the Potion of Restore Power beside it, 6 and 10.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  HEALING_RECIPE_KEY, HEALING_ENEMY_CHANCE, HEALING_PILE_CHANCE, mintHealingPotion, healingShelfCount, installHealingSupply,
  MAGICKA_RECIPE_KEY, MAGICKA_ENEMY_CHANCE, MAGICKA_PILE_CHANCE, mintMagickaPotion,
} from '../src/systems/healingSupply.js';
import { CLASSIC_RECIPE_KEYS, POTION_TEMPLATE_INDEX, addEnemyLootExtras, addPileLootExtras } from '../src/systems/loot.js';
import { potionRecipeByKey } from '../src/systems/potions.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { installSmithing } from '../src/systems/smithItems.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

installSmithing();
installHealingSupply();   // the hosts' order (scenes/shared.js)
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const healing = (items) => items.filter((it) => it.group === 'UselessItems1' && it.potionRecipeKey === HEALING_RECIPE_KEY)
  .reduce((n, it) => n + (it.stackCount ?? 1), 0);
const at = (v) => () => v;
/** A scripted roll stream: each draw the next value, the last repeated. */
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const kits = (items) => items.filter((it) => it.fieldKit === true).length;
const magicka = (items) => items.filter((it) => it.group === 'UselessItems1' && it.potionRecipeKey === MAGICKA_RECIPE_KEY)
  .reduce((n, it) => n + (it.stackCount ?? 1), 0);

test('POTION-COMMON: the potion is DFU\'s own Potion of Healing - the "healing" recipe, classicRecipeKeys[2], a bottle worth its recipe\'s 50 (mutants: another recipe\'s key)', () => {
  assert.equal(HEALING_RECIPE_KEY, CLASSIC_RECIPE_KEYS[2]);
  assert.equal(potionRecipeByKey(HEALING_RECIPE_KEY)?.name, 'healing');
  const p = mintHealingPotion();
  assert.deepEqual([p.group, p.templateIndex, p.potionRecipeKey, p.value], ['UselessItems1', POTION_TEMPLATE_INDEX, HEALING_RECIPE_KEY, 50]);
});

test('POTION-COMMON: an alchemist stocks 2 + a fifth of its quality a day, a general store 1 + a tenth, any other shop none - at the shelf\'s end, from no roll (mutants: either shop\'s stock dropped; the shelf\'s loop dropped)', () => {
  const Q = [1, 3, 4, 5, 9, 10, 14, 15, 19, 20];   // AUDIT ECON P4: every boundary - a fifth and a tenth TRUNCATED, never rounded
  assert.deepEqual(Q.map((q) => healingShelfCount(BUILDING_TYPES.Alchemist, q)), [2, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
  assert.deepEqual(Q.map((q) => healingShelfCount(BUILDING_TYPES.GeneralStore, q)), [1, 1, 1, 1, 1, 2, 2, 2, 2, 3]);
  assert.equal(healingShelfCount(BUILDING_TYPES.Bank, 20), 0);
  const alch = stockShopShelf({ buildingType: BUILDING_TYPES.Alchemist, quality: 10 }, { level: 5 }, { rolls: at(0.999), torchesFromItems: false });
  assert.equal(healing(alch), 4);
  assert.equal(alch.at(-1).potionRecipeKey, HEALING_RECIPE_KEY, 'the last row');
  const gen = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 20 }, { level: 5 }, { rolls: at(0.999), torchesFromItems: false });
  assert.equal(healing(gen), 3);
  assert.match(rd('src/systems/shopStock.js'), /if \(shelfIndex === 0\) for \(let n = healingShelfCount\(buildingType, quality\); n > 0; n--\) add\(mintHealingPotion\(\)\);\n {2}return items;\n\}/, 'after every draw of the shelf, before it is handed back');
  // AUDIT ECON P1: the shop's FIRST shelf alone - every shelf model is a container stocked whole, so the day's potions on
  // each made a shop of five shelves stock five days' worth; the counter sells from shelf 0 (openMerchantSell)
  const second = stockShopShelf({ buildingType: BUILDING_TYPES.Alchemist, quality: 10 }, { level: 5 }, { rolls: at(0.999), torchesFromItems: false, shelfIndex: 1 });
  assert.equal(healing(second), 0, 'a second shelf: none');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /shelf\.items = shelfLootSpawned\(stockShopShelf\(\{ buildingType: b\.buildingType, quality: b\.quality \}, playerEntity, \{ shelfIndex: i \}\), b\);/, 'openShelf hands its index');
  assert.match(wm, /const shelf = interiorCtx\?\.shelves\?\.\[0\] \?\? null;[\s\S]{0,900}shelfLootSpawned\(stockShopShelf\(\{ buildingType: b\.buildingType, quality: b\.quality \}, playerEntity\), b\)/, 'the counter stocks shelf 0, the default');
  assert.equal((wm.match(/stockShopShelf\(/g) ?? []).length, 3, 'the shelf, the counter and the probe - no fourth door');
});

test('POTION-COMMON: a J-O pile holds one 18 times in 100 and no other pile ever; a looting foe carries one 10 times in 100 and a foe with no loot table never (LOOT-EASE: 12 and 6 raised; mutants: either chance at 0 or back; every pile)', () => {
  assert.equal(HEALING_PILE_CHANCE, 18);
  assert.equal(HEALING_ENEMY_CHANCE, 10);
  for (const key of ['J', 'O']) {
    assert.equal(healing(addPileLootExtras([], key, at(0.17), { online: false })), 1, `${key}: 17 under 18`);
    assert.equal(healing(addPileLootExtras([], key, at(0.18), { online: false })), 0, `${key}: 18 is not`);
  }
  for (const key of ['A', 'I', 'P']) assert.equal(healing(addPileLootExtras([], key, at(0), { online: false })), 0, `${key}: never - J to O alone`);
  assert.equal(healing(addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, at(0.09))), 1, '9 under 10');
  assert.equal(healing(addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, at(0.1))), 0, '10 is not');
  assert.equal(healing(addEnemyLootExtras([], { lootTableKey: '-', mapChance: 0 }, at(0))), 0, 'no loot table, no potion');
});

test('MAGICKA-COMMON (LOOT-EASE, 2026-10-05): DFU\'s own Potion of Restore Power - classicRecipeKeys[4], a bottle worth 75 - in a J-O pile 10 times in 100 and on a looting foe 6, never elsewhere, its draw after the healing potion\'s (mutants: another recipe\'s key; either chance moved; the draw first; the extras\' install dropping it)', () => {
  assert.equal(MAGICKA_RECIPE_KEY, CLASSIC_RECIPE_KEYS[4]);
  assert.equal(potionRecipeByKey(MAGICKA_RECIPE_KEY)?.name, 'restorePower');
  const p = mintMagickaPotion();
  assert.deepEqual([p.group, p.templateIndex, p.potionRecipeKey, p.value], ['UselessItems1', POTION_TEMPLATE_INDEX, MAGICKA_RECIPE_KEY, 75]);
  assert.deepEqual([MAGICKA_PILE_CHANCE, MAGICKA_ENEMY_CHANCE], [10, 6]);
  for (const key of ['J', 'O']) {
    assert.equal(magicka(addPileLootExtras([], key, at(0.09), { online: false })), 1, `${key}: 9 under 10`);
    assert.equal(magicka(addPileLootExtras([], key, at(0.1), { online: false })), 0, `${key}: 10 is not`);
  }
  for (const key of ['A', 'I', 'P']) assert.equal(magicka(addPileLootExtras([], key, at(0), { online: false })), 0, `${key}: never - J to O alone`);
  assert.equal(magicka(addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, at(0.05))), 1, '5 under 6');
  assert.equal(magicka(addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, at(0.06))), 0, '6 is not');
  assert.equal(magicka(addEnemyLootExtras([], { lootTableKey: '-', mapChance: 0 }, at(0))), 0, 'no loot table, no potion');
  // the order: DFU's trio, the field kit, the healing potion, then this one - a foe's sixth draw is the magicka potion's
  const foe = addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, seq(0.99, 0.99, 0.99, 0.99, 0.5, 0.01));
  assert.deepEqual([healing(foe), magicka(foe)], [0, 1], 'the healing potion\'s draw missed, the magicka potion\'s landed');
  const foe2 = addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, seq(0.99, 0.99, 0.99, 0.99, 0.01, 0.5));
  assert.deepEqual([healing(foe2), magicka(foe2)], [1, 0], 'and the other way');
});

test('POTION-COMMON: every host installs it, after the smithing install so a field kit\'s roll still comes first (mutants: the install dropped)', () => {
  assert.match(rd('src/scenes/shared.js'), /installSmithing\(\);[^\n]*\n {2}installHealingSupply\(\);/);
});

test('POTION-COMMON: installed with the smithing install, both extras roll - the field kit FIRST, then the potion - on a pile and on a looting foe (mutants: the potion registered under the kit\'s name, so the kit is lost; the order swapped)', () => {
  // a J pile: the map's, the random potion's and the recipe's draws (DFU's), then the field kit's 5 under 6, then the potion's 50
  const pile = addPileLootExtras([], 'J', seq(0.99, 0.99, 0.99, 0.05, 0.5), { online: false });
  assert.deepEqual([kits(pile), healing(pile)], [1, 0], 'the kit took the first of the extras\' draws');
  const pile2 = addPileLootExtras([], 'J', seq(0.99, 0.99, 0.99, 0.5, 0.05), { online: false });
  assert.deepEqual([kits(pile2), healing(pile2)], [0, 1], 'and the potion the second');
  // a looting foe: the map's (drawn at a chance of 0 too), the random potion's and the recipe's draws, then the kit's 2
  // under 3, then the potion's 50
  const foe = addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, seq(0.99, 0.99, 0.99, 0.02, 0.5));
  assert.deepEqual([kits(foe), healing(foe)], [1, 0]);
  const foe2 = addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, seq(0.99, 0.99, 0.99, 0.5, 0.05));
  assert.deepEqual([kits(foe2), healing(foe2)], [0, 1]);
  // the hosts install it ONCE, after the smithing install - a Map keeps a name's first place, so a second, earlier call
  // would put the potion's draw first
  const shared = rd('src/scenes/shared.js');
  assert.equal((shared.match(/installHealingSupply\(\);/g) ?? []).length, 1, 'once');
  assert.ok(shared.indexOf('installHealingSupply();') > shared.indexOf('installSmithing();'), 'after the smithing install');
});
