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

export const CLASS_CAREERS = Object.freeze([
  'Mage', 'Spellsword', 'Battlemage', 'Sorcerer', 'Healer',
  'Nightblade', 'Bard', 'Burglar', 'Rogue', 'Acrobat', 'Thief',
  'Assassin', 'Monk', 'Archer', 'Ranger', 'Barbarian', 'Warrior',
  'Knight',
]);

/** DaggerfallUnityItem.GetWeaponSkillUsed -> skill id, by name. */
export const WEAPON_SKILL = Object.freeze({
  Dagger: SKILLS.ShortBlade, Tanto: SKILLS.ShortBlade, Wakazashi: SKILLS.ShortBlade, Shortsword: SKILLS.ShortBlade,
  Broadsword: SKILLS.LongBlade, Longsword: SKILLS.LongBlade, Saber: SKILLS.LongBlade,
  Katana: SKILLS.LongBlade, Claymore: SKILLS.LongBlade, 'Dai-Katana': SKILLS.LongBlade,
  'Battle Axe': SKILLS.Axe, 'War Axe': SKILLS.Axe,
  Staff: SKILLS.BluntWeapon, Mace: SKILLS.BluntWeapon, Flail: SKILLS.BluntWeapon, Warhammer: SKILLS.BluntWeapon,
  'Short Bow': SKILLS.Archery, 'Long Bow': SKILLS.Archery,
});

/** Skill read across both entity shapes: enemies carry the
 *  SetEnemyCareer FLAT number (every skill equal, verbatim); the
 *  player carries the rolled 35-array after chargen (and the flat
 *  interim before it). */
export function skillValue(entity, skillId) {
  const s = entity.skills;
  if (typeof s === 'number') return s;
  return s?.[skillId] ?? 0;
}

// ---- StatsRollout constants + Reroll, verbatim ----
export const STAT_MIN_BONUS_ROLL = 0;
export const STAT_MAX_BONUS_ROLL = 10;
export const STAT_MIN_BONUS_POOL = 6;
export const STAT_MAX_BONUS_POOL = 14;
const STAT_KEYS = ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck'];

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
  spendPoolLowest(stats, STAT_KEYS, bonusPool);                        // INTERIM policy
  const { skills, groupPools } = rollSkills(career, rolls);
  spendPoolLowest(skills, career.primarySkills, groupPools.primary);   // INTERIM policy
  spendPoolLowest(skills, career.majorSkills, groupPools.major);
  spendPoolLowest(skills, career.minorSkills, groupPools.minor);
  const maxHealth = rollMaxHealthLevel1(career);
  Object.assign(playerEntity, {
    name,
    career,
    careerIndex,
    level: 1,
    maxHealth,
    health: maxHealth,
    stats,
    skills,
    skillUses: new Array(SKILL_COUNT).fill(0),   // TallySkill counters (advancement math: follow-on slice)
    chargenDone: true,
  });
  return playerEntity;
}

/** TallySkill (the E3c flag clears): count a use toward advancement. */
export function tallySkill(entity, skillId, amount = 1) {
  if (!entity.skillUses) return;
  entity.skillUses[skillId] += amount;
}
