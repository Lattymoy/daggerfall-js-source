// SOUL-LAW (FIELD BUGS 2026-10-20h, bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md) - THE MOD'S ENEMIES BY THEIR IDS,
// READ WITHOUT ITS INSTALL. Daggerfall Enemy Expansion's fifty (256-290 its monsters, 384-398 its people) join the game's
// table at its load (dexInstall.js installEnemyExpansion, BestiaryMod.Start). The account service loads none of the game,
// and it judges every realm checkpoint's items with the item law (systems/item/itemLaw.js) - where a soul gem holds the
// mobile id of the foe it was trapped from (mysticism.js attemptSoulTrap, as EnemyEntity.cs:217 hands
// SoulTrap.FillEmptyTrapItem the foe's MobileEnemy.ID). So the law reads the ids here, from the mod's own tables: every
// `.mdb.csv` line's ID that is no classic one, as readEnemyTables reads them (dexTables.js) - MUDEX's tables after the
// mod's (MUDEX1: its lines edit, they add no enemy). test/systems/item/fb1020h_soul.test.js holds this list to the
// game's own registry, with MUDEX and without.

import { DEX_TABLE_TEXT } from './dexTableText.js';
import { MUDEX_TABLE_TEXT } from './mudexTableText.js';
import { readCsvTable, parseCsInt } from './dexCsv.js';
import { isClassicEnemyId } from '../../characters/enemy/enemyBasics.js';

/** Every mobile id the mod's tables give an enemy of its own (none of DFU's MobileTypes), ascending. */
export const DEX_ENEMY_IDS = Object.freeze((() => {
  const ids = new Set();
  for (const [name, text] of [...Object.entries(DEX_TABLE_TEXT), ...Object.entries(MUDEX_TABLE_TEXT)]) {
    if (!name.endsWith('.mdb.csv')) continue;
    const table = readCsvTable(text);
    const col = table.column('ID');
    if (col == null) continue;
    for (const { tokens } of table.rows) {
      let id;
      try { id = parseCsInt(tokens[col]); } catch { continue; }   // a line the mod's read refuses registers nothing
      if (!isClassicEnemyId(id)) ids.add(id);
    }
  }
  return [...ids].sort((a, b) => a - b);
})());
