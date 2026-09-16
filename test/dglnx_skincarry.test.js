// DG-LNX + SKIN-CARRY (2026-09-16, two reports relayed by Mac).
//
// DG-LNX (Ember, Linux): "Picking the arena2 folder doesn't work.
// Picking a zip with the game files does though." The zip arm of the
// data gate was wrapped and reported; the folder arm was an unguarded
// async listener, so a read that threw left the screen on "reading N
// files..." for ever, and an empty pick - what a sandboxed browser's
// portal dialog hands over for a whole directory - said "no usable
// files" and nothing more. Both say what happened now and name the
// route that works on that setup.
//
// SKIN-CARRY: "the classic toggle starts the game in enhanced." The
// choice's only carrier across the toggle's reload was the pref write,
// and its failure was swallowed at three layers. A refused store comes
// back as null now and the toggle carries the choice on the URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { setPref, getPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { FOLDER_PICK_HINT } from '../src/scenes/dataSource.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

test('SKIN-CARRY: a refused store answers false from setPref and null from setUiSkin, and the in-memory choice still stands for this page (mutant: the answer swallowed again)', () => {
  _resetForTests();
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: () => { throw new Error('QuotaExceededError: storage is blocked'); }, removeItem: (k) => store.delete(k) },
  });
  const warn = console.warn; const said = [];
  console.warn = (...a) => said.push(a.map(String).join(' '));
  try {
    assert.equal(setPref('hudScale', 2), false, 'the store refused');
    assert.equal(getPref('hudScale'), 2, 'the page still has the choice');
    assert.equal(setUiSkin('classic'), null, 'the skin: a refused write is null, not the skin');
    assert.equal(uiSkin(''), 'classic', 'and the choice holds in memory for this page load');
    assert.ok(said.some((m) => /screen preferences could not be saved/.test(m)), 'still said out loud');
  } finally {
    console.warn = warn;
    if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage;
    _resetForTests();
  }
  assert.equal(setUiSkin('enhanced'), 'enhanced', 'a store that takes the write answers the skin');
  assert.equal(setUiSkin('nonsense'), 'enhanced', 'a typo is not a choice');
  _resetForTests();
});

test('SKIN-CARRY by source: switchSkin reads the store’s word and carries a refused choice on the reload URL, and deletes the override otherwise (mutant: the carry dropped, or the override left standing)', () => {
  const menu = rd('src/ui/enhancedMenu.js');
  const fn = menu.slice(menu.indexOf('export function switchSkin('), menu.indexOf('\n}\n', menu.indexOf('export function switchSkin(')) + 3);
  assert.match(fn, /const stored = setUiSkin\(to\);/);
  assert.match(fn, /url\.searchParams\.delete\('skin'\);/, 'a stored choice rides no override');
  assert.match(fn, /if \(stored === null\) url\.searchParams\.set\('skin', to\);/, 'a refused one rides the URL');
  assert.match(fn, /location\.replace\(url\.toString\(\)\);/);
  assert.match(rd('src/systems/uiSkin.js'), /return setPref\('skin', skin\) === false \? null : skin;/);
  assert.match(rd('src/systems/uiPrefs.js'), /export function setPref\(k, v\) \{ if \(_prefs === null\) loadPrefs\(\); _prefs\[k\] = v; return savePrefs\(\); \}/);
});

test('DG-LNX by source: the folder arm is guarded like the zip arm, reports progress, and names the zip and the drop when the browser hands over nothing or the read throws (mutant: the guard or the hint dropped)', () => {
  const ds = rd('src/scenes/dataSource.js');
  const gate = ds.slice(ds.indexOf('const ingest = async (files) => {'), ds.indexOf("ui.querySelector('#pick').addEventListener"));
  assert.match(gate, /try \{[\s\S]*\} catch \(err\) \{\n\s+msg\.textContent = `folder failed: \$\{err\?\.message \?\? err\}\. \$\{FOLDER_PICK_HINT\}`;/, 'a read that throws says so and points at the route that works');
  assert.match(gate, /if \(!files\.length\) \{ msg\.textContent = `the browser handed over no files from that folder\. \$\{FOLDER_PICK_HINT\}`; return; \}/, 'an empty pick is named, with the same hint');
  assert.match(gate, /readPicked\(files, \(done, n\) => \{ msg\.textContent = `reading \$\{done\}\/\$\{n\}\.\.\.`; \}\)/, 'progress while the folder reads');
  assert.match(gate, /no ARENA2 files in that selection \(\$\{files\.length\} files, none of them Daggerfall/, 'a pick of the wrong folder says which');
  assert.match(ds, /async function readPicked\(files, progress = null\) \{[\s\S]*?if \(progress && \(done % 25 === 0 \|\| done === files\.length\)\) progress\(done, files\.length\);/, 'readPicked reports every 25 files and at the end');
  assert.match(FOLDER_PICK_HINT, /Snap or Flatpak/); assert.match(FOLDER_PICK_HINT, /\.zip/); assert.match(FOLDER_PICK_HINT, /drag the folder/);
  // the zip arm's own guard is the model and stands
  assert.match(ds, /msg\.textContent = `zip failed: \$\{err\.message\}`;/);
});
