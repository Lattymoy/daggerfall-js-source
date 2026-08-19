// U21: THE MAIN MENU. DaggerfallStartWindow.cs, verbatim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { StartWindow, START_BUTTONS, START_IMG } from '../src/ui/startWindow.js';
import { NATIVE_W, NATIVE_H, nativeMetrics } from '../src/ui/nativePanel.js';
import { ImgFile } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'no ARENA2_PATH' : false;

// ---------------------------------------------------------------------------
// The geometry. The button LABELS are painted into PICK03I0 and DFU lays
// invisible click rects over them (DaggerfallStartWindow.cs:50/:55/:60), so a
// drifted rect puts the words and the hit box in different places - the exact
// failure AUDIT 2026-08-17d found across the native windows.
// ---------------------------------------------------------------------------

test('U21: the three button rects are DFU\'s, to the pixel', () => {
  assert.deepEqual(START_BUTTONS.load, [72, 45, 147, 15], 'DaggerfallStartWindow.cs:50');
  assert.deepEqual(START_BUTTONS.newGame, [72, 99, 147, 15], ':55');
  assert.deepEqual(START_BUTTONS.exit, [125, 145, 41, 15], ':60');
  // All three must sit inside the virtual screen, or they are unclickable.
  for (const [name, [x, y, w, h]] of Object.entries(START_BUTTONS)) {
    assert.ok(x >= 0 && y >= 0 && x + w <= NATIVE_W && y + h <= NATIVE_H, `${name} is off-panel`);
  }
});

test('U21: every button answers a click, and only inside its own rect', () => {
  const win = new StartWindow(null);
  for (const [name, [x, y, w, h]] of Object.entries(START_BUTTONS)) {
    // all four corners and the centre resolve to this button
    assert.equal(win.hitNative(x, y), name, `${name} top-left`);
    assert.equal(win.hitNative(x + w - 1, y + h - 1), name, `${name} bottom-right`);
    assert.equal(win.hitNative(x + (w >> 1), y + (h >> 1)), name, `${name} centre`);
    // and one pixel outside each edge does NOT
    assert.notEqual(win.hitNative(x - 1, y), name, `${name} leaks left`);
    assert.notEqual(win.hitNative(x, y - 1), name, `${name} leaks up`);
    assert.notEqual(win.hitNative(x + w, y), name, `${name} leaks right`);
    assert.notEqual(win.hitNative(x, y + h), name, `${name} leaks down`);
  }
  // The gaps between the buttons are dead, as they are in DFU.
  assert.equal(win.hitNative(160, 5), null, 'the title strip is not a button');
  assert.equal(win.hitNative(160, 80), null, 'between Load and New Game');
});

test('U21: a press records the action; a miss records nothing', () => {
  const canvas = { width: NATIVE_W, height: NATIVE_H };
  const m = nativeMetrics(canvas);
  const at = ([x, y, w, h]) => [m.ox + (x + (w >> 1)) * m.s, m.oy + (y + (h >> 1)) * m.s];

  const win = new StartWindow(null);
  assert.equal(win.action, null);
  assert.equal(win.click(canvas, ...at(START_BUTTONS.newGame)), 'newGame');
  assert.equal(win.action, 'newGame');

  const w2 = new StartWindow(null);
  assert.equal(w2.click(canvas, ...at(START_BUTTONS.load)), 'load');
  assert.equal(w2.action, 'load');

  // A miss returns null and leaves the action unset - but the caller
  // still treats it as consumed, so it cannot reach a pointer lock.
  const w3 = new StartWindow(null);
  assert.equal(w3.click(canvas, m.ox + 160 * m.s, m.oy + 5 * m.s), null);
  assert.equal(w3.action, null);
});

test('U21: clicks off the letterboxed panel hit nothing', () => {
  // A wide canvas letterboxes the 320x200 panel; the bars are not the menu.
  const canvas = { width: NATIVE_W * 3, height: NATIVE_H * 2 };
  const win = new StartWindow(null);
  assert.equal(win.hit(canvas, 2, 2), null, 'top-left bar');
  assert.equal(win.hit(canvas, canvas.width - 2, canvas.height - 2), null, 'bottom-right bar');
});

// ---------------------------------------------------------------------------
// The art. PICK03I0 is PALETTIZED - its 768 palette bytes follow the image and
// ImgFile._readPalette writes INTO the palette it is handed, so it must get
// its own. Handing it the shared ART_PAL would repaint every other screen
// (the U18 / AUDIT 17k law).
// ---------------------------------------------------------------------------

test('U21: PICK03I0 is a full-screen palettized IMG on its OWN palette', { skip: skipReal }, () => {
  const shared = new DFPalette();
  shared.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const before = shared.get(1);

  const own = new DFPalette();
  const img = new ImgFile();
  img.load(new Uint8Array(readFileSync(join(ARENA2, START_IMG))), START_IMG, own);
  const bmp = img.getDFBitmap();

  assert.equal(bmp.width, NATIVE_W, 'the menu fills the virtual screen');
  assert.equal(bmp.height, NATIVE_H);
  assert.equal(bmp.data.length, NATIVE_W * NATIVE_H);
  // It really did read an embedded palette, not the caller's.
  assert.notDeepEqual(own.get(1), before, 'PICK03I0 carries its own palette');
  // And the shared palette is untouched - the whole point of the rule.
  assert.deepEqual(shared.get(1), before, 'ART_PAL must survive the menu load');
});

// ---------------------------------------------------------------------------
// The boot seam. ?shot and the dev scenes MUST bypass the menu: the shot
// pipeline and the 25 probes in tools/ drive fixed vantages, and a menu in
// front of them would block every one.
// ---------------------------------------------------------------------------

test('U21: the bare URL reaches the menu, and ?shot bypasses it', () => {
  const main = readFileSync(join(root, 'src/main.js'), 'utf8');
  assert.match(main, /runMenu\(canvas, renderer, status\)/, 'the bare URL must reach the menu');
  assert.match(main, /params\.has\('shot'\)\s*\|\|\s*params\.has\('nomenu'\)/,
    '?shot must bypass the menu or every probe in tools/ blocks');
  // The bypass has to come BEFORE the menu, or it does not bypass anything.
  assert.ok(main.indexOf("params.has('shot')") < main.indexOf('runMenu('),
    'the ?shot bypass must precede the menu');
});

test('U21: LOAD reuses the host quickLoad rather than a second loader', () => {
  const dungeon = readFileSync(join(root, 'src/scenes/dungeon.js'), 'utf8');
  assert.match(dungeon, /params\.has\('load'\)/, 'the host must honour the menu\'s load flag');
  assert.match(dungeon, /ctx\.quickLoad\(/, 'and load through the context, not a copy');
  assert.match(dungeon, /loadedPos \?\? ctx\.startSpawn\(\)/,
    'a loaded game resumes where it was saved, not at the start marker');
  // No second loader anywhere in the menu path.
  const menu = readFileSync(join(root, 'src/scenes/menu.js'), 'utf8');
  assert.equal(/restorePlayer\(/.test(menu), false, 'the menu must not restore a save itself');
});
