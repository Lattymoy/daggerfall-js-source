// FIXED-PVE stage 3 (bible/05-Combat/Fixed-PvE.md section 4): THE REFERENCE BUILDS - the six kinds the spec names, each
// the best custom class for its job: 30 health a level, every attribute raised first, its weapon skill and Critical
// Strike primary, expert in its weapon, and the gear it would build, climbing slowly. A tier's hit is the live formula's
// mean on an unarmoured target (combat/pcaao.js, systems/weaponMastery.js, systems/spell/pveCast.js); sigils and procs
// are not counted. Tempos are the game's clocks (the bow's: characters/weaponStates.js bowReloadSeconds). The
// reference player (pveCategories.js) is these builds' middle. Ledger A (FIXED-PVE).

import { LEVEL_MIN, LEVEL_MAX } from './pveCategories.js';
import { swingFrameSeconds, swingHandling, swingHeft, SWING_FRAME_MIN, SWING_PACE_MOST, MELEE_NUM_FRAMES,
  BOW_NUM_FRAMES, HIT_FRAME_BOW, CLASSIC_UPDATE_INTERVAL } from '../../characters/weaponStates.js';
import { castReleaseS, CAST_RECOVER_S } from '../../combat/fpsSpellCasting.js';
import { speedCastRate, validCastRate } from '../castSpeed.js';
import { pcaaoProficiencyModifiers, pcaaoDamageModifier } from '../../combat/pcaao.js';
import { handToHandMinDamage, handToHandMaxDamage, WEAPON_MATERIAL_MODIFIER } from '../../combat/formulas.js';
import { WEAPONS, weaponMinDamage, weaponMaxDamage } from '../../characters/weapons.js';
import { WEAPON_GEAR_PER_POINT, WEAPON_GEAR_PCT_MOST, WEAPON_POTENCY_PER_POINT } from '../weaponMastery.js';
import { POTENCY_CAP } from '../loot/lootPowers.js';
import { PVE_CAST_PER_SKILL, PVE_CAST_X, pveCastStart } from '../spell/pveCast.js';
import { castCostScale } from '../spell/castLevel.js';
import { POOL_PER_SKILL } from '../spell/skillPool.js';
import { effectCost, EFFECT_COST_TABLE, TARGET_COST_MULT } from '../spellcost.js';
import { EXTRA_SPELL_PTS_MAX_INCREASE } from '../enchantments.js';
import { FOCUS_CAP, WELLSPRING_CAP } from '../loot/lootPowers.js';

/** Skill and gear by level, as the class would build it, gear always counted: health, every attribute, trained
 *  skill (its climb past 100 pays to 40), what gear adds to it and to Critical Strike, the weapon's metal (formulas.js
 *  WEAPON_MATERIAL_MODIFIER's index), swing pace (to SWING_PACE_MOST), cast speed (Rare lines to CAST_SPEED_CAP, then
 *  Firmament), spell potency (Rare lines to POTENCY_CAP), hit chance, the guards gear brings, and from level 30 the
 *  Imprinted Unyielding and Vigil (loot/lootCodex.js: a Rare takes a found Legendary's power). Gear climbs slowly. */
