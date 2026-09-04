// Spell casting costs (Systems S10). Verbatim from DFU
// FormulaHelper.CalculateTotalEffectCosts / CalculateEffectCosts /
// GetEffectComponentCosts (MIT, Daggerfall Workshop):
//   component gold = trunc(offsetGold + A*starting + B*trunc(inc/per))
//   magnitude uses the AVERAGED settings: base = (baseMin+baseMax)/2,
//     plus = (plusMin+plusMax)/2 (integer division)
//   per-effect spellpoints = gold * (110 - skill) / 400, where skill
//     is the caster's value in the effect's MAGIC SKILL
//   zero-component effects fudge MakeEffectCosts(60, 100, 160)
//   target multipliers on the SUMS: CasterOnly/ByTouch x1.0,
//     SingleTargetAtRange x1.5, AreaAroundCaster x2.0,
//     AreaAtRange x2.5 (float mul, int cast)
//   spellpoint floor 5 (castCostFloor)
// The table below is the WHOLE classic-key surface of DFU's effect
// library (Game/MagicAndEffects/Effects/**): every class's own
// ClassicKey -> its MagicSkill + its MakeEffectCosts(costA, costB,
// offsetGold=0) rows, plus which of Duration/Chance/Magnitude that
// class actually supports. Cost is charged ONLY for supported
// components (SupportDuration/SupportChance/SupportMagnitude), and
// the 60/100/160 fudge fires ONLY for a class with NO component at
// all (activeComponents == false: Teleport 43,255 and MorphSelf
// 29,255 in vanilla) - never as a stand-in for a missing row, and
// never against a defaulted magic skill. A classic key with NO
// effect class in DFU is not a cheap effect but NO effect: the
// broker's ClassicEffectRecordToEffectEntry returns false and the
// entry never enters the bundle (EntityEffectBroker.cs:924-931), so
// it contributes nothing to the cost. Every one of the 60 distinct
// keys the shipping SPELLS.STD uses has a class here.

import { skillValue, SKILLS } from './skills.js';

export const CAST_COST_FLOOR = 5;
const FUDGE = { A: 60, B: 100, offset: 160 };

const costs = (A, B, offset = 0) => ({ A, B, offset });
// One row per effect class: { skill, duration?, chance?, magnitude? }.
const row = (skill, parts) => Object.freeze({ skill, ...parts });
// The per-stat families (DFCareer.Stats order 0 Strength .. 7 Luck)
// are eight sibling classes sharing one set of factors, so they are
// expanded from one row rather than typed out eight times.
const family = (type, subTypes, r) =>
  Object.fromEntries(subTypes.map((s) => [`${type},${s}`, r]));
const STATS = [0, 1, 2, 3, 4, 5, 6, 7];

// classic 'type,subType' -> { skill, duration?, magnitude?, chance? }
export const EFFECT_COST_TABLE = Object.freeze({
  // ---- Alteration ----
  '0,255':  row(SKILLS.Alteration, { duration: costs(28, 100), chance: costs(28, 100) }),   // Paralyze - S19
  ...family(8, [0, 1, 2, 3, 4], row(SKILLS.Alteration, { duration: costs(100, 100), chance: costs(8, 100) })),   // ElementalResistance Fire/Frost/DiseaseOrPoison/Shock/Magic
  '25,255': row(SKILLS.Alteration, { duration: costs(20, 100) }),                           // Slowfall
  '27,255': row(SKILLS.Alteration, { duration: costs(20, 8) }),                             // Jumping
  '28,255': row(SKILLS.Alteration, { duration: costs(20, 20) }),                            // Climbing
  '30,255': row(SKILLS.Alteration, { duration: costs(20, 8) }),                             // WaterBreathing - P12
  '35,255': row(SKILLS.Alteration, { duration: costs(28, 8), magnitude: costs(80, 60) }),   // Shield

  // ---- Destruction ----
  '1,0':    row(SKILLS.Destruction, { duration: costs(28, 8), magnitude: costs(40, 28) }),  // ContinuousDamageHealth
  '1,1':    row(SKILLS.Destruction, { duration: costs(20, 8), magnitude: costs(40, 28) }),  // ContinuousDamageFatigue
  '1,2':    row(SKILLS.Destruction, { duration: costs(40, 8), magnitude: costs(40, 28) }),  // ContinuousDamageSpellPoints
  '4,0':    row(SKILLS.Destruction, { magnitude: costs(20, 28) }),                          // DamageHealth
  '4,1':    row(SKILLS.Destruction, { magnitude: costs(20, 28) }),                          // DamageFatigue
  '4,2':    row(SKILLS.Destruction, { magnitude: costs(20, 28) }),                          // DamageSpellPoints
  '5,255':  row(SKILLS.Destruction, { chance: costs(80, 140) }),                            // Disintegrate
  ...family(7, STATS, row(SKILLS.Destruction, { magnitude: costs(8, 100, 116) })),           // Drain{Attribute}
  ...family(11, [...STATS, 8, 9], row(SKILLS.Destruction, { magnitude: costs(60, 100, 40) })),   // Transfer{Attribute} + TransferHealth (11,8) / TransferFatigue (11,9)

  // ---- Illusion ----
  '13,0':   row(SKILLS.Illusion, { duration: costs(40, 120) }),                             // InvisibilityNormal - S21
  '13,1':   row(SKILLS.Illusion, { duration: costs(60, 140) }),                             // InvisibilityTrue - S21
  '15,255': row(SKILLS.Illusion, { duration: costs(8, 40) }),                               // LightNormal
  '23,0':   row(SKILLS.Illusion, { duration: costs(20, 80) }),                              // ChameleonNormal
  '23,1':   row(SKILLS.Illusion, { duration: costs(40, 120) }),                             // ChameleonTrue - S21
  '24,0':   row(SKILLS.Illusion, { duration: costs(20, 80) }),                              // ShadowNormal - S21
  '24,1':   row(SKILLS.Illusion, { duration: costs(40, 120) }),                             // ShadowTrue - S21
  '29,255': row(SKILLS.Illusion, {}),                                                       // MorphSelf - NO components (the fudge, at Illusion)

  // ---- Mysticism ----
  '2,255':  row(SKILLS.Mysticism, { duration: costs(60, 120) }),                            // CreateItem
  '6,0':    row(SKILLS.Mysticism, { chance: costs(120, 180) }),                             // DispelMagic
  '6,1':    row(SKILLS.Mysticism, { chance: costs(80, 140) }),                              // DispelUndead
  '6,2':    row(SKILLS.Mysticism, { chance: costs(120, 180) }),                             // DispelDaedra
  '12,255': row(SKILLS.Mysticism, { duration: costs(60, 68), chance: costs(40, 68) }),      // SoulTrap
  '16,255': row(SKILLS.Mysticism, { chance: costs(28, 120, 120) }),                         // Lock
  '17,255': row(SKILLS.Mysticism, { chance: costs(20, 100) }),                              // Open
  '19,255': row(SKILLS.Mysticism, { duration: costs(20, 100), chance: costs(20, 100) }),    // Silence
  '43,255': row(SKILLS.Mysticism, {}),                                                      // Teleport - NO components (the fudge, at Mysticism)
  '44,255': row(SKILLS.Mysticism, { duration: costs(60, 68), chance: costs(40, 68) }),      // ComprehendLanguages

  // ---- Restoration ----
  '3,0':    row(SKILLS.Restoration, { chance: costs(8, 100) }),                             // CureDisease - S19c
  '3,1':    row(SKILLS.Restoration, { chance: costs(8, 100) }),                             // CurePoison - S19c
  '3,2':    row(SKILLS.Restoration, { chance: costs(20, 140) }),                            // CureParalyzation - S19c
  ...family(9, STATS, row(SKILLS.Restoration, { duration: costs(28, 100), magnitude: costs(40, 120) })),   // Fortify{Attribute}
  ...family(10, STATS, row(SKILLS.Restoration, { magnitude: costs(40, 28) })),               // Heal{Attribute}
  '10,8':   row(SKILLS.Restoration, { magnitude: costs(20, 28) }),                          // HealHealth
  '10,9':   row(SKILLS.Restoration, { magnitude: costs(8, 28) }),                           // HealFatigue
  '18,255': row(SKILLS.Restoration, { duration: costs(100, 20), magnitude: costs(8, 8) }),  // Regenerate
  '20,255': row(SKILLS.Restoration, { duration: costs(28, 140), chance: costs(28, 140) }),  // SpellAbsorption
  '26,255': row(SKILLS.Restoration, { duration: costs(20, 8) }),                            // FreeAction - S22

  // ---- Thaumaturgy ----
  '14,255': row(SKILLS.Thaumaturgy, { duration: costs(60, 100) }),                          // Levitate - P11
  '21,255': row(SKILLS.Thaumaturgy, { duration: costs(28, 140), chance: costs(28, 140) }),  // SpellReflection
  '22,255': row(SKILLS.Thaumaturgy, { duration: costs(20, 100), chance: costs(20, 100) }),  // SpellResistance
  '31,255': row(SKILLS.Thaumaturgy, { duration: costs(20, 8) }),                            // WaterWalking
  '33,0':   row(SKILLS.Thaumaturgy, { chance: costs(60, 100, 160) }),                       // Pacify-Animals
  '33,1':   row(SKILLS.Thaumaturgy, { chance: costs(80, 140, 60) }),                        // Pacify-Undead
  '33,2':   row(SKILLS.Thaumaturgy, { chance: costs(80, 140, 60) }),                        // Pacify-Humanoid
  '33,3':   row(SKILLS.Thaumaturgy, { chance: costs(60, 120, 36) }),                        // Pacify-Daedra
  '34,255': row(SKILLS.Thaumaturgy, { chance: costs(40, 60) }),     // Charm - AUDIT 23 (magic-6): CharmEffect.cs:36/:42 comment DURATION out; chance alone is priced
  '39,0':   row(SKILLS.Thaumaturgy, { duration: costs(20, 8, 200) }),                       // DetectMagic
  '39,1':   row(SKILLS.Thaumaturgy, { duration: costs(20, 8, 200) }),                       // DetectEnemy
  '39,2':   row(SKILLS.Thaumaturgy, { duration: costs(20, 8, 160) }),                       // DetectTreasure
  '40,255': row(SKILLS.Thaumaturgy, { chance: costs(40, 100, 28) }),                        // Identify
});

export const TARGET_COST_MULT = Object.freeze({ 0: 1.0, 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 });

const component = (c, starting, increase, per) =>
  Math.trunc(c.offset + c.A * starting + c.B * Math.trunc(increase / Math.max(1, per)));

/** One effect's { gold, sp } at the caster's skill. */
/** S24: the effect's MAGIC SCHOOL, off the same table entry the cost
 *  reads. Absorption gates on Destruction and needs the partition the
 *  cost table already single-sources; the default matches effectCost's
 *  own (an unknown family is priced as Destruction). */
export function effectSchool(e) {
  return EFFECT_COST_TABLE[`${e.type},${e.subType & 0xff}`]?.skill ?? 22;
}

export function effectCost(e, casterSkillOf) {
  // subType normalized to BYTE (DFU MakeClassicKey casts the sbyte;
  // real records read 0xFF as -1 - parity fix 2026-08-16d)
  const entry = EFFECT_COST_TABLE[`${e.type},${e.subType & 0xff}`];
  // No effect class for this classic key: DFU drops the entry from
  // the bundle entirely, so it costs nothing.
  if (!entry) return { gold: 0, sp: 0 };
  const skill = casterSkillOf(entry.skill);
  let gold = 0;
  let activeComponents = false;
  if (entry.duration) {
    activeComponents = true;
    gold += component(entry.duration, e.durationBase, e.durationMod, e.durationPerLevel);
  }
  if (entry.chance) {
    activeComponents = true;
    gold += component(entry.chance, e.chanceBase, e.chanceMod, e.chancePerLevel);
  }
  if (entry.magnitude) {
    activeComponents = true;
    const base = Math.trunc((e.magnitudeBaseLow + e.magnitudeBaseHigh) / 2);
    const plus = Math.trunc((e.magnitudeLevelBase + e.magnitudeLevelHigh) / 2);
    gold += component(entry.magnitude, base, plus, e.magnitudePerLevel);
  }
  // "If there are no active components (e.g. Teleport) then fudge some costs"
  if (!activeComponents) gold += component(FUDGE, 1, 1, 1);
  return { gold, sp: Math.trunc(gold * (110 - skill) / 400) };
}

/** The full casting cost of a classic spell record for a caster:
 *  per-effect sums, target multiplier, the floor. */
export function calculateCastCost(spell, casterEntity) {
  const skillOf = (id) => skillValue(casterEntity, id);
  let gold = 0, sp = 0;
  for (const e of spell.effects) {
    if (e.type <= -1) continue;
    const c = effectCost(e, skillOf);
    gold += c.gold;
    sp += c.sp;
  }
  const m = TARGET_COST_MULT[spell.rangeType] ?? 1.0;
  gold = Math.trunc(gold * m);
  sp = Math.trunc(sp * m);
  // FormulaHelper.cs:2233-2236 "Set vampire spell cost" - the granted
  // records' MinimumCastingCost ASSIGNS the floor, it does not merely
  // floor: a clan spell (or the lycanthrope's morph) costs exactly 5
  // however expensive its effects price out. AUDIT 39: read as
  // equivalent to the floor below, which only ever raises a cheap
  // spell - Haarvenu's Ice Storm and the Lycanthropy morph were billed
  // full skill-scaled cost.
  if (spell.minimumCastingCost) sp = CAST_COST_FLOOR;
  if (sp < CAST_COST_FLOOR) sp = CAST_COST_FLOOR;
  return { gold, sp };
}

// ── E2: the CLASSIC-REVERSED casting cost ──────────────────────────
// FormulaHelper.CalculateCastingCost(SpellRecordData, enchantingItem)
// (:2411-2477) + getCostFromSettings (:2482-2541) - DFU's SECOND cost
// formula, "reversed from classic", distinct from the effect-class one
// above: it prices a RAW CLASSIC RECORD from its settings bytes, and
// in DFU it backs classic-record costs, enchantment point costs and
// magic item worth. The port's first consumer is CastWhenHeld's equip
// durability hit (InstantiateSpellBundle bills LowerCondition
// (CalculateCastingCost(spell, false)) - the wearer pays the spell's
// own casting cost in item condition, :~175).
//
// The tables are verbatim, hex for hex. effectIndices maps
// 12*type+subType (subType -1 reads slot 0) into COEFFICIENTS' rows of
// four; SETTINGS_TYPES picks which of the seven duration/chance/
// magnitude folds spends them.

const CLASSIC_INDEX_ROWS = [
  [0x00],                                    // Paralysis
  [0x01, 0x02, 0x03],                        // Continuous Damage
  [0x04],                                    // Create Item
  [0x05, 0x05, 0x06],                        // Cure
  [0x07, 0x07, 0x07],                        // Damage
  [0x08],                                    // Disintegrate
  [0x09, 0x08, 0x09],                        // Dispel
  [0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A],   // Drain
  [0x0B, 0x0B, 0x0B, 0x0B, 0x0B],            // Elemental Resistance
  [0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C],   // Fortify Attribute
  [0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x0D, 0x07, 0x0E],   // Heal
  [0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F, 0x0F],   // Transfer
  [0x26],                                    // Soul Trap
  [0x10, 0x11],                              // Invisibility
  [0x12],                                    // Levitate
  [0x13],                                    // Light
  [0x14],                                    // Lock
  [0x28],                                    // Open
  [0x15],                                    // Regenerate
  [0x16],                                    // Silence
  [0x17],                                    // Spell Absorption
  [0x17],                                    // Spell Reflection
  [0x16],                                    // Spell Resistance
  [0x18, 0x10],                              // Chameleon
  [0x18, 0x10],                              // Shadow
  [0x14],                                    // Slowfall
  [0x02],                                    // Climbing
  [0x02],                                    // Jumping
  [0x19],                                    // Free Action
  [0x1A, 0x1A, 0x1A, 0x1A, 0x1A, 0x1A, 0x1A],   // Lycanthropy/Polymorph
  [0x02],                                    // Water Breathing
  [0x02],                                    // Water Walking
  [0x1B],                                    // Dimunition
  [0x1A, 0x1C, 0x1C, 0x1D],                  // Calm
  [0x1E],                                    // Charm
  [0x1F],                                    // Shield
  [0x27],                                    // Telekinesis
  [0x20],                                    // Astral Travel
  [0x20],                                    // Etherealness
  [0x21, 0x21, 0x22],                        // Detect
  [0x23],                                    // Identify
  [0x24],                                    // Wizard Sight
  [0x07],                                    // Darkness
  [0x25],                                    // Recall
  [0x29],                                    // Comprehend Languages
  [0x2A],                                    // Intensify Fire
  [0x2A],                                    // Diminish Fire
  [0x2A],                                    // Wall of Stone?
  [0x2A],                                    // Wall of Fire?
  [0x2A],                                    // Wall of Frost?
  [0x2A],                                    // Wall of Poison?
];
const CLASSIC_EFFECT_INDICES = CLASSIC_INDEX_ROWS.map((r) => Object.assign(new Array(12).fill(0), r));

const CLASSIC_COEFFICIENTS = [
  [0x07, 0x19, 0x07, 0x19],   // 0x00 Paralysis / Cure Magic?
  [0x07, 0x02, 0x0A, 0x07],   // 0x01 Continuous Damage - Health
  [0x05, 0x02, 0x0A, 0x07],   // 0x02 CD-Stamina / Climbing / Jumping / Water Breathing / Water Walking
  [0x0A, 0x02, 0x0A, 0x07],   // 0x03 CD-Spell Points
  [0x0F, 0x1E, 0x00, 0x00],   // 0x04 Create Item
  [0x02, 0x19, 0x00, 0x00],   // 0x05 Cure Disease / Cure Poison
  [0x05, 0x23, 0x00, 0x00],   // 0x06 Cure Paralysis
  [0x05, 0x07, 0x00, 0x00],   // 0x07 Damage H/S/SP / Heal Health / Darkness
  [0x14, 0x23, 0x00, 0x00],   // 0x08 Disintegrate / Dispel Undead
  [0x1E, 0x2D, 0x00, 0x00],   // 0x09 Dispel Magic / Dispel Daedra
  [0x04, 0x19, 0x02, 0x19],   // 0x0A Drain Attribute
  [0x19, 0x19, 0x02, 0x19],   // 0x0B Elemental Resistance
  [0x07, 0x19, 0x0A, 0x1E],   // 0x0C Fortify Attribute
  [0x0A, 0x07, 0x00, 0x00],   // 0x0D Heal Attribute
  [0x02, 0x07, 0x00, 0x00],   // 0x0E Heal Stamina
  [0x05, 0x05, 0x0F, 0x19],   // 0x0F Transfer
  [0x0A, 0x1E, 0x00, 0x00],   // 0x10 Invisibility
  [0x0F, 0x23, 0x00, 0x00],   // 0x11 True Invisibility
  [0x0F, 0x19, 0x00, 0x00],   // 0x12 Levitate
  [0x02, 0x0A, 0x00, 0x00],   // 0x13 Light
  [0x05, 0x19, 0x07, 0x1E],   // 0x14 Lock / Slowfall
  [0x19, 0x05, 0x02, 0x02],   // 0x15 Regenerate
  [0x05, 0x19, 0x05, 0x19],   // 0x16 Silence / Spell Resistance
  [0x07, 0x23, 0x07, 0x23],   // 0x17 Spell Absorption / Spell Reflection
  [0x05, 0x14, 0x00, 0x00],   // 0x18 Chameleon / Shadow
  [0x05, 0x05, 0x00, 0x00],   // 0x19 Free Action
  [0x0F, 0x19, 0x0F, 0x19],   // 0x1A Lycanthropy / Polymorph / Calm Animal
  [0x0A, 0x14, 0x14, 0x28],   // 0x1B Diminution
  [0x0A, 0x05, 0x14, 0x23],   // 0x1C Calm Undead / Calm Humanoid
  [0x07, 0x02, 0x0F, 0x1E],   // 0x1D Calm Daedra? (unused)
  [0x05, 0x02, 0x0A, 0x0F],   // 0x1E Charm
  [0x07, 0x02, 0x14, 0x0F],   // 0x1F Shield
  [0x23, 0x02, 0x0A, 0x19],   // 0x20 Astral Travel / Etherealness
  [0x05, 0x02, 0x14, 0x1E],   // 0x21 Detect Magic / Detect Enemy
  [0x05, 0x02, 0x0F, 0x19],   // 0x22 Detect Treasure
  [0x05, 0x02, 0x0A, 0x19],   // 0x23 Identify
  [0x07, 0x0C, 0x05, 0x05],   // 0x24 Wizard Sight
  [0x23, 0x2D, 0x00, 0x00],   // 0x25 Recall
  [0x0F, 0x11, 0x0A, 0x11],   // 0x26 Soul Trap
  [0x14, 0x11, 0x19, 0x23],   // 0x27 Telekinesis
  [0x05, 0x19, 0x00, 0x00],   // 0x28 Open
  [0x0F, 0x11, 0x0A, 0x11],   // 0x29 Comprehend Languages
  [0x0F, 0x0F, 0x05, 0x05],   // 0x2A Intensify/Diminish Fire / the four Walls
];

// effectMagicSchools + magicSkills (:2500-2513): school index per
// classic TYPE, then the school's skill.
const CLASSIC_MAGIC_SCHOOLS = [
  0, 2, 3, 1, 2, 2, 3, 2, 0, 1,
  1, 2, 3, 5, 4, 5, 3, 3, 1, 3,
  1, 4, 4, 5, 5, 0, 1, 0, 0, 5,
  0, 4, 0, 4, 4, 0, 3, 3, 0, 4,
  4, 4, 5, 3, 3, 0, 0, 4, 4, 4,
  4];
const CLASSIC_MAGIC_SKILLS = [SKILLS.Alteration, SKILLS.Restoration, SKILLS.Destruction, SKILLS.Mysticism, SKILLS.Thaumaturgy, SKILLS.Illusion];

// settingsTypes (:2515-2524): which of the seven folds each TYPE uses.
const CLASSIC_SETTINGS_TYPES = [
  1, 2, 3, 4, 5, 4, 4, 2, 1, 6,
  5, 6, 1, 3, 3, 3, 1, 4, 2, 1,
  1, 1, 1, 3, 3, 3, 3, 3, 3, 1,
  3, 3, 1, 1, 1, 2, 2, 1, 1, 1,
  1, 1, 3, 4, 1, 2, 2, 2, 2, 2,
  2];
