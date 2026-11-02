// STORE-CACHE (2026-10-11, a profile of the live desktop client in a town: 19% of the main thread was readFileSync) -
// THE DESKTOP STORE ANSWERS A READ FROM MEMORY, AS localStorage DOES. The game's readers ask storage as if it were free:
// the professions' book asks the signed-in session for every harvest node near the player, every frame, and the remains
// waypoint, the claims and the weapon's glyphs each read their key a frame too. app/lib/fileStorage.cjs kept no copy, so
// every one of those was a file read. A pref or slot file is now kept as last read or written and read again after
// readTtlMs, or at once after an enumeration sweep's rescan - a file changed by hand is still seen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createFileStorage } = require('../../app/lib/fileStorage.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-sc-'));
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });
/** The disk reads `fn` makes - the store's fs is this fs (one module object, CommonJS and ESM alike). */
const readsOf = (fn) => {
  const real = fs.readFileSync;
  let n = 0;
  fs.readFileSync = (...a) => { n++; return real.apply(fs, a); };
  try { fn(); } finally { fs.readFileSync = real; }
  return n;
};

test('a key read every frame is read from disk once a readTtlMs, and a written one not at all', () => {
  const root = tmp();
  try {
    const s = createFileStorage(root, { readTtlMs: 60_000 });
    s.setItem('dfjs.account.session', '{"id":"a1","secret":"s"}');
    s.setItem('dagger.save.0', '{"v":1}');
    const fresh = createFileStorage(root, { readTtlMs: 60_000 });
    // a frame's three hundred asks: what the store wrote it never reads back; what it found on disk, once
    assert.equal(readsOf(() => { for (let i = 0; i < 300; i++) assert.equal(s.getItem('dfjs.account.session'), '{"id":"a1","secret":"s"}'); }), 0);
    assert.equal(readsOf(() => { for (let i = 0; i < 300; i++) assert.equal(fresh.getItem('dfjs.account.session'), '{"id":"a1","secret":"s"}'); }), 1);
    assert.equal(readsOf(() => { for (let i = 0; i < 300; i++) assert.equal(fresh.getItem('dagger.save.0'), '{"v":1}'); }), 1);
    // an absent key is kept as absent
    assert.equal(readsOf(() => { for (let i = 0; i < 300; i++) assert.equal(fresh.getItem('dfjs.wild.remainsWp'), null); }), 1);
    // the screenshot is never kept: the disk says its spelling
    s.setItem('dagger.saveshot.0', `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`);
    assert.equal(readsOf(() => { s.getItem('dagger.saveshot.0'); s.getItem('dagger.saveshot.0'); }), 2);
  } finally { rm(root); }
});

test('a file changed by hand is seen after readTtlMs, and at once by the next enumeration sweep', () => {
  const root = tmp();
  try {
    const kept = createFileStorage(root, { readTtlMs: 60_000, scanTtlMs: 60_000 });
    const live = createFileStorage(root, { readTtlMs: 0 });
    kept.setItem('dagger.save.1', 'mine');
    assert.equal(live.getItem('dagger.save.1'), 'mine');
    fs.writeFileSync(path.join(root, 'Saves', 'SAVE1', 'SaveData.txt'), 'restored');   // a backup copied in
    assert.equal(live.getItem('dagger.save.1'), 'restored');   // past its readTtlMs: the disk
    assert.equal(kept.getItem('dagger.save.1'), 'mine');       // inside it: memory
    kept.rescan();                                             // what length() runs past scanTtlMs, before a sweep
    assert.equal(kept.getItem('dagger.save.1'), 'restored');
  } finally { rm(root); }
});

test('a write or a remove leaves nothing stale: the next read is the disk\'s truth', () => {
  const root = tmp();
  try {
    const s = createFileStorage(root, { readTtlMs: 60_000 });
    s.setItem('dagger.keybinds', 'old');
    s.setItem('dagger.keybinds', 'new');
    assert.equal(s.getItem('dagger.keybinds'), 'new');
    s.removeItem('dagger.keybinds');
    assert.equal(s.getItem('dagger.keybinds'), null);
    // a write that throws (here: a folder stands where the file goes) answers what the disk holds, not the old text
    s.setItem('dagger.ui.v1', 'was');
    const file = path.join(root, 'Prefs', 'dagger.ui.v1');
    fs.rmSync(file);
    fs.mkdirSync(file);
    assert.throws(() => s.setItem('dagger.ui.v1', 'next'));
    assert.equal(s.getItem('dagger.ui.v1'), null);
  } finally { rm(root); }
});
