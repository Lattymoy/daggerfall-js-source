import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createEotbCamera, readCameraSettings, eyeVector, eyeBasis, bodyVector, EYE_RADIUS, MAX_Z,
} from '../src/player/eotbCamera.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';

// ═══ EOTB2: THE CAMERA, READ OFF THE IL ═══════════════════════════
//
// Mac, 2026-09-15: "Alright next mod I want to add 1:1", and on why a
// port that already has third person carries a second one: "This is
// moreso for those who opt out of using morrowind."
//
// Every law here comes from `EyeOfTheBeholder`'s own IL, read with
// dncil/dnfile (monodis segfaults on this assembly) and with the
// branch targets normalised - a misread branch is how a "1:1" port
// quietly stops being one, and the first dump had them printing
// absolute.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Round for comparison, and normalise signed zero: `(-0).toFixed()`
 *  keeps the sign and `deepEqual` tells -0 from 0, so a direction
 *  component that is exactly zero would fail on its sign alone. */
const r6 = (n) => Number(n.toFixed(6)) + 0;
const r3 = (n) => Number(n.toFixed(3)) + 0;
const r4 = (n) => Number(n.toFixed(4)) + 0;

const vendored = JSON.parse(readFileSync(join(root, 'vendor/eye-of-the-beholder/modsettings.json'), 'utf8'));
const shipped = (section, key) => vendored.Sections.find((s) => s.Name === section).Keys.find((k) => k.Name === key).Value;

test('EOTB2: the settings are the BUNDLE’s, sign flip and all - derived, never typed', () => {
  // LoadSettings reads `LongitudinalDistance` and multiplies by -1, so
  // a POSITIVE setting means that many metres BEHIND. Pinned against
  // the vendored JSON rather than against a literal, so a port that
  // drifts from the bundle reddens here and nowhere else has to know.
  const cfg = readCameraSettings(null);
  assert.equal(cfg.z, -shipped('Camera', 'LongitudinalDistance'), 'offsetZ = LongitudinalDistance * -1');
  assert.equal(cfg.overrides.Weapon.z, -shipped('CameraOverrideWeapon', 'LongitudinalDistance'));
  assert.equal(cfg.overrides.Mount.z, -shipped('CameraOverrideMount', 'LongitudinalDistance'));
  assert.equal(cfg.overrides.Boat.z, -shipped('CameraOverrideBoat', 'LongitudinalDistance'));
  // ...and the rest carry over UNFLIPPED, which is the half that makes
  // the flip a finding rather than a blanket negation
  const t = shipped('Camera', 'FrontalPlaneOffset');
  assert.equal(cfg.x, t.First);
  assert.equal(cfg.y, t.Second);
  assert.equal(cfg.minZ, shipped('Camera', 'MinimumDistance'));
  assert.equal(cfg.riding, shipped('Camera', 'RidingOffset'));
  assert.equal(cfg.speed, shipped('Camera', 'Speed'));
  assert.equal(cfg.dampen, shipped('Camera', 'Dampen'));
  assert.equal(cfg.mirrorTime, shipped('Camera', 'SwitchResetTime'));
  assert.equal(cfg.mirrorAuto, shipped('Camera', 'Auto-Switch'));
  assert.equal(cfg.increment, shipped('CameraScrolling', 'ScrollIncrement'));
  assert.equal(cfg.startInThird, shipped('Camera', 'StartInThirdPerson'));

  // THE ONE DEPARTURE IN THIS FILE, asserted as a departure: the bundle
  // ships the scrollable arm OFF and the port ships it ON (MODS-ON, and
  // Mac's own ask). Written this way round so it cannot be mistaken for
  // agreement with the bundle.
  assert.equal(shipped('CameraScrolling', 'ScrollableZOffset'), false, 'the bundle ships it off');
  assert.equal(cfg.scrollable, true, 'and the port ships it on - EOTB4, Ledger MODS-ON');
  assert.equal(MOD_SETTINGS['eye-of-the-beholder'].keys['CameraScrolling.ScrollableZOffset'].default, true);
});

