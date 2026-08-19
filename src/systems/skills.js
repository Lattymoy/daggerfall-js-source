// The skills MODEL (extracted from chargen in the 2026-07-06d audit
// - entity-layer concepts, not creation logic; formulas, advancement,
// chargen, and the scenes all consume it from here).

// AUDIT 18: the career SPECIAL-ABILITY bits, from the one home that
// already decodes them (specialAdvantages.js is a leaf - it imports
// nothing - so this cannot cycle; rest.js's copy imports skills.js
// and would).
import { SPECIAL_ABILITY_BITS } from './specialAdvantages.js';

export const SKILLS = Object.freeze({
  Medical: 0, Etiquette: 1, Streetwise: 2, Jumping: 3, Orcish: 4,
  Harpy: 5, Giantish: 6, Dragonish: 7, Nymph: 8, Daedric: 9,
  Spriggan: 10, Centaurian: 11, Impish: 12, Lockpicking: 13,
  Mercantile: 14, Pickpocket: 15, Stealth: 16, Swimming: 17,
  Climbing: 18, Backstabbing: 19, Dodging: 20, Running: 21,
  Destruction: 22, Restoration: 23, Illusion: 24, Alteration: 25,
  Thaumaturgy: 26, Mysticism: 27, ShortBlade: 28, LongBlade: 29,
  HandToHand: 30, Axe: 31, BluntWeapon: 32, Archery: 33,
  CriticalStrike: 34,
});
export const SKILL_COUNT = 35;

/** DFCareer.MagicSkills - the six schools. One home: the custom-class
 *  builder's Spellsword rule (U20a) and SetEnemyCareer's flat magic
 *  skill (enemySpells) had grown byte-identical private copies. */
export const MAGIC_SKILLS = Object.freeze([
  SKILLS.Destruction, SKILLS.Restoration, SKILLS.Illusion,
  SKILLS.Alteration, SKILLS.Thaumaturgy, SKILLS.Mysticism,
]);
/** The enum KEYS, index-ordered (the enum inverted once). Code
 *  identity - not what a window prints. */
export const SKILL_KEYS = Object.freeze(Object.entries(SKILLS).reduce((a, [k, v]) => { a[v] = k; return a; }, new Array(SKILL_COUNT)));

/** U10: what a window PRINTS - TextProvider.GetSkillName's strings
 *  (Internal_Strings.csv:380-400,498): the enum key with a space
 *  before each interior capital, and Hand-to-Hand hyphenated. The
 *  port printed the raw enum key, so the char sheet and the new
 *  chargen skills screen read "ShortBlade" and "BluntWeapon" where
 *  classic reads "Short Blade" and "Blunt Weapon". */
export const SKILL_NAMES = Object.freeze(SKILL_KEYS.map((k) =>
  (k === 'HandToHand' ? 'Hand-to-Hand' : k.replace(/([a-z])([A-Z])/g, '$1 $2'))));

/** DaggerfallUnityItem.GetWeaponSkillUsed -> skill id, by name. */
export const WEAPON_SKILL = Object.freeze({
  Dagger: SKILLS.ShortBlade, Tanto: SKILLS.ShortBlade, Wakazashi: SKILLS.ShortBlade, Shortsword: SKILLS.ShortBlade,
  Broadsword: SKILLS.LongBlade, Longsword: SKILLS.LongBlade, Saber: SKILLS.LongBlade,
  Katana: SKILLS.LongBlade, Claymore: SKILLS.LongBlade, 'Dai-Katana': SKILLS.LongBlade,
  'Battle Axe': SKILLS.Axe, 'War Axe': SKILLS.Axe,
  Staff: SKILLS.BluntWeapon, Mace: SKILLS.BluntWeapon, Flail: SKILLS.BluntWeapon, Warhammer: SKILLS.BluntWeapon,
  'Short Bow': SKILLS.Archery, 'Long Bow': SKILLS.Archery,
});

/** Skill read across both entity shapes: enemies carry the
 *  SetEnemyCareer FLAT number (every skill equal, verbatim); the
 *  player carries the rolled 35-array after chargen (and the flat
 *  interim before it). Per-skill PINS (SetPermanentSkillValue on
 *  specific ids - S16 forces spellcasting enemies' six magic skills
 *  to 80) ride entity.skillOverrides over either base shape. */
export function skillValue(entity, skillId) {
  const o = entity.skillOverrides;
  if (o && o[skillId] != null) return o[skillId];
  const s = entity.skills;
  if (typeof s === 'number') return s;
  return s?.[skillId] ?? 0;
}

/** TallySkill (the E3c flag clears): count a use toward advancement.
 *  The 20000 clamp is VERBATIM (PlayerEntity.TallySkill) - and it is
 *  what keeps the source's (uses * reflexesMod) >> 16 inside int32:
 *  20000 * 0x14000 fits; an unclamped tally would overflow the shift
 *  in C# and JS alike (caught by S3b's own test). */
export function tallySkill(entity, skillId, amount = 1) {
  if (!entity.skillUses) return;
  entity.skillUses[skillId] += amount;
  if (entity.skillUses[skillId] > 20000) entity.skillUses[skillId] = 20000;
}

/** Verbatim AcrobatMotor.jumpSpeedMultiplier (:88-105): 1 +
 *  JumpingSkill * 0.5 / 100 (skill adds up to +50% force), plus
 *  athleticismMultiplier 0.1 when the career carries Athleticism.
 *
 *  AUDIT 18: the +10% used to be INTERIM 0 behind a flag blaming a
 *  decode that had ALREADY SHIPPED in U20b (specialAdvantages.js
 *  parses the bitfield) - and CLASS09 (Acrobat) carries
 *  abilityFlagsAndSpellPointsBitfield 0x1406, so a VANILLA Acrobat,
 *  not just a custom class, jumped 10% short.
 *
 *  Still honestly 0 here: improvedAthleticism (+0.1) is an
 *  ImprovesTalents ENCHANTMENT and the Jump spell (+0.6) an active
 *  effect - neither family exists yet. P14. */
export function jumpSpeedMultiplier(entity) {
  let m = 1 + (skillValue(entity, SKILLS.Jumping) * 0.5) / 100;
  // DFCareer.HasSpecialAbility: the flag masked against the
  // bitfield's LOW BYTE, verbatim (the C# (byte)flags cast).
  const bits = entity.career?.abilityFlagsAndSpellPointsBitfield ?? 0;
  if ((bits & SPECIAL_ABILITY_BITS.athleticism) === SPECIAL_ABILITY_BITS.athleticism) m += 0.1;
  return m;
}
