// Enemy visual/behaviour/entity basics (Characters C3, re-extracted
// E3a with combat fields). Generated from DFU's EnemyBasics.cs
// Enemies table (MIT, Daggerfall Workshop): textures + Behaviour
// (C3, byte-identical parity asserted at generation) + affinity,
// corpse texture, MinMetalToHit (material index, None=-1), monster
// damage pairs 1-3 + health/level/armor, soul points, team, loot key,
// flags.
// Class entries (128+) carry no health/level/damage - those come
// from the career (CLASS*.CFG) + FormulaHelper, per SetEnemyCareer.
// Do not hand-edit; regenerate: node tools/extract-enemy-basics.mjs
// TextManager.GetLocalizedEnemyName's en list (Internal_Strings en id
// 183, 62 entries): index = id for monsters 0..42, 43 + id - 128 for
// the class enemies.
//
// AUDIT 24 (wave 38): this table lived in systems/quest/foe.js, which
// already imports ENEMY_BASICS from here - so anything outside the
// quest machinery that wanted an enemy's NAME had to reach through it.
// EnemyDeath's "%s just died." and the pacification line both do, and
// neither is a quest. ONE DFU MEMBER, ONE EXPORT: the names live with
// the rows they name, and quest/foe.js re-exports them.
import { customCareerTemplate, customEnemyName } from './customEnemies.js';   // DEX1: an id past MobileTypes, by its registered career

export const ENEMY_NAMES = Object.freeze([
  'Rat', 'Imp', 'Spriggan', 'Giant Bat', 'Grizzly Bear',
  'Sabretooth Tiger', 'Spider', 'Orc', 'Centaur', 'Werewolf', 'Nymph',
  'Slaughterfish', 'Orc Sergeant', 'Harpy', 'Wereboar',
  'Skeletal Warrior', 'Giant', 'Zombie', 'Ghost', 'Mummy',
  'Giant Scorpion', 'Orc Shaman', 'Gargoyle', 'Wraith', 'Orc Warlord',
  'Frost Daedra', 'Fire Daedra', 'Daedroth', 'Vampire',
  'Daedra Seducer', 'Ancient Vampire', 'Daedra Lord', 'Lich',
  'Ancient Lich', 'Dragonling', 'Fire Atronach', 'Iron Atronach',
  'Flesh Atronach', 'Ice Atronach', 'Horse', 'Dragonling', 'Dreugh',
  'Lamia',
  'Mage', 'Spellsword', 'Battlemage', 'Sorcerer', 'Healer',
  'Nightblade', 'Bard', 'Burglar', 'Rogue', 'Acrobat', 'Thief',
  'Assassin', 'Monk', 'Archer', 'Ranger', 'Barbarian', 'Warrior',
  'Knight', 'City Watch',
]);

/** MobileBehaviour (DaggerfallUnityEnums.cs), by name and number - a row's `behaviour` is its name; the C# compares the
 *  ints (world/oceanHoles.js enemyRow). One home: the mods' readers parse by it (systems/enemyExpansion/dexTables.js). */
export const MOBILE_BEHAVIOUR = Object.freeze({ General: 0, Flying: 1, Aquatic: 2, Spectral: 3, Guard: 4 });

/** DaggerfallEntity.IsClassEnemyId (DaggerfallEntity.cs:974-977): the 128 bit. */
export const isClassEnemyId = (id) => (id & 128) !== 0;

/** A foe's level by its kind, as EnemyEntity.SetEnemyCareer sets it (EnemyEntity.cs:248-299): a monster's is its row's
 *  (MobileEnemy.Level, :262 and :284), a class's the level it is handed - the player's there (:272, :299), a party's on
 *  a road's trouble (systems/livingWorld/trouble.js `foeLevel`) - and the handed level where no row stands. One home:
 *  the streaming host's trouble world and the roads' harness (test/lwRoads.mjs) both read it - the harness's own copy
 *  still asked `>= 128` after DEX1 gave the host the bit (HOST-SPLIT, at DEX's merge). */
export const enemyLevelOf = (type, level) => (isClassEnemyId(type) ? level : ENEMY_BASICS[type]?.level ?? level);

/** A MobileTypes member that is an enemy: 0-42, 128-146 (Enum.IsDefined, None aside). */
export const isClassicEnemyId = (id) => Number.isInteger(id) && ((id >= 0 && id <= 42) || (id >= 128 && id <= 146));

/** DEX1: SetupDemoEnemy.ApplyEnemySettings's entity type (:160-185) - 0-42 a monster, 128-146 a class, any other id a
 *  monster or a class by the 128 bit when a mod registered its career (enemy/customEnemies.js), else no enemy at all
 *  (EntityTypes.None). 'monster' | 'class' | null. */
export function enemyEntityType(id) {
  if (!Number.isInteger(id)) return null;
  if (id >= 0 && id <= 42) return 'monster';
  if (id >= 128 && id <= 146) return 'class';
  return customCareerTemplate(id) ? (isClassEnemyId(id) ? 'class' : 'monster') : null;
}

/** DEX1: EnemyEntity.SetEnemyCareer's careerIndex (:248-296) - a custom enemy's is its id, a class's its id - 128, a
 *  monster's its id. The index DFU's career switches (OnMonsterHit, GetEnemyGroup, the spell lists) read. */
export function enemyCareerIndex(id) {
  if (customCareerTemplate(id)) return id;
  return enemyEntityType(id) === 'class' ? id - 128 : id;
}

/** DEX1: a mod's enemies joining the table - BestiaryMod.ParseCustomEnemies' `EnemyBasics.Enemies = enemies.ToArray()`
 *  (:1343), which every reader of the table then sees. A classic id is refused: a mod that edits a classic row edits the
 *  row (systems/enemyExpansion/dexInstall.js), it does not replace the table's own. Answers the rows written. */
export function registerEnemyRows(rows) {
  let n = 0;
  for (const [id, row] of rows) {
    if (!Number.isInteger(id) || isClassicEnemyId(id)) throw new Error(`registerEnemyRows: ${id} is not a mod's enemy id`);
    ENEMY_BASICS[String(id)] = row;
    n++;
  }
  return n;
}

