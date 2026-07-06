// Enemy entity (E3a). Verbatim port of the SetEnemyCareer core
// (EnemyEntity.cs) + RollEnemyClassMaxHealth (FormulaHelper.cs)
// (MIT, Daggerfall Workshop):
//   MONSTERS (ID 0-42): predefined level, health Range(min, max+1),
//     ArmorValues all = ArmorValue * 5.
//   CLASS ENEMIES (ID 128+): careerIndex = ID - 128, career from
//     CLASS{careerIndex:00}.CFG; level = player level (city watch,
//     Knight_CityWatch ID 146, +Range(3,7)); maxHealth =
//     RollEnemyClassMaxHealth: base 10 + level rolls of
//     Range(1, hitPointsPerLevel + 1).
//   BOTH: every skill = min(100, level * 5 + 30); LiveSpeed = the
//     career's Speed attribute (monsters' careers pending the monster
//     career table - E4; monsters here use Speed 50 human-average,
//     FLAGGED, until GetMonsterCareerTemplate ports).
// Unity Random.Range slots are uniform rolls, as in DFU itself.
// Equipment (SetEnemyEquipment) and loot generation: E3b/E4.

export const KNIGHT_CITYWATCH_ID = 146;

export function rollEnemyClassMaxHealth(level, hitPointsPerLevel, rollFn = Math.random) {
  const baseHealth = 10;
  let maxHealth = baseHealth;
  for (let i = 0; i < level; i++) {
    maxHealth += 1 + Math.floor(rollFn() * hitPointsPerLevel);   // Range(1, hpPerLevel + 1)
  }
  return maxHealth;
}

export function skillsLevel(level) {
  const s = level * 5 + 30;
  return s > 100 ? 100 : s;
}

/**
 * @param mobileType numeric ID (monsters 0-42, classes 128+)
 * @param basics the ENEMY_BASICS entry
 * @param career parsed CLASS*.CFG career (class enemies) or null
 * @param playerLevel
 */
export function makeEnemyEntity(mobileType, basics, career, playerLevel, rollFn = Math.random) {
  const isClass = mobileType >= 128;
  let level, maxHealth, liveSpeed, armor;
  if (isClass) {
    level = playerLevel;
    if (mobileType === KNIGHT_CITYWATCH_ID) level += 3 + Math.floor(rollFn() * 4);   // Range(3, 7)
    maxHealth = rollEnemyClassMaxHealth(level, career.hitPointsPerLevel, rollFn);
    liveSpeed = career.speed;
    armor = 0;   // class armor comes from equipment (E3b: SetEnemyEquipment)
  } else {
    level = basics.level;
    maxHealth = basics.minHealth + Math.floor(rollFn() * (basics.maxHealth + 1 - basics.minHealth));   // Range(min, max+1)
    liveSpeed = 50;   // FLAGGED: monster careers (GetMonsterCareerTemplate) port in E4
    armor = (basics.armorValue ?? 0) * 5;
  }
  return {
    mobileType,
    isClass,
    isPlayer: false,
    careerIndex: isClass ? mobileType - 128 : mobileType,
    level,
    maxHealth,
    health: maxHealth,
    liveSpeed,
    armor,
    skills: skillsLevel(level),           // every skill, per SetEnemyCareer
    // stats from the career attributes (class); monster careers pend
    // GetMonsterCareerTemplate (E4) - 50s FLAGGED until then
    stats: isClass
      ? { strength: career.strength, agility: career.agility, luck: career.luck }
      : { strength: 50, agility: 50, luck: 50 },
    attackModifierFlags: isClass ? career.attackModifierFlags : null,   // monster careers E4
    minMetalToHit: basics.minMetalToHit,
    team: basics.team ?? 'None',
    affinity: basics.affinity,
    name: isClass ? career.name : undefined,
  };
}