export const TIERS = Object.freeze([
  Object.freeze({ key: 'early', level: 1, health: 45, stat: 75, skill: 30, gearSkill: 0, metal: 0, pace: 0, cast: 0, potency: 0, hit: 0.8, taken: 1, evade: 0, regen: 0, vigil: false }),
  Object.freeze({ key: 'intermediate', level: 10, health: 140, stat: 85, skill: 60, gearSkill: 10, metal: 1, pace: 0, cast: 0.06, potency: 6, hit: 0.9, taken: 1, evade: 0, regen: 0.001, vigil: false }),
  Object.freeze({ key: 'advanced', level: 20, health: 330, stat: 95, skill: 100, gearSkill: 40, metal: 4, pace: 10, cast: 0.15, potency: 15, hit: 0.95, taken: 0.85, evade: 0.03, regen: 0.002, vigil: false }),
  Object.freeze({ key: 'mastered', level: 30, health: 650, stat: 100, skill: 140, gearSkill: 375, metal: 7, pace: 20, cast: 0.25, potency: 25, hit: 0.97, taken: 0.8, evade: 0.05, regen: 0.004, vigil: true }),
  Object.freeze({ key: 'enhanced', level: 40, health: 1000, stat: 100, skill: 140, gearSkill: 650, metal: 9, pace: 35, cast: 0.38, potency: 30, hit: 0.97, taken: 0.7, evade: 0.1, regen: 0.006, vigil: true }),
  Object.freeze({ key: 'top', level: 45, health: 1265, stat: 100, skill: 140, gearSkill: 800, metal: 9, pace: SWING_PACE_MOST, cast: 0.45, potency: POTENCY_CAP, hit: 0.97, taken: 0.6, evade: 0.15, regen: 0.008, vigil: true }),
]);

/** @typedef {{ key: string, name: string, family: 'melee'|'bow'|'spell', range: number, health: number,
 *  weapon?: { type: number, twoHanded?: boolean, kg: number, item?: number }, block?: number, spellShare?: number,
 *  element?: string, blade?: boolean, control: number, note?: string }} BuildKind */

/** The kinds. `weapon.item` is the weapon's template (characters/weapons.js), `type` its swing's row. */
export const BUILD_KINDS = Object.freeze({
  melee: Object.freeze({ key: 'melee', name: 'Melee Fighter', family: 'melee', range: 0, blade: true, health: 1, control: 0.5,
    weapon: Object.freeze({ type: 0, twoHanded: true, kg: 7.5, item: WEAPONS.Dai_Katana }), note: 'Dai-Katana' }),
  archer: Object.freeze({ key: 'archer', name: 'Archer', family: 'bow', range: 1, blade: true, health: 1, control: 0.5,
    weapon: Object.freeze({ type: 0, kg: 1.5, item: WEAPONS.Long_Bow }), note: 'long bow at full draw' }),
  mage: Object.freeze({ key: 'mage', name: 'Destruction Mage', family: 'spell', range: 1, element: 'fire', health: 1, control: 2,
    note: 'the mages\' rework on a PvE foe (spell/pveCast.js)' }),
  defender: Object.freeze({ key: 'defender', name: 'Defensive Fighter', family: 'melee', range: 0, blade: true, block: 0.25, health: 1, control: 1,
    weapon: Object.freeze({ type: 0, kg: 3, item: WEAPONS.Longsword }), note: 'longsword and shield' }),
  battlemage: Object.freeze({ key: 'battlemage', name: 'Hybrid Battlemage', family: 'melee', range: 0, blade: true, spellShare: 0.3, element: 'shock', health: 1, control: 1.5,
    weapon: Object.freeze({ type: 0, kg: 3, item: WEAPONS.Longsword }), note: 'a spell in every third action' }),
  monk: Object.freeze({ key: 'monk', name: 'Hand-to-Hand Fighter', family: 'melee', range: 0, health: 1, control: 0.5,
    weapon: Object.freeze({ type: 15, kg: 0 }), note: 'fists' }),
});
export const BUILD_KIND_KEYS = Object.freeze(Object.keys(BUILD_KINDS));

/** The most of a trained skill's climb past 100 that pays (systems/weaponMastery.js weaponClimb). */
const CLIMB_MOST = 40;

/** A tier's mean hit for `kind`: the roll and its terms, the weapon line, and Critical Strike's chance and multiplier. */
export function tierBlow(kind, tier) {
  const st = tier.stat, attacker = { stats: Object.fromEntries(['strength', 'agility', 'endurance', 'speed', 'luck', 'intelligence', 'willpower', 'personality'].map((k) => [k, st])),
    career: { weaponArmorShieldsBitfield: 0x3f << 16 } };
  const live = tier.skill + tier.gearSkill;
  const luckTerm = Math.floor((st - 50) / 25);
  const critChance = Math.min(1, Math.floor(live / (4 - luckTerm)) / 100), critX = Math.floor(live / 5) * 0.05 + 1;
  const crit = 1 + critChance * (critX - 1);
  const spell = (PVE_CAST_PER_SKILL * live + pveCastStart(tier.level)) * crit * PVE_CAST_X * (1 + tier.potency / 100);   // spell/pveCast.js
  if (kind.family === 'spell') return spell;
  const w = /** @type {NonNullable<BuildKind['weapon']>} */ (kind.weapon);
  let hit;
  if (w.item == null) {
    hit = (handToHandMinDamage(live) + handToHandMaxDamage(live)) / 2 + pcaaoProficiencyModifiers(attacker, null).damageMod + pcaaoDamageModifier(st);
  } else {
    const item = { group: 'Weapons', templateIndex: w.item, material: tier.metal };
    const roll = (weaponMinDamage(w.item) + weaponMaxDamage(w.item)) / 2;
    const str = pcaaoDamageModifier(st) * (w.twoHanded || kind.family === 'bow' ? 2 : 1);
    const line = Math.min(CLIMB_MOST, Math.max(0, tier.skill - 100)) * WEAPON_POTENCY_PER_POINT * 100 + Math.min(WEAPON_GEAR_PCT_MOST, tier.gearSkill * WEAPON_GEAR_PER_POINT);
    hit = (roll + pcaaoProficiencyModifiers(attacker, item).damageMod + str + (WEAPON_MATERIAL_MODIFIER[tier.metal] ?? 0)) * (1 + line / 100);
  }
  const blow = hit * crit;
  return kind.spellShare ? blow + (spell - blow) * kind.spellShare : blow;
}

/** SPELL-SKILL's Magicka (spell/castLevel.js): the build's bolt, SPELLS.STD's Lightning (a ranged Damage Health, 1-25 and
 *  1-5 a level), priced at the tier's live skill; a mage's pool, Intelligence x3 (the class maker's most) grown by the
 *  school (spell/skillPool.js), and from level 30 Extra Spell Points; focus and wellspring climbing as potency does, to their caps. */
export const BOLT = Object.freeze({ type: 4, subType: 0, durationBase: 1, durationMod: 1, durationPerLevel: 1, chanceBase: 1, chanceMod: 1,
  chancePerLevel: 1, magnitudeBaseLow: 1, magnitudeBaseHigh: 25, magnitudeLevelBase: 1, magnitudeLevelHigh: 5, magnitudePerLevel: 1 });
export const POOL_PER_INT = 3;
/** A tier's Magicka: its pool, a bolt's cost, and the share of the pool a kill gives back. */
export function tierMagicka(tier) {
  const live = tier.skill + tier.gearSkill, share = tier.potency / POTENCY_CAP;
  const cost = effectCost(BOLT, () => 50, { online: true }).sp * TARGET_COST_MULT[2] * castCostScale(BOLT, EFFECT_COST_TABLE['4,0'], live);
  const pool = tier.stat * POOL_PER_INT;
  return { magicka: pool * (1 + POOL_PER_SKILL * live) + (tier.vigil ? EXTRA_SPELL_PTS_MAX_INCREASE : 0), castCost: cost * (1 - (FOCUS_CAP * share) / 100), wellspring: (WELLSPRING_CAP * share) / 100 };
}

const clamp = (l) => Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(Number(l) || LEVEL_MIN)));
const lerp = (a, b, t) => a + (b - a) * t;

/** The tier pair `level` falls between and how far along. */
function tierAt(level) {
  const L = clamp(level);
  let i = 0; while (i < TIERS.length - 2 && TIERS[i + 1].level < L) i++;
  return { a: TIERS[i], b: TIERS[i + 1], t: (L - TIERS[i].level) / (TIERS[i + 1].level - TIERS[i].level) };
}

