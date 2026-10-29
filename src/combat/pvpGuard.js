// @ts-check
// PVP-GUARD (the PvP rework, 2026-10-28, "Real health + armour"): MY ARMOUR, AS THE RELAY READS IT. A player's blow is
// rolled against a neutral stand-in (duelCombat.js), so the struck player reports what its armour lets through - the
// overhaul's reduction (combat/pcaao.js) for each kind of blow, averaged over the body parts as a blow picks them - and the
// referee takes that share of the blow before PVP-HIT's cap (net/siege/refereeHealthShare.js guardedBlow). PVP-WARD: my
// resistances the same way for a player's spell, by its element (wardedCast).

import { PCAAO_BODY_PARTS, pcaaoNaturalDamageResistance, pcaaoPartKept, pcaaoModules } from './pcaao.js';
import { PVP_GUARD_KINDS } from '../net/siege/refereeHealthShare.js';
import { VIT_GUARD_MAX } from '../net/wire.js';
import { elementalResistanceChance } from '../systems/spellcast.js';
import { entityResistMod } from '../systems/entityMods.js';

/** DFU's elements in order (fire 0, frost 1, poison 2, shock 3, magic 4), by the name the gear's resistance reads. */
const ELEMENT_NAMES = Object.freeze(['fire', 'frost', 'poison', 'shock', 'magic']);

/** The share of a blow `entity`'s armour lets through, per cent, for each of PVP_GUARD_KINDS (edged, blunt, unarmed). */
export function pvpArmorKept(entity, modules = pcaaoModules()) {
  const nat = pcaaoNaturalDamageResistance(entity);
  return PVP_GUARD_KINDS.map((kind) => {
    const sum = PCAAO_BODY_PARTS.reduce((n, part) => n + pcaaoPartKept(entity, part, kind, nat, modules), 0);
    return Math.max(0, Math.min(VIT_GUARD_MAX, Math.round(sum / PCAAO_BODY_PARTS.length)));
  });
}

/** PVP-WARD: the share of a player's spell `entity`'s resistances let through, per cent, for each element - its Resist
 *  effects' chance and its gear's resistance, the referee's floor of 10 its "resist max 90". */
export function pvpWardKept(entity) {
  return ELEMENT_NAMES.map((name, el) => {
    const resist = elementalResistanceChance(entity, el) + entityResistMod(entity, [name]);
    return Math.max(0, Math.min(100, Math.round(100 - resist)));
  });
}
