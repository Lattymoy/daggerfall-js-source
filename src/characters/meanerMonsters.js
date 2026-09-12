// ═══════════════════════════════════════════════════════════════════
// MEANER MONSTERS 1.5.2 (Ralzar; "Author: Hazelnut & Ralzar", MIT) -
// THE MOD, 1:1 (MM1, 2026-09-12, Mac: "Next is this mod to integrate
// 1-1").
//
// What the mod is: a MonoBehaviour whose InitMod walks an EnemyData
// array at Awake and writes each row's fields that are not -1 over
// EnemyBasics.Enemies[id] - Level, MinHealth/MaxHealth, ArmorValue,
// the three damage pairs, and the sounds and corpse texture no row
// sets. "Buffs many monsters. Debuffs rats, bats and zombies." Beside
// the table it ships forty-six `xml` files that scale the Werewolf
// (264) and Wereboar (269) sprites by 1.2, the Dragonling (295) by 2.5
// and its corpse (96/0) by 2 - the "Large Dragonling" the row names.
//
// THE SOURCE: the shipped `meaner monsters.dfmod` (a compiled
// `Meaner Monsters.dll`, 10,752 bytes, the forty-six xml TextAssets and
// the manifest) unpacked and the DLL decompiled (ILSpy 8.2), read
// beside the repository's `MeanerMonsters.cs` (github.com/Ralzar81/
// Meaner-Monsters, master = 1.5.2): the two agree row for row.
//
// KEPT BUG FOR BUG: the source lists FOUR rows under id 35 - commented
// "Fire Atronach", "Iron Atronach", "Flesh Atronach", "Ice Atronach" -
// and InitMod applies them in order, so the LAST (the Ice Atronach's
// values) is what the Fire Atronach (35) ends with, and 36, 37, 38 are
// never touched; the Flesh row's `minDmg: 55, maxDmg: 15` (min over
// max) is overwritten before it matters. `name` ("Large Dragonling")
// is never applied: the write is commented out in InitMod. The
// `pcoEnemyDataArray` behind `private static bool pco = false` is dead
// - nothing sets `pco` - and is carried below as data, unreachable.
//
// NOT CARRIED: the Unleveled Mobs arm (Init rewrites
// RandomEncounters.EncounterTables[21] and [36] when that mod is
// loaded) and the DEX warning boxes (a GUID lookup of another mod) -
// neither mod is in the port; when Unleveled Mobs is integrated its
// own switch is the arm's condition (Mac: no compatibility switches
// between mods).
//
// THE PORT'S SHAPE: DFU rewrites the global table once at Awake; the
// port overlays the folded edit on the row a foe is minted from
// (characters/enemyEntity.makeEnemyEntity), under the mod's `Enabled`
// in the Mods pane. PCAAO's own Meaner Monsters edit
// (combat/pcaaoMeanerMonsters.js) is DFU's "Meaner Monsters is loaded"
// arm: it runs AFTER this one, as PCAAO lists this mod as a dependency
// and so Awakes after it - both on, PCAAO's values win where both
// write. A LEAF but for the settings store and the xml registry.
// ═══════════════════════════════════════════════════════════════════

import { modSetting } from '../systems/modSettings.js';
import { registerBillboardXml } from '../world/billboardXml.js';

export const MEANER_MONSTERS_VENDOR = 'meanerMonsters';
export const MEANER_MONSTERS_VERSION = '1.5.2';

/** EnemyData(id, name, level, minHp, maxHp, armor, minDmg, maxDmg,
 *  minDmg2, maxDmg2, minDmg3, maxDmg3, moveSnd, barkSnd, attackSnd,
 *  corpseTex) - `mobEnemyDataArray`, the DLL's order, -1 = unset. */
const row = (id, name, level, minHp, maxHp, armor, minDmg, maxDmg, minDmg2 = -1, maxDmg2 = -1, minDmg3 = -1, maxDmg3 = -1, moveSnd = -1, barkSnd = -1, attackSnd = -1, corpseTex = -1) =>
  Object.freeze({ id, name, level, minHp, maxHp, armor, minDmg, maxDmg, minDmg2, maxDmg2, minDmg3, maxDmg3, moveSnd, barkSnd, attackSnd, corpseTex });
