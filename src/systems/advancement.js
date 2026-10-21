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
import { SKILLS, setSkillRecentlyIncreased, levelUpSkillSum } from './skills.js';
// SOFTCAP1: skills past 100 - the cost ladder and the milestones (a leaf)
import { SKILL_SOFT_CAP, SKILL_HARD_CAP, softcapCostMultiplier, milestoneAt } from './skillSoftcap.js';
import { masterSkillsActive, skillCanPassCap, masteryRefusal } from './masterSkills.js';   // SOFTCAP3: the climb past 100 and the lifted 95 lock are Master Skills'
import { hitPointsPerLevelUp, spendPoolLowest } from './chargen.js';
import { ONLINE_BONUS_POOL } from './levelEven.js';   // LEVEL-EVEN: online, every level's pool is 5
import { refreshOnlineLayer } from './renownLayer.js';   // LEVEL-EVEN: the online health floor read again over the level's new maximum
import { isOnlinePage } from './online/onlineLane.js';
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

/** LEVEL-ONLINE-2: the port's own inverse of calculatePlayerLevel - the starting sum that puts a character with
 *  `currentSum` at the very START of `level` (calculatePlayerLevel answers `level`, and no sum is yet banked toward the
 *  next). What a character switched ONTO Daggerfall's leveling is anchored at, so the sum its skills built under
 *  another system neither pays out levels at once nor owes any. */
export const levelUpSkillSumAnchor = (currentSum, level) =>
  currentSum + 28 - level * LEVELUP_SKILL_SUM_PER_LEVEL;

/** sum(primary) + sum(major) - lowest major + highest minor - one home in skills.js, re-exported for this file's importers. */
export { levelUpSkillSum };

export function alreadyMasteredASkill(entity) {
  // SOFTCAP1: `>=` - a primary climbed past 100 is still mastered (DFU's
  // `== 100` was the same test when 100 was the ceiling)
  return entity.career.primarySkills.some((id) => entity.skills[id] >= SKILL_SOFT_CAP);
}

/** SOFTCAP1: the uses a raise FROM `skillValue` needs - DFU's number,
 *  times the softcap's ladder (4x / 8x / 16x past 100). May exceed the
 *  20000 tally clamp; raiseSkills spends such a cost as progress. */
