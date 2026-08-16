// Diseases (Systems S18). Verbatim from DFU DiseaseEffect.cs +
// FormulaHelper.cs OnMonsterHit/InflictDisease/FatigueDamage (MIT,
// Daggerfall Workshop).
//
// Shape: a disease is a PERMANENT activeEffects entry ({ kind:
// 'disease' }) that manages its own lifecycle (DiseaseEffect presents
// forcedRoundsRemaining = 1 until EndDisease zeroes it - our
// entry.ended flag). Diseases operate on a DAILY tick layered over
// the per-minute magic round: UpdateDisease runs every round but
// no-ops until the classic day advances (the infection day itself is
// incubation). Each elapsed day rolls Range(minDamage, maxDamage+1)
// ONCE per day and applies the DiseaseData row as a multiplier matrix:
// stat columns accumulate a negative statMod (consumed by liveStat,
// healable by Heal{Attribute} - base HealAttributeDamage clamps at 0
// and does NOT end the disease), HEA/FAT/SPL columns decrease
// health/fatigue/magicka. NOTE the FAT column decreases RAW fatigue
// units - DFU calls DecreaseFatigue WITHOUT assignMultiplier, so a
// disease day costs points, not x64 (bug-for-bug).
// daysOfSymptomsMin 0xff = permanent (falls until cured);
// daysOfSymptomsLeft 0xfe = completed. A finite disease that runs its
// course ends and its statMods lift with the entry (DFU: the expired
// effect's mods vanish from the manager's totals).
//
// Player-only: DiseaseEffect.Start ends the disease unless the host
// is the player at level >= 2, and InflictDisease additionally gates
// on level != 1 ("keep new players from dying at the start") plus a
// FULL saving-throw save (== 0) resisting outright. The player
// cannot catch the same disease twice (AddState is a no-op).
//
// OnMonsterHit is the monster special-attack rider table, called
// per-hit from CalculateAttackDamage's weaponless multi-attack loop
// (FormulaHelper.cs:662) BEFORE the hit damage lands. Spider/
// GiantScorpion queue classic spell 66 (Paralyze) - FLAGGED pending
// the Paralyze effect (S19); Werewolf/Wereboar (lycanthropy) and the
// Vampire specialInfectionChance branch (vampirism) are ROUTED to the
// vampirism/lycanthropy line - their rolls are consumed verbatim so
// sequences match.

import { savingThrow, EFFECT_FLAGS } from './spellcast.js';
import { FATIGUE_MULTIPLIER } from './statMods.js';
import { dice100 } from '../combat/formulas.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';

// ---- MagicAndEffectsEnums.Diseases, verbatim ----
export const DISEASES = Object.freeze({
  None: -1,
  WitchesPox: 0, Plague: 1, YellowFever: 2, StomachRot: 3,
  Consumption: 4, BrainFever: 5, SwampRot: 6, CalironsCurse: 7,
  Cholera: 8, Leprosy: 9, WoundRot: 10, RedDeath: 11, BloodRot: 12,
  TyphoidFever: 13, Dementia: 14, Chrondiasis: 15, WizardFever: 16,
});

export const PERMANENT_DISEASE_VALUE = 0xff;
export const COMPLETED_DISEASE_VALUE = 0xfe;

// ---- DiseaseEffect.GetClassicDiseaseData, verbatim (indexed by
// Diseases id). Columns: 8 stat multipliers, HEA/FAT/SPL multipliers,
// the daily damage roll span, days-of-symptoms span (0xFF = never
// ending). Byte-exact from DiseaseEffect.cs:218-236. ----
const D = (STR, INT, WIL, AGI, END, PER, SPD, LUC, HEA, FAT, SPL, minDamage, maxDamage, daysOfSymptomsMin, daysOfSymptomsMax) =>
  Object.freeze({ STR, INT, WIL, AGI, END, PER, SPD, LUC, HEA, FAT, SPL, minDamage, maxDamage, daysOfSymptomsMin, daysOfSymptomsMax });
