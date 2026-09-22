// MENU-RELOCK (2026-09-22)
//
// Discord report: after closing a menu, the cursor could remain free for
// roughly 1-3 seconds before mouselook returned.
//
// Pointer lock is gesture-gated by browsers. A close that only lets the
// next animation frame's makeLookGate() call requestLook() has already
// missed the key/click that closed the UI, so Chromium may refuse it.
// The law pinned here is therefore two-part:
//   1. native/canvas windows relock before the closing input handler returns;
//   2. enhanced DOM windows relock on a FINAL exit, but not while handing
//      directly to another window that still needs the cursor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('MENU-RELOCK: outdoor hosts take mouselook back inside the UI-closing gesture', () => {
  for (const path of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(path);
    assert.match(s, /const relockAfterUiInput = \(\) => \{[\s\S]{0,220}?document\.pointerLockElement !== canvas\) requestLook\(canvas\);\s*\n\s*\};/,
      `${path}: one guarded close-edge relock`);
    assert.match(s, /if \(townTalk\.keydown\(e\)\) \{ relockAfterUiInput\(\); return; \}/,
      `${path}: a key that closes the outer window relocks before returning`);
    assert.match(s, /if \(townTalk\.pointerdown\(e\)\) \{ relockAfterUiInput\(\); return; \}/,
      `${path}: a pointer press that closes the outer window relocks in that press`);
    assert.match(s, /townTalk\.pointer\('up', e\);[\s\S]{0,120}?modes\?\.pointerup\?\.\(e\);[\s\S]{0,120}?relockAfterUiInput\(\);/,
      `${path}: release-driven closes relock before pointerup returns`);
    assert.match(s, /createWorldModes\(\{\s*\n\s*relockAfterUiInput,/,
      `${path}: modal interior/dungeon keys borrow the same host-canvas relock`);
  }
});

test('MENU-RELOCK: modal and standalone hosts do not defer a final close to the frame gate', () => {
  const modes = read('src/scenes/worldModes.js');
  assert.ok((modes.match(/host\.relockAfterUiInput\?\.\(\);/g) ?? []).length >= 2,
    'worldModes relocks after both interior and dungeon routeKey closes');

  const interior = read('src/scenes/interior.js');
  assert.match(interior, /overlay\.input\(e\.code, e\); drainOverlay\(\); relockAfterUiInput\(\); e\.preventDefault\(\); return;/,
    'standalone interior relocks after a key drains its last window');
  assert.match(interior, /overlay\.release\?\.\(\);[^\n]*\n\s*drainOverlay\(\);\s*\n\s*relockAfterUiInput\(\);/,
    'standalone interior also covers release-driven closes');

  const dungeon = read('src/scenes/dungeon.js');
  assert.match(dungeon, /const relockAfterUiInput = \(\) => \{\s*\n\s*if \(!ctx\.uiOverlayActive && document\.pointerLockElement !== canvas\) requestLook\(canvas\);/,
    'standalone dungeon asks only after its last overlay is gone');
  assert.match(dungeon, /ctx\.overlayPointer\?\.\('up',[\s\S]{0,180}?relockAfterUiInput\(\);/,
    'standalone dungeon release-driven closes relock inside pointerup');
});

test('MENU-RELOCK: enhanced windows distinguish final exit from UI-to-UI handoff', () => {
  const invDoor = read('src/ui/inventoryDoor.js');
  assert.match(invDoor, /const closeToGame = \(\) => close\(true\);\s*\n\s*const closeForHandoff = \(\) => close\(false\);/);
  assert.match(invDoor, /onExit: closeToGame, onHandoff: closeForHandoff/,
    'the enhanced pack tells its face which close returns to gameplay');
  assert.match(invDoor, /if \(relock\) deps\.relock\?\.\(\);/,
    'only the final close requests look');

  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /let onHandoff = \(\) => \{\};/);
  assert.match(inv, /const openCharSheet = deps\.openCharSheet;\s*\n\s*onHandoff\(\);[\s\S]{0,120}?openCharSheet\(\);/,
    'pack -> sheet keeps the cursor for the successor');
  assert.match(inv, /const open = deps\.openSpellbook;\s*\n\s*onHandoff\(\);[\s\S]{0,120}?open\(\);/,
    'pack -> spellbook keeps the cursor for the successor');

  for (const path of ['src/ui/spellbookDoor.js', 'src/ui/chronicleDoor.js']) {
    const s = read(path);
    assert.match(s, /const closeToGame = \(\) => close\(true\);/, `${path}: final-close door exists`);
    assert.match(s, /if \(relockLook\) .*relock\?\.\(\);/, `${path}: final-close relocks`);
    assert.match(s, /dispose: close,\s*\n\s*destroy: close,/, `${path}: host replacement stays a silent handoff`);
  }

  const sheet = read('src/ui/charSheetDoor.js');
  assert.match(sheet, /function enhancedSheetPageOverlay\(hooks, entity = null, relock = null\)/);
  assert.match(sheet, /const closeToGame = \(\) => close\(true\);/);
  assert.match(sheet, /close: closeToGame,[\s\S]{0,160}?dispose: close,\s*\n\s*destroy: close,/,
    'sheet returns mouselook only for a final user close, not replacement');
});

test('MENU-RELOCK: every gameplay host supplies the enhanced door relock seam', () => {
  for (const path of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(path);
    assert.ok((s.match(/relock: \(\) => requestLook\(canvas\),/g) ?? []).length >= 4,
      `${path}: inventory, spellbook, sheet and chronicle all receive the live canvas`);
  }
  const dc = read('src/scenes/dungeonContext.js');
  assert.ok((dc.match(/relock: \(\) => opts\.relock\?\.\(\),/g) ?? []).length >= 4,
    'dungeon windows forward the relock from whichever host owns the canvas');
});
