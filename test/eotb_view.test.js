import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mwViewWheel, mwViewFrame, mwViewDrawBody, mwViewPendingClicks,
  eotbLane, setEotbBodyReady, setEotbDrawBody, setEotbPlayerState,
} from '../src/player/mwView.js';
import { mwCamera } from '../src/player/mwCamera.js';
import { fpArm } from '../src/combat/fpArm.js';
import { eotbCamera, createEotbCamera } from '../src/player/eotbCamera.js';
import { eotbBody } from '../src/player/eotbBody.js';
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
  // EOTB-IL: the seam no longer gates on the view - the BODY decides,
  // because the first-person billboard (Graphics.FirstPersonBillboard,
  // shipped at Shadows Only) is the same object drawn behind the eye
  assert.equal(mwViewDrawBody(null, {}), true, 'the lane open, the draw door is reached in first person too');
  eotbCamera.toggleOffset(true);
  assert.equal(mwViewDrawBody(null, {}), true, 'and in third');
  assert.deepEqual(painted, ['eotb', 'eotb']);
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

// ═══ AUDIT-EOTB: PINNING THE WIRING, NOT THE UNIT ═════════════════
//
// The arc shipped with 44 pins and 58 dead mutants, and the audit then
// found FIVE faults by driving the camera the way a HOST drives it.
// Every pin above drove `eotbCamera.eye()` directly, with a `dt` and a
// state the pin chose - so none of them could see that no host passed
// either. The lane being gated off meant nothing exercised it, and
// "wired and pinned" was reported on that basis.
//
// These pins take the host's path and nothing else.

test('AUDIT-EOTB F3: the camera MOVES on the host path, and lands where the settings say', () => {
  // Before the fix: no host passed `dt`, so it defaulted to 0,
  // MoveTowards stepped nothing, and the camera parked at whatever the
  // minimum-distance floor clamped the initial zero vector to - the
  // player's FEET, [0, 0, -1.6], forever.
  reset();
  setEotbBodyReady(() => true);
  mwViewWheel(+120);
  const head = [0, 1.6, 0];
  let r;
  const seen = [];
  for (let i = 0; i < 400; i++) {
    r = mwViewFrame({ fpEye: head, feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1 / 60, raycast: () => null });
    if (i < 3) seen.push(Number(r.eye[2].toFixed(4)));
  }
  assert.ok(seen[0] !== seen[1] && seen[1] !== seen[2], `the camera is SMOOTHING, not frozen: ${seen}`);
  assert.equal(Number(r.eye[2].toFixed(4)), -2, 'it settles at the base distance');
  assert.ok(r.eye[1] > head[1], `and ABOVE the head (${r.eye[1].toFixed(2)}), not at the feet`);

  // ...and with no dt it does NOT arrive, which is the fault this pin
  // exists for - stated as a contrast so the pin cannot pass vacuously
  reset();
  setEotbBodyReady(() => true);
  mwViewWheel(+120);
  let z;
  for (let i = 0; i < 400; i++) {
    z = mwViewFrame({ fpEye: head, feet: [0, 0, 0], yaw: 0, pitch: 0, raycast: () => null }).eye;
  }
  assert.notEqual(Number(z[2].toFixed(4)), -2, 'a frame with no dt cannot reach the target - which is why every host must pass one');
  reset();
});

test('AUDIT-EOTB F3b: EVERY host passes dt to the seam - derived from the call sites', () => {
  // GENERATIVE, so a fifth host cannot starve the lane silently. The
  // population is the files that call `mwViewFrame` at all; each must
  // hand it a `dt`.
  const hosts = ['exterior', 'world', 'worldModes', 'dungeon'];
  const callers = [];
  for (const h of hosts) {
    const s = readFileSync(join(root, `src/scenes/${h}.js`), 'utf8');
    if (!/mwViewFrame\(/.test(s)) continue;
    callers.push(h);
    const call = /mwViewFrame\(\{[\s\S]{0,400}?\}\)/.exec(s);
    assert.ok(call, `${h}.js: could not read its mwViewFrame call`);
    assert.match(call[0], /\bdt\b/, `${h}.js calls mwViewFrame without a dt - the camera would freeze there`);
    assert.match(call[0], /riding:/, `${h}.js calls mwViewFrame without riding - the riding offset would never apply`);
  }
  assert.equal(callers.length, 4, `all four hosts call the seam: ${callers.join(', ')}`);
});

test('AUDIT-EOTB F1: the seam ticks the BODY - its clock had no caller at all', () => {
  // `eotbBody.tick()` was written, exported and never called, so the
  // animation clock never advanced and the table never left Idle: the
  // player would have been a single frozen frame.
  reset();
  setEotbBodyReady(() => true);
  // EOTB-IL: the body is the camera's billboard (ToggleOffset drives it)
  // and an idle is ONE frame, so the seam is driven WALKING - the
  // four-frame Move table - and the frame must move within a second
  const renderer = { uploadTexture() {}, createBillboardBatch: () => ({ origin: [0, 0, 0] }), drawBillboards() {}, destroyBillboardBatch() {} };
  eotbBody.attach(renderer, () => ({ motion: { forward: 1, standing: false, speed: 3, grounded: true } }));
  setEotbBodyReady(() => true);   // attach re-arms the gate on the body's own decode
  eotbCamera.toggleOffset(true);  // ToggleOffset is what shows the billboard (IL_1a3c)
  const seen = new Set();
  for (let i = 0; i < 70; i++) {
    mwViewFrame({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1 / 60, raycast: () => null });
    seen.add(eotbBody.state().frame);
  }
  assert.ok(seen.size >= 3, `a second of walking through the seam must advance the sprite’s clock (${[...seen]})`);
  assert.equal(eotbBody.state().table, 'Move', 'in the walk table');
  eotbBody.attach(null, null);
  reset();
});

test('AUDIT-EOTB F2/F4: the camera reads the PLAYER’s settings, and the override arms are reachable', () => {
  // F2: `loadSettings` had no caller, so the camera ran on the vendored
  // defaults and every dial on the pane was inert.
  const c = createEotbCamera();
  c.loadSettings((v, k) => (k === 'Camera.LongitudinalDistance' ? 7 : undefined));
  assert.equal(c.settings().z, -7, 'a player’s own distance reaches the camera');

  // F4: no host passed `weaponReady`, so all three CameraOverride arms
  // were unreachable code. Driven through the state the seam assembles.
  const o = createEotbCamera();
  o.loadSettings((v, k) => ({
    'Camera.LongitudinalDistance': 2, 'Camera.FrontalPlaneOffset': [0, 0],
    'Camera.MinimumDistance': 0, 'Camera.RidingOffset': 1,
    'CameraOverrideWeapon.Enable': true, 'CameraOverrideWeapon.LongitudinalDistance': 5,
    'CameraOverrideWeapon.FrontalPlaneOffset': [0, 0],
  })[k]);
  o.toggleOffset(true);
  const at = (state) => Number(o.eye({
    fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, raycast: null, ...state,
  }).eye[2].toFixed(4));
  assert.equal(at({}), -2, 'nothing readied: the base arm');
  assert.equal(at({ weaponReady: true }), -5, 'a readied weapon reaches the override arm');
  assert.equal(at({ riding: true }), -4, 'and riding reaches the riding scale');
});

test('AUDIT-EOTB F2b: the weapon rig loads the settings and hands the body the state - WITHOUT reaching the view', () => {
  // The two calls that had no caller, pinned at the ONE site that makes
  // them - beside `fpArm.attach`, where the body already attaches.
  const rig = readFileSync(join(root, 'src/combat/weaponRig.js'), 'utf8');
  assert.match(rig, /eotbCamera\.loadSettings\(modSetting\)/, 'the camera is given the player’s settings reader');
  assert.match(rig, /const bindBody = \(\) => eotbBody\.attach\(renderer, eotbState\);/, 'and the state only this rig can answer goes in through the body');
  assert.match(rig, /weaponReady: !playerWeapon\.sheathed \|\| spellArmed\(\)/,
    'weaponReady is the IL’s own test: not sheathed, or a spell readied');

  // AND THE DIRECTION IS THE POINT. F2's first cut called
  // `setEotbPlayerState` from the rig, which imports `mwView.js` into
  // `weaponRig.js` - the one thing MWFIX's pin in `test/mwattach.test.js`
  // forbids, because the classic sprite path is the only path the rig
  // knows. The gate caught it. Asserted from BOTH sides so neither pin
  // can be satisfied by moving the breakage to the other file: the rig
  // never names the view, and the body is the module that does.
  assert.ok(!rig.includes('mwView'), 'the rig never names the view layer');
  const body = readFileSync(join(root, 'src/player/eotbBody.js'), 'utf8');
  assert.match(body, /setEotbPlayerState\(playerState\);/,
    'the body owns the seam, as it already owns setEotbBodyReady and setEotbDrawBody');
  assert.match(body, /setEotbBodyReady|setEotbDrawBody/, 'alongside the two it already owned');
});

test('AUDIT-EOTB F4b: the registered state reaches the camera THROUGH THE SEAM', () => {
  // The first F4 pin drove `createEotbCamera().eye()` with a
  // `weaponReady` of its own - so dropping `eotbPlayerState()` from the
  // seam's frame changed nothing it could see, and the mutant lived.
  //
  // The SAME mistake the whole audit is about, made once more while
  // fixing it. This one goes through `mwViewFrame`, which is the only
  // path a player has.
  reset();
  setEotbBodyReady(() => true);
  eotbCamera.loadSettings((v, k) => ({
    'Camera.LongitudinalDistance': 2, 'Camera.FrontalPlaneOffset': [0, 0],
    'Camera.MinimumDistance': 0,
    'CameraOverrideWeapon.Enable': true, 'CameraOverrideWeapon.LongitudinalDistance': 6,
    'CameraOverrideWeapon.FrontalPlaneOffset': [0, 0],
  })[k]);
  eotbCamera.toggleOffset(true);

  const settle = () => {
    let r;
    for (let i = 0; i < 400; i++) {
      r = mwViewFrame({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1 / 60, raycast: () => null });
    }
    return Number(r.eye[2].toFixed(4));
  };

  setEotbPlayerState(() => ({ weaponReady: false }));
  assert.equal(settle(), -2, 'nothing readied: the base arm, through the seam');

  setEotbPlayerState(() => ({ weaponReady: true }));
  assert.equal(settle(), -6, 'a readied weapon reaches the override arm THROUGH THE SEAM');

  setEotbPlayerState(null);
  eotbCamera.loadSettings(null);
  reset();
});
