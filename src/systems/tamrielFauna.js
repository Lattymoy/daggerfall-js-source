// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA-BIOME (2026-10-24, bible/03-World/Tamriel-Biomes.md) - THE FAUNA PAST THE BAY: what each biome's wild is home to,
// as the encounter law rolls it.
//
// Daggerfall picks a wilderness foe from one of eighteen climate tables (RandomEncounters.cs, systems/encounters.js
// CLIMATE_TABLE): three for each climate family - the town at night, the wild by day, the wild by night - twenty mobile
// ids each, in the order of their level, so the roll's band about the player's level (ChooseRandomEnemy :1471-1507) meets
// the weak in the low slots and the strong in the high. Swamp, MountainWoods and Woodlands share one family: past the
// Bay that put orcs, centaurs and wereboars in Black Marsh and Vvardenfell. Here every biome
// (world/tamriel/tamrielBiomes.js) has its own three tables, read off its ROSTER - the creatures the lore sets in that
// country (the page's tables, each with its source):
//   - a roster entry is [id, rarity, classic]: a mobile id, how common it is there (C common, U uncommon, R rare, V very
//     rare - one slot at most), and for one of Daggerfall Enemy Expansion's creatures (ids 256 and up - its Wolf, Troll,
//     Goblin, Minotaur, Mudcrab, Boar, Mountain Lion, Land Dreugh, Ogre, Will-o'-wisp, Scamp, the Dwemer's Sphere and
//     Centurion) the classic creature that stands in for it while that mod is not loaded (none: it is left out);
//   - THE TABLE (faunaTable): slot i is met by players about level i + 1, so each slot draws, by a hash of the biome and
//     the slot, from the roster's monsters within SLOT_REACH levels of it - nearer weighed more, a rarer one less, one
//     already drawn less again - and from its people (class enemies: the player's own level) from CLASS_FROM up;
//   - the TOWN table (the band's first) is its province's: rats, dogs, its own thieves and its night things.
// The tables are ours (SCOPE1: DFO is its own game - Port-Doctrine's Scope), on DFU's door (characters/
// encounterTableDoor.js): one selector answers the biome tables' indices (BIOME_TABLE_BASE up), DEX's or the classic
// variant as the game loaded it, the same answer on every machine of a game.
// ═══════════════════════════════════════════════════════════════════
import { ENEMY_BASICS, isClassEnemyId } from '../characters/enemy/enemyBasics.js';
import { registerEncounterTableSelector, hasEncounterTableSelector } from '../characters/encounterTableDoor.js';
import { dexLoaded } from './enemyExpansion/dexSwitches.js';
import { BIOMES, tamrielBiomeAt } from '../world/tamriel/tamrielBiomes.js';

/** The first biome table's index - past DFU's 45 (0-44) and anything a mod adds beside them. */
export const BIOME_TABLE_BASE = 100;
/** A table's slots, as DFU's ("assume enemy lists of length 20"). */
export const SLOTS = 20;
/** A monster stands in a slot this many levels either side of the slot's own (slot i: level i + 1). */
export const SLOT_REACH = 4;
/** The people - class enemies, at the player's level - stand from this slot up (DFU's tables keep the first slots for
 *  the wild's small things). */
export const CLASS_FROM = 3;
/** How much a rarity weighs in a slot's draw. */
export const RARITY = Object.freeze({ C: 4, U: 2, R: 1, V: 0.5 });

/** Daggerfall Enemy Expansion's creatures' levels, as its MonsterBase.mdb.csv has them (the install appends them to
 *  ENEMY_BASICS; a table is made before any install) - held to the vendored file by the pins. */
export const DEX_LEVELS = Object.freeze({
  256: 2, 257: 12, 258: 4, 259: 8, 260: 1, 261: 16, 262: 5, 263: 10, 264: 15, 265: 6, 266: 3, 267: 3, 268: 6, 269: 15,
  270: 10, 271: 7, 272: 11, 273: 19, 274: 7, 276: 22, 277: 5, 278: 6, 279: 9, 280: 8, 281: 2, 282: 13, 283: 9, 284: 9,
  285: 6, 286: 8, 287: 13, 288: 5, 289: 5, 290: 10,
});
/** A mobile's level for the table's order; null for a class enemy (the player's level). */
export const faunaLevel = (id) => (isClassEnemyId(id) ? null : ENEMY_BASICS[id]?.level ?? DEX_LEVELS[id] ?? null);
/** Whether an id is Daggerfall Enemy Expansion's (its monsters 256-383, its classes 384 and up). */
export const isDexId = (id) => id >= 256;

// Mobile ids, by name, so the rosters read (DFU's MobileTypes; DEX's MonsterBase.mdb.csv and ClassBase.mdb.csv).
const M = Object.freeze({
  Rat: 0, Imp: 1, Spriggan: 2, GiantBat: 3, GrizzlyBear: 4, Sabertooth: 5, Spider: 6, Orc: 7, Centaur: 8, Werewolf: 9,
  Nymph: 10, OrcSergeant: 12, Harpy: 13, Wereboar: 14, Skeleton: 15, Giant: 16, Zombie: 17, Ghost: 18, Mummy: 19,
  GiantScorpion: 20, OrcShaman: 21, Gargoyle: 22, Wraith: 23, OrcWarlord: 24, FrostDaedra: 25, FireDaedra: 26,
  Daedroth: 27, Vampire: 28, Seducer: 29, VampireAncient: 30, Lich: 32, AncientLich: 33, FireAtronach: 35,
  IronAtronach: 36, IceAtronach: 38, Dreugh: 41, Lamia: 42,
  // classes
  Mage: 128, Spellsword: 129, Battlemage: 130, Sorcerer: 131, Healer: 132, Nightblade: 133, Bard: 134, Burglar: 135,
  Rogue: 136, Acrobat: 137, Thief: 138, Assassin: 139, Monk: 140, Archer: 141, Ranger: 142, Barbarian: 143, Warrior: 144,
  Knight: 145,
  // Daggerfall Enemy Expansion
  Goblin: 256, LizardMan: 258, LizardWarrior: 259, Wolf: 262, SnowWolf: 263, SkeletalSoldier: 266, Dog: 267,
  Minotaur: 269, BloodSpider: 271, Troll: 272, FadedGhost: 274, Ghoul: 277, Boar: 278, LandDreugh: 279,
  MountainLion: 280, Mudcrab: 281, Ogre: 282, Wisp: 283, IceGolem: 284, StoneGolem: 286, Scamp: 288, Sphere: 289,
  Centurion: 290,
  Druid: 384, RogueRider: 387, NecroAcolyte: 388, RogueDruid: 389, BountyHunter: 390, NecroGlaivier: 393,
  WitchDefender: 396, ArcherRider: 398,
});