test('EOTB2: the wheel is ONE LADDER - out of the head, out and out, and back into the head', () => {
  // Mac: "instead of numpad being used to change views, I want it
  // scrollable like how we handle morrowind." This is the mod's OWN
  // CameraScrolling arm, and its shape is already Morrowind's, which
  // is what lets the two cameras share a ladder honestly rather than
  // by assertion.
  const c = createEotbCamera();
  c.loadSettings(null);
  c.toggleOffset(false);
  const cfg = c.settings();
  const z = () => Number((cfg.z - c.scroll()).toFixed(6));
  const down = (n) => { for (let i = 0; i < n; i++) { c.wheel(-1); c.tick({}); } };
  const up = (n) => { for (let i = 0; i < n; i++) { c.wheel(1); c.tick({}); } };

  assert.equal(c.mode(), 'first');
  down(1);
  assert.equal(c.mode(), 'third', 'one notch out of the head');
  assert.equal(z(), cfg.z, '...and it lands at the BASE distance, not at the near end');

  down(5);
  assert.equal(z(), Number((cfg.z - 5 * cfg.increment).toFixed(6)), 'five notches, five increments further');

  down(100);
  assert.equal(z(), MAX_Z, 'the far end is a hard pin at -10, however long the wheel turns');
  assert.equal(c.mode(), 'third');

  // back in: the near end is -MinimumDistance, and crossing it drops
  // to first person rather than pushing the camera through the body
  const notches = Math.ceil((MAX_Z * -1 - cfg.minZ) / cfg.increment) + 1;
  up(notches);
  assert.equal(c.mode(), 'first', `${notches} notches in and the eye is back in the head`);

  // ...and coming back OUT starts from the base again, because
  // ToggleOffset(true) zeroes the scroll - a player who pushed the
  // camera to -10, stepped back into the head and scrolled out again
  // must not reappear at -10.
  down(1);
  assert.equal(c.mode(), 'third');
  assert.equal(z(), cfg.z, 'out of the head is always the base distance');
});

test('EOTB2: one increment a FRAME, sign only - three notches move the camera as far as one', () => {
  // The mod reads `Input.GetAxis` ONCE per Update and branches on its
  // sign; it never scales by the reading's magnitude. The port queues
  // DOM wheel events (MW-D30's lesson, for the same reason) and must
  // spend them the same way, or a fast scroll on a fast mouse moves
  // the camera several times as far as the mod ever would.
  const one = createEotbCamera(), three = createEotbCamera();
  for (const c of [one, three]) { c.loadSettings(null); c.toggleOffset(true); }
  one.wheel(-1); one.tick({});
  three.wheel(-1); three.wheel(-1); three.wheel(-1); three.tick({});
  assert.equal(three.scroll(), one.scroll(), 'three notches in one frame is one increment, as the mod reads it');
  assert.equal(one.scroll(), one.settings().increment);
  // and the clicks really were queued rather than dropped
  const q = createEotbCamera(); q.loadSettings(null);
  q.wheel(-1); q.wheel(-1);
  assert.equal(q.pendingClicks(), -2, 'the frame’s notches accumulate');
  q.tick({});
  assert.equal(q.pendingClicks(), 0, '...and flush once');
});

test('EOTB2: posOffset’s four arms, in the order the IL tests them', () => {
  // boat, then mount, then weapon, then the base - so a MOUNTED player
  // with a weapon readied takes the MOUNT offsets, because the mount
  // arm returns first. The order is the finding; a set of arms tested
  // in any order would pass a pin that only drove one at a time.
  const get = (v, k) => ({
    'CameraOverrideBoat.Enable': true, 'CameraOverrideBoat.LongitudinalDistance': 3,
    'CameraOverrideMount.Enable': true, 'CameraOverrideMount.LongitudinalDistance': 4,
    'CameraOverrideWeapon.Enable': true, 'CameraOverrideWeapon.LongitudinalDistance': 5,
    'Camera.LongitudinalDistance': 2, 'Camera.RidingOffset': 0,
  })[k];
  const c = createEotbCamera(); c.loadSettings(get); c.toggleOffset(true);
  const zFor = (state) => {
    const r = c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, ...state });
    return Number(r.eye[2].toFixed(4));
  };
  // with dt enormous the smoothing lands exactly on the target, so the
  // eye's z IS the arm's offset - one reading per arm
  assert.equal(zFor({ sailing: true, riding: true, weaponReady: true }), -3, 'sailing wins over everything');
  assert.equal(zFor({ riding: true, weaponReady: true }), -4, 'mounted wins over a readied weapon');
  assert.equal(zFor({ weaponReady: true }), -5, 'a readied weapon wins over the base');
  assert.equal(zFor({}), -2, 'and the base is the base');
});

