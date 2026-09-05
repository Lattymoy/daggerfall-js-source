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

/** DaggerfallSkills.GetPermanentSkillValue (:163-186) - the STORED
 *  value, and DFU's own comment on it is "does not include effect
 *  mods". Read across both entity shapes: enemies carry the
 *  SetEnemyCareer FLAT number (every skill equal, verbatim); the
 *  player carries the rolled 35-array after chargen (and the flat
 *  interim before it). Per-skill PINS (SetPermanentSkillValue on
 *  specific ids - S16 forces spellcasting enemies' six magic skills
 *  to 80) ride entity.skillOverrides over either base shape.
 *
 *  DFU keeps the two getters apart on purpose and the laws that read
 *  them CHOSE: guild rank (Guild.CalculateNumHighLowSkills :124) and
 *  the training cap (DaggerfallGuildServiceTraining.cs:101) read this
 *  one, so a worn Fortify/EnhancesSkill item cannot buy a promotion
 *  or move the 50-cap. */
export function permanentSkillValue(entity, skillId) {
  const o = entity.skillOverrides;
  if (o && o[skillId] != null) return o[skillId];
  const s = entity.skills;
  if (typeof s === 'number') return s;
  return s?.[skillId] ?? 0;
}

/** DaggerfallSkills.GetLiveSkillValue (:135-143): the permanent value
 *  PLUS the effect mod. */
