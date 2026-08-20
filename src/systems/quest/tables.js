// THE QUEST TABLES (Q1) - the stand-in for QuestMachine.Instance's
// table properties until Q2 ships the machine itself. The parser and
// resources read StaticMessagesTable / GlobalVarsTable / PlacesTable /
// ItemsTable / FoesTable off the singleton in DFU; here they read
// them from this module, loaded once by whoever boots the quest layer
// (tests load from vendor/dfu-quests; the runtime host will do the
// same through its data seam). Unset tables THROW by name - a quest
// parsed without its tables would misclassify every line, which is
// the silent-degradation shape the audits keep finding.

import { Table } from './table.js';

const _tables = {
  staticMessages: null,
  globalVars: null,
  places: null,
  items: null,
  foes: null,
  diseases: null,
  factions: null,
  sounds: null,
  spells: null,
};

/** Load from raw file text keyed by DFU table name. */
export function loadQuestTables(sources) {
  const map = {
    'Quests-StaticMessages': 'staticMessages',
    'Quests-GlobalVars': 'globalVars',
    'Quests-Places': 'places',
    'Quests-Items': 'items',
    'Quests-Foes': 'foes',
    'Quests-Diseases': 'diseases',
    'Quests-Factions': 'factions',
    'Quests-Sounds': 'sounds',
    'Quests-Spells': 'spells',
  };
  for (const [file, key] of Object.entries(map)) {
    if (sources[file] != null) _tables[key] = new Table(sources[file]);
  }
}

function need(key, name) {
  if (!_tables[key]) throw new Error(`quest tables not loaded: ${name} (call loadQuestTables first)`);
  return _tables[key];
}

export const staticMessagesTable = () => need('staticMessages', 'Quests-StaticMessages');
export const globalVarsTable = () => need('globalVars', 'Quests-GlobalVars');
export const placesTable = () => need('places', 'Quests-Places');
export const itemsTable = () => need('items', 'Quests-Items');
export const foesTable = () => need('foes', 'Quests-Foes');
export const soundsTable = () => need('sounds', 'Quests-Sounds');

/** Test seam. */
export function resetQuestTables() {
  for (const k of Object.keys(_tables)) _tables[k] = null;
}
