// @ts-check
// Daggerfall Unity save-game set (DFUSAVE1, 2026-09-20). The reader half
// of Game/Serialization/SaveLoadManager.cs (MIT, Daggerfall Workshop):
// a save is a FOLDER, `Saves/SAVE<n>/`, real only WITH its SaveInfo.txt
// (EnumerateSaveFolders :751), and its state is a set of JSON files -
// SaveData.txt (SaveData_v1, SerializableGameObject.cs:82-98) beside
// FactionData.txt, QuestData.txt, DiscoveryData.txt,
// ConversationData.txt, NotebookData.txt, WorldVariationData.txt, the
// optional QuestExceptions.txt, AutomapData.txt, ContainerData.txt and
// mod_<file>.txt per mod (GetModDataFilename :1573-1577), the plain-text bio.txt (one back-story line a row,
// LoadGame :1352-1361) and Screenshot.jpg (:45-57).
//
// THE JSON IS FULL SERIALIZER'S, NOT PLAIN. DFU writes every file through
// an fsSerializer (:618-640) and the shape on disk carries the library's
// own envelope keys, which this file strips ONCE on the way in so every
// consumer reads C#'s field names and nothing else:
//   - `[fsObject("v1")]` (143 sites in the tree) wraps a versioned type
//     as { "$version": "v1", "$content": { ...fields } };
//   - a polymorphic field (`object effectSpecific`, EntityEffectManager
//     .cs:2218) carries "$type": "Namespace.Type" beside its content;
//   - a class-typed object may carry "$id": "<n>" and a second
//     occurrence of the same object is { "$ref": "<n>" };
//   - a Dictionary with a string key is an object; any other key type
//     is an array of { "Key", "Value" } pairs (`dictEntries` below);
//   - an enum is its NAME by default (SerializeEnumsAsInteger is off),
//     a [Flags] enum a comma-joined list, and a save edited elsewhere
//     may carry the integer instead - `enumValue` reads both;
//   - a 64-bit integer prints as a bare number (Serialize64BitInteger
//     AsString is off). `ulong currentUID` and every quest/item UID are
//     small (DaggerfallUnity.cs:63 seeds them at 0x2000000), but a
//     `realTime` of DateTime ticks and a LoadID cast from a negative
//     GetInstanceID are 18-20 digits - past 2^53, where JSON.parse
//     rounds silently. `parseFsJson` quotes those FIRST, so they arrive
//     as decimal strings and an id compares equal to itself.
//
// Departures (structure only, documented):
//   - File-path plumbing dropped like every reader here: the host hands
//     the save's files as a map of filename -> text (or bytes for the
//     screenshot), and the save set as index -> file map. The
//     Directory.GetDirectories walk is the host's (there is none in a
//     browser); `collectDfuSaveFiles` is its picked-files stand-in and
//     `dfuSaveFilesFromZip` OT1's phone arm over the same shape.
//   - The version gate is SaveInfo_v1.saveVersion against
//     latestSaveVersion (:39, = 1). DFU has no explicit check - a newer
//     schema simply deserialises with missing members - so the port's
//     gate is the RECORDED narrowing: a save from a newer schema throws
//     here, loudly, rather than importing a character with holes.
//
// NOT SEEN AGAINST A REAL SAVE: no DFU save is in the tree (see the
// corpus gate in test/dfusave.test.js, armed for the first one). The
// envelope rules above are Full Serializer's documented format; where
// a real file disagrees, the pin that reads it is the thing to correct.

/** SaveLoadManager.cs:39. */
export const DFU_LATEST_SAVE_VERSION = 1;

/** The file names, verbatim (SaveLoadManager.cs:45-57). Case as DFU
 *  writes them; the collector folds case because a user's copy may not. */
export const DFU_SAVE_INFO = 'SaveInfo.txt';
export const DFU_SAVE_DATA = 'SaveData.txt';
export const DFU_FACTION_DATA = 'FactionData.txt';
export const DFU_CONTAINER_DATA = 'ContainerData.txt';
export const DFU_QUEST_DATA = 'QuestData.txt';
export const DFU_DISCOVERY_DATA = 'DiscoveryData.txt';
export const DFU_CONVERSATION_DATA = 'ConversationData.txt';
export const DFU_NOTEBOOK_DATA = 'NotebookData.txt';
export const DFU_WORLD_VARIATION_DATA = 'WorldVariationData.txt';
export const DFU_AUTOMAP_DATA = 'AutomapData.txt';
export const DFU_QUEST_EXCEPTIONS = 'QuestExceptions.txt';
export const DFU_SCREENSHOT = 'Screenshot.jpg';
export const DFU_BIO_FILE = 'bio.txt';
/** mod_<mod file name>.txt - one per mod that saved state (:1203-1211,
 *  GetModDataFilename :1573-1577: the FILE name, "because title may
 *  contains invalid path chars"). */
