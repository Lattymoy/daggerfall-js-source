// DA2: the desktop shell's file-backed save store, and the DA1 seam
// that hands it to the game. The store is plain Node (no Electron),
// so the laws are tested HERE, in the same suite as everything else:
//
//   - the on-disk shape IS DFU's: Saves/SAVE<n>/SaveData.txt +
//     SaveInfo.txt + Screenshot.jpg, prefs under Prefs/;
//   - localStorage's five words hold (null for absent, byte-identical
//     round trips, live enumeration);
//   - the REAL saveSlots laws run over it unchanged - the same
//     save/overwrite/enumerate/delete sweep the localStorage stub
//     drives in saveslots.test.js, driven through appStorage's wrap;
//   - the prefix spellings cannot drift from saveSlots' exports
//     (fileStorage is CommonJS and restates them).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import {
  SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX,
  saveSlot, enumerateSaves, loadSlot, deleteSave, findSave, screenshotOf,
  QUICK_SAVE_NAME,
} from '../src/systems/saveSlots.js';
import { QUICKSAVE_KEY } from '../src/systems/save.js';
import { appStorage } from '../src/systems/appStorage.js';

const require = createRequire(import.meta.url);
const fileStorage = require('../app/lib/fileStorage.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-fs-'));
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });

// A jpeg-shaped data URL, the exact string toDataURL('image/jpeg')
// produces (capturePendingScreenshot's output).
const SHOT_URL = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64')}`;

test('prefix pin: the CommonJS store and the ESM slots agree on every key spelling', () => {
  assert.equal(fileStorage.SAVE_DATA_PREFIX, SAVE_DATA_PREFIX);
  assert.equal(fileStorage.SAVE_INFO_PREFIX, SAVE_INFO_PREFIX);
  assert.equal(fileStorage.SAVE_SHOT_PREFIX, SAVE_SHOT_PREFIX);
});

test('slot keys become DFU-shaped files; prefs become Prefs/ files', () => {
  const root = tmp();
  try {
    const s = fileStorage.createFileStorage(root);
    s.setItem('dagger.save.0', '{"v":1}');
    s.setItem('dagger.saveinfo.0', '{"saveName":"QuickSave"}');
    s.setItem('dagger.saveshot.0', SHOT_URL);
    s.setItem('dagger.settings.v1', '{"Video":{}}');
    assert.ok(fs.existsSync(path.join(root, 'Saves', 'SAVE0', 'SaveData.txt')));
    assert.ok(fs.existsSync(path.join(root, 'Saves', 'SAVE0', 'SaveInfo.txt')));
    assert.ok(fs.existsSync(path.join(root, 'Saves', 'SAVE0', 'Screenshot.jpg')));
    assert.ok(fs.existsSync(path.join(root, 'Prefs', 'dagger.settings.v1')));
    // the screenshot is a REAL jpeg on disk (starts with the SOI marker)...
    const jpg = fs.readFileSync(path.join(root, 'Saves', 'SAVE0', 'Screenshot.jpg'));
    assert.equal(jpg[0], 0xff); assert.equal(jpg[1], 0xd8);
    // ...and comes back as the identical data URL
    assert.equal(s.getItem('dagger.saveshot.0'), SHOT_URL);
    // byte-identical round trips for the JSON halves (the migration's
    // write-then-verify law depends on this)
    assert.equal(s.getItem('dagger.save.0'), '{"v":1}');
    assert.equal(s.getItem('dagger.settings.v1'), '{"Video":{}}');
  } finally { rm(root); }
});

test('the five words: null for absent, live enumeration, removal drops the folder', () => {
  const root = tmp();
  try {
    const s = fileStorage.createFileStorage(root);
    assert.equal(s.length(), 0);
    assert.equal(s.getItem('dagger.save.9'), null);
    assert.equal(s.key(0), null);
    s.setItem('dagger.save.2', 'A');
    s.setItem('dagger.keybinds', 'B');
    assert.equal(s.length(), 2);
    const seen = new Set([s.key(0), s.key(1)]);
    assert.ok(seen.has('dagger.save.2') && seen.has('dagger.keybinds'));
    s.removeItem('dagger.save.2');
    assert.equal(s.getItem('dagger.save.2'), null);
    assert.equal(s.length(), 1);
    // the emptied SAVE2 folder is gone with its last file
    assert.ok(!fs.existsSync(path.join(root, 'Saves', 'SAVE2')));
    s.removeItem('dagger.save.2');   // removing the absent is a no-op, not a throw
  } finally { rm(root); }
});