export const DISEASE_DATA = Object.freeze([
  //STR INT WIL AGI END PER SPD LUC HEA FAT SPL MIN MAX  DAYS
  D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 10, 0xFF, 0xFF),   // Witches' Pox
  D(1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 30, 0xFF, 0xFF),   // Plague
  D(0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 5, 10, 0xFF, 0xFF),   // Yellow Fever
  D(0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 5, 0xFF, 0xFF),    // Stomach Rot
  D(1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 2, 10, 0xFF, 0xFF),   // Consumption
  D(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 5, 0xFF, 0xFF),    // Brain Fever
  D(1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 2, 10, 0xFF, 0xFF),   // Swamp Rot
  D(1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 5, 10, 3, 18),        // Caliron's Curse
  D(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 30, 0xFF, 0xFF),   // Cholera
  D(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 5, 30, 0xFF, 0xFF),   // Leprosy
  D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 4, 0xFF, 0xFF),    // Wound Rot
  D(0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 2, 10, 0xFF, 0xFF),   // Red Death
  D(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 5, 10, 3, 18),        // Blood Rot
  D(0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 10, 0xFF, 0xFF),   // Typhoid Fever
  D(0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 2, 10, 0xFF, 0xFF),   // Dementia
  D(0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 10, 0xFF, 0xFF),   // Chrondiasis
  D(0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 4, 3, 18),         // Wizard Fever
]);

/** IsDiseasePermanent, verbatim (min == 0xff means never-ending). */
export const isDiseasePermanent = (data) => data.daysOfSymptomsMin === PERMANENT_DISEASE_VALUE;

/** Classic contracted-message tokens live at TEXT.RSC record
 *  100 + diseaseType (GetClassicContractedMessageTokens). Shown by
 *  the health status box once incubation is over - that UI pends. */
export const contractedMessageRecord = (diseaseType) => 100 + diseaseType;

/** TextManager "youFeelSomewhatBad" - the daily-tick HUD alert. */
export const YOU_FEEL_SOMEWHAT_BAD = 'You feel somewhat bad.';

// ---- The OnMonsterHit disease lists (declared inside DFU's
// OnMonsterHit; hoisted here for the tests). Source comments: rat =
// classic listA but DF Chronicles' listB kept "since it has more
// variety"; zombie's list matches mummy's "except missing cholera,
// probably a mistake" - list C is shared verbatim anyway. ----
export const DISEASE_LIST_A = Object.freeze([DISEASES.Plague]);
export const DISEASE_LIST_B = Object.freeze([DISEASES.Plague, DISEASES.StomachRot, DISEASES.BrainFever]);
export const DISEASE_LIST_C = Object.freeze([
  DISEASES.Plague, DISEASES.YellowFever, DISEASES.StomachRot, DISEASES.Consumption,
  DISEASES.BrainFever, DISEASES.SwampRot, DISEASES.Cholera, DISEASES.Leprosy, DISEASES.RedDeath,
  DISEASES.TyphoidFever, DISEASES.Dementia,
]);

/** FormulaHelper.specialInfectionChance (percent on a 0..100 float
 *  roll - vampirism/lycanthropy transmission). */
export const SPECIAL_INFECTION_CHANCE = 0.6;

/**
 * DiseaseEffect.Start + the AddState rule: create the live disease
 * entry on the target, or null when refused (non-player / level < 2 /
 * already carrying this disease - can't catch the same one twice).
 * currentDay = classic minutes / 1440 at infection; the infection day
 * itself is incubation (the first symptom day is the NEXT day).
 */
export function startDisease(target, diseaseType, currentDay, rolls = Math.random) {
  if (!target.isPlayer || (target.level ?? 0) < 2) return null;   // Start: EndDisease for non-player hosts
  if (target.activeEffects?.some((a) => a.kind === 'disease' && a.disease === diseaseType && !a.ended)) return null;   // AddState no-op
  const data = DISEASE_DATA[diseaseType];
  const entry = {
    kind: 'disease', disease: diseaseType, permanent: true,
    incubationOver: false, lastDay: currentDay, daysOfSymptomsLeft: 0,
    statMods: {},
  };
  // If not permanent, set a range for how long stats will fall
  if (!isDiseasePermanent(data)) {
    entry.daysOfSymptomsLeft = data.daysOfSymptomsMin + Math.floor(rolls() * (data.daysOfSymptomsMax + 1 - data.daysOfSymptomsMin));   // Range(min, max+1)
  }
  target.activeEffects = target.activeEffects || [];
  target.activeEffects.push(entry);
  return entry;
}

