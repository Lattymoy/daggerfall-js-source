// @ts-check
// MEANER MONSTERS BESIDE DAGGERFALL ENEMY EXPANSION, OUR OWN DESIGN. Two tables in DEX's own formats, read by DEX's
// reader after its own when Meaner Monsters is on beside it (dexSwitches.js): monster lines over the rows as DEX
// leaves them, and dungeon courts beside DEX's defaults. No line moves a level, so every table's order, the
// provinces' wild (tamrielFauna.js) and the progression share stay DEX's. Every row is the rule's answer
// (meanerStats); test/systems/enemyExpansion/dexmeaner.test.js proves each one.

import { FOE_SHARE_FLOOR } from '../skillSoftcap.js';
import { MONSTER_SPELL_LISTS } from '../enemySpells.js';
import { CLASSIC_HIT_ARM } from '../diseases.js';

/** The bestiary's own average a level - 1.94 damage and 4.59 health, fitted through DFU's and DEX's 77 monsters as DEX
 *  leaves them - to the half. Past the newcomers no kind fights below it. */
export const MEANER_FLOOR = Object.freeze({ damage: 2, health: 4.5 });
/** A newcomer's foe: a level the progression share never scales (skillSoftcap.js FOE_SHARE_FLOOR). Its blow is held to
 *  the average instead, and its health is left. */
export const NEWCOMER_LEVEL = FOE_SHARE_FLOOR;
/** The on-hit arms that ready a spell or drain with the blow (diseases.js, dexCombat.js): Spider Touch, the fatigue drain,
 *  DEX's four spells. A kind with one fights by it, so the blow's floor passes it by, as a caster's does. */
export const TOUCH_ARMS = Object.freeze(new Set([3, 5, 10, 11, 12, 13]));

/** A kind's two traits the rule reads: a caster (DFU's thirteen spell lists, DEX's CastsMagic), a touch (TOUCH_ARMS). */
export const meanerTraits = (id, row, props = null) => ({
  casts: !!MONSTER_SPELL_LISTS[id] || row.castsMagic === true,
  touch: TOUCH_ARMS.has(CLASSIC_HIT_ARM[id] ?? props?.onHitEffect ?? 0),
});

/** Dice `lo`-`hi` moved to a mean of `mean`, both ends by one factor: up, or (`down`) never past it. */
function toMean(lo, hi, mean, down) {
  const a = Math.max(1, Math.round(lo * mean / ((lo + hi) / 2)));
  return [a, down ? Math.max(a, 2 * mean - a) : 2 * mean - a];
}

/** THE RULE over one monster's row as DEX leaves it: `{ damage, health }`, each [min, max] or null where it stays, or
 *  null where nothing moves. A newcomer's blow is cut to the floor; past it, a blow (not a caster's or a touch's) and
 *  health are raised to it. */
export function meanerStats(row, { casts = false, touch = false } = {}) {
  const level = row.level, blow = (row.minDamage + row.maxDamage) / 2, life = (row.minHealth + row.maxHealth) / 2;
  const dmg = MEANER_FLOOR.damage * level, hp = MEANER_FLOOR.health * level;
  let damage = null, health = null;
  if (level <= NEWCOMER_LEVEL) { if (blow > dmg) damage = toMean(row.minDamage, row.maxDamage, dmg, true); }
  else {
    if (!casts && !touch && blow < dmg) damage = toMean(row.minDamage, row.maxDamage, dmg, false);
    if (life < hp) health = toMean(row.minHealth, row.maxHealth, hp, false);
  }
  return damage || health ? { damage, health } : null;
}

