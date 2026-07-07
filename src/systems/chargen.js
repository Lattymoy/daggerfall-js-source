import { SKILLS, SKILL_COUNT } from './skills.js';

// Character creation (Systems S3). Verbatim ports from DFU
// StatsRollout.cs / SkillsRollout.cs / DaggerfallSkills.cs /
// FormulaHelper.cs (MIT, Daggerfall Workshop). This slice replaces
// the pre-chargen INTERIM player (maxHealth 50, flat skills 30,
// stats 50s) with the real rolled entity.
//
// Verbatim rules:
//   - stats: career base attribute + Range(0, 10+1) each;
//     bonus pool = Range(6, 14+1) free points
//   - skills: all 35 default to Range(3, 6+1); the career's 3 primary
//     = 28 + Range(0, 3+1); 3 major = 18 + ...; 6 minor = 13 + ...;
//     +6 distributable per skill group
//   - max health at level 1 = 25 + career.HitPointsPerLevel;
//     each level-up adds Range(hp/2, hp inclusive) + the endurance
//     modifier (floor(END/10) - 5), floored at 1 (classic seeds
//     DFRandom with the frame counter here - an arbitrary reseed;
//     our uniform slot matches the role, approved stance)
//   - reflexes default Average (2)
// INTERIM (loud): the UI distributes the bonus pools by hand; the
// headless policy spends each pool one point at a time into the
// LOWEST stat / lowest skill of its group so the character is
// classic-legal (pool exhausted). The chargen UI (UI arc) replaces
// the policy with the player's own choices.


export const CLASS_CAREERS = Object.freeze([
  'Mage', 'Spellsword', 'Battlemage', 'Sorcerer', 'Healer',
  'Nightblade', 'Bard', 'Burglar', 'Rogue', 'Acrobat', 'Thief',
  'Assassin', 'Monk', 'Archer', 'Ranger', 'Barbarian', 'Warrior',
  'Knight',
]);



// ---- StatsRollout constants + Reroll, verbatim ----
export const STAT_MIN_BONUS_ROLL = 0;
export const STAT_MAX_BONUS_ROLL = 10;
export const STAT_MIN_BONUS_POOL = 6;
export const STAT_MAX_BONUS_POOL = 14;
export const STAT_KEYS_ORDER = Object.freeze(['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck']);
const STAT_KEYS = STAT_KEYS_ORDER;

export function rollStats(career, rolls = Math.random) {
  const range = (lo, hi) => lo + Math.floor(rolls() * (hi + 1 - lo));   // inclusive, per the source comment
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = career[k] + range(STAT_MIN_BONUS_ROLL, STAT_MAX_BONUS_ROLL);
  const bonusPool = range(STAT_MIN_BONUS_POOL, STAT_MAX_BONUS_POOL);
  return { stats, bonusPool };
}

// ---- SkillsRollout constants + Reroll, verbatim ----
export const SKILL_DEFAULT_MIN = 3;
export const SKILL_DEFAULT_MAX = 6;
export const PRIMARY_SKILL_MIN = 28;
export const MAJOR_SKILL_MIN = 18;
export const MINOR_SKILL_MIN = 13;
export const SKILL_BONUS_ROLL_MAX = 3;
export const BONUS_POOL_PER_SKILL_GROUP = 6;

export function rollSkills(career, rolls = Math.random) {
  const range = (lo, hi) => lo + Math.floor(rolls() * (hi + 1 - lo));
  const skills = new Array(SKILL_COUNT);
  for (let i = 0; i < SKILL_COUNT; i++) skills[i] = range(SKILL_DEFAULT_MIN, SKILL_DEFAULT_MAX);
  for (const id of career.primarySkills) skills[id] = PRIMARY_SKILL_MIN + range(0, SKILL_BONUS_ROLL_MAX);
  for (const id of career.majorSkills) skills[id] = MAJOR_SKILL_MIN + range(0, SKILL_BONUS_ROLL_MAX);
  for (const id of career.minorSkills) skills[id] = MINOR_SKILL_MIN + range(0, SKILL_BONUS_ROLL_MAX);
  return { skills, groupPools: { primary: BONUS_POOL_PER_SKILL_GROUP, major: BONUS_POOL_PER_SKILL_GROUP, minor: BONUS_POOL_PER_SKILL_GROUP } };
}