/** EndDisease, verbatim: completed marker + expire (the tick pass
 *  removes the entry, lifting its statMods with it). */
export function endDisease(entry) {
  entry.daysOfSymptomsLeft = COMPLETED_DISEASE_VALUE;
  entry.ended = true;   // forcedRoundsRemaining = 0
}

/** IncrementDailyDiseaseEffects, verbatim: ONE damage roll for the
 *  day, DiseaseData as a multiplier matrix - stat columns accumulate
 *  negative statMods (ChangeStatMod), HEA/FAT/SPL decrease pools
 *  through the sinks (FAT in RAW units - no x64). */
function incrementDailyDiseaseEffects(entry, sinks, rolls) {
  const data = DISEASE_DATA[entry.disease];
  const damageAmount = data.minDamage + Math.floor(rolls() * (data.maxDamage + 1 - data.minDamage));   // Range(min, max+1)
  const mods = entry.statMods;
  const change = (stat, mult) => { if (mult) mods[stat] = (mods[stat] ?? 0) - mult * damageAmount; };
  change('strength', data.STR);
  change('intelligence', data.INT);
  change('willpower', data.WIL);
  change('agility', data.AGI);
  change('endurance', data.END);
  change('personality', data.PER);
  change('speed', data.SPD);
  change('luck', data.LUC);
  if (data.HEA && sinks.hurt) sinks.hurt(data.HEA * damageAmount);
  if (data.FAT && sinks.drainFatigue) sinks.drainFatigue(data.FAT * damageAmount);   // DecreaseFatigue WITHOUT the multiplier
  if (data.SPL && sinks.drainMagicka) sinks.drainMagicka(data.SPL * damageAmount);
}

/**
 * UpdateDisease, verbatim - runs every magic round, acts once per
 * elapsed classic day (daysPast > 1 rolls each day - fast travel /
 * rest catch up). Order preserved: increment days, update lastDay,
 * count down / end, THEN the HUD alert (which fires on the ending
 * day too).
 */
export function updateDiseaseEntry(entry, currentDay, sinks, rolls = Math.random, onAlert = null) {
  if (entry.ended) return;   // do nothing if expiring out
  const daysPast = currentDay - entry.lastDay;
  // same day = incubation; 0xfe = disease has run its course
  if (daysPast === 0 || entry.daysOfSymptomsLeft === COMPLETED_DISEASE_VALUE) return;
  if (!entry.incubationOver) entry.incubationOver = true;
  for (let i = 0; i < daysPast; i++) incrementDailyDiseaseEffects(entry, sinks, rolls);
  entry.lastDay = currentDay;
  const data = DISEASE_DATA[entry.disease];
  if (!isDiseasePermanent(data) && (entry.daysOfSymptomsLeft -= daysPast) <= 0) {
    entry.daysOfSymptomsLeft = 0;
    endDisease(entry);
  }
  if (onAlert) onAlert(YOU_FEEL_SOMEWHAT_BAD);
}

/** The per-round disease pass for one entity (each DiseaseEffect's
 *  MagicRound). Call BEFORE tickActiveEffects so an ending disease's
 *  final day lands and the same round's tick removes the entry
 *  (DFU removes expired bundles at the end of the same DoMagicRound). */
export function updateDiseases(entity, currentDay, sinks, rolls = Math.random, onAlert = null) {
  for (const a of entity.activeEffects ?? []) {
    if (a.kind === 'disease') updateDiseaseEntry(a, currentDay, sinks, rolls, onAlert);
  }
}

/**
 * FormulaHelper.InflictDisease, verbatim: player-only, the classic
 * level-1 immunity, a FULL saving-throw save (== 0) resists outright,
 * then a uniform pick from the list assigned with BypassSavingThrows
 * (startDisease). Element 2 = DFCareer.Elements.DiseaseOrPoison.
 */
