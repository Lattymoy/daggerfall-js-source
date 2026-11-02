// @ts-check
// OH-E (Ocean Holes): OnTableLootSpawned / OnEnemyLootSpawned - a pile or a corpse rolled while the abyss is being built,
// is the player's bound abyss, or is the Recall back to it: AddBonusMagicLoot off the key's MI, then UpgradeLoot. Out of
// scenes/world.js bootWorld whole (HOST-SPLIT, EVENT-RULES 2026-10-25 - the host's room for SD-REZ's wiring); the host
// calls it once per world and keeps the off it answers.
import { addBonusMagicLoot, upgradeLoot } from '../world/oceanHoles.js';
import { createRegularMagicItem, getMagicItemTemplates, lootMatrix, tableLootSpawned } from '../systems/loot/loot.js';   // OH-E: CreateRandomMagicItem, GetMatrix, LootTables.OnLootSpawned
import { enemyLootSpawned } from '../characters/enemy/enemyEntity.js';   // OH-E: EnemyEntity.OnLootSpawned
import { customItemClass } from '../systems/roleplayRealismItems/rriItems.js';   // OH-E: UpgradeLoot's `GetType() != typeof(DaggerfallUnityItem)`
import { setItemFields, mintCondition } from '../systems/item/itemTemplates.js';
import { weaponOfMaterial, armorOfMaterial } from '../combat/enemyEquipment.js';   // OH-E: UpgradeLoot's SetItem + ApplyWeaponMaterial / ApplyArmorSettings
import { isEnchanted } from '../systems/inventory.js';

/**
 * The abyss's two loot listeners, installed - and the one call that removes both.
 * AUDIT OH-F B3: the dungeon's loot alone - DFU's build is one synchronous call and the exterior is off inside, so
 * ShouldUpgradeLoot never meets another host's roll; the port's build awaits, and the street runs meanwhile.
 * PARTY-LOOT: the raiser's dice and roller when it hands them (a room's shared base rolls on the room's - the party's
 * level and gender, the room's stream), else the player's, as before.
 * @param {{ shouldUpgradeLoot: () => boolean }} ohAbyss @param {() => any} player the player entity, read at each roll
 * @returns {() => void}
 */
export function ohLootUpgrades(ohAbyss, player) {
  const ohUpgrade = (key, items, worn = [], where = null, rolls = Math.random, roller = player()) => {
    if (where !== 'dungeon' || !ohAbyss.shouldUpgradeLoot()) return;
    addBonusMagicLoot(lootMatrix(key).MI, items, () => {   // ItemBuilder.CreateRandomMagicItem(Level, Gender, Race)
      const t = getMagicItemTemplates();
      return t ? mintCondition(setItemFields(createRegularMagicItem(t, roller.level, roller.gender, rolls))) : null;
    }, rolls);
    upgradeLoot(worn.length ? [...new Set([...items, ...worn])] : items, {   // the bonus in: UpgradeLoot walks the whole of Items after it
      remintWeapon: (ti, m) => weaponOfMaterial(ti, m),
      remintArmor: (ti, m, v) => armorOfMaterial(ti, m, v),   // ApplyArmorSettings(the player's gender and race, the variant kept)
      isCustom: (/** @type {any} */ it) => !!customItemClass(it.templateIndex),
      isEnchanted,
    });
  };
  const offTable = tableLootSpawned.add((e) => ohUpgrade(e.key, e.items, [], e.where, e.rolls ?? Math.random, e.roller ?? player()));
  const offEnemy = enemyLootSpawned.add((e) => ohUpgrade(e.lootTableKey, e.items, e.worn, e.where, e.rolls ?? Math.random, e.roller ?? player()));
  return () => { offTable(); offEnemy(); };
}
