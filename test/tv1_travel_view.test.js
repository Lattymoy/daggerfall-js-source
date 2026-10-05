// TV1 (2026-09-27, bible/06-Systems/Travel-View.md, Mac: "a sort of zoom out to an overworld style that utilizes
// travel options ... When opening the map, there should be a toggle to go to the overworld style map. Every detail like
// weather patterns, should be 1:1 in this mode"; his call on the height: below the clouds).
//
// THE VIEW'S CAMERA IS A RENDER EYE: `cam.pos` stays on the traveller's head, so the world streams, the weather is
// read and the rain falls where they stand, and the picture is taken from under the cloud deck, 150-450 m up. Pinned
// here: the camera's law (player/travelCamera.js, pure), the host's half driven against a fake host
// (scenes/travelView.js - its states, the input it owns, every way out), the body held out of the head for the view
// (player/mwView.js), the fog and the sun's cascades measured from the traveller (render/fogGlsl.js FOCUS_GLSL,
// render/shadowPass.js, render/renderer.js setFocus), the readout (ui/travelViewHud.js), and the world host's wiring
// by source - the one host the view lives in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TV_HEIGHT_MIN, TV_HEIGHT_MAX, TV_HEIGHT_DEFAULT, TV_TILT_MIN, TV_TILT_MAX, TV_TILT_DEFAULT, TV_CLOUD_MARGIN, TV_HEIGHT_FLOOR,
  TV_GROUND_CLEAR, TV_RISE_S, TV_FALL_S, TV_ZOOM_STEP, TV_FOCUS_SNAP, TV_BILLBOARD_LEAN, TV_TURN_RATE,
  ceilingFor, heightBand, forwardOf, rightOf, eyeFor, clearHeight, clearView, leanedUp, turnHeading, initialCamera, zoomTarget,
  orbitBy, turnCamera, stepCamera, blendView, anglesOf, angleDelta,
} from '../src/player/travelCamera.js';
import { createTravelView, TRAVEL_VIEW_TEXT, travelViewLine, TV_CLICK_SLOP, TV_LOOK_ACTIONS, TV_HEARTBEAT_MS, wheelNotches, TV_WORLD_ACTIONS } from '../src/scenes/travelView.js';
import { compassDegrees, chevronDegrees, TRAVEL_VIEW_TITLE, TRAVEL_VIEW_HINTS, travelViewMouseHint } from '../src/ui/travelViewHud.js';
import { FOG_GLSL, FOCUS_GLSL } from '../src/render/fogGlsl.js';
import { SHADOW_GLSL } from '../src/render/shadowPass.js';
import { VC_PROFILE } from '../src/render/volumetricClouds.js';
import { ACTIONS, DEFAULT_BINDINGS, PORT_ACTIONS, ACTION_GROUPS } from '../src/systems/inputActions.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const deg = (d) => (d * Math.PI) / 180;

// ── THE CAMERA'S LAW ────────────────────────────────────────────────────────────────────────────────────────────────

test('TV1 camera: Mac\'s band - 150 to 450 m over the traveller, 30 to 75 degrees down, and never into the cloud deck (its base less 60 m, a lid weather\'s floor 40 m)', () => {
  assert.deepEqual([TV_HEIGHT_MIN, TV_HEIGHT_MAX, TV_HEIGHT_DEFAULT], [150, 450, 260]);
  assert.ok(near(TV_TILT_MIN, deg(30)) && near(TV_TILT_MAX, deg(75)) && near(TV_TILT_DEFAULT, deg(52)));
  assert.deepEqual([TV_CLOUD_MARGIN, TV_HEIGHT_FLOOR, TV_GROUND_CLEAR], [60, 40, 25]);
  // the deck, per the weather the clouds are drawn for (render/volumetricClouds.js VC_PROFILE) - the view reads the
  // same table the sky does, so the camera is under the very clouds the player sees
  const ceilings = Object.fromEntries(Object.entries(VC_PROFILE).map(([w, r]) => [w, ceilingFor(r.base)]));
  assert.deepEqual(ceilings, { sunny: 450, cloudy: 450, overcast: 450, fog: 90, rain: 450, snow: 450, thunder: 440, sandstorm: 40 });
  assert.equal(ceilingFor(null), 450, 'no deck: the band\'s top');
  assert.equal(ceilingFor(Number.NaN), 450);
  assert.deepEqual(heightBand(450), [150, 450]);
  assert.deepEqual(heightBand(90), [90, 90], 'in fog the band closes on the ceiling');
  assert.deepEqual(heightBand(10), [40, 40], 'and never under the floor');
});

test('TV1 camera: the eye stands back along its heading so its line of sight passes through the traveller; right and forward are mat4\'s mirrored law', () => {
  const focus = [100, 20, -50];
  for (const [yaw, tilt, h] of [[0, deg(52), 260], [deg(90), deg(30), 150], [deg(-135), deg(75), 450]]) {
    const { eye, fwd, back } = eyeFor(focus, yaw, tilt, h);
    assert.ok(near(eye[1], focus[1] + h, 1e-9), 'height over the focus');
    assert.ok(near(back, h / Math.tan(tilt), 1e-9));
    const d = Math.hypot(eye[0] - focus[0], eye[1] - focus[1], eye[2] - focus[2]);
    for (let i = 0; i < 3; i++) assert.ok(near(eye[i] + fwd[i] * d, focus[i], 1e-6), `the ray reaches the focus (axis ${i})`);
    assert.ok(near(Math.hypot(...fwd), 1, 1e-12));
  }
  assert.deepEqual(forwardOf(0, 0).map((v) => Math.round(v * 1e9) / 1e9), [0, 0, 1], 'yaw 0 looks down +z');
  assert.deepEqual(rightOf(0).map((v) => Math.round(v * 1e9) / 1e9), [1, 0, -0], 'and the screen\'s right is +x');
  const a = anglesOf(forwardOf(deg(40), deg(-20)));
  assert.ok(near(a.yaw, deg(40), 1e-12) && near(a.pitch, deg(-20), 1e-12), 'angles round-trip');
});

test('TV1 camera: the eye keeps 25 m over the ground under it and over a ridge halfway down to the traveller; an unbuilt pixel is no ground', () => {
  const focus = [0, 0, 0];
  const flat = () => 0;
  assert.equal(clearHeight(focus, 0, deg(52), 260, flat), 260, 'open ground: the height asked for');
  assert.equal(clearHeight(focus, 0, deg(52), 260, () => -Infinity), 260, 'no pixel built: nothing to clear');
  // a hill under the eye: the eye rises until it clears it by exactly TV_GROUND_CLEAR
  const hill = (x, z) => (z < -150 ? 300 : 0);
  const h = clearHeight(focus, 0, deg(52), 260, hill);
  const { eye } = eyeFor(focus, 0, deg(52), h);
  assert.ok(eye[1] >= 300 + TV_GROUND_CLEAR - 1e-6, `the eye (${eye[1].toFixed(1)}) clears the hill`);
  assert.ok(h > 260);
  // a ridge only between: the midpoint rule lifts it
  const ridge = (x, z) => (z < -60 && z > -140 ? 200 : 0);
  const hr = clearHeight(focus, 0, deg(52), 260, ridge);
  const mid = eyeFor(focus, 0, deg(52), hr).eye[1] / 2;
  assert.ok(hr > 260 && mid >= 200 + TV_GROUND_CLEAR - 1e-6, 'the line of sight clears the ridge at its middle');
});

test('TV1 camera: the wheel scales the height by 1.18 a notch inside the band; a drag orbits and tilts, the tilt clamped; the look keys turn by radians', () => {
  assert.equal(TV_ZOOM_STEP, 1.18);
  assert.ok(near(zoomTarget(260, 1, 450), 260 / 1.18, 1e-9), 'a notch up: in');
  assert.ok(near(zoomTarget(260, -1, 450), 260 * 1.18, 1e-9), 'a notch down: out');
  assert.equal(zoomTarget(160, 5, 450), 150, 'never under the band');
  assert.equal(zoomTarget(400, -5, 450), 450, 'never over it');
  assert.equal(zoomTarget(400, -5, 300), 300, 'nor over a low deck');
  const c = initialCamera([0, 0, 0], 1);
  assert.deepEqual({ yaw: c.yaw, tilt: c.tilt, height: c.height, heightTarget: c.heightTarget }, { yaw: 1, tilt: TV_TILT_DEFAULT, height: 260, heightTarget: 260 });
  const o = orbitBy(c, 100, 0);
  assert.ok(near(o.yaw, 1 + 100 * 0.005, 1e-12));
  assert.equal(orbitBy(c, 0, 1e6).tilt, TV_TILT_MAX);
  assert.equal(orbitBy(c, 0, -1e6).tilt, TV_TILT_MIN);
  assert.ok(near(turnCamera(c, 0.25, 0).yaw, 1.25, 1e-12));
});