export const MEANER_MONSTERS_ROWS = Object.freeze([
  row(0, '', 1, 15, 25, 8, 1, 4),                       // Rat
  row(3, '', 2, 5, 15, 4, 1, 4),                        // Giant Bat
  row(4, '', -1, 50, 100, 7, 1, 2, 8, 12, 10, 20),      // Grizzly Bear
  row(5, '', -1, 40, 80, 2, 8, 15, 8, 20, 10, 25),      // Sabertooth Tiger
  row(6, '', 2, 20, 50, 6, 4, 10),                      // Spider
  row(9, '', 8, 25, 50, 1, 8, 10, 8, 10, 15, 30),       // Werewolf
  row(14, '', 8, 80, 120, 7, 5, 8, 5, 8, 10, 25),       // Wereboar
  row(16, '', 10, 150, 200, 5, 10, 30),                 // Giant
  row(17, '', 5, 60, 100, 7, 1, 5),                     // Zombie
  row(19, '', 15, 120, 190, -2, 5, 15),                 // Mummy
  row(20, '', 4, 15, 70, 2, 10, 15),                    // Giant Scorpion
  row(30, '', 20, 80, 200, -5, 25, 60),                 // Vampire Ancient
  row(31, '', 21, 100, 240, -10, 40, 100),              // Daedra Lord
  row(32, '', 20, 60, 200, -8, 80, 110),                // Lich
  row(33, '', 21, 80, 210, -12, 100, 130),              // Ancient Lich
  row(7, '', 6, 30, 60, 5, 8, 15),                      // Orc
  row(12, '', 9, 40, 100, 2, 10, 30),                   // Orc Sargeant
  row(21, '', 15, 50, 110, 6, 8, 30),                   // Orc Shaman
  row(24, '', 19, 80, 150, -5, 15, 50),                 // Orc Warlord
  row(35, '', 16, 25, 130, 6, 15, 30),                  // "Fire Atronach"
  row(35, '', 16, 25, 130, -2, 5, 15),                  // "Iron Atronach" - id 35 again
  row(35, '', 16, 150, 350, 6, 55, 15),                 // "Flesh Atronach" - id 35 again, min over max
  row(35, '', 21, 25, 130, 6, 5, 15),                   // "Ice Atronach" - id 35 again, and the one that lands
  row(40, 'Large Dragonling', 21, 140, 250, -12, 50, 150),   // Dragon - the name is never applied
]);
/** `pcoEnemyDataArray` - dead in 1.5.2 (`pco` is never set). Data only. */
export const MEANER_MONSTERS_PCO_ROWS = Object.freeze([
  row(4, '', -1, 55, 110, 8, 1, 2, 8, 12, 10, 20),
  row(5, '', -1, 40, 80, 5, 8, 15, 8, 20, 10, 25),
  row(6, '', 2, 20, 50, 6, 4, 10),
  row(9, '', 8, 25, 50, 3, 8, 10, 8, 10, 15, 30),
  row(14, '', 8, 80, 120, 7, 5, 8, 5, 8, 10, 25),
  row(16, '', 10, 150, 200, 5, 10, 30),
  row(17, '', 5, 60, 100, 7, 1, 5),
  row(19, '', 15, 120, 190, -2, 5, 15),
  row(20, '', 4, 15, 70, 2, 10, 15),
  row(30, '', 20, 80, 200, -5, 25, 60),
  row(31, '', 21, 100, 240, -10, 40, 100),
  row(32, '', 20, 60, 200, -8, 80, 110),
  row(33, '', 21, 80, 210, -12, 100, 130),
  row(7, '', 6, 30, 60, 5, 8, 15),
  row(12, '', 9, 40, 100, 2, 10, 30),
  row(21, '', 15, 50, 110, 6, 8, 30),
  row(24, '', 19, 80, 150, -5, 15, 50),
  row(35, '', 16, 25, 130, 6, 15, 30),
  row(35, '', 16, 25, 130, -2, 5, 15),
  row(35, '', 16, 150, 350, 6, 55, 15),
  row(35, '', 21, 25, 130, 6, 5, 15),
  row(40, 'Large Dragonling', 21, 140, 250, -12, 50, 150),
]);
export const MEANER_MONSTERS_PCO_FLAG = false;   // `private static bool pco = false;`

