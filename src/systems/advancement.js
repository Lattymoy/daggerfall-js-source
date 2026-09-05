// Skill advancement + player leveling (Systems S3b). Verbatim ports
// from DFU PlayerEntity.RaiseSkills / SetCurrentLevelUpSkillSum /
// CheckForLevelUp, FormulaHelper.CalculateSkillUsesForAdvancement /
// CalculatePlayerLevel, DaggerfallSkills.GetAdvancementMultiplier
// (MIT, Daggerfall Workshop). Completes the S3 TallySkill story:
// tally -> skill raise (every 360 classic minutes) -> level.
//
//   usesNeeded = floor(skillValue * skillMult * careerAdvMult
//                      * 1.04^level * 2/5) + 1
//   reflexesMod = 0x10000 - ((reflexes - 2) << 13)     (bit-exact)
//   calcUses    = (uses * reflexesMod) >> 16
//   raise when calcUses >= needed: uses = 0, skill + 1, capped at
//   100 - and 95+ only while NO primary skill is already mastered
//   levelUpSkillSum = sum(primary) + sum(major) - min(major)
//                     + max(minor)
//   level check: floor((current - starting + 28) / 15) > level ->
//   readyToLevelUp; the char-sheet applies ONE Level++ per visit and
//   the next 360-minute check re-raises the flag while still behind
//   (entity-9). The headless path applies the same single step -
//   maxHealth += hitPointsPerLevelUp, and the level-up BonusPool
//   (Range(4, 6+1)) spends by the lowest-first policy where no UI
//   is mounted.

import { OGHMA_BONUS_POOL } from './artifactEffects.js';   // V3: the sheet's oghmaBonusPool (:44)
import { SKILLS, setSkillRecentlyIncreased } from './skills.js';
import { hitPointsPerLevelUp, spendPoolLowest } from './chargen.js';

// DaggerfallSkills.GetAdvancementMultiplier, all 35, verbatim.
export const SKILL_ADVANCEMENT_MULTIPLIER = Object.freeze([
  12,   // Medical
  1, 1, // Etiquette, Streetwise
  5,    // Jumping
  15, 15, 15, 15, 15, 15, 15, 15, 15,   // the nine languages
  2,    // Lockpicking
  1,    // Mercantile
  2, 2, // Pickpocket, Stealth
  1,    // Swimming
  2,    // Climbing
  1,    // Backstabbing
  4,    // Dodging
  50,   // Running
  1,    // Destruction
  2,    // Restoration
  1, 1, // Illusion, Alteration
  2,    // Thaumaturgy
  1,    // Mysticism
  2, 2, 2, 2, 2,   // ShortBlade, LongBlade, HandToHand, Axe, Blunt
  1,    // Archery
  8,    // CriticalStrike
]);

export const SKILL_RAISE_CHECK_INTERVAL = 360;   // classic minutes
export const LEVELUP_BONUS_POOL_MIN = 4;         // FormulaHelper.BonusPool
export const LEVELUP_BONUS_POOL_MAX = 6;

export function skillUsesForAdvancement(skillValue, skillMult, careerAdvMult, level) {
  const levelMod = Math.pow(1.04, level);
  return Math.floor((skillValue * skillMult * careerAdvMult * levelMod * 2) / 5) + 1;
}

export const calculatePlayerLevel = (startingSum, currentSum) =>
  Math.floor((currentSum - startingSum + 28) / 15);

/** sum(primary) + sum(major) - lowest major + highest minor. */
export function levelUpSkillSum(entity) {
  const c = entity.career;
  let sum = 0;
  for (const id of c.primarySkills) sum += entity.skills[id];
  let lowestMajor = Infinity;
  for (const id of c.majorSkills) { const v = entity.skills[id]; sum += v; if (v < lowestMajor) lowestMajor = v; }
  sum -= lowestMajor;
  let highestMinor = -Infinity;
  for (const id of c.minorSkills) { const v = entity.skills[id]; if (v > highestMinor) highestMinor = v; }
  return sum + highestMinor;
}

