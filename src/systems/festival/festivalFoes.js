// @ts-check
// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): WHAT A FOE IS TO THE FESTIVAL - "the dead do walk tonight"
// (Tales and Tallows, TEXT.RSC 8387) and "the creatures created or summoned there may plague Tamriel for eons" (the
// Witches' Festival, 8392). A foe's find is asked by its kind (net/festivalLaw.js FIND_SOURCES): the undead and the
// summoned - the Daedra and the atronachs - give more; an elite and a boss more again. The Wyrd's Raiment's Tallow-Ward
// (systems/sigil/sigilSets.js 'wyrd') bites the same two kinds.
//
// Pure. Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).
import { MOBILE_TYPES as M } from '../../characters/mobile/mobileTypes.js';

/** The walking dead (DaggerfallUnityEnums MobileTypes). */
export const FESTIVAL_UNDEAD = Object.freeze([M.SkeletalWarrior, M.Zombie, M.Ghost, M.Mummy, M.Wraith, M.Vampire, M.VampireAncient, M.Lich, M.AncientLich]);
/** The summoned: the Daedra and the atronachs. */
export const FESTIVAL_SUMMONED = Object.freeze([M.FrostDaedra, M.FireDaedra, M.Daedroth, M.DaedraSeducer, M.DaedraLord, M.FireAtronach, M.IronAtronach, M.FleshAtronach, M.IceAtronach]);
/** Whether a foe is one the festival's night belongs to - the dead or the summoned. */
export const hallowedFoe = (/** @type {any} */ e) => FESTIVAL_UNDEAD.includes(e?.mobileType) || FESTIVAL_SUMMONED.includes(e?.mobileType);
/** A foe's find source (festivalLaw FIND_SOURCES): an elite (`eliteFoe`, systems/eliteFoes.js; or a champion - its
 *  trait's id, systems/champions.js), the undead, the summoned, or any other foe - or null for a world boss's body
 *  (`worldBoss`, the Starfall's master - scenes/starfall/starfallHost.js masterOf): its fall is the act's (`star-held`,
 *  `breach-closed`, `serpent-slain`: festivalLaw's `endgame`), never a body's too.
 *  @returns {string|null} */
export function foeFindSource(/** @type {any} */ e) {
  if (e?.worldBoss === true) return null;
  if (e?.eliteFoe === true || (typeof e?.champion === 'string' && e.champion !== '')) return 'elite';
  if (FESTIVAL_UNDEAD.includes(e?.mobileType)) return 'undead';
  if (FESTIVAL_SUMMONED.includes(e?.mobileType)) return 'daedra';
  return 'foe';
}