test('a fresh instance re-reads the disk: saves persist across a restart', () => {
  const root = tmp();
  try {
    const a = fileStorage.createFileStorage(root);
    a.setItem('dagger.save.1', 'data');
    a.setItem('dagger.saveinfo.1', 'info');
    a.setItem('dagger.ui.v1', '{"skin":"enhanced"}');
    const b = fileStorage.createFileStorage(root);   // "the next launch"
    assert.equal(b.length(), 3);
    assert.equal(b.getItem('dagger.save.1'), 'data');
    assert.equal(b.getItem('dagger.ui.v1'), '{"skin":"enhanced"}');
  } finally { rm(root); }
});

test('non-canonical slot spellings cannot collide with a real slot', () => {
  const root = tmp();
  try {
    const s = fileStorage.createFileStorage(root);
    s.setItem('dagger.save.03', 'padded');   // localStorage keeps this distinct; so must files
    s.setItem('dagger.save.3', 'real');
    assert.equal(s.getItem('dagger.save.3'), 'real');
    assert.equal(s.getItem('dagger.save.03'), 'padded');
    assert.ok(fs.existsSync(path.join(root, 'Prefs', 'dagger.save.03')));   // a pref, not a slot
  } finally { rm(root); }
});

test('pref filenames are reversible and Windows-legal for any key', () => {
  for (const key of ['dagger.quicksave', 'weird key*with:chars?', 'ünïcode/…']) {
    const name = fileStorage.encodePrefName(key);
    assert.match(name, /^[A-Za-z0-9._%-]+$/);
    assert.equal(fileStorage.decodePrefName(name), key);
  }
});

// ---- the seam (DA1) ------------------------------------------------

function bridgeOver(store) {
  return {
    length: () => store.length(),
    key: (i) => store.key(i),
    getItem: (k) => store.getItem(k),
    setItem: (k, v) => store.setItem(k, v),
    removeItem: (k) => store.removeItem(k),
  };
}

