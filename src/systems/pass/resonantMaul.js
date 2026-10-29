// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 6): THE RESONANT MAUL - the Brass Colossus's drop, a
// Dwarven warhammer of the Legendary rung (systems/loot/lootRarity.js registerLegendary, The Last Lock's door). UNROLLED:
// lawful on its item wherever the item law reads it (systems/item/itemLaw.js imports this file, so the account service's
// judge knows it), but no roll of a warhammer lands on it - the Colossus mints it whole (scenes/seasonHost.js), and every
// seeded roll draws from the pool it drew from before. Its power is sideways and inside THE CEILING HOLDS: Resonance, a
// bane on the season's constructs at less than Dragonsbane's share. Not a DFU member. Ledger A (STOREFRONT).
import { registerLegendary, applyRarity } from '../loot/lootRarity.js';
import { createWeapon, WEAPONS_ENUM } from '../../combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../item/itemTemplates.js';
import { ENCHANTMENT_TYPES as T } from '../../formats/magicDef.js';
import { PASS_CONSTRUCT_MOBILES } from '../../net/battlePassLaw.js';

/** Its base: a warhammer, of Dwarven make (WeaponMaterialTypes.Dwarven). */
export const RESONANT_MAUL_TEMPLATE = WEAPONS_ENUM.Warhammer;
export const RESONANT_MAUL_MATERIAL = 4;
/** Its record. Orsinium's Anvil's lines a step under (32/12/25); its enchantment held, never struck - the brass takes the
 *  centurions' lightning. */
export const RESONANT_MAUL = Object.freeze({
  id: 'resonant-maul', name: 'The Resonant Maul', group: 'Weapons', templates: Object.freeze([RESONANT_MAUL_TEMPLATE]),
  unrolled: true,
  affixes: Object.freeze([
    Object.freeze({ id: 'damage', value: 30 }),
    Object.freeze({ id: 'stat', param: 'strength', value: 12 }),
    Object.freeze({ id: 'skill', param: 32, value: 25 }),   // Blunt Weapon
  ]),
  enchantment: Object.freeze({ type: T.CastWhenHeld, param: 13 }),   // Resist Shock
  lore: 'Struck from the Colossus\'s heart-bell. It still rings when brass is near.',
  power: Object.freeze({ name: 'Resonance', kind: 'bane', foes: PASS_CONSTRUCT_MOBILES, pct: 40,
    brief: '+40% vs Dwemer constructs', text: 'This weapon deals 40% more damage to Dwemer constructs: spheres, golems and centurions' }),
  hint: 'The Brass Colossus drops it, in the Dwemer\'s Breach season',
});
registerLegendary(RESONANT_MAUL);

/** One Resonant Maul, known: its base minted as any warhammer is, laddered Legendary onto its one record. */
export function mintResonantMaul(rolls = Math.random) {
  const item = mintCondition(setItemFields({ group: 'Weapons', ...createWeapon(RESONANT_MAUL_TEMPLATE, RESONANT_MAUL_MATERIAL, rolls) }));
  if (!item) return null;
  applyRarity(item, 'legendary', rolls, [RESONANT_MAUL]);
  item.isIdentified = true;
  return item;
}