/** InitMod's loop, folded: EnemyData field -> EnemyBasics field, each
 *  written when not -1, rows in order (a later row over an earlier
 *  one's). `name` has no arm - the write is commented out. */
const FIELDS = Object.freeze([
  ['level', 'level'], ['minHp', 'minHealth'], ['maxHp', 'maxHealth'], ['armor', 'armorValue'],
  ['minDmg', 'minDamage'], ['maxDmg', 'maxDamage'], ['minDmg2', 'minDamage2'], ['maxDmg2', 'maxDamage2'],
  ['minDmg3', 'minDamage3'], ['maxDmg3', 'maxDamage3'], ['moveSnd', 'moveSound'], ['barkSnd', 'barkSound'],
  ['attackSnd', 'attackSound'], ['corpseTex', 'corpseTexture'],
]);
export function foldMeanerMonsters(rows = MEANER_MONSTERS_ROWS) {
  const edit = {};
  for (const r of rows) {
    const e = (edit[r.id] ??= {});
    for (const [from, to] of FIELDS) if (r[from] !== -1) e[to] = r[from];
  }
  for (const k of Object.keys(edit)) Object.freeze(edit[k]);
  return Object.freeze(edit);
}
/** EnemyBasics.Enemies[i] as InitMod leaves it, by id. */
export const MEANER_MONSTERS_EDIT = foldMeanerMonsters(MEANER_MONSTERS_PCO_FLAG ? MEANER_MONSTERS_PCO_ROWS : MEANER_MONSTERS_ROWS);

/** The mod's switch: `Enabled` in the Mods pane (DFU: the mod listed). */
export const meanerMonstersEnabled = (read = (k) => modSetting(MEANER_MONSTERS_VENDOR, k)) => !!read('Enabled');

/** InitMod's write, at mint - the row a foe of `mobileType` is minted from under this mod: the
 *  base row with the folded edit over it when the mod is on. A class
 *  enemy (128+) and any monster the table does not name come back
 *  untouched. Never mutates the base table. */
export function applyMeanerMonsters(mobileType, baseRow, on = meanerMonstersEnabled()) {
  if (!on || !baseRow) return baseRow;
  const edit = MEANER_MONSTERS_EDIT[mobileType];
  return edit ? { ...baseRow, ...edit } : baseRow;
}

/** The forty-six xml files: `<archive>_<record>-0.xml` ->
 *  [scaleX, scaleY], as vendor/meanerMonsters/xml carries them
 *  (Werewolf 264 and Wereboar 269 x1.2 on records 0-14, the
 *  Dragonling 295 x2.5 on 0-14, its corpse 96/0 x2). */
const records = (n, s) => Object.freeze(Object.fromEntries(Array.from({ length: n }, (_, i) => [i, Object.freeze([s, s])])));
export const MEANER_MONSTERS_BILLBOARD_XML = Object.freeze({
  264: records(15, 1.2),
  269: records(15, 1.2),
  295: records(15, 2.5),
  96: Object.freeze({ 0: Object.freeze([2, 2]) }),
});

/** One call per boot (systems/worldTick.js): the xml table joins the
 *  billboard-scale registry under the mod's live switch. */
export function installMeanerMonsters({ read = null } = {}) {
  registerBillboardXml(MEANER_MONSTERS_VENDOR, MEANER_MONSTERS_BILLBOARD_XML, () => meanerMonstersEnabled(read ?? undefined));
  return true;
}