// The classic stand-ins while DEX is not loaded, the same everywhere (a roster entry may name its own).
const STANDIN = Object.freeze({
  [M.Goblin]: M.Orc, [M.LizardMan]: null, [M.LizardWarrior]: null, [M.Wolf]: M.Sabertooth, [M.SnowWolf]: M.Sabertooth,
  [M.SkeletalSoldier]: M.Skeleton, [M.Dog]: M.Rat, [M.Minotaur]: M.Giant, [M.BloodSpider]: M.Spider, [M.Troll]: M.Giant,
  [M.FadedGhost]: M.Ghost, [M.Ghoul]: M.Zombie, [M.Boar]: M.GrizzlyBear, [M.LandDreugh]: M.Dreugh,
  [M.MountainLion]: M.Sabertooth, [M.Mudcrab]: M.Rat, [M.Ogre]: M.Giant, [M.Wisp]: M.Ghost, [M.IceGolem]: M.IceAtronach,
  [M.StoneGolem]: M.Gargoyle, [M.Scamp]: M.Imp, [M.Sphere]: M.IronAtronach, [M.Centurion]: M.IronAtronach,
  [M.Druid]: M.Ranger, [M.RogueRider]: M.Rogue, [M.NecroAcolyte]: M.Sorcerer, [M.RogueDruid]: M.Ranger,
  [M.BountyHunter]: M.Warrior, [M.NecroGlaivier]: M.Sorcerer, [M.WitchDefender]: M.Sorcerer, [M.ArcherRider]: M.Archer,
});

