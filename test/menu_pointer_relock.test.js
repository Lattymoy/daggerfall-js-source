// MENU-RELOCK (2026-09-22, Fedu on Discord: a 1-3 second delay before
// the camera answers the mouse again after closing a menu).
//
// POINTER LOCK IS ONLY GRANTED INSIDE A USER GESTURE. The browser hands
// `requestPointerLock` out on the keypress or click the player just
// made and refuses it anywhere else; a refusal is silent (the port logs
// it once) and nothing retries, so the look stays dead until the
// player's NEXT gesture happens to reach a relock arm. That is the
// whole of the report: the delay is not a timer, it is however long it
// takes you to press something else.
//
// THE PORT ASKED A FRAME LATE. `makeLookGate` is the per-host
// reconciler and it runs on the FRAME: it sees the overlay slot drain
// and relocks on the next call, which is a new task with no user
// activation left. The fix is not to make the gate faster - it is for
// the four hosts to ask inside the key handler that closed the window,
// while the gesture is still live, and let the gate keep doing its own
// resting-state job.
//
// WHAT IS HELD HERE. The first two tests EXECUTE the mechanism and the
// gap: that a request really is made and a refusal really is swallowed,
// and that the gate alone leaves a window in which nobody has asked.
// The third holds the four call sites by source, because the gesture
// itself needs a browser - and it holds the SHAPE the fix has to take,
// not just the strings it contains.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requestLook, makeLookGate, RELOCK_GRACE_MS, setCursorActive } from '../src/player/pointerLock.js';

const rd = (p) => readFileSync(p, 'utf8');
/** A canvas that counts requests, and can refuse the way Chrome does. */
const stubCanvas = ({ reject = null } = {}) => {
  const c = { calls: [], requestPointerLock(opts) { c.calls.push(opts ?? null); return reject ? Promise.reject(reject) : Promise.resolve(); } };
  return c;
};

test('MENU-RELOCK: a request really is made, asks for raw deltas, and a refusal is swallowed rather than fatal', async () => {
  setCursorActive(false);
  const ok = stubCanvas();
  requestLook(ok);
  assert.equal(ok.calls.length, 1, 'the lock was asked for');
  assert.deepEqual(ok.calls[0], { unadjustedMovement: true }, 'MAC1: raw device counts, not the OS-accelerated pointer');

  // Chrome rejects when the document is not focused, a request is
  // pending, or inside the post-exit cooldown. An unhandled rejection
  // was a crash overlay AND a frozen yaw; a refused lock must be a
  // no-op that the next gesture retries.
  const refused = stubCanvas({ reject: new DOMException('refused', 'NotAllowedError') });
  assert.doesNotThrow(() => requestLook(refused));
  await new Promise((r) => setTimeout(r, 0));   // let the rejection settle unhandled if it were going to
  assert.equal(refused.calls.length, 1);

  // U45's precedence: a cursor the player DELIBERATELY activated is not
  // taken back by a closing gesture - only by the toggle.
  setCursorActive(true);
  const held = stubCanvas();
  requestLook(held);
  assert.equal(held.calls.length, 0, 'an activated cursor survives the relock');
  setCursorActive(false);
});

test('MENU-RELOCK by execution: the frame gate leaves a window in which nobody has asked - which is the bug', async () => {
  // THE GAP, measured. Drive the gate the way a host does: a window up
  // for some frames, then gone. The gate cannot ask until the call
  // AFTER the overlay drains, and that call is a new task - no user
  // activation, so the browser refuses it.
  setCursorActive(false);
  const canvas = stubCanvas();
  const gate = makeLookGate(canvas);

  gate(true);                                   // a window is up
  gate(true);
  const atTheMomentOfTheKey = canvas.calls.length;
  // ...the player presses the key that closes it. The overlay slot
  // drains, but the gate has not run again yet.
  assert.equal(atTheMomentOfTheKey, 0, 'nothing has asked for the lock while the gesture is still live');

  gate(false);                                  // the next FRAME
  assert.equal(canvas.calls.length, 1, 'the gate asks, but a frame late - outside the gesture the browser wanted');

  // And the host's in-gesture request is not wasted work the gate then
  // undoes: PL3's grace means a request made within RELOCK_GRACE_MS is
  // not released by a gate call that still thinks the window is up.
  const c2 = stubCanvas();
  const gate2 = makeLookGate(c2);
  gate2(true);
  requestLook(c2);                              // the host, inside the closing key
  let released = false;
  const realExit = globalThis.document;
  globalThis.document = { pointerLockElement: {}, exitPointerLock() { released = true; }, addEventListener() {} };
  gate2(true);                                  // the stale frame, overlay slot not yet drained
  globalThis.document = realExit;
  assert.equal(released, false, `a request inside the grace (${RELOCK_GRACE_MS}ms) is not torn down by the stale frame`);
});

test('MENU-RELOCK by source: all four hosts ask inside the closing key, and the read never splits a mode\'s dispatch', () => {
  // THE SHAPE, not just the strings. The first draft of this fix put
  // `const hadOverlay = ...` BETWEEN `if (mode === 'interior') {` and
  // its routeKey call, which broke U43's one-dispatch law in two other
  // pins (qs7_one_dispatch, flagsweep): the interior arm routes the
  // whole table over its own ctx with nothing standing in between. So
  // this asserts the read is hoisted ABOVE the mode ladder.
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /const hadOverlay = !!\(mode === 'interior' \? interiorKeyCtx : dungeonCtx\)\?\.uiOverlayActive;\s*\n\s*const closedAWindow = /,
    'one read, above the ladder - not inside a mode\'s arm');
  assert.match(wm, /if \(mode === 'interior'\) \{\s*\n\s*if \(routeKey\(e, interiorKeyCtx, null, keys\)\) e\.preventDefault\(\);/,
    'U43: nothing stands between the interior mode check and its dispatch');
  assert.match(wm, /if \(closedAWindow\(interiorKeyCtx\)\) host\.relock\?\.\(\);/);
  assert.match(wm, /if \(closedAWindow\(dungeonCtx\)\) host\.relock\?\.\(\);/);
  assert.match(wm, /if \(!interiorOverlay\) host\.relock\?\.\(\);/, 'and the key-UP arm, for a window that closes on release');

  // The standalone hosts, both edges each: a two-phase window (the
  // automap) closes on key-UP, and that release is a gesture too.
  const dg = rd('src/scenes/dungeon.js');
  assert.ok((dg.match(/if \(hadOverlay && !ctx\.uiOverlayActive\) requestLook\(canvas\);/g) ?? []).length >= 2,
    'dungeon: keydown and keyup both relock');
  const io = rd('src/scenes/interior.js');
  assert.ok((io.match(/if \(!overlay && !gamePaused\(\)\) requestLook\(canvas\);/g) ?? []).length >= 2,
    'interior: keydown and keyup both relock, and never under a pause');
  const tt = rd('src/scenes/townTalk.js');
  assert.ok((tt.match(/if \(!overlay && !otherOverlayActive\?\.\(\)\) requestLook\(canvas\);/g) ?? []).length >= 2,
    'town talk: both edges, and never under ANOTHER window still up');

  // Every host imports the door it calls - a relock that is a
  // ReferenceError is a relock that never happens.
  for (const [f, src] of [['dungeon.js', dg], ['interior.js', io], ['townTalk.js', tt]]) {
    assert.match(src, /import \{[^}]*\brequestLook\b[^}]*\} from '\.\.\/player\/pointerLock\.js';/, `${f} imports requestLook`);
  }
  // ...and worldModes goes through the host seam, which the world host
  // really provides. THE FIRST DRAFT OF THIS LINE MATCHED THE WHOLE
  // FILE and a mutant walked straight through it: `relock` appears
  // twice in world.js - once on the pause door's object and once on the
  // host literal handed to createWorldModes - so renaming the one that
  // matters still matched the other. `host.relock?.()` is optional-
  // chained, so a missing seam is SILENT: every relock above would
  // simply never happen. The slice is the literal itself.
  const world = rd('src/scenes/world.js');
  const at = world.indexOf('createWorldModes({');
  assert.ok(at > 0, 'the host literal is where it was');
  const literal = world.slice(at, world.indexOf('\n  });', at));
  assert.match(literal, /relock: \(\) => requestLook\(canvas\),/,
    'host.relock is on the object worldModes is GIVEN - not a silent no-op');
});
