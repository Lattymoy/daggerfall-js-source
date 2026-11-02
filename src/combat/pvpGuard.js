// @ts-check
// PVP-GUARD (the PvP rework, 2026-10-28, "Real health + armour"): MY ARMOUR, AS THE RELAY READS IT. A player's blow is
// rolled against a neutral stand-in (duelCombat.js), so the struck player reports what its armour lets through - the
// overhaul's reduction (combat/pcaao.js) for each kind of blow, averaged over the body parts as a blow picks them - and the
// referee takes that share of the blow before PVP-HIT's cap (net/siege/refereeHealthShare.js guardedBlow). PVP-WARD: my
// resistances the same way for a player's spell, by its element (wardedCast).

import { PCAAO_BODY_PARTS, pcaaoNaturalDamageResistance, pcaaoPartKept, pcaaoModules } from './pcaao.js';
import { VIT_GUARD_MAX } from '../net/wire.js';
import { elementalResistanceChance, savingChance, savingLands, elementFlag } from '../systems/spellcast.js';
import { spellReflectionChance, chanceValue } from '../systems/effects.js'; // PVP-KIT: Reflect and Absorb
import { SPELL_ABSORPTION_CHANCE_CAP } from '../systems/absorption.js';
import { PVP_GUARD_KINDS, PVP_SHIELD } from '../net/siege/refereeHealthShare.js';

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

/** PVP-WARD: what of a player's spell lands on `entity`, per cent, for each
 *  element, on average - its Resist effects' chance first, then its own saving throw (race, Willpower, career, biography,
 *  gear), as a monster's spell meets it (systems/spellcast.js savingThrow). The referee's floor of 15 is "85% resist". */
export function pvpWardKept(entity) {
  const turned = ((100 - pvpReflectChance(entity)) * (100 - pvpAbsorbChance(entity))) / 100; // PVP-KIT: what Reflect and Absorb let by
  return ELEMENTS.map((el) => {
    const resisted = Math.min(100, elementalResistanceChance(entity, el));
    const sc = savingChance(el, elementFlag(el), entity);
    const lands = sc.immune ? 0 : savingLands(sc.chance);
    return Math.max(0, Math.min(100, Math.round(((100 - resisted) * lands * turned) / 10_000)));
  });
}

/** PVP-KIT: the live Spell Reflection's chance on `entity`, per cent - a player's spell is taken off by it, never bounced. */
export const pvpReflectChance = (entity) => Math.max(0, Math.min(100, spellReflectionChance(entity)));
/** PVP-KIT: the best live Spell Absorption's chance, at `entity`'s own level as DFU reads it, held to absorption's cap. */
export function pvpAbsorbChance(entity) {
  let best = 0;
  for (const a of entity?.activeEffects ?? [])
    if (a.kind === 'spellAbsorption' && !a.ended) best = Math.max(best, chanceValue(a, Math.trunc(entity.level || 1)));
  return Math.max(0, Math.min(SPELL_ABSORPTION_CHANCE_CAP, best));
}

/** PVP-SHIELD: a live Shield spell on `entity` (playerEntity.js damageShieldPool's pool) - the referee takes its share off. */
export const pvpShielded = (entity) =>
  (entity?.activeEffects ?? []).some((a) => a.kind === 'shield' && !a.ended && a.shieldRemaining > 0);
/** PVP-KIT: the Shield's share, per cent - its pool over my maximum health (the bar's Shield is 10-25% of it), held to
 *  PVP_SHIELD's 10..25; 0 with none. A classic Shield's small pool reads the floor. */
export function pvpShieldShare(entity) {
  if (!pvpShielded(entity)) return 0;
  const pool = Math.max(
    ...(entity.activeEffects ?? [])
      .filter((a) => a.kind === 'shield' && !a.ended)
      .map((a) => a.startingShield ?? a.shieldRemaining ?? 0),
  );
  const of = Math.round((100 * pool) / Math.max(1, entity.maxHealth || 1));
  return Math.max(PVP_SHIELD.min, Math.min(PVP_SHIELD.max, of));
}
