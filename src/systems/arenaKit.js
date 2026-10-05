// @ts-check
// AUDIT ARENA-LADDER (2026-10-05, the owner: "ensure climbing the PvE ladder isnt an easy feat"; asked what may be used
// on the sand, "No cheese spells or potions"): THE SAND'S KIT LAW. From the bell to the healers a ladder bout is fought
// with arms, armour and fighting magic. Before it the ladder fell to a pack: potions drunk mid-bout, Levitate over a
// ring the clamp held only across the ground (the beasts, the Orc Warlord and the Grand Champion melee-only below),
// Invisibility no class fighter sees through, a Calm or a Charm on the fighter. So, while the player's own LADDER bout is
// set (characters/enemyTargets.js setPlayerBout, its tag's `kit` - a ladder bout, a practice bout and a relay's ladder
// bout alike; AUDIT ARENA-LADDER 2: never a bout between players, whose kit the owner was not asked about):
//   - no potion is drunk (systems/useItem.js's potion arm asks first, and the bottle is kept);
//   - no spell carrying Invisibility, Levitate, Chameleon, Shadow, Calm, Charm or Teleport is cast, whatever casts it - a
//     readied spell, an item's (scenes/hostMagic.js wardedHere, the one engine every host runs);
//   - those effects already on the player are taken off while the fight is live (scenes/arenaBouts.js frame) - a
//     Levitate cast at the gate, a ring's Chameleon (a held item's, restarted when the bout is over - restoreSandHeld);
//   - AUDIT ARENA-LADDER 2: and no fighter can be calmed or charmed by any door (scenes/arenaBouts.js marks every fighter
//     `pacifyImmune`, WB8a's - a weapon's Cast-When-Strikes and a tongue's pacify reach it past the cast engine).
// The port's own: DFU has no arena. Ledger A (ARENA).
import { playerBoutOf } from '../characters/enemyTargets.js';
import { hasActiveEffect, cureAllOfKind } from './effects.js';
import { ARENA_TEXT } from './arenaText.js';
import { restartHeldEnchantments } from './enchantments.js';   // AUDIT ARENA-LADDER 2: a held item's barred effect back after the bout

/** The classic effect types barred from the sand: Invisibility 13, Levitate 14, Chameleon 23, Shadow 24, Pacify 33 (the
 *  four Calms - AUDIT ARENA-LADDER 2: missed at first, and Calm Humanoid is a vampire's own spell), Charm 34, Teleport 43
 *  (Recall is its second half). */
export const SAND_BARRED_EFFECTS = Object.freeze([13, 14, 23, 24, 33, 34, 43]);
/** The live effects (systems/effects.js BUFF_KINDS' words) those leave on the player. */
export const SAND_BARRED_KINDS = Object.freeze(['invisNormal', 'invisTrue', 'levitate', 'chameleonNormal', 'chameleonTrue', 'shadeNormal', 'shadeTrue']);

/** The ceiling over the sand, metres above the ring's centre (player/motor.js _keepInArena, scenes/arenaBouts.js ring):
 *  over the highest honest jump (AcrobatMotor's jumpSpeed 4.5 at Jumping 100, the Jump spell and Athleticism - x2.3, 2.7 m)
 *  and under a Levitate's reach over a melee fighter. */
export const SAND_CEILING_M = 4;
/** Is the player on the sand in a ladder bout of their own (the tag's `kit`)? */
export const onTheSand = () => playerBoutOf()?.kit === true;
/** The refusal of a potion now, or null. */
export const sandPotionRefusal = () => (onTheSand() ? ARENA_TEXT.refuse.potion : null);
/** The refusal of this spell now, or null. */
export const sandSpellRefusal = (sp) => (onTheSand() && (Array.isArray(sp?.effects) ? sp.effects : []).some((e) => e && SAND_BARRED_EFFECTS.includes(e.type)) ? ARENA_TEXT.refuse.magic : null);
/** Take the barred effects off `entity`; answers how many kinds went. */
export function stripSandBarred(entity) {
  let n = 0;
  for (const k of SAND_BARRED_KINDS) {
    if (!hasActiveEffect(entity, k)) continue;
    // AUDIT ARENA-LADDER 2: a held item's (a ring's Chameleon) never comes back by itself - the reroll re-pins only an
    // item whose bundle still stands - so it is marked, and restarted when the bout is over (restoreSandHeld)
    if (entity.activeEffects.some((a) => a.kind === k && a.heldItem)) entity._sandHeld = true;
    cureAllOfKind(entity, k); n++;
  }
  return n;
}
/** AUDIT ARENA-LADDER 2: the bout over - a held item's effect the strip took is put back (its Cast-When-Held restarted). */
export function restoreSandHeld(entity) {
  if (!entity?._sandHeld) return false;
  delete entity._sandHeld;
  restartHeldEnchantments(entity);
  return true;
}
