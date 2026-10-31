// @ts-check
// SPELL-SKILL (bible/05-Combat/Fixed-PvE.md section 13): A PLAYER'S SPELL READS ITS SCHOOL, NOT ITS CASTER'S LEVEL.
// DFU rolls every magnitude, duration and chance off the caster's level, so a level 45 with a weak school casts like a
// master. Here each effect reads its own school's live skill / 2.2 (skill 100 = level 45). Past that, damage keeps
// climbing (the PvE and PvP holds bound it), heal and buff points climb at half speed, and durations and chances stop.
// Monsters, items and the PvP bar keep the caster's level. Off with fixed PvE. Ledger A (FIXED-PVE).
import { skillValue } from '../skills.js';
import { fixedPveOn } from '../pve/pveSwitch.js';

/** PVE-CAST's hold: a landing at a PvE foe is at most this much of the school's live skill (spell/pveCast.js reads it
 *  from here, so the price below never imports the cast's chain). */
export const PVE_CAST_PER_SKILL = 0.15;

/** Skill points to one cast level, and the cast level skill 100 reads. */
export const CAST_LEVEL_PER_SKILL = 2.2;
export const CAST_LEVEL_TOP = 45;

/** The cast level `skill` reads, at least 1. */
export const castLevelOf = (skill) => Math.max(1, Math.floor(Math.max(0, Number(skill) || 0) / CAST_LEVEL_PER_SKILL + 1e-9));
/** The level a duration or a chance reads: none past the top. */
export const timeLevel = (L) => Math.min(L, CAST_LEVEL_TOP);
/** The level a heal's or a buff's points read: half speed past the top. */
export const pointsLevel = (L) => (L <= CAST_LEVEL_TOP ? L : CAST_LEVEL_TOP + Math.floor((L - CAST_LEVEL_TOP) / 2));

/** The damage family: Damage Health/Fatigue/Spell Points, instant (4) and continuous (1). */
export const isSpellDamage = (e) => e?.type === 4 || e?.type === 1;

/** Whether `caster`'s spells read their schools: my own player, the switch on. @param {any} caster */
export const skillCasts = (caster, { on = fixedPveOn() } = {}) => on && !!caster?.isPlayer && !caster.peer;

/**
 * `caster`'s levels for an effect cast in `school`, or null where the caster's own level stands (switch off, no school,
 * not my own player).
 * @param {any} caster @param {number|null|undefined} school
 * @param {{ on?: boolean }} [o]
 * @returns {{ damage: number, points: number, time: number } | null}
 */
export function castLevels(caster, school, { on = fixedPveOn() } = {}) {
  if (!skillCasts(caster, { on }) || school == null) return null;
  const L = castLevelOf(skillValue(caster, school));
  return { damage: L, points: pointsLevel(L), time: timeLevel(L) };
}

/** The most skill takes off a cast's cost (at skill 100), and the skill the classic price is read at. */
export const CAST_COST_DISCOUNT = 0.25;
export const CAST_COST_PRICE_SKILL = 50;
/** The share of that price a cast pays (2026-10-30: half cost, beside a pool that grows - spell/skillPool.js). */
export const CAST_COST_SHARE = 0.5;
const discount = (skill) => 1 - (CAST_COST_DISCOUNT * Math.min(Math.max(0, skill), 100)) / 100;

/** An effect's average magnitude, chance and duration at `skill`, the components `entry` (spellcost.js) prices. */
function powerAt(e, entry, skill) {
  const L = castLevelOf(skill), T = timeLevel(L), v = /** @type {Record<string, number>} */ ({});
  if (entry.magnitude) {
    const P = isSpellDamage(e) ? L : pointsLevel(L);
    const m = (e.magnitudeBaseLow + e.magnitudeBaseHigh) / 2 + ((e.magnitudeLevelBase + e.magnitudeLevelHigh) / 2) * Math.floor(P / Math.max(1, e.magnitudePerLevel));
    v.m = damageKind(e) === 'health' ? Math.min(m, PVE_CAST_PER_SKILL * Math.max(0, skill)) : m;   // health damage pays for what its hold lets land
  }
  if (entry.chance) v.c = Math.min(100, e.chanceBase + e.chanceMod * Math.floor(T / Math.max(1, e.chancePerLevel)));
  if (entry.duration) v.d = e.durationBase + e.durationMod * Math.max(1, Math.floor(T / Math.max(1, e.durationPerLevel)));
  return v;
}

/**
 * SPELL-SKILL's price: what the classic price at skill 50 is multiplied by at `skill`. The effect's power grows from
 * skill 100's (the mean of its components' growth; its square root past 100), less the skill discount. Crit is never
 * priced.
 * @param {any} e @param {any} entry @param {number} skill
 */
export function castCostScale(e, entry, skill) {
  const v = powerAt(e, entry, skill), ref = powerAt(e, entry, 100);
  const keys = Object.keys(v).filter((k) => ref[k] > 0);
  const g = keys.length ? keys.reduce((a, k) => a + v[k] / ref[k], 0) / keys.length : 1;
  return (CAST_COST_SHARE * (g > 1 ? Math.sqrt(g) : g) * discount(skill)) / discount(CAST_COST_PRICE_SKILL);   // past 100, the square root: a full pool still casts
}

/** THE SPELLMAKER'S BUDGET: no effect grows faster per level than the fastest stock spell in SPELLS.STD does - Fire
 *  Storm's 10 magnitude, Troll's Blood's 5 rounds, Paralysis's 15% (the potions' records left out). Base settings stay
 *  free. A made spell past it casts and prices as if built at the budget; its record is never rewritten. */
export const SPELL_BUDGET = Object.freeze({ magnitude: 10, duration: 5, chance: 15 });

/** `e` within SPELL_BUDGET: itself when it already is, else a copy with its per-level plus brought down. */
export function budgetEffect(e) {
  if (!e || e.type <= -1) return e;
  const per = (k) => Math.max(1, e[k] | 0);
  const mMax = SPELL_BUDGET.magnitude * per('magnitudePerLevel'), dMax = SPELL_BUDGET.duration * per('durationPerLevel');
  const cMax = SPELL_BUDGET.chance * per('chancePerLevel');
  if (e.magnitudeLevelHigh <= mMax && e.durationMod <= dMax && e.chanceMod <= cMax) return e;
  return { ...e, magnitudeLevelHigh: Math.min(e.magnitudeLevelHigh, mMax), magnitudeLevelBase: Math.min(e.magnitudeLevelBase, mMax),
    durationMod: Math.min(e.durationMod, dMax), chanceMod: Math.min(e.chanceMod, cMax) };
}

/** The damage an effect does, by what it takes: health, fatigue or magicka (Damage and Continuous Damage alike). */
export const damageKind = (e) => (isSpellDamage(e) && !e.key ? ['health', 'fatigue', 'magicka'][e.subType & 0xff] ?? null : null);

/** ONE DAMAGE OF A KIND (2026-10-30): a spell does one damage to health, one to fatigue and one to magicka at
 *  most - each landing has its own hold, so three of a kind struck three times. A later effect of a kind already done
 *  is left out of the cast and its price (type -1, as an empty slot). */
export function oneDamagePerKind(effects) {
  const seen = new Set();
  return (effects ?? []).map((e) => {
    const k = damageKind(e);
    if (!k) return e;
    if (seen.has(k)) return { ...e, type: -1 };
    seen.add(k);
    return e;
  });
}