/** The monster lines, [id, min damage, max damage, min health, max health] (null: DEX's stands) - the rule's answers. */
export const DEX_MEANER_MONSTERS = Object.freeze([
  [0, 1, 3, null, null],        // Rat, level 1: 1-4 (a newcomer's)
  [1, 1, 7, null, null],        // Imp, level 2: 2-15 (a newcomer's)
  [3, 2, 10, null, null],       // Giant Bat, level 3: 2-12 (a newcomer's)
  [6, 4, 12, null, null],       // Spider, level 4: 5-15 (a newcomer's)
  [7, 3, 17, null, null],       // Orc, level 5: 1-6 (the blow)
  [9, 4, 32, null, null],       // Werewolf, level 9: 2-16 (the blow)
  [11, 4, 24, null, null],      // Slaughterfish, level 7: 2-12 (the blow)
  [12, 7, 21, null, null],      // Orc Sergeant, level 7: 5-15 (the blow)
  [13, 8, 24, null, null],      // Harpy, level 8: 5-15 (the blow)
  [14, null, null, 20, 79],     // Wereboar, level 11: 17-66 (health)
  [15, 9, 27, null, null],      // Skeletal Warrior, level 9: 5-15 (the blow)
  [17, 10, 30, null, null],     // Zombie, level 10: 5-15 (the blow)
  [18, null, null, 20, 79],     // Ghost, level 11: 17-66 (health; a caster)
  [19, 11, 33, 20, 79],         // Mummy, level 11: 5-15, 17-66 (both)
  [20, null, null, 21, 87],     // Giant Scorpion, level 12: 18-74 (health; a touch)
  [21, null, null, 23, 94],     // Orc Shaman, level 13: 18-74 (health; a caster)
  [22, 22, 34, 24, 102],        // Gargoyle, level 14: 10-15, 19-82 (both)
  [23, null, null, 34, 101],    // Wraith, level 15: 30-90 (health; a caster)
  [24, 6, 58, 26, 118],         // Orc Warlord, level 16: 5-50, 20-90 (both)
  [34, 24, 48, null, null],     // Dragonling, level 18: 20-40 (the blow)
  [35, 17, 35, 27, 90],         // Fire Atronach, level 13: 15-30, 22-74 (both)
  [36, null, null, 28, 98],     // Iron Atronach, level 14: 23-82 (health)
  [37, 18, 30, 24, 84],         // Flesh Atronach, level 12: 15-25, 21-74 (both)
  [38, 17, 35, 27, 90],         // Ice Atronach, level 13: 15-30, 22-74 (both)
  [40, 16, 48, 36, 108],        // Dragonling (DFU's second row), level 16: 5-15, 14-42 (both)
  [41, 13, 27, 20, 70],         // Dreugh, level 10: 12-24, 19-66 (both)
  [42, null, null, 27, 90],     // Lamia, level 13: 22-74 (health; a touch)
  [257, null, null, 21, 87],    // Homunculus, level 12: 18-74 (health; a caster)
  [260, 1, 3, null, null],      // Bat, level 1: 1-4 (a newcomer's)
  [261, null, null, 36, 108],   // Medusa, level 16: 30-90 (health; a caster)
  [262, 2, 18, 13, 32],         // Wolf, level 5: 1-10, 10-25 (both)
  [263, null, null, 21, 69],    // Snow Wolf, level 10: 15-50 (health; a caster)
  [264, null, null, 28, 107],   // Hell Hound, level 15: 20-75 (health; a caster)
  [265, 8, 16, null, null],     // Grotesque, level 6: 5-10 (the blow)
  [266, 2, 10, null, null],     // Skeletal Soldier, level 3: 2-12 (a newcomer's)
  [269, null, null, 34, 101],   // Minotaur, level 15: 30-90 (health)
  [270, 13, 27, null, null],    // Iron Golem, level 10: 10-20 (the blow)
  [272, 11, 33, null, null],    // Troll, level 11: 10-30 (the blow)
  [274, 6, 22, null, null],     // Faded Ghost, level 7: 5-20 (the blow)
  [278, 2, 22, null, null],     // Boar, level 6: 1-12 (the blow)
  [280, 8, 24, null, null],     // Mountain Lion, level 8: 5-15 (the blow)
  [281, 1, 7, null, null],      // Mudcrab, level 2: 1-8 (a newcomer's)
  [282, null, null, 21, 96],    // Ogre, level 13: 18-80 (health)
  [286, 8, 24, null, null],     // Stone Golem, level 8: 5-15 (the blow)
  [287, 16, 36, 23, 94],        // Dire Ghoul, level 13: 15-35, 18-74 (both)
  [288, null, null, 13, 32],    // Scamp, level 5: 10-25 (health; a caster)
  [289, 7, 13, null, null],     // Centurion Sphere, level 5: 5-10 (the blow)
  [290, 13, 27, null, null],    // Steam Centurion, level 10: 10-20 (the blow)
]);

/** A court's table: six kinds, least to master, each holding an equal run of the twenty slots in order (slot i seats kind
 *  floor(i * 6 / 20)), so the level roll meets the least early and the master late, as DFU's tables are ordered. */
export const courtTable = (kinds) => Array.from({ length: 20 }, (_, i) => kinds[Math.floor((i * kinds.length) / 20)]);

/** The courts, [name, dungeon type, six kinds least to master]: two for each of DFU's nineteen types, beside DEX's
 *  default. A person (128 and up) stands at the player's level, so the court places it. No aquatic kind, rider or
 *  unique foe: the water's table and the climates' stay DEX's. */