test('appStorage prefers the shell bridge, falls back to localStorage, then null', () => {
  const prevShell = globalThis.daggerShell;
  const prevLs = globalThis.localStorage;
  try {
    delete globalThis.daggerShell;
    delete globalThis.localStorage;
    assert.equal(appStorage(), null);
    globalThis.localStorage = { getItem: () => null };
    assert.equal(appStorage(), globalThis.localStorage);
    const root = tmp();
    try {
      globalThis.daggerShell = { storage: bridgeOver(fileStorage.createFileStorage(root)) };
      const s = appStorage();
      assert.notEqual(s, globalThis.localStorage);
      s.setItem('dagger.save.0', 'x');
      assert.equal(s.length, 1);            // localStorage's PROPERTY shape, over the function bridge
      assert.equal(s.key(0), 'dagger.save.0');
      assert.equal(s.getItem('dagger.save.0'), 'x');
    } finally { rm(root); }
  } finally {
    if (prevShell === undefined) delete globalThis.daggerShell; else globalThis.daggerShell = prevShell;
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});

test('the REAL saveSlots laws run over files unchanged', () => {
  const prevShell = globalThis.daggerShell;
  const root = tmp();
  try {
    globalThis.daggerShell = { storage: bridgeOver(fileStorage.createFileStorage(root)) };
    const storage = appStorage();
    const snap = { v: 1, name: 'Aliera', classicMinutes: 12345 };

    // Save -> the (characterName, saveName) identity, on disk
    const { ok, key } = saveSlot('Aliera', 'First', snap, { storage, screenshot: SHOT_URL, now: 1000 });
    assert.ok(ok);
    assert.equal(key, 0);
    assert.ok(fs.existsSync(path.join(root, 'Saves', 'SAVE0', 'SaveInfo.txt')));
    assert.equal(screenshotOf(key, storage), SHOT_URL);

    // Overwrite law: the same pair overwrites its slot
    const again = saveSlot('Aliera', 'First', { ...snap, classicMinutes: 99 }, { storage, now: 2000 });
    assert.equal(again.key, 0);
    assert.equal(loadSlot(0, storage).classicMinutes, 99);
    // ...and an overwrite without a capture drops the stale picture
    assert.equal(screenshotOf(0, storage), null);
    assert.ok(!fs.existsSync(path.join(root, 'Saves', 'SAVE0', 'Screenshot.jpg')));

    // A new pair takes the first free key
    const second = saveSlot('Aliera', 'Second', snap, { storage, now: 3000 });
    assert.equal(second.key, 1);

    // Enumeration only admits slots WITH SaveInfo (the must-exist law)
    fs.rmSync(path.join(root, 'Saves', 'SAVE1', 'SaveInfo.txt'));
    globalThis.daggerShell = { storage: bridgeOver(fileStorage.createFileStorage(root)) };   // a restart re-reads the disk
    const s2 = appStorage();
    const { info } = enumerateSaves(s2);
    assert.ok(info.has(0));
    assert.ok(!info.has(1));   // orphaned data blob does not enumerate

    // Delete removes the known files and the identity misses
    assert.ok(deleteSave(0, s2));
    assert.equal(findSave('Aliera', 'First', s2), -1);
    assert.ok(!fs.existsSync(path.join(root, 'Saves', 'SAVE0')));
  } finally {
    if (prevShell === undefined) delete globalThis.daggerShell; else globalThis.daggerShell = prevShell;
    rm(root);
  }
});

// ---- AUDIT DA: the findings' pins -----------------------------------

test('rescan admits only CANONICAL SAVE<n> dirs - a padded twin cannot ghost or duplicate a slot', () => {
  const root = tmp();
  try {
    // The real slot, and a hand-renamed padded twin beside it.
    for (const dir of ['SAVE3', 'SAVE03']) {
      fs.mkdirSync(path.join(root, 'Saves', dir), { recursive: true });
      fs.writeFileSync(path.join(root, 'Saves', dir, 'SaveData.txt'), dir);
      fs.writeFileSync(path.join(root, 'Saves', dir, 'SaveInfo.txt'), '{}');
    }
    const s = fileStorage.createFileStorage(root);
    const keys = [];
    for (let i = 0; i < s.length(); i++) keys.push(s.key(i));
    // Distinct keys only (localStorage's enumeration law), and the
    // canonical dir is the one every key actually reads.
    assert.equal(new Set(keys).size, keys.length, `duplicate keys enumerated: ${keys}`);
    assert.deepEqual(keys.filter((k) => k.startsWith('dagger.save')).sort(),
      ['dagger.save.3', 'dagger.saveinfo.3'].sort());
    assert.equal(s.getItem('dagger.save.3'), 'SAVE3');
  } finally { rm(root); }
});

test('a save copied into the OPEN folder appears on the next sweep (the TTL rescan)', () => {
  const root = tmp();
  try {
    const s = fileStorage.createFileStorage(root, { scanTtlMs: 0 });   // 0 = every length() re-reads
    assert.equal(s.length(), 0);
    // "back up with a plain copy", in reverse - files placed by hand
    // while the store is live.
    fs.mkdirSync(path.join(root, 'Saves', 'SAVE1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Saves', 'SAVE1', 'SaveData.txt'), 'restored');
    assert.equal(s.length(), 1);
    assert.equal(s.getItem('dagger.save.1'), 'restored');
  } finally { rm(root); }
});

test('the empty key cannot brick the pref store', () => {
  const root = tmp();
  try {
    const s = fileStorage.createFileStorage(root);
    s.setItem('', 'nothing much');
    assert.equal(s.getItem(''), 'nothing much');
    // The write that used to throw EEXIST against a FILE named Prefs:
    s.setItem('dagger.settings.v1', '{"ok":true}');
    assert.equal(s.getItem('dagger.settings.v1'), '{"ok":true}');
    const b = fileStorage.createFileStorage(root);   // and it survives a restart, enumerated
    const keys = []; for (let i = 0; i < b.length(); i++) keys.push(b.key(i));
    assert.ok(keys.includes('') && keys.includes('dagger.settings.v1'), `got ${JSON.stringify(keys)}`);
  } finally { rm(root); }
});

test('crash leftovers use a marker no key can mint - tmp-shaped keys survive a restart, ~tmp files never enumerate', () => {
  const root = tmp();
  try {
    const a = fileStorage.createFileStorage(root);
    a.setItem('myext.tmp-5', 'value');   // the spelling the OLD filter swallowed after restart
    fs.writeFileSync(path.join(root, 'Prefs', 'dagger.keybinds~tmp999'), 'torn');   // a crash's leftover
    const b = fileStorage.createFileStorage(root);
    const keys = []; for (let i = 0; i < b.length(); i++) keys.push(b.key(i));
    assert.deepEqual(keys, ['myext.tmp-5']);
    assert.equal(b.getItem('myext.tmp-5'), 'value');
    // and a literal '~' in a key is escaped, so it cannot fake a leftover
    assert.ok(!fileStorage.encodePrefName('a~tmp1').includes('~'));
  } finally { rm(root); }
});

test('Windows-reserved names and trailing dots encode to safe, reversible filenames', () => {
  for (const key of ['CON', 'NUL', 'com1', 'lpt9', 'CON.json', 'foo.', 'dagger.']) {
    const name = fileStorage.encodePrefName(key);
    assert.ok(!/^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)/i.test(name), `${key} -> ${name} still reserved`);
    assert.ok(!name.endsWith('.'), `${key} -> ${name} keeps the trailing dot NTFS strips`);
    assert.equal(fileStorage.decodePrefName(name), key);
  }
});