export const DFU_MOD_DATA_PREFIX = 'mod_';

/** Every name a save folder can carry, UPPERCASE for the case-folded walk. */
export const DFU_SAVE_FILES = Object.freeze(new Set([
  DFU_SAVE_INFO, DFU_SAVE_DATA, DFU_FACTION_DATA, DFU_CONTAINER_DATA, DFU_QUEST_DATA,
  DFU_DISCOVERY_DATA, DFU_CONVERSATION_DATA, DFU_NOTEBOOK_DATA, DFU_WORLD_VARIATION_DATA,
  DFU_AUTOMAP_DATA, DFU_QUEST_EXCEPTIONS, DFU_SCREENSHOT, DFU_BIO_FILE,
].map((n) => n.toUpperCase())));

/** The folder prefix (SaveLoadManager.cs:42 `savePrefix = "SAVE"`). */
export const DFU_SAVE_PREFIX = 'SAVE';

// ── the Full Serializer envelope ──────────────────────────────────

/** An integer literal of 16+ digits, outside a string. JSON has no
 *  lookbehind for "outside a string" in one regex, so the scan walks
 *  the text and skips string bodies by hand. */
const BIG_INT_DIGITS = 16;

/**
 * JSON.parse with 64-bit integers kept whole: any bare integer literal
 * of 16 or more digits is quoted before the parse and arrives as a
 * decimal string. A 15-digit integer is below 2^53 and stays a number.
 * Strings are skipped so a digit run inside one is never touched.
 * @param {string} text
 * @returns {any}
 */
export function parseFsJson(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      // Copy the string body verbatim, escapes included.
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '"') break;
        j++;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '-' || (c >= '0' && c <= '9')) {
      let j = i;
      if (text[j] === '-') j++;
      const start = j;
      while (j < n && text[j] >= '0' && text[j] <= '9') j++;
      const digits = j - start;
      const isFloat = j < n && (text[j] === '.' || text[j] === 'e' || text[j] === 'E');
      if (!isFloat && digits >= BIG_INT_DIGITS) {
        out += `"${text.slice(i, j)}"`;
        i = j;
        continue;
      }
      // A float or a small integer: copy the whole literal.
      while (j < n && /[0-9.eE+-]/.test(text[j])) j++;
      out += text.slice(i, j);
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return JSON.parse(out);
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Strip Full Serializer's envelope, in place and recursively:
 * `$version` + `$content` collapse to the content, `$id` definitions
 * are collected and `$ref` occurrences replaced by the SAME object,
 * `$type` is kept as a plain field beside the content it describes.
 * Two passes, because a `$ref` can precede its `$id` in the text (the
 * definition is written where the object is first serialised, which
 * is not always first in document order once dictionaries reorder).
 * @template T
 * @param {T} root
 * @returns {T}
 */
export function unwrapFs(root) {
  /** @type {Map<string, any>} */
  const defs = new Map();
  const collapse = (node) => {
    if (Array.isArray(node)) return node.map(collapse);
    if (!isObj(node)) return node;
    const id = node.$id;
    let out;
    if ('$content' in node) {
      out = collapse(node.$content);
      if (isObj(out) && '$type' in node) out.$type = node.$type;
    } else if ('$ref' in node) {
      out = { $ref: String(node.$ref) };
    } else {
      out = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === '$id' || k === '$version') continue;
        out[k] = collapse(v);
      }
    }
    if (id != null) defs.set(String(id), out);
    return out;
  };
  const resolve = (node) => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) node[i] = resolve(node[i]);
      return node;
    }
    if (!isObj(node)) return node;
    if ('$ref' in node && Object.keys(node).length === 1) {
      const target = defs.get(node.$ref);
      if (target === undefined) throw new Error(`DFU save: $ref ${node.$ref} has no $id`);
      return target;
    }
    for (const k of Object.keys(node)) node[k] = resolve(node[k]);
    return node;
  };
  return resolve(collapse(root));
}

/**
 * A Dictionary's entries whichever way fsSerializer wrote it: an object
 * for a string key, an array of { Key, Value } for any other. Keys
 * come back as written (strings for the object arm); a numeric key is
 * the caller's to Number.
 * @param {any} node
 * @returns {Array<[any, any]>}
 */
export function dictEntries(node) {
  if (node == null) return [];
  if (Array.isArray(node)) return node.map((e) => [e?.Key, e?.Value]);
  if (isObj(node)) return Object.entries(node);
  throw new Error('DFU save: not a dictionary');
}

