// SELL-AS-FOUND (AUDIT ECON O1, 2026-10-01): ONLINE A COUNTER PAYS FOR A PIECE AS THE WORLD HANDED IT OVER, AT BEST.
// Roleplay & Realism: Items' condition prices are the room's, and its rolls hand pieces over worn (a pile's and a
// body's at 20-75%, a poorer shelf's at 25-100%), so a sale climbs with a repair. At REPAIR-RATE's third the repair
// cost less than the sale it added, and mending worn loot to sell it paid every player online: +102 gold on a
// value-1000 piece found at 20% (Mercantile 30, Personality 40, a quality-10 counter), +2,592 on a Daedric longsword.
// Each roll now leaves the condition it set as `foundCondition`, and online the Sell arm reads a piece no higher.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tradeCost, getTradePrice, saleConditionPercentage } from '../src/systems/tradeModes.js';
import { ITEM_FIELDS, validItemField } from '../src/systems/itemFields.js';
import { addPileLootExtras, validLootItem } from '../src/systems/loot.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { raiseContainerLootSpawned } from '../src/systems/containerLoot.js';
import { LOOT_CONTAINER_TYPES } from '../src/systems/sceneCache.js';
import { kitCeiling } from '../src/systems/smithItems.js';
import { spawnEnemyLoot } from '../src/scenes/hostCombat.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { weaponOfMaterial } from '../src/combat/enemyEquipment.js';
import { equipTableOf } from '../src/systems/equip.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 };
const at = (v) => () => v;
/** The page online for `fn`, as the room is - and back. */
function online(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}
/** The counter's word on a lot, through the trade window's own walk. */
const quote = (mode, item, { quality = 10, priceAdjustment = 1000, skills = { mercantile: 30, personality: 40 } } = {}) => {
  const lot = tradeCost(mode, [item], { quality, priceAdjustment });
  return getTradePrice(mode, lot.cost, quality, skills, lot.pieces);
};
const mended = (item, to = item.maxCondition) => ({ ...item, currentCondition: to });

test('SELL-AS-FOUND: each of Roleplay & Realism: Items\' rolls leaves the condition it set as foundCondition - a body\'s worn kit, a J-O pile\'s weapon, a poorer shelf\'s armour; a ring, a new shelf\'s piece and the gold carry none (mutants: either roll\'s mark dropped)', () => {
  const knight = makeEnemyEntity(133, ENEMY_BASICS[133], STATS, 5, at(0.5));
  spawnEnemyLoot(knight, 133, ENEMY_BASICS[133], { level: 5, gender: 'male', stats: { ...STATS } }, { rolls: at(0.3) });
  const kit = Object.values(equipTableOf(knight)).filter(Boolean);
  assert.ok(kit.length >= 5, 'a Knight in his armour');
  for (const it of kit) {
    assert.ok(it.currentCondition < it.maxCondition, `${it.name}: worn by the body's roll`);
    assert.equal(it.foundCondition, it.currentCondition, `${it.name}: marked as handed over`);
  }
  const pile = addPileLootExtras([weaponOfMaterial(120, 9)], 'J', at(0.5), { online: false });
  assert.equal(pile[0].foundCondition, pile[0].currentCondition);
  assert.ok(pile[0].currentCondition < pile[0].maxCondition * 0.75, 'a pile\'s piece at 20-75%');
  const shelf = (quality) => raiseContainerLootSpawned({ containerType: LOOT_CONTAINER_TYPES.ShopShelves, buildingType: BUILDING_TYPES.Armorer, quality,
    items: stockShopShelf({ buildingType: BUILDING_TYPES.Armorer, quality }, { level: 5 }, { rolls: at(0.3) }), rolls: at(0.3) });
  const poor = shelf(5).filter((it) => it.group === 'Armor' || it.group === 'Weapons');
  assert.ok(poor.length > 0);
  for (const it of poor) assert.equal(it.foundCondition, it.currentCondition, `${it.name}: a quality-5 shelf's`);
  for (const it of shelf(20)) assert.equal(it.foundCondition, undefined, `${it.name}: a quality-20 shelf stocks new, unmarked`);
  assert.equal(knight.items.find((it) => it.group === 'Currency')?.foundCondition, undefined, 'gold');
});

