// @ts-check
// LEVEL-45 online (2026-10-27, mob: "need to always be 45", "everyone is converting"; Port-Ledger A LEVEL-45).
// Daggerfall's 15 a level gave a low roll its last level early and a high one late. Online the climb from the start to
// the six-skill top (800) is shared out, so every start reaches 45 on its last point:
//     level = floor((28 + 647 * climbed / (800 - start)) / 15)        647 = 45 x 15 - 28
// A DEPARTURE from FormulaHelper.CalculatePlayerLevel. levelCap.js is the cap's leaf and offline's law; this reads it.
// onlineLevelConvert reads every realm character's level again at its join - the one place a level comes down.

import { EFFECTIVE_SKILL_MAX, SKILL_SOFT_CAP } from './skillSoftcap.js';
import { PRIMARY_SKILL_MIN, MAJOR_SKILL_MIN, MINOR_SKILL_MIN, BONUS_POOL_PER_SKILL_GROUP } from './chargen.js';
import { levelUpSkillSum } from './skills.js';
import { evenHpFloor } from './levelEven.js';
import { LEVEL_CAP } from './levelCap.js';

/** LEVEL-45: the highest level an online character reaches - the cap's own (levelCap.js). */
export const ONLINE_LEVEL_CAP = LEVEL_CAP;
/** The six-skill sum's top online: five masteries at the hard cap's effective value and the sixth skill at 100 (800).
 *  LEVEL-TOP (mob: "dont count the 6th mastery"): MASTER-THREE's sixth slot climbs the skill, never the level. */
export const LEVEL_SUM_TOP = 5 * EFFECTIVE_SKILL_MAX + SKILL_SOFT_CAP;
/** Daggerfall's head start and divisor (advancement.js calculatePlayerLevel's 28 and 15). */
const HEAD_START = 28, PER_LEVEL = 15;
/** The share of the climb a character spreads over the levels after the head start (647). */
const CLIMB_SHARE = ONLINE_LEVEL_CAP * PER_LEVEL - HEAD_START;

/** The lowest start a creation can give: the base rolls with no bonus, each group's pool spent as thinly as the counted
 *  skills allow - all six primary points counted, four of the six major ones in the best two of three, one of the six
 *  minor ones in the best of six (144). Below it, the start is no roll's. */
export const ROLLED_START_MIN = 3 * PRIMARY_SKILL_MIN + BONUS_POOL_PER_SKILL_GROUP
  + 2 * MAJOR_SKILL_MIN + Math.ceil((2 * BONUS_POOL_PER_SKILL_GROUP) / 3)
  + MINOR_SKILL_MIN + Math.ceil(BONUS_POOL_PER_SKILL_GROUP / 6);
/** The average creation's start, no biography (chargen.js rollSkills with its pools spent lowest-first, 200,000 rolls:
 *  153.8). What a character whose start is no roll's is given. */
export const ROLLED_START_AVERAGE = 154;

/** The level a start and a current sum make online, 1 to ONLINE_LEVEL_CAP. Integer arithmetic, so the top is exactly 45. */
export function onlineLevelFor(startingSum, currentSum) {
  const room = LEVEL_SUM_TOP - startingSum;
  if (!(room > 0)) return ONLINE_LEVEL_CAP;   // a start at the top has nothing left to climb
  const climbed = Math.min(currentSum - startingSum, room);
  const level = Math.floor((HEAD_START * room + CLIMB_SHARE * climbed) / (PER_LEVEL * room));
  return Math.max(1, Math.min(ONLINE_LEVEL_CAP, level));
}

/** How far into its level an online character stands, 0 to 1 (the level bar's fraction); 1 at the cap. */
export function onlineLevelFraction(startingSum, currentSum) {
  const room = LEVEL_SUM_TOP - startingSum;
  if (!(room > 0)) return 1;
  const exact = (HEAD_START + (CLIMB_SHARE * Math.min(currentSum - startingSum, room)) / room) / PER_LEVEL;
  return exact >= ONLINE_LEVEL_CAP ? 1 : exact - Math.floor(exact);
}

/** The climbed points at which level `level` begins (0 for level 1): the least `climbed` onlineLevelFor gives it at. */
const levelStart = (level, room) => Math.max(0, Math.ceil(((PER_LEVEL * level - HEAD_START) * room) / CLIMB_SHARE));

/** LEVEL-BAR (2026-10-27, mob: "800/45", "yessss"): the level bar in skill points - `now` of the `max` this level takes
 *  (about 16 at an average start). The level the sums earn; at the cap the bar is full. */
export function onlineLevelPoints(startingSum, currentSum) {
  const room = LEVEL_SUM_TOP - startingSum;
  const level = onlineLevelFor(startingSum, currentSum);
  if (!(room > 0) || level >= ONLINE_LEVEL_CAP) {
    const max = room > 0 ? levelStart(ONLINE_LEVEL_CAP, room) - levelStart(ONLINE_LEVEL_CAP - 1, room) : 1;
    return { now: max, max };
  }
  const climbed = Math.max(0, Math.min(currentSum - startingSum, room));
  const from = levelStart(level, room);
  return { now: climbed - from, max: levelStart(level + 1, room) - from };
}

/**
 * THE CONVERSION, on a save snapshot (realmCustoms.js crossLeveling runs it at every join and at customs). Moves the
 * start, the level, the stored maximum health and the owed level-up; skills, attributes and items are never touched.
 * Run again it changes nothing. Answers whether it moved anything.
 * @param {any} snap
 */
export function onlineLevelConvert(snap) {
  if (!snap || typeof snap !== 'object' || !snap.career || !Array.isArray(snap.skills)) return false;
  const live = levelUpSkillSum(snap);
  const current = Number.isFinite(snap.currentLevelUpSkillSum) && snap.currentLevelUpSkillSum >= live ? snap.currentLevelUpSkillSum : live;
  const start = Number.isFinite(snap.startingLevelUpSkillSum) && snap.startingLevelUpSkillSum >= ROLLED_START_MIN
    ? snap.startingLevelUpSkillSum : ROLLED_START_AVERAGE;
  const earned = onlineLevelFor(start, current);
  const level = Number.isFinite(snap.level) ? Math.trunc(snap.level) : 1;
  let moved = start !== snap.startingLevelUpSkillSum || current !== snap.currentLevelUpSkillSum;
  snap.startingLevelUpSkillSum = start;
  snap.currentLevelUpSkillSum = current;
  if (level > earned) {
    snap.level = earned;
    snap.readyToLevelUp = false;
    snap.pendingLevel = null;
    snap.pendingBonusPool = null;
    const floor = evenHpFloor({ career: snap.career, level: earned }, snap.stats?.endurance ?? NaN);
    if (floor > 0 && Number.isFinite(snap.maxHealth) && snap.maxHealth > floor) snap.maxHealth = floor;
    if (Number.isFinite(snap.health) && Number.isFinite(snap.maxHealth) && snap.health > snap.maxHealth) snap.health = snap.maxHealth;
    moved = true;
  }
  return moved;
}
