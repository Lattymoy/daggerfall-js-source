// AUDIT 65 UI-5 - THE WHEEL CARRIES THE POINTER.
//
// AUDIT 64 F52 gave the classic pack the wheel and routed it, rightly,
// by what the pointer is OVER (BaseScreenComponent.cs:725-733
// dispatches per component rect). But it routed it by a REMEMBERED
// point: nativeInventory's `_mouse`, seeded `[-1, -1]` and written by
// `hover()` alone, while every host wheel seam handed the window a
// bare `wheel(dir)`. Opening the pack with the Inventory key releases
// the pointer lock without moving the cursor, so the browser fires no
// mousemove at all - and the first notch found the seed, hit no rect
// and did nothing. The same notch after a one-pixel nudge worked.
//
// DFU has no such state. BaseScreenComponent.Update's scroll block
// (:725-736) is guarded by `mouseOverComponent`, recomputed from the LIVE
// scaled mouse position at :577-594 every frame, just before, so the
// wheel is routed by where the cursor IS and never by whether it has
// moved since the window opened.
//
// The fix is the shape that matches: the point rides the notch.
// `wheel(dir, vx = this._mouse[0], vy = this._mouse[1])` prefers the
// live point, the remembered one is only the fallback for a caller
// that has none, and each host seam computes the native point exactly
// as its own `hover` already does and passes it.
//
// THE FOUR HOSTS RULE: scenes/world.js and scenes/exterior.js own no
// wheel arithmetic - they hand the raw event to townTalk's seam and to
// worldModes' - so the seams are townTalk.js (for both of them),
// worldModes.js (BOTH arms: the interior slot and dungeonCtx), and
// dungeonContext.js's `overlayWheel`, plus the two standalone hosts
// scenes/dungeon.js and scenes/interior.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createInventoryWindow } from '../src/ui/inventoryDoor.js';
import { INV_RECTS } from '../src/ui/nativeInventory.js';
import { CELL_X, SLOT_H } from '../src/ui/itemScroller.js';
import { equipOf } from '../src/systems/equip.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const dagger = (name) => ({ group: 'Weapons', templateIndex: 113, name, material: 9 });
const hero = (items) => { const e = { stats: { strength: 80 }, items }; equipOf(e); return e; };
const LOCAL_SLOT = (s = 0) => [INV_RECTS.localList[0] + CELL_X + 5, INV_RECTS.localList[1] + s * SLOT_H + 5];
const REMOTE_SLOT = (s = 0) => [INV_RECTS.remoteList[0] + CELL_X + 5, INV_RECTS.remoteList[1] + s * SLOT_H + 5];

/** The producer, not a literal: ui/inventoryDoor.js:58 is the ONE seam
 *  every host opens the pack through (U53), and headless it mints the
 *  classic window. */
const pack = (bag, pile) => {
  const w = createInventoryWindow({
    items: () => bag, icons: ICONS, entity: hero(bag), loot: { items: () => pile },
  });
  assert.equal(w?.constructor?.name, 'NativeInventoryWindow', 'the door minted the classic pack');
  return w;
};

test('AUDIT 65 UI-5: the notch carries its own point, so the pack scrolls before the mouse has ever moved', () => {
  const letters = 'abcdefghi';
  const bag = [...letters].map((n) => dagger(n));
  const pile = [...letters].map((n) => dagger(n.toUpperCase()));
  const w = pack(bag, pile);
  // NO hover() anywhere below: this is the Inventory-key open, whose
  // lock release moves no cursor and fires no mousemove.
  w.wheel(1, ...LOCAL_SLOT(0));
  assert.equal(w.scroll, 1, 'the first notch scrolled the list the cursor is over');
  assert.equal(w.remoteScroll, 0, 'and only that list');
  // ItemListScroller.cs:346-347's other handler rides the carried
  // point too - the info panel names the item that scrolled under it.
  assert.equal(w.infoItem, bag[1], 'the repoint read the notch\'s own point');
  // ...and the tooltip half of that repoint rides the same point: the
  // tip re-shows for the item under the notch, at the slot's own place.
  // MUTANT: `_wheelRehover(this._mouse[0], this._mouse[1], ...)` - the
  // remembered point again - leaves infoItem right and the tip null.
  assert.equal(w._tip.tip._pending, 'Daedric b', 'the tooltip re-showed for the item now under the notch');
  assert.deepEqual([w._tip.tip.x, w._tip.tip.y], LOCAL_SLOT(0), 'at the notch\'s own point');
  w.wheel(1, ...REMOTE_SLOT(0));
  assert.equal(w.remoteScroll, 1, 'the remote scroller likewise, still with no hover');
  assert.equal(w.scroll, 1, 'and the local one held its place');
  // The point still ROUTES: off both scrollers there is no fallback
  // list, exactly as F52 holds.
  w.wheel(1, INV_RECTS.paperDoll[0] + 5, INV_RECTS.paperDoll[1] + 5);
  assert.deepEqual([w.scroll, w.remoteScroll], [1, 1], 'the paperdoll carries no scroll handler');
  // ...and the remembered point is only the fallback for a caller with
  // none, which is still the seeded pointer-leave sentinel here.
  w.wheel(1);
  assert.deepEqual([w.scroll, w.remoteScroll], [1, 1], 'a notch with no point routes nothing');
});

test('AUDIT 65 UI-5: every host wheel seam hands the window the live point', () => {
  const POINT = /wheel\?\.\(Math\.sign\(e\.deltaY\), v \? v\[0\] : -1, v \? v\[1\] : -1\);/;
  // townTalk.js is the seam for BOTH outdoor hosts (world.js:5071 and
  // exterior.js:2451 hand it the raw event).
  assert.match(read('src/scenes/townTalk.js'), POINT, 'townTalk.js');
  // worldModes.js: BOTH arms - the interior slot and the mounted
  // dungeon context's.
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /dungeonCtx\.overlayWheel\?\.\(Math\.sign\(e\.deltaY\), v \? v\[0\] : -1, v \? v\[1\] : -1\);/, 'worldModes dungeon arm');
  assert.match(wm, /interiorOverlay\.wheel\?\.\(Math\.sign\(e\.deltaY\), v \? v\[0\] : -1, v \? v\[1\] : -1\);/, 'worldModes interior arm');
  // dungeonContext.js forwards it, defaulting to the hosts' own
  // pointer-leave sentinel for a caller that has no point.
  assert.match(read('src/scenes/dungeonContext.js'),
    /overlayWheel\(dir, vx = -1, vy = -1\) \{ activeOverlay\?\.wheel\?\.\(dir, vx, vy\); \},/, 'dungeonContext.js');
  // the two standalone hosts
  assert.match(read('src/scenes/dungeon.js'),
    /ctx\.overlayWheel\?\.\(Math\.sign\(e\.deltaY\), v \? v\[0\] : -1, v \? v\[1\] : -1\);/, 'dungeon.js');
  assert.match(read('src/scenes/interior.js'), POINT, 'interior.js');
  // world.js and exterior.js own no arithmetic of their own: the whole
  // point of naming them is that the event is what they pass on.
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(h), /townTalk\.wheel\(e\) \|\| modes\?\.wheel\?\.\(e\)/, h);
  }
  // ...and no seam may go back to a bare notch.
  for (const h of ['src/scenes/townTalk.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js',
    'src/scenes/interior.js', 'src/scenes/dungeonContext.js']) {
    assert.equal(/wheel\?\.\(Math\.sign\(e\.deltaY\)\)/.test(read(h)), false, `${h} drops the point again`);
  }
});

test('AUDIT 65 UI-5: one wheel shape in src/ui - every other window ignores the extra args', () => {
  // The seams now pass three arguments to whatever window is up. That
  // is safe only while every other `wheel` declares one parameter and
  // lets the rest fall on the floor; a window that grows a second
  // positional would read a coordinate as its own. The ONE exception
  // is automapChrome's NESTED seam, which is fed by automapWindow
  // (:1100) rather than by a host and keeps its own argument order.
  const dir = join(root, 'src/ui');
  const multi = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/^\s*wheel\(([^)]*)\)/gm)) {
      if (m[1].split(',').filter((a) => a.trim()).length > 1) multi.push(`${f}: wheel(${m[1]})`);
    }
  }
  assert.deepEqual(multi.sort(), [
    'automapChrome.js: wheel(nx, ny, dir)',
    'nativeInventory.js: wheel(dir, vx = this._mouse[0], vy = this._mouse[1])',
  ]);
});
