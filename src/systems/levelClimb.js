// @ts-check
// LEVEL-45 online (2026-10-27, mob: "need to always be 45", "everyone is converting"; Port-Ledger A LEVEL-45).
// Daggerfall's 15 a level gave a low roll its last level early and a high one late. Online the climb from the start to
// the six-skill top (800) is shared out, so every start reaches 45 on its last point:
//     level = floor((28 + 647 * climbed / (800 - start)) / 15)        647 = 45 x 15 - 28
// A DEPARTURE from FormulaHelper.CalculatePlayerLevel. levelCap.js is the cap's leaf and offline's law; this reads it.
// onlineLevelConvert reads every realm character's level again at its join - the one place a level comes down; one owed
// is offered there through the level-up window and its points, or given whole to attributes already at their maximum.

import { EFFECTIVE_SKILL_MAX, SKILL_SOFT_CAP } from './skillSoftcap.js';
import { PRIMARY_SKILL_MIN, MAJOR_SKILL_MIN, MINOR_SKILL_MIN, BONUS_POOL_PER_SKILL_GROUP } from './chargen.js';
import { levelUpSkillSum } from './skills.js';
import { masterCappedSkill, skillCanPassCap } from './masterSkills.js';
import { evenHpFloor } from './levelEven.js';
import { LEVEL_CAP } from './levelCap.js';
import { STAT_KEYS_ORDER, MAX_STAT_VALUE } from './statMods.js';

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
/** The highest start a creation can give: every counted skill's best roll, each group's six points spent where the
 *  level sum reads them (169). A Project Legacy birth can add Hearth's three to three primaries and two counted majors. */
export const ROLLED_START_MAX = 3 * (PRIMARY_SKILL_MIN + 3) + BONUS_POOL_PER_SKILL_GROUP
  + 2 * (MAJOR_SKILL_MIN + 3) + BONUS_POOL_PER_SKILL_GROUP
  + MINOR_SKILL_MIN + 3 + BONUS_POOL_PER_SKILL_GROUP;
export const LEGACY_START_MAX = ROLLED_START_MAX + 5 * 3;

/** A newborn's skill sums the realm takes at its first save: a real creation's start, the same current and live sum,
 *  over one valid 3/3/6 career and all 35 skills. Online creation skips the biography; the six-hour skill check cannot
 *  run before realmBirth's first save. Project Legacy alone gets its Hearth allowance in the upper bound. */
export function birthSkillOk(save, { legacy = false } = {}) {
  const start = save?.startingLevelUpSkillSum;
  const max = legacy ? LEGACY_START_MAX : ROLLED_START_MAX;
  if (!(Number.isInteger(start) && start >= ROLLED_START_MIN && start <= max)) return false;
  const cur = save?.currentLevelUpSkillSum;
  if (cur !== start || !Array.isArray(save?.skills) || save.skills.length !== 35) return false;
  const c = save.career;
  if (!c || !Array.isArray(c.primarySkills) || c.primarySkills.length !== 3
    || !Array.isArray(c.majorSkills) || c.majorSkills.length !== 3
    || !Array.isArray(c.minorSkills) || c.minorSkills.length !== 6) return false;
  const ids = [...c.primarySkills, ...c.majorSkills, ...c.minorSkills];
  if (new Set(ids).size !== 12 || ids.some((id) => !Number.isInteger(id) || id < 0 || id >= 35)) return false;
  let live;
  try { live = levelUpSkillSum(save); } catch { return false; }
  return live === start;
}

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

/** LEVEL-RAW: the skill sheet's points one counted point costs past 100 (2.5: 100 points climb 40). */
export const RAW_PER_POINT_PAST = (2 * SKILL_SOFT_CAP - SKILL_SOFT_CAP) / (EFFECTIVE_SKILL_MAX - SKILL_SOFT_CAP);

/** LEVEL-RAW ("show raw point to each level"): the bar in the sheet's own points - the counted span times the
 *  mean cost of the six counted skills still climbing (1 to 100, 2.5 past it), so ~38 a level at the masteries. */
export function onlineLevelRawPoints(entity) {
  const { now, max } = onlineLevelPoints(entity.startingLevelUpSkillSum ?? 0, entity.currentLevelUpSkillSum ?? 0);
  const rate = countedRate(entity);
  return { now: Math.round(now * rate), max: Math.max(1, Math.round(max * rate)) };
}

/** The mean raw cost of a counted point over the six skills the level reads (skills.js levelUpSkillSum's choice) that
 *  still climb - an unmastered skill at 100 waits for its mastery, so all six held there cost the mastery's 2.5. */
function countedRate(entity) {
  const c = entity.career, skills = entity.skills;
  if (!c || !skills) return 1;
  const at = (id) => ({ id, v: masterCappedSkill(entity, skills[id] ?? 0, id) });
  const majors = (c.majorSkills ?? []).map(at).sort((x, y) => y.v - x.v).slice(0, 2);
  const minors = (c.minorSkills ?? []).map(at).sort((x, y) => y.v - x.v).slice(0, 1);
  const six = [...(c.primarySkills ?? []).map(at), ...majors, ...minors];
  const climbing = six.filter(({ id, v }) => v < SKILL_SOFT_CAP || (v < 2 * SKILL_SOFT_CAP && skillCanPassCap(entity, id)));
  if (!climbing.length) return six.some(({ v }) => v >= SKILL_SOFT_CAP) ? RAW_PER_POINT_PAST : 1;
  return climbing.reduce((t, { v }) => t + (v < SKILL_SOFT_CAP ? 1 : RAW_PER_POINT_PAST), 0) / climbing.length;
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
  } else if (level < earned && STAT_KEYS_ORDER.every((k) => (snap.stats?.[k] ?? 0) >= MAX_STAT_VALUE)) {
    // LEVEL-OWED ("not to those that are capped out naturaliy"): no point left to place, so the level is given here
    snap.level = earned;
    snap.readyToLevelUp = false;
    snap.pendingLevel = null;
    snap.pendingBonusPool = null;
    const floor = evenHpFloor({ career: snap.career, level: earned }, snap.stats.endurance);
    if (floor > 0 && Number.isFinite(snap.maxHealth) && snap.maxHealth < floor) snap.maxHealth = floor;
    moved = true;
  } else if (level < earned && snap.readyToLevelUp !== true) {   // LEVEL-OWED ("give the atribuit point"): the window offers it at the join
    snap.readyToLevelUp = true;
    snap.pendingLevel = level + 1;
    moved = true;
  }
  return moved;
}
