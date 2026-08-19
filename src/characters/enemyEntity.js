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
//     career's Speed attribute. E4a SHIPPED: monster careers load
//     from ENEMY{nnn}.CFG via loadMonsterCareer; the 50s stat block
//     is only the no-career fallback when a caller skips the load.
// Unity Random.Range slots are uniform rolls, as in DFU itself.
// Equipment (SetEnemyEquipment) and loot generation: E3b/E4.

export const KNIGHT_CITYWATCH_ID = 146;

/** Monster careers (E4a): ENEMY{nnn}.CFG records inside MONSTER.BSA,
 *  the SAME 74-byte ClassFile format (verbatim
 *  DaggerfallEntity.GetMonsterCareerTemplate -> MonsterFile.LoadMonster:
 *  name = ENEMY{monster:000}.CFG, record parsed by ClassFile). One BSA
 *  parse per session, careers cached by index. */
let _monsterBsa = null;
const _monsterCareers = new Map();
export async function loadMonsterCareer(careerIndex, fetchBytes) {
  const hit = _monsterCareers.get(careerIndex);
  if (hit) return hit;
  if (!_monsterBsa) {
    const { BsaFile } = await import('../formats/bsaFile.js');
    _monsterBsa = new BsaFile(await fetchBytes('MONSTER.BSA'));
  }
  const name = `ENEMY${String(careerIndex).padStart(3, '0')}.CFG`;
  const idx = _monsterBsa.getRecordIndex(name);
  if (idx === -1) return null;
  const { ClassFile } = await import('../formats/classFile.js');
  const cf = new ClassFile();
  cf.load(_monsterBsa.getRecordBytes(idx));
  _monsterCareers.set(careerIndex, cf.career);
  return cf.career;
}

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
  const stats = career
    ? {
        strength: career.strength, intelligence: career.intelligence,
        willpower: career.willpower, agility: career.agility,
        endurance: career.endurance, personality: career.personality,
        speed: career.speed, luck: career.luck,
      }
    : { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
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
    liveSpeed = career ? career.speed : 50;   // the ENEMY{nnn}.CFG career's Speed (E4a); 50 only when a caller skips the load
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
    basics,                               // MobileEnemy reference (multi-attack damage spans - audit F2)
    // stats.SetPermanentFromCareer: ALL EIGHT attributes ride the
    // career (audit F14 - savingThrow needs willpower, level-up needs
    // endurance). 50s only when a caller skips the career load.
    stats,
    // SetEntityDefaults: currentFatigue = MaxFatigue = (Str+End) x 64 (S15)
    fatigue: (stats.strength + stats.endurance) * 64,
    // AUDIT 21 F1: THE CAREER ITSELF. EnemyEntity.SetEnemyCareer keeps it -
    //     career = GetMonsterCareerTemplate((MonsterCareers)careerIndex);
    // and DaggerfallEntity.Career is what SavingThrow reads for all SEVEN
    // tolerance channels (FormulaHelper.cs:1478-1526) and what InflictPoison
    // checks for immunity (:1392-1395). This builder took `career` as an
    // argument, flattened exactly ONE field out of it, and dropped the rest,
    // so `target.career ?? {}` in spellcast.js and poisons.js resolved to an
    // empty object and EVERY enemy in the game read Normal tolerance to Fire,
    // Frost, Shock, Magic, Poison, Disease and Paralysis.
    //
    // Twenty of the 43 ENEMY*.CFG records in the shipping MONSTER.BSA carry
    // non-zero tolerance bytes. Measured on the real archive: a Fire Daedra
    // (immunityFlags 0x08) took full fire damage in 434 of 1000 rolls where
    // DFU returns zero in 1000 of 1000.
    career,
    attackModifierFlags: career ? career.attackModifierFlags : null,
    minMetalToHit: basics.minMetalToHit,
    team: basics.team ?? 'None',
    affinity: basics.affinity,
    name: isClass ? career.name : undefined,
  };
}
