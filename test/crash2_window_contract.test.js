// CRASH2 - THE CONTRACT ITSELF, DERIVED (2026-09-15).
//
// CRASH1 fixed a live crash (ui/chronicleDoor.js answered a contract no
// host reads) and shipped a gate to stop the next one. This file is
// that gate audited, one commit later, and it found the gate wrong
// three ways - each one an instance of the failure the gate was
// written to prevent.
//
//   F1  IT READ FIVE DOORS OF EIGHT, IN SILENCE. Its block finder
//       matched `return {` only, so `ui/pauseDoor.js` and
//       `ui/inventoryDoor.js` - which NAME the object (`const overlay =
//       {...}`) before handing it over - were never inspected, and
//       `ui/travelMapDoor.js` returns classes. The gate reported green
//       over doors it had not read. The pause menu was one of the two,
//       and the pause menu is half of what the player reported.
//
//   F2  ITS ARM LIST WAS TYPED BY HAND, and wrong in both directions.
//       It demanded `close`, which NO host has ever called on a slot
//       (pauseDoor does not even carry it, and passed only because it
//       was skipped), and omitted `tick`, which interior.js:395 calls
//       unguarded every frame. The door list derived; the arms did not.
//
//   F3  IT ASSUMED THE POPULATION WAS `ui/*Door.js`. It is not: twelve
//       window CLASSES are constructed straight into a slot, and
//       townTalk.js:1197 paints every COVERED window too
//       (`eachCoveredWindow((w) => w.draw(...))`), so depth is in the
//       contract as well as the top.
//
// So: the arms are read off the hosts, the population is read off the
// hosts, and this file asserts its own coverage - a door it cannot
// parse is a FAILURE, never a skip. That last rule is the whole
// lesson. A gate that skips in silence is worse than no gate: it
// spends the credibility of a green suite on a claim it never checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  doors, read, isDomDoor, inlineWindows, blockHas, classHas,
  hostArms, hostPopulations,
} from './windowContract.mjs';

/** The arms every open host needs of whatever is in its slot. `tick`
 *  is deliberately NOT here - see the closed-population test below. */
const OPEN_HOST_ARMS = ['input', 'draw'];

test('CRASH2: the required arms are DERIVED from the hosts, not typed here', () => {
  const { required, optional } = hostArms();
  // the two every open host calls unguarded
  for (const arm of OPEN_HOST_ARMS) {
    assert.ok(required.has(arm), `hosts no longer call \`${arm}\` unguarded - this gate is now checking a dead arm`);
  }
  // F2, both halves, pinned so they cannot come back
  assert.ok(!required.has('close'),
    'CRASH1 demanded `close` of every door. No host calls `close()` on its slot - the hosts free a window with\n'
    + '`dispose?.()` - so that requirement was invented, and it passed only because the door that lacks it was skipped.');
  assert.ok(required.has('tick'),
    'interior.js:395 calls `overlay.tick(dt)` unguarded every frame; CRASH1 omitted `tick` from the contract entirely.');
  // and the arms a host TESTS before calling stay the window's own choice
  for (const arm of ['hover', 'pointer', 'keyup', 'click']) {
    assert.ok(optional.has(arm), `\`${arm}\` is guarded at every call site, so it is optional by design (townTalk.js:492 says so)`);
  }
});

test('CRASH2: every DOM door is READ - a door this gate cannot parse fails it', () => {
  // F1. The coverage claim is the test. Without it the finder can
  // quietly stop matching and the suite stays green over nothing.
  const domDoors = doors().filter((d) => isDomDoor(read(d)));
  assert.ok(domDoors.length >= 7, `only ${domDoors.length} DOM doors found - the door sweep itself has broken`);
  const unread = [];
  for (const d of domDoors) {
    const windows = inlineWindows(read(d)).filter((b) => blockHas(b, 'draw') && blockHas(b, 'done'));
    if (!windows.length) unread.push(d);
  }
  assert.deepEqual(unread, [],
    'these doors build a DOM overlay and this gate could not find the window object inside them, so it checked\n'
    + 'NOTHING there. CRASH1 was in exactly this state for ui/pauseDoor.js and ui/inventoryDoor.js. Either teach\n'
    + 'inlineWindows() the new shape or say in the door why it has no inline window - do not leave it silent.');
});

test('CRASH2: every DOM door answers the arms the open hosts call unguarded', () => {
  const missing = [];
  for (const d of doors()) {
    const src = read(d);
    if (!isDomDoor(src)) continue;
    for (const block of inlineWindows(src)) {
      if (!blockHas(block, 'draw') || !blockHas(block, 'done')) continue;   // not a window object
      for (const arm of OPEN_HOST_ARMS) if (!blockHas(block, arm)) missing.push(`${d}: no \`${arm}\``);
      // ownership, not a throw: townTalk's showOverlay frees the
      // OUTGOING window with `dispose?.()`, so a missing `dispose` is
      // an optional-chained silence that leaks the div.
      if (!blockHas(block, 'dispose')) missing.push(`${d}: no \`dispose\` - the host frees the outgoing window with dispose?.(), so this leaks`);
    }
  }
  assert.deepEqual(missing, [],
    'a host calls these UNGUARDED on the window a door hands it - see hostArms() for the live call sites.');
});

test('CRASH2: interior.js keeps the CLOSED population that lets it demand `tick`', () => {
  // The arms are not uniform, and that is the honest reading: `tick` is
  // required by interior.js alone, and ActionTextBox, ChoiceWindow,
  // ListPickerWindow, TalkWindow, TransportWindow and
  // MerchantServiceWindow answer no `tick` at all. Demanding the union
  // of every host's arms of every window would be a false red six times
  // over. What keeps interior.js safe is that its slot can hold ONE
  // class, written at the push site - so THAT is what gets pinned.
  const interior = hostPopulations().find((h) => h.path.endsWith('interior.js'));
  assert.ok(interior, 'interior.js no longer owns a window stack');
  assert.equal(interior.closed, true,
    'interior.js used to fill its slot with a literal `new AutomapWindow(...)` at the push site, which is why it\n'
    + 'may call `overlay.tick(dt)` unguarded every frame. Something now hands it a window built elsewhere: either\n'
    + 'that window answers input/tick/draw, or the tick call needs a guard.');
  const { required } = hostArms();
  const owed = [...required.keys()].filter((a) => required.get(a).some((w) => w.startsWith('interior.js')));
  for (const name of interior.names) {
    // EM3: a class that arrives through a skin DOOR is resolved by the
    // population, which looked its module up; only a class pushed as a
    // literal falls back to the filename guess.
    const path = interior.modules?.get(name) ?? `src/ui/${name[0].toLowerCase()}${name.slice(1)}.js`;
    let src = null;
    try { src = read(path); } catch { /* named otherwise; the arm check below says so */ }
    assert.ok(src, `${name} reaches interior.js's slot but ${path} does not exist - resolve it before trusting this pin`);
    for (const arm of owed) {
      assert.ok(classHas(src, arm), `${name} occupies interior.js's slot, which calls \`${arm}\` unguarded (${required.get(arm).join(', ')})`);
    }
  }
});
