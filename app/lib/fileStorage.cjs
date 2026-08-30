// DA2: THE FILE-BACKED SAVE STORE - what "a proper local save
// structure" means once there is a disk to put one on.
//
// The game's storage owners all speak localStorage's five words
// (length / key / getItem / setItem / removeItem) through the DA1 seam
// (src/systems/appStorage.js), and the browser build keeps speaking
// them to localStorage. This module gives the desktop shell the same
// five words over REAL FILES, in DFU's own on-disk layout - the one
// SaveLoadManager writes under Application.persistentDataPath:
//
//   <root>/Saves/SAVE<n>/SaveData.txt     dagger.save.<n>
//   <root>/Saves/SAVE<n>/SaveInfo.txt     dagger.saveinfo.<n>
//   <root>/Saves/SAVE<n>/Screenshot.jpg   dagger.saveshot.<n>
//   <root>/Prefs/<key>                    everything else (settings,
//                                         keybinds, ui prefs, the
//                                         legacy quicksave blob)
//
// DFU's SaveData/SaveInfo "txt" files hold JSON, and so do these -
// the exact strings saveSlots.js writes, byte for byte, so the
// migration's write-then-VERIFY round trip (saveSlots.js:105) holds
// over files exactly as it does over localStorage. The screenshot is
// the one translation: the game hands a data URL, the disk gets a
// real JPEG a player can open, and getItem re-wraps it. Nothing in
// the game compares screenshot strings, so the translation is safe.
//
// Why files at all: they survive a cleared browser profile, they back
// up with a plain copy of the Saves folder, they can be diffed and
// hand-edited, and "where are my saves?" has a pointable answer.
//
// LAWS KEPT FROM THE CALLERS' SIDE:
//   - a slot key is a NON-NEGATIVE CANONICAL integer ('3', never
//     '03') - anything else is not a slot and lives in Prefs, which
//     mirrors saveSlots' own int-gate on enumeration;
//   - getItem answers null for absent, exactly localStorage;
//   - setItem THROWS on failure (disk full, permissions) - the
//     callers' quota try/catch is the contract, and swallowing here
//     would turn "save failed" into silent loss;
//   - key(i) enumerates a LIVE index kept in step with every write,
//     because enumerateSaves sweeps `for (i < length) key(i)` and a
//     stale index would hide a slot or show a ghost.
//
// Writes are TEMP-THEN-RENAME: a mid-write crash leaves the old file
// whole, which is the manifest-last instinct the ingest already
// proved out, applied per file.
//
// Plain Node, no Electron imports - the preload requires it, and the
// repo's own `node --test` suite exercises it directly
// (test/filestorage.test.js).

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// The prefixes are saveSlots.js's exports, restated because this file
// is CommonJS in the shell and must not import the ESM game. The pin
// in test/filestorage.test.js asserts the two spellings agree.
const SAVE_DATA_PREFIX = 'dagger.save.';
const SAVE_INFO_PREFIX = 'dagger.saveinfo.';
const SAVE_SHOT_PREFIX = 'dagger.saveshot.';

const SAVES_DIR = 'Saves';
const PREFS_DIR = 'Prefs';
const DATA_FILE = 'SaveData.txt';
const INFO_FILE = 'SaveInfo.txt';
// The screenshot's possible spellings, in read order. .jpg is what
// capturePendingScreenshot produces (toDataURL('image/jpeg')); .png
// covers any future capture change; .dataurl is the verbatim fallback
// for a value that is not a decodable data URL at all.
const SHOT_FILES = [
  ['Screenshot.jpg', 'image/jpeg'],
  ['Screenshot.png', 'image/png'],
  ['Screenshot.dataurl', null],
];

/** 'dagger.save.3' -> { kind:'data', n:3 }, or null for a non-slot
 *  key. Canonical integers only - String(Number(s)) === s - so a key
 *  localStorage would keep distinct ('dagger.save.03') cannot collide
 *  with a real slot's file. */
function slotOf(key) {
  for (const [prefix, kind] of [
    [SAVE_DATA_PREFIX, 'data'],
    [SAVE_INFO_PREFIX, 'info'],
    [SAVE_SHOT_PREFIX, 'shot'],
  ]) {
    if (key.startsWith(prefix)) {
      const tail = key.slice(prefix.length);
      const n = Number(tail);
      if (Number.isInteger(n) && n >= 0 && String(n) === tail) return { kind, n };
    }
  }
  return null;
}

/** A pref key as a filename: every byte outside [A-Za-z0-9._-] is
 *  %XX-escaped (UTF-8), so the name is Windows-legal and
 *  decodeURIComponent inverts it exactly. The game's real keys
 *  (dagger.settings.*, dagger.keybinds, dagger.ui.v1,
 *  dagger.quicksave) pass through unescaped and readable. */
function encodePrefName(key) {
  return encodeURIComponent(key).replace(/[^A-Za-z0-9._%-]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
}
function decodePrefName(name) {
  try { return decodeURIComponent(name); } catch { return null; }
}

/** data URL -> { mime, bytes } or null. */
function parseDataUrl(value) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]*)$/i.exec(value);
  if (!m) return null;
  try { return { mime: m[1].toLowerCase(), bytes: Buffer.from(m[2], 'base64') }; }
  catch { return null; }
}