/** @typedef {[number, 'C'|'U'|'R'|'V']} Entry */
/** @typedef {{ day: Entry[], night: Entry[] }} Roster */
/** EACH BIOME'S ROSTER - by day and by night. The page's fauna tables name each creature's source. */
/** @type {Record<string, Roster>} */
export const ROSTERS = {
  // ── SKYRIM ──────────────────────────────────────────────────────────────────────────────────────────────────────
  skyrimFrozenCoast: {
    day: [[M.Rat, 'C'], [M.SnowWolf, 'C'], [M.Wolf, 'U'], [M.Sabertooth, 'U'], [M.GrizzlyBear, 'U'], [M.Mudcrab, 'U'],
      [M.Troll, 'U'], [M.IceGolem, 'R'], [M.Giant, 'R'], [M.Spriggan, 'R'], [M.Dreugh, 'R'], [M.IceAtronach, 'V'],
      [M.Barbarian, 'U'], [M.Warrior, 'U'], [M.Archer, 'R'], [M.Ranger, 'R']],
    night: [[M.GiantBat, 'C'], [M.SnowWolf, 'C'], [M.Skeleton, 'U'], [M.Mummy, 'U'], [M.Ghost, 'U'], [M.Werewolf, 'R'],
      [M.Wraith, 'R'], [M.Vampire, 'R'], [M.IceAtronach, 'R'], [M.FrostDaedra, 'V'], [M.AncientLich, 'V'],
      [M.Barbarian, 'U'], [M.Nightblade, 'R']],
  },
  skyrimTundra: {
    day: [[M.Rat, 'C'], [M.Wolf, 'C'], [M.Mudcrab, 'U'], [M.Sabertooth, 'U'], [M.GrizzlyBear, 'U'], [M.Spider, 'U'],
      [M.Giant, 'U'], [M.Spriggan, 'R'], [M.Troll, 'R'], [M.Harpy, 'R'], [M.Sphere, 'R'], [M.Centurion, 'V'],
      [M.Barbarian, 'U'], [M.Warrior, 'U'], [M.Archer, 'U'], [M.Bard, 'R']],
    night: [[M.GiantBat, 'C'], [M.Wolf, 'C'], [M.Skeleton, 'U'], [M.Mummy, 'U'], [M.Ghost, 'U'], [M.Werewolf, 'U'],
      [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Lich, 'V'], [M.AncientLich, 'V'], [M.Barbarian, 'U'], [M.Nightblade, 'R']],
  },
  skyrimPinewood: {
    day: [[M.Rat, 'C'], [M.Wolf, 'C'], [M.GrizzlyBear, 'C'], [M.Spider, 'U'], [M.Sabertooth, 'U'], [M.Spriggan, 'U'],
      [M.Mudcrab, 'U'], [M.Troll, 'R'], [M.Giant, 'R'], [M.Archer, 'U'], [M.Ranger, 'U'], [M.Rogue, 'R'], [M.Thief, 'R'],
      [M.Barbarian, 'R']],
    night: [[M.GiantBat, 'C'], [M.Wolf, 'C'], [M.Werewolf, 'U'], [M.Skeleton, 'U'], [M.Ghost, 'U'], [M.Wisp, 'U'],
      [M.Mummy, 'U'], [M.Vampire, 'R'], [M.Wraith, 'R'], [M.Lich, 'V'], [M.Thief, 'U'], [M.Assassin, 'R'],
      [M.Nightblade, 'R']],
  },
  skyrimReach: {
    day: [[M.Rat, 'C'], [M.Wolf, 'C'], [M.Sabertooth, 'U'], [M.GrizzlyBear, 'U'], [M.Harpy, 'U'], [M.Troll, 'U'],
      [M.Sphere, 'U'], [M.Spriggan, 'R'], [M.Giant, 'R'], [M.Centurion, 'R'], [M.Barbarian, 'C'], [M.Archer, 'U'],
      [M.Ranger, 'U'], [M.WitchDefender, 'R']],
    night: [[M.GiantBat, 'C'], [M.Wolf, 'C'], [M.Harpy, 'U'], [M.Skeleton, 'U'], [M.Mummy, 'U'], [M.Ghost, 'U'],
      [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Werewolf, 'R'], [M.Lich, 'V'], [M.Barbarian, 'U'], [M.WitchDefender, 'R']],
  },
  skyrimPeaks: {
    day: [[M.SnowWolf, 'C'], [M.Troll, 'U'], [M.Sabertooth, 'U'], [M.IceGolem, 'U'], [M.Giant, 'R'], [M.Harpy, 'R'],
      [M.IceAtronach, 'R'], [M.Barbarian, 'R']],
    night: [[M.SnowWolf, 'C'], [M.Troll, 'U'], [M.IceGolem, 'U'], [M.Mummy, 'U'], [M.Ghost, 'R'], [M.Wraith, 'R'],
      [M.IceAtronach, 'R'], [M.FrostDaedra, 'V'], [M.AncientLich, 'V']],
  },
  // ── HIGH ROCK past the Bay ──────────────────────────────────────────────────────────────────────────────────────
  highRockWrothgar: {
    day: [[M.Orc, 'C'], [M.OrcSergeant, 'U'], [M.OrcShaman, 'U'], [M.OrcWarlord, 'R'], [M.GrizzlyBear, 'U'],
      [M.Wolf, 'U'], [M.SnowWolf, 'R'], [M.Harpy, 'U'], [M.Giant, 'U'], [M.Goblin, 'U'], [M.Troll, 'R'], [M.Ogre, 'R'],
      [M.IceGolem, 'V'], [M.Barbarian, 'U']],
    night: [[M.GiantBat, 'C'], [M.Wolf, 'C'], [M.GrizzlyBear, 'U'], [M.Werewolf, 'U'], [M.Orc, 'U'], [M.SnowWolf, 'R'],
      [M.Ghost, 'R'], [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Troll, 'R']],
  },
  highRockRivenspire: {
    day: [[M.Rat, 'C'], [M.Wolf, 'C'], [M.GrizzlyBear, 'U'], [M.Spriggan, 'U'], [M.Harpy, 'U'], [M.Boar, 'U'],
      [M.Gargoyle, 'R'], [M.Imp, 'R'], [M.Dog, 'R'], [M.Archer, 'U'], [M.Rogue, 'U'], [M.Knight, 'R'],
      [M.WitchDefender, 'R'], [M.NecroAcolyte, 'R']],
    night: [[M.GiantBat, 'C'], [M.Wereboar, 'U'], [M.Werewolf, 'U'], [M.Zombie, 'U'], [M.Skeleton, 'U'], [M.Ghost, 'U'],
      [M.Wraith, 'U'], [M.Vampire, 'U'], [M.Ghoul, 'U'], [M.Gargoyle, 'R'], [M.VampireAncient, 'V'], [M.Lich, 'V'],
      [M.Nightblade, 'R']],
  },
  highRockGlenumbra: {
    day: [[M.Rat, 'C'], [M.Wolf, 'U'], [M.Boar, 'U'], [M.GrizzlyBear, 'U'], [M.Spriggan, 'U'], [M.Mudcrab, 'U'],
      [M.Nymph, 'R'], [M.Centaur, 'R'], [M.Harpy, 'R'], [M.Imp, 'R'], [M.Dreugh, 'R'], [M.Lamia, 'R'], [M.Knight, 'U'],
      [M.Archer, 'U'], [M.Ranger, 'U'], [M.Druid, 'R'], [M.Spellsword, 'R'], [M.WitchDefender, 'R']],
    night: [[M.GiantBat, 'C'], [M.Wereboar, 'U'], [M.Werewolf, 'U'], [M.Skeleton, 'U'], [M.Zombie, 'U'], [M.Ghost, 'U'],
      [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Wisp, 'R'], [M.Lich, 'V'], [M.Thief, 'R']],
  },
  // ── HAMMERFELL past the Bay ─────────────────────────────────────────────────────────────────────────────────────
  hammerfellAlikr: {
    day: [[M.Rat, 'C'], [M.GiantScorpion, 'C'], [M.Sabertooth, 'U'], [M.Harpy, 'U'], [M.Lamia, 'R'], [M.Giant, 'R'],
      [M.Nymph, 'V'], [M.Warrior, 'C'], [M.Barbarian, 'U'], [M.Archer, 'U'], [M.Spellsword, 'R'], [M.RogueRider, 'R'],
      [M.ArcherRider, 'R']],
    night: [[M.GiantBat, 'C'], [M.GiantScorpion, 'C'], [M.Mummy, 'C'], [M.Skeleton, 'U'], [M.SkeletalSoldier, 'U'],
      [M.Ghost, 'U'], [M.Wraith, 'R'], [M.Lamia, 'R'], [M.Vampire, 'R'], [M.FireAtronach, 'V'], [M.Rogue, 'U'],
      [M.Assassin, 'R']],
  },
  hammerfellCraglorn: {
    day: [[M.Rat, 'C'], [M.GiantScorpion, 'C'], [M.Harpy, 'U'], [M.Sabertooth, 'U'], [M.Giant, 'U'], [M.Sphere, 'U'],
      [M.Ogre, 'R'], [M.Centurion, 'R'], [M.Goblin, 'R'], [M.Troll, 'R'], [M.Warrior, 'U'], [M.Barbarian, 'U'],
      [M.Archer, 'R']],
    night: [[M.GiantBat, 'C'], [M.GiantScorpion, 'U'], [M.Mummy, 'U'], [M.Skeleton, 'U'], [M.Ghost, 'U'],
      [M.Wraith, 'R'], [M.FireAtronach, 'R'], [M.Vampire, 'R'], [M.Lich, 'V'], [M.Rogue, 'U']],
  },
  hammerfellCoast: {
    day: [[M.Rat, 'C'], [M.Dog, 'U'], [M.GiantScorpion, 'U'], [M.Sabertooth, 'U'], [M.Harpy, 'U'], [M.Lamia, 'U'],
      [M.Dreugh, 'U'], [M.Mudcrab, 'U'], [M.Nymph, 'R'], [M.Centaur, 'R'], [M.Warrior, 'U'], [M.Rogue, 'U'],
      [M.Thief, 'U'], [M.Spellsword, 'R'], [M.Bard, 'R']],
    night: [[M.GiantBat, 'C'], [M.Lamia, 'U'], [M.Dreugh, 'U'], [M.Skeleton, 'U'], [M.Mummy, 'U'], [M.Ghost, 'U'],
      [M.Werewolf, 'R'], [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Thief, 'U'], [M.Assassin, 'R']],
  },
  hammerfellDragontail: {
    day: [[M.Harpy, 'C'], [M.GiantScorpion, 'U'], [M.Sabertooth, 'U'], [M.Giant, 'U'], [M.Ogre, 'R'], [M.Troll, 'R'],
      [M.GrizzlyBear, 'R'], [M.Barbarian, 'U']],
    night: [[M.GiantBat, 'C'], [M.Harpy, 'U'], [M.Skeleton, 'U'], [M.Ghost, 'U'], [M.Wraith, 'R'], [M.Vampire, 'R'],
      [M.FireAtronach, 'V']],
  },
  // ── SUMMERSET ───────────────────────────────────────────────────────────────────────────────────────────────────
  summersetVineCoast: {
    day: [[M.Rat, 'C'], [M.Mudcrab, 'U'], [M.Dreugh, 'U'], [M.Spider, 'R'], [M.Nymph, 'R'], [M.Spriggan, 'R'],
      [M.Mage, 'U'], [M.Spellsword, 'U'], [M.Battlemage, 'U'], [M.Knight, 'U'], [M.Archer, 'U'], [M.Sorcerer, 'R'],
      [M.Healer, 'R'], [M.Bard, 'R'], [M.Rogue, 'R']],
    night: [[M.GiantBat, 'C'], [M.Skeleton, 'U'], [M.Ghost, 'U'], [M.FadedGhost, 'U'], [M.Wisp, 'U'], [M.Wraith, 'R'],
      [M.Vampire, 'R'], [M.Lich, 'V'], [M.Seducer, 'V'], [M.Nightblade, 'R'], [M.Sorcerer, 'R']],
  },
  summersetAuridon: {
    day: [[M.Rat, 'C'], [M.Spider, 'U'], [M.Spriggan, 'U'], [M.Mudcrab, 'U'], [M.Dreugh, 'U'], [M.Nymph, 'R'],
      [M.Mage, 'U'], [M.Spellsword, 'U'], [M.Archer, 'U'], [M.Knight, 'U'], [M.Battlemage, 'R'], [M.Ranger, 'R']],
    night: [[M.GiantBat, 'C'], [M.Spider, 'U'], [M.Skeleton, 'U'], [M.Ghost, 'U'], [M.Wisp, 'U'], [M.FadedGhost, 'U'],
      [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Lich, 'V'], [M.Nightblade, 'R']],
  },
  summersetEtonNir: {
    day: [[M.Rat, 'U'], [M.Spider, 'U'], [M.Harpy, 'U'], [M.StoneGolem, 'R'], [M.Mage, 'U'], [M.Battlemage, 'U']],
    night: [[M.GiantBat, 'C'], [M.Ghost, 'U'], [M.Skeleton, 'U'], [M.Wraith, 'R'], [M.Lich, 'V'], [M.Sorcerer, 'R'],
      [M.Nightblade, 'R']],
  },
  // ── VALENWOOD ───────────────────────────────────────────────────────────────────────────────────────────────────
  valenwoodGrahtwood: {
    day: [[M.Rat, 'C'], [M.Spider, 'C'], [M.BloodSpider, 'U'], [M.Spriggan, 'U'], [M.Sabertooth, 'U'], [M.Centaur, 'R'],
      [M.Wolf, 'R'], [M.Ogre, 'R'], [M.Archer, 'C'], [M.Ranger, 'U'], [M.Acrobat, 'U'], [M.Thief, 'U'], [M.Druid, 'R'],
      [M.RogueDruid, 'R']],
    night: [[M.GiantBat, 'C'], [M.Spider, 'C'], [M.Werewolf, 'U'], [M.Wisp, 'U'], [M.Skeleton, 'U'], [M.Zombie, 'U'],
      [M.Ghost, 'U'], [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Lich, 'V'], [M.Nightblade, 'R'], [M.Assassin, 'R']],
  },
  valenwoodMalabal: {
    day: [[M.Rat, 'C'], [M.Spider, 'C'], [M.Spriggan, 'U'], [M.Wolf, 'U'], [M.Sabertooth, 'U'], [M.GrizzlyBear, 'R'],
      [M.Orc, 'R'], [M.Ogre, 'R'], [M.OrcShaman, 'V'], [M.Archer, 'U'], [M.Ranger, 'U']],
    night: [[M.GiantBat, 'C'], [M.Spider, 'C'], [M.Werewolf, 'U'], [M.Wisp, 'U'], [M.Skeleton, 'U'], [M.Ghost, 'U'],
      [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Lich, 'V']],
  },
  valenwoodCoast: {
    day: [[M.Rat, 'C'], [M.Mudcrab, 'C'], [M.Spider, 'U'], [M.Lamia, 'U'], [M.Dreugh, 'U'], [M.Spriggan, 'R'],
      [M.Sabertooth, 'R'], [M.Archer, 'U'], [M.Rogue, 'U'], [M.Acrobat, 'U']],
    night: [[M.GiantBat, 'C'], [M.Lamia, 'U'], [M.Dreugh, 'U'], [M.Zombie, 'U'], [M.Ghost, 'U'], [M.Skeleton, 'U'],
      [M.Werewolf, 'R'], [M.Vampire, 'R'], [M.Thief, 'U']],
  },
  valenwoodReapersMarch: {
    day: [[M.Rat, 'C'], [M.Sabertooth, 'C'], [M.Spider, 'U'], [M.Centaur, 'R'], [M.Archer, 'U'], [M.Monk, 'R'],
      [M.Acrobat, 'U'], [M.Thief, 'U']],
    night: [[M.GiantBat, 'C'], [M.Sabertooth, 'U'], [M.Werewolf, 'R'], [M.Skeleton, 'U'], [M.Zombie, 'U'],
      [M.Ghost, 'U'], [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Thief, 'U']],
  },
  // ── ELSWEYR ─────────────────────────────────────────────────────────────────────────────────────────────────────
  elsweyrAnequina: {
    day: [[M.Rat, 'C'], [M.GiantScorpion, 'C'], [M.Sabertooth, 'C'], [M.Harpy, 'U'], [M.Wolf, 'R'], [M.Troll, 'R'],
      [M.Monk, 'U'], [M.Acrobat, 'U'], [M.Thief, 'U'], [M.Warrior, 'U'], [M.RogueRider, 'R'], [M.ArcherRider, 'R']],
    night: [[M.GiantBat, 'C'], [M.GiantScorpion, 'U'], [M.Sabertooth, 'U'], [M.Mummy, 'U'], [M.Skeleton, 'U'],
      [M.Ghost, 'U'], [M.Wraith, 'U'], [M.Werewolf, 'R'], [M.Vampire, 'R'], [M.FireAtronach, 'V'], [M.Nightblade, 'R'],
      [M.Assassin, 'R']],
  },
  elsweyrPelletine: {
    day: [[M.Rat, 'C'], [M.Sabertooth, 'C'], [M.Spider, 'U'], [M.Dreugh, 'U'], [M.Mudcrab, 'U'], [M.Lamia, 'R'],
      [M.Spriggan, 'R'], [M.Thief, 'C'], [M.Acrobat, 'U'], [M.Monk, 'U'], [M.Bard, 'R']],
    night: [[M.GiantBat, 'C'], [M.Sabertooth, 'U'], [M.Spider, 'U'], [M.Zombie, 'U'], [M.Ghost, 'U'], [M.Wraith, 'R'],
      [M.Vampire, 'R'], [M.Werewolf, 'R'], [M.Thief, 'U'], [M.Assassin, 'U']],
  },
  elsweyrTenmar: {
    day: [[M.Rat, 'C'], [M.Sabertooth, 'C'], [M.Spider, 'C'], [M.BloodSpider, 'U'], [M.Spriggan, 'U'], [M.Lamia, 'R'],
      [M.Monk, 'U'], [M.Acrobat, 'U'], [M.Archer, 'U']],
    night: [[M.GiantBat, 'C'], [M.Spider, 'C'], [M.Sabertooth, 'U'], [M.Wisp, 'U'], [M.Zombie, 'U'], [M.Ghost, 'U'],
      [M.Werewolf, 'R'], [M.Wraith, 'R'], [M.Vampire, 'R']],
  },
  // ── BLACK MARSH ─────────────────────────────────────────────────────────────────────────────────────────────────
  blackMarshHist: {
    day: [[M.Rat, 'C'], [M.LizardMan, 'C'], [M.Spider, 'U'], [M.Lamia, 'U'], [M.Mudcrab, 'U'], [M.LizardWarrior, 'U'],
      [M.Spriggan, 'R'], [M.GiantScorpion, 'R'], [M.Wisp, 'R'], [M.Nightblade, 'U'], [M.Rogue, 'U'], [M.Acrobat, 'U'],
      [M.Assassin, 'R'], [M.Healer, 'R']],
    night: [[M.GiantBat, 'C'], [M.Zombie, 'C'], [M.Skeleton, 'U'], [M.Mummy, 'U'], [M.Ghost, 'U'], [M.Wraith, 'U'],
      [M.Wisp, 'U'], [M.Lamia, 'U'], [M.Ghoul, 'U'], [M.Vampire, 'R'], [M.Lich, 'V'], [M.Nightblade, 'U'],
      [M.Assassin, 'R']],
  },
  blackMarshFens: {
    day: [[M.Rat, 'C'], [M.Spider, 'U'], [M.Mudcrab, 'U'], [M.LizardMan, 'U'], [M.Lamia, 'U'], [M.GiantScorpion, 'R'],
      [M.Rogue, 'U'], [M.Nightblade, 'R'], [M.Archer, 'R'], [M.Warrior, 'R']],
    night: [[M.GiantBat, 'C'], [M.Zombie, 'C'], [M.Skeleton, 'U'], [M.Ghost, 'U'], [M.Wraith, 'U'], [M.Wisp, 'U'],
      [M.Lamia, 'U'], [M.Vampire, 'R'], [M.Lich, 'V'], [M.Nightblade, 'R']],
  },
  blackMarshMurkmire: {
    day: [[M.Rat, 'C'], [M.Mudcrab, 'C'], [M.Spider, 'U'], [M.BloodSpider, 'U'], [M.Lamia, 'U'], [M.Dreugh, 'U'],
      [M.LizardMan, 'U'], [M.LizardWarrior, 'R'], [M.Spriggan, 'R'], [M.Rogue, 'U'], [M.Acrobat, 'U'],
      [M.Nightblade, 'R']],
    night: [[M.GiantBat, 'C'], [M.Zombie, 'U'], [M.Lamia, 'U'], [M.Dreugh, 'U'], [M.Ghost, 'U'], [M.Wisp, 'U'],
      [M.Wraith, 'R'], [M.Vampire, 'R']],
  },
  // ── MORROWIND ───────────────────────────────────────────────────────────────────────────────────────────────────
  morrowindAshlands: {
    day: [[M.Rat, 'C'], [M.Scamp, 'U'], [M.Sphere, 'U'], [M.Centurion, 'R'], [M.FireAtronach, 'R'], [M.Daedroth, 'R'],
      [M.Barbarian, 'U'], [M.Nightblade, 'U'], [M.Battlemage, 'U'], [M.Archer, 'U'], [M.Monk, 'R'], [M.Sorcerer, 'R']],
    night: [[M.GiantBat, 'C'], [M.Ghost, 'C'], [M.Skeleton, 'U'], [M.Mummy, 'U'], [M.Zombie, 'R'], [M.Wraith, 'R'],
      [M.Daedroth, 'R'], [M.FireAtronach, 'R'], [M.Vampire, 'R'], [M.Seducer, 'V'], [M.Lich, 'V'], [M.Nightblade, 'U']],
  },
  morrowindBitterCoast: {
    day: [[M.Rat, 'C'], [M.Mudcrab, 'C'], [M.Dreugh, 'U'], [M.Scamp, 'R'], [M.Sphere, 'R'], [M.Nightblade, 'U'],
      [M.Rogue, 'U'], [M.Archer, 'R'], [M.Healer, 'R'], [M.Battlemage, 'R']],
    night: [[M.GiantBat, 'C'], [M.Ghost, 'C'], [M.Skeleton, 'U'], [M.Zombie, 'U'], [M.Dreugh, 'U'], [M.Mummy, 'R'],
      [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Lich, 'V'], [M.Nightblade, 'U'], [M.Assassin, 'R']],
  },
  morrowindDeshaan: {
    day: [[M.Rat, 'C'], [M.Spider, 'U'], [M.BloodSpider, 'U'], [M.Mudcrab, 'U'], [M.Scamp, 'U'], [M.Goblin, 'R'],
      [M.Daedroth, 'R'], [M.Nightblade, 'U'], [M.Battlemage, 'U'], [M.Healer, 'R'], [M.Knight, 'R'], [M.Assassin, 'R'],
      [M.Sorcerer, 'R']],
    night: [[M.GiantBat, 'C'], [M.Ghost, 'C'], [M.Skeleton, 'U'], [M.Mummy, 'U'], [M.Zombie, 'U'], [M.Wraith, 'R'],
      [M.Vampire, 'R'], [M.Daedroth, 'R'], [M.Seducer, 'V'], [M.Lich, 'V'], [M.Assassin, 'U']],
  },
  morrowindVelothi: {
    day: [[M.Goblin, 'U'], [M.Wolf, 'R'], [M.SnowWolf, 'R'], [M.GrizzlyBear, 'R'], [M.Troll, 'R'], [M.Sphere, 'R'],
      [M.Barbarian, 'U'], [M.Archer, 'U']],
    night: [[M.GiantBat, 'C'], [M.Ghost, 'U'], [M.Skeleton, 'U'], [M.Wraith, 'U'], [M.Troll, 'R'], [M.Vampire, 'R']],
  },
  morrowindVelothiFoot: {
    day: [[M.Rat, 'C'], [M.Goblin, 'U'], [M.Scamp, 'U'], [M.Sphere, 'R'], [M.Barbarian, 'U'], [M.Archer, 'U'],
      [M.Nightblade, 'R']],
    night: [[M.GiantBat, 'C'], [M.Ghost, 'C'], [M.Skeleton, 'U'], [M.Mummy, 'U'], [M.Wraith, 'R'], [M.Vampire, 'R']],
  },
  // ── CYRODIIL ────────────────────────────────────────────────────────────────────────────────────────────────────
  cyrodiilNibenay: {
    day: [[M.Rat, 'C'], [M.Imp, 'C'], [M.Spider, 'C'], [M.BloodSpider, 'U'], [M.MountainLion, 'U'], [M.Sabertooth, 'U'],
      [M.Spriggan, 'U'], [M.Minotaur, 'U'], [M.Goblin, 'U'], [M.Boar, 'U'], [M.Mudcrab, 'U'], [M.LandDreugh, 'R'],
      [M.Ogre, 'R'], [M.Troll, 'R'], [M.Centaur, 'R'], [M.Lamia, 'R'], [M.Rogue, 'U'], [M.Thief, 'U'], [M.Archer, 'U'],
      [M.Warrior, 'U'], [M.BountyHunter, 'R'], [M.NecroAcolyte, 'R'], [M.Knight, 'R'], [M.Battlemage, 'R']],
    night: [[M.GiantBat, 'C'], [M.Spider, 'C'], [M.MountainLion, 'U'], [M.Wisp, 'U'], [M.Skeleton, 'U'], [M.Zombie, 'U'],
      [M.Ghost, 'U'], [M.Wraith, 'U'], [M.Vampire, 'U'], [M.Lich, 'R'], [M.Werewolf, 'R'], [M.Daedroth, 'V'],
      [M.Nightblade, 'R'], [M.NecroGlaivier, 'R'], [M.Assassin, 'R']],
  },
  cyrodiilBlackwood: {
    day: [[M.Rat, 'C'], [M.Mudcrab, 'C'], [M.LandDreugh, 'U'], [M.Spider, 'U'], [M.LizardMan, 'U'], [M.Lamia, 'U'],
      [M.Imp, 'U'], [M.Spriggan, 'R'], [M.MountainLion, 'R'], [M.Rogue, 'U'], [M.Thief, 'U'], [M.Nightblade, 'R'],
      [M.Archer, 'R']],
    night: [[M.GiantBat, 'C'], [M.Zombie, 'U'], [M.Wisp, 'U'], [M.Lamia, 'U'], [M.LandDreugh, 'U'], [M.Ghost, 'U'],
      [M.Skeleton, 'U'], [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Lich, 'V']],
  },
  cyrodiilColovia: {
    day: [[M.Rat, 'C'], [M.MountainLion, 'C'], [M.Imp, 'U'], [M.Wolf, 'U'], [M.GrizzlyBear, 'U'], [M.Boar, 'U'],
      [M.Spider, 'U'], [M.Spriggan, 'U'], [M.Goblin, 'U'], [M.Minotaur, 'R'], [M.Ogre, 'R'], [M.Troll, 'R'],
      [M.Rogue, 'U'], [M.Archer, 'U'], [M.Warrior, 'U'], [M.Knight, 'R'], [M.BountyHunter, 'R'], [M.NecroAcolyte, 'R']],
    night: [[M.GiantBat, 'C'], [M.Wolf, 'C'], [M.MountainLion, 'U'], [M.Skeleton, 'U'], [M.Zombie, 'U'], [M.Ghost, 'U'],
      [M.Wraith, 'U'], [M.Vampire, 'U'], [M.Lich, 'R'], [M.Werewolf, 'R'], [M.Wisp, 'R'], [M.Nightblade, 'R'],
      [M.NecroGlaivier, 'R']],
  },
  cyrodiilGoldCoast: {
    day: [[M.Rat, 'C'], [M.MountainLion, 'C'], [M.Mudcrab, 'C'], [M.Imp, 'U'], [M.Boar, 'U'], [M.Wolf, 'U'],
      [M.Dreugh, 'U'], [M.LandDreugh, 'R'], [M.Spriggan, 'R'], [M.Goblin, 'R'], [M.Minotaur, 'R'], [M.Rogue, 'U'],
      [M.Thief, 'U'], [M.Archer, 'U'], [M.Warrior, 'U'], [M.Bard, 'R'], [M.Knight, 'R']],
    night: [[M.GiantBat, 'C'], [M.Wolf, 'U'], [M.MountainLion, 'U'], [M.Skeleton, 'U'], [M.Zombie, 'U'], [M.Ghost, 'U'],
      [M.Wraith, 'R'], [M.Vampire, 'R'], [M.Dreugh, 'R'], [M.Lich, 'V'], [M.Thief, 'U'], [M.Nightblade, 'R']],
  },
  cyrodiilJerall: {
    day: [[M.Wolf, 'C'], [M.SnowWolf, 'U'], [M.MountainLion, 'U'], [M.GrizzlyBear, 'U'], [M.Troll, 'U'], [M.Goblin, 'U'],
      [M.Ogre, 'R'], [M.Minotaur, 'R'], [M.Imp, 'R'], [M.IceGolem, 'R'], [M.Spriggan, 'R'], [M.Barbarian, 'U'],
      [M.Archer, 'U'], [M.Rogue, 'R']],
    night: [[M.GiantBat, 'C'], [M.Wolf, 'C'], [M.Troll, 'U'], [M.SnowWolf, 'U'], [M.Skeleton, 'U'], [M.Ghost, 'U'],
      [M.Wraith, 'U'], [M.Vampire, 'R'], [M.Werewolf, 'R'], [M.Lich, 'V'], [M.FrostDaedra, 'V']],
  },
};