export const DEX_MEANER_COURTS = Object.freeze([
  ['Court_Crypt_Lich', 0, [266, 274, 388, 18, 23, 32]],            // the dead raised by a lich and its acolytes
  ['Court_Crypt_Hungry', 0, [0, 277, 15, 19, 287, 273]],           // the dead that feed
  ['Court_OrcHold_Warband', 1, [256, 7, 12, 272, 21, 24]],         // a warlord's band
  ['Court_OrcHold_Beasts', 1, [0, 256, 262, 7, 282, 21]],          // a shaman's hold, its wolves and its ogre
  ['Court_Keep_Garrison', 2, [144, 141, 129, 130, 145, 391]],      // soldiers under a royal knight
  ['Court_Keep_Brigands', 2, [138, 136, 141, 143, 139, 395]],      // outlaws and their hired blade
  ['Court_Prison_Warders', 3, [0, 138, 135, 385, 136, 139]],       // the gaol's keepers and its worst
  ['Court_Prison_Forgotten', 3, [0, 3, 277, 274, 17, 23]],         // cells left to the dead
  ['Court_Temple_Daedra', 4, [1, 288, 285, 264, 27, 31]],          // a shrine taken by Oblivion
  ['Court_Temple_Seducer', 4, [288, 396, 133, 25, 26, 29]],        // a seducer's worshippers
  ['Court_Mine_Dwemer', 5, [0, 6, 289, 286, 270, 290]],            // diggings into the Dwemer's works
  ['Court_Mine_Lair', 5, [260, 256, 138, 271, 272, 282]],          // a worked-out mine and what moved in
  ['Court_Cave_Den', 6, [260, 4, 262, 280, 9, 14]],                // beasts and werebeasts
  ['Court_Cave_Grove', 6, [2, 10, 278, 384, 283, 389]],            // a druids' grotto
  ['Court_Coven_Witches', 7, [1, 288, 396, 257, 131, 29]],         // a witches' circle
  ['Court_Coven_Summoners', 7, [288, 128, 35, 38, 36, 25]],        // the summoners and what they call
  ['Court_Haunt_Bloodline', 8, [260, 3, 277, 287, 28, 30]],        // a vampire line and its hunger
  ['Court_Haunt_Thralls', 8, [0, 138, 133, 139, 394, 28]],         // a vampire's servants
  ['Court_Lab_Mages', 9, [1, 128, 131, 130, 257, 22]],             // mages and their made things
  ['Court_Lab_Golems', 9, [289, 286, 284, 270, 37, 36]],           // a maker's golems
  ['Court_Nest_Harpies', 10, [260, 0, 3, 13, 280, 22]],            // harpies and what shares their crags
  ['Court_Nest_Roost', 10, [3, 6, 13, 142, 16, 34]],               // a high roost, a dragonling above it
  ['Court_Ruin_Haunted', 11, [0, 266, 274, 15, 18, 273]],          // a castle's dead
  ['Court_Ruin_Squatters', 11, [256, 258, 136, 259, 272, 143]],    // what took the ruin after
  ['Court_Web_Brood', 12, [0, 6, 271, 274, 20, 261]],              // the brood and its keeper
  ['Court_Web_Catch', 12, [6, 271, 138, 136, 17, 20]],             // the web's catch
  ['Court_GiantHold_Hold', 13, [267, 4, 278, 16, 272, 282]],       // giants and their beasts
  ['Court_GiantHold_Hunt', 13, [262, 143, 280, 16, 282, 269]],     // a hunting party of the big folk
  ['Court_Den_Dragonling', 14, [3, 258, 259, 16, 22, 34]],         // a dragonling and its lizard folk
  ['Court_Den_Hoard', 14, [138, 145, 269, 26, 34, 276]],           // a hoard's fire and its hunters
  ['Court_BarbHold_Clan', 15, [267, 262, 141, 144, 143, 16]],      // a clan and its giant
  ['Court_BarbHold_Raiders', 15, [138, 136, 278, 143, 9, 14]],     // raiders who keep werebeasts
  ['Court_Volcanic_Fire', 16, [288, 285, 35, 264, 26, 276]],       // fire daedra
  ['Court_Volcanic_Dwemer', 16, [289, 286, 290, 270, 36, 34]],     // the Dwemer's forges
  ['Court_Scorpion_Brood', 17, [0, 6, 258, 271, 259, 20]],         // the stingers' nest
  ['Court_Scorpion_Sands', 17, [260, 258, 141, 19, 20, 261]],      // a desert tomb's nest
  ['Court_Grave_Robbed', 18, [0, 266, 267, 138, 277, 17]],         // a robbed graveyard
  ['Court_Grave_Risen', 18, [260, 266, 274, 388, 15, 18]],         // a graveyard risen
]);

const csv = (header, lines) => `${[header, ...lines].join('\r\n')}\r\n`;
const cell = (v) => (v == null ? '' : String(v));

/** The two tables as TEXT, as dexTables.js reads a mod's `.mdb.csv` and `.tdb.csv` files. */
export const DEX_MEANER_TABLE_TEXT = Object.freeze({
  'DexMeaner_Monsters.mdb.csv': csv('ID,MinDamage,MaxDamage,MinHealth,MaxHealth', DEX_MEANER_MONSTERS.map((r) => r.map(cell).join(','))),
  'DexMeaner_Courts.tdb.csv': csv(`Name,Table Indices,${Array.from({ length: 20 }, (_, i) => i + 1).join(',')}`,
    DEX_MEANER_COURTS.map(([name, type, kinds]) => [name, type, ...courtTable(kinds)].join(','))),
});
