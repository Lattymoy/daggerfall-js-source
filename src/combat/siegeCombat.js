// @ts-check
// AUDIT-SEATS G5 (2026-10-01, Mac: "Finish the seats"): A SIEGE FOUGHT WITH MORE THAN THE SWING (bible/11-Multiplayer/
// Seats-Arc.md 6.1: "The blow - a claim {target, weapon kind, material, spell?} ... bows 60 m"; "Spells - at most 3
// damaging casts in 5 seconds, each clamped to 60; Teleport, Recall and Levitate do nothing in a siege room; healing a
// side-mate is allowed (ALLY-CAST's frame), clamped to 40 a cast"; "Horses are dismounted on entry"). SEAT2a part four
// sent the melee swing alone (its `r` always a swing's); PVP-REF's referee (net/siege/siegeRef.js refereeBlow, refereeCast)
// already judges a shaft at a shaft's reach and a cast's damage or heal - this is the client's half of the rest:
//
//   - A SHAFT: the blow an arrow lands is a shaft's (SIEGE_HIT.Shaft - the referee refuses a shaft from anything but a
//     bow, and a swing from a bow), its damage rolled on the striker's own sheet as the swing's is (combat/duelCombat.js
//     resolveDuelStrike, the release's StrikeDown and the draw's time).
//   - A SPELL'S NUMBERS: the referee holds every fighter's vitality and takes a number, so a spell is landed on a stand-in
//     body through the one door every spell lands by (systems/effects.js applySpell) with sinks that only count - its
//     harm (the families a fight is made of: duelSpellOf) for a foe, its Heal Health for a side-mate. The referee clips
//     both (60, 40) and bounds their rate.
//   - THE WARDS: a spell carrying Teleport (classic 43 - its Recall the same effect's other half) or Levitate (14) is
//     refused in a battle's room with a line, before it costs anything; the motor's levitation is held off there.
//   - THE SADDLE: a rider in a battle's room is set on foot, with a line.
//
// Pure but for the one spell door (handed in for the pins), the stand-in and the rolls. Not a DFU member. Ledger A (EVERY
// PALACE A SEAT's row).
import { SIEGE_HIT, SIEGE_CASTS } from '../net/siege/siegeRef.js';
import { duelSpellOf } from './duelCombat.js';
import { applySpell } from '../systems/effects.js';

/** A blow's kind on the referee's wire: an arrow's a shaft's, anything else a swing's. */
export const siegeBlowKind = (by) => (by === 'arrow' ? SIEGE_HIT.Shaft : SIEGE_HIT.Melee);
/** A cast's number as it is sent - never past what the referee keeps of it (SIEGE_CASTS: 60 a harm, 40 a heal), so a
 *  Disintegrate's whole is never a frame the wire refuses. */
export const siegeCastClamp = (n, heal = false) => Math.min(Math.max(0, Math.round(Number(n) || 0)), heal ? SIEGE_CASTS.healMax : SIEGE_CASTS.damageMax);
/** The classic effect types a battle's wards turn: Teleport (43 - Recall is its own second half) and Levitate (14). */
export const SIEGE_BARRED_EFFECTS = Object.freeze([43, 14]);
/** Whether a spell carries a warded effect. */
export const siegeSpellBarred = (sp) => (Array.isArray(sp?.effects) ? sp.effects : []).some((e) => e && SIEGE_BARRED_EFFECTS.includes(e.type));
/** The wards' line, and the saddle's. */
export const SIEGE_SPELL_BARRED_TEXT = 'Teleport, Recall and Levitate do nothing on a battlefield.';
export const SIEGE_DISMOUNT_TEXT = "You can't ride a horse on a battlefield.";

/**
 * THE NUMBERS A SPELL CARRIES TO THE REFEREE: `{ harm, heal }` - what its harmful families (duelSpellOf) deal at once (at
 * its own range, its save rolled as any caster's spell's) and what its Heal Health restores (as ALLY-CAST's receiver
 * lands a gift: a self-cast, no save), landed through `apply` (systems/effects.js applySpell) at `level` on `standIn` (the
 * neutral one, combat/duelCombat.js duelStandIn - AUDIT C&C H5: a body of the caster's own sheet saved against its spell
 * with its own willpower and race; the target's protections are not a number this client has; the referee clips), `caster`
 * the casting entity. Whole numbers, never negative; a spell that throws counts nothing. The stand-in keeps nothing.
 * @param {any} sp @param {number} level @param {any} standIn @param {any} [caster]
 * @param {{ apply?: Function, rolls?: () => number }} [o]
 */
export function siegeSpellNumbers(sp, level, standIn, caster = null, { apply = applySpell, rolls = Math.random } = {}) {
  let harm = 0, heal = 0;
  const none = () => {};
  const count = (into) => (n) => { const v = Number(n); if (v > 0) { if (into === 'harm') harm += v; else heal += v; } };
  const run = (spell, sinks) => {
    try { apply(spell, level, standIn, sinks, rolls, caster ? { entity: caster } : null); } catch { return false; } finally { if (standIn) standIn.activeEffects = []; }
    return true;
  };
  const harmful = duelSpellOf(sp);
  if (harmful && !run(harmful, { hurt: count('harm'), heal: none, drainFatigue: none, restoreFatigue: none, drainMagicka: none, restoreMagicka: none })) harm = 0;
  // its Heal Health (effects.js isHealHealth) landed as ALLY-CAST lands a gift - a self-cast (rangeType 0), no save rolled
  const healing = (Array.isArray(sp?.effects) ? sp.effects : []).filter((e) => e && e.type === 10 && e.subType === 8);
  if (healing.length && !run({ ...sp, rangeType: 0, effects: healing }, { hurt: none, heal: count('heal'), drainFatigue: none, restoreFatigue: none, drainMagicka: none, restoreMagicka: none })) heal = 0;
  return { harm: Math.round(harm), heal: Math.round(heal) };
}