/** EACH PROVINCE'S TOWN AT NIGHT (DFU's band's first: a location rect after dark) - its vermin, its thieves, its dead. */
/** @type {Record<string, Entry[]>} */
export const TOWN_ROSTERS = {
  Skyrim: [[M.Rat, 'C'], [M.Dog, 'U'], [M.GiantBat, 'U'], [M.Thief, 'U'], [M.Burglar, 'U'], [M.Barbarian, 'U'],
    [M.Ghost, 'R'], [M.Werewolf, 'R'], [M.Vampire, 'R'], [M.Nightblade, 'R']],
  HighRock: [[M.Rat, 'C'], [M.Dog, 'U'], [M.GiantBat, 'U'], [M.Thief, 'U'], [M.Burglar, 'U'], [M.Rogue, 'U'],
    [M.Wereboar, 'R'], [M.Ghost, 'R'], [M.Vampire, 'R'], [M.Assassin, 'R']],
  Hammerfell: [[M.Rat, 'C'], [M.Dog, 'U'], [M.GiantBat, 'U'], [M.Thief, 'U'], [M.Rogue, 'U'], [M.Burglar, 'R'],
    [M.Ghost, 'R'], [M.Vampire, 'R'], [M.Assassin, 'R']],
  Sumurset: [[M.Rat, 'C'], [M.GiantBat, 'U'], [M.Thief, 'R'], [M.Burglar, 'R'], [M.Mage, 'U'], [M.Nightblade, 'R'],
    [M.Ghost, 'R'], [M.Vampire, 'R']],
  Valenwood: [[M.Rat, 'C'], [M.GiantBat, 'U'], [M.Thief, 'U'], [M.Acrobat, 'U'], [M.Burglar, 'U'], [M.Werewolf, 'R'],
    [M.Ghost, 'R'], [M.Vampire, 'R']],
  Elsweyr: [[M.Rat, 'C'], [M.GiantBat, 'U'], [M.Thief, 'C'], [M.Acrobat, 'U'], [M.Burglar, 'U'], [M.Assassin, 'R'],
    [M.Ghost, 'R'], [M.Vampire, 'R']],
  BlackMarsh: [[M.Rat, 'C'], [M.GiantBat, 'U'], [M.Thief, 'U'], [M.Nightblade, 'U'], [M.Assassin, 'R'], [M.Zombie, 'R'],
    [M.Ghost, 'R'], [M.Vampire, 'R']],
  Morrowind: [[M.Rat, 'C'], [M.GiantBat, 'U'], [M.Thief, 'U'], [M.Nightblade, 'U'], [M.Assassin, 'U'], [M.Ghost, 'R'],
    [M.Vampire, 'R']],
  Imperial: [[M.Rat, 'C'], [M.Dog, 'U'], [M.GiantBat, 'U'], [M.Thief, 'U'], [M.Burglar, 'U'], [M.Rogue, 'U'],
    [M.Vampire, 'R'], [M.Ghost, 'R'], [M.Assassin, 'R']],
};