test('TV1 camera: a frame eases the focus onto the feet (a jump past 60 m taken whole), eases the height toward its target under the ceiling, and lifts it off the ground', () => {
  let c = initialCamera([0, 0, 0], 0);
  // a step: eased, not snapped
  let r = stepCamera(c, { feet: [10, 0, 0], dt: 1 / 60, ceiling: 450 });
  assert.ok(r.camera.focus[0] > 0 && r.camera.focus[0] < 10, 'the focus follows');
  // a jump: whole
  r = stepCamera(c, { feet: [TV_FOCUS_SNAP + 1, 0, 0], dt: 1 / 60, ceiling: 450 });
  assert.equal(r.camera.focus[0], TV_FOCUS_SNAP + 1, 'a teleport is not flown across');
  // the height eases toward the target
  c = { ...c, heightTarget: 400 };
  r = stepCamera(c, { feet: [0, 0, 0], dt: 1 / 60, ceiling: 450 });
  assert.ok(r.camera.height > 260 && r.camera.height < 400);
  // a deck coming down pulls the target and the height under it
  r = stepCamera({ ...c, height: 400, heightTarget: 400 }, { feet: [0, 0, 0], dt: 1 / 60, ceiling: 90 });
  assert.equal(r.camera.heightTarget, 400, 'AUDIT DEEP T1-8: the player\'s zoom is kept under the deck');
  assert.equal(r.camera.height, 90, 'never above the fog\'s ceiling, even mid-ease');
  let lifted = r.camera;
  for (let i = 0; i < 120; i++) lifted = stepCamera(lifted, { feet: [0, 0, 0], dt: 1 / 60, ceiling: 450 }).camera;
  assert.ok(lifted.height > 380, `and climbs back to it once the deck lifts (${lifted.height.toFixed(1)})`);
  // the shown height clears a hill, the kept one does not remember it
  r = stepCamera(initialCamera([0, 0, 0], 0), { feet: [0, 0, 0], dt: 1 / 60, ceiling: 450, heightAt: (x, z) => (z < -100 ? 500 : 0) });
  assert.ok(r.shownHeight > r.camera.height && r.eye[1] >= 525 - 1e-6);
});

test('AUDIT DEEP T1-3/T1-4: a journey faster than the focus eases is followed at a held lag, never snapped frame after frame - a jump is the FEET\'s; a slope behind the eye steeper than the tilt steepens the view until the eye clears it', () => {
  // T1-3: 800 m/s, 60 frames a second - the feet move 13.3 m a frame, never a jump
  let c = initialCamera([0, 0, 0], 0);
  const dt = 1 / 60;
  let snaps = 0, maxLag = 0;
  for (let i = 1; i <= 180; i++) {
    const feet = [0, 0, (800 * i) / 60];
    const before = c.focus[2];
    const r = stepCamera(c, { feet, dt, ceiling: 450 });
    if (r.camera.focus[2] === feet[2] && before !== feet[2]) snaps++;
    c = r.camera;
    maxLag = Math.max(maxLag, feet[2] - c.focus[2]);
  }
  assert.equal(snaps, 0, 'no snap at speed');
  assert.ok(maxLag <= TV_FOCUS_SNAP + 1e-9 && maxLag > TV_FOCUS_SNAP - 1, `the lag held at the snap distance (${maxLag.toFixed(2)})`);
  const j = stepCamera(c, { feet: [5000, 0, 0], dt, ceiling: 450 });
  assert.deepEqual(j.camera.focus, [5000, 0, 0], 'a door or a recentre - the feet themselves jumped - is still taken whole');
  // T1-4: ground behind the camera (it stands at -z of the focus at yaw 0) rising at 54 degrees against a 52-degree tilt
  const slope = Math.tan((54 * Math.PI) / 180);
  const hill = (x, z) => (z < 0 ? -z * slope : 0);
  const focus = [0, 0, 0];
  const v = clearView(focus, 0, TV_TILT_DEFAULT, 260, hill);
  const { eye } = eyeFor(focus, 0, v.tilt, v.height);
  assert.ok(eye[1] >= hill(eye[0], eye[2]) + TV_GROUND_CLEAR - 1e-6, `the eye (${eye[1].toFixed(1)}) clears the slope under it (${hill(eye[0], eye[2]).toFixed(1)})`);
  assert.ok(v.tilt > TV_TILT_DEFAULT, 'by steepening');
  const flat = clearView(focus, 0, TV_TILT_DEFAULT, 260, () => 0);
  assert.deepEqual(flat, { height: 260, tilt: TV_TILT_DEFAULT }, 'open ground: the player\'s own tilt and height');
  const r = stepCamera(initialCamera(focus, 0), { feet: focus, dt, ceiling: 450, heightAt: hill });
  assert.ok(r.eye[1] >= hill(r.eye[0], r.eye[2]) + TV_GROUND_CLEAR - 1e-6, 'the frame\'s own eye too');
  assert.equal(r.camera.tilt, TV_TILT_DEFAULT, 'and the camera keeps the player\'s tilt');
});

test('AUDIT DEEP R-3: under the travel view the sun\'s cascades grow with the picture - a caster 900 m off lands in the far map, as it could not at the ground\'s radii; the scale changing redraws every map', async () => {
  const sp = await import('../src/render/shadowPass.js');
  const { SHADOW_CASCADES, SHADOW_VIEW_SCALE, sunCascadeMatrices, sunTexelWorld } = sp;
  assert.equal(SHADOW_VIEW_SCALE, 4);
  const eye = [0, 0, 0], ld = [0.3, 0.9, 0.3];
  const n = Math.hypot(...ld); const L = ld.map((v) => v / n);
  const inside = (m, p) => { const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]; return Math.abs(x) <= 1 && Math.abs(y) <= 1 && Math.abs(z) <= 1; };
  const out = () => SHADOW_CASCADES.map(() => new Float32Array(16));
  const ground = [0, 0, 900];
  assert.equal(inside(sunCascadeMatrices(eye, L, out())[2], ground), false, 'the ground\'s far map ends at 240 m');
  assert.equal(inside(sunCascadeMatrices(eye, L, out(), undefined, SHADOW_VIEW_SCALE)[2], ground), true, 'the view\'s reaches 900 m');
  assert.equal(sunTexelWorld(2, SHADOW_VIEW_SCALE), 4 * sunTexelWorld(2));
  const src = rd('src/render/shadowPass.js');
  assert.match(src, /const k = f\.cascadeScale > 1 \? f\.cascadeScale : 1;\n\s*if \(k !== this\._sunScaleK\) \{ this\._sunScaleK = k; this\._sunDrawn\.fill\(0\); \}/, 'a far map drawn at the other scale is never kept');
  assert.match(src, /this\.sunParams\[c\] = SHADOW_CASCADES\[c\] \* k; this\.sunTexel\[c\] = sunTexelWorld\(c, k\);/, 'the receivers pick by the scaled radii');
  assert.match(rd('src/render/renderer.js'), /cascadeScale: this\._focus\[3\] > 0\.5 && this\._focusWide \? SHADOW_VIEW_SCALE : 1,/, 'the renderer asks while the focus is set - AUDIT DEEP2 D7: and wide (the view half risen)');
});

test('AUDIT DEEP R-8: the fall from a view orbited half round turns the short way at an even pace and never looks down past the sky\'s own pitch - no roll through the pole', () => {
  const from = { eye: [0, 1.7, 0], fwd: forwardOf(0, 0) };
  const to = { eye: [0, 260, -200], fwd: forwardOf(Math.PI - 0.05, -TV_TILT_DEFAULT) };
  let prev = anglesOf(blendView(from, to, 0).fwd);
  let maxStep = 0;
  for (let i = 1; i <= 60; i++) {
    const a = anglesOf(blendView(from, to, i / 60).fwd);
    maxStep = Math.max(maxStep, Math.abs(angleDelta(prev.yaw, a.yaw)));
    assert.ok(a.pitch >= -TV_TILT_DEFAULT - 1e-9 && a.pitch <= 1e-9, `pitch between the two ends at ${i} (${((a.pitch * 180) / Math.PI).toFixed(1)}°)`);
    prev = a;
  }
  assert.ok(maxStep < 0.1, `no whip: at most ${maxStep.toFixed(3)} rad a frame`);
  const end = anglesOf(blendView(from, to, 1).fwd);
  assert.ok(near(end.pitch, -TV_TILT_DEFAULT, 1e-9) && Math.abs(angleDelta(end.yaw, Math.PI - 0.05)) < 1e-9, 'lands on the sky\'s look');
});