/** Seconds between a build's actions at a tier's Speed, Strength, pace and cast speed. */
export function actionSeconds(kind, speed, strength, pace, cast) {
  if (kind.family === 'bow') {   // BOW-LAW (characters/weaponStates.js bowReloadSeconds): the draw and loose, then the rest of a swing
    const w = /** @type {NonNullable<BuildKind['weapon']>} */ (kind.weapon);
    const swingS = MELEE_NUM_FRAMES.StrikeDown * Math.max(SWING_FRAME_MIN, swingFrameSeconds(speed, { heft: swingHeft(w.kg, strength), handling: swingHandling(w.type, true) }) / (1 + pace / 100));
    return Math.max(swingS, (BOW_NUM_FRAMES.StrikeUp + HIT_FRAME_BOW) * CLASSIC_UPDATE_INTERVAL);
  }
  const rate = validCastRate(speedCastRate(speed) + cast);
  const spellS = castReleaseS(rate) + CAST_RECOVER_S / rate;
  if (kind.family === 'spell') return spellS;
  const w = /** @type {NonNullable<BuildKind['weapon']>} */ (kind.weapon);
  const frame = swingFrameSeconds(speed, { heft: swingHeft(w.kg, strength), handling: swingHandling(w.type, !!w.twoHanded) });
  const swingS = MELEE_NUM_FRAMES.StrikeDown * Math.max(SWING_FRAME_MIN, frame / (1 + pace / 100));
  return kind.spellShare ? lerp(swingS, spellS, kind.spellShare) : swingS;
}

/** A build's Magicka between tiers, and its weapon's blow alone (what a battlemage strikes with when the pool is dry). */
function magickaAt(kind, a, b, t) {
  const ma = tierMagicka(a), mb = tierMagicka(b);
  const weapon = kind.spellShare ? { ...kind, spellShare: 0 } : null;
  return { magicka: lerp(ma.magicka, mb.magicka, t), castCost: lerp(ma.castCost, mb.castCost, t), wellspring: lerp(ma.wellspring, mb.wellspring, t),
    weaponBlow: weapon ? tierBlow(weapon, a) * (tierBlow(weapon, b) / tierBlow(weapon, a)) ** t : null };
}

/**
 * A stated player of `kindKey` at `level`, every number between tiers on a line (the blow on a geometric one). Pure.
 * @param {string} kindKey @param {number} level
 */
export function buildAt(kindKey, level) {
  const kind = BUILD_KINDS[kindKey];
  if (!kind) throw new Error(`unknown build kind ${kindKey}`);
  const L = clamp(level), { a, b, t } = tierAt(L);
  const speed = lerp(a.stat, b.stat, t), strength = speed;
  const blowA = tierBlow(kind, a), blowB = tierBlow(kind, b);
  const taken = lerp(a.taken, b.taken, t);
  return Object.freeze({ kind: kind.key, name: kind.name, level: L, tier: t < 0.5 ? a.key : b.key, family: kind.family, range: kind.range,
    blow: blowA * (blowB / blowA) ** t, hit: lerp(a.hit, b.hit, t), actionS: actionSeconds(kind, speed, strength, lerp(a.pace, b.pace, t), lerp(a.cast, b.cast, t)),
    health: lerp(a.health, b.health, t) * kind.health, taken, evade: lerp(a.evade, b.evade, t), block: kind.block ?? 0,
    regen: lerp(a.regen, b.regen, t), vigil: t < 0.5 ? a.vigil : b.vigil, hitCap: (t < 0.5 ? a.vigil : b.vigil) ? 0.25 : null,
    control: kind.control, element: kind.element ?? null, blade: !!kind.blade, spellShare: kind.family === 'spell' ? 1 : (kind.spellShare ?? 0),
    ...magickaAt(kind, a, b, t) });
}
