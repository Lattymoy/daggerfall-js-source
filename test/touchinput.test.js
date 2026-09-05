// TI1 - MOBILE TOUCH INPUT (2026-09-05, Mac: "swipe based combat...
// touch based to interact... touch to lock on to enemy using a dark
// souls like dot... a button to bring up the radial UI... remove all
// the unneeded buttons from mobile"). The pure halves are executed;
// the DOM layer and the hosts are text-pinned. Every pin names the
// mutant that kills it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';
import { invert4, ndcFromScreen, rayDirFromScreen, projectToScreen, worldRectPx } from '../src/player/tapRay.js';
import { createGestureRecognizer, TAP_PX, TAP_MS, FLICK_PX, FLICK_MS } from '../src/ui/touchGestures.js';
import { createLockOn, wrapAngle, chestPoint, CHEST_FRACTION, LOCK_BREAK_DISTANCE } from '../src/player/lockOn.js';
import { LookFilter } from '../src/player/lookFilter.js';
import { pickFoe, pickQuestFoe } from '../src/player/activate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// ---- the frame every host builds: mirrorProjectionX(perspective) + lookAt ----
const W = 1000, H = 600;
function frame(yaw = 0, pitch = 0, eye = [0, 0, 0]) {
  const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.2, 6000));
  const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
  return { proj, view, eye };
}
const distToLine = (p, o, d) => {
  const v = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const t = v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
  return Math.hypot(v[0] - t * d[0], v[1] - t * d[1], v[2] - t * d[2]);
};

test('TI1 tapRay: invert4 inverts the real proj*view (mutant: any cofactor sign)', () => {
  const { proj, view } = frame(0.7, -0.2, [3, 1.7, -4]);
  const { multiply } = { multiply: (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; } };
  const pv = multiply(proj, view);
  const id = multiply(pv, invert4(pv));
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(id[i] - (i % 5 === 0 ? 1 : 0)) < 1e-4, `identity[${i}] = ${id[i]}`);
});

test('TI1 tapRay: the ABSOLUTE anchor - at yaw 0, +x is screen-right and +y screen-up, both ways (mutant: negate nx or ny in either function)', () => {
  const { proj, view, eye } = frame(0, 0);
  const c = projectToScreen([0, 0, 10], W, H, proj, view);
  assert.ok(c.front && Math.abs(c.x - W / 2) < 1e-3 && Math.abs(c.y - H / 2) < 1e-3, 'forward lands on the centre');
  const right = projectToScreen([2, 0, 10], W, H, proj, view);
  const up = projectToScreen([0, 2, 10], W, H, proj, view);
  assert.ok(right.x > W / 2 + 10, `+x must land screen-RIGHT (mouse-right turns toward +x, world.js's HANDEDNESS note): got x=${right.x}`);
  assert.ok(up.y < H / 2 - 10, `+y must land screen-UP: got y=${up.y}`);
  // ...and the ray agrees: a tap right of centre points +x, above centre points +y
  const dr = rayDirFromScreen(W * 0.75, H / 2, W, H, proj, view, eye);
  const du = rayDirFromScreen(W / 2, H * 0.25, W, H, proj, view, eye);
  assert.ok(dr[0] > 0.2 && Math.abs(dr[1]) < 1e-6, `tap right -> +x: ${dr}`);
  assert.ok(du[1] > 0.2 && Math.abs(du[0]) < 1e-6, `tap up -> +y: ${du}`);
  assert.ok(projectToScreen([0, 0, -10], W, H, proj, view).front === false, 'a point behind the camera is not front');
});

test('TI1 tapRay: round-trip through a yawed, pitched, displaced frame (mutant: use pv instead of its inverse)', () => {
  const yaw = 2.3, pitch = -0.35;
  const { proj, view, eye } = frame(yaw, pitch, [12, 2, -7]);
  const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const at = (t, r, u) => [eye[0] + fwd[0] * t + right[0] * r, eye[1] + fwd[1] * t + u, eye[2] + fwd[2] * t + right[2] * r];
  for (const p of [at(8, 0, 0), at(12, 2.5, -1), at(5, -1.5, 1.2)]) {
    const s = projectToScreen(p, W, H, proj, view);
    assert.ok(s.front, 'the fixture point is in front');
    const d = rayDirFromScreen(s.x, s.y, W, H, proj, view, eye);
    assert.ok(distToLine(p, eye, d) < 1e-3, `the unprojected ray misses the point by ${distToLine(p, eye, d)}`);
  }
});

