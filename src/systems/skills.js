// The skills MODEL (extracted from chargen in the 2026-07-06d audit
// - entity-layer concepts, not creation logic; formulas, advancement,
// chargen, and the scenes all consume it from here).

// AUDIT 18: the career SPECIAL-ABILITY bits, from the one home that
// already decodes them (specialAdvantages.js is a leaf - it imports
// nothing - so this cannot cycle; rest.js's copy imports skills.js
// and would).
import { SPECIAL_ABILITY_BITS } from './specialAdvantages.js';
// SOFTCAP1: two more leaves (neither imports anything) - the softcap's law
// and mentor mode's overlay.
import { effectiveSkill, overcapTallyWeight, movementTallyWeight, SKILL_SOFT_CAP, SKILL_HARD_CAP } from './skillSoftcap.js';   // MOVE-REAL: the movement skills' own weight
import { mentoredSkill } from './mentorMode.js';
import { masterCappedSkill, skillCanPassCap } from './masterSkills.js';   // SOFTCAP3: Master Skills - past 100 only when on (and online)
export { SKILL_SOFT_CAP, SKILL_HARD_CAP, effectiveSkill } from './skillSoftcap.js';

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
  mod += entity._mods?.skills?.[skillId] ?? 0;   // RF1: the port's modifier channels (systems/entityMods.js), a field read - this leaf stays import-free
  // SOFTCAP1: what a FORMULA reads - the mentored permanent value (mentor
  // mode's overlay, a no-op outside it), past 100 at a quarter a point plus
  // the milestones (skillSoftcap.js effectiveSkill). Below 100 both are the
  // identity, so every DFU number there is unchanged.
  // SOFTCAP3: and Master Skills off (or offline) reads a player's skill above 100 as 100 - kept, not lost
  return effectiveSkill(mentoredSkill(entity, masterCappedSkill(entity, permanentSkillValue(entity, skillId), skillId))) + mod;   // SOFTCAP4: only a MASTERED skill reads past 100
}

/** SOFTCAP1: the effect mods skillValue adds, alone (the display reads) - enchantments, Fortify, the vampire's and
 *  the werewolf's +30. They sit ON TOP of the softcap: a trained 200 reads 140 in a formula, a cursed one 170. */
export function skillModOf(entity, skillId) {
  let mod = entity._enchantMods?.skillMods?.[skillId] ?? 0;
  const list = entity.activeEffects;
  if (list) for (const a of list) if (a.kind === 'racialOverride' && !a.ended) mod += a.skillMods?.[skillId] ?? 0;
  return mod + (entity._mods?.skills?.[skillId] ?? 0);
}

/** SOFTCAP1: what a SCREEN prints - the value on the 0..200 scale the
 *  player climbs (mentored while mentoring), plus the live mods, WITHOUT
 *  the softcap's quarter weighting. Every skill UI reads this, so a 150
 *  reads 150 and never the 112 a formula sees. */
export function displaySkillValue(entity, skillId) {
  const o = entity.skillOverrides;
  if (o && o[skillId] != null) return o[skillId];
  return mentoredSkill(entity, masterCappedSkill(entity, permanentSkillValue(entity, skillId), skillId)) + skillModOf(entity, skillId);
}

/** SOFTCAP1: the REAL value (no mentor cap), plus mods - the number in
 *  brackets beside a mentored one. */
export function realSkillValue(entity, skillId) {
  const o = entity.skillOverrides;
  if (o && o[skillId] != null) return o[skillId];
  return permanentSkillValue(entity, skillId) + skillModOf(entity, skillId);
}

/** SOFTCAP1: "85 (150)" while mentoring lowers it, "150" otherwise. */
export function skillValueText(entity, skillId) {
  const shown = displaySkillValue(entity, skillId);
  const real = realSkillValue(entity, skillId);
  return real !== shown ? `${shown} (${real})` : String(shown);
}

/** TallySkill (the E3c flag clears): count a use toward advancement.
 *  The 20000 clamp is VERBATIM (PlayerEntity.TallySkill) - and it is
 *  what keeps the source's (uses * reflexesMod) >> 16 inside int32:
 *  20000 * 0x14000 fits; an unclamped tally would overflow the shift
 *  in C# and JS alike (caught by S3b's own test). */
export function tallySkill(entity, skillId, amount = 1, movement = false) {
  if (!entity.skillUses) return;
  // SOFTCAP1: a skill at 100+ counts only REAL use (skillSoftcap.js
  // overcapTallyWeight - a foe tough for the skill, no spam). The weight
  // is fractional, so the remainder rides entity.skillUseFrac and only
  // whole uses reach the int32 counter below. The REAL permanent value is
  // read, never the mentored one: mentor mode cannot make a weak foe count.
  const real = Array.isArray(entity.skills) ? (entity.skills[skillId] ?? 0) : 0;
  // SOFTCAP3: only while Master Skills is in force - off, the use is tallied as Daggerfall always did (a skill at
  // 100 simply never spends it)
  if (real >= SKILL_SOFT_CAP && skillCanPassCap(entity, skillId)) {   // SOFTCAP4: and only for a MASTERED skill
    if (real >= SKILL_HARD_CAP) return;
    const w = movement ? movementTallyWeight(entity, skillId, amount, real) : overcapTallyWeight(entity, skillId, amount, real);   // MOVE-REAL
    if (!(w > 0)) return;
    const frac = (entity.skillUseFrac ??= new Array(SKILL_COUNT).fill(0));
    const total = (frac[skillId] ?? 0) + w;
    const whole = Math.floor(total);
    frac[skillId] = total - whole;
    if (!whole) return;
    // MOVE-BANK (FIELD BUGS 2026-10-01 #7): past 100 the count is PROGRESS's - advancement.js raiseSkills spends it in
    // float, so DFU's 20000 clamp below (which keeps its int32 shift in range) has nothing to guard here. It threw away
    // everything a mastered runner ran past 83 minutes between two rests (four uses a second), and at level 30 a full
    // bucket was 0.68 of the first point however long the run.
    entity.skillUses[skillId] += whole;
    return;
  }
  entity.skillUses[skillId] += amount;
  if (entity.skillUses[skillId] > 20000) entity.skillUses[skillId] = 20000;
}

/** MOVE-REAL: a movement skill's use FROM MOTION - the run's quarter second, the jump, the swim's minute, the climb's
 *  check. Below 100 it is TallySkill verbatim; past 100 it counts the ground the body covered (skillSoftcap.js
 *  movementTallyWeight), never a spam counter. Training and quests tally these skills through tallySkill. */
export function tallyMovementSkill(entity, skillId, amount = 1) {
  tallySkill(entity, skillId, amount, true);
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

/** PlayerEntity.SetCurrentLevelUpSkillSum's sum: sum(primary) +
 *  sum(major) - lowest major + highest minor. Its one home (AUDIT 68
 *  S24-levelup-sum-duplicate): chargen's anchor took an inline copy
 *  because chargen.js cannot import advancement.js, which re-exports
 *  it from this leaf both read. */
export function levelUpSkillSum(entity) {
  const c = entity.career;
  // SOFTCAP1: each skill enters the sum at its EFFECTIVE value - verbatim to
  // 100, a quarter a point past it - so the long grind above 100 still
  // moves the level, slowly, instead of turning every eight-times-dearer
  // point into a full point of level progress.
  const v = (id) => effectiveSkill(masterCappedSkill(entity, entity.skills[id], id));   // SOFTCAP3: capped at 100 while Master Skills is off
  let sum = 0;
  for (const id of c.primarySkills) sum += v(id);
  let lowestMajor = Infinity;
  for (const id of c.majorSkills) { const x = v(id); sum += x; if (x < lowestMajor) lowestMajor = x; }
  sum -= lowestMajor;
  let highestMinor = -Infinity;
  for (const id of c.minorSkills) { const x = v(id); if (x > highestMinor) highestMinor = x; }
  return sum + highestMinor;
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
 *  - exactly the shape shared.js:1553 already uses for the same pair
 *  on the fatigue rate, so the item alone does nothing and the two
 *  together make +20%. X1 landed the Jump SPELL's term (+0.6,
 *  AcrobatMotor's own jumpSpellMultiplier :16, added when
 *  IsEnhancedJumping :104-105 - which the port reads as the live
 *  'jumping' effect). P14. */
export const JUMP_SPELL_MULTIPLIER = 0.6;   // AcrobatMotor.cs:16
export const ATHLETICISM_MULTIPLIER = 0.1;            // AcrobatMotor.cs:14
export const IMPROVED_ATHLETICISM_MULTIPLIER = 0.1;   // AcrobatMotor.cs:15
/** DaggerfallEntity.IsEnhancedJumping (:85) - raised by the Jumping
 *  effect's Start and cleared by its End (Jumping.cs:84/:94). TWO
 *  AcrobatMotor members read it: the +0.6 liftoff term below (:104-105)
 *  and CheckAirControl's mid-air steering disjunct (:145, AUDIT 64 F2),
 *  so the one activeEffects read lives here beside the formula rather
 *  than being restated at each motor construction site. */
export const isEnhancedJumping = (entity) =>
  !!entity?.activeEffects?.some((a) => a.kind === 'jumping');
export function jumpSpeedMultiplier(entity) {
  let m = 1 + (skillValue(entity, SKILLS.Jumping) * 0.5) / 100;
  if (isEnhancedJumping(entity)) m += JUMP_SPELL_MULTIPLIER;
  // DFCareer.HasSpecialAbility: the flag masked against the
  // bitfield's LOW BYTE, verbatim (the C# (byte)flags cast).
  const bits = entity.career?.abilityFlagsAndSpellPointsBitfield ?? 0;
  if ((bits & SPECIAL_ABILITY_BITS.athleticism) === SPECIAL_ABILITY_BITS.athleticism) {
    m += ATHLETICISM_MULTIPLIER;
    // The same fold entityImprovedAthleticism (enchantments.js:963)
    // answers, read in place: this leaf cannot import enchantments.js
    // without closing a cycle back through skills.js, which is why
    // the skillMods read above (:86) is spelled out the same way.
    if (entity._enchantMods?.improvedAthleticism) m += IMPROVED_ATHLETICISM_MULTIPLIER;
  }
  return m;
}