/** A small stable hash, 0..1, of a string and a number. */
function draw(text, n) {
  let h = 0x811c9dc5 ^ n;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
}

/** The roster as the game loaded it: DEX's creatures, or the classic one standing in for each (none: left out) - one entry
 *  a creature, at the commonest rarity it is named with (a stand-in the roster also names on its own is the one creature,
 *  its two weights not summed). Pure. */
export function rosterFor(entries, dex) {
  const out = new Map();
  for (const [id, r] of entries) {
    const as = dex || !isDexId(id) ? id : STANDIN[id];
    if (as == null) continue;
    const had = out.get(as);
    if (!had || RARITY[r] > RARITY[had]) out.set(as, r);
  }
  return [...out].map(([id, r]) => /** @type {Entry} */ ([id, r]));
}

/**
 * A ROSTER'S TABLE: twenty mobile ids, slot i drawn (by a hash of `salt` and i) from the monsters within SLOT_REACH
 * levels of i + 1 - each weighed by its rarity, over one plus half its distance in levels, over one plus the times it
 * stands already (a V once at most) - and the people (class enemies) from CLASS_FROM up. A slot no monster reaches and
 * the people may not stand in takes the roster's monster nearest its level. THE COVER: then every common and uncommon
 * monster the draw left out, commonest first, takes the slot in its reach nearest its level whose occupant stands twice
 * or more - so a country's own beasts are met there, and a draw's run of one creature does not crowd them out. Pure.
 * @param {Entry[]} entries @param {string} salt
 */