export function softcapUsesForAdvancement(skillValue, skillMult, careerAdvMult, level) {
  return skillUsesForAdvancement(skillValue, skillMult, careerAdvMult, level) * softcapCostMultiplier(skillValue);
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
 * live host supplies that message as the hook - world.js:"DC1: the sequence"/world.js:"follower only ever",
 * exterior.js:"console.log('[player] You have gained a level!')"/exterior.js:"say: (msg) => townTalk.say".."// LV2 - THE RISING: the CLASSIC skin opens the sheet here as it", worldModes.js:"onExhausted: onExhaustedInterior".."say,"/worldModes.js:"and has never heard",
 * dungeonContext.js:"U3: the level-up". The immediate arm below is taken only when
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
export function raiseSkills(entity, classicTimeMinutes, rolls = Math.random, onLevelUp = null, onMastery = null, onRaise = null, onMilestone = null) {
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
    // SOFTCAP1: PAST 100 the ladder's cost can exceed the 20000 tally clamp
    // that keeps DFU's shift inside int32, so a raise there is bought as
    // PROGRESS: each pass banks calcUses / (needed * ladder) of a point on
    // entity.skillProgress and the point lands when it reaches 1 (one point
    // a pass, as DFU raises one a pass; MOVE-BANK keeps the rest whole).
    const master = masterSkillsActive(entity);
    if (entity.skills[i] >= SKILL_SOFT_CAP && skillCanPassCap(entity, i)) {   // SOFTCAP4: a MASTERED skill only (2/2/1)
      if (entity.skills[i] >= SKILL_HARD_CAP) continue;
      // MOVE-BANK (FIELD BUGS 2026-10-01 #7): the count past 100 has no 20000 bucket (skills.js tallySkill), so the
      // shift's float twin - the same number to 20000 - and what a pass does not land is KEPT WHOLE for the next one,
      // re-priced at the next point's cost (it was capped at 0.99, so a long run's second point was thrown away, and a
      // pass with no new uses never landed a banked one). Still one point a pass.
      const uses = Math.floor((entity.skillUses[i] * reflexesMod) / 0x10000);
      const cost = needed * softcapCostMultiplier(entity.skills[i]);
      const prog = (entity.skillProgress ??= new Array(entity.skillUses.length).fill(0));
      prog[i] = (prog[i] ?? 0) + uses / cost;
      entity.skillUses[i] = 0;
      if (!(prog[i] >= 1)) continue;
      const nextCost = softcapUsesForAdvancement(entity.skills[i] + 1, SKILL_ADVANCEMENT_MULTIPLIER[i], entity.career.advancementMultiplier, entity.level);
      prog[i] = (prog[i] - 1) * cost / nextCost;   // 0 at the hard cap (the next point costs Infinity)
      entity.skills[i] += 1;
      setSkillRecentlyIncreased(entity, i);
      raised.push(i);
      onRaise?.(i);
      const ms = milestoneAt(entity.skills[i]);
      if (ms) onMilestone?.(i, ms);
      continue;
    }
    if (calcUses < needed) continue;
    entity.skillUses[i] = 0;
    // AlreadyMasteredASkill re-evaluated PER RAISE (audit F7): a
    // primary hitting 100 mid-pass blocks later 95+ raises, verbatim.
    // SOFTCAP3: Master Skills lifts DFU's 95 lock - every skill may reach 100 (and, above, the climb goes on)
    if (entity.skills[i] < 100 && (entity.skills[i] < 95 || master || !alreadyMasteredASkill(entity))) {
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
  // SWAP-CYCLE (2026-10-20): the stored sum is the sum the level stands on, and a raise never lowers it. DFU's never could
  // fall (a permanent skill only rises), so for a class as made nothing changes; a class skill given up for a less
  // trained one (skillSwap.js) lowers the class's sum, and its ground is made up before the level moves again - stored
  // where it fell, the swap undone would lose that ground for good, and the bar would read a lower level's fraction.
  if (raised.length) { const sum = levelUpSkillSum(entity); if (!(entity.currentLevelUpSkillSum >= sum)) entity.currentLevelUpSkillSum = sum; }
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

/**
 * SKILL-TICK (2026-10-19, Discord #suggestions "Show current XP towards skill/next skill level up ticker", Cruor: "An
 * EXP ticker when you mouse over a skill that shows out of whatever XP is needed for the skill, to improve it on rest
 * ... 'your skills can be improved' notification to let players know they should probably rest, since XP does not hang
 * over"). Where skill `i` stands against raiseSkills' own test, read the way the next pass will read it - the uses as
 * Reflexes scales them, against GetSkillAdvancementRequirement's number (past 100 a mastered skill's banked progress and
 * the ladder's price, MOVE-BANK's units). Answers `{ have, need, ready, held, wait }`: `ready`, the next pass raises it;
 * `held`, why a pass will not however many uses it counts - 'cap' (the hard cap, or 100 with no mastery to be had),
 * 'master' (100, and a mastery open to it - masterSkills.js masteryRefusal) or 'lock' (DFU's 95 lock: a primary at 100,
 * or one the same pass takes to 100 before it - AUDIT SUGGESTIONS-1019 L3-2, raiseSkills asks alreadyMasteredASkill per
 * raise); `wait`, the game minutes before a pass can run at all (the 360-minute gate - L3-1), 0 with no clock given.
 * Daggerfall shows none of it; the port's own sheet line.
 */
export function skillAdvanceProgress(entity, i, { now = null } = {}) {
  const wait = skillCheckWait(entity, now);
  const value = entity.skills?.[i] ?? 0;
  const needed = skillUsesForAdvancement(value, SKILL_ADVANCEMENT_MULTIPLIER[i], entity.career?.advancementMultiplier ?? 1, entity.level ?? 1);
  const reflexesMod = 0x10000 - (((entity.reflexes ?? 2) - 2) << 13);
  const tally = entity.skillUses?.[i] ?? 0;
  if (value >= SKILL_SOFT_CAP && skillCanPassCap(entity, i)) {
    if (value >= SKILL_HARD_CAP) return { have: 0, need: 0, ready: false, held: 'cap', wait };
    const cost = needed * softcapCostMultiplier(value);
    const uses = Math.floor((tally * reflexesMod) / 0x10000), banked = entity.skillProgress?.[i] ?? 0;
    return { have: Math.floor(banked * cost) + uses, need: cost, ready: banked + uses / cost >= 1, held: null, wait };   // the pass's own test
  }
  const have = (tally * reflexesMod) >> 16;
  const held = value >= 100 ? (masteryRefusal(entity, i) == null ? 'master' : 'cap')
    : value >= 95 && !masterSkillsActive(entity) && lockedBy(entity, i) ? 'lock' : null;
  return { have, need: needed, ready: !held && have >= needed, held, wait };
}
/** AUDIT SUGGESTIONS-1019 L3-1: the game minutes before raiseSkills' gate opens (`now` strictly more than
 *  SKILL_RAISE_CHECK_INTERVAL past the last check) - 0 when it is open, or when no clock is given. */
export function skillCheckWait(entity, now = null) {
  if (!Number.isFinite(now)) return 0;
  return Math.max(0, Math.floor(entity?.lastSkillCheckTime ?? 0) + SKILL_RAISE_CHECK_INTERVAL + 1 - Math.floor(now));
}
/** The pass's raise of skill `i` below 100: its uses reach the requirement (the uses as Reflexes scales them). */
const meetsBelowCap = (entity, i) => ((((entity.skillUses?.[i] ?? 0) * (0x10000 - (((entity.reflexes ?? 2) - 2) << 13))) >> 16)
  >= skillUsesForAdvancement(entity.skills?.[i] ?? 0, SKILL_ADVANCEMENT_MULTIPLIER[i], entity.career?.advancementMultiplier ?? 1, entity.level ?? 1));
/** AUDIT SUGGESTIONS-1019 L3-2: whether DFU's 95 lock stands for skill `i` when the pass reaches it - a primary at 100
 *  already, or a primary before it in the pass at 99 that the pass raises to 100 (its own lock not standing). */
function lockedBy(entity, i) {
  if (alreadyMasteredASkill(entity)) return true;
  for (const j of entity.career?.primarySkills ?? []) {
    if (j >= i || entity.skills?.[j] !== 99 || skillCanPassCap(entity, j)) continue;
    if (meetsBelowCap(entity, j) && !lockedBy(entity, j)) return true;
  }
  return false;
}
/** SKILL-TICK: how many skills the next pass would raise, building nothing (the HUD asks every frame - AUDIT
 *  SUGGESTIONS-1019 L3-4); 0 before chargen is done and while the gate is shut (`now` given). */
export function countReadyToImprove(entity, { now = null } = {}) {
  if (!entity?.chargenDone || !Array.isArray(entity.skillUses) || skillCheckWait(entity, now) > 0) return 0;
  let n = 0;
  for (let i = 0; i < entity.skillUses.length; i++) if (skillAdvanceProgress(entity, i).ready) n++;
  return n;
}
/** SKILL-TICK: the skills the next pass would raise, in the pass's order. None before chargen is done. */
export const skillsReadyToImprove = (entity) => {
  if (!entity?.chargenDone || !Array.isArray(entity.skillUses)) return [];
  const out = [];
  for (let i = 0; i < entity.skillUses.length; i++) if (skillAdvanceProgress(entity, i).ready) out.push(i);
  return out;
};

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
export function bonusPoolFor(entity, rolls = Math.random, { online = isOnlinePage() } = {}) {
  if (entity.pendingBonusPool == null) {
    // LEVEL-EVEN (systems/levelEven.js): online the pool is BonusPool's mean, drawn from no stream
    entity.pendingBonusPool = online ? ONLINE_BONUS_POOL : LEVELUP_BONUS_POOL_MIN + Math.floor(rolls() * (LEVELUP_BONUS_POOL_MAX + 1 - LEVELUP_BONUS_POOL_MIN));
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
    refreshOnlineLayer(entity, { keepHealth: true });   // AUDIT LEVEL-EVEN L2-2: the book's Endurance reaches the floor now
    entity.readyToLevelUp = false;
    entity.oghmaLevelUp = false;
    entity.pendingLevel = null;
    entity.pendingBonusPool = null;   // the book's thirty is fixed, but a level owed UNDER it was pending too
    return true;
  }
  entity.level += 1;   // L-slice (entity-9): Level++, never a jump to the calculated level
  // DISC10-E L4: onto the RAW maximum - MaxHealth reads the lycanthrope's limiter now, and `+=` through it would bake the urge's ceiling into the level
  entity.maxHealth = (entity.rawMaxHealth ?? entity.maxHealth) + hitPointsPerLevelUp(entity.career, entity.stats.endurance, rolls);   // PERMANENT endurance, verbatim (audit F8 - DFU reads Stats.PermanentEndurance here, not the live value)
  entity.health = Math.min(entity.health, entity.maxHealth);
  // AUDIT 23 (ui-native-1): DFU rolls BonusPool() exactly ONCE, at the
  // level-up screen's setup - the UI hands its shown pool back here so
  // a second, discarded draw never burns a number from the stream.
  const pool = prerolledPool ?? bonusPoolFor(entity, rolls);
  distribute(entity.stats, pool);
  // LEVEL-EVEN (systems/levelEven.js): the floor over the new maximum and the Endurance just spent (AUDIT LEVEL-EVEN L2-2:
  // after the points, not before them), current health left as it stands (L2-1)
  refreshOnlineLayer(entity, { keepHealth: true });
  entity.readyToLevelUp = false;
  entity.pendingLevel = null;
  entity.pendingBonusPool = null;   // the level is spent, so its pool is not pending either
  return true;
}