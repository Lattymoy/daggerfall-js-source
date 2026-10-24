// DEX3 (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 7) - RandomEncounters.EncounterTables AS A MOD WRITES
// THEM. DFU's tables are an array of structs a mod writes in place (`ref RandomEncounterTable table = ref
// RandomEncounters.EncounterTables[index]; table.Enemies = ...` - Daggerfall Enemy Expansion's SelectTable and
// SelectDungeonTable, BestiaryMod.cs:1728-1766), and every reader then rolls from the mod's. The port's tables are DFU's
// generated array (encounterTables.js, untouched); a mod registers a SELECTOR here and every reader asks this door:
//   encounterTable(index, place, rolls) - the table a roll reads:
//     - THE PLAYER'S OWN (`place.local` - the encounter law's rolls where the player stands, systems/encounters.js; DFU's
//       every roll is one) and A DUNGEON'S (`place.dungeon` - its population, characters/dungeonEnemies.js dungeonPlace):
//       the first selector's answer - the table as the mod's events left it - else DFU's own.
//     - ANY OTHER - a roll every machine must agree on: a granted member's (scenes/grantHost.js), a roaming band's, a
//       road's trouble (systems/livingWorld/trouble.js), none of which DFU has. A machine's events are its own (the
//       mod picks a climate's table by UnityEngine.Random as its player walks), so such a roll reads none of them: it
//       reads one of encounterTableChoices(index), by its own die (`rolls`) where a mod offers more than one, and with
//       no draw spent where there is one (DFU's alone, or a mod's single table) - the roll it always was.
//   encounterTableChoices(index) - every table a selector may answer for `index` (DFU's alone without one).
// A LEAF beside the generated table.
import { ENCOUNTER_TABLES } from './encounterTables.js';

const _selectors = [];
let _gen = 0;
/** Register `{ table(index, place) => ids | null, choices(index) => ids[] | null }` - a mod's writes, read live. */
export function registerEncounterTableSelector(selector) {
  if (typeof selector?.table !== 'function' || typeof selector.choices !== 'function') throw new Error('registerEncounterTableSelector: { table(index, place), choices(index) }');
  _selectors.push(selector);
  _gen++;
}
/** Moves when the selectors do - what a reader that keeps an answer keys it by. */
export const encounterTableGeneration = () => _gen;
/** The test seam. */
export function _resetEncounterTableSelectors() { _selectors.length = 0; _gen++; }

/** The table a roll reads (null past the array, as ENCOUNTER_TABLES[index] reads undefined there): see the header. */
export function encounterTable(index, place = null, rolls = null) {
  if (place?.local || place?.dungeon) {
    for (const s of _selectors) {
      const t = s.table(index, place);
      if (t) return t;
    }
    return ENCOUNTER_TABLES[index] ?? null;
  }
  const choices = encounterTableChoices(index);
  if (choices.length < 2) return choices[0] ?? null;
  if (typeof rolls !== 'function') throw new Error(`encounterTable: table ${index} has ${choices.length} choices, and a roll every machine agrees on picks by its own die`);
  return choices[Math.floor(rolls() * choices.length)];
}

/** Every table a roll for `index` may read, on any machine: a selector's, else DFU's one. */
export function encounterTableChoices(index) {
  for (const s of _selectors) {
    const c = s.choices(index);
    if (c?.length) return c;
  }
  return ENCOUNTER_TABLES[index] ? [ENCOUNTER_TABLES[index]] : [];
}