export function faunaTable(entries, salt) {
  const used = new Map();
  const out = [];
  for (let i = 0; i < SLOTS; i++) {
    const target = i + 1;
    const pool = [];
    let total = 0;
    for (const [id, r] of entries) {
      const n = used.get(id) ?? 0;
      if (r === 'V' && n) continue;
      const lv = faunaLevel(id);
      let w = RARITY[r] / (1 + n);
      if (lv == null) { if (i < CLASS_FROM) continue; } else {
        const off = Math.abs(lv - target);
        if (off > SLOT_REACH) continue;
        w /= 1 + off / 2;
      }
      pool.push([id, w]);
      total += w;
    }
    let pick;
    if (!pool.length) {
      let bd = Infinity;
      for (const [id, r] of entries) {
        const lv = faunaLevel(id);
        if (lv == null || (r === 'V' && used.get(id))) continue;
        const d = Math.abs(lv - target);
        if (d < bd) { bd = d; pick = id; }
      }
      pick ??= entries[0]?.[0] ?? 0;
    } else {
      let x = draw(salt, i) * total;
      pick = pool[pool.length - 1][0];
      for (const [id, w] of pool) { x -= w; if (x < 0) { pick = id; break; } }
    }
    out.push(pick);
    used.set(pick, (used.get(pick) ?? 0) + 1);
  }
  const cover = entries.filter(([id, r]) => (r === 'C' || r === 'U') && faunaLevel(id) != null && !used.get(id))
    .sort((a, b) => RARITY[b[1]] - RARITY[a[1]]);
  for (const [id] of cover) {
    const lv = /** @type {number} */ (faunaLevel(id));
    let at = -1, ad = Infinity;
    for (let i = 0; i < SLOTS; i++) {
      const d = Math.abs(lv - (i + 1));
      if (d > SLOT_REACH || (used.get(out[i]) ?? 0) < 2 || d >= ad) continue;
      at = i; ad = d;
    }
    if (at < 0) continue;
    used.set(out[at], used.get(out[at]) - 1);
    out[at] = id;
    used.set(id, 1);
  }
  return Object.freeze(out);
}