export function alreadyMasteredASkill(entity) {
  return entity.career.primarySkills.some((id) => entity.skills[id] === 100);
}

// ── skillsRecentlyRaised ──────────────────────────────────────────
// INTEGRATION (A4+A11): both wave-A slices ported PlayerEntity's
// uint[2] raise mask; the canonical trio lives in skills.js (beside
// the tally counters the sheet also reads). advancement re-exports
// A4's spelling so its save-lane consumers keep one import site.
export { getSkillRecentlyIncreased as skillRecentlyIncreased, setSkillRecentlyIncreased, resetSkillsRecentlyRaised } from './skills.js';

/**
 * PlayerEntity.RaiseSkills verbatim (the >360-classic-minute gate
 * lives here via entity.lastSkillCheckTime). Returns the raised
 * skill ids.
 *
 * NOT A GAP (closeout): `onLevelUp` IS DFU's char-sheet route.
 * RaiseSkills' tail is `if (CheckForLevelUp()) DaggerfallUI.PostMessage(
 * dfuiOpenCharacterSheetWindow)` (PlayerEntity.cs:1413-1414), and every
 * live host supplies that message as the hook - world.js:1119/:2409/
 * :3132, exterior.js:750/:1300, worldModes.js:364/:5480,
 * dungeonContext.js:1418. The immediate arm below is taken only when
 * onLevelUp is null: a headless/test path (and the ?class= skip) that
 * DFU has no counterpart for, so there is nothing to diverge from.
 *
 * ROAD-Ar R12 - THE HOOKS FIRE IN DFU'S ORDER, WHICH IS THE WHOLE
 * POINT OF HAVING THEM. RaiseSkills does the skillImprove popup
 * (:1388) and the mastery box (:1396-1404) INSIDE the skill loop and
 * only then, outside it, posts dfuiOpenCharacterSheetWindow (:1413).
 * A host that presents the raises AFTER raiseSkills returns has
 * inverted that, and on a single-overlay host the mastery box then
 * lands on top of the level-up sheet. So `onRaise` exists for the same
 * reason `onMastery` does: to give the host DFU's moment rather than
 * a batch after the fact.
 */
export function raiseSkills(entity, classicTimeMinutes, rolls = Math.random, onLevelUp = null, onMastery = null, onRaise = null) {
  if (!entity.chargenDone) return [];
  if ((classicTimeMinutes - (entity.lastSkillCheckTime ?? 0)) <= SKILL_RAISE_CHECK_INTERVAL) return [];
  entity.lastSkillCheckTime = classicTimeMinutes;
  const raised = [];
  for (let i = 0; i < entity.skillUses.length; i++) {
    const needed = skillUsesForAdvancement(
      entity.skills[i], SKILL_ADVANCEMENT_MULTIPLIER[i], entity.career.advancementMultiplier, entity.level);
    const reflexesMod = 0x10000 - ((entity.reflexes - 2) << 13);
    const calcUses = (entity.skillUses[i] * reflexesMod) >> 16;
    if (calcUses < needed) continue;
    entity.skillUses[i] = 0;
    // AlreadyMasteredASkill re-evaluated PER RAISE (audit F7): a
    // primary hitting 100 mid-pass blocks later 95+ raises, verbatim.
    if (entity.skills[i] < 100 && (entity.skills[i] < 95 || !alreadyMasteredASkill(entity))) {
      entity.skills[i] += 1;
      // A4/A11: SetSkillRecentlyIncreased(i) sits between the raise
      // and SetCurrentLevelUpSkillSum (PlayerEntity.cs:1386-1388) - the
      // ONE producer of the mark the char sheet highlights until a
      // non-levelling close clears the mask (CheckIfDoneLeveling :451).

      setSkillRecentlyIncreased(entity, i);
      raised.push(i);
      // PopupMessage("skillImprove") (:1388) - in the loop, ahead of
      // the mastery box for that same skill and ahead of the sheet.
      onRaise?.(i);
      // RaiseSkills :1390-1407, verbatim shape: a PRIMARY skill that
      // has just landed on exactly 100 is the mastery. The box's text
      // and the fanfare are presentation, so they ride the host's
      // hook (scenes/shared.js raisePlayerSkills) - the LAW is which
      // skill, and when.
      if (entity.skills[i] === 100 && entity.career.primarySkills.includes(i)) onMastery?.(i);
    }
  }
  if (raised.length) entity.currentLevelUpSkillSum = levelUpSkillSum(entity);
  // L-slice (AUDIT 23 entity-9): the tail check runs on EVERY pass
  // that clears the 360-minute gate, raise or no raise (RaiseSkills
  // :1413 sits outside the skill loop) - which is what re-offers the
  // sheet after a one-level acknowledgment left `level` still below
  // the calculated level. DFU posts dfuiOpenCharacterSheetWindow; the
  // hosts' onLevelUp hook is that message.
  if (checkForLevelUp(entity)) {
    if (!onLevelUp) {
      applyLevelUp(entity, (stats, pool) => spendPoolLowest(stats, Object.keys(stats), pool), rolls);   // headless path (tests, ?class runs without the UI arc active)
    } else {
      onLevelUp(entity);
    }
  }
  return raised;
}

