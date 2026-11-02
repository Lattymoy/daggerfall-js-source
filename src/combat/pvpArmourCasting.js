// PVP-ARMOUR-CAST (the PvP rework plan, Stage 6: "do the plate cost and half its cost for chain"): in a fight with a
// player, each worn plate piece costs a spell 6% more magicka and casts it 3% slower; a chain piece half that; leather
// and light nothing. A piece's type is its own (an RRI light set piece is leather, its mail set chain - rriItems.js).
// PvE is left as it is ("keep pve seperate"). A departure: DFU has no such cost.
import { equipTableOf, EQUIP_SLOTS } from '../systems/equip.js';
import { rriNativeMaterialValue } from '../systems/roleplayRealismItems/rriItems.js';
import { registerSpellCostMod } from '../systems/spellcost.js';
import { registerCastSpeedMod } from '../systems/castSpeed.js';
import { playerInPvpFight } from './pvpPotions.js';

/** Per cent a piece adds to a spell's cost and takes off the cast rate, by DFU's ArmorTypes (Leather 0, Chain 1, Plate 2). */
export const PVP_ARMOUR_CAST = Object.freeze({ cost: Object.freeze([0, 3, 6]), slow: Object.freeze([0, 1.5, 3]) });
const PIECES = ['Head', 'RightArm', 'LeftArm', 'ChestArmor', 'Gloves', 'LegsArmor', 'Feet'];

/** The per cents `entity`'s worn armour adds to cost and takes off speed. Pure over the equip table. */
export function pvpArmourCast(entity) {
  const t = entity ? equipTableOf(entity) : null;
  let cost = 0,
    slow = 0;
  for (const slot of PIECES) {
    const it = t?.[EQUIP_SLOTS[slot]];
    if (it?.group !== 'Armor') continue;
    const kind = Math.max(0, Math.min(2, rriNativeMaterialValue(it) >> 8));
    cost += PVP_ARMOUR_CAST.cost[kind];
    slow += PVP_ARMOUR_CAST.slow[kind];
  }
  return { cost, slow };
}

/** The cost door: a player's cast in a fight, by its armour. */
export const pvpArmourCastCost = (entity, sp) =>
  playerInPvpFight() ? sp * (1 + pvpArmourCast(entity).cost / 100) : sp;
/** The rate door: the percent off a player's cast rate in a fight. */
export const pvpArmourCastSpeed = (entity) =>
  playerInPvpFight() && entity?.isPlayer ? -pvpArmourCast(entity).slow : 0;

export const PVP_ARMOUR_CAST_MOD = 'pvp-armour-cast';
registerSpellCostMod(PVP_ARMOUR_CAST_MOD, pvpArmourCastCost);
registerCastSpeedMod(PVP_ARMOUR_CAST_MOD, pvpArmourCastSpeed);
