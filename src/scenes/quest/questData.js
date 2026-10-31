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

import { loadQuestTables } from '../../systems/quest/tables.js';
import { applyQuestPatches, QUEST_PATCHES } from '../../systems/quest/questPatches.js'; // SHAM-TRAIL: the port's patches over DFU's own quests, applied as they are read
import { questlineLines } from '../../systems/questlines/qlPatches.js'; // QL4: a flagship quest's branch, patched in while the questlines' switch is on (bible/06-Systems/Questlines-Arc.md 2.3)

const tableFiles = import.meta.glob('../../../vendor/dfu-quests/Tables/*.txt', { query: '?raw', import: 'default' });
// OWN-WORDS2: DFU's quest files the pack still reads - those with no message to rewrite (tools/bethesdaWords.mjs at 0);
// every other quest is ours, so no DFU message is bundled
const questFiles = import.meta.glob('../../../vendor/dfu-quests/Quests/__DEMO01.txt', {
  query: '?raw',
  import: 'default',
});
// OWN-WORDS1 (bible/06-Systems/Own-Words.md): a DFU quest in DFO's own words - DFU's QBN, our messages - is read in
// place of DFU's file of its name. tools/ownQuestCheck.mjs holds each one to DFU's logic.
const ownQuestFiles = import.meta.glob('../../systems/quest/own/*.txt', { query: '?raw', import: 'default' });
// RR3: a vendored mod's Quests/ folder - its QuestList-<name>.txt lands
// with the tables (the registered list's seam) and its quest sources
// with the pack's (GetQuest checks the mod's folder the same way).
// WA1: Warm Ashes - Ships' too - its list and its four loose quests
// (the manifest's LooseQuestsList: DFU's GetQuest finds a loaded mod's
// quest by name, AnyModContainsQuest; the source seam here is that).
const modQuestFiles = {
  // OWN-WORK3: Roleplay & Realism's list and its three quests in our own words, on the release's logic
  ...import.meta.glob('../../systems/roleplayRealism/quests/*.txt', { query: '?raw', import: 'default' }),
  ...import.meta.glob('../../../vendor/warm-ashes-ships/Quests/*.txt', { query: '?raw', import: 'default' }),
  // FORAGE1: Foraging's list and its 22 quests - OWN-WORK3: our own words, FORAGE-FIX's mends written in
  ...import.meta.glob('../../systems/foraging/quests/*.txt', { query: '?raw', import: 'default' }),
  // QL12-QL16: the questlines' own quests (systems/questlines/qlLines.js), the port's scripts on DFU's machine
  ...import.meta.glob('../../systems/questlines/quests/*.txt', { query: '?raw', import: 'default' }),
  // START1: the starts' own quests (systems/starts/starts.js), the port's scripts on DFU's machine
  ...import.meta.glob('../../systems/starts/quests/*.txt', { query: '?raw', import: 'default' }),
};

const stripBom = (s) => s.replace(/^﻿/, '');
const baseName = (path) =>
  path
    .split('/')
    .pop()
    .replace(/\.txt$/, '');

let _pack = null;

/** SHAM-TRAIL (systems/quest/questPatches.js): a DFU quest the port patches, patched each time it is read - its entry in
 *  the player's language of that moment. A patch that no longer finds its text warns (once) and DFU's text loads as
 *  shipped (null: the caller reads the unpatched lines), so one patch can never take the quest down with it. */
const _patchWarned = new Set();
function patchedLines(name, text) {
  try {
    return applyQuestPatches(name, text).split(/\r?\n/);
  } catch (e) {
    if (!_patchWarned.has(name)) {
      _patchWarned.add(name);
      console.warn(`[questData] ${e.message} - loaded as shipped`);
    }
    return null;
  }
}

/** Load every table + quest source once; answers the bridge's data
 *  seams. Safe to call repeatedly - one shared load. */
export async function loadQuestPack() {
  if (_pack) return _pack;
  _pack = (async () => {
    const tables = new Map();
    await Promise.all(
      Object.entries(tableFiles).map(async ([path, load]) => {
        tables.set(baseName(path), stripBom(await load()));
      }),
    );
    const quests = new Map();
    const patchable = new Map(); // SHAM-TRAIL: a DFU quest the port patches, kept as shipped and patched as it is read
    await Promise.all(
      Object.entries({ ...questFiles, ...ownQuestFiles }).map(async ([path, load]) => {
        const name = baseName(path);
        const text = stripBom(await load()); // OWN-WORDS1: ours, patched as DFU's would be
        if (QUEST_PATCHES[name]) patchable.set(name, text);
        quests.set(name, text.split(/\r?\n/));
      }),
    );
    await Promise.all(
      Object.entries(modQuestFiles).map(async ([path, load]) => {
        const name = baseName(path);
        const text = stripBom(await load()); // OWN-WORK3: Foraging's quests carry their FORAGE-FIX mends themselves
        if (name.startsWith('QuestList-')) tables.set(name, text);
        else {
          quests.set(name, text.split(/\r?\n/));
          patchable.delete(name);
        } // a mod's quest of the name is the mod's, unpatched
      }),
    );
    loadQuestTables(Object.fromEntries(tables));
    return {
      /** QuestList-<name>.txt (the QuestListsManager's dep). */
      readListTable: (name) => tables.get(`QuestList-${name}`) ?? null,
      /** Quest source lines by name (the machine + lists dep) - QL4: a flagship quest's branch over them while the
       *  questlines' switch is on (the read the start's stamp follows - systems/questlines/qlPatches.js). AUDIT
       *  QUESTLINES BRANCH-12: `questlines` reads it as a copy's stamp says it was read (machine.js parseQuestShape, a
       *  stamped restart) - absent, the switch now. */
      getQuestSourceLines: (name, questlines) =>
        questlineLines(
          name,
          (patchable.has(name) ? patchedLines(name, patchable.get(name)) : null) ?? quests.get(name) ?? null,
          questlines,
        ),
      questCount: quests.size,
    };
  })();
  return _pack;
}