test('TI1 tapRay: the docked-HUD rect - a finger in the bar is no world tap, and the strip centre is forward (mutant: use the canvas instead of the rect)', () => {
  const rect = { x: 0, y: 0.25, w: 1, h: 0.75 };   // largeHudViewportRect's shape: the bar takes the bottom quarter
  const r = worldRectPx(rect, W, H);
  assert.deepEqual(r, { x: 0, y: 0, w: W, h: H * 0.75 });
  assert.equal(ndcFromScreen(W / 2, H * 0.9, W, H, rect), null, 'the bar strip answers null');
  const { proj, view, eye } = frame(0, 0);
  const d = rayDirFromScreen(W / 2, (H * 0.75) / 2, W, H, proj, view, eye, rect);
  assert.ok(Math.abs(d[0]) < 1e-6 && Math.abs(d[1]) < 1e-6 && d[2] > 0.999, `the strip centre is dead ahead: ${d}`);
  const c = projectToScreen([0, 0, 10], W, H, proj, view, rect);
  assert.ok(Math.abs(c.y - (H * 0.75) / 2) < 1e-3, 'and the dot for a forward point sits at the strip centre, not the canvas centre');
});

// ---- the gesture ----
const drive = (g, pts) => pts.flatMap(([x, y, t]) => g.move(x, y, t));

test('TI1 gesture: a short still touch is a TAP with its landing point (mutant: drop the TAP_MS bound or the travel bound)', () => {
  const g = createGestureRecognizer();
  g.begin(300, 200, 0);
  assert.deepEqual(drive(g, [[303, 201, 40]]), []);
  assert.deepEqual(g.end(120), [{ type: 'tap', x: 300, y: 200 }]);
  const slow = createGestureRecognizer();
  slow.begin(300, 200, 0);
  assert.deepEqual(slow.end(TAP_MS + 1), [], 'held past TAP_MS: not a tap');
  const far = createGestureRecognizer();
  far.begin(300, 200, 0);
  far.move(300 + TAP_PX + 40, 200, 500);   // slow and far: look
  assert.equal(far.end(520).length, 0);
});

test('TI1 gesture: a FLICK is the swipe - the whole buffered trail in one held lump, released on the finger up (mutant: feed only the last delta)', () => {
  const g = createGestureRecognizer();
  g.begin(500, 300, 0);
  assert.deepEqual(drive(g, [[510, 300, 20]]), [], 'inside the tap radius: nothing yet');
  const ev = drive(g, [[500 + FLICK_PX + 4, 300, 60]]);
  assert.deepEqual(ev, [{ type: 'swipe', dx: FLICK_PX + 4, dy: 0, held: true }], 'the trail so far, not the last step');
  assert.deepEqual(drive(g, [[600, 310, 80]]), [{ type: 'swipe', dx: 600 - (500 + FLICK_PX + 4), dy: 10, held: true }]);
  assert.deepEqual(g.end(100), [{ type: 'swipe', dx: 0, dy: 0, held: false }]);
  assert.equal(g.state, 'idle');
});

test('TI1 gesture: a SLOW drag is the look, paid in a lump when it resolves and per-step after (mutant: drop the buffer)', () => {
  const g = createGestureRecognizer();
  g.begin(500, 300, 0);
  assert.deepEqual(drive(g, [[508, 302, 50]]), []);                          // still pending
  assert.deepEqual(drive(g, [[520, 305, FLICK_MS + 20]]), [{ type: 'look', dx: 20, dy: 5 }], 'the flick window passed: look, with the buffered motion');
  assert.deepEqual(drive(g, [[530, 305, FLICK_MS + 40]]), [{ type: 'look', dx: 10, dy: 0 }]);
  assert.deepEqual(g.end(FLICK_MS + 60), []);
});

test('TI1 gesture: LOCKED ON, any drag past the tap radius is the swipe at once - no look leaks first (mutant: ignore the predicate)', () => {
  let locked = true;
  const g = createGestureRecognizer({ locked: () => locked });
  g.begin(500, 300, 0);
  assert.deepEqual(drive(g, [[500 + TAP_PX + 1, 300, 400]]), [{ type: 'swipe', dx: TAP_PX + 1, dy: 0, held: true }], 'slow, short, and STILL a swipe under the lock');
  assert.deepEqual(g.cancel(), [{ type: 'swipe', dx: 0, dy: 0, held: false }], 'a cancelled swipe releases the seam');
  locked = false;
  g.begin(500, 300, 0);
  assert.deepEqual(drive(g, [[500 + TAP_PX + 1, 300, 400]]), [{ type: 'look', dx: TAP_PX + 1, dy: 0 }], 'the same drag unlocked is a look');
});

// ---- the lock ----
const foeAt = (x, y, z, extra = {}) => ({ ai: { feet: [x, y, z], height: 1.8 }, dead: false, ...extra });

test('TI1 lockOn: the camera turns TOWARD the foe through the LookFilter - yaw = atan2(dx, dz), the hosts\' own forward (mutant: swap dx/dz, or drop the wrap)', () => {
  const lock = createLockOn();
  const filter = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  lock.lock(foeAt(5, 0, 0));          // due +x from the origin
  for (let i = 0; i < 120; i++) { lock.tick(1 / 60, cam, [0, 1.7, 0], filter); filter.tick(1 / 60, cam, { smoothing: 0 }); }
  assert.ok(Math.abs(cam.yaw - Math.PI / 2) < 0.01, `yaw should settle at +PI/2 (facing +x): ${cam.yaw}`);
  assert.ok(cam.pitch < -0.1, 'and the pitch dips to the chest below eye level');
  // the wrap: a foe just across the seam turns the SHORT way
  const cam2 = { yaw: -3.0, pitch: 0 };
  const f2 = new LookFilter();
  const l2 = createLockOn();
  l2.lock(foeAt(Math.sin(3.0) * 5, 1.7 / CHEST_FRACTION - 1.8 + 1.7, Math.cos(3.0) * 5));
  l2.tick(1 / 60, cam2, [0, 1.7, 0], f2);
  assert.ok(f2.residualYaw < 0 && f2.residualYaw > -0.1, `short way round: a small NEGATIVE step, got ${f2.residualYaw}`);
  assert.equal(wrapAngle(3 * Math.PI), Math.PI);
  assert.ok(Math.abs(wrapAngle(-Math.PI - 0.5) - (Math.PI - 0.5)) < 1e-12);
});

test('TI1 lockOn: toggle, chest, and the two breaks - death and distance (mutant: drop either break)', () => {
  const lock = createLockOn();
  const a = foeAt(0, 0, 5), b = foeAt(0, 0, 6);
  assert.equal(lock.toggle(a), a); assert.equal(lock.locked, true);
  assert.equal(lock.toggle(a), null, 'the same foe again unlocks');
  assert.equal(lock.toggle(a), a); assert.equal(lock.toggle(b), b, 'another foe re-locks');
  assert.deepEqual(chestPoint(a), [0, 1.8 * CHEST_FRACTION, 5]);
  const filter = new LookFilter(), cam = { yaw: 0, pitch: 0 };
  assert.deepEqual(lock.tick(0.016, cam, [0, 1.7, 0], filter), chestPoint(b), 'tick answers the chest for the dot');
  b.dead = true;
  assert.equal(lock.tick(0.016, cam, [0, 1.7, 0], filter), null); assert.equal(lock.locked, false, 'death breaks the lock');
  const far = foeAt(0, 0, LOCK_BREAK_DISTANCE + 1);
  lock.lock(far);
  assert.equal(lock.tick(0.016, cam, [0, 1.7, 0], filter), null); assert.equal(lock.locked, false, 'distance breaks the lock');
});

test('TI1 pickFoe: the SAME box as the quest click, ANY live foe - and pickQuestFoe still refuses the questless one (mutant: reuse pickQuestFoe for the lock)', () => {
  const plain = foeAt(0, 0, 3);
  const quest = foeAt(0, 0, 6, { questBehaviour: {} });
  const eye = [0, 1.7, 0], dir = [0, 0, 1];
  assert.equal(pickFoe(eye, dir, [quest, plain], null, 20), plain, 'the nearer, questless foe');
  assert.equal(pickQuestFoe(eye, dir, [quest, plain], null, 20), quest, 'the quest pick walks past it');
  plain.dead = true;
  assert.equal(pickFoe(eye, dir, [plain], null, 20), null, 'a corpse is not a target');
});