// ---- Magicka (S4a), verbatim ----
// DFCareer.GetSpellPointMultiplier: (bitfield & 0x1C00) >> 8 ->
// {0: x3.00, 4: x2.00, 8: x1.75, 12: x1.50, 16: x1.00, 20: x0.50};
// FormulaHelper.SpellPoints = floor(INT x multiplier).
export const SPELL_POINT_MULTIPLIERS = Object.freeze({ 0: 3.0, 4: 2.0, 8: 1.75, 12: 1.5, 16: 1.0, 20: 0.5 });
export function spellPointMultiplier(abilityFlagsAndSpellPointsBitfield) {
  return SPELL_POINT_MULTIPLIERS[(abilityFlagsAndSpellPointsBitfield & 0x1C00) >> 8] ?? 1.0;
}
export const spellPoints = (intelligence, multiplier) => Math.floor(intelligence * multiplier);

// ---- FormulaHelper HP, verbatim ----
export const hitPointsModifier = (endurance) => Math.floor(endurance / 10) - 5;
export const rollMaxHealthLevel1 = (career) => 25 + career.hitPointsPerLevel;

export function hitPointsPerLevelUp(career, endurance, rolls = Math.random) {
  const minRoll = Math.trunc(career.hitPointsPerLevel / 2);
  const maxRoll = career.hitPointsPerLevel;
  let add = minRoll + Math.floor(rolls() * (maxRoll + 1 - minRoll));   // random_range_inclusive
  add += hitPointsModifier(endurance);
  return add < 1 ? 1 : add;
}

/** INTERIM headless pool policy (loud; the chargen UI replaces it):
 *  one point at a time into the lowest of the eligible set. */
export function spendPoolLowest(values, keysOrIds, pool) {
  let p = pool;
  while (p > 0) {
    let low = keysOrIds[0];
    for (const k of keysOrIds) if (values[k] < values[low]) low = k;
    values[low] += 1;
    p--;
  }
}

/**
 * Roll + apply the whole character onto the SHARED player entity
 * (mutates in place so every consumer sees it). Idempotent via
 * entity.chargenDone.
 */
export function createCharacter(playerEntity, career, careerIndex, { rolls = Math.random, name = career.name } = {}) {
  const { stats, bonusPool } = rollStats(career, rolls);
  spendPoolLowest(stats, STAT_KEYS, bonusPool);                        // INTERIM policy (the U2b flow replaces this path)
  const { skills, groupPools } = rollSkills(career, rolls);
  spendPoolLowest(skills, career.primarySkills, groupPools.primary);
  spendPoolLowest(skills, career.majorSkills, groupPools.major);
  spendPoolLowest(skills, career.minorSkills, groupPools.minor);
  return applyCharacter(playerEntity, career, careerIndex, { name, stats, skills, rolls });
}

/** Apply FINISHED chargen values (the U2b flow's hand-distributed
 *  stats/skills, or the headless roll above) onto the shared entity -
 *  the health/magicka/sum derivations live here ONCE. */
export function applyCharacter(playerEntity, career, careerIndex, { name = career.name, gender, stats, skills, rolls = Math.random } = {}) {
  const maxHealth = rollMaxHealthLevel1(career);
  const maxMagicka = spellPoints(stats.intelligence, spellPointMultiplier(career.abilityFlagsAndSpellPointsBitfield ?? 0x1000));   // absent bitfield -> x1.00
  Object.assign(playerEntity, {
    maxMagicka,
    magicka: maxMagicka,
    name,
    gender: gender ?? playerEntity.gender ?? 'male',
    career,
    careerIndex,
    level: 1,
    maxHealth,
    health: maxHealth,
    stats,
    skills,
    skillUses: new Array(SKILL_COUNT).fill(0),   // TallySkill counters (S3b consumes them)
    lastSkillCheckTime: 0,
    chargenDone: true,
  });
  // S3b: the level-up sums anchor at creation (SetCurrentLevelUpSkillSum
  // over the starting skills = the starting sum, verbatim).
  let sum = 0, lowMaj = Infinity, hiMin = -Infinity;
  for (const id of career.primarySkills) sum += skills[id];
  for (const id of career.majorSkills) { sum += skills[id]; if (skills[id] < lowMaj) lowMaj = skills[id]; }
  for (const id of career.minorSkills) if (skills[id] > hiMin) hiMin = skills[id];
  playerEntity.startingLevelUpSkillSum = sum - lowMaj + hiMin;
  playerEntity.currentLevelUpSkillSum = playerEntity.startingLevelUpSkillSum;
  return playerEntity;
}