/** Temp-then-rename, directories made on the way. */
function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

/**
 * The store. `root` is the shell's user-data directory; everything
 * this writes lives under root/Saves and root/Prefs and nothing else.
 *
 * @returns {{ length:()=>number, key:(i:number)=>string|null,
 *             getItem:(k:string)=>string|null,
 *             setItem:(k:string,v:string)=>void,
 *             removeItem:(k:string)=>void,
 *             rescan:()=>void, root:string }}
 */
function createFileStorage(root) {
  const savesDir = path.join(root, SAVES_DIR);
  const prefsDir = path.join(root, PREFS_DIR);
  const slotDir = (n) => path.join(savesDir, `SAVE${n}`);

  // ---- the paths, per key ----
  const fileOf = (key) => {
    const slot = slotOf(key);
    if (!slot) return { pref: path.join(prefsDir, encodePrefName(key)) };
    if (slot.kind === 'data') return { file: path.join(slotDir(slot.n), DATA_FILE) };
    if (slot.kind === 'info') return { file: path.join(slotDir(slot.n), INFO_FILE) };
    return { shotDir: slotDir(slot.n) };   // shot: spelling depends on the value
  };

  const shotFileOn = (dir) => {
    for (const [name, mime] of SHOT_FILES) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return { path: p, mime };
    }
    return null;
  };

  // ---- the live index (the enumeration half of localStorage) ----
  let keys = [];
  const rescan = () => {
    keys = [];
    let slots = [];
    try {
      slots = fs.readdirSync(savesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => /^SAVE(\d+)$/.exec(e.name))
        .filter(Boolean)
        .map((m) => Number(m[1]))
        .filter((n) => Number.isInteger(n) && n >= 0);
    } catch { /* no Saves yet */ }
    slots.sort((a, b) => a - b);
    for (const n of slots) {
      const dir = slotDir(n);
      if (fs.existsSync(path.join(dir, DATA_FILE))) keys.push(SAVE_DATA_PREFIX + n);
      if (fs.existsSync(path.join(dir, INFO_FILE))) keys.push(SAVE_INFO_PREFIX + n);
      if (shotFileOn(dir)) keys.push(SAVE_SHOT_PREFIX + n);
    }
    try {
      for (const e of fs.readdirSync(prefsDir, { withFileTypes: true })) {
        if (!e.isFile()) continue;
        if (/\.tmp-\d+$/.test(e.name)) continue;   // a crash's leftover, not a key
        const k = decodePrefName(e.name);
        if (k != null) keys.push(k);
      }
    } catch { /* no Prefs yet */ }
  };
  rescan();
  const indexAdd = (k) => { if (!keys.includes(k)) keys.push(k); };
  const indexDrop = (k) => { const i = keys.indexOf(k); if (i !== -1) keys.splice(i, 1); };

  // ---- the five words ----
  return {
    root,
    rescan,
    length: () => keys.length,
    key: (i) => keys[i] ?? null,

    getItem(key) {
      key = String(key);
      const at = fileOf(key);
      try {
        if (at.pref) return fs.readFileSync(at.pref, 'utf8');
        if (at.file) return fs.readFileSync(at.file, 'utf8');
        const shot = shotFileOn(at.shotDir);
        if (!shot) return null;
        if (!shot.mime) return fs.readFileSync(shot.path, 'utf8');   // the verbatim fallback
        return `data:${shot.mime};base64,${fs.readFileSync(shot.path).toString('base64')}`;
      } catch { return null; }   // absent reads as null, localStorage's answer
    },

    setItem(key, value) {
      key = String(key);
      value = String(value);
      const at = fileOf(key);
      if (at.pref || at.file) {
        writeAtomic(at.pref ?? at.file, value);
      } else {
        // The screenshot: a decodable data URL becomes a real image
        // file; anything else is kept verbatim. Whichever spelling
        // wins, the OTHERS are removed - a slot has one screenshot.
        const parsed = parseDataUrl(value);
        const target = parsed
          ? (parsed.mime === 'image/png' ? 'Screenshot.png' : 'Screenshot.jpg')
          : 'Screenshot.dataurl';
        writeAtomic(path.join(at.shotDir, target), parsed ? parsed.bytes : value);
        for (const [name] of SHOT_FILES) {
          if (name === target) continue;
          try { fs.rmSync(path.join(at.shotDir, name), { force: true }); } catch { /* leftover only */ }
        }
      }
      indexAdd(key);   // after the write - a thrown write adds no ghost key
    },

    removeItem(key) {
      key = String(key);
      const at = fileOf(key);
      try {
        if (at.pref || at.file) fs.rmSync(at.pref ?? at.file, { force: true });
        else for (const [name] of SHOT_FILES) fs.rmSync(path.join(at.shotDir, name), { force: true });
      } catch { /* removing what is not there is localStorage's no-op */ }
      indexDrop(key);
      // An emptied SAVE<n> folder goes with its last file, so deleted
      // slots do not litter the Saves directory the player browses.
      const dir = at.shotDir ?? (at.file ? path.dirname(at.file) : null);
      if (dir) { try { if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir); } catch { /* busy or gone */ } }
    },
  };
}

module.exports = {
  createFileStorage,
  // exported for the test pins
  SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX,
  encodePrefName, decodePrefName, parseDataUrl,
};
