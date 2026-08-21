// THE QUEST PACK LOADER (Q4-v) - the vendored DFU quest pack
// (vendor/dfu-quests: 265 quest sources + the tables, MIT,
// provenance-pinned README) into the browser. Vite's raw glob turns
// each .txt into a lazy chunk; loadQuestPack() preloads them ALL once
// so the machine's data seams stay synchronous (the C# shape - DFU
// reads files off disk on demand; the port fronts one await).
//
// BROWSER-ONLY: import.meta.glob is a Vite compile-time macro - node
// tests never import this module (they feed the bridge fs-backed
// seams). The tables ALSO land in the quest system's module registry
// (loadQuestTables) - the parser's static tables and the pack's list
// tables load from one place.

import { loadQuestTables } from '../systems/quest/tables.js';

const tableFiles = import.meta.glob('../../vendor/dfu-quests/Tables/*.txt', { query: '?raw', import: 'default' });
const questFiles = import.meta.glob('../../vendor/dfu-quests/Quests/*.txt', { query: '?raw', import: 'default' });

const stripBom = (s) => s.replace(/^﻿/, '');
const baseName = (path) => path.split('/').pop().replace(/\.txt$/, '');

let _pack = null;

/** Load every table + quest source once; answers the bridge's data
 *  seams. Safe to call repeatedly - one shared load. */
export async function loadQuestPack() {
  if (_pack) return _pack;
  _pack = (async () => {
    const tables = new Map();
    await Promise.all(Object.entries(tableFiles).map(async ([path, load]) => {
      tables.set(baseName(path), stripBom(await load()));
    }));
    const quests = new Map();
    await Promise.all(Object.entries(questFiles).map(async ([path, load]) => {
      quests.set(baseName(path), stripBom(await load()).split(/\r?\n/));
    }));
    loadQuestTables(Object.fromEntries(tables));
    return {
      /** QuestList-<name>.txt (the QuestListsManager's dep). */
      readListTable: (name) => tables.get(`QuestList-${name}`) ?? null,
      /** Quest source lines by name (the machine + lists dep). */
      getQuestSourceLines: (name) => quests.get(name) ?? null,
      questCount: quests.size,
    };
  })();
  return _pack;
}
