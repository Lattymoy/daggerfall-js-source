// @ts-check
// FIXED-PVE TEMPLATE-DROPS (bible/05-Combat/Fixed-PvE.md section 20): the gear pveDrops.js names, minted as Daggerfall
// mints a random piece (ItemBuilder.CreateRandomWeapon, CreateRandomArmor, CreateRandomJewellery) at the foe's level.
// The corpse's roll ladders it after. Ledger A (FIXED-PVE).
import { createRandomWeapon, createRandomArmor, createRandomJewellery } from '../loot/loot.js';
import { setItemFields, mintCondition, isAmmunition } from '../item/itemTemplates.js';
import { templateGearKinds, OVER_GEAR_LEVELS } from './pveDrops.js';

/** Push template foe `entity`'s own gear onto its `entity.items`; answers the pieces. @param {any} entity @param {() => number} rolls */
export function addTemplateGear(entity, rolls = Math.random) {
  const level = Math.max(1, Number(entity?.level) | 0), out = [];
  for (const kind of templateGearKinds(entity, rolls)) {
    const raw = kind === 'jewel' ? createRandomJewellery(rolls) : kind === 'weapon' ? createRandomWeapon(level, rolls) : createRandomArmor(level, rolls);
    if (raw && !isAmmunition(raw)) out.push(mintCondition(setItemFields(raw)));
  }
  if (out.length) (entity.items ??= []).push(...out);
  return out;
}

const GEAR_GROUPS = Object.freeze(['Weapons', 'Armor', 'Jewellery', 'MensClothing', 'WomensClothing']);

/** OVER-GEAR: strip the gear from template foe `entity`'s items when `rollerLevel` stands OVER_GEAR_LEVELS or more above
 *  it; answers how many pieces went. Never ammunition. @param {any} entity @param {number} rollerLevel */
export function stripOverGear(entity, rollerLevel) {
  if (!entity?.pveTemplate || !Array.isArray(entity.items) || !(rollerLevel - (Number(entity.level) || 1) >= OVER_GEAR_LEVELS)) return 0;
  const before = entity.items.length;
  entity.items = entity.items.filter((it) => !GEAR_GROUPS.includes(it?.group) || isAmmunition(it));
  return before - entity.items.length;
}