export function skillValue(entity, skillId) {
  const o = entity.skillOverrides;
  if (o && o[skillId] != null) return o[skillId];
  // E1: SetSkillMod's channel (EnhancesSkill +15) - DFU's
  // Skills.GetLiveSkillValue adds the mod to every read, cleared and
  // re-applied per round by the constant-effect pass. The fold is
  // entity._enchantMods; a host that never pumps reads +0.
  let mod = entity._enchantMods?.skillMods?.[skillId] ?? 0;
  // V2a: the racial override's own SetSkillMod producer - the curse
  // entry's map (lycanthropy +30 on its seven skills), the same
  // cleared-and-reapplied cadence through lycanthropyMagicRound
  const list = entity.activeEffects;
  if (list) {
    for (const a of list) {
      if (a.kind === 'racialOverride' && !a.ended) mod += a.skillMods?.[skillId] ?? 0;
    }
  }
  return permanentSkillValue(entity, skillId) + mod;
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

// ---- PlayerEntity.skillsRecentlyRaised (:70, :218-231) -------------
//
// DFU keeps a uint[2] BITMASK of the skills that have gone up since
// the character sheet was last closed, and the sheet uses it for one
// thing: TextProvider.GetSkillSummary (:490-496) formats a raised
// skill's whole row as TextHighlight instead of Text, so the skills
// popup tells the player what the last rest bought them.
// CheckIfDoneLeveling (:433-455) clears the mask on any close that is
// NOT a level-up close, which is what "highlighted until viewed"
// means - a sheet opened to distribute level-up points leaves the
// marks standing for the next visit.
//
// TWO WORDS because DFU stores two, and the save field is spelled
// `skillsRecentlyRaised` (SerializableGameObject.cs:174,
// SerializablePlayer.cs:125,292) - the same name here so the
// save lane and this one meet on one field rather than two.
export const SKILLS_RECENTLY_RAISED_WORDS = 2;

/** Lazily minted, because an entity literal that predates this field
 *  (a loaded save, a test's hand-built player) must still raise a
 *  skill rather than throw. DFU's array is constructed with the
 *  entity; ours defaults on first touch to the same all-zero state. */
function raisedWords(entity) {
  if (!entity.skillsRecentlyRaised || entity.skillsRecentlyRaised.length < SKILLS_RECENTLY_RAISED_WORDS) {
    entity.skillsRecentlyRaised = new Array(SKILLS_RECENTLY_RAISED_WORDS).fill(0);
  }
  return entity.skillsRecentlyRaised;
}

/** PlayerEntity.GetSkillRecentlyIncreased (:218-221). */
export function getSkillRecentlyIncreased(entity, skillId) {
  const w = raisedWords(entity);
  return (w[Math.floor(skillId / 32)] & (1 << (skillId % 32))) !== 0;
}

/** PlayerEntity.SetSkillRecentlyIncreased (:223-226). The `>>> 0` is
 *  the C# uint: Axe is skill 31, and `1 << 31` is NEGATIVE in JS, so
 *  an unmasked store would leave the word as a negative int32 and any
 *  save writing it as unsigned would disagree with this one. */
export function setSkillRecentlyIncreased(entity, skillId) {
  const w = raisedWords(entity);
  const i = Math.floor(skillId / 32);
  w[i] = (w[i] | (1 << (skillId % 32))) >>> 0;
}

/** PlayerEntity.ResetSkillsRecentlyRaised (:228-231) - Array.Clear
 *  over both words. */
export function resetSkillsRecentlyRaised(entity) {
  raisedWords(entity).fill(0);
}

/** Verbatim AcrobatMotor.jumpSpeedMultiplier (:88-105): 1 +
 *  JumpingSkill * 0.5 / 100 (skill adds up to +50% force), plus
 *  athleticismMultiplier 0.1 when the career carries Athleticism.
 *
 *  AUDIT 18: the +10% used to be a hard 0 behind a placeholder flag
 *  blaming a decode that had ALREADY SHIPPED in U20b
 *  (specialAdvantages.js parses the bitfield) - and CLASS09 (Acrobat)
 *  carries abilityFlagsAndSpellPointsBitfield 0x1406, so a VANILLA
 *  Acrobat, not just a custom class, jumped 10% short. (ROAD-F GS2
 *  reworded this sentence off the flag grep's marker: it is a
 *  RETIREMENT RECORD, and tools/flagSites.mjs deliberately does not
 *  try to read tense, so a past-tense mention of the token kept
 *  listing a closed departure on bible/Home.md's open list.)
 *
 *  D9: improvedAthleticism (+0.1, AcrobatMotor.cs:15) now ships too.
 *  It is an ImprovesTalents ENCHANTMENT (ImprovesTalents.cs:75-88 ->
 *  _enchantMods.improvedAthleticism, E1's fold) and DFU adds it
 *  NESTED INSIDE the career check (:96-101)
 *
 *      if (Career.Athleticism) {
 *          jumpSpeedMultiplier += athleticismMultiplier;
 *          if (ImprovedAthleticism) += improvedAthleticismMultiplier;
 *      }
 *
 *  - exactly the shape shared.js:1156 already uses for the same pair
 *  on the fatigue rate, so the item alone does nothing and the two
 *  together make +20%. X1 landed the Jump SPELL's term (+0.6,
 *  AcrobatMotor's own jumpSpellMultiplier :16, added when
 *  IsEnhancedJumping :104-105 - which the port reads as the live
 *  'jumping' effect). P14. */
export const JUMP_SPELL_MULTIPLIER = 0.6;   // AcrobatMotor.cs:16
export const ATHLETICISM_MULTIPLIER = 0.1;            // AcrobatMotor.cs:14
export const IMPROVED_ATHLETICISM_MULTIPLIER = 0.1;   // AcrobatMotor.cs:15
export function jumpSpeedMultiplier(entity) {
  let m = 1 + (skillValue(entity, SKILLS.Jumping) * 0.5) / 100;
  if (entity?.activeEffects?.some((a) => a.kind === 'jumping')) m += JUMP_SPELL_MULTIPLIER;
  // DFCareer.HasSpecialAbility: the flag masked against the
  // bitfield's LOW BYTE, verbatim (the C# (byte)flags cast).
  const bits = entity.career?.abilityFlagsAndSpellPointsBitfield ?? 0;
  if ((bits & SPECIAL_ABILITY_BITS.athleticism) === SPECIAL_ABILITY_BITS.athleticism) {
    m += ATHLETICISM_MULTIPLIER;
    // The same fold entityImprovedAthleticism (enchantments.js:861)
    // answers, read in place: this leaf cannot import enchantments.js
    // without closing a cycle back through skills.js, which is why
    // the skillMods read above (:86) is spelled out the same way.
    if (entity._enchantMods?.improvedAthleticism) m += IMPROVED_ATHLETICISM_MULTIPLIER;
  }
  return m;
}