test('AUDIT DEEP R-7: a flat leaned toward the raised eye stays inside its own cull sphere - the sphere grows by h sin(lean) while the view leans them, and not otherwise; the host sets it before any cull', async () => {
  const { batchSphere, setFlatLean } = await import('../src/render/bounds.js');
  const w = 5, h = 14;
  const b = { bounds: [0, 0, 0, Math.hypot(w, h) / 2], size: { w, h }, origin: null };
  const o = [0, 0, 0, 0];
  try {
    for (const tiltDeg of [52, 75]) {
      const up = leanedUp(0.7, (tiltDeg * Math.PI) / 180);
      setFlatLean(Math.hypot(up[0], up[2]));
      const c = batchSphere(b, o);
      const right = rightOf(0.7);
      // BB_VS: anchored at the foot - the quad's corners are foot + right * (+-w/2) + up * (0..h)
      for (const sx of [-0.5, 0.5]) for (const sy of [0, 1]) {
        const p = [right[0] * sx * w + up[0] * sy * h, right[1] * sx * w + up[1] * sy * h, right[2] * sx * w + up[2] * sy * h];
        assert.ok(Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) <= c[3] + 1e-9, `${tiltDeg}°: corner ${sx},${sy} inside`);
      }
    }
  } finally { setFlatLean(0); }
  assert.equal(batchSphere(b, o)[3], Math.hypot(w, h) / 2, 'upright: the sphere as it was');
  const src = rd('src/scenes/world.js');
  const frame = src.slice(src.indexOf('  function frame(now) {'));
  const set = frame.indexOf('setFlatLean(tvf ? Math.hypot(tvf.up[0], tvf.up[2]) : 0);');
  assert.ok(set > 0 && set < frame.indexOf('if (cullOn && billboardOutside(b))') && set < frame.indexOf('renderer.beginFrame(proj, view, sunDirection(minute), WORLD_FRAME);'), 'before the flats\' cull and the shadow replay');
});

test('TV1 camera: the rise and the fall blend the head\'s eye into the sky\'s, smoothstepped; the flats lean back by half the tilt; the traveller turns at 6 rad/s the short way', () => {
  const from = { eye: [0, 1.7, 0], fwd: [0, 0, 1] };
  const to = { eye: [0, 300, -200], fwd: forwardOf(0, -deg(52)) };
  assert.deepEqual(blendView(from, to, 0), from);
  const end = blendView(from, to, 1);
  for (let i = 0; i < 3; i++) assert.ok(near(end.eye[i], to.eye[i], 1e-9) && near(end.fwd[i], to.fwd[i], 1e-9));
  const mid = blendView(from, to, 0.5);
  assert.ok(near(mid.eye[1], (1.7 + 300) / 2, 1e-9), 'smoothstep is a half at a half');
  assert.ok(near(Math.hypot(...mid.fwd), 1, 1e-12));
  assert.equal(TV_BILLBOARD_LEAN, 0.5);
  const up = leanedUp(0, deg(52));
  assert.ok(near(Math.acos(up[1]), deg(26), 1e-12), 'half of 52 degrees');
  assert.ok(up[2] > 0 && near(up[0], 0, 1e-12), 'leaned along the heading (the top away from the eye)');
  assert.deepEqual(leanedUp(1.2, 0), [0, 1, 0], 'no tilt, no lean');
  assert.equal(TV_TURN_RATE, 6);
  assert.ok(near(turnHeading(0, 1, 0.1), 0.6, 1e-12));
  assert.equal(turnHeading(0, 0.3, 0.1), 0.3, 'within a step: arrived');
  assert.ok(turnHeading(deg(170), deg(-170), 0.01) > deg(170), 'the short way round, across the seam');
  assert.ok(near(angleDelta(deg(170), deg(-170)), deg(20), 1e-12));
});

// ── THE HOST'S HALF ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A window just real enough: listeners by type and phase, dispatch in capture order, stop that stops. */
function fakeWin() {
  const L = [];
  return {
    L,
    addEventListener(type, fn, opt) { L.push({ type, fn, capture: opt === true || !!opt?.capture }); },
    removeEventListener(type, fn, opt) { const c = opt === true || !!opt?.capture; const i = L.findIndex((l) => l.type === type && l.fn === fn && l.capture === c); if (i >= 0) L.splice(i, 1); },
    fire(type, props) {
      const e = { type, stopped: false, prevented: false, ...props, preventDefault() { e.prevented = true; }, stopImmediatePropagation() { e.stopped = true; }, stopPropagation() { e.stopped = true; } };
      for (const l of L.filter((x) => x.type === type && x.capture)) { if (e.stopped) break; l.fn(e); }
      if (!e.stopped) e.reachedHost = true;
      return e;
    },
    count: (type) => L.filter((l) => l.type === type).length,
  };
}
function rig(over = {}) {
  const win = fakeWin();
  const canvas = { id: 'canvas', contains: (t) => t === canvas };
  const log = { said: [], picks: [], body: [], cursor: [], hud: [] };
  const w = { feet: [0, 0, 0], yaw: 0.3, allowed: { ok: true }, windowUp: false, danger: false, moving: false, autopilot: false, alive: true };
  const tv = createTravelView({
    canvas, win,
    feet: () => w.feet, headView: () => ({ eye: [w.feet[0], w.feet[1] + 1.7, w.feet[2]], fwd: forwardOf(w.yaw, 0) }),
    yaw: () => w.yaw, setYaw: (y) => { w.yaw = y; },
    heightAt: () => 0, cloudBase: () => null,
    allowed: () => w.allowed, windowUp: () => w.windowUp, danger: () => w.danger,
    actionsOf: (e) => e.actions ?? [], movementHeld: () => w.moving, autopilot: () => w.autopilot,
    holdBody: (on) => { log.body.push(on); return true; },
    freeCursor: (free) => log.cursor.push(free),
    where: () => 'The wilds of Daggerfall',
    project: (p) => ({ x: 400 + p[0], y: 300 - p[2], front: true }),
    onPick: (x, y) => log.picks.push([x, y]),
    hud: { show: () => log.hud.push('show'), hide: () => log.hud.push('hide'), update: (f) => { log.last = f; } },
    say: (t) => log.said.push(t),
    alive: () => w.alive,
    schedule: (fn, ms) => { log.beat = { fn, ms }; return log.beat; },   // the heartbeat, fired by hand
    cancel: (h) => { if (h && h === log.beat) log.beat = null; },
    ...over,
  });
  const run = (s, dt = 1 / 60) => { for (let i = 0; i < Math.ceil(s / dt); i++) tv.frame(dt); };
  /** The heartbeat's timer fires - and, as a real one, is no longer pending once it has. */
  const beat = () => { const b = log.beat; log.beat = null; b.fn(); };
  return { tv, win, canvas, log, w, run, beat };
}

test('TV1 host: the view rises only where the host allows it and no foe is near - the refusal said; up, the body is held, the cursor freed, the input taken and the readout shown', () => {
  const r = rig();
  r.w.allowed = { ok: false, why: TRAVEL_VIEW_TEXT.indoors };
  assert.equal(r.tv.enter(), false);
  assert.deepEqual(r.log.said, [TRAVEL_VIEW_TEXT.indoors]);
  r.w.allowed = { ok: true };
  r.w.danger = true;
  assert.equal(r.tv.enter(), false);
  assert.equal(r.log.said.at(-1), TRAVEL_VIEW_TEXT.enemies);
  r.w.danger = false;
  assert.equal(r.win.count('pointerdown'), 0, 'nothing listens while it is down');
  assert.equal(r.tv.enter(), true);
  assert.equal(r.tv.state, 'rising');
  assert.deepEqual(r.log.body, [true], 'the body out of the head');
  assert.deepEqual(r.log.cursor, [true], 'the cursor free');
  assert.deepEqual(r.log.hud, ['show']);
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mouseup', 'wheel', 'contextmenu', 'keydown', 'keyup']) {
    assert.equal(r.win.count(t), 1, `${t}: one listener, on the capture phase`);
    assert.ok(r.win.L.find((l) => l.type === t).capture);
  }
  assert.equal(r.tv.enter(), true, 'a second press while rising is the same view');
  assert.equal(r.win.count('pointerdown'), 1);
});

test('TV1 host: it rises over TV_RISE_S from the head\'s own eye, stays up, and falls over TV_FALL_S back into it - then every hold is let go', () => {
  const r = rig();
  r.tv.enter();
  const first = r.tv.frame(1 / 60);
  assert.ok(first.eye[1] < 20, 'the first frame is still at the head');
  assert.equal(first.state, 'rising');
  r.run(TV_RISE_S);
  const up = r.tv.frame(1 / 60);
  assert.equal(up.state, 'up');
  assert.equal(up.fullyUp, true);
  assert.ok(up.eye[1] > 200, `up (${up.eye[1].toFixed(0)} m)`);
  assert.ok(up.pitch < -deg(40), 'looking down');
  assert.deepEqual(up.focus.map(Math.round), [0, 0, 0], 'the focus is the traveller');
  assert.deepEqual(up.right.map((v) => Math.round(v * 1e6) / 1e6), rightOf(up.yaw).map((v) => Math.round(v * 1e6) / 1e6));
  assert.ok(up.up[1] < 1, 'the flats leaned');
  r.tv.exit('button');
  assert.equal(r.tv.state, 'falling');
  r.run(TV_FALL_S / 2);
  assert.equal(r.tv.state, 'falling');
  r.run(TV_FALL_S);
  assert.equal(r.tv.state, 'off');
  assert.equal(r.tv.frame(1 / 60), null, 'off: no camera');
  assert.deepEqual(r.log.body, [true, false], 'the body handed back');
  assert.deepEqual(r.log.cursor, [true, false], 'the look back');
  assert.deepEqual(r.log.hud, ['show', 'hide']);
  assert.equal(r.win.count('pointerdown') + r.win.count('keydown') + r.win.count('wheel'), 0, 'every listener with it');
});

