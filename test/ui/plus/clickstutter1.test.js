// CLICK-STUTTER, OW-DUNGEON-DOT, GRIM-MARKS (2026-10-13, from the field: "when I'm spamming the left mouse button the game
// starts to stutter"; "some dungeons appear on the Overworld map as towns"; "what are those colored edges, the blue and
// greenish ones"). A click in the world restyles nothing and asks no lock the canvas holds (the lock half is pinned in
// macfive's PL3 and fb1002_herbcursor_audit's A4/B4); a found dungeon in the Overworld's grid is the dungeons' mark and
// switch; the Grimoire compass's marks stand on its parchment, not under its frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markGroup } from '../../../src/systems/travel/travelViewFilters.js';
import { installPlusCursor } from '../../../src/ui/plus/plusCursor.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('CLICK-STUTTER the press frame is not worn while the pointer is locked - no class on <html>, so no restyle of the page; unlocked, worn once and taken off (mutant: the lock unread)', () => {
  const classes = new Set();
  const root = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } };
  const listeners = {};
  const win = { addEventListener: (t, f) => { listeners[t] = f; } };
  const doc = { documentElement: root, defaultView: win, pointerLockElement: null };
  installPlusCursor(doc);
  doc.pointerLockElement = { canvas: true };
  listeners.pointerdown({ pointerType: 'mouse' });
  assert.equal(classes.has('plus-press'), false, 'a swing in the world wears nothing');
  doc.pointerLockElement = null;
  listeners.pointerdown({ pointerType: 'mouse' });
  assert.equal(classes.has('plus-press'), true, 'a press on a window wears the frame');
  listeners.pointerup({});
  assert.equal(classes.has('plus-press'), false);
  listeners.pointerdown({ pointerType: 'touch' });
  assert.equal(classes.has('plus-press'), false, 'a touch never');
});

test('OW-DUNGEON-DOT a found dungeon\'s plate in the grid is the dungeons\' - its mark the arch, its switch Dungeons; a town\'s plate stays the towns\' (mutant: the dungeon word unread)', () => {
  assert.equal(markGroup('place dungeon'), 'dungeons');
  assert.equal(markGroup('place'), 'towns');
  assert.equal(markGroup('far dungeon'), 'dungeons');
  // PIN MOVED (HOST-SPLIT 1, 2026-10-15): the Overworld's marks left world.js for scenes/travelViewMarks.js
  const w = src('src/scenes/travelViewMarks.js');
  assert.match(w, /const isDungeon = TV_DUNGEON_TYPES\.has\(p\.summary\.loc\?\.mapTableData\?\.locationType\);/);
  assert.match(w, /kind: isDungeon \? 'place dungeon' : 'place'/);
});

test('GRIM-MARKS the Grimoire compass\'s box is its parchment\'s span - the frame and the strip reach back out to where they stood, and the marks stand over the frame', () => {
  const css = src('src/ui/grimoireDress.js');
  assert.match(css, /\$\{G\} \.hud-compass \{ --gcm-mark: calc\(3 \* var\(--gcm\) \+ 7px\); width: calc\(69 \* var\(--gcm\) - 2 \* var\(--gcm-mark\)\);/);
  assert.match(css, /\$\{G\} \.hud-compass::after \{ left: calc\(-1 \* var\(--gcm-mark\)\); right: calc\(-1 \* var\(--gcm-mark\)\); \}/);
  assert.match(css, /\$\{G\} \.hud-compass \.hud-strip \{ left: calc\(2 \* var\(--gcm\) - var\(--gcm-mark\)\); right: calc\(2 \* var\(--gcm\) - var\(--gcm-mark\)\); \}/);
});
