// @ts-check
// LEVEL-45 (2026-10-27, mob: "need to always be 45", "not let over leveling waste a player time", "everyone is
// converting"; the design in the project thread "Find my level fix"): ONLINE, EVERY CHARACTER'S TOP LEVEL IS 45, AND
// IT LANDS ON THE LAST POINT ITS SKILLS CAN CLIMB.
//
// Daggerfall levels on the sum of six skills (skills.js levelUpSkillSum: the three primaries, the two best majors, the
// best minor), one level for every 15 points it climbed since creation (advancement.js calculatePlayerLevel). Online
// the five masteries (masterSkills.js MASTERY_SLOTS, 2 / 2 / 1) all sit in those six, so the sum's top is
// 5 x EFFECTIVE_SKILL_MAX + 100 = 800 - but how far a character climbs to it depends on where its rolls started it, so
// the flat 15 gave a low roll 46 and a high one 44. Here the climb is shared out instead:
//
//     level = floor((28 + 647 * climbed / (800 - start)) / 15),  never above 45
//
// The 28 is Daggerfall's own head start (a new character is 28/15 of the way to level 2), and 647 = 45 x 15 - 28, so
// a start of 153 levels exactly as Daggerfall does and every start lands on 45.0 at 800 - never 44, never 46, and no
// point past the cap climbed for nothing. A DEPARTURE from FormulaHelper.CalculatePlayerLevel, online; offline (and
// Oblivion's leveling) is untouched.
//
// THE CONVERSION (onlineLevelConvert): every realm character's level is read again from its skills at its next join,
// beside LEVEL-ONLINE-3's switch (realmCustoms.js crossLeveling). A start no roll can give - the anchor an Oblivion
// character was given when it crossed (advancement.js levelUpSkillSumAnchor) - becomes the average roll's; a level
// above what its skills earn comes down to it, its health to the even floor of its class at that level (levelEven.js);
// a level its skills earned but it has not taken yet stays owed, for the level-up screen to give.

import { EFFECTIVE_SKILL_MAX, SKILL_SOFT_CAP } from './skillSoftcap.js';
import { MASTERY_SLOTS } from './masterSkills.js';
import { PRIMARY_SKILL_MIN, MAJOR_SKILL_MIN, MINOR_SKILL_MIN, BONUS_POOL_PER_SKILL_GROUP } from './chargen.js';
import { levelUpSkillSum } from './skills.js';
import { evenHpFloor } from './levelEven.js';

/** LEVEL-45: the highest level an online character reaches. */
export const ONLINE_LEVEL_CAP = 45;
/** The six-skill sum's top online: every mastery at the hard cap's effective value, the sixth at 100 (800). */
export const LEVEL_SUM_TOP = (MASTERY_SLOTS.primary + MASTERY_SLOTS.major + MASTERY_SLOTS.minor) * EFFECTIVE_SKILL_MAX + SKILL_SOFT_CAP;
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

/** The level a start and a current sum make online, 1 to ONLINE_LEVEL_CAP. Integer arithmetic, so 800 is exactly 45. */
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