const CLASSIC_RANGE_MODIFIERS = [2, 2, 3, 4, 5];

/** C# int division truncates; every field here is a u8, so floor and
 *  trunc agree. The `|| 1` divisor guard is the port's: DFU would
 *  throw DivideByZeroException on a zero per-level byte (settings type
 *  1 reads the CHANCE fields of duration-only records, where classic
 *  data really does write 0) - effects.js's duration fold guards the
 *  same way at its :270. */
const cdiv = (a, b) => Math.trunc(a / (b || 1));

/** getCostFromSettings (:2482-2541), verbatim per settings type. */
function classicCostFromSettings(settingsType, e, c) {
  const magBase = Math.trunc((e.magnitudeBaseLow + e.magnitudeBaseHigh) / 2);
  const magPlus = Math.trunc((e.magnitudeLevelBase + e.magnitudeLevelHigh) / 2);
  switch (settingsType) {
    case 1: return c[0] * e.durationBase + cdiv(e.durationMod, e.durationPerLevel) * c[1]
      + c[2] * e.chanceBase + cdiv(e.chanceMod, e.chancePerLevel) * c[3];
    case 2: return c[0] * e.durationBase + cdiv(e.durationMod, e.durationPerLevel) * c[1]
      + magBase * c[2] + cdiv(magPlus, e.magnitudePerLevel) * c[3];
    case 3: return c[0] * e.durationBase + cdiv(e.durationMod, e.durationPerLevel) * c[1];
    case 4: return c[0] * e.chanceBase + cdiv(e.chanceMod, e.chancePerLevel) * c[1];
    case 5: return c[0] * magBase + cdiv(magPlus, e.magnitudePerLevel) * c[1];
    case 6: return c[0] * e.durationBase + cdiv(c[1] * e.durationMod, e.durationPerLevel)
      + magBase * c[2] + cdiv(c[3], e.magnitudePerLevel) * magPlus;
    case 7: return magBase * c[0]   // "supported in classic but no effect uses it"
      + cdiv(cdiv(cdiv(c[1] * (e.magnitudeLevelBase + e.magnitudeLevelHigh), 2), e.magnitudePerLevel) * e.durationBase, e.durationMod);
    default: return 0;
  }
}

/**
 * CalculateCastingCost (:2411-2477). skillOf(skillId) -> the caster's
 * LIVE skill in the effect's school; omit it for the ITEM-ENCHANTMENT
 * arm (enchantingItem=true), where the skill is pinned at 50 (:2440
 * "50 is used for item enchantments"). DFU's non-enchanting arm reads
 * GameManager.PlayerEntity - the caller binds whose skills apply.
 * Only the record's FIRST THREE effects price (the classic layout has
 * no more); `cost * rangeModifier >> 1` and the floor of 5 close it.
 */
export function classicCastingCost(spell, skillOf = null) {
  let cost = 0;
  for (let i = 0; i < 3; i++) {
    const e = spell.effects?.[i];
    if (!e || e.type === -1 || e.type == null) continue;
    const sub = e.subType === -1 || e.subType == null ? 0 : e.subType;
    const coef = CLASSIC_COEFFICIENTS[CLASSIC_EFFECT_INDICES[e.type]?.[sub] ?? 0] ?? CLASSIC_COEFFICIENTS[0];
    const skill = skillOf ? skillOf(CLASSIC_MAGIC_SKILLS[CLASSIC_MAGIC_SCHOOLS[e.type] ?? 0]) : 50;
    cost += Math.trunc(classicCostFromSettings(CLASSIC_SETTINGS_TYPES[e.type] ?? 0, e, coef) * (110 - skill) / 100);
  }
  cost = (cost * (CLASSIC_RANGE_MODIFIERS[spell.rangeType] ?? 2)) >> 1;
  return cost < 5 ? 5 : cost;
}
