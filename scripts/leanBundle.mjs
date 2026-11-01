// The bundle carries no name of an outside author, a mod site or Daggerfall Unity (the owner: no credits, no mention).
// The quest scripts and tables ship without their comment lines. They are the source files' notes for whoever edits
// them (who wrote a quest, where to report a bug) and nothing reads them: the parser skips a comment in a quest's
// header and its QBN, and a table skips every one. A comment inside the QRC is kept, because a line starting with `-`
// ends the message before it (Parser._peekMessageEnd). The source files stay as they are; only the bundle is lean.
import { readFileSync } from 'node:fs';

const QUEST_TEXT = /\/(?:vendor\/dfu-quests|src\/systems\/[\w/]*quests?)\/[^?]*\.txt\?raw$/;
const TABLE = /\/Tables\/[^/]+\.txt$/;
const NOTE_SWAPS = [['New quest exclusive to Daggerfall Unity', 'New quest']];

/** A quest script with its header's and its QBN's comment lines dropped, its QRC untouched. */
export function leanQuestScript(text) {
  const out = [];
  let section = 'header';
  for (const line of text.split('\n')) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith('qrc:')) section = 'qrc';
    else if (trimmed.startsWith('qbn:')) section = 'qbn';
    if (section !== 'qrc' && line.trim().startsWith('-')) continue;
    out.push(line);
  }
  return out.join('\n');
}

/** A quest table with its comment lines dropped and its rows' notes in our own words. */
export function leanQuestTable(text) {
  let lean = text
    .split('\n')
    .filter((line) => !line.trim().startsWith('-'))
    .join('\n');
  for (const [from, to] of NOTE_SWAPS) lean = lean.split(from).join(to);
  return lean;
}

/** The text a bundle carries for a quest file. */
export function leanQuestText(path, text) {
  return TABLE.test(path) ? leanQuestTable(text) : leanQuestScript(text);
}

const MANIFEST = /\/vendor\/[^?]+\.json$/;
const MANIFEST_NAMES = ['ModAuthor', 'ModContactInfo', 'Source'];

/** A vendored manifest without its author, contact or download page: the game reads none of them. */
export function leanManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return manifest;
  return Object.fromEntries(Object.entries(manifest).filter(([key]) => !MANIFEST_NAMES.includes(key)));
}

/** Vite: a quest file imported `?raw` loads lean, and so does a vendored manifest. */
export function leanBundlePlugin() {
  return {
    name: 'lean-bundle',
    enforce: 'pre',
    load(id) {
      const path = id.replace(/\\/g, '/');
      if (QUEST_TEXT.test(path)) {
        const file = id.slice(0, id.indexOf('?raw'));
        return `export default ${JSON.stringify(leanQuestText(path.slice(0, path.indexOf('?raw')), readFileSync(file, 'utf8')))};`;
      }
      if (MANIFEST.test(path)) {
        const json = JSON.parse(readFileSync(id, 'utf8'));
        return JSON.stringify(leanManifest(json));
      }
      return null;
    },
  };
}
