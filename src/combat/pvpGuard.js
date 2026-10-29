// @ts-check
// PVP-GUARD (the PvP rework, 2026-10-28, "Real health + armour"): MY ARMOUR, AS THE RELAY READS IT. A player's blow is
// rolled against a neutral stand-in (duelCombat.js), so the struck player reports what its armour lets through - the
// overhaul's reduction (combat/pcaao.js) for each kind of blow, averaged over the body parts as a blow picks them - and the
// referee takes that share of the blow before PVP-HIT's cap (net/siege/refereeHealthShare.js guardedBlow).

import { PCAAO_BODY_PARTS, pcaaoNaturalDamageResistance, pcaaoPartKept, pcaaoModules } from './pcaao.js';
import { PVP_GUARD_KINDS } from '../net/siege/refereeHealthShare.js';
import { VIT_GUARD_MAX } from '../net/wire.js';

/** The share of a blow `entity`'s armour lets through, per cent, for each of PVP_GUARD_KINDS (edged, blunt, unarmed). */
export function pvpArmorKept(entity, modules = pcaaoModules()) {
  const nat = pcaaoNaturalDamageResistance(entity);
  return PVP_GUARD_KINDS.map((kind) => {
    const sum = PCAAO_BODY_PARTS.reduce((n, part) => n + pcaaoPartKept(entity, part, kind, nat, modules), 0);
    return Math.max(0, Math.min(VIT_GUARD_MAX, Math.round(sum / PCAAO_BODY_PARTS.length)));
  });
}
