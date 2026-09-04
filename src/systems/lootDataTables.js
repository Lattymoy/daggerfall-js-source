// ROAD-G G5 - DaggerfallLootDataTables.cs, as its own file again.
//
// The port had these three members inside `systems/loot.js`, which is
// LootTables.cs's home; the 2026-07-06b audit put them there when it
// pulled them out of the dungeon scene, and nothing needed the split
// until now. G5 needs it: `systems/inventorySession.js` is a LEAF that
// DaggerfallInventoryWindow's drop-icon laws live in, and importing
// `loot.js` for one table dragged the whole generator - and, through
// `potions.js`, a cycle that broke module initialisation across the
// tree. DFU already has the boundary this file draws: the tables are
// their own source file, "Extracted from DaggerfallLoot class on
// 2 Feb 2018", and the port's own rule is one DFU member, one export.
//
// `loot.js` RE-EXPORTS every name below, so every existing importer
// still reads it there.
//
// This file imports nothing, and must keep importing nothing.

/** randomTreasureArchive (:19) - "Default texture archive for random
 *  treasure pile". */
export const RANDOM_TREASURE_ARCHIVE = 216;

/** The other five drop archives (:21-25) - "Other texture archives for
 *  dropped loot icons". */
export const DROP_ICON_ARCHIVES = Object.freeze({
  clothing: 204, boxesNbottles: 205, combat: 207, academic: 209, misc: 211,
  randomTreasure: RANDOM_TREASURE_ARCHIVE,
});

/** randomTreasureIconIndices (:30-33) - the icon a pile rolls when
 *  nobody picked one. DFU's own note: "Only a subset of loot icons
 *  from TEXTURE.216 are used & These are matched to classic". */
export const RANDOM_TREASURE_ICONS = Object.freeze([0, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 37, 43, 44, 45, 46, 47]);

/** dropIconIdxs (:37-45) - "Dropped items icon lists for player
 *  selection in inventory window", verbatim and IN THE DICTIONARY'S
 *  OWN ORDER, because GetNextArchive (DaggerfallInventoryWindow.cs
 *  :2148-2157) walks `.Keys` and takes the one AFTER the current
 *  archive, wrapping to `.Keys.First()`. C# preserves a no-removal
 *  Dictionary's insertion order in practice and DFU leans on it; a JS
 *  Map guarantees it. */
export const DROP_ICON_IDXS = new Map([
  [DROP_ICON_ARCHIVES.clothing, Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])],
  [DROP_ICON_ARCHIVES.boxesNbottles, Object.freeze([1, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 31, 32, 33, 34, 35, 36, 42, 43, 44])],
  [DROP_ICON_ARCHIVES.combat, Object.freeze([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16])],
  [DROP_ICON_ARCHIVES.academic, Object.freeze([0, 1, 2, 3, 5, 6, 7, 8, 10])],
  [DROP_ICON_ARCHIVES.misc, Object.freeze([2, 49, 51, 57])],
  [DROP_ICON_ARCHIVES.randomTreasure, Object.freeze([0, 1, 3, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 43, 44, 45, 46, 47])],
]);
