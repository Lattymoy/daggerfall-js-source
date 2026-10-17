// BAL6-GAUNTLETS (bible/05-Combat/Balance-Arc.md section 12; the owner, 2026-10-12: "based on your equipped gauntlets it
// would affect your attacks as a wereboar/werewolf. Like scaling without being overpowered"; asked, "Metal's damage
// bonus"): A DEPARTURE - THE BEAST'S CLAWS TAKE THE METAL ON ITS HANDS.
//
// DFU's claws are the bare hand: CalculateHandToHandAttackDamage rolls the skill's span and adds the swing and Strength -
// no item - and BAL6-CLAWS left them so, ungated. MorphSelf empties both hands and the pack is refused to the beast
// (systems/lycanthropy.js), but what it wore stays on, its gauntlets with them. Plate gauntlets now add their metal's
// damage to every claw hit: DaggerfallUnityItem.GetWeaponMaterialModifier of that metal, the points DFU's core adds to a
// blade of it (Elven +1 ... Daedric +6), never below the bare claws (Iron's -1 is not taken). Its damage alone: no
// to-hit, no material gate, no silver's double, no condition band; leather and chain have no metal. Both cores'
// hand-to-hand blows read it (combat/pcaao.js pcaaoHandToHandAttackDamage, combat/formulas.js handToHandAttackDamage),
// the refereed lanes' stand-in carries it (combat/duelCombat.js), and the stats card models it (combat/combatStats.js).
//
// AUDIT CLAWS (Balance-Arc.md section 12): the piece is what the equip rules seat in the Gloves slot (a saved slot is
// trusted on a load - a cuirass, or a mod's gloves after the mod is off, is no gauntlet), its metal the class's own
// (RRI's Brigandine Gloves are leather by their class, whatever metal they name: rriItems.js rriNativeMaterialValue, the
// port's one reader of it), and a broken one is no metal.
import { equipTableOf, getEquipSlot, isBrokenItem, EQUIP_SLOTS } from '../systems/equip.js';
import { plateMetal } from '../systems/armorMaterials.js';
import { rriNativeMaterialValue } from '../systems/roleplayRealismItems/rriItems.js';
import { weaponMaterialModifier, WEAPON_MATERIALS } from '../characters/weapons.js';

/** The most the claws take: Daedric's modifier. */
export const CLAW_METAL_MAX = weaponMaterialModifier(WEAPON_MATERIALS.Daedric);

/** The damage a transformed lycanthrope's claws take from the gauntlets it wears: their plate metal's material
 *  modifier, never below 0. 0 out of beast form, bare-handed, in leather or chain, or in a broken piece. A refereed
 *  lane's stand-in (combat/duelCombat.js duelStub) has no equip table and carries this law's word as `clawMetal`. */
export function clawMetalDamage(entity) {
  if (Number.isInteger(entity?.clawMetal)) return entity.clawMetal;
  if (!entity?.isInBeastForm) return 0;
  const g = equipTableOf(entity)[EQUIP_SLOTS.Gloves];
  if (!g || isBrokenItem(g) || getEquipSlot(entity, g) !== EQUIP_SLOTS.Gloves) return 0;
  const metal = plateMetal(rriNativeMaterialValue(g));
  return metal === null ? 0 : Math.max(0, weaponMaterialModifier(metal));
}
