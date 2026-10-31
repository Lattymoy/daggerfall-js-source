// @ts-check
// FIXED-PVE TEMPLATE-DROPS (bible/05-Combat/Fixed-PvE.md section 20): the gear pveDrops.js names, minted as Daggerfall
// mints a random piece (ItemBuilder.CreateRandomWeapon, CreateRandomArmor, CreateRandomJewellery) at the foe's level.
// The corpse's roll ladders it after. Ledger A (FIXED-PVE).
import { createRandomWeapon, createRandomArmor, createRandomJewellery, createRandomClothing } from '../loot/loot.js';
import { setItemFields, mintCondition, isAmmunition, ITEM_TEMPLATES } from '../item/itemTemplates.js';
import { templateGearKinds, OVER_GEAR_LEVELS } from './pveDrops.js';

/** CLOTH-DROPS: the cloaks of each clothing group (ItemTemplates: Casual and Formal Cloak). */
const CLOAKS = Object.freeze({ MensClothing: [154, 155], WomensClothing: [191, 192] });
/** A clothing piece (ItemBuilder.CreateRandomClothing), made a cloak when `cloak`: its dye kept, its variant one the cloak has. */
function clothPiece(entity, cloak, rolls) {
  const c = createRandomClothing(entity?.gender === 'female' || (entity?.gender == null && rolls() < 0.5) ? 'female' : 'male', rolls);
  if (!cloak) return c;
  const pick = CLOAKS[c.group][Math.min(1, Math.floor(rolls() * 2))];
  return { ...c, templateIndex: pick, variant: c.variant % Math.max(1, ITEM_TEMPLATES[pick]?.variants ?? 1) };
}

/** Push template foe `entity`'s own gear onto its `entity.items`; answers the pieces. @param {any} entity @param {() => number} rolls */
export function addTemplateGear(entity, rolls = Math.random) {
  const level = Math.max(1, Number(entity?.level) | 0), out = [];
  for (const kind of templateGearKinds(entity, rolls)) {
    const raw = kind === 'jewel' ? createRandomJewellery(rolls) : kind === 'weapon' ? createRandomWeapon(level, rolls)
      : kind === 'armor' ? createRandomArmor(level, rolls) : clothPiece(entity, kind === 'cloak', rolls);
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
