// HARD2-S1/S2 - THE TWO SEAMS THAT WERE NOT EXTRACTED (2026-09-15).
//
// An audit that finds nothing still leaves something behind: the FACTS
// the "nothing" rests on. HARD2's record now says the draw ladders and
// the teardown order do not justify an extraction, and that conclusion
// is only as good as three claims about the tree. If one of them stops
// being true, the conclusion is void and someone has to look again -
// so the tree re-checks them here rather than trusting a page.
//
// This file asserts no behaviour. It asserts the GROUND of a decision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('HARD2-S1: the two exterior hosts are NOT peers - world.js ships, exterior.js is a dev scene', () => {
  // The whole S1 conclusion rests on this. A term world.js has and
  // exterior.js lacks is not player-facing while this holds; the day
  // exterior.js is on the front door, the ladders ARE two live copies
  // of one law and the seam is worth what AUDIT 66 F7 was worth.
  const main = read('src/main.js');
  assert.match(main, /if \(params\.has\('exterior'\) \|\| params\.has\('region'\) \|\| params\.has\('loc'\)\) \{[^}]*bootExterior/,
    'exterior.js is reached by URL param');
  assert.match(main, /Dev scenes stay one param away/,
    "main.js says it itself - if that line goes, so does S1's premise");
  // ...and the front door, which is the half that actually decides it.
  const front = main.slice(main.indexOf('THE FRONT DOOR'));
  assert.match(front, /return bootWorld\(canvas, renderer, params, status\);/,
    'the front door boots world.js; if it ever boots exterior.js, re-run the S1 ladder diff');
  assert.doesNotMatch(front, /return bootExterior\(/, 'the front door does not boot the dev scene');
});

test('HARD2-S2: the dungeon context disposes its OWN window stack, which is why the host\'s extra dispose is harmless', () => {
  // S2 candidate 3 was "worldModes.js disposes the dungeon overlay and
  // then destroy() disposes it again - HARD1's double free". It is not:
  // dispose() is idempotent by A2, and dungeonContext.js:7134-7135 says
  // so at the site. That makes the outer call belt-and-braces rather
  // than a defect - but only while destroy() really does own the stack.
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /dungeonWindows\.reconcile\(activeOverlay\);\s*\n\s*dungeonWindows\.clear\(\(w\) => w\.dispose\?\.\(\)\);/,
    'destroy() reconciles the live slot into the stack and disposes every window in it');
  assert.match(dc, /dispose\(\) is idempotent/,
    'and the reason the outer host may also call it is written at the site, not inferred here');
});

test('HARD2-S2: the teleport path\'s onWorldChanged is owned by the CALLER, not missing from the teardown', () => {
  // S2 candidate 2 was "both door exits call npcSession.onWorldChanged()
  // and forceExitToExterior does not". True, and correct: every teleport
  // caller follows the exit with _teleportToPixel, and that function
  // owns the call (DFU's OnMapPixelChanged / OnLoadEvent). If it ever
  // stops owning it, the teardown path really is short a term.
  const w = read('src/scenes/world.js');
  const i = w.indexOf('  async function _teleportToPixel(');
  assert.ok(i > 0, '_teleportToPixel is still the re-origin door');
  // its body, to the next top-level function
  const body = w.slice(i, w.indexOf('\n  function ', i + 1));
  assert.match(body, /npcSession\.onWorldChanged\(\);/,
    'the re-origin owns the talk-side world change, which is why forceExitToExterior need not repeat it');
  assert.match(body, /questBridge\?\.onInitWorld\(\);/, 'and the quest side beside it');

  // ...and the exits that are NOT followed by a re-origin still carry
  // it themselves, which is the other half of the same claim.
  const m = read('src/scenes/worldModes.js');
  assert.equal((m.match(/npcSession\?\.onWorldChanged\(\);/g) ?? []).length, 2,
    'the two real door exits (tryExit, exitDungeonNow) each carry their own');
});