/** PlayerEntity.CheckForLevelUp (:1493-1501) verbatim: compare the
 *  stored sums' calculated level against the CURRENT level and raise
 *  readyToLevelUp while behind - however the gap opened (a fresh
 *  raise, or a multi-threshold overshoot the sheet only paid one
 *  Level++ against). pendingLevel is the port's display convenience
 *  for the U3 banner (DFU's sheet prints Level after the ++). */
export function checkForLevelUp(entity) {
  const calculated = calculatePlayerLevel(entity.startingLevelUpSkillSum, entity.currentLevelUpSkillSum);
  const levelUp = entity.level < calculated;
  if (levelUp) {
    entity.readyToLevelUp = true;
    entity.pendingLevel = entity.level + 1;
  }
  return levelUp;
}

/** Apply the pending level: HP roll + the 4..6 bonus pool handed to
 *  `distribute(stats, pool)` - the U3 screen distributes by hand;
 *  the headless path uses lowest-first. */
export function applyLevelUp(entity, distribute, rolls = Math.random, prerolledPool = null) {
  // The sheet gates on ReadyToLevelUp alone (UpdatePlayerValues :370)
  if (!entity.readyToLevelUp) return false;
  // V3: the OGHMA arm (DaggerfallCharacterSheetWindow.cs:374-383) -
  // the Infinium grants a FIXED 30-point pool with NO Level++ and no
  // health raise; both flags clear together (:392-393).
  if (entity.oghmaLevelUp) {
    distribute(entity.stats, OGHMA_BONUS_POOL);
    entity.readyToLevelUp = false;
    entity.oghmaLevelUp = false;
    entity.pendingLevel = null;
    return true;
  }
  entity.level += 1;   // L-slice (entity-9): Level++, never a jump to the calculated level
  entity.maxHealth += hitPointsPerLevelUp(entity.career, entity.stats.endurance, rolls);   // PERMANENT endurance, verbatim (audit F8 - DFU reads Stats.PermanentEndurance here, not the live value)
  entity.health = Math.min(entity.health, entity.maxHealth);
  // AUDIT 23 (ui-native-1): DFU rolls BonusPool() exactly ONCE, at the
  // level-up screen's setup - the UI hands its shown pool back here so
  // a second, discarded draw never burns a number from the stream.
  const pool = prerolledPool ?? (LEVELUP_BONUS_POOL_MIN + Math.floor(rolls() * (LEVELUP_BONUS_POOL_MAX + 1 - LEVELUP_BONUS_POOL_MIN)));
  distribute(entity.stats, pool);
  entity.readyToLevelUp = false;
  entity.pendingLevel = null;
  return true;
}