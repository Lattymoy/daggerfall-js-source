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
// ORL1: the ONE question this file asks the vendored mod - whose law
// levels this character. Everything DFU below is untouched by the
// answer; the two arms simply do not both run.
import {
  usesVirtueLeveling, addSkillProgress, checkForVirtueLevelUp, levelingSettings, virtueLevelUpHeadless,
} from './oblivionLeveling.js';

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

/** ORL1 (deep audit): the divisor, named - the leveling question prints
 *  it, and a screen that quotes a law by copying its number is a screen
 *  that goes stale the day the law moves. */
export const LEVELUP_SKILL_SUM_PER_LEVEL = 15;

export const calculatePlayerLevel = (startingSum, currentSum) =>
  Math.floor((currentSum - startingSum + 28) / LEVELUP_SKILL_SUM_PER_LEVEL);

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
 * live host supplies that message as the hook - world.js:2767/:4959,
 * exterior.js:1093/:1993, worldModes.js:455/:8320,
 * dungeonContext.js:1823. The immediate arm below is taken only when
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
  // ORL1: read ONCE per pass, not per raise - the mod's Lua reads its
  // three impact keys out of `skillsSettings` inside the handler
  // (player.lua:35-37; its other storage handle, `levelUpSettings`, is
  // read only outside it), but a player cannot move a slider in the
  // middle of one skill check and one read per pass makes every raise in
  // a pass obey the same rules.
  const virtue = usesVirtueLeveling(entity);
  const virtueSettings = virtue ? levelingSettings() : null;
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
      // ORL1: the mod's own skill-level-up handler (player.lua:29-51),
      // in the mod's own position - BEFORE the raise lands, because
      // OpenMW calls it with the value the skill is leaving and the
      // 0.5.3 fix reads exactly that value. It sits inside this gate
      // rather than outside it because a raise the cap refuses is a
      // skill that never levelled up, and OpenMW would not have called
      // the handler at all.
      if (virtue) addSkillProgress(entity, i, virtueSettings);
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
  // ORL1: the mod replaces the SUM with a bar, so it replaces the
  // question asked of it - and only the question. Both arms raise the
  // SAME `readyToLevelUp` flag, so every host's onLevelUp door, every
  // sheet and the save all carry on reading what they already read.
  if (virtue ? checkForVirtueLevelUp(entity) : checkForLevelUp(entity)) {
    if (!onLevelUp) {
      // headless path (tests, ?class runs without the UI arc active)
      if (virtue) virtueLevelUpHeadless(entity, virtueSettings, rolls);
      else applyLevelUp(entity, (stats, pool) => spendPoolLowest(stats, Object.keys(stats), pool), rolls);
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

/**
 * THE LEVEL'S BONUS POOL, ROLLED ONCE PER LEVEL AND REMEMBERED.
 *
 * FormulaHelper.BonusPool is a 4..6 draw and DFU takes it at the
 * ROLLOUT'S SETUP - so in DFU, and in this port until now, closing the
 * level-up window and opening it again drew a new one. On the classic
 * lane that is unreachable in practice: DFU's rollout mounts on the
 * character sheet and `applyLevelUp` commits the level AT MOUNT, so
 * there is no unspent level left to re-open. LV2 made it reachable and
 * then obvious - the enhanced window is now a thing the player OPENS,
 * deliberately, whenever they like, and `readyToLevelUp` stays set
 * until they spend - so "escape, press the key again, until it says 6"
 * became one keystroke away and a player would find it without looking.
 *
 * AUDIT LV2 recorded that rather than fixing it, on the grounds that
 * the re-roll is DFU's own shape. Mac's answer: "Yes fucking fix it."
 * So the draw is the LEVEL'S, not the WINDOW'S. It is taken on the
 * first screen that needs one, remembered on the entity beside
 * `pendingLevel`, handed to every screen after that, saved with the
 * character, and cleared where `pendingLevel` is cleared - which is
 * the one place a level stops being pending.
 *
 * This is a DEPARTURE and it is deliberate: the port draws FEWER
 * numbers from the stream than DFU does, where AUDIT 23's rule was
 * about never drawing MORE (a shown pool must be the spent pool, so a
 * second discarded draw never burns a number). One level, one pool.
 */
export function bonusPoolFor(entity, rolls = Math.random) {
  if (entity.pendingBonusPool == null) {
    entity.pendingBonusPool = LEVELUP_BONUS_POOL_MIN + Math.floor(rolls() * (LEVELUP_BONUS_POOL_MAX + 1 - LEVELUP_BONUS_POOL_MIN));
  }
  return entity.pendingBonusPool;
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
    entity.pendingBonusPool = null;   // the book's thirty is fixed, but a level owed UNDER it was pending too
    return true;
  }
  entity.level += 1;   // L-slice (entity-9): Level++, never a jump to the calculated level
  entity.maxHealth += hitPointsPerLevelUp(entity.career, entity.stats.endurance, rolls);   // PERMANENT endurance, verbatim (audit F8 - DFU reads Stats.PermanentEndurance here, not the live value)
  entity.health = Math.min(entity.health, entity.maxHealth);
  // AUDIT 23 (ui-native-1): DFU rolls BonusPool() exactly ONCE, at the
  // level-up screen's setup - the UI hands its shown pool back here so
  // a second, discarded draw never burns a number from the stream.
  const pool = prerolledPool ?? bonusPoolFor(entity, rolls);
  distribute(entity.stats, pool);
  entity.readyToLevelUp = false;
  entity.pendingLevel = null;
  entity.pendingBonusPool = null;   // the level is spent, so its pool is not pending either
  return true;
}