import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mwViewWheel, mwViewFrame, mwViewDrawBody, mwViewPendingClicks,
  eotbLane, setEotbBodyReady, setEotbDrawBody,
} from '../src/player/mwView.js';
import { mwCamera } from '../src/player/mwCamera.js';
import { fpArm } from '../src/combat/fpArm.js';
import { eotbCamera } from '../src/player/eotbCamera.js';
import { setModSetting, modSetting } from '../src/systems/modSettings.js';

// ═══ EOTB4: ONE WHEEL, ONE LADDER ═════════════════════════════════
//
// Mac, 2026-09-15: "instead of numpad being used to change views, I
// want it scrollable like how we handle morrowind", and on why the
// port carries a second third-person system at all: "This is moreso
// for those who opt out of using morrowind."
//
// So the seam asks ONE question - which body can answer - and there is
// no setting to choose between them, because there is nothing to
// choose: a player with Morrowind data has the Morrowind body, and a
// player without it never had a third person at all until now.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/player/mwView.js'), 'utf8');

/** Put the seam back the way a fresh session has it. */
function reset() {
  setEotbBodyReady(null);
  setEotbDrawBody(null);
  mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
  eotbCamera.loadSettings(null);
  eotbCamera.toggleOffset(false);
  // BOUNDED. This was a `while`, and it span forever the first time a
  // mutant opened the lane - because the lane's own branch returned
  // before draining the count. That was a real defect in the seam (the
  // notch was stranded), fixed there; the bound stays, because a test
  // helper that can hang is a test suite that can hang.
  for (let i = 0; i < 4 && mwViewPendingClicks(); i++) {
    mwViewFrame({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });
  }
  assert.equal(mwViewPendingClicks(), 0, 'the seam drains its own queue');
}

test('EOTB4: the lane is OFF today, and the gate is the one thing holding it', () => {
  // THE PIN THAT MAKES "wired but inert" A FACT. The seam is built,
  // routed and pinned below, and a player sees exactly what they saw
  // yesterday - because the body cannot be drawn yet. A comment saying
  // so would rot the moment EOTB5 lands; this cannot.
  reset();
  assert.equal(fpArm.canThirdPerson(), false, 'no Morrowind body in this fixture');
  assert.equal(eotbLane(), false, 'and the lane is shut');

  // ...and it is shut on the DRAW, not on the mod being off or on the
  // Morrowind rig - which is what makes turning it on one line.
  setEotbBodyReady(() => true);
  assert.equal(eotbLane(), true, 'the body can draw: the lane opens');
  reset();
  assert.equal(eotbLane(), false, 'and shuts again');
});

test('EOTB4: the mod\u2019s own switch shuts the lane - turning it off really turns it off', () => {
  // The campaign found this hole: every fixture has the mod ENABLED
  // (it is on by default, as every vendored mod is), so deleting the
  // switch check changed nothing and the mutant lived. A default that
  // happens to agree with the code is not a test of the code.
  reset();
  setEotbBodyReady(() => true);
  assert.equal(modSetting('eye-of-the-beholder', 'Enabled'), true, 'on by default, as every vendored mod is');
  assert.equal(eotbLane(), true);
  try {
    setModSetting('eye-of-the-beholder', 'Enabled', false);
    assert.equal(eotbLane(), false, 'off means off - no lane, and the wheel goes back to doing nothing');
    assert.equal(mwViewWheel(+120), false, 'and the notch is refused, as it is for a player with no body at all');
    assert.equal(eotbCamera.pendingClicks(), 0, 'the sprite camera never saw it');
  } finally {
    setModSetting('eye-of-the-beholder', 'Enabled', true);
  }
  assert.equal(eotbLane(), true, 'and back on when the player turns it back on');
  reset();
});

test('EOTB4: the Morrowind body WINS wherever it exists', () => {
  // The order in the predicate is the law: a player who has Morrowind
  // data must never be handed the sprite, whatever the mod's switch
  // says. Driven against the real `fpArm`, with its own answer stubbed
  // for the length of the test.
  reset();
  setEotbBodyReady(() => true);
  assert.equal(eotbLane(), true);
  const real = fpArm.canThirdPerson;
  try {
    fpArm.canThirdPerson = () => true;
    assert.equal(eotbLane(), false, 'the Morrowind rig can serve - the sprite lane stands down');
  } finally { fpArm.canThirdPerson = real; }
  assert.equal(eotbLane(), true, 'and takes it back when the rig cannot');
  reset();
});

test('EOTB4: one notch, and it reaches whichever body answers - not both, not neither', () => {
  reset();
  // lane SHUT: the notch is Morrowind's, and with no body it is refused
  // exactly as it always was
  assert.equal(mwViewWheel(+120), false, 'scroll down with no body at all: nothing happens');
  assert.equal(mwViewPendingClicks(), 0, 'and nothing was queued');
  assert.equal(eotbCamera.pendingClicks(), 0, 'the sprite camera saw nothing either');

  // lane OPEN: the same notch goes to the sprite camera and NOT to
  // Morrowind's pending count
  setEotbBodyReady(() => true);
  assert.equal(mwViewWheel(+120), true, 'scroll down now means something');
  assert.equal(eotbCamera.pendingClicks(), -1, 'the sprite camera has the notch');
  assert.equal(mwViewPendingClicks(), 0, 'and Morrowind’s count never moved');
  reset();
});