// ---- the DOM layer and the hosts, by text ----
test('TI1 touch.js: the five buttons, the gate-by-hook dial, and the three routes (mutant: any removed button back, or a route dropped)', () => {
  const s = read('src/ui/touch.js');
  for (const gone of ["'\\u2694'", "'E'", "'F5'", "'F6'", "'SV'", "'LD'", "'\\u2630'", "'\\u2328'", "tap('F9')", "tap('F11')", "tap('Backspace')", "down('KeyE')"]) {
    assert.ok(!s.includes(gone), `${gone} is an unneeded button and must be gone`);
  }
  assert.match(s, /if \(hooks\.dial\) button\('◆'[^\n]*tap\('Tab'\)/, 'the dial button exists only where a host routes Tab');
  assert.match(s, /tap\('Escape'\)/, 'the menu button');
  assert.match(s, /down\('Space'\)[^\n]*up\('Space'\)/, 'jump, held');
  assert.match(s, /down\('KeyZ'\)[^\n]*up\('KeyZ'\)/, 'sheathe, held');
  assert.match(s, /createGestureRecognizer\(\{ locked: \(\) => !!hooks\.locked\?\.\(\) \}\)/, 'the recogniser takes the host\'s lock predicate');
  assert.match(s, /ev\.type === 'look'\) hooks\.look\?\.\(ev\.dx \* TOUCH_LOOK_GAIN/, 'look routes');
  assert.match(s, /ev\.type === 'swipe'\) hooks\.attack\?\.\(ev\.dx, ev\.dy, ev\.held\)/, 'the swipe routes to the drag seam');
  assert.match(s, /ev\.type === 'tap'\) hooks\.tap\?\.\(ev\.x, ev\.y\)/, 'the tap routes with its point');
  assert.match(s, /setLockDot,/, 'the dot is the host\'s to place');
  assert.match(s, /!!hooks\.overlayActive\?\.\(\) && !overlayOpen\(\)/, 'the classic nav row shows itself under a classic overlay only');
});

test('TI1 hosts: the three combat hosts wire swipe, tap, lock and dial; the fly-cam interior wires none (mutant: any hook dropped)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const s = read(h);
    assert.match(s, /const touch = attachTouch\(canvas, \{/, `${h}: the layer's handle is kept for the dot`);
    assert.match(s, /\n\s*attack: \(dx, dy, held\) =>/, `${h}: the swipe hook`);
    assert.match(s, /\n\s*tap: \(x, y\) =>/, `${h}: the tap hook`);
    assert.match(s, /locked: \(\) => lockOn\.locked,/, `${h}: the lock predicate`);
    assert.match(s, /dial: true,/, `${h}: routes Tab, so it draws the dial`);
    assert.match(s, /\(rightHeld \|\| swipeHeld\) && walkMode/, `${h}: the swipe holds the swing-settle law like the mouse button`);
    assert.match(s, /lockOn\.tick\(dt, cam, /, `${h}: the lock pays its facing every frame`);
    assert.match(s, /touch\.setLockDot\(/, `${h}: places the dot`);
    assert.match(s, /_tapArmed > 0 && --_tapArmed === 0/, `${h}: the tap is a ONE-frame press of the activate action`);
  }
  assert.match(read('src/scenes/world.js'), /const useFwd = _tapDir \?\? \[/, 'world: the tap ray replaces the centre ray');
  assert.match(read('src/scenes/exterior.js'), /const useFwd = _tapDir \?\? \[/, 'exterior: the tap ray replaces the centre ray');
  assert.match(read('src/scenes/dungeon.js'), /const dir = _tapDir \?\? \[/, 'dungeon: the tap ray replaces the centre ray');
  assert.match(read('src/scenes/worldModes.js'), /const eyeDir = \(\) => host\.activateDir\?\.\(\) \?\?/, 'the modal ladders take the tap ray through eyeDir');
  const interior = read('src/scenes/interior.js');
  assert.doesNotMatch(interior, /attack:|tap:|dial:|attackTap/, 'the fly-cam interior draws no sword, no dial');
});
