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
// THE SHAPE, AND WHY A GATE. Four sibling doors - pauseDoor,
// inventoryDoor, charSheetDoor, spellbookDoor - carry a comment that
// describes this exact failure, word for word, because each of them hit
// it first and wrote down what it cost. The rule was enforced in four
// files by whoever remembered to copy the block, and the fifth door
// missed it. That is the program's measured failure mode (see
// `01-Overview/Hardening.md`) landing on a player rather than on a test.
//
// So the door list was DERIVED - every `ui/*Door.js` that can hand a
// host a window - and every window it returns had to answer the contract
// the hosts actually call.
//
// CORRECTED BY CRASH2 (test/crash2_window_contract.test.js), one commit
// later. This file's door list derived; its ARM list did not, and its
// block finder read `return {` only - so `ui/pauseDoor.js` and
// `ui/inventoryDoor.js`, which name the object before handing it over,
// were never inspected at all and the "every DOM-overlay door" claim
// covered five of eight. The arm check and the coverage claim now live
// in CRASH2, derived from the hosts; what stays here is the part that is
// genuinely this crash's: the DEAD contract, and the key map that made
// the report read the way it did. Both files share one derivation
// (./windowContract.mjs) rather than keeping a copy each - a second copy
// of a rule is a second thing to keep in step, which is the whole
// failure mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doors, read, isDomDoor, inlineWindows, blockHas } from './windowContract.mjs';

test('CRASH1: the chronicle door still answers the arms its host calls', () => {
  // THE NAMED REGRESSION. The general sweep is CRASH2's - this one pins
  // the door the player actually hit, by name, so the story stays
  // readable at the place it happened.
  const src = read('src/ui/chronicleDoor.js');
  const windows = inlineWindows(src).filter((b) => blockHas(b, 'draw') && blockHas(b, 'done'));
  assert.equal(windows.length, 1, 'ui/chronicleDoor.js no longer builds exactly one inline window - re-aim this pin');
  for (const arm of ['input', 'draw', 'dispose']) {
    assert.ok(blockHas(windows[0], arm),
      `the logbook's enhanced window has no \`${arm}\`. townTalk.js calls \`overlay.input(a, e)\` UNGUARDED and\n`
      + 'ui/input.js maps EVERY letter, digit and space to an action, so this is a TypeError on an ordinary keypress -\n'
      + 'which is what was reported from live play. Copy the contract block from ui/pauseDoor.js.');
  }
});

test('CRASH1: no door answers the DEAD contract instead of the live one', () => {
  // `onKey`/`onPointer` are what chronicleDoor had. Nothing in src/ has
  // ever read them off an overlay - they LOOK like the contract and are
  // not one, which is worse than having nothing, because the file reads
  // as though it handled keys.
  const dead = [];
  for (const door of doors()) {
    const src = read(door);
    if (!isDomDoor(src)) continue;
    for (const block of inlineWindows(src)) {
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