test('EOTB4: the sign is the SAME at the seam - down is out of the head in both lanes', () => {
  // Browser deltaY is positive scrolling DOWN; both ladders read a
  // negative click as "out of the head". If the two disagreed the seam
  // would need a flip, and a flip is the kind of thing that is right
  // in one lane and silently backwards in the other.
  reset();
  setEotbBodyReady(() => true);
  assert.equal(eotbCamera.mode(), 'first');
  mwViewWheel(+120);                                   // scroll DOWN
  mwViewFrame({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0.016 });
  assert.equal(eotbCamera.mode(), 'third', 'down leaves first person in the sprite lane');

  reset();
  const realCan = fpArm.canThirdPerson;
  try {
    fpArm.canThirdPerson = () => true;                 // the Morrowind lane
    assert.equal(mwCamera.mode(), 'first');
    mwViewWheel(+120);                                 // the same scroll DOWN
    assert.equal(mwViewPendingClicks(), -1, 'the same sign reaches Morrowind’s ladder');
  } finally { fpArm.canThirdPerson = realCan; }
  reset();
});

test('EOTB4: the frame returns the sprite camera’s eye, and Morrowind’s machine never runs', () => {
  reset();
  setEotbBodyReady(() => true);
  const before = mwCamera.mode();
  mwViewWheel(+120);
  const r = mwViewFrame({
    fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, raycast: null,
  });
  assert.equal(r.thirdPerson, true, 'the frame is in third person');
  assert.equal(Number(r.eye[2].toFixed(4)), -2, '...at the sprite camera’s base distance');
  assert.equal(mwCamera.mode(), before, 'and the Morrowind camera was not touched');
  assert.equal(mwViewPendingClicks(), 0);
  reset();
});

test('EOTB4: the body draw routes, and cannot be reached with nothing to draw', () => {
  reset();
  const painted = [];
  setEotbDrawBody(() => { painted.push('eotb'); return true; });
  // the draw door alone does NOT open the lane - readiness does, and
  // the two are set together by the host
  assert.equal(eotbLane(), false, 'a draw function with no readiness is still no lane');
  assert.equal(mwViewDrawBody(null, {}), false, 'so nothing is painted');
  assert.deepEqual(painted, []);

  setEotbBodyReady(() => true);
  eotbCamera.toggleOffset(false);
  assert.equal(mwViewDrawBody(null, {}), false, 'in first person the sprite is not painted');
  assert.deepEqual(painted, []);

  eotbCamera.toggleOffset(true);
  assert.equal(mwViewDrawBody(null, {}), true, 'in third person it is');
  assert.deepEqual(painted, ['eotb']);
  reset();
});

test('EOTB4: the seam names its debt rather than hiding it', () => {
  // The file is still `mwView.js` while serving a body that has
  // nothing to do with Morrowind. That is a naming debt, and the rule
  // this repo runs on is that a departure nobody wrote down does not
  // exist - so the head has to SAY it, and this pin is what keeps the
  // sentence there when someone tidies the header.
  assert.match(src, /THE FILE IS STILL CALLED mwView, AND THAT IS A DEBT/,
    'the head must name the naming debt');
  assert.match(src, /THIS SEAM NOW SERVES TWO BODIES/,
    'and say plainly that it is no longer Morrowind’s alone');
  // ...and the lane is a PREDICATE the pins can drive, not a condition
  // spelled out at three call sites
  assert.equal((src.match(/export function eotbLane\(\)/g) ?? []).length, 1, 'one home for the question');
  // ...and ALL THREE seams ask it. Counting raw occurrences would count
  // the doc comments too, so the question is asked of each function's
  // own body - which is the thing that actually has to be true, and
  // which reddens if a later slice wires one seam and forgets another.
  const bodyOf = (name) => {
    const i = src.indexOf(`export function ${name}(`);
    assert.notEqual(i, -1, `${name} is exported`);
    const j = src.indexOf('\nexport ', i + 1);
    return src.slice(i, j === -1 ? undefined : j);
  };
  for (const fn of ['mwViewWheel', 'mwViewFrame', 'mwViewDrawBody']) {
    assert.match(bodyOf(fn), /eotbLane\(\)/, `${fn} must ask which body answers`);
  }
});

test('EOTB4: a notch queued before the lane opened is DROPPED, not left to fire later', () => {
  // The case: the player scrolls while the lane is shut (the notch
  // goes to Morrowind's queue), and the lane opens before the frame
  // runs - the Morrowind body finished building, or the mod was
  // switched mid-scroll. The queued notch belongs to a camera the
  // player is no longer looking through.
  //
  // It is not enough to route the frame: the lane's branch returns
  // BEFORE Morrowind's drain, so a notch left in the queue is never
  // spent at all and fires whenever the lane next closes. Found by a
  // test helper that span forever waiting for the queue to empty.
  reset();
  assert.equal(eotbLane(), false, 'shut, so the notch goes to Morrowind’s queue');
  const realCan = fpArm.canThirdPerson;
  try {
    fpArm.canThirdPerson = () => true;          // a Morrowind body, so the notch is accepted
    mwViewWheel(+120);
    assert.equal(mwViewPendingClicks(), -1, 'queued');
  } finally { fpArm.canThirdPerson = realCan; }

  setEotbBodyReady(() => true);                 // ...and now the lane opens under it
  assert.equal(eotbLane(), true);
  mwViewFrame({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0.016 });
  assert.equal(mwViewPendingClicks(), 0, 'the stale notch is gone, not waiting');

  // ...and it really was DROPPED rather than spent on the sprite camera
  assert.equal(eotbCamera.mode(), 'first', 'the sprite camera did not act on a notch meant for the other lane');
  reset();
});