test('SELL-AS-FOUND: online, repairing a found piece to sell it never pays - the counter pays what it paid before, a smith\'s whole repair and a kit\'s 75% alike, for every haggler at every counter (mutants: the mark ignored; read past the mark; the rule offline-only)', () => {
  online(() => {
    let checked = 0;
    for (const quality of [1, 10, 20]) {
      for (const priceAdjustment of [750, 1000, 1250]) {
        for (const skills of [{ mercantile: 0, personality: 0 }, { mercantile: 30, personality: 40 }, { mercantile: 60, personality: 60 }, { mercantile: 100, personality: 100 }]) {
          for (const found of [200, 450, 749]) {
            const c = { quality, priceAdjustment, skills };
            const piece = { group: 'Weapons', templateIndex: 120, material: 0, value: 1000, currentCondition: found, maxCondition: 1000, foundCondition: found };
            const asFound = quote('Sell', piece, c);
            const repair = quote('Repair', piece, c);
            assert.ok(repair >= 1, 'a repair is never free (FB0929)');
            assert.equal(quote('Sell', mended(piece), c), asFound, `q${quality} adj${priceAdjustment} m${skills.mercantile}: whole sells as found`);
            assert.equal(quote('Sell', mended(piece, kitCeiling(piece)), c), asFound, 'a kit\'s 75% the same');
            assert.ok(quote('Sell', mended(piece), c) - repair < asFound, 'the repair is a loss on the sale');
            checked++;
          }
        }
      }
    }
    assert.equal(checked, 108);
    // the field's own Daedric longsword, found at 20% (the roll's low end): it was +2,592 at Mercantile 40 / Personality 50
    const sword = addPileLootExtras([weaponOfMaterial(120, 9)], 'J', at(0), { online: false })[0];
    assert.deepEqual([sword.value, sword.currentCondition, sword.maxCondition], [23040, 2560, 12800]);   // WEAPON-POOL: 1280 of 6400 on the row's pool
    const c = { quality: 10, skills: { mercantile: 40, personality: 50 } };
    assert.equal(quote('Sell', sword, c), 1728, 'as found');
    assert.equal(quote('Sell', mended(sword), c), 1728, 'whole, as found');
    assert.ok(quote('Repair', sword, c) > 0);
  });
});

test('SELL-AS-FOUND: what the mark leaves alone - wear after the find still lowers the sale, a piece handed over whole sells at its own condition repaired or not, and offline the mod\'s price reads the condition alone (mutants: the higher of the two; every piece capped)', () => {
  const piece = { group: 'Armor', templateIndex: 102, material: 0, value: 1000, currentCondition: 400, maxCondition: 1000, foundCondition: 400 };
  online(() => {
    assert.equal(saleConditionPercentage(piece), 40);
    assert.equal(saleConditionPercentage({ ...piece, currentCondition: 150 }), 15, 'worn below the find: the lower');
    assert.ok(quote('Sell', { ...piece, currentCondition: 150 }) < quote('Sell', piece));
    const bought = { ...piece, foundCondition: undefined };
    assert.equal(saleConditionPercentage(mended(bought)), 100, 'no mark: its own condition');
    assert.ok(quote('Sell', mended(bought)) > quote('Sell', bought), 'a whole-handed piece repaired sells whole');
    assert.equal(saleConditionPercentage({ ...piece, foundCondition: 1.5 }), 40, 'a mark that is not one is not read');
  });
  assert.equal(saleConditionPercentage(mended(piece), { online: false }), 100, 'offline: the condition alone');
  assert.ok(quote('Sell', mended(piece)) > quote('Sell', piece), 'offline a repair raises the sale, as the mod has it');
});

test('SELL-AS-FOUND: the mark is a declared field - a whole number, never under 0 - and rides the wire to whoever takes the piece (mutants: the declaration dropped)', () => {
  assert.deepEqual(ITEM_FIELDS.foundCondition, { kind: 'int', min: 0 });
  assert.equal(validItemField('foundCondition', 1280), 1280);
  assert.equal(validItemField('foundCondition', -1), undefined);
  const sword = addPileLootExtras([weaponOfMaterial(120, 9)], 'J', at(0), { online: false })[0];
  assert.equal(validLootItem(JSON.parse(JSON.stringify(sword)))?.foundCondition, 2560, 'a trade, a chest, a market listing carry it');   // WEAPON-POOL: 1280 on the row's pool
  assert.equal(validLootItem({ ...sword, foundCondition: 'whole' }), null, 'a forged mark is not an item');
});
