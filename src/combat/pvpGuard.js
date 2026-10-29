// @ts-check
// PVP-GUARD (the PvP rework, 2026-10-28, "Real health + armour"): MY ARMOUR, AS THE RELAY READS IT. A player's blow is
// rolled against a neutral stand-in (duelCombat.js), so the struck player reports what its armour lets through - the
// overhaul's reduction (combat/pcaao.js) for each kind of blow, averaged over the body parts as a blow picks them - and the
// referee takes that share of the blow before PVP-HIT's cap (net/siege/refereeHealthShare.js guardedBlow). PVP-WARD: my
// resistances the same way for a player's spell, by its element (wardedCast).

import { PCAAO_BODY_PARTS, pcaaoNaturalDamageResistance, pcaaoPartKept, pcaaoModules } from './pcaao.js';
import { PVP_GUARD_KINDS } from '../net/siege/refereeHealthShare.js';
import { VIT_GUARD_MAX } from '../net/wire.js';
import { elementalResistanceChance, savingChance, savedShare, elementFlag } from '../systems/spellcast.js';

/** DFU's elements, fire 0, frost 1, poison 2, shock 3, magic 4. */
const ELEMENTS = Object.freeze([0, 1, 2, 3, 4]);

/** The share of a blow `entity`'s armour lets through, per cent, for each of PVP_GUARD_KINDS (edged, blunt, unarmed). */
export function pvpArmorKept(entity, modules = pcaaoModules()) {
  const nat = pcaaoNaturalDamageResistance(entity);
  return PVP_GUARD_KINDS.map((kind) => {
    const sum = PCAAO_BODY_PARTS.reduce((n, part) => n + pcaaoPartKept(entity, part, kind, nat, modules), 0);
    return Math.max(0, Math.min(VIT_GUARD_MAX, Math.round(sum / PCAAO_BODY_PARTS.length)));
  });
}

/** PVP-WARD (the owner: "race and willpower need to work"): what of a player's spell lands on `entity`, per cent, for each
 *  element, on average - its Resist effects' chance first, then its own saving throw (race, Willpower, career, biography,
 *  gear), as a monster's spell meets it (systems/spellcast.js savingThrow). The referee's floor of 10 is "resist max 90". */
export function pvpWardKept(entity) {
  return ELEMENTS.map((el) => {
    const resisted = Math.min(100, elementalResistanceChance(entity, el));
    const sc = savingChance(el, elementFlag(el), entity);
    const lands = sc.immune ? 0 : savedShare(sc.chance);
    return Math.max(0, Math.min(100, Math.round(((100 - resisted) * lands) / 100)));
  });
}