/**
 * An enum's integer value from a save that may carry its NAME (the
 * default), its integer, or a comma-joined [Flags] list. `names` is the
 * enum's { name: value } table. An unknown name throws - a value the
 * table does not know is a schema drift, not a default.
 * @param {any} v
 * @param {Record<string, number>} names
 * @returns {number}
 */
export function enumValue(v, names) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    if (v === '') return 0;   // fsEnumConverter prints a ZERO [Flags] value as the empty string (no member matched) - AUDIT-DFUSAVE R6
    if (/^-?\d+$/.test(v)) return Number(v);
    let out = 0;
    for (const part of v.split(',')) {
      const name = part.trim();
      if (!(name in names)) throw new Error(`DFU save: unknown enum name "${name}"`);
      out |= names[name];
    }
    return out;
  }
  throw new Error(`DFU save: enum expected, got ${typeof v}`);
}

// ── the files ──────────────────────────────────────────────────────

/**
 * @typedef {object} DfuSaveInfo  SaveInfo_v1 (SerializableGameObject.cs:453-460)
 * @property {number} saveVersion
 * @property {string} saveName
 * @property {string} characterName
 * @property {{gameTime: number, realTime: number|string}} dateAndTime  gameTime in DaggerfallDateTime SECONDS; realTime DateTime ticks (a string past 2^53)
 * @property {string} dfuVersion
 */

/** SaveInfo.txt -> SaveInfo_v1. @param {string} text @returns {DfuSaveInfo} */
export function readDfuSaveInfo(text) {
  const info = unwrapFs(parseFsJson(text));
  if (!isObj(info) || typeof info.saveVersion !== 'number') throw new Error('DFU save: SaveInfo.txt is not a SaveInfo_v1');
  return info;
}

/**
 * @typedef {object} DfuSave  one opened save folder, every file parsed
 * @property {number} index  the SAVE<n> slot
 * @property {DfuSaveInfo} info
 * @property {any} saveData  SaveData_v1, envelope stripped
 * @property {any} factionData  FactionData_v2 or null
 * @property {any} questData  QuestMachineData_v1 or null
 * @property {any} discoveryData
 * @property {any} conversationData  TalkManager.SaveDataConversation or null
 * @property {any} notebookData
 * @property {any} worldVariationData
 * @property {any} automapData
 * @property {any} containerData
 * @property {any[]|null} questExceptions
 * @property {string[]} backStory  bio.txt, one line a row
 * @property {Map<string, any>} modData  mod_<name>.txt by its mod file name (UPPERCASE)
 * @property {Uint8Array|null} screenshot  Screenshot.jpg bytes
 */

/**
 * Open one save folder from its files. `files` maps UPPERCASE filename
 * to text (or to bytes for the screenshot). SaveInfo.txt and
 * SaveData.txt are required - the first is the folder's existence
 * (:751), the second its state; the rest are optional exactly as
 * LoadGame's own File.Exists arms and ReadSaveFile's logged null
 * (:723-733) leave them.
 * @param {number} index
 * @param {Record<string, string|Uint8Array>} files
 * @returns {DfuSave}
 */
export function readDfuSave(index, files) {
  const get = (name) => {
    const v = files[name.toUpperCase()];
    if (v == null) return null;
    if (typeof v === 'string') return v;
    return new TextDecoder().decode(v);
  };
  const json = (name) => {
    const t = get(name);
    return t == null ? null : unwrapFs(parseFsJson(t));
  };
  const infoText = get(DFU_SAVE_INFO);
  if (infoText == null) throw new Error(`SAVE${index}: no ${DFU_SAVE_INFO}`);
  const info = readDfuSaveInfo(infoText);
  if (info.saveVersion > DFU_LATEST_SAVE_VERSION) {
    throw new Error(`SAVE${index}: save version ${info.saveVersion} is newer than ${DFU_LATEST_SAVE_VERSION}`);
  }
  if (get(DFU_SAVE_DATA) == null) throw new Error(`SAVE${index}: no ${DFU_SAVE_DATA}`);
  const saveData = json(DFU_SAVE_DATA);
  if (!isObj(saveData) || !isObj(saveData.header)) throw new Error(`SAVE${index}: ${DFU_SAVE_DATA} is not a SaveData_v1`);
  const modData = new Map();
  for (const [name, v] of Object.entries(files)) {
    const m = /^MOD_(.+)\.TXT$/i.exec(name);
    if (m && typeof v === 'string') modData.set(m[1], unwrapFs(parseFsJson(v)));
  }
  const bio = get(DFU_BIO_FILE);
  const shot = files[DFU_SCREENSHOT.toUpperCase()];
  return {
    index,
    info,
    saveData,
    factionData: json(DFU_FACTION_DATA),
    questData: json(DFU_QUEST_DATA),
    discoveryData: json(DFU_DISCOVERY_DATA),
    conversationData: json(DFU_CONVERSATION_DATA),
    notebookData: json(DFU_NOTEBOOK_DATA),
    worldVariationData: json(DFU_WORLD_VARIATION_DATA),
    automapData: json(DFU_AUTOMAP_DATA),
    containerData: json(DFU_CONTAINER_DATA),
    questExceptions: json(DFU_QUEST_EXCEPTIONS),
    // StreamReader.ReadLine drops the terminator; a trailing newline
    // is not an empty last line.
    backStory: bio == null ? [] : bio.split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === '')),
    modData,
    screenshot: shot instanceof Uint8Array ? shot : null,
  };
}