test('TV1 host: a window, a door out of the open air or a death CUTS the view at once; a foe near brings it down; dispose takes it all', () => {
  for (const [why, set] of [['a window', (w) => { w.windowUp = true; }], ['a door', (w) => { w.allowed = { ok: false }; }]]) {
    const r = rig();
    r.tv.enter();
    r.run(TV_RISE_S);
    set(r.w);
    assert.equal(r.tv.frame(1 / 60), null, `${why}: cut`);
    assert.equal(r.tv.state, 'off');
    assert.deepEqual(r.log.body, [true, false]);
    assert.deepEqual(r.log.cursor, [true, false]);
  }
  const f = rig();
  f.tv.enter();
  f.run(TV_RISE_S);
  f.w.danger = true;
  f.tv.frame(1 / 60);
  assert.equal(f.tv.state, 'falling', 'a foe near: down to the traveller\'s eyes, not cut');
  const d = rig();
  d.tv.enter();
  d.tv.dispose();
  assert.equal(d.tv.state, 'off');
  assert.equal(d.win.count('keydown'), 0);
});

test('TV1 host: THE HEARTBEAT - every frame re-arms it; frames that stop bring the view down and hand the input back, a loop another boot killed is left QUIETLY (the cursor is the successor\'s), a hidden tab keeps it', () => {
  const r = rig();
  r.tv.enter();
  assert.equal(r.log.beat?.ms, TV_HEARTBEAT_MS, 'armed on the way up');
  const first = r.log.beat;
  r.tv.frame(1 / 60);
  assert.notEqual(r.log.beat, first, 'a frame re-arms it');
  r.beat();   // AUDIT DEEP X-9: one silent beat is a long task, not a stopped loop
  assert.equal(r.tv.state, 'rising', 'a hitch keeps the view');
  assert.equal(r.log.beat?.ms, TV_HEARTBEAT_MS, 'and waits one beat more');
  r.tv.frame(1 / 60);
  r.beat();
  assert.equal(r.tv.state, 'rising', 'a frame in between starts the count again');
  r.beat();   // the frames stopped: a throw downstream
  assert.equal(r.tv.state, 'off', 'two beats without a frame');
  assert.deepEqual(r.log.cursor, [true, false], 'the look handed back');
  assert.deepEqual(r.log.body, [true, false]);
  assert.equal(r.win.count('keydown'), 0, 'the listeners gone');
  assert.equal(r.log.beat, null, 'and no timer left pending');
  // a later boot claimed the loop: down without touching the cursor, which the new host owns
  const k = rig();
  k.tv.enter();
  k.w.alive = false;
  k.beat();
  assert.equal(k.tv.state, 'off');
  assert.deepEqual(k.log.cursor, [true], 'the cursor left to the successor');
  assert.deepEqual(k.log.body, [true, false], 'the body seam is module state - handed back');
  assert.deepEqual(k.log.hud, ['show', 'hide']);
  // ...and an event that arrives before the heartbeat notices goes on to whoever owns the canvas now
  const e = rig();
  e.tv.enter();
  e.w.alive = false;
  const ev = e.win.fire('pointerdown', { target: e.canvas, pointerId: 1, clientX: 5, clientY: 5, button: 0 });
  assert.equal(ev.reachedHost, true, 'not swallowed for a dead host');
  assert.equal(e.tv.state, 'off');
  assert.deepEqual(e.log.cursor, [true]);
  // a hidden tab stops the frames with nothing broken: the view waits
  const h = rig({ win: Object.assign(fakeWin(), { document: { hidden: true } }) });
  h.tv.enter();
  h.beat();
  assert.equal(h.tv.state, 'rising', 'kept');
  assert.equal(h.log.beat?.ms, TV_HEARTBEAT_MS, 're-armed');
});

test('TV1 host: THE VIEW OWNS THE CANVAS WHILE UP - a click is a pick, a drag past the slop orbits and picks nothing, the wheel zooms, the right button and the context menu never reach the host; the DOM beside it keeps its own', () => {
  const r = rig();
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  // a click
  let e = r.win.fire('pointerdown', { target: r.canvas, pointerId: 1, clientX: 100, clientY: 100, button: 0 });
  assert.ok(e.stopped && e.prevented, 'taken on the capture phase');
  assert.ok(r.win.fire('mousedown', { target: r.canvas, button: 0 }).stopped, 'the host\'s Mouse0 never hears it');
  r.win.fire('pointerup', { target: r.canvas, pointerId: 1, clientX: 102, clientY: 101, button: 0 });
  assert.deepEqual(r.log.picks, [[102, 101]], 'a press that did not travel is a pick');
  // a drag
  const yaw0 = r.tv.camera.yaw;
  r.win.fire('pointerdown', { target: r.canvas, pointerId: 2, clientX: 100, clientY: 100, button: 0 });
  r.win.fire('pointermove', { target: r.canvas, pointerId: 2, clientX: 100 + TV_CLICK_SLOP + 20, clientY: 100 });
  r.win.fire('pointerup', { target: r.canvas, pointerId: 2, clientX: 100 + TV_CLICK_SLOP + 20, clientY: 100, button: 0 });
  assert.equal(r.log.picks.length, 1, 'a drag picks nothing');
  assert.ok(r.tv.camera.yaw > yaw0, 'the drag turned the view');
  // the right button: never the swing
  assert.ok(r.win.fire('mousedown', { target: r.canvas, button: 2 }).stopped);
  assert.ok(r.win.fire('contextmenu', { target: r.canvas }).stopped);
  // the wheel
  const h0 = r.tv.camera.heightTarget;
  assert.ok(r.win.fire('wheel', { target: r.canvas, deltaY: -100 }).stopped);
  assert.ok(r.tv.camera.heightTarget < h0, 'rolled up: in');
  // the DOM around the canvas keeps its clicks (the readout's button, the travel panel, the chat)
  const dom = { id: 'button' };
  assert.equal(r.win.fire('pointerdown', { target: dom, pointerId: 3, clientX: 0, clientY: 0, button: 0 }).stopped, false);
  assert.equal(r.win.fire('wheel', { target: dom, deltaY: -100 }).stopped, false);
  // rising, a click is no pick
  const q = rig();
  q.tv.enter();
  q.win.fire('pointerdown', { target: q.canvas, pointerId: 1, clientX: 5, clientY: 5, button: 0 });
  q.win.fire('pointerup', { target: q.canvas, pointerId: 1, clientX: 5, clientY: 5, button: 0 });
  assert.deepEqual(q.log.picks, [], 'only once the view is up');
});

test('TV1 host: the pause key brings it down (and never opens the pause); the look keys turn the view, not the traveller; movement is camera-relative while no journey drives', () => {
  const r = rig();
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  assert.deepEqual([...TV_LOOK_ACTIONS], ['TurnLeft', 'TurnRight', 'LookUp', 'LookDown']);
  // a look key
  const yaw0 = r.tv.camera.yaw;
  assert.ok(r.win.fire('keydown', { code: 'ArrowRight', actions: ['TurnRight'] }).stopped, 'the host never turns the traveller');
  r.tv.steer(0.5);
  assert.ok(r.tv.camera.yaw > yaw0, 'the view turned');
  r.win.fire('keyup', { code: 'ArrowRight', actions: ['TurnRight'] });
  const yaw1 = r.tv.camera.yaw;
  r.tv.steer(0.5);
  assert.equal(r.tv.camera.yaw, yaw1, 'released: still');
  // an ordinary key is the host's
  assert.equal(r.win.fire('keydown', { code: 'KeyW', actions: ['MoveForwards'] }).stopped, false);
  // movement turns the traveller toward the view's heading
  r.tv.frame(1 / 60);
  r.w.yaw = r.tv.camera.yaw + 1;
  r.w.moving = true;
  r.tv.steer(0.05);
  assert.ok(near(r.w.yaw, r.tv.camera.yaw + 1 - 0.3, 1e-9), 'toward the view, at the turn rate');
  r.w.autopilot = true;
  const held = r.w.yaw;
  r.tv.steer(0.05);
  assert.equal(r.w.yaw, held, 'a journey drives: its heading is the autopilot\'s');
  // the pause key: down, swallowed
  const esc = r.win.fire('keydown', { code: 'Escape', actions: ['Escape'] });
  assert.ok(esc.stopped, 'the pause never opens under the view');
  assert.equal(r.tv.state, 'falling');
});

test('AUDIT TV B2/B9: the body ASKED is released even when it could not be held (or the next ask is refused for good); a view caught falling rises again without asking the body or the cursor twice; a cancelled press is no pick', () => {
  const r = rig({ holdBody: (on) => { r.log.body.push(on); return false; } });
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  r.tv.exit('escape', true);
  assert.deepEqual(r.log.body, [true, false], 'the hold the body could not take is still handed back');
  const q = rig();
  q.tv.enter();
  q.run(TV_RISE_S + 0.1);
  q.tv.exit('escape');
  q.run(TV_FALL_S / 3);
  assert.equal(q.tv.state, 'falling');
  q.tv.enter();
  assert.equal(q.tv.state, 'rising');
  assert.deepEqual(q.log.body, [true], 'one ask for the whole flight');
  assert.deepEqual(q.log.cursor, [true], 'the cursor noted once, on the way up from the head');
  q.run(TV_RISE_S + 0.1);
  q.win.fire('pointerdown', { target: q.canvas, pointerId: 7, clientX: 9, clientY: 9, button: 0 });
  q.win.fire('pointercancel', { target: q.canvas, pointerId: 7, clientX: 9, clientY: 9, button: 0 });
  assert.deepEqual(q.log.picks, [], 'the browser took the finger: no journey');
});

test('AUDIT TV B3/B4/B7: a finger on the canvas never starts the touch layer\'s stick, look or tap; a key or a button held down BEFORE the view rose lets go in the host; a key typed into a box is the box\'s', () => {
  const r = rig();
  assert.equal(r.win.fire('touchstart', { target: r.canvas }).stopped, false, 'down: the touch layer\'s');
  // held before the rise: the host saw the press
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  const ts = r.win.fire('touchstart', { target: r.canvas });
  assert.ok(ts.stopped && ts.prevented, 'up: the view\'s (and no compat mouse press behind it)');
  assert.equal(r.win.fire('touchend', { target: r.canvas }).stopped, false, 'an end is never taken - a stick down before the rise lets go');
  const k = r.win.fire('keyup', { code: 'ArrowLeft', actions: ['TurnLeft'] });
  assert.equal(k.stopped, false, 'a release whose press the host saw is the host\'s');
  assert.equal(r.win.fire('mouseup', { target: r.canvas, button: 1 }).stopped, false, 'and so is a button\'s');
  // taken by the view: the release is the view's too
  assert.ok(r.win.fire('keydown', { code: 'ArrowLeft', actions: ['TurnLeft'] }).stopped);
  assert.ok(r.win.fire('keyup', { code: 'ArrowLeft', actions: ['TurnLeft'] }).stopped);
  assert.ok(r.win.fire('mousedown', { target: r.canvas, button: 1 }).stopped);
  assert.ok(r.win.fire('mouseup', { target: r.canvas, button: 1 }).stopped);
  // a release the view let pass still stops the view's own turn
  r.win.fire('keydown', { code: 'ArrowRight', actions: ['TurnRight'] });
  r.tv.dispose();
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  const yaw0 = r.tv.camera.yaw;
  r.tv.steer(0.5);
  assert.equal(r.tv.camera.yaw, yaw0, 'nothing held carried over the teardown');
  // typing: the chat's box
  const box = { tagName: 'INPUT' };
  const esc = r.win.fire('keydown', { code: 'Escape', actions: ['Escape'], target: box });
  assert.equal(esc.stopped, false, 'Escape in the chat closes the chat');
  assert.equal(r.tv.state, 'up', 'and not the view');
  assert.equal(r.win.fire('keydown', { code: 'ArrowLeft', actions: ['TurnLeft'], target: { isContentEditable: true } }).stopped, false, 'an arrow moves the caret');
  r.tv.dispose();
  assert.equal(r.win.count('touchstart'), 0, 'every listener comes off');
});

test('AUDIT TV B1/B5/B6/B8/B9 by source: the focus is a frame\'s (a beginFrame no setFocus came before clears it); a chat closed over the view gives the cursor back to the view; the frame the view came down in draws from the head; a press on the readout stops there; the cursor as the view found it', () => {
  const rr = rd('src/render/renderer.js');
  const begin = rr.slice(rr.indexOf('  beginFrame(proj, view, lightDir, opts = null) {'), rr.indexOf('this._frameStamp++;   // PERF3'));
  assert.match(begin, /\n\s*if \(!this\._focusArmed && this\._focus\[3\] !== 0\) this\._focus\.fill\(0\);[^\n]*\n\s*this\._focusArmed = false;/, 'no interior, dungeon or panel frame inherits the street\'s focus');
  assert.ok(((i, j) => i >= 0 && j >= 0 && i < j)(begin.indexOf('this._focusArmed = false;'), begin.indexOf('this._beginLane(')), 'decided before the lane replays and the sun maps render');
  assert.match(rr, /setFocus\(p, wide = true\) \{\n\s*this\._focusArmed = true;[^\n]*\n\s*this\._focusWide = !!p && !!wide;/, 'every setFocus arms the next beginFrame');
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(!pointerSurfaces\.size && !gamePaused\(\)\) \{ if \(travelView\?\.active\) setCursorActive\(true\); else requestLook\(canvas\); \}/);
  assert.match(w, /: mwv0\.ownEye \? \{ \.\.\.mwv0, eye: tvHeadEye \} : mwv0;/);
  assert.match(w, /freeCursor: \(free\) => \{ if \(free\) \{ tvCursorWas = cursorActive\(\); setCursorActive\(true\); releaseLook\(\); \} else \{ setCursorActive\(tvCursorWas\); if \(!tvCursorWas && !gamePaused\(\) && !pointerSurfaces\.size && !\(modes\?\.modalWindowUp\?\.\(\) \?\? false\) && !overlayOpen\(\)\) requestLook\(canvas\); \} \},/, 'AUDIT DEEP T1-5: never the lock under a surface or a window - AUDIT DEEP2 A3: nor an overlay');
  const hud = rd('src/ui/travelViewHud.js');
  assert.match(hud, /const own = \(e\) => e\.stopPropagation\?\.\(\);\n\s*r\.addEventListener\?\.\('mousedown', own\);\n\s*r\.addEventListener\?\.\('mouseup', own\);/);
});