/** GetLocalizedEnemyName's English, with the index law in one place. Rows
 *  carry no `name` field - reading one returns undefined, which is how
 *  the pacification line came to say "The enemy" to everybody.
 *
 *  L10N3e: this is the CANONICAL name - the fallback a display hands to
 *  the text core's getLocalizedEnemyName, which reads a translation's
 *  enemyNames row by the same MobileTypes id. A name that is shown goes
 *  through that lookup where it is shown; this one never changes with
 *  the language. */
export function enemyDisplayName(mobileType) {
  // DEX1: an id past MobileTypes is named as GetLocalizedEnemyName names it (TextManager.cs:443-460): the text
  // provider's custom name (a mod's), else its registered career's own Name, else none
  if (!isClassicEnemyId(mobileType)) {
    const t = customCareerTemplate(mobileType);
    return t ? (customEnemyName(mobileType) ?? (t.name || null)) : null;
  }
  const i = mobileType < 128 ? mobileType : 43 + mobileType - 128;
  return ENEMY_NAMES[i] ?? null;
}

// DEX1: the table itself is not frozen, as DFU's EnemyBasics.Enemies is not - a mod's enemies join it
// (registerEnemyRows) and a mod's edits are written over its rows, which every reader then sees (as RR1's
// enemyAppearance writes over them). Its classic rows are DFU's, generated; only a mod's install writes it.
export const ENEMY_BASICS = ({
 '0': {
  'maleTexture': 255,
  'femaleTexture': 255,
  'behaviour': 'General',
  'affinity': 'Animal',
  'corpseTexture': {
   'archive': 401,
   'record': 1
  },
  'minMetalToHit': -1,
  'minDamage': 1,
  'maxDamage': 4,
  'minHealth': 9,
  'maxHealth': 16,
  'level': 1,
  'armorValue': 6,
  'weight': 2,
  'mapChance': 0,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   4,
   5
  ],
  'team': 'Vermin',
  'moveSound': 115,
  'barkSound': 116,
  'attackSound': 117
 },
 '1': {
  'maleTexture': 256,
  'femaleTexture': 256,
  'behaviour': 'Flying',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 406,
   'record': 5
  },
  'minMetalToHit': 1,
  'minDamage': 2,
  'maxDamage': 15,
  'minHealth': 11,
  'maxHealth': 18,
  'level': 2,
  'armorValue': 3,
  'weight': 40,
  'mapChance': 1,
  'soulPts': 1000,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   1
  ],
  'spellAnimFrames': [
   0,
   1,
   2,
   3,
   1
  ],
  'team': 'Magic',
  'lootTableKey': 'D',
  'canOpenDoors': true,
  'seesThroughInvisibility': true,
  'moveSound': 118,
  'barkSound': 119,
  'attackSound': 120
 },
 '2': {
  'maleTexture': 257,
  'femaleTexture': 257,
  'behaviour': 'General',
  'affinity': 'Daylight',
  'corpseTexture': {
   'archive': 406,
   'record': 3
  },
  'minMetalToHit': -1,
  'minDamage': 1,
  'maxDamage': 8,
  'minDamage2': 1,
  'maxDamage2': 8,
  'minDamage3': 1,
  'maxDamage3': 10,
  'minHealth': 12,
  'maxHealth': 26,
  'level': 3,
  'armorValue': -4,
  'weight': 240,
  'mapChance': 0,
  'soulPts': 1000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   3,
   3
  ],
  'team': 'Spriggans',
  'lootTableKey': 'B',
  'canOpenDoors': true,
  'moveSound': 121,
  'barkSound': 122,
  'attackSound': 123
 },
 '3': {
  'maleTexture': 258,
  'femaleTexture': 258,
  'behaviour': 'Flying',
  'affinity': 'Animal',
  'corpseTexture': {
   'archive': 401,
   'record': 0
  },
  'minMetalToHit': -1,
  'minDamage': 2,
  'maxDamage': 12,
  'minHealth': 12,
  'maxHealth': 26,
  'level': 3,
  'armorValue': 6,
  'weight': 80,
  'mapChance': 0,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3
  ],
  'team': 'Vermin',
  'moveSound': 124,
  'barkSound': 125,
  'attackSound': 126
 },
 '4': {
  'maleTexture': 259,
  'femaleTexture': 259,
  'behaviour': 'General',
  'affinity': 'Animal',
  'corpseTexture': {
   'archive': 401,
   'record': 2
  },
  'minMetalToHit': -1,
  'minDamage': 1,
  'maxDamage': 8,
  'minDamage2': 1,
  'maxDamage2': 8,
  'minDamage3': 1,
  'maxDamage3': 10,
  'minHealth': 13,
  'maxHealth': 34,
  'level': 4,
  'armorValue': 6,
  'weight': 1000,
  'mapChance': 0,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   0
  ],
  'team': 'Bears',
  'moveSound': 127,
  'barkSound': 128,
  'attackSound': 129
 },
 '5': {
  'maleTexture': 260,
  'femaleTexture': 260,
  'behaviour': 'General',
  'affinity': 'Animal',
  'corpseTexture': {
   'archive': 401,
   'record': 3
  },
  'minMetalToHit': -1,
  'minDamage': 1,
  'maxDamage': 10,
  'minDamage2': 1,
  'maxDamage2': 10,
  'minDamage3': 3,
  'maxDamage3': 15,
  'minHealth': 13,
  'maxHealth': 34,
  'level': 4,
  'armorValue': 6,
  'weight': 1000,
  'mapChance': 0,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   4,
   5
  ],
  'team': 'Tigers',
  'moveSound': 130,
  'barkSound': 131,
  'attackSound': 132
 },
 '6': {
  'maleTexture': 261,
  'femaleTexture': 261,
  'behaviour': 'General',
  'affinity': 'Animal',
  'corpseTexture': {
   'archive': 401,
   'record': 4
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 13,
  'maxHealth': 34,
  'level': 4,
  'armorValue': 5,
  'weight': 400,
  'mapChance': 0,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   5
  ],
  'team': 'Spiders',
  'moveSound': 133,
  'barkSound': 134,
  'attackSound': 135
 },
 '7': {
  'maleTexture': 262,
  'femaleTexture': 262,
  'behaviour': 'General',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 96,
   'record': 2
  },
  'minMetalToHit': -1,
  'minDamage': 1,
  'maxDamage': 6,
  'minHealth': 13,
  'maxHealth': 34,
  'level': 5,
  'armorValue': 7,
  'weight': 600,
  'mapChance': 0,
  'soulPts': 1000,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   4,
   -1,
   5,
   0
  ],
  'team': 'Orcs',
  'lootTableKey': 'A',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 136,
  'barkSound': 137,
  'attackSound': 138
 },
 '8': {
  'maleTexture': 263,
  'femaleTexture': 263,
  'behaviour': 'General',
  'affinity': 'Daylight',
  'corpseTexture': {
   'archive': 406,
   'record': 0
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 14,
  'maxHealth': 46,
  'level': 5,
  'armorValue': 6,
  'weight': 1200,
  'mapChance': 1,
  'soulPts': 3000,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   1,
   1,
   2,
   -1,
   3,
   3,
   4
  ],
  'primaryAttackAnimFrames2': [
   0,
   1,
   1,
   1,
   2,
   -1,
   3,
   3,
   2,
   1,
   1,
   -1,
   2,
   3,
   3,
   4
  ],
  'team': 'Centaurs',
  'lootTableKey': 'C',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 139,
  'barkSound': 140,
  'attackSound': 141
 },
 '9': {
  'maleTexture': 264,
  'femaleTexture': 264,
  'behaviour': 'General',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 96,
   'record': 5
  },
  'minMetalToHit': 2,
  'minDamage': 1,
  'maxDamage': 10,
  'minDamage2': 1,
  'maxDamage2': 10,
  'minDamage3': 2,
  'maxDamage3': 12,
  'minHealth': 17,
  'maxHealth': 66,
  'level': 6,
  'armorValue': 5,
  'weight': 480,
  'mapChance': 0,
  'soulPts': 1000,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   -1,
   2
  ],
  'team': 'Werecreatures',
  'canOpenDoors': true,
  'moveSound': 142,
  'barkSound': 143,
  'attackSound': 144
 },
 '10': {
  'maleTexture': 265,
  'femaleTexture': 265,
  'behaviour': 'General',
  'affinity': 'Daylight',
  'corpseTexture': {
   'archive': 406,
   'record': 2
  },
  'minMetalToHit': 2,
  'minDamage': 1,
  'maxDamage': 5,
  'minHealth': 15,
  'maxHealth': 50,
  'level': 6,
  'armorValue': 0,
  'weight': 200,
  'mapChance': 1,
  'soulPts': 10000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   3,
   4,
   -1,
   5
  ],
  'team': 'Nymphs',
  'lootTableKey': 'C',
  'canOpenDoors': true,
  'moveSound': 145,
  'barkSound': 146,
  'attackSound': 147
 },
 '11': {
  'maleTexture': 266,
  'femaleTexture': 266,
  'behaviour': 'Aquatic',
  'affinity': 'Water',
  'corpseTexture': {
   'archive': 305,
   'record': 1
  },
  'minMetalToHit': -1,
  'minDamage': 2,
  'maxDamage': 12,
  'minHealth': 15,
  'maxHealth': 50,
  'level': 7,
  'armorValue': 6,
  'weight': 400,
  'mapChance': 0,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'primaryAttackAnimFrames': [
   0,
   -1,
   1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   0,
   3,
   -1,
   5,
   4,
   3,
   3,
   -1,
   5,
   4,
   3,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames3': [
   0,
   3,
   -1,
   5,
   0
  ],
  'team': 'Aquatic',
  'moveSound': 148,
  'barkSound': 149,
  'attackSound': 150
 },
 '12': {
  'maleTexture': 267,
  'femaleTexture': 267,
  'behaviour': 'General',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 96,
   'record': 2
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 15,
  'maxHealth': 50,
  'level': 7,
  'armorValue': 5,
  'weight': 600,
  'mapChance': 1,
  'soulPts': 1000,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   -1,
   1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   5,
   4,
   3,
   -1,
   2,
   1,
   0
  ],
  'team': 'Orcs',
  'lootTableKey': 'A',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 151,
  'barkSound': 152,
  'attackSound': 153
 },
 '13': {
  'maleTexture': 268,
  'femaleTexture': 268,
  'behaviour': 'Flying',
  'affinity': 'Daylight',
  'corpseTexture': {
   'archive': 406,
   'record': 4
  },
  'minMetalToHit': 4,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 16,
  'maxHealth': 85,
  'level': 8,
  'armorValue': 2,
  'weight': 200,
  'mapChance': 0,
  'soulPts': 3000,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3
  ],
  'team': 'Harpies',
  'lootTableKey': 'D',
  'canOpenDoors': true,
  'moveSound': 154,
  'barkSound': 155,
  'attackSound': 156
 },
 '14': {
  'maleTexture': 269,
  'femaleTexture': 269,
  'behaviour': 'General',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 96,
   'record': 5
  },
  'minMetalToHit': 2,
  'minDamage': 2,
  'maxDamage': 12,
  'minDamage2': 2,
  'maxDamage2': 12,
  'minDamage3': 5,
  'maxDamage3': 15,
  'minHealth': 17,
  'maxHealth': 66,
  'level': 8,
  'armorValue': 3,
  'weight': 560,
  'mapChance': 0,
  'soulPts': 1000,
  'primaryAttackAnimFrames': [
   0,
   -1,
   1,
   2,
   2
  ],
  'team': 'Werecreatures',
  'canOpenDoors': true,
  'moveSound': 157,
  'barkSound': 158,
  'attackSound': 159
 },
 '15': {
  'maleTexture': 270,
  'femaleTexture': 270,
  'behaviour': 'General',
  'affinity': 'Undead',
  'corpseTexture': {
   'archive': 306,
   'record': 1
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 17,
  'maxHealth': 66,
  'level': 9,
  'armorValue': 2,
  'weight': 80,
  'mapChance': 1,
  'bloodIndex': 2,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   3,
   -1,
   4,
   5
  ],
  'team': 'Undead',
  'lootTableKey': 'H',
  'canOpenDoors': true,
  'parrySounds': true,
  'seesThroughInvisibility': true,
  'moveSound': 160,
  'barkSound': 161,
  'attackSound': 162
 },
 '16': {
  'maleTexture': 271,
  'femaleTexture': 271,
  'behaviour': 'General',
  'affinity': 'Daylight',
  'corpseTexture': {
   'archive': 406,
   'record': 1
  },
  'minMetalToHit': -1,
  'minDamage': 10,
  'maxDamage': 30,
  'minHealth': 18,
  'maxHealth': 74,
  'level': 10,
  'armorValue': 3,
  'weight': 3000,
  'mapChance': 1,
  'soulPts': 3000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5
  ],
  'team': 'Giants',
  'lootTableKey': 'F',
  'canOpenDoors': true,
  'moveSound': 163,
  'barkSound': 164,
  'attackSound': 165
 },
 '17': {
  'maleTexture': 272,
  'femaleTexture': 272,
  'behaviour': 'General',
  'affinity': 'Undead',
  'corpseTexture': {
   'archive': 306,
   'record': 4
  },
  'minMetalToHit': -1,
  'minDamage': 15,
  'maxDamage': 50,
  'minHealth': 52,
  'maxHealth': 66,
  'level': 10,
  'armorValue': 0,
  'weight': 4000,
  'mapChance': 1,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   4
  ],
  'primaryAttackAnimFrames2': [
   0,
   2,
   -1,
   3,
   4
  ],
  'team': 'Undead',
  'lootTableKey': 'G',
  'canOpenDoors': true,
  'moveSound': 166,
  'barkSound': 167,
  'attackSound': 168
 },
 '18': {
  'maleTexture': 273,
  'femaleTexture': 273,
  'behaviour': 'Spectral',
  'affinity': 'Undead',
  'corpseTexture': {
   'archive': 306,
   'record': 0
  },
  'minMetalToHit': 2,
  'minDamage': 10,
  'maxDamage': 35,
  'minHealth': 17,
  'maxHealth': 66,
  'level': 11,
  'armorValue': 0,
  'weight': 0,
  'mapChance': 1,
  'soulPts': 30000,
  'bloodIndex': 2,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3
  ],
  'spellAnimFrames': [
   0,
   0,
   0,
   0,
   0,
   0
  ],
  'team': 'Undead',
  'lootTableKey': 'I',
  'canOpenDoors': true,
  'seesThroughInvisibility': true,
  'noShadow': true,
  'moveSound': 169,
  'barkSound': 170,
  'attackSound': 171
 },
 '19': {
  'maleTexture': 274,
  'femaleTexture': 274,
  'behaviour': 'General',
  'affinity': 'Undead',
  'corpseTexture': {
   'archive': 306,
   'record': 5
  },
  'minMetalToHit': 2,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 17,
  'maxHealth': 66,
  'level': 11,
  'armorValue': 2,
  'weight': 300,
  'mapChance': 1,
  'soulPts': 10000,
  'bloodIndex': 2,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   4
  ],
  'team': 'Undead',
  'lootTableKey': 'E',
  'canOpenDoors': true,
  'seesThroughInvisibility': true,
  'moveSound': 172,
  'barkSound': 173,
  'attackSound': 174
 },
 '20': {
  'maleTexture': 275,
  'femaleTexture': 275,
  'behaviour': 'General',
  'affinity': 'Animal',
  'corpseTexture': {
   'archive': 401,
   'record': 5
  },
  'minMetalToHit': -1,
  'minDamage': 15,
  'maxDamage': 25,
  'minHealth': 18,
  'maxHealth': 74,
  'level': 12,
  'armorValue': 0,
  'weight': 600,
  'mapChance': 0,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   3,
   2,
   1,
   0
  ],
  'team': 'Scorpions',
  'moveSound': 175,
  'barkSound': 176,
  'attackSound': 177
 },
 '21': {
  'maleTexture': 276,
  'femaleTexture': 276,
  'behaviour': 'General',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 96,
   'record': 2
  },
  'minMetalToHit': -1,
  'minDamage': 2,
  'maxDamage': 20,
  'minHealth': 18,
  'maxHealth': 74,
  'level': 13,
  'armorValue': 7,
  'weight': 400,
  'mapChance': 3,
  'soulPts': 3000,
  'chanceForAttack2': 20,
  'chanceForAttack3': 20,
  'chanceForAttack4': 20,
  'chanceForAttack5': 20,
  'hasIdle': true,
  'hasSpellAnimation': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   3,
   2,
   1,
   0
  ],
  'primaryAttackAnimFrames2': [
   0,
   -1,
   4,
   5,
   0
  ],
  'primaryAttackAnimFrames3': [
   0,
   1,
   -1,
   3,
   2,
   1,
   0,
   -1,
   4,
   5,
   0
  ],
  'primaryAttackAnimFrames4': [
   0,
   1,
   -1,
   3,
   2,
   -1,
   3,
   2,
   1,
   0
  ],
  'primaryAttackAnimFrames5': [
   0,
   -1,
   4,
   5,
   -1,
   4,
   5,
   0
  ],
  'spellAnimFrames': [
   0,
   0,
   1,
   2,
   3,
   3,
   3
  ],
  'team': 'Orcs',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 178,
  'barkSound': 179,
  'attackSound': 138
 },
 '22': {
  'maleTexture': 277,
  'femaleTexture': 277,
  'behaviour': 'General',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 96,
   'record': 1
  },
  'minMetalToHit': 5,
  'minDamage': 10,
  'maxDamage': 15,
  'minHealth': 19,
  'maxHealth': 82,
  'level': 14,
  'armorValue': 0,
  'weight': 300,
  'mapChance': 0,
  'soulPts': 3000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   2,
   1,
   2,
   3,
   -1,
   4,
   0
  ],
  'team': 'Magic',
  'canOpenDoors': true,
  'moveSound': 181,
  'barkSound': 182,
  'attackSound': 180
 },
 '23': {
  'maleTexture': 278,
  'femaleTexture': 278,
  'behaviour': 'Spectral',
  'affinity': 'Undead',
  'corpseTexture': {
   'archive': 306,
   'record': 0
  },
  'minMetalToHit': 2,
  'minDamage': 20,
  'maxDamage': 45,
  'minHealth': 30,
  'maxHealth': 90,
  'level': 15,
  'armorValue': 0,
  'weight': 0,
  'mapChance': 1,
  'soulPts': 30000,
  'bloodIndex': 2,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3
  ],
  'spellAnimFrames': [
   0,
   0,
   0,
   0,
   0
  ],
  'team': 'Undead',
  'lootTableKey': 'I',
  'canOpenDoors': true,
  'seesThroughInvisibility': true,
  'noShadow': true,
  'moveSound': 183,
  'barkSound': 184,
  'attackSound': 185
 },
 '24': {
  'maleTexture': 279,
  'femaleTexture': 279,
  'behaviour': 'General',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 96,
   'record': 2
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 50,
  'minHealth': 20,
  'maxHealth': 90,
  'level': 16,
  'armorValue': 0,
  'weight': 700,
  'mapChance': 2,
  'soulPts': 1000,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5
  ],
  'primaryAttackAnimFrames2': [
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames3': [
   0,
   1,
   -1,
   2,
   3,
   3,
   5,
   0,
   4,
   -1,
   5,
   0
  ],
  'team': 'Orcs',
  'lootTableKey': 'T',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 186,
  'barkSound': 187,
  'attackSound': 188
 },
 '25': {
  'maleTexture': 280,
  'femaleTexture': 280,
  'behaviour': 'General',
  'affinity': 'Daedra',
  'corpseTexture': {
   'archive': 400,
   'record': 3
  },
  'minMetalToHit': 5,
  'minDamage': 50,
  'maxDamage': 100,
  'minHealth': 25,
  'maxHealth': 130,
  'level': 17,
  'armorValue': -5,
  'weight': 800,
  'mapChance': 0,
  'soulPts': 50000,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   -1,
   4,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   -1,
   4,
   5,
   0
  ],
  'spellAnimFrames': [
   1,
   1,
   3,
   3
  ],
  'team': 'Daedra',
  'lootTableKey': 'J',
  'canOpenDoors': true,
  'parrySounds': true,
  'seesThroughInvisibility': true,
  'noShadow': true,
  'glowColor': {
   'r': 1.8,
   'g': 6.800000000000001,
   'b': 8.8,
   'a': 0.1
  },
  'moveSound': 189,
  'barkSound': 190,
  'attackSound': 191
 },
 '26': {
  'maleTexture': 281,
  'femaleTexture': 281,
  'behaviour': 'General',
  'affinity': 'Daedra',
  'corpseTexture': {
   'archive': 400,
   'record': 2
  },
  'minMetalToHit': 5,
  'minDamage': 15,
  'maxDamage': 50,
  'minHealth': 26,
  'maxHealth': 138,
  'level': 17,
  'armorValue': 1,
  'weight': 800,
  'mapChance': 0,
  'soulPts': 50000,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   -1,
   4
  ],
  'primaryAttackAnimFrames2': [
   3,
   -1,
   4
  ],
  'spellAnimFrames': [
   1,
   1,
   3,
   3
  ],
  'team': 'Daedra',
  'lootTableKey': 'J',
  'canOpenDoors': true,
  'parrySounds': true,
  'seesThroughInvisibility': true,
  'noShadow': true,
  'glowColor': {
   'r': 12.15,
   'g': 11.950000000000001,
   'b': 2.2,
   'a': 0.05
  },
  'moveSound': 192,
  'barkSound': 193,
  'attackSound': 194
 },
 '27': {
  'maleTexture': 282,
  'femaleTexture': 282,
  'behaviour': 'General',
  'affinity': 'Daedra',
  'corpseTexture': {
   'archive': 400,
   'record': 1
  },
  'minMetalToHit': 5,
  'minDamage': 15,
  'maxDamage': 50,
  'minHealth': 27,
  'maxHealth': 146,
  'level': 18,
  'armorValue': 1,
  'weight': 400,
  'mapChance': 0,
  'soulPts': 10000,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5
  ],
  'primaryAttackAnimFrames2': [
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames3': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0,
   4,
   -1,
   5,
   0
  ],
  'spellAnimFrames': [
   1,
   1,
   3,
   3
  ],
  'team': 'Daedra',
  'lootTableKey': 'E',
  'canOpenDoors': true,
  'parrySounds': true,
  'seesThroughInvisibility': true,
  'moveSound': 195,
  'barkSound': 196,
  'attackSound': 197
 },
 '28': {
  'maleTexture': 283,
  'femaleTexture': 283,
  'behaviour': 'General',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 96,
   'record': 3
  },
  'minMetalToHit': 2,
  'minDamage': 20,
  'maxDamage': 50,
  'minHealth': 28,
  'maxHealth': 154,
  'level': 19,
  'armorValue': -2,
  'weight': 400,
  'mapChance': 3,
  'soulPts': 70000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   3,
   -1,
   4,
   5
  ],
  'spellAnimFrames': [
   1,
   1,
   5,
   5
  ],
  'team': 'Undead',
  'lootTableKey': 'Q',
  'canOpenDoors': true,
  'seesThroughInvisibility': true,
  'noShadow': true,
  'moveSound': 198,
  'barkSound': 199,
  'attackSound': 200
 },
 '29': {
  'maleTexture': 284,
  'femaleTexture': 284,
  'behaviour': 'General',
  'affinity': 'Daedra',
  'corpseTexture': {
   'archive': 400,
   'record': 6
  },
  'minMetalToHit': 5,
  'minDamage': 15,
  'maxDamage': 50,
  'minHealth': 27,
  'maxHealth': 146,
  'level': 19,
  'armorValue': 1,
  'weight': 200,
  'mapChance': 1,
  'soulPts': 150000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2
  ],
  'spellAnimFrames': [
   0,
   1,
   2
  ],
  'seducerTransform1Frames': [
   0,
   1,
   2,
   3,
   4,
   5,
   6,
   7,
   8
  ],
  'seducerTransform2Frames': [
   0,
   1,
   2,
   3,
   4,
   5,
   6,
   7,
   8
  ],
  'team': 'Daedra',
  'lootTableKey': 'Q',
  'canOpenDoors': true,
  'seesThroughInvisibility': true,
  'hasSeducerTransform1': true,
  'hasSeducerTransform2': true,
  'moveSound': 201,
  'barkSound': 202,
  'attackSound': 203
 },
 '30': {
  'maleTexture': 285,
  'femaleTexture': 285,
  'behaviour': 'General',
  'affinity': 'Darkness',
  'corpseTexture': {
   'archive': 96,
   'record': 3
  },
  'minMetalToHit': 5,
  'minDamage': 20,
  'maxDamage': 60,
  'minHealth': 30,
  'maxHealth': 170,
  'level': 20,
  'armorValue': -5,
  'weight': 400,
  'mapChance': 3,
  'soulPts': 100000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   3,
   -1,
   4,
   5
  ],
  'spellAnimFrames': [
   1,
   1,
   5,
   5
  ],
  'team': 'Undead',
  'lootTableKey': 'Q',
  'canOpenDoors': true,
  'seesThroughInvisibility': true,
  'noShadow': true,
  'moveSound': 204,
  'barkSound': 205,
  'attackSound': 206
 },
 '31': {
  'maleTexture': 286,
  'femaleTexture': 286,
  'behaviour': 'General',
  'affinity': 'Daedra',
  'corpseTexture': {
   'archive': 400,
   'record': 4
  },
  'minMetalToHit': 5,
  'minDamage': 15,
  'maxDamage': 50,
  'minHealth': 35,
  'maxHealth': 210,
  'level': 20,
  'armorValue': -10,
  'weight': 1000,
  'mapChance': 0,
  'soulPts': 800000,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   -1,
   4
  ],
  'primaryAttackAnimFrames2': [
   3,
   -1,
   4,
   0,
   -1,
   4,
   3,
   -1,
   4,
   0,
   -1,
   4,
   3
  ],
  'primaryAttackAnimFrames3': [
   0,
   1,
   -1,
   2,
   1,
   0,
   1,
   -1,
   2,
   1,
   0
  ],
  'spellAnimFrames': [
   1,
   1,
   3,
   3
  ],
  'team': 'Daedra',
  'lootTableKey': 'S',
  'canOpenDoors': true,
  'parrySounds': true,
  'seesThroughInvisibility': true,
  'moveSound': 207,
  'barkSound': 208,
  'attackSound': 209
 },
 '32': {
  'maleTexture': 287,
  'femaleTexture': 287,
  'behaviour': 'General',
  'affinity': 'Undead',
  'corpseTexture': {
   'archive': 306,
   'record': 2
  },
  'minMetalToHit': 5,
  'minDamage': 70,
  'maxDamage': 100,
  'minHealth': 30,
  'maxHealth': 170,
  'level': 20,
  'armorValue': -10,
  'weight': 300,
  'mapChance': 4,
  'soulPts': 100000,
  'bloodIndex': 2,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   1,
   2,
   -1,
   3,
   4,
   4
  ],
  'spellAnimFrames': [
   0,
   1,
   2,
   3,
   4
  ],
  'team': 'Undead',
  'lootTableKey': 'S',
  'canOpenDoors': true,
  'seesThroughInvisibility': true,
  'moveSound': 210,
  'barkSound': 211,
  'attackSound': 212
 },
 '33': {
  'maleTexture': 288,
  'femaleTexture': 288,
  'behaviour': 'General',
  'affinity': 'Undead',
  'corpseTexture': {
   'archive': 306,
   'record': 3
  },
  'minMetalToHit': 5,
  'minDamage': 70,
  'maxDamage': 100,
  'minHealth': 30,
  'maxHealth': 170,
  'level': 21,
  'armorValue': -12,
  'weight': 300,
  'mapChance': 4,
  'soulPts': 250000,
  'bloodIndex': 2,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   1,
   2,
   -1,
   3,
   4,
   4
  ],
  'spellAnimFrames': [
   0,
   1,
   2,
   3,
   4
  ],
  'team': 'Undead',
  'lootTableKey': 'S',
  'canOpenDoors': true,
  'moveSound': 213,
  'barkSound': 214,
  'attackSound': 215
 },
 '34': {
  'maleTexture': 289,
  'femaleTexture': 289,
  'behaviour': 'Flying',
  'affinity': 'Daylight',
  'corpseTexture': {
   'archive': 96,
   'record': 0
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 14,
  'maxHealth': 42,
  'level': 16,
  'armorValue': 6,
  'weight': 10000,
  'mapChance': 0,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3
  ],
  'team': 'Dragonlings',
  'moveSound': 216,
  'barkSound': 217,
  'attackSound': 218
 },
 '35': {
  'maleTexture': 290,
  'femaleTexture': 290,
  'behaviour': 'General',
  'affinity': 'Golem',
  'corpseTexture': {
   'archive': 405,
   'record': 2
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 25,
  'maxHealth': 130,
  'level': 16,
  'armorValue': 6,
  'weight': 1000,
  'mapChance': 0,
  'soulPts': 30000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   -1,
   1,
   2,
   3,
   4
  ],
  'team': 'Magic',
  'canOpenDoors': true,
  'noShadow': true,
  'glowColor': {
   'r': 12.15,
   'g': 7.5,
   'b': 2.2,
   'a': 0.05
  },
  'moveSound': 219,
  'barkSound': 220,
  'attackSound': 221
 },
 '36': {
  'maleTexture': 291,
  'femaleTexture': 291,
  'behaviour': 'General',
  'affinity': 'Golem',
  'corpseTexture': {
   'archive': 405,
   'record': 1
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 25,
  'maxHealth': 130,
  'level': 16,
  'armorValue': 6,
  'weight': 1000,
  'mapChance': 0,
  'soulPts': 30000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   4
  ],
  'team': 'Magic',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 222,
  'barkSound': 223,
  'attackSound': 224
 },
 '37': {
  'maleTexture': 292,
  'femaleTexture': 292,
  'behaviour': 'General',
  'affinity': 'Golem',
  'corpseTexture': {
   'archive': 405,
   'record': 0
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 25,
  'maxHealth': 130,
  'level': 16,
  'armorValue': 6,
  'weight': 1000,
  'mapChance': 0,
  'soulPts': 30000,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   4
  ],
  'team': 'Magic',
  'canOpenDoors': true,
  'moveSound': 225,
  'barkSound': 226,
  'attackSound': 227
 },
 '38': {
  'maleTexture': 293,
  'femaleTexture': 293,
  'behaviour': 'General',
  'affinity': 'Golem',
  'corpseTexture': {
   'archive': 405,
   'record': 3
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 25,
  'maxHealth': 130,
  'level': 16,
  'armorValue': 6,
  'weight': 1000,
  'mapChance': 0,
  'soulPts': 30000,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   4
  ],
  'primaryAttackAnimFrames2': [
   0,
   -1,
   3,
   4
  ],
  'team': 'Magic',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 228,
  'barkSound': 229,
  'attackSound': 230
 },
 '39': {
  'maleTexture': 0,
  'femaleTexture': 0,
  'behaviour': 'General',
  'affinity': 'None',
  'minMetalToHit': 0,
  'team': 'PlayerEnemy'
 },
 '40': {
  'maleTexture': 295,
  'femaleTexture': 295,
  'behaviour': 'Flying',
  'affinity': 'Daylight',
  'corpseTexture': {
   'archive': 96,
   'record': 0
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 14,
  'maxHealth': 42,
  'level': 16,
  'armorValue': 6,
  'weight': 10000,
  'mapChance': 0,
  'soulPts': 500000,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3
  ],
  'team': 'Dragonlings',
  'moveSound': 216,
  'barkSound': 217,
  'attackSound': 218
 },
 '41': {
  'maleTexture': 296,
  'femaleTexture': 296,
  'behaviour': 'Aquatic',
  'affinity': 'Water',
  'corpseTexture': {
   'archive': 305,
   'record': 0
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 13,
  'maxHealth': 34,
  'level': 16,
  'armorValue': 6,
  'weight': 600,
  'mapChance': 0,
  'soulPts': 10000,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   3,
   -1,
   4,
   5,
   -1,
   6,
   7
  ],
  'primaryAttackAnimFrames2': [
   0,
   1,
   2,
   3,
   -1,
   4
  ],
  'primaryAttackAnimFrames3': [
   0,
   5,
   -1,
   6,
   7
  ],
  'team': 'Aquatic',
  'lootTableKey': 'R',
  'canOpenDoors': true,
  'moveSound': 237,
  'barkSound': 238,
  'attackSound': 239
 },
 '42': {
  'maleTexture': 297,
  'femaleTexture': 297,
  'behaviour': 'Aquatic',
  'affinity': 'Water',
  'corpseTexture': {
   'archive': 305,
   'record': 2
  },
  'minMetalToHit': -1,
  'minDamage': 5,
  'maxDamage': 15,
  'minHealth': 16,
  'maxHealth': 58,
  'level': 16,
  'armorValue': 6,
  'weight': 200,
  'mapChance': 0,
  'soulPts': 10000,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'primaryAttackAnimFrames': [
   0,
   -1,
   1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   0,
   3,
   -1,
   5,
   4,
   3,
   3,
   -1,
   5,
   4,
   3,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames3': [
   0,
   3,
   -1,
   5,
   0
  ],
  'team': 'Aquatic',
  'lootTableKey': 'R',
  'canOpenDoors': true,
  'moveSound': 240,
  'barkSound': 241,
  'attackSound': 242
 },
 '128': {
  'maleTexture': 486,
  'femaleTexture': 485,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 3,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasSpellAnimation': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   3,
   2,
   1,
   0,
   -1,
   5,
   4,
   0
  ],
  'primaryAttackAnimFrames2': [
   0,
   1,
   -1,
   3,
   2,
   1,
   0
  ],
  'primaryAttackAnimFrames3': [
   0,
   -1,
   5,
   4,
   0
  ],
  'spellAnimFrames': [
   0,
   1,
   2,
   3,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'castsMagic': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '129': {
  'maleTexture': 476,
  'femaleTexture': 475,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 1,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasSpellAnimation': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   5
  ],
  'primaryAttackAnimFrames2': [
   5,
   4,
   3,
   -1,
   2,
   1,
   0
  ],
  'primaryAttackAnimFrames3': [
   0,
   1,
   -1,
   2,
   2,
   1,
   0
  ],
  'spellAnimFrames': [
   0,
   1,
   2,
   3,
   3
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'P',
  'canOpenDoors': true,
  'parrySounds': true,
  'castsMagic': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '130': {
  'maleTexture': 490,
  'femaleTexture': 489,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 2,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasSpellAnimation': true,
  'hasRangedAttack1': true,
  'hasRangedAttack2': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   4,
   4,
   -1,
   5,
   0,
   0
  ],
  'primaryAttackAnimFrames3': [
   4,
   -1,
   5,
   0,
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'spellAnimFrames': [
   0,
   1,
   2,
   3,
   3
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'parrySounds': true,
  'castsMagic': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '131': {
  'maleTexture': 478,
  'femaleTexture': 477,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 3,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   2,
   -1,
   3,
   4,
   5
  ],
  'primaryAttackAnimFrames2': [
   4,
   5,
   -1,
   3,
   2,
   1,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '132': {
  'maleTexture': 486,
  'femaleTexture': 485,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 1,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasSpellAnimation': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   3,
   2,
   1,
   0,
   -1,
   5,
   4,
   0
  ],
  'primaryAttackAnimFrames2': [
   0,
   1,
   -1,
   3,
   2,
   1,
   0
  ],
  'primaryAttackAnimFrames3': [
   0,
   -1,
   5,
   4,
   0
  ],
  'spellAnimFrames': [
   0,
   1,
   2,
   3,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'castsMagic': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '133': {
  'maleTexture': 490,
  'femaleTexture': 489,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 1,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasSpellAnimation': true,
  'hasRangedAttack1': true,
  'hasRangedAttack2': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   4,
   4,
   -1,
   5,
   0,
   0
  ],
  'primaryAttackAnimFrames3': [
   4,
   -1,
   5,
   0,
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'spellAnimFrames': [
   0,
   1,
   2,
   3,
   3
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'Criminals',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'parrySounds': true,
  'castsMagic': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '134': {
  'maleTexture': 484,
  'femaleTexture': 483,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 2,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   4,
   4,
   -1,
   5,
   0,
   0
  ],
  'primaryAttackAnimFrames3': [
   4,
   -1,
   5,
   0,
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'O',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '135': {
  'maleTexture': 484,
  'femaleTexture': 483,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 1,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   4,
   4,
   -1,
   5,
   0,
   0
  ],
  'primaryAttackAnimFrames3': [
   4,
   -1,
   5,
   0,
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'Criminals',
  'lootTableKey': 'O',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '136': {
  'maleTexture': 480,
  'femaleTexture': 479,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 1,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   4,
   4,
   -1,
   5,
   0,
   0
  ],
  'primaryAttackAnimFrames3': [
   4,
   -1,
   5,
   0,
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'Criminals',
  'lootTableKey': 'O',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '137': {
  'maleTexture': 484,
  'femaleTexture': 483,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 0,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   4,
   4,
   -1,
   5,
   0,
   0
  ],
  'primaryAttackAnimFrames3': [
   4,
   -1,
   5,
   0,
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'O',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '138': {
  'maleTexture': 484,
  'femaleTexture': 483,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 2,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   4,
   4,
   -1,
   5,
   0,
   0
  ],
  'primaryAttackAnimFrames3': [
   4,
   -1,
   5,
   0,
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'Criminals',
  'lootTableKey': 'O',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '139': {
  'maleTexture': 480,
  'femaleTexture': 479,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 0,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'primaryAttackAnimFrames2': [
   4,
   4,
   -1,
   5,
   0,
   0
  ],
  'primaryAttackAnimFrames3': [
   4,
   -1,
   5,
   0,
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'Criminals',
  'lootTableKey': 'O',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '140': {
  'maleTexture': 488,
  'femaleTexture': 487,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 1,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   0,
   1,
   -1,
   2,
   2,
   1,
   0
  ],
  'primaryAttackAnimFrames2': [
   0,
   1,
   -1,
   2,
   3,
   4,
   5
  ],
  'primaryAttackAnimFrames3': [
   5,
   5,
   3,
   -1,
   2,
   1,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'T',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '141': {
  'maleTexture': 482,
  'femaleTexture': 481,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 0,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5
  ],
  'primaryAttackAnimFrames2': [
   3,
   4,
   -1,
   5,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'C',
  'canOpenDoors': true,
  'parrySounds': true,
  'prefersRanged': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '142': {
  'maleTexture': 482,
  'femaleTexture': 481,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 1,
  'chanceForAttack2': 50,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4,
   -1,
   5
  ],
  'primaryAttackAnimFrames2': [
   3,
   4,
   -1,
   5,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'C',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '143': {
  'maleTexture': 488,
  'femaleTexture': 487,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 0,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   0,
   1,
   -1,
   2,
   2,
   1,
   0
  ],
  'primaryAttackAnimFrames2': [
   0,
   1,
   -1,
   2,
   3,
   4,
   5
  ],
  'primaryAttackAnimFrames3': [
   5,
   5,
   3,
   -1,
   2,
   1,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'Criminals',
  'lootTableKey': 'T',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '144': {
  'maleTexture': 488,
  'femaleTexture': 487,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 0,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   0,
   1,
   -1,
   2,
   2,
   1,
   0
  ],
  'primaryAttackAnimFrames2': [
   0,
   1,
   -1,
   2,
   3,
   4,
   5
  ],
  'primaryAttackAnimFrames3': [
   5,
   5,
   3,
   -1,
   2,
   1,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'T',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '145': {
  'maleTexture': 488,
  'femaleTexture': 487,
  'behaviour': 'General',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 1,
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'hasIdle': true,
  'hasRangedAttack1': true,
  'primaryAttackAnimFrames': [
   0,
   0,
   1,
   -1,
   2,
   2,
   1,
   0
  ],
  'primaryAttackAnimFrames2': [
   0,
   1,
   -1,
   2,
   3,
   4,
   5
  ],
  'primaryAttackAnimFrames3': [
   5,
   5,
   3,
   -1,
   2,
   1,
   0
  ],
  'rangedAttackAnimFrames': [
   3,
   2,
   0,
   0,
   0,
   -1,
   1,
   1,
   2,
   3
  ],
  'team': 'KnightsAndMages',
  'lootTableKey': 'T',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 244,
  'attackSound': 245
 },
 '146': {
  'maleTexture': 399,
  'femaleTexture': 399,
  'behaviour': 'Guard',
  'affinity': 'Human',
  'corpseTexture': {
   'archive': 380,
   'record': 1
  },
  'minMetalToHit': 0,
  'mapChance': 0,
  'hasIdle': true,
  'primaryAttackAnimFrames': [
   0,
   1,
   -1,
   2,
   3,
   4
  ],
  'team': 'CityWatch',
  'canOpenDoors': true,
  'parrySounds': true,
  'moveSound': 243,
  'barkSound': 456,
  'attackSound': 245
 }
});

/** DEX1: THE TABLE AS DFU SHIPS IT - EnemyBasics.Enemies' own initializer, copied before any mod writes a row (this
 *  module's evaluation ends before an importer runs) and frozen to the leaf. For the readers a mod's edit must never
 *  reach: King's Gambit's roster is one for every client and the relay (bible/11-Multiplayer/Kings-Gambit.md, "the
 *  vanilla rows, never a mod's overlay"), and a client evaluating it after Daggerfall Enemy Expansion's Start wrote its
 *  classic rows would build another. */
const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };
export const VANILLA_ENEMY_BASICS = deepFreeze(structuredClone(ENEMY_BASICS));
