// DEX4a (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 8) - DAGGERFALL ENEMY EXPANSION'S SPELLBOOKS.
// ParseSpellbookTables (BestiaryMod.cs:1884-1954) names thirteen tables of one book each - DFU's own thirteen career
// lists (EnemyEntity.cs, systems/enemySpells.js MONSTER_SPELL_LISTS) - and "Class", a ladder of seven books by the
// enemy's level; a row's raw `Spellbook` cell is a table of its own, named after the enemy's id (:1274-1290, read by
// dexTables.js). Table names match whatever their case (StringComparer.OrdinalIgnoreCase).
// SetEnemySpells (:1404-1447), at the enemy's spawn: a row naming a table casts the table's book for its level -
// GetSpellbook, the last book whose minLevel the level reaches - in place of DFU's list; a level no book reaches, or a
// table no one made, leaves DFU's. A spell the standard list lacks is skipped with the C#'s complaint (the port's
// setEnemySpells, as it skips one of DFU's).
// The C# complains of an unknown table at each spawn; the port's door is asked by every reader of what a foe casts,
// so the complaint is said once, at the install, for each row naming one.

import { MONSTER_SPELL_LISTS } from '../enemySpells.js';

/** One book: its spells and the level it starts at. */
const book = (spellIds, minLevel = 0) => Object.freeze({ spellIds: Object.freeze([...spellIds]), minLevel });
const one = (careerIndex) => Object.freeze([book(MONSTER_SPELL_LISTS[careerIndex])]);

/** ParseSpellbookTables' fixed tables, in the C#'s order. Their lists are EnemyEntity's own, which the C# restates. */
export const DEX_SPELLBOOK_TABLES = Object.freeze(new Map([
  ['Imp', one(1)], ['Ghost', one(18)], ['OrcShaman', one(21)], ['Wraith', one(23)], ['FrostDaedra', one(25)],
  ['FireDaedra', one(26)], ['Daedroth', one(27)], ['Vampire', one(28)], ['Seducer', one(29)], ['VampireAncient', one(30)],
  ['DaedraLord', one(31)], ['Lich', one(32)], ['AncientLich', one(33)],
  ['Class', Object.freeze([
    book(MONSTER_SPELL_LISTS[25]), book(MONSTER_SPELL_LISTS[27], 3), book(MONSTER_SPELL_LISTS[21], 6), book(MONSTER_SPELL_LISTS[30], 9),
    book(MONSTER_SPELL_LISTS[31], 12), book(MONSTER_SPELL_LISTS[32], 15), book(MONSTER_SPELL_LISTS[33], 18),
  ])],
]));

/** SpellbookTable.GetSpellbook (:100-103): the last book whose minLevel `level` reaches, or null. */
export function spellbookOf(table, level) {
  let out = null;
  for (const b of table) if (level >= b.minLevel) out = b;
  return out;
}

/**
 * The tables the mod reads - the fixed ones and each raw one (`raw`: name -> spell ids, dexTables.js readEnemyTables'
 * `spellbooks`) - keyed by name in lower case, and the door for systems/enemySpells.js registerEnemySpellbook:
 * `propsOf(mobileType)` is the mod's custom properties for an id (dexInstall.js dexProperties). Each of `ids` naming a
 * table no one made is said to `log`, once.
 */
export function createDexSpellbooks(raw, propsOf, { ids = [], log = () => {} } = {}) {
  const tables = new Map();
  for (const [name, t] of DEX_SPELLBOOK_TABLES) tables.set(name.toLowerCase(), t);
  for (const [name, spells] of raw) tables.set(String(name).toLowerCase(), Object.freeze([book(spells)]));
  const tableOf = (mobileType) => {
    const name = propsOf(mobileType)?.spellbookTable;
    return name ? tables.get(name.toLowerCase()) ?? null : null;
  };
  for (const id of ids) if (propsOf(id)?.spellbookTable && !tableOf(id)) log('error', `[DEX] Unknown enemy spell table '${propsOf(id).spellbookTable}'`);
  return {
    tables,
    /** registerEnemySpellbook's door: the book's spells for the foe's level, or null for DFU's own list. */
    spellbook: (entity, level) => spellbookOf(tableOf(entity?.mobileType) ?? [], level)?.spellIds ?? null,
  };
}