/** Each biome's band of table indices: [the town at night, the wild by day, the wild by night] - DFU's band's order. */
export const BIOME_BANDS = new Map(BIOMES.map((b, i) => [b.key, Object.freeze([BIOME_TABLE_BASE + 3 * i, BIOME_TABLE_BASE + 3 * i + 1, BIOME_TABLE_BASE + 3 * i + 2])]));
const BIOME_OF_INDEX = new Map();
BIOMES.forEach((b, i) => { for (let k = 0; k < 3; k++) BIOME_OF_INDEX.set(BIOME_TABLE_BASE + 3 * i + k, [b, k]); });

const _tables = new Map();
/** THE TABLE AT A BIOME INDEX, DEX's or the classic variant - null for an index that is no biome's. Kept. */
export function biomeTable(index, dex = dexLoaded()) {
  const at = BIOME_OF_INDEX.get(index);
  if (!at) return null;
  const key = `${index}:${dex ? 1 : 0}`;
  let t = _tables.get(key);
  if (!t) {
    const [b, k] = at;
    const entries = k === 0 ? TOWN_ROSTERS[b.province] : ROSTERS[b.key][k === 1 ? 'day' : 'night'];
    t = faunaTable(rosterFor(entries, dex), `${b.key}/${k}`);
    _tables.set(key, t);
  }
  return t;
}

/** THE BAND AT A MAP PIXEL - its biome's three indices past the Bay, null on the Bay (DFU's climate tables answer there)
 *  and at sea. What the encounter law's ctx carries as `fauna` (systems/encounters.js resolveEncounterTableIndex). */
export function faunaBandAt(px, py) {
  const b = tamrielBiomeAt(px, py);
  return b ? BIOME_BANDS.get(b.key) ?? null : null;
}

/** The door's selector: the biome tables' indices, as the game loaded DEX - the same table on every machine of a game. */
export const FAUNA_SELECTOR = Object.freeze({
  table: (index) => biomeTable(index),
  choices: (index) => { const t = biomeTable(index); return t ? [t] : null; },
});
/** Stand the selector on the door (once - a door reset, the tests' seam, asks again). */
export function installTamrielFauna() {
  if (!hasEncounterTableSelector(FAUNA_SELECTOR)) registerEncounterTableSelector(FAUNA_SELECTOR);
}
