// Enemy visual/behaviour/entity basics (Characters C3, re-extracted
// E3a with combat fields). Generated from DFU's EnemyBasics.cs
// Enemies table (MIT, Daggerfall Workshop): textures + Behaviour
// (C3, byte-identical parity asserted at generation) + affinity,
// corpse texture, MinMetalToHit (material index, None=-1), monster
// damage pairs 1-3 + health/level/armor, team, loot key, flags.
// Class entries (128+) carry no health/level/damage - those come
// from the career (CLASS*.CFG) + FormulaHelper, per SetEnemyCareer.
// Do not hand-edit; regenerate: node tools/extract-enemy-basics.mjs
export const ENEMY_BASICS = Object.freeze({
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
  'team': 'Vermin'
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
  'team': 'Magic',
  'lootTableKey': 'D',
  'canOpenDoors': true
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
  'team': 'Spriggans',
  'lootTableKey': 'B',
  'canOpenDoors': true
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
  'team': 'Vermin'
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
  'team': 'Bears'
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
  'team': 'Tigers'
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
  'team': 'Spiders'
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
  'chanceForAttack2': 50,
  'team': 'Orcs',
  'lootTableKey': 'A',
  'canOpenDoors': true
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
  'chanceForAttack2': 50,
  'team': 'Centaurs',
  'lootTableKey': 'C',
  'canOpenDoors': true
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
  'team': 'Werecreatures',
  'canOpenDoors': true
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
  'team': 'Nymphs',
  'lootTableKey': 'C',
  'canOpenDoors': true
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
  'team': 'Aquatic'
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
  'chanceForAttack2': 50,
  'team': 'Orcs',
  'lootTableKey': 'A',
  'canOpenDoors': true
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
  'team': 'Harpies',
  'lootTableKey': 'D',
  'canOpenDoors': true
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
  'team': 'Werecreatures',
  'canOpenDoors': true
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
  'team': 'Undead',
  'lootTableKey': 'H',
  'canOpenDoors': true
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
  'team': 'Giants',
  'lootTableKey': 'F',
  'canOpenDoors': true
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
  'team': 'Undead',
  'lootTableKey': 'G',
  'canOpenDoors': true
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
  'team': 'Undead',
  'lootTableKey': 'I',
  'canOpenDoors': true
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
  'team': 'Undead',
  'lootTableKey': 'E',
  'canOpenDoors': true
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
  'team': 'Scorpions'
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
  'chanceForAttack2': 20,
  'chanceForAttack3': 20,
  'team': 'Orcs',
  'lootTableKey': 'U',
  'canOpenDoors': true
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
  'team': 'Magic',
  'canOpenDoors': true
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
  'team': 'Undead',
  'lootTableKey': 'I',
  'canOpenDoors': true
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
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'team': 'Orcs',
  'lootTableKey': 'T',
  'canOpenDoors': true
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
  'chanceForAttack2': 50,
  'team': 'Daedra',
  'lootTableKey': 'J',
  'canOpenDoors': true
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
  'chanceForAttack2': 50,
  'team': 'Daedra',
  'lootTableKey': 'J',
  'canOpenDoors': true
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
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'team': 'Daedra',
  'lootTableKey': 'E',
  'canOpenDoors': true
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
  'team': 'Undead',
  'lootTableKey': 'Q',
  'canOpenDoors': true
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
  'team': 'Daedra',
  'lootTableKey': 'Q',
  'canOpenDoors': true
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
  'team': 'Undead',
  'lootTableKey': 'Q',
  'canOpenDoors': true
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
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'team': 'Daedra',
  'lootTableKey': 'S',
  'canOpenDoors': true
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
  'team': 'Undead',
  'lootTableKey': 'S',
  'canOpenDoors': true
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
  'team': 'Undead',
  'lootTableKey': 'S',
  'canOpenDoors': true
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
  'team': 'Dragonlings'
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
  'team': 'Magic',
  'canOpenDoors': true
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
  'team': 'Magic',
  'canOpenDoors': true
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
  'team': 'Magic',
  'canOpenDoors': true
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
  'chanceForAttack2': 50,
  'team': 'Magic',
  'canOpenDoors': true
 },
 '39': {
  'maleTexture': 0,
  'femaleTexture': 0,
  'behaviour': 'General',
  'affinity': 'None',
  'minMetalToHit': 0
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
  'team': 'Dragonlings'
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
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'team': 'Aquatic',
  'lootTableKey': 'R',
  'canOpenDoors': true
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
  'chanceForAttack2': 33,
  'chanceForAttack3': 33,
  'team': 'Aquatic',
  'lootTableKey': 'R',
  'canOpenDoors': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'castsMagic': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'P',
  'canOpenDoors': true,
  'castsMagic': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'castsMagic': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'U',
  'canOpenDoors': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'castsMagic': true
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
  'team': 'Criminals',
  'lootTableKey': 'U',
  'canOpenDoors': true,
  'castsMagic': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'O',
  'canOpenDoors': true
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
  'team': 'Criminals',
  'lootTableKey': 'O',
  'canOpenDoors': true
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
  'team': 'Criminals',
  'lootTableKey': 'O',
  'canOpenDoors': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'O',
  'canOpenDoors': true
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
  'team': 'Criminals',
  'lootTableKey': 'O',
  'canOpenDoors': true
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
  'team': 'Criminals',
  'lootTableKey': 'O',
  'canOpenDoors': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'T',
  'canOpenDoors': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'C',
  'canOpenDoors': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'C',
  'canOpenDoors': true
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
  'team': 'Criminals',
  'lootTableKey': 'T',
  'canOpenDoors': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'T',
  'canOpenDoors': true
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
  'team': 'KnightsAndMages',
  'lootTableKey': 'T',
  'canOpenDoors': true
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
  'team': 'CityWatch',
  'canOpenDoors': true
 }
});