test('EOTB2: the riding offset scales the BASE arm and not the override arms', () => {
  // `get_offsetRidingMod` is consulted only in posOffset's last arm -
  // the mod's own asymmetry, and exactly the kind of thing a port
  // "tidies up" by accident.
  const base = createEotbCamera();
  base.loadSettings((v, k) => ({ 'Camera.LongitudinalDistance': 2, 'Camera.RidingOffset': 1, 'Camera.FrontalPlaneOffset': [0, 0] })[k]);
  base.toggleOffset(true);
  const z = (state) => Number(base.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, ...state }).eye[2].toFixed(4));
  assert.equal(z({}), -2);
  assert.equal(z({ riding: true }), -4, 'riding doubles the base at RidingOffset 1 (z + z*1)');

  const over = createEotbCamera();
  over.loadSettings((v, k) => ({
    'Camera.RidingOffset': 1, 'Camera.FrontalPlaneOffset': [0, 0],
    'CameraOverrideMount.Enable': true, 'CameraOverrideMount.LongitudinalDistance': 4,
    'CameraOverrideMount.FrontalPlaneOffset': [0, 0],
  })[k]);
  over.toggleOffset(true);
  const zo = over.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, riding: true }).eye[2];
  assert.equal(Number(zo.toFixed(4)), -4, 'the MOUNT arm is NOT scaled by the riding offset');
});

test('EOTB2: the obstacle cast is per axis, skipped when the offset is zero, and keeps the mod’s clearance', () => {
  // `|offset * 2| + eyeRadius` out, `hit - eyeRadius * 2` back. And an
  // axis whose offset is zero is not cast at all - a camera straight
  // behind the player casts ONCE, not three times, which is both the
  // mod's behaviour and the reason the port can afford it every frame.
  const casts = [];
  const raycast = (o, d, len) => { casts.push({ d: d.map(r3), len: r4(len) }); return null; };
  const c = createEotbCamera();
  c.loadSettings((v, k) => ({ 'Camera.FrontalPlaneOffset': [0, 0], 'Camera.LongitudinalDistance': 2, 'Camera.MinimumDistance': 0 })[k]);
  c.toggleOffset(true);
  c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1, raycast });
  assert.equal(casts.length, 1, 'x and y are zero, so only z is cast');
  assert.equal(casts[0].len, Math.abs(-2 * 2) + EYE_RADIUS, 'the cast runs |offset * 2| + eyeRadius');
  assert.deepEqual(casts[0].d, [0, 0, -1], 'a negative z offset casts BACKWARD along the view');

  // now with all three, and a hit on z
  casts.length = 0;
  const c2 = createEotbCamera();
  c2.loadSettings((v, k) => ({ 'Camera.FrontalPlaneOffset': [0.5, 0.5], 'Camera.LongitudinalDistance': 2, 'Camera.MinimumDistance': 0, 'Camera.Auto-Switch': false })[k]);
  c2.toggleOffset(true);
  c2.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1, raycast: (o, d, len) => (d[2] < -0.5 ? 1.5 : null) });
  const [, , bz] = c2.bounds();
  assert.equal(bz, 1.5 - EYE_RADIUS * 2, 'a hit records hit.distance - eyeRadius * 2');
});

test('EOTB2: the auto-switch flips the shoulder INSIDE CheckBounds, before the y and z casts', () => {
  // The flip sits between the X cast and the Y cast, so the two casts
  // that follow already see the MIRRORED offset. That ordering is
  // load-bearing and is exactly what a tidy-up would move.
  const c = createEotbCamera();
  c.loadSettings((v, k) => ({
    'Camera.FrontalPlaneOffset': [1, 1], 'Camera.LongitudinalDistance': 2,
    'Camera.Auto-Switch': true, 'Camera.SwitchResetTime': 3, 'Camera.MinimumDistance': 0,
  })[k]);
  c.toggleOffset(true);
  assert.equal(c.mirrored(), false);
  const seen = [];
  // a wall immediately to the RIGHT: the x cast comes back short
  c.eye({
    fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1,
    raycast: (o, d, len) => { seen.push(d.map((n) => Number(n.toFixed(2)) + 0)); return Math.abs(d[0]) > 0.5 ? 0.3 : null; },
  });
  assert.equal(c.mirrored(), true, 'no room on that side - the shoulder switches');
  assert.deepEqual(seen[0], [1, 0, 0], 'the x cast went right first');
  assert.ok(seen.length >= 3, 'and y and z were still cast after the flip');
});

test('EOTB2: SetVectorBounds clamps on the side the offset points, and leaves a zero axis alone', () => {
  const c = createEotbCamera();
  c.loadSettings((v, k) => ({ 'Camera.FrontalPlaneOffset': [0, 0], 'Camera.LongitudinalDistance': 2, 'Camera.MinimumDistance': 0 })[k]);
  c.toggleOffset(true);
  // a wall 1.0 back: the eye is pulled in to hit - 2*eyeRadius
  const r = c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, raycast: () => 1.0 });
  assert.equal(Number(r.eye[2].toFixed(4)), -(1.0 - EYE_RADIUS * 2), 'the camera stops at the wall, not through it');
  assert.equal(Number(r.eye[0].toFixed(6)), 0, 'the x axis had no offset and was never touched');
});

test('EOTB2: the minimum distance is a FRACTION of the live offset, and yields to a nearer wall', () => {
  // `minZ = posOffset.z * offsetMinZ`, and the floor applies only while
  // `boundsZ > |minZ|` - so a camera already pinned against a wall is
  // left where the WALL put it rather than being pushed back out to
  // the floor. Two readings, because one proves half the law.
  const mk = () => {
    const c = createEotbCamera();
    c.loadSettings((v, k) => ({ 'Camera.FrontalPlaneOffset': [0, 0], 'Camera.LongitudinalDistance': 2, 'Camera.MinimumDistance': 0.8 })[k]);
    c.toggleOffset(true);
    return c;
  };
  const free = mk().eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, raycast: () => null });
  assert.equal(Number(free.eye[2].toFixed(4)), -2, 'nothing in the way: the floor does not pull the camera IN');

  const pinned = mk().eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, raycast: () => 1.0 });
  assert.equal(Number(pinned.eye[2].toFixed(4)), -(1.0 - EYE_RADIUS * 2),
    'a wall nearer than the floor wins - the floor does not push the camera back through it');
});

test('EOTB2: the smoothing is MoveTowards, and dampen scales the step by the distance left', () => {
  // `s = dampen ? speed * |current - target| / dampen : speed`, then
  // MoveTowards(current, target, dt * s). Driven frame by frame rather
  // than asserted from the source, because the source is what the pin
  // is supposed to be checking.
  const c = createEotbCamera();
  c.loadSettings((v, k) => ({
    'Camera.FrontalPlaneOffset': [0, 0], 'Camera.LongitudinalDistance': 2,
    'Camera.MinimumDistance': 0, 'Camera.Speed': 10, 'Camera.Dampen': 1,
  })[k]);
  c.toggleOffset(true);
  const step = () => c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0.016, raycast: null }).eye[2];
  const a = step(), b = step(), d = step();
  assert.ok(a > -2 && b > -2, 'the camera is still on its way out');
  assert.ok(b < a && d < b, 'and it keeps going');
  assert.ok(Math.abs(b - a) > Math.abs(d - b),
    'dampen makes each step smaller as the gap closes - a constant step would move the same every frame');
  // ...and it never overshoots: MoveTowards clamps at the target
  const far = c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, raycast: null });
  assert.equal(Number(far.eye[2].toFixed(6)), -2, 'a huge step lands ON the target, never past it');
});

test('EOTB2: the offset rides the EYE’s basis, so looking up walks the camera along the view', () => {
  // `eye.transform.TransformVector(...)`, not the body's - which is why
  // pitching changes where the camera sits and not merely where it
  // looks. Checked as arithmetic, both helpers, so a swap of the two
  // frames cannot pass.
  const v = [0, 0, -2];
  assert.deepEqual(bodyVector(v, 0).map(r6), [0, 0, -2]);
  const level = eyeVector(v, 0, 0).map(r6);
  const up = eyeVector(v, 0, Math.PI / 4).map(r6);
  assert.deepEqual(level, [0, 0, -2], 'level: straight back');
  assert.ok(up[1] < -1, 'pitched up, the camera drops BELOW the head as it swings back');
  assert.ok(Math.abs(up[2]) < 2, '...and comes in closer on z');
  // the body frame ignores pitch entirely, which is the contrast that
  // makes the eye frame a finding
  assert.deepEqual(bodyVector(v, Math.PI / 2).map(r6), [-2, 0, 0]);
});

// ═══ THE PINS THE FIRST CAMPAIGN EXPOSED ══════════════════════════
//
// Five mutants survived the pins above, and four were holes in the
// pins rather than in the code. They are worth naming because each is
// a different way of not-quite-testing a thing:
//
//   - the wheel's scaling was pinned on ONE SIGN. `clicks > 0` and
//     `clicks < 0` are two lines, and the campaign only drove one.
//   - the minimum distance was pinned where it DOES NOT BITE: at rest
//     the camera sits further out than the floor, so a floor that is a
//     fraction and a floor that is a distance give the same answer.
//   - the frame the offset rides was pinned on the HELPERS and never
//     on the CAMERA, and every drive above is at pitch 0, where the
//     body frame and the eye frame are the same thing. The F-SING
//     lesson in a new dress: a pin on the parts is not a pin on the
//     wiring.
//   - `ToggleOffset` zeroing the scroll could not be seen through
//     `tick`, which zeroes it too.
//
// The fifth (dropping tick's own `offsetScroll = 0`) is REDUNDANT in
// the mod itself - ToggleOffset already zeroes it on the only path
// that reaches there - so it is recorded here rather than pinned. It
// is kept because the IL keeps it, and this sentence is why no later
// reader should "simplify" it on the grounds that no test fails.

test('EOTB2: the wheel is one increment in BOTH directions', () => {
  const mk = () => { const c = createEotbCamera(); c.loadSettings(null); c.toggleOffset(true); return c; };
  for (const sign of [-1, 1]) {
    const one = mk(), many = mk();
    one.wheel(sign); one.tick({});
    for (let i = 0; i < 4; i++) many.wheel(sign);
    many.tick({});
    assert.equal(many.scroll(), one.scroll(), `four notches at sign ${sign} is one increment`);
    assert.equal(Math.abs(one.scroll()), one.settings().increment, `sign ${sign} moved exactly one increment`);
  }
});

test('EOTB2: the minimum distance BITES while the camera is still swinging out', () => {
  // At rest the camera sits at -2 and the floor is -1.6, so the floor
  // is idle and a fraction and a flat distance agree. It bites in the
  // frames where the camera has not got there yet - which is the whole
  // reason it exists, and the only place the two readings differ.
  const c = createEotbCamera();
  c.loadSettings((v, k) => ({
    'Camera.FrontalPlaneOffset': [0, 0], 'Camera.LongitudinalDistance': 2,
    'Camera.MinimumDistance': 0.8, 'Camera.Speed': 1, 'Camera.Dampen': 0,
  })[k]);
  c.toggleOffset(true);
  // one small step: MoveTowards has moved the eye a little way back,
  // nowhere near -2, so the floor clamps it to z * minZ = -1.6
  const r = c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0.1, raycast: () => null });
  assert.equal(r4(r.eye[2]), -1.6,
    'the floor is a FRACTION of the live offset (-2 * 0.8), not the setting read as a distance (-0.8)');
});

test('EOTB2: the CAMERA rides the eye frame - proven under pitch, where the two frames differ', () => {
  // Every other drive in this file is at pitch 0, and at pitch 0 the
  // body frame and the eye frame agree exactly. So this one pitches.
  const c = createEotbCamera();
  c.loadSettings((v, k) => ({
    'Camera.FrontalPlaneOffset': [0, 0], 'Camera.LongitudinalDistance': 2, 'Camera.MinimumDistance': 0,
  })[k]);
  c.toggleOffset(true);
  const pitch = Math.PI / 4;
  const r = c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch, dt: 1000, raycast: null });
  const head = [0, 1.6, 0];
  const want = eyeVector([0, 0, -2], 0, pitch);
  assert.deepEqual(r.eye.map(r4), [r4(head[0] + want[0]), r4(head[1] + want[1]), r4(head[2] + want[2])],
    'the camera sits where the EYE frame puts it');
  // ...and NOT where the body frame would, which is the half that
  // makes this a pin rather than a restatement
  const bodyWould = bodyVector([0, 0, -2], 0);
  assert.notDeepEqual(r.eye.map(r4), [r4(head[0] + bodyWould[0]), r4(head[1] + bodyWould[1]), r4(head[2] + bodyWould[2])],
    'looking up must move the camera, not just turn it');
  assert.ok(r.eye[1] < head[1], 'pitched up, the camera swings DOWN behind the player');
});

test('EOTB2: ToggleOffset itself zeroes the scroll - on the path that does not go through tick', () => {
  // `start()` (StartInThirdPerson) and the auto-toggle table both call
  // ToggleOffset directly, so the zeroing has to live there and not
  // only in the wheel's own arm.
  const c = createEotbCamera();
  c.loadSettings(null);
  c.toggleOffset(true);
  for (let i = 0; i < 3; i++) { c.wheel(-1); c.tick({}); }
  assert.ok(c.scroll() > 0, 'the camera has been pushed out');
  c.toggleOffset(false);
  assert.equal(c.scroll(), c.settings().increment * 3, 'leaving third person does NOT reset it (the mod does not)');
  c.toggleOffset(true);
  assert.equal(c.scroll(), 0, 'and entering third person does');
});

// ═══ AUDIT-EOTB: WHAT THE CAMPAIGN NEVER ASKED ════════════════════
//
// The first campaign killed 17 of 18 and the arc shipped. The audit
// then drove the camera through the path a HOST actually takes and
// found five faults, none of which any pin could see - because every
// pin drove `eotbCamera.eye()` directly, with arguments the pin chose.
//
// A pin on the unit is not a pin on the wiring. That is the F-SING
// lesson again, and this is the third arc it has cost.

test('AUDIT-EOTB F5: UP IS UP - a pure +Y offset RAISES the camera', () => {
  // `FrontalPlaneOffset`'s second value is shipped at 0.5 and the mod
  // describes it as "Moves the camera position on the X and Y axes".
  // The basis had `right x forward`, which is up = [0,-1,0] at rest,
  // so that setting pushed the camera DOWN - into the floor at the
  // shipped default.
  //
  // It survived 18 mutants because the ONE pin that drove the basis
  // under pitch reasoned about the FORWARD term ("pitched up, the
  // camera swings down behind the player" - true, and true either
  // way) and never isolated a pure +Y offset, where the sign IS the
  // answer.
  const b = eyeBasis(0, 0);
  assert.deepEqual(b.up.map(r6), [0, 1, 0], 'at rest the eye frame’s up is world up');
  assert.deepEqual(eyeVector([0, 0.5, 0], 0, 0).map(r6), [0, 0.5, 0], 'a +Y offset is a +Y move');
  assert.deepEqual(eyeVector([0, -0.5, 0], 0, 0).map(r6), [0, -0.5, 0], '...and a -Y offset a -Y move');

  // the basis is RIGHT-HANDED and orthonormal at any look, which is
  // the general statement of the same law - a sign flip anywhere in it
  // breaks one of these
  for (const [yaw, pitch] of [[0, 0], [1, 0.3], [-2.2, -0.7], [Math.PI, 1.2]]) {
    const { right, up, forward } = eyeBasis(yaw, pitch);
    const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    const len = (a) => Math.hypot(...a);
    assert.ok(Math.abs(len(right) - 1) < 1e-9 && Math.abs(len(up) - 1) < 1e-9 && Math.abs(len(forward) - 1) < 1e-9,
      `yaw ${yaw} pitch ${pitch}: the basis is unit`);
    assert.ok(Math.abs(dot(right, up)) < 1e-9 && Math.abs(dot(right, forward)) < 1e-9 && Math.abs(dot(up, forward)) < 1e-9,
      `yaw ${yaw} pitch ${pitch}: the basis is orthogonal`);
    // right x up = forward for a right-handed frame
    const cross = [
      right[1] * up[2] - right[2] * up[1],
      right[2] * up[0] - right[0] * up[2],
      right[0] * up[1] - right[1] * up[0],
    ];
    assert.ok(cross.every((v, i) => Math.abs(v - forward[i]) < 1e-9),
      `yaw ${yaw} pitch ${pitch}: right x up = forward - the frame is right-handed`);
    // and up always points into the upper half: a camera offset "up"
    // must never go underground, at any look
    assert.ok(up[1] > 0, `yaw ${yaw} pitch ${pitch}: up has a positive Y`);
  }
});

test('AUDIT-EOTB F5b: the SHIPPED offset puts the camera above the feet, not below', () => {
  // The symptom a player would have seen, stated as the player would
  // state it: standing still, scrolled out, at the mod's own defaults.
  const c = createEotbCamera();
  c.loadSettings(null);
  c.toggleOffset(true);
  let r;
  for (let i = 0; i < 400; i++) {
    r = c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1 / 60, raycast: () => null });
  }
  assert.ok(r.eye[1] > 1.6, `the camera sits ABOVE the head at the shipped +0.5 Y offset, not at ${r.eye[1].toFixed(2)}`);
  assert.equal(r4(r.eye[2]), -2, '...and at the base distance behind');
});

// ═══ EOTB-IL (2026-09-16): THE CAMERA, AGAINST THE ASSEMBLY ═════════
//
// The shipped `.dfmod` is open (vendor/eye-of-the-beholder/il/). These
// pin the places where EOTB2's reading of the camera was wrong or
// short, each at its IL offset.

const cfgGet = (over = {}) => (vendor, key) => (key in over ? over[key] : undefined);

test('EOTB-IL camera: the bounds seed at 2.0, not zero (the .ctor’s field initialisers)', () => {
  const c = createEotbCamera();
  assert.deepEqual(c.bounds(), [2, 2, 2], 'a fresh camera measures nothing yet and clamps to two metres');
  c.start();
  assert.deepEqual(c.bounds(), [2, 2, 2], 'and Start puts them back');
});

test('EOTB-IL camera: autoPOVSwitch is DERIVED from the nine rows (IL_10e1-IL_112d) - the bundle ships it disarmed', () => {
  assert.equal(readCameraSettings(null).autoPOVSwitch, false, 'every row at Don’tChange: nothing armed');
  assert.equal(readCameraSettings(cfgGet({ 'AutoTogglePerspective.OnHorse': 2 })).autoPOVSwitch, true, 'one row set: armed');
  const c = createEotbCamera();
  c.loadSettings(cfgGet({ 'AutoTogglePerspective.OnFoot': 1 }));
  assert.equal(c.autoArmed(), true, 'and LoadSettings re-derives it');
  c.loadSettings(null);
  assert.equal(c.autoArmed(), false);
});

test('EOTB-IL camera: the ladder tests the Z captured BEFORE the notch (IL_1253-IL_125d, IL_12ef, IL_1317)', () => {
  const c = createEotbCamera();
  // z = -1, near end at -0.5, one notch = 0.2
  c.loadSettings(cfgGet({ 'Camera.LongitudinalDistance': 1, 'Camera.MinimumDistance': 0.5, 'CameraScrolling.ScrollIncrement': 0.2, 'CameraScrolling.ScrollableZOffset': true }));
  c.toggleOffset(true);
  // notch 1: z before -1.0 -> scroll 0.2 (z -0.8). notch 2: z before -0.8 -> scroll 0.4 (z -0.6).
  // notch 3: z before -0.6 -> scroll 0.6 (z -0.4). notch 4: z before -0.4 > -0.5 -> first person.
  // A FRESH reading would have left on notch 3 (z after -0.4).
  for (let i = 1; i <= 3; i++) { c.wheel(1); c.tick({}); assert.equal(c.thirdPerson(), true, `still third after notch ${i}`); }
  c.wheel(1); c.tick({});
  assert.equal(c.thirdPerson(), false, 'the notch AFTER crossing the near end leaves');
  // the far end: z = -9.9, scrolling out - the pin at -10 lands on the notch after the crossing
  const d = createEotbCamera();
  d.loadSettings(cfgGet({ 'Camera.LongitudinalDistance': 9.9, 'Camera.MinimumDistance': 0.1, 'CameraScrolling.ScrollIncrement': 0.2, 'CameraScrolling.ScrollableZOffset': true }));
  d.toggleOffset(true);
  d.wheel(-1); d.tick({});
  assert.equal(r6(d.scroll()), 0.2, 'notch 1: z before -9.9 is not past -10, so it scrolls out to -10.1');
  d.wheel(-1); d.tick({});
  assert.equal(r6(d.scroll()), 0.1, 'notch 2: z before -10.1 IS past -10 - corrected so that z reads exactly -10 (IL_12fe)');
  // and because the test reads the STALE value, a notch from exactly -10
  // steps out to -10.3 and the one after pulls it back: the mod's own
  // two-notch hover at the far end, kept rather than smoothed over
  d.wheel(-1); d.tick({});
  assert.equal(r6(d.scroll()), 0.3, 'notch 3: z before -10 is not past -10, so it steps out once more');
  d.wheel(-1); d.tick({});
  assert.equal(r6(d.scroll()), 0.1, 'notch 4: corrected again');
});

test('EOTB-IL camera: the MIRRORED base arm scales Z alone by the riding offset (IL_032f-IL_035b vs IL_040d-IL_0446)', () => {
  const settle = (c, state) => {
    let out = null;
    for (let i = 0; i < 200; i++) out = c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0.1, ...state });
    return out.eye;
  };
  const mk = () => {
    const c = createEotbCamera();
    c.loadSettings(cfgGet({ 'Camera.FrontalPlaneOffset': [0.5, 0.4], 'Camera.LongitudinalDistance': 2, 'Camera.RidingOffset': 1, 'Camera.MinimumDistance': 0, 'Camera.Speed': 20, 'Camera.Dampen': 0 }));
    c.toggleOffset(true);
    return c;
  };
  const plain = mk();
  const foot = settle(plain, { riding: false });
  assert.deepEqual(foot.map(r3), [0.5, 1.6 + 0.4, -2].map(r3));
  const ride = settle(plain, { riding: true });
  assert.deepEqual(ride.map(r3), [0.5, 1.6 + 0.8, -4].map(r3), 'unmirrored: Y and Z both scale');
  const mirrored = mk();
  mirrored.tick({ riding: true });   // lastState, for the shoulder gate
  assert.equal(mirrored.switchShoulder(), true, 'X is non-zero, so the shoulder may switch');
  const rideM = settle(mirrored, { riding: true });
  assert.deepEqual(rideM.map(r3), [-0.5, 1.6 + 0.4, -4].map(r3), 'mirrored: X negated, Z scaled, Y NOT scaled - the mod’s own asymmetry');
});

test('EOTB-IL camera: SwitchShoulder is gated on a non-zero X (IL_148f) and touches no clock (IL_14ac-IL_14c2)', () => {
  const c = createEotbCamera();
  c.loadSettings(cfgGet({ 'Camera.FrontalPlaneOffset': [0, 0.5] }));
  c.tick({});
  assert.equal(c.switchShoulder(), false, 'no X offset: the whole shoulder block is skipped');
  assert.equal(c.mirrored(), false);
  c.loadSettings(cfgGet({ 'Camera.FrontalPlaneOffset': [0.5, 0.5] }));
  c.tick({});
  assert.equal(c.switchShoulder(), true);
  assert.equal(c.switchShoulder(), false, 'and back');
});

test('EOTB-IL camera: OnNewGame / OnLoad - armed, ONLY the transition row for where the player stands; disarmed, StartInThirdPerson (IL_0930-IL_0ad0)', () => {
  const c = createEotbCamera();
  c.loadSettings(cfgGet({ 'Camera.StartInThirdPerson': true }));
  c.toggleOffset(false);
  assert.equal(c.onNewGame(false), true, 'disarmed: StartInThirdPerson through ToggleOffset');
  assert.equal(c.onLoad(true), true, 'the same at the load door, inside or out');
  // armed by a row that is not the transition row: NOTHING happens, even with StartInThirdPerson on
  c.loadSettings(cfgGet({ 'Camera.StartInThirdPerson': true, 'AutoTogglePerspective.OnHorse': 2 }));
  c.toggleOffset(false);
  assert.equal(c.onNewGame(false), false, 'armed: the OnTransitionExterior row is Don’tChange, so the view stays first');
  assert.equal(c.onLoad(true), false, 'and inside, OnTransitionInterior');
  // armed with the transition row set
  c.loadSettings(cfgGet({ 'Camera.StartInThirdPerson': false, 'AutoTogglePerspective.OnTransitionInterior': 2 }));
  c.toggleOffset(false);
  assert.equal(c.onLoad(true), true, 'inside: the interior row takes third person');
  assert.equal(c.onLoad(false), true, 'outside: the exterior row is Don’tChange, the view stays where it is');
});

test('EOTB-IL camera: OnPositionUpdate carries the smoothing across the floating origin (IL_1cb7-IL_1ccd)', () => {
  const c = createEotbCamera();
  c.loadSettings(cfgGet({ 'Camera.Speed': 20, 'Camera.Dampen': 0, 'Camera.MinimumDistance': 0 }));
  c.toggleOffset(true);
  let out = null;
  for (let i = 0; i < 100; i++) out = c.eye({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0.1 });
  const before = out.eye;
  c.onPositionUpdate([819.2, 0, 0]);
  const after = c.eye({ fpEye: [819.2, 1.6, 0], feet: [819.2, 0, 0], yaw: 0, pitch: 0, dt: 0 });
  assert.deepEqual(after.eye.map(r3), [r3(before[0] + 819.2), r3(before[1]), r3(before[2])], 'the eye moved with the world, no swing');
});