test('after a torn screenshot overwrite, the NEWEST spelling wins', () => {
  const root = tmp();
  try {
    const dir = path.join(root, 'Saves', 'SAVE0');
    fs.mkdirSync(dir, { recursive: true });
    // The crash state: old jpg still present, new png already written.
    fs.writeFileSync(path.join(dir, 'Screenshot.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    fs.writeFileSync(path.join(dir, 'Screenshot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const past = new Date(Date.now() - 60000);
    fs.utimesSync(path.join(dir, 'Screenshot.jpg'), past, past);
    const s = fileStorage.createFileStorage(root);
    assert.match(s.getItem('dagger.saveshot.0'), /^data:image\/png;base64,/);
  } finally { rm(root); }
});

test('an image MIME with no honest extension stays verbatim - never webp bytes wearing a .jpg name', () => {
  const root = tmp();
  try {
    const s = fileStorage.createFileStorage(root);
    const webp = 'data:image/webp;base64,UklGRg==';
    s.setItem('dagger.saveshot.2', webp);
    assert.equal(s.getItem('dagger.saveshot.2'), webp);   // byte-identical, MIME intact
    assert.ok(!fs.existsSync(path.join(root, 'Saves', 'SAVE2', 'Screenshot.jpg')));
    assert.ok(fs.existsSync(path.join(root, 'Saves', 'SAVE2', 'Screenshot.dataurl')));
  } finally { rm(root); }
});

test('the legacy quicksave migration holds over files: write, VERIFY, then remove', () => {
  const prevShell = globalThis.daggerShell;
  const root = tmp();
  try {
    const seed = fileStorage.createFileStorage(root);
    seed.setItem(QUICKSAVE_KEY, JSON.stringify({ v: 1, name: 'Old Hand', classicMinutes: 777 }));
    globalThis.daggerShell = { storage: bridgeOver(fileStorage.createFileStorage(root)) };
    const storage = appStorage();
    const { info } = enumerateSaves(storage);   // migration runs inside the sweep
    const migrated = [...info.values()].find((i) => i.saveName === QUICK_SAVE_NAME);
    assert.ok(migrated, 'legacy quicksave did not become a slot');
    assert.equal(migrated.characterName, 'Old Hand');
    assert.equal(storage.getItem(QUICKSAVE_KEY), null, 'legacy key must be removed after the verified write');
    assert.ok(fs.existsSync(path.join(root, 'Saves', 'SAVE0', 'SaveData.txt')));
  } finally {
    if (prevShell === undefined) delete globalThis.daggerShell; else globalThis.daggerShell = prevShell;
    rm(root);
  }
});

// ---- AUDIT DA: the two drift pins -----------------------------------

test('PIN: no storage consumer bypasses the seam - globalThis.localStorage lives in appStorage.js alone', () => {
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith('.js') && rel !== 'src/systems/appStorage.js'
        && fs.readFileSync(path.join(root, rel), 'utf8').includes('globalThis.localStorage')) offenders.push(rel);
    }
  };
  walk('src');
  // A sixth consumer would work in every browser and silently split
  // its data out of the desktop app's file store. Route it through
  // systems/appStorage.js instead.
  assert.deepEqual(offenders, []);
});

test('PIN: the shell serves arena2 by the dev middleware\'s own rules - the literals may not drift apart', () => {
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  const vite = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'app', 'main.cjs'), 'utf8');
  // The three serving laws, as literals both sides must carry: the
  // flat-name gate, the BOOKS fallback for BOK*.TXT, and the
  // case-insensitive uppercase map.
  for (const law of ['/^[A-Za-z0-9._-]+$/', String.raw`/^BOK\d+\.TXT$/i`, '.toUpperCase()']) {
    assert.ok(vite.includes(law), `vite middleware lost its own law: ${law}`);
    assert.ok(shell.includes(law), `app/main.cjs drifted from the dev middleware: missing ${law}`);
  }
  // And the Locate-ARENA2 ingest wipe must clear exactly the stores
  // dataSource.clearStoredData clears (the set + derived, never the
  // player's packs) in the database dataSource names.
  const dataSource = fs.readFileSync(path.join(root, 'src', 'scenes', 'dataSource.js'), 'utf8');
  for (const name of ["'project-dagger'", "'arena2'", "'derived'"]) {
    assert.ok(dataSource.includes(name), `dataSource.js renamed ${name} - update app/main.cjs's clearStoredArena2`);
    assert.ok(shell.includes(name), `app/main.cjs's ingest wipe is missing ${name}`);
  }
});