// ── the folder walk ────────────────────────────────────────────────

/**
 * A picked path's SAVE<n> slot and file, or null: a `SAVE<digits>`
 * segment then one of the save's names (or a mod_*.txt),
 * case-folded. DFU's slots are unbounded (SAVE0 upward, :739) unlike
 * the classic six. `folder` is the path up to and including the
 * SAVE<n> segment - the save's identity, because a pick can hold two
 * SAVE0 folders under different parents (a `Saves` beside a
 * `Saves_backup`), and DFU's own folder IS the save (AUDIT-DFUSAVE R2).
 * @param {string} path
 * @returns {{index:number, name:string, folder:string}|null}
 */
export function dfuSaveSlot(path) {
  const m = String(path).match(/^(.*?(?:^|\/)SAVE(\d+))\/([^/]+)$/i);
  if (!m) return null;
  const name = m[3].toUpperCase();
  if (!DFU_SAVE_FILES.has(name) && !/^MOD_.+\.TXT$/.test(name)) return null;
  return { index: Number(m[2]), name, folder: m[1] };
}

/**
 * The Directory.GetDirectories walk over picked file-likes (anything
 * with a path and an `arrayBuffer()` or `text()`): one entry per
 * SAVE<n> FOLDER - `{ index, folder, files: { FILENAME: file } }` -
 * in index order, then folder order, everything else dropped. A
 * folder without SaveInfo.txt is not a save (:751) and is dropped
 * whole. Two folders with the same index are two saves, not one.
 * @param {Iterable<any>} files
 * @returns {Array<{index:number, folder:string, files:Record<string, any>}>}
 */
export function collectDfuSaveFiles(files) {
  /** @type {Map<string, {index:number, folder:string, files:Record<string, any>}>} */
  const byFolder = new Map();
  for (const f of files) {
    const slot = dfuSaveSlot(f.webkitRelativePath || f.name);
    if (!slot) continue;
    let entry = byFolder.get(slot.folder);
    if (!entry) { entry = { index: slot.index, folder: slot.folder, files: {} }; byFolder.set(slot.folder, entry); }
    entry.files[slot.name] = f;
  }
  return [...byFolder.values()]
    .filter((e) => e.files[DFU_SAVE_INFO.toUpperCase()])
    .sort((a, b) => a.index - b.index || (a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0));
}

/**
 * Read one collected folder's file-likes into the text/bytes map
 * `readDfuSave` takes: text for every .txt, bytes for the screenshot.
 * @param {Record<string, any>} slotFiles
 * @returns {Promise<Record<string, string|Uint8Array>>}
 */
export async function loadDfuSaveFiles(slotFiles) {
  /** @type {Record<string, string|Uint8Array>} */
  const out = {};
  for (const [name, f] of Object.entries(slotFiles)) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    out[name] = name === DFU_SCREENSHOT.toUpperCase() ? bytes : new TextDecoder().decode(bytes);
  }
  return out;
}

/**
 * OT1's phone path over this format: a zipped `Saves` folder (or one
 * zipped SAVE<n>) reaches the same collector, the archive's own paths
 * standing in for webkitRelativePath. Only the save's own names under
 * a SAVE<n> segment inflate.
 * @param {(file: any, opts: {pick: (names: string[]) => string[]}) => Promise<Array<{name: string, data: Uint8Array}>>} readZipEntries
 * @param {any} file
 */
export async function dfuSaveFilesFromZip(readZipEntries, file) {
  const entries = await readZipEntries(file, { pick: (names) => names.filter((n) => dfuSaveSlot(n) != null) });
  return entries.map(({ name, data }) => ({ webkitRelativePath: name, arrayBuffer: async () => data }));
}
