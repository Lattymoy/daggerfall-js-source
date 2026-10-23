// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW6b (2026-10-05, bible/06-Systems/Living-World.md "LW6b"): THE FALLEN IN THE DEEP - WHAT THEY CARRIED. A fallen diver's
// remains laid in a dungeon (scenes/livingWorld/deepRemains.js lays them; the world host's livingRemainsStep asks): their
// class's corpse picture and their goods, the same each time they are laid. HOST-SPLIT (SEA VENTURES, 2026-10-22): moved
// verbatim out of scenes/world.js's bootWorld, which read nothing of its own scope for it - the room the sea's wiring
// takes (bible/01-Overview/Host-Split.md).
// ═══════════════════════════════════════════════════════════════════
import { classLookOf } from '../../world/travellerSprites.js';
import { lwRng, textSeed } from '../../systems/livingWorld/seed.js';
import { generateItems as generateLootItems, enemyLootTableKey, createRandomWeapon, createRandomArmor } from '../../systems/loot/loot.js';
import { setItemFields, mintCondition, isAmmunition } from '../../systems/item/itemTemplates.js';
import { goldStack } from '../../systems/inventory.js';
import { mintKeepsake } from '../../systems/livingWorld/keepsake.js';

/** LW6b: a fallen diver's remains in the dungeon `d` at `feet` - their class's corpse picture, and what they carried:
 *  their class's own loot table at their level, a weapon and a piece of armour, their purse. */
export function livingRemainsLay(d, res, feet, key = res.id) {
  const look = classLookOf(res);
  const corpse = look?.basics?.corpseTexture;
  if (!corpse) return null;
  const level = Math.max(1, res.level | 0);
  const rolls = lwRng(textSeed(key), 0x676f6f64);   // 'good' - AUDIT-C5: the same goods each time they are laid (never a reroll for leaving)
  const items = generateLootItems(enemyLootTableKey(res.cls, look.basics.lootTableKey ?? '-'), { level, gender: res.sex ?? 'male' }, rolls);
  // AUDIT-C7: their weapon and their armour minted as every other piece the port hands out (the item's fields, its
  // condition), never an arrow for a weapon
  for (const raw of [createRandomWeapon(level, rolls), createRandomArmor(level, rolls)]) if (raw && !isAmmunition(raw)) items.push(mintCondition(setItemFields(raw)));
  items.push(goldStack(5 + Math.floor(rolls() * 20 * level)));
  items.push(mintKeepsake(res));   // LW6c: their own keepsake, for their household
  return d.layRemains(items, feet, { archive: corpse.archive, record: corpse.record }, key);   // AUDIT LW-III: tagged with its key
}
