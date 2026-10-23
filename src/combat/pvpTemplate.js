// @ts-check
// PWR5 (2026-10-23, bible/05-Combat/Power-Arc.md section 8; Mac, asked: "Templates in refereed lanes" - "the duel, the
// arena and the siege fight on a fixed template (the class and the weapon family; attributes, skills and metal
// normalized; flat health)"): THE TEMPLATE A REFEREED FIGHT IS COUNTED ON.
//
// Every blow between players is counted on the striker's machine off its sheet (combat/duelCombat.js duelAttackerOf,
// duelWeaponOf) against the neutral stand-in, and clipped by the relay's referee (INT8-INT10). In a REFEREED lane - a
// duel, a siege and its works, the Royal Tourney, a bout of the arena's between players - that sheet is the template's:
// the striker keeps what it chose to be (its class's bitfields, its race, the weapon's family - a dagger is no
// claymore) and everything grown or worn is the template's - the level the referee's own bucket already assumes
// (siegeRef.js SIEGE_BONUS's level 30), every attribute at three quarters of the scale, every skill at the classic top
// (100 - no climb past it), the weapon Steel (DFU's material modifier 0) and whole, the claws' metal Steel's. A spell is
// counted at the template's level with no caster's powers (scenes/world.js's strike-outs; the arena's,
// scenes/gate/standInSpell.js spellOnRival). The health is the referee's,
// flat (siegeRef.js PVP_VITALITY). The open zone keeps its gear (Mac's call): its strike-out takes no template.
//
// Not a DFU member: DFU has no other players. Ledger A (PWR5).

import { WEAPON_MATERIALS, weaponMaterialModifier } from '../characters/weapons.js';
import { duelAttackerOf, duelWeaponOf, resolveDuelStrike, duelStandIn } from './duelCombat.js';

/** THE TEMPLATE: its level, every attribute, every skill a blow reads, the weapon's metal and condition. */
export const PVP_TEMPLATE = Object.freeze({ level: 30, attribute: 75, skill: 100, material: WEAPON_MATERIALS.Steel, condition: 100 });

/** A striker's sheet (duelAttackerOf's shape) on the template: its class's bitfields (`cf`) and race (`r`) its own,
 *  the rest the template's; its health is the referee's to hold, kept as the sheet said it. */
export function templateSheet(a) {
  if (!a) return a;
  return {
    ...a,
    lv: PVP_TEMPLATE.level,
    st: a.st.map(() => PVP_TEMPLATE.attribute),
    sk: a.sk.map(() => PVP_TEMPLATE.skill),
    cm: Math.max(0, weaponMaterialModifier(PVP_TEMPLATE.material)),
  };
}
/** A weapon on the wire (duelWeaponOf's `{ t, m, c }`) on the template: its family (the template `t`) its own, Steel and
 *  whole. A bare hand stays bare. */
export const templateWeapon = (w) => (w ? { ...w, m: PVP_TEMPLATE.material, c: PVP_TEMPLATE.condition } : w);
/** A refereed blow rolled whole on the template, for a lane whose blow leaves through another door than the strike-outs
 *  - the arena's bout between players: scenes/dungeonContext.js's swing and shaft at my opponent on a relay's sand
 *  (swingOnRival; combat/arrowFlight.js playerArrowHitFoe's `blow`), its reach and flight the game's: `entity` the
 *  striker, `weapon` the item that struck (null a bare hand), `by` 'melee' or 'arrow'. Answers the damage (0 a miss). */
export function templateBlow(entity, weapon, by = 'melee', rolls = Math.random) {
  const w = duelWeaponOf(weapon);
  return resolveDuelStrike({ by, a: templateSheet(duelAttackerOf(entity, weapon)), ...(w ? { w: templateWeapon(w) } : {}) }, duelStandIn(), { rolls }).dmg;
}