export function inflictDisease(target, diseaseList, { rolls = Math.random, currentDay = 0, onContract = null } = {}) {
  if (!diseaseList || !diseaseList.length || !target.isPlayer) return null;
  if (target.level === 1) return null;   // classic: no diseases at level 1
  if (savingThrow(2, EFFECT_FLAGS.Disease, target, 0, rolls) === 0) return null;   // resisted
  const diseaseType = diseaseList[Math.floor(rolls() * diseaseList.length)];   // Range(0, length)
  const entry = startDisease(target, diseaseType, currentDay, rolls);
  if (entry && onContract) onContract(diseaseType, entry);
  return entry;
}

/** FormulaHelper.FatigueDamage (nymph/lamia): "every 1 pt of health
 *  damage = 2 pts of fatigue damage" - SetFatigue(current -
 *  damage * 2 * 64), i.e. x64 STORED units unlike the disease FAT
 *  column. The 14-day collapse TODO is DFU's own, not ported. */
export function fatigueDamage(target, damage, sinks) {
  if (sinks?.drainFatigue) sinks.drainFatigue(damage * 2 * FATIGUE_MULTIPLIER);
}

/**
 * FormulaHelper.OnMonsterHit, verbatim rider table - called per hit
 * (hitDamage > 0) from the monster multi-attack loop. deps: rolls,
 * currentDay, sinks (the TARGET's), onContract(diseaseType, entry).
 * Spider/GiantScorpion: classic spell 66 (Paralyze) - FLAGGED pending
 * the Paralyze effect (S19). Werewolf/Wereboar/Vampire special
 * infections: ROUTED (vampirism/lycanthropy line) - rolls consumed.
 */
export function onMonsterHit(attacker, target, damage, deps = {}) {
  const { rolls = Math.random, currentDay = 0, sinks = null, onContract = null } = deps;
  const inflict = (list) => inflictDisease(target, list, { rolls, currentDay, onContract });
  switch (attacker.careerIndex) {
    case MOBILE_TYPES.Rat:
      // classic = listA only; DF Chronicles' listB kept (DFU choice)
      if (dice100(5, rolls())) inflict(DISEASE_LIST_B);
      break;
    case MOBILE_TYPES.GiantBat:
      // classic 2% (DF Chronicles says 5%) - classic kept
      if (dice100(2, rolls())) inflict(DISEASE_LIST_B);
      break;
    case MOBILE_TYPES.Spider:
    case MOBILE_TYPES.GiantScorpion:
      // FLAGGED: queue classic spell 66 (Paralyze) on the attacker
      // unless the target is already paralyzed - pends Paralyze (S19)
      break;
    case MOBILE_TYPES.Werewolf:
    case MOBILE_TYPES.Wereboar:
      // ROUTED: specialInfectionChance -> lycanthropy infection
      rolls();   // Random.Range(0f, 100f) consumed verbatim
      break;
    case MOBILE_TYPES.Nymph:
      fatigueDamage(target, damage, sinks);
      break;
    case MOBILE_TYPES.Zombie:
      // nothing in classic; DF Chronicles' 2% kept (DFU choice)
      if (dice100(2, rolls())) inflict(DISEASE_LIST_C);
      break;
    case MOBILE_TYPES.Mummy:
      if (dice100(5, rolls())) inflict(DISEASE_LIST_C);
      break;
    case MOBILE_TYPES.Vampire:
    case MOBILE_TYPES.VampireAncient: {
      const random = rolls() * 100;   // Random.Range(0f, 100f)
      if (random <= SPECIAL_INFECTION_CHANCE && target.isPlayer) {
        // ROUTED: stage-one vampirism infection
      } else if (random <= 2.0) {
        inflict(DISEASE_LIST_A);
      }
      break;
    }
    case MOBILE_TYPES.Lamia:
      // nothing in classic; DF Chronicles' fatigue rule kept
      fatigueDamage(target, damage, sinks);
      break;
    default:
      break;
  }
}
