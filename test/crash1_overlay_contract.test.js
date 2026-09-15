// CRASH1 - THE OVERLAY CONTRACT, DERIVED (2026-09-15).
//
// Reported from live play, by someone who had just tried the deployed
// build: "had a lot of javascript issues with regards to menu
// accessibility. Opening the logbook and pressing L reliably causes the
// errors, as well as sometimes randomly when trying to access the pause
// menu with escape."
//
// Both are ONE defect. `ui/chronicleDoor.js`'s enhanced window - the
// logbook, on the DEFAULT skin - answered `onKey`/`onPointer`, a
// contract NOTHING in this tree reads, and had no `input`. The hosts
// dereference `input` UNGUARDED on every key that maps to an action:
//
//   scenes/townTalk.js   `overlay.input(a, e)`
//   scenes/dungeonContext.js  `activeOverlay.input(action, e)`
//
// and `ui/input.js`'s overlayAction returns `'char:<k>'` for EVERY
// letter, digit and space (:338) and `'back'` for Escape (:353). So with
// the logbook open, L threw - and so did every other letter, which is
// why it was "reliable" - and Escape threw, which is the pause key, and
// is why that one looked "random": it depended on the logbook being the
// window that happened to be up.
//
// THE SHAPE, AND WHY A GATE. Three sibling doors - pauseDoor,
// inventoryDoor, charSheetDoor, spellbookDoor - carry a comment that
// describes this exact failure, word for word, because each of them hit
// it first and wrote down what it cost. The rule was enforced in four
// files by whoever remembered to copy the block, and the fifth door
// missed it. That is the program's measured failure mode (see
// `01-Overview/Hardening.md`) landing on a player rather than on a test.
//
// So the door list is DERIVED - every `ui/*Door.js` that can hand a host
// a window - and every window it can return must answer the contract the
// hosts actually call. A sixth door fails this file until it does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** Every door in ui/ - the list the hosts open windows through. */
const doors = () => readdirSync(join(ROOT, 'src/ui'))
  .filter((f) => /Door\.js$/.test(f)).map((f) => `src/ui/${f}`).sort();

/**
 * THE ARMS THE HOSTS CALL UNGUARDED, and where each call lives. A door
 * whose window omits one throws inside the host's own event handler,
 * which is a crash the player sees and no test does.
 */
const CONTRACT = ['input', 'draw', 'close', 'dispose'];

/** A door that builds its window INLINE (an object literal returned from
 *  a mount function) has to spell the arms itself; one that returns a
 *  CLASS carries them on the prototype and is checked at its class. */
function inlineOverlayBlocks(src) {
  // the `return {` ... `};` of a function that also appends to the body -
  // i.e. a DOM overlay handed to a host, which is the shape at issue
  const out = [];
  for (const m of src.matchAll(/return \{\n([\s\S]*?)\n {2}\};/g)) out.push(m[1]);
  return out;
}

test('CRASH1: every DOM-overlay door answers the arms the hosts call unguarded', () => {
  const missing = [];
  for (const door of doors()) {
    const src = read(door);
    // only the enhanced DOM overlays build a window inline; a door that
    // returns `new SomeWindow(...)` is a class and carries its own arms
    if (!/document\.createElement|document\.body\.append/.test(src)) continue;
    for (const block of inlineOverlayBlocks(src)) {
      if (!/\bclose\b/.test(block)) continue;   // not a window object
      for (const arm of CONTRACT) {
        // an arm may be a method (`input() {}`), a property
        // (`dispose: close`), a getter (`get done()`) or SHORTHAND
        // (`close,`) - the first draft of this matcher missed the
        // shorthand and reported three doors that were fine, which is
        // the kind of false red that gets a gate deleted.
        const has = new RegExp(`(^|\\n)\\s*(${arm}\\s*[(:,]|get ${arm}\\b|${arm}\\s*$)`, 'm').test(block);
        if (!has) missing.push(`${door}: its overlay object has no \`${arm}\``);
      }
    }
  }
  assert.deepEqual(missing, [],
    'a host calls these UNGUARDED on the window a door hands it - `overlay.input(a, e)` in\n'
    + 'scenes/townTalk.js, `activeOverlay.input(action, e)` in scenes/dungeonContext.js - and\n'
    + 'ui/input.js maps EVERY letter, digit and space to an action, so a missing arm is a\n'
    + 'TypeError on an ordinary keypress. Copy the contract block from ui/pauseDoor.js.');
});

test('CRASH1: no door answers the DEAD contract instead of the live one', () => {
  // `onKey`/`onPointer` are what chronicleDoor had. Nothing in src/ has
  // ever read them off an overlay - they LOOK like the contract and are
  // not one, which is worse than having nothing, because the file reads
  // as though it handled keys.
  const dead = [];
  for (const door of doors()) {
    const src = read(door);
    for (const block of inlineOverlayBlocks(src)) {
      for (const arm of ['onKey', 'onPointer']) {
        if (new RegExp(`(^|\\n)\\s*${arm}\\s*\\(`).test(block)) dead.push(`${door}: \`${arm}\` is not a contract any host reads`);
      }
    }
  }
  assert.deepEqual(dead, [], 'a window answers a contract nothing calls');

  // ...and the claim above stays true: if a host ever starts reading
  // `onKey` off an overlay, this test is the thing that is now wrong.
  const hostSrc = ['src/scenes/townTalk.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js', 'src/ui/input.js']
    .map(read).join('\n');
  assert.doesNotMatch(hostSrc, /overlay\??\.\s*onKey|activeOverlay\??\.\s*onKey/,
    'a host now reads onKey off an overlay - the dead-contract rule above needs revisiting');
});

test('CRASH1: the keys that crashed all map to an action, which is why the report said "reliably"', async () => {
  const { overlayAction } = await import('../src/ui/input.js');
  const act = (key, code) => overlayAction({ key, code, target: {} });
  // the reporter's own two keys
  assert.equal(act('l', 'KeyL'), 'char:l', 'L maps - the logbook key, pressed with the logbook open');
  assert.equal(act('Escape', 'Escape'), 'back', 'and Escape, which is the pause key');
  // ...and it was never only L: the char branch takes the whole alphabet
  for (const k of ['a', 'z', 'Q', '7', ' ']) {
    assert.equal(act(k, 'Key'), `char:${k}`, `${JSON.stringify(k)} maps too`);
  }
  assert.equal(act('Tab', 'Tab'), null, 'Tab maps to nothing, which is why Tab alone never threw');
});
