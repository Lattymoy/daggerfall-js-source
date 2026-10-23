// QL1 (bible/06-Systems/Questlines-Arc.md section 2.5): THE QUEST PACK AS THE GAME READS IT, OFF THE DISK - the node
// twin of scenes/quest/questData.js (browser-only: Vite's glob), for the sheets' and the branches' pins. The same order
// of reads: DFU's vendored quests with the port's own patches (SHAM-TRAIL, quest/questPatches.js), the mods' quests with
// Foraging's (FORAGE-FIX), and - while the questlines' switch is on - a flagship quest's branch (qlPatches.js). And a
// machine that knows every line the pack says: DFU's 82, Jagget's four (Foraging's quests), the questlines' six (AUDIT QUESTLINES DOC-29: said three; AUDIT STAR8 S1: `ql gone`).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables, addIntoQuestTables } from '../src/systems/quest/tables.js';
import { RR_PLACES_TABLE, RR_FACTIONS_TABLE } from '../src/systems/roleplayRealism/rrQuestLine.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { applyQuestPatches, QUEST_PATCHES } from '../src/systems/quest/questPatches.js';
import { applyForageFix } from '../src/systems/foraging/foragingLaw.js';
import { questActionsExtensionTemplates } from '../src/systems/quest/questActionsExtension.js';
import { questlineActionTemplates } from '../src/systems/questlines/qlActions.js';
import { questlineLines } from '../src/systems/questlines/qlPatches.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

/** Where each quest's file is: DFU's pack, then each mod's folder (its QuestList- files are tables, not quests). */
export const QUEST_DIRS = Object.freeze([
  ['dfu', 'vendor/dfu-quests/Quests'],
  ['roleplay-realism', 'vendor/roleplay-realism/Quests'],
  ['warm-ashes-ships', 'vendor/warm-ashes-ships/Quests'],
  ['foraging', 'vendor/foraging/Quests'],
  ['questlines', 'src/systems/questlines/quests'],
]);

/** Every quest file the pack holds: upper-case name -> { name, dir, path }. A mod's quest of a DFU name is the mod's. */
export const QUEST_FILES = (() => {
  const map = new Map();
  for (const [dir, rel] of QUEST_DIRS) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (!/\.txt$/i.test(f) || /^QuestList-/i.test(f)) continue;
      const name = f.replace(/\.txt$/i, '');
      map.set(name.toUpperCase(), { name, dir, path: join(abs, f) });
    }
  }
  return map;
})();

/** The tables (DFU's and the mods' lists), loaded into the quest system once. */
let _tables = false;
export function loadTables() {
  if (_tables) return;
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(ROOT, 'vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
  // Roleplay & Realism's places and factions, as the game adds them (roleplayRealism/rrInstall.js) - its quests name them
  addIntoQuestTables({ places: [...RR_PLACES_TABLE], factions: [...RR_FACTIONS_TABLE] });
  _tables = true;
}

/** A quest's text as the pack reads it before the questlines' branch: the port's patches over DFU's, Foraging's fix over
 *  Foraging's. Null for a quest the pack does not hold. */
export function baseText(name) {
  const f = QUEST_FILES.get(String(name).toUpperCase());
  if (!f) return null;
  const text = read(f.path);
  if (f.dir === 'dfu' && QUEST_PATCHES[f.name]) return applyQuestPatches(f.name, text);
  if (f.dir === 'foraging') return applyForageFix(f.name, text);
  return text;
}

/** A quest's lines as the game reads them now - `on`, the questlines' switch (its branch patched in). */
export function questSource(name, on = true) {
  const text = baseText(name);
  if (text == null) return null;
  return questlineLines(QUEST_FILES.get(String(name).toUpperCase()).name, text.split(/\r?\n/), on);
}

/** A machine that knows every line the pack says. */
export function packMachine(over = {}) {
  loadTables();
  const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: (n, on) => questSource(n, on ?? true), ...over });   // AUDIT QUESTLINES BRANCH-12: the seam's second word, as questData.js reads it
  for (const t of questActionsExtensionTemplates()) m.registerAction(t);
  for (const t of questlineActionTemplates()) m.registerAction(t);
  return m;
}

/** The quest parsed headless as the game reads it, with its lines: `{ quest, lines }`, or null. */
export function parsedQuest(name, machine = packMachine(), on = true) {
  const lines = questSource(name, on);
  if (!lines) return null;
  const quest = machine.parseQuestForLists(lines, 0, { rolls: () => 0, headless: true });
  return quest ? { quest, lines } : null;
}

/** QuestList-Classic.txt's live rows: `[{ name, group, minReq, flag }]` (a disabled `-` row is no row). */
export function classicRows() {
  const rows = [];
  for (const line of read(join(ROOT, 'vendor/dfu-quests/Tables/QuestList-Classic.txt')).split(/\r?\n/)) {
    const m = /^([A-Z0-9$_]+),\s*([A-Za-z]+),\s*([A-Z]),\s*(\d+),\s*([01X]),/.exec(line);
    if (m) rows.push({ name: m[1], group: m[2], membership: m[3], minReq: Number(m[4]), flag: m[5] });
  }
  return rows;
}