test('AUDIT DEEP T1-7/X-1/X-2/T1-5: a look key let go in a text box still stops the view\'s turn; the host CUTS the view at a door and at a video before any branch that skips the exterior frame; the same key again is the way out; the cursor never locks under a surface', () => {
  const r = rig();
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  assert.ok(r.win.fire('keydown', { code: 'ArrowLeft', actions: ['TurnLeft'] }).stopped);
  const up = r.win.fire('keyup', { code: 'ArrowLeft', actions: ['TurnLeft'], target: { tagName: 'INPUT' } });
  assert.equal(up.stopped, false, 'the box\'s key');
  const yaw0 = r.tv.camera.yaw;
  r.tv.steer(1);
  assert.equal(r.tv.camera.yaw, yaw0, 'and the view stopped turning');
  // the host, by source: the cut sits above the mode's return and above the video hold's
  const w = rd('src/scenes/world.js');
  const frame = w.slice(w.indexOf('  function frame(now) {'));
  const door = frame.indexOf("if (travelView?.active && (modes?.mode ?? 'exterior') !== 'exterior') { travelView.exit('door', true); setFlatLean(0); }");   // AUDIT DEEP2 D8: and the flats' lean back to none
  assert.ok(door > 0 && door < frame.indexOf('if (modes.frame(dt, now)) {'), 'the door cut precedes the modal branch');
  assert.ok(door < frame.indexOf('travelView?.steer(dt);'), 'and the steer - no turn from indoors');
  // R-2: the traveller's own sprite turns its quad to the VIEW's eye and leans with the flats
  assert.match(w, /const tvFace = tvf \? \{ yaw: tvf\.yaw, up: tvf\.up, grow: tvf\.grow \} : null;/);
  assert.match(w, /mwViewDrawBody\(canvas, \{ proj, view, eye: mwv\.eye, feet: player\.bodyFeetAt\(\), yaw: player\.bodyYawFor\(cam\.yaw\), viewYaw: cam\.yaw, face: tvFace \}\);/);
  assert.match(rd('src/player/mwView.js'), /if \(eotbLane\(\)\) \{ const drawn = drawEotbBody\(canvas, \{ proj, view, eye, feet, yaw: viewYaw, face \}\);/);   // AUDIT CLIMB-ARC N1: the sprite lane on the VIEW's yaw
  const eb = rd('src/player/eotbBody.js');
  assert.match(eb, /const by = face \? face\.yaw : cam\.yaw;\n\s*const camRight = \[Math\.cos\(by\), 0, -Math\.sin\(by\)\];\n\s*renderer\.drawBillboards\(\[batch\], camRight, face\?\.up \?\? \[0, 1, 0\]\);/);
  assert.match(eb, /cam\.pos, cam\.feet, face\?\.yaw \?\? cam\.yaw, cfg\.scale/, 'the lantern\'s quad too');
  // T1-9: no crosshair on a camera 450 m up - the HUD's own reticle, told by the host, the vitals kept
  assert.match(w, /\{ font: townTalk\.font, cursorActive: gamePaused\(\), reticleHidden: !!tvf,/);
  assert.match(rd('src/ui/hud.js'), /\n\s*reticleHidden,   \/\/ AUDIT DEEP T1-9/);
  const eh = rd('src/ui/enhancedHud.js');
  assert.match(eh, /const aim = !opts\.reticleHidden;\n\s*const showCross = aim && /);
  assert.match(eh, /const showCentreWord = aim && /);
  assert.match(eh, /const showCorner = aim && /);
  assert.match(frame, /if \(frameHeld\(\)\) \{ frameAbort\(\); hideWorldPlaque\(\); last = now; requestAnimationFrame\(frame\); drawGateBanner\(null\); drawGateMarksCard\(null\); drawGateDamageChart\(null\); drawGateGround\(null\); travelView\?\.exit\('video', true\); return; \}/, 'the video hold cuts the view on its own return');   // WB9a / WB9d: the marks card and the ground's rim go down on it too
});

test('TV1 host: the readout - the traveller\'s ring on the projected feet, the chevron along the heading, the compass on the view\'s heading, the place line, the hints by hand', () => {
  const r = rig();
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  r.tv.drawHud();
  assert.deepEqual(r.log.last.feet, { x: 400, y: 300, front: true });
  assert.equal(r.log.last.where, 'The wilds of Daggerfall');
  assert.ok(r.log.last.heading != null);
  assert.equal(r.log.last.fade, 1);
  assert.equal(compassDegrees(0), -0);
  assert.equal(compassDegrees(Math.PI / 2), -90, 'facing east, north is to the left');
  assert.equal(chevronDegrees({ x: 0, y: 0, front: true }, { x: 0, y: -10, front: true }), 0, 'up the screen');
  assert.equal(chevronDegrees({ x: 0, y: 0, front: true }, { x: 10, y: 0, front: true }), 90, 'to the right');
  assert.equal(chevronDegrees({ x: 0, y: 0, front: true }, { x: 10, y: 0, front: false }), null, 'off screen: keep the last');
  assert.equal(TRAVEL_VIEW_TITLE, 'Overworld');
  assert.match(TRAVEL_VIEW_HINTS.mouse, /Click to travel/);
  // AUDIT DEEP T1-12: the keys the player really has - read on the way up, handed to the readout
  assert.equal(TRAVEL_VIEW_HINTS.mouse, travelViewMouseHint(), 'the defaults\' words when the host names none');
  assert.match(rd('src/ui/travelViewHud.js'), /put\(parts\.hint, 'hint', f\.touch \? TRAVEL_VIEW_HINTS\.touch : travelViewMouseHint\(f\.keys \?\? \{\}\)\);/, 'the readout writes them');
  assert.match(travelViewMouseHint({ move: 'ESDF', out: 'P' }), /ESDF to walk · P to return$/);
  {
    const q = rig({ hintKeys: () => ({ move: 'ESDF', out: 'P' }) });
    q.tv.enter();
    q.tv.frame(1 / 60);
    q.tv.drawHud();
    assert.deepEqual(q.log.last.keys, { move: 'ESDF', out: 'P' });
  }
  assert.match(rd('src/scenes/world.js'), /hintKeys: \(\) => \{   \/\/ AUDIT DEEP T1-12[^\n]*\n\s*const store = bindings\(\);\n\s*const k = \(a\) => \{ const c = codeForAction\(store, a\); return c \? buttonText\(c, true\) : null; \};/);
  assert.match(TRAVEL_VIEW_HINTS.touch, /Pinch to zoom/);
  assert.equal(travelViewLine({ place: 'Daggerfall', region: 'Daggerfall' }), 'Daggerfall, Daggerfall');
  assert.equal(travelViewLine({ near: 'Ripwych', region: 'Daggerfall' }), 'Near Ripwych, Daggerfall');
  assert.equal(travelViewLine({ region: 'Wrothgarian Mountains' }), 'The wilds of Wrothgarian Mountains');
});

// ── THE FOCUS: THE WEATHER IS THE TRAVELLER'S ──────────────────────────────────────────────────────────────────────

test('TV1 focus: the fog measures from the focus - the camera while none is set (w 0), so the default is today\'s law; the sun\'s cascades are picked about the point the shadow pass rendered them about; no block declares a uniform twice', () => {
  assert.equal(FOCUS_GLSL, 'uniform vec4 uFocus;\nvec3 focusOrigin() { return uFocus.w > 0.5 ? uFocus.xyz : uCamPos; }');
  assert.match(FOG_GLSL, /float d = length\(worldPos - focusOrigin\(\)\);/);
  assert.ok(FOG_GLSL.startsWith(FOCUS_GLSL), 'the fog block is the focus\'s one home');
  assert.doesNotMatch(FOG_GLSL + SHADOW_GLSL, /#(ifn?def|define)/, 'no preprocessor: test/glsl.mjs evaluates these blocks as written');
  assert.ok(!SHADOW_GLSL.includes('uFocus'), 'the receiver block declares no focus - a program takes both');
  assert.match(SHADOW_GLSL, /uniform vec4 uSunOrigin;/);
  assert.match(SHADOW_GLSL, /float d = length\(wp - \(uSunOrigin\.w > 0\.5 \? uSunOrigin\.xyz : uCamPos\)\);/, 'the cascade pick');
  // a program with both blocks declares each uniform once
  const both = `${SHADOW_GLSL}\n${FOG_GLSL}`;
  for (const u of ['uFocus', 'uSunOrigin']) assert.equal((both.match(new RegExp(`uniform vec4 ${u};`, 'g')) ?? []).length, 1, u);
  // the renderer: every fog table looks the focus up, the one upload sends it, setFocus sets w, the sun map stands on it
  const r = rd('src/render/renderer.js');
  assert.equal((r.match(/focus: gl\.getUniformLocation\([A-Za-z.]+, 'uFocus'\)/g) ?? []).length, 3, 'the water, the world programs\' factory, the character quad');
  assert.match(r, /focus: u\('uFocus'\)/, 'the lane\'s tables');
  assert.match(r, /if \(prog\.focus\) gl\.uniform4fv\(prog\.focus, this\._focus\);/);
  assert.match(r, /eye: this\._shadowEye\(\), lightDir, sunScale: this\._sunScale, pointLights: this\._pointLights, carried: this\._pointCarried,/);
  // ...and the shadow pass hands its receivers the eye it rendered about, in every table that uploads it
  assert.equal((r.match(/sunOrigin: gl\.getUniformLocation\(p, 'uSunOrigin'\)/g) ?? []).length, 2, 'the lane\'s world tables');
  assert.match(rd('src/render/airPass.js'), /sunOrigin: u\(p, 'uSunOrigin'\)/, 'the air pass\'s shafts');
  const sp = rd('src/render/shadowPass.js');
  assert.match(sp, /this\.sunOrigin\[0\] = f\.eye\[0\]; this\.sunOrigin\[1\] = f\.eye\[1\]; this\.sunOrigin\[2\] = f\.eye\[2\]; this\.sunOrigin\[3\] = 1;/);
  assert.match(sp, /if \(loc\.sunOrigin\) gl\.uniform4fv\(loc\.sunOrigin, this\.sunOrigin\);/);
});

test('TV1 focus: setFocus writes w 1 with the point and w 0 without it, moving the frame stamp only on a change; the sun map stands on the focus while set', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const fake = { _focus: new Float32Array(4), _camPos: new Float32Array([1, 2, 3]), _frameStamp: 0 };
  Renderer.prototype.setFocus.call(fake, null);
  assert.equal(fake._frameStamp, 0, 'none to none: nothing re-sent');
  Renderer.prototype.setFocus.call(fake, [10, 20, 30]);
  assert.deepEqual([...fake._focus], [10, 20, 30, 1]);
  assert.equal(fake._frameStamp, 1);
  assert.deepEqual([...Renderer.prototype._shadowEye.call(fake)], [10, 20, 30]);
  Renderer.prototype.setFocus.call(fake, null);
  assert.deepEqual([...fake._focus], [0, 0, 0, 0]);
  assert.equal(fake._frameStamp, 2);
  assert.deepEqual([...Renderer.prototype._shadowEye.call(fake)], [1, 2, 3], 'the camera again');
});

// ── THE WORLD HOST'S WIRING ─────────────────────────────────────────────────────────────────────────────────────────

test('TV1 host wiring: the frame draws from the view\'s eye risen out of the body\'s own camera, the fog from the traveller\'s head, the sky and the flats turned to the view, no grass, hand or crosshair plaque from the air', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const mwv0 = mwViewFrame\(\{\n\s*eyeOverride: travelView\?\.eye \?\? null,\n/);
  assert.match(w, /const tvHeadEye = mwViewHoldChanged\(\) \? cam\.pos : \(mwv0\.ownEye \?\? mwv0\.eye\);\n\s*const tvf = travelView\?\.frame\(dt, \{ eye: tvHeadEye, fwd \}\) \?\? null;\n\s*const mwv = tvf \? \{ \.\.\.mwv0, eye: tvf\.eye \} : mwv0\.ownEye \? \{ \.\.\.mwv0, eye: tvHeadEye \} : mwv0;[^\n]*\n\s*const viewFwd = tvf \? tvf\.fwd : fwd;\n\s*const tvFace = [^\n]*\n\s*setFlatLean\([^\n]*\n\s*renderer\.setFocus\(tvf \? cam\.pos : null, !!tvf && tvf\.blend >= 0\.5\);/);
  const setAt = w.indexOf('renderer.setFocus(tvf ? cam.pos : null, !!tvf && tvf.blend >= 0.5);');
  assert.ok(setAt > 0 && setAt < w.indexOf('renderer.beginFrame(proj, view, sunDirection(minute), WORLD_FRAME);'), 'AUDIT TV B1: BEFORE beginFrame - its lane replay and its sun maps read the focus (AUDIT DEEP2: and the line must be there - a -1 passed this)');
  assert.match(w, /lookAt\(mwv\.eye, \[mwv\.eye\[0\] \+ viewFwd\[0\], mwv\.eye\[1\] \+ viewFwd\[1\], mwv\.eye\[2\] \+ viewFwd\[2\]\], \[0, 1, 0\]\)/);
  assert.match(w, /sky\.draw\(tvf \? tvf\.yaw : cam\.yaw, tvf \? tvf\.pitch : cam\.pitch \+ climbFeel\.pitch\(\), fieldOfView\(\) \+ climbFeel\.fovRad\(\),/);
  assert.match(w, /const _bbYaw = tvf \? tvf\.yaw : cam\.yaw;/);
  assert.match(w, /const bbUp = tvf \? tvf\.up : UP_Y;/);
  assert.equal((w.match(/renderer\.drawBillboards\(.*, camRight, bbUp\);/g) ?? []).length, 3, 'the flats, the missiles, the townsfolk');
  assert.match(w, /renderer\.recordShadowBillboards\(castBatches, camRight, UP_Y\)/, 'their shadows stand upright');
  assert.match(w, /if \(labGrass && !tvf\) \{/);
  assert.match(w, /if \(walkMode && playerSpawned && !tvf\) weaponRig\.draw\(\{ paralyzed \}\);/);
  assert.match(w, /cursorActive: gamePaused\(\) \|\| pointerSurfaces\.size > 0 \|\| !!tvf,/, 'the hover\'s own door: a freed cursor names nothing');
  assert.match(w, /travelView\?\.steer\(dt\);/);
  assert.match(w, /travelView\?\.drawHud\(\);/);
  assert.match(w, /audio\.setListener\(cam\.pos, tvf \? \[viewFwd\[0\], 0, viewFwd\[2\]\] : fwd\);/);
  // the cursor toggle cannot take the view's free cursor back, and the loop's death takes the view with it
  assert.match(w, /bindCursorToggle\(canvas, \(\) => gamePaused\(\) \|\| \(modes\?\.modalWindowUp\?\.\(\) \?\? false\) \|\| !!travelView\?\.active,/);
  // P0's guard stays the plaque's one line (four pins hold it); the view goes on its own heartbeat, asking the same token
  assert.match(w, /if \(!frameAlive\(_frameToken\)\) \{ destroyWorldPlaque\(\); return; \}/);
  assert.match(w, /alive: \(\) => frameAlive\(_frameToken\),/);
  // the view's host deps: the deck the sky draws, the foes the map refuses on, the body held, the cursor freed
  assert.match(w, /cloudBase: \(\) => VC_PROFILE\[weather\]\?\.base \?\? null,/);
  assert.match(w, /danger: \(\) => duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoePool\(\)\),/, 'AUDIT DEEP2 A9: a live duel too');
  assert.match(w, /holdBody: \(on\) => mwViewHoldThird\(on\),/);
  assert.match(w, /freeCursor: \(free\) => \{ if \(free\) \{ tvCursorWas = cursorActive\(\); setCursorActive\(true\); releaseLook\(\);/);
  // the gate: the enhanced lane, a walking body in the open air, alive and above the water - each refusal said
  const gate = w.slice(w.indexOf('const travelViewAllowed = () => {'), w.indexOf('const travelViewWhere = () => {'));
  for (const [why, re] of [['enhanced', /if \(!isEnhanced\(\)\) return \{ ok: false, why: TRAVEL_VIEW_TEXT\.enhancedOnly \};/], ['walking', /if \(params\.has\('fly'\) \|\| !walkMode \|\| !playerSpawned\) return \{ ok: false \};/],
    ['open air', /if \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) return \{ ok: false, why: TRAVEL_VIEW_TEXT\.indoors \};/], ['alive', /if \(!\(\(playerEntity\.health \?\? 0\) > 0\)\) return \{ ok: false \};/],
    ['above the water', /if \(dwPlayer\?\.submerged\) return \{ ok: false, why: TRAVEL_VIEW_TEXT\.underwater \};/]]) assert.match(gate, re, `the gate refuses ${why}`);
  // THE FOUR HOSTS RULE: the view is this host's alone, and the other three never grow one
  for (const f of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(rd(f), /createTravelView|travelView\./, `${f} has no travel view`);
  }
  assert.match(rd('src/scenes/travelView.js'), /THE FOUR HOSTS RULE names all four - world\.js WIRED; exterior\.js, the\s*\n\/\/ dev scene's fixed city, NOT WIRED on purpose/);
});

test('TV1 key: TravelView is the port\'s own action, appended, drawn in the Windows group and SHIPPED UNBOUND - the map\'s door is the way in', () => {
  assert.equal(ACTIONS.indexOf('TravelView'), 79, 'appended - a saved file resolves the rest by position (THE MERGE: its live index kept; PADWALK\'s WalkMode, never deployed, after it)');
  assert.ok(PORT_ACTIONS.includes('TravelView'));
  assert.equal(DEFAULT_BINDINGS.find(([, a]) => a === 'TravelView'), undefined, 'no default key');
  const windows = ACTION_GROUPS.find((g) => g.name === 'Windows' || g.title === 'Windows' || g.label === 'Windows');
  assert.ok(windows?.rows.some((r) => r.action === 'TravelView'), 'the pane draws it');
  assert.match(rd('src/scenes/world.js'), /if \(!townTalk\.overlayActive && act === 'TravelView'\) \{ if \(e\.repeat\) return true; travelViewKey\(\); return true; \}\n\s*if \(!townTalk\.overlayActive && \(modes\?\.mode \?\? 'exterior'\) === 'exterior'\) \{/,
    'AUDIT DEEP X-2: the same key again is the way out - AUDIT DEEP2 A5/A8: never on a repeat, and ABOVE the mode gate (indoors it is answered)');
  // PAD-BINDS (FIELD BUGS 2026-10-04e): the key's arm and the pad's d-pad share ONE toggle
  assert.match(rd('src/scenes/world.js'), /function travelViewKey\(\) \{\n\s*const st = travelView\?\.state;\n\s*if \(st === 'up' \|\| st === 'rising'\) travelView\.exit\('key'\); else travelView\?\.enter\(\);\n\s*\}/);
});

test('TV1 body: the seam holds whichever body answers out of the head for the view, hands it back as it found it, and hides every first-person piece while it holds', async () => {
  const mv = await import('../src/player/mwView.js');
  const { eotbCamera } = await import('../src/player/eotbCamera.js');
  const src = rd('src/player/mwView.js');
  // the EOTB lane, when it can draw: held into third, handed back to first
  mv.setEotbBodyReady(() => true);
  try {
    assert.equal(mv.eotbLane(), true, 'the sprite lane opens once its body can draw - the arm below must run, not skip');
    {
      if (eotbCamera.thirdPerson()) eotbCamera.toggleOffset(false);
      assert.equal(mv.mwViewHoldThird(true), true);
      assert.equal(eotbCamera.thirdPerson(), true, 'out of the head');
      assert.equal(mv.mwViewHeldThird(), 'eotb');
      assert.equal(mv.mwViewHoldChanged(), true, 'AUDIT DEEP T1-10: taken OUT of the head - the rise starts from the head\'s eye');
      assert.deepEqual(mv.mwViewHides(), { weapon: true, horse: true, spellHands: true }, 'no hand, horse or weapon on the raised camera');
      assert.equal(mv.mwViewHoldThird(false), true);
      assert.equal(eotbCamera.thirdPerson(), false, 'back into the head it was in');
      // a player already in third person stays there
      eotbCamera.toggleOffset(true);
      mv.mwViewHoldThird(true);
      assert.equal(mv.mwViewHoldChanged(), false, 'already out: its own camera is the head it rises from');
      mv.mwViewHoldThird(false);
      assert.equal(eotbCamera.thirdPerson(), true, 'the view hands back what it found');
      eotbCamera.toggleOffset(false);
    }
  } finally { mv.setEotbBodyReady(() => false); }
  assert.equal(mv.mwViewHeldThird(), undefined, 'nothing held');
  // AUDIT DEEP X-3: a save records the player's OWN camera - the Morrowind hold's borrowed third person never reaches it;
  // a load under the view cuts it before the save's camera is put back
  const { mwCamera } = await import('../src/player/mwCamera.js');
  assert.deepEqual(mv.mwViewSaveCamera(), mwCamera.state(), 'nothing held: the camera as it is');
  assert.match(src, /return heldThird\?\.changed && heldThird\.lane === 'mw' \? \{ \.\.\.s, firstPerson: true \} : s;/);
  const wsrc = rd('src/scenes/world.js');
  assert.match(wsrc, /camera: mwViewSaveCamera\(\), transport:/);
  // AUDIT OW5b D4: the cut rides the Overworld's load reset, the first thing applyPose does - before the camera the save restores
  assert.match(wsrc, /function overworldLoadReset\(\) \{[\s\S]*?travelView\?\.exit\('load', true\);[\s\S]*?\n  \}\n  function applyPose\(pose\) \{\n\s*overworldLoadReset\(\);[\s\S]*?mwViewLoadPose\(pose\.camera,/);
  // the Morrowind rig: out by the restore door, back by the head's own door; the saddle holds nothing (RIDE-POV)
  assert.match(src, /if \(fpArm\.canThirdPerson\(\) && !mounted\) \{/);
  assert.match(src, /else if \(h\.changed && h\.lane === 'mw'\) mwIntoHead\(\);/);
  // the frame hands the view's eye to the sprite and keeps the body's own for the rise
  assert.match(src, /cameraPos: eyeOverride \?\? out\.eye/);
  assert.match(src, /return eyeOverride \? \{ \.\.\.out, eye: eyeOverride, ownEye: out\.eye \} : out;/);
  assert.match(src, /return eyeOverride \? \{ \.\.\.eye, eye: eyeOverride, ownEye: eye\.eye \} : eye;/);
});

test('AUDIT DEEP2 A2/A3/A4/A6/A7 view: a wheel zooms by its size; a repeat of a key held before the rise is the host\'s; an overlay over the view has the keys; the world\'s activation and swing are never pressed from under it; a lost focus holds nothing', () => {
  // A4: the law - a mouse's click a notch, a trackpad's nudge a fraction, lines and pages by their size, three at most
  assert.equal(wheelNotches({ deltaY: 100 }), -1);
  assert.ok(near(wheelNotches({ deltaY: -2 }), 0.02));
  assert.ok(near(wheelNotches({ deltaY: 3, deltaMode: 1 }), -0.48));
  assert.equal(wheelNotches({ deltaY: 1, deltaMode: 2 }, 800), -3, 'a page is capped');
  const up = (over) => { const r = rig(over); r.tv.enter(); r.run(TV_RISE_S + 0.1); return r; };
  const a = up(), b = up();
  const h0 = a.tv.camera.heightTarget;
  for (let i = 0; i < 4; i++) a.win.fire('wheel', { target: a.canvas, deltaY: -2, deltaMode: 0 });
  b.win.fire('wheel', { target: b.canvas, deltaY: -100, deltaMode: 0 });
  assert.ok(h0 - a.tv.camera.heightTarget < (h0 - b.tv.camera.heightTarget) / 4, `four trackpad nudges are not four notches (${h0} -> ${a.tv.camera.heightTarget}; a notch ${b.tv.camera.heightTarget})`);
  // A6: an auto-repeat of a look key pressed before the rise is not taken - its release is the host's
  assert.equal(a.win.fire('keydown', { code: 'ArrowRight', actions: ['TurnRight'], repeat: true }).stopped, false);
  assert.equal(a.win.fire('keyup', { code: 'ArrowRight', actions: ['TurnRight'] }).stopped, false, 'the release reaches the host');
  // A2: the world's own presses die here, and their releases with them
  assert.deepEqual([...TV_WORLD_ACTIONS], ['ActivateCenterObject', 'SwingWeapon']);
  for (const act of TV_WORLD_ACTIONS) {
    assert.ok(a.win.fire('keydown', { code: 'KeyE', actions: [act] }).stopped, `${act}: never pressed from under the view`);
    assert.ok(a.win.fire('keyup', { code: 'KeyE', actions: [act] }).stopped);
  }
  // A3: the Tab dial is up - its Escape and its arrows are its own
  let overlay = true;
  const c = up({ overlayUp: () => overlay });
  assert.equal(c.win.fire('keydown', { code: 'Escape', actions: ['Escape'] }).stopped, false, 'Escape closes the dial');
  assert.equal(c.tv.state, 'up', 'not the view');
  assert.equal(c.win.fire('keydown', { code: 'ArrowLeft', actions: ['TurnLeft'] }).stopped, false, 'the arrow chooses on the dial');
  overlay = false;
  // A7: a look key held, the focus lost - nothing turns on
  assert.ok(c.win.fire('keydown', { code: 'ArrowLeft', actions: ['TurnLeft'] }).stopped);
  c.win.fire('blur', {});
  const y0 = c.tv.camera.yaw;
  c.tv.steer(0.5);
  assert.equal(c.tv.camera.yaw, y0, 'the focus lost, the key is let go');
  // A7: a drag whose button is up (its release went elsewhere) orbits no more
  c.win.fire('pointerdown', { target: c.canvas, pointerId: 1, clientX: 100, clientY: 100, button: 0, pointerType: 'mouse' });
  c.win.fire('pointermove', { pointerId: 1, clientX: 140, clientY: 100, buttons: 1, pointerType: 'mouse' });
  const y1 = c.tv.camera.yaw;
  assert.notEqual(y1, y0, 'a drag turns');
  c.win.fire('pointermove', { pointerId: 1, clientX: 220, clientY: 100, buttons: 0, pointerType: 'mouse' });
  assert.equal(c.tv.camera.yaw, y1, 'a hover after the lost release does not');
  for (const r of [a, b, c]) r.tv.dispose();
});

test('AUDIT DEEP2 A1/A2/A5/A8/A9 by source: the travel panel keeps its presses; the pad is a cursor under the view; the key never repeats and answers indoors; a duel refuses the view', () => {
  const panel = rd('src/ui/enhancedTravelControl.js');
  assert.match(panel, /bar\.addEventListener\('mousedown', \(e\) => \{ if \(e\.target\?\.closest\?\.\('\[data-act\]'\)\) e\.stopPropagation\(\); \}\);/);
  assert.doesNotMatch(panel, /addEventListener\('mouseup', \(e\) => \{ if \(e\.target\?\.closest/, 'never the release (AUDIT CHAT C5)');
  const w = rd('src/scenes/world.js');
  assert.match(w, /overlayActive: \(\) => townTalk\.overlayActive \|\| !!travelView\?\.active \|\| !!modes\?\.overlayHeld,/);   // PIN MOVED (FIELD BUGS 29h TOUCH-HELD): and the modes' own stacks
  assert.match(w, /overlayUp: \(\) => overlayOpen\(\) \|\| travelViewConfirmOpen\(\),/);   // PIN MOVED (OW-CONFIRM): and the view's own question has the keys
  assert.match(w, /if \(act === 'Escape' && e\.repeat\) return true;[^\n]*\n\s*if \(act === 'Escape' && pauseDoorReady\(\)\) \{ hudCtx\.togglePause\(\); return true; \}/);
});

test('AUDIT DEEP2 D2 view: the floating origin re-anchors under a moving traveller and the Overworld\'s eye goes on as it was going - no lurch at the crossing', () => {
  const r = rig();
  r.tv.enter();
  const dt = 1 / 60, v = 150;   // m/s: a journey at speed, the focus easing behind the feet
  const step = () => { r.w.feet = [r.w.feet[0] + v * dt, 0, r.w.feet[2]]; r.tv.frame(dt); return [...r.tv.eye]; };
  for (let i = 0; i < 240; i++) step();
  const a = step(), b = step();
  const perFrame = b.map((x, i) => x - a[i]);
  const offset = [-819.2, 0, 0];   // the origin moves: every scene point shifts by it, the feet with them
  r.w.feet = r.w.feet.map((x, i) => x + offset[i]);
  r.tv.rebase(offset);
  const c = step();
  const moved = c.map((x, i) => x - b[i] - offset[i]);
  assert.ok(Math.hypot(...moved.map((x, i) => x - perFrame[i])) < 0.05, `the eye went on by a frame's worth (${moved.map((x) => x.toFixed(3))} vs ${perFrame.map((x) => x.toFixed(3))})`);
  r.tv.dispose();
});

test('AUDIT DEEP2 D2/D6 by source: the host rebases the view with the origin; the riders and the walkers take the view\'s eye and right, as the dolls do', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /mwViewRebase\(r\.offset\);[^\n]*\n\s*travelView\?\.rebase\(r\.offset\);/);
  assert.match(w, /const peerYaw = travelView\?\.active && travelView\.camera \? travelView\.camera\.yaw : cam\.yaw;\n\s*const peerEye = travelView\?\.eye \?\? cam\.pos, peerRight = \[Math\.cos\(peerYaw\), 0, -Math\.sin\(peerYaw\)\];/);
  assert.match(w, /peerRiders\.sync\(seen, onlineToScene, \{ eye: peerEye, right: peerRight,/);
  assert.match(w, /peerWalkers\.sync\(seen, onlineToScene, \{ eye: peerEye, right: peerRight,/);
});
