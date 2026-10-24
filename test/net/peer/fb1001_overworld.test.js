// FIELD BUGS 2026-10-01 #9-#11 - the Overworld (the travel view, bible/06-Systems/Travel-View.md): "in the overworld,
// weather is weird, it only happens around the player at small scale. Your sprite doesnt rotate based on direction,
// and you cannot see other player's sprites".
//   OW-WEATHER (#9): the sand, the rain, the snow and the wisps wrap their 42-90 m boxes round the eye handed in, and
//     cam.pos stays on the traveller's head under the view (player/travelCamera.js) while the camera stands 150-450 m
//     up and back - a small cube of weather round the sprite. They wrap round the view's own eye now.
//   OW-FACE (#10): the keys turned the body to the VIEW's heading and walked it camera-relative, so it showed its back
//     whichever key was held (S walked it backwards at the camera, A and D sideways). The body turns to the way the
//     keys point; the keys' vector is turned onto it, so the walk is the keys' way as before.
//   OW-PEERS (#11): the traveller is drawn grown with the eye's distance (OW-BIG) and every other player at their own
//     size - a speck at 330 m under their name. Each is grown by the same law at their own feet: the riders and the
//     walkers (net/peer/peerRiders.js), the dolls and the class sprites (net/remotePlayers.js), the Morrowind bodies
//     (net/peer/peerBodies.js, drawThird's OW-BIG).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keysHeading, axesToward, tvOwnGrow, forwardOf, TV_TURN_RATE } from '../../../src/player/travelCamera.js';
import { createTravelView, TV_MOVE_ACTIONS } from '../../../src/scenes/travelView.js';
import { createPeerWalkers, createEotbArt } from '../../../src/net/peer/peerRiders.js';
import { RemotePlayers } from '../../../src/net/remotePlayers.js';
import { PeerBodies } from '../../../src/net/peer/peerBodies.js';
import { quadHalfDiagonal } from '../../../src/render/bounds.js';
import { CAPSULE_HEIGHT } from '../../../src/player/motor.js';
import { PAPERDOLL_W, PAPERDOLL_H } from '../../../src/ui/paperDoll.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await flush(); };
/** The direction a motor carries a body facing `yaw` under (forward, strafe): its forward turned by the axes. */
const carried = (yaw, f, s) => yaw + Math.atan2(s, f);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

test('OW-WEATHER: under the Overworld the falling weather and the wind wrap round the eye the view is drawn from - never round the traveller\'s head (mutants: the eye back to the head; a draw left on it)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const mwv = tvf \? \{ \.\.\.mwv0, eye: tvf\.eye \}/, 'the frame\'s eye under the view is the view\'s');
  assert.match(w, /\n {4}const wxEye = tvf \? mwv\.eye : cam\.pos;\n/, 'the weather\'s eye: the view\'s under it, the head\'s on the ground');
  assert.match(w, /\n {4}const drawFalling = \(\) => \{\n {6}wxEye32\[0\] = wxEye\[0\]; wxEye32\[1\] = wxEye\[1\]; wxEye32\[2\] = wxEye\[2\];/, 'copied into the one array as the falling weather is drawn (RAIN-LEAK)');
  for (const [what, re] of [
    ['the sand', /sand\.draw\(\{ on: true, strength01: fx\.intensity, windV: wd\.windV, step: wd\.step, gust: wd\.gust \}, proj, view, wxEye32, now \/ 1000\);/],
    ['the rain and the snow', /precip\.drawFall\(precipShown, proj, view, wxEye32, camRight, now \/ 1000\);/],   // PRECIP1: the fall at the air's snow share
    ['the wisps', /wisps\.draw\(wd, proj, view, wxEye32, now \/ 1000\);/],
  ]) assert.match(w, re, what);
  const at = w.indexOf('    const wxEye = ');
  assert.ok(at > w.indexOf('    const mwv = tvf ?') && at < w.indexOf("if (precipShown === 'sand') {"), 'after the frame\'s eye, before the first draw');
  assert.equal((w.slice(at, w.indexOf('    // GR1: THE LAB\'S GRASS', at)).match(/new Float32Array\(cam\.pos\)/g) || []).length, 0, 'no weather draw left on the head');
});

test('OW-FACE: the keys\' heading is the view\'s turned by the keys, and the axes turned onto the body carry it that way at any facing, at the keys\' own speed (mutants: the heading\'s sign; the axes unturned)', () => {
  assert.equal(keysHeading(0.4, 0, 0), null, 'no key, no heading');
  for (const cy of [0, 1.1, -2.7]) {
    assert.ok(near(keysHeading(cy, 1, 0), cy), 'W: the view\'s own heading');
    assert.ok(near(wrap(keysHeading(cy, -1, 0) - cy), Math.PI), 'S: toward the camera');
    assert.ok(near(keysHeading(cy, 0, 1), cy + Math.PI / 2) && near(keysHeading(cy, 0, -1), cy - Math.PI / 2), 'D and A: across it');
    assert.ok(near(keysHeading(cy, 1, 1), cy + Math.PI / 4), 'a diagonal');
    for (const [f, s] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [0.4, -0.7]]) {
      const way = keysHeading(cy, f, s);
      for (const yaw of [cy, cy + 2, cy - 0.5, way]) {
        const t = axesToward(yaw, way, f, s);
        assert.ok(near(wrap(carried(yaw, t.forward, t.strafe) - carried(cy, f, s)), 0), `(${f}, ${s}) at ${yaw.toFixed(2)}: carried the keys' way from the view (TV1's law)`);
        assert.ok(near(Math.hypot(t.forward, t.strafe), Math.hypot(f, s)), 'at the keys\' own speed');
      }
      const done = axesToward(way, way, f, s);
      assert.ok(near(done.strafe, 0) && done.forward > 0, 'turned: straight ahead - the forward walk, the sprite\'s front-on view');
    }
  }
});

/** A window just real enough for the view's listeners (tv1's). */
function fakeWin() {
  const L = [];
  return {
    addEventListener(type, fn, opt) { L.push({ type, fn, capture: opt === true || !!opt?.capture }); },
    removeEventListener(type, fn) { const i = L.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) L.splice(i, 1); },
  };
}
function view(axes) {
  const w = { feet: [0, 0, 0], yaw: 0, moving: true, autopilot: false };
  const tv = createTravelView({
    canvas: { contains: () => false }, win: fakeWin(),
    feet: () => w.feet, headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(w.yaw, 0) }),
    yaw: () => w.yaw, setYaw: (y) => { w.yaw = y; }, heightAt: () => 0, cloudBase: () => null,
    allowed: () => ({ ok: true }), windowUp: () => false, danger: () => false, actionsOf: () => [],
    movementHeld: () => w.moving, autopilot: () => w.autopilot, holdBody: () => true, freeCursor() {}, where: () => '',
    project: () => null, hud: { show() {}, hide() {}, update() {} }, say() {}, alive: () => true,
    schedule: () => null, cancel() {},
    ...(axes ? { movementAxes: () => axes.now } : {}),
  });
  tv.enter();
  for (let i = 0; i < 120; i++) tv.frame(1 / 60);
  return { tv, w };
}

test('OW-FACE: the view\'s steer turns the body toward the keys\' heading at the turn rate - S faces it to the camera, D to the right - and a host with no axes keeps TV1\'s turn to the view (mutant: the steer back on the view\'s heading)', () => {
  const axes = { now: { forward: -1, strafe: 0 } };
  const r = view(axes);
  const cy = r.tv.camera.yaw;
  r.w.yaw = cy;
  r.tv.steer(0.1);
  assert.ok(near(Math.abs(wrap(r.w.yaw - cy)), TV_TURN_RATE * 0.1), 'S: turning round, at the rate');
  for (let i = 0; i < 20; i++) r.tv.steer(0.1);
  assert.ok(near(Math.abs(wrap(r.w.yaw - cy)), Math.PI, 1e-6), 'and facing the camera');
  axes.now = { forward: 0, strafe: 1 };
  for (let i = 0; i < 20; i++) r.tv.steer(0.1);
  assert.ok(near(wrap(r.w.yaw - (cy + Math.PI / 2)), 0, 1e-6), 'D: facing the view\'s right');
  r.w.autopilot = true; const held = r.w.yaw; axes.now = { forward: 1, strafe: 0 };
  r.tv.steer(0.5);
  assert.equal(r.w.yaw, held, 'a journey drives: its heading is the autopilot\'s');
  const old = view(null);
  old.w.yaw = old.tv.camera.yaw + 1;
  old.tv.steer(0.05);
  assert.ok(near(old.w.yaw, old.tv.camera.yaw + 1 - TV_TURN_RATE * 0.05), 'no axes: toward the view, as TV1 pins it');
  // the host hands the axes, and turns the motor's onto the body before the keys' travel reads them
  const w = rd('src/scenes/world.js');
  assert.match(w, /movementAxes: \(\) => \(\{ forward: \(held\(keys, 'MoveForwards'\) \? 1 : 0\) - \(held\(keys, 'MoveBackwards'\) \? 1 : 0\), strafe: \(held\(keys, 'MoveRight'\) \? 1 : 0\) - \(held\(keys, 'MoveLeft'\) \? 1 : 0\) \}\),/);
  assert.deepEqual([...TV_MOVE_ACTIONS], ['MoveForwards', 'MoveBackwards', 'MoveLeft', 'MoveRight']);
  const turn = w.indexOf('const turned = axesToward(cam.yaw, keysHeading(travelView.camera.yaw, axes.forward, axes.strafe), axes.forward, axes.strafe);');
  assert.ok(turn > w.indexOf('        const axes = _overlayHeld ?') && turn < w.indexOf('const way = cam.yaw + Math.atan2(axes.strafe, axes.forward);'), 'after the journey\'s drive, before the keys\' travel reads the way');
  assert.match(w.slice(w.lastIndexOf('\n        if (', turn), turn), /if \(travelView\?\.active && travelView\.camera && !_travelDrive && !_overlayHeld && !travelOptions\?\.state\?\.autopilot && \(axes\.forward \|\| axes\.strafe\)\) \{/, 'under the view, with no journey and no autopilot driving');
});

// ── OW-PEERS ─────────────────────────────────────────────────────────────────────────────────────────────────────
function walkerRig() {
  const renderer = {
    uploadTexture() {},
    createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: null, bounds: new Float32Array([0, 0, 0, quadHalfDiagonal(size)]) }),
    destroyBillboardBatch() {},
  };
  const art = createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }) });
  return createPeerWalkers({ art });
}
const pose = (o = {}) => ({ x: 4, y: 0, z: 9, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });

test('OW-PEERS: a walker under the Overworld is drawn grown by the traveller\'s own law at its feet - size, reach, name height - and casts no giant\'s shadow; on the ground, its own size (mutants: the grow dropped; the reach left; the shadow kept)', async () => {
  const w = walkerRig();
  const peer = { id: 'p1', look: { eo: 3 }, shown: pose({ hl: 1 }) };
  const toScene = (p) => [p.x, p.y, p.z];
  w.sync([peer], toScene, { eye: [4, 1, 20], dt: 0.01 }); await settle();
  w.sync([peer], toScene, { eye: [4, 1, 20], dt: 0.01 });
  const [b] = w.batches();
  const own = { ...b.size }, ownH = w.heightOf('p1');
  assert.equal(b.noShadow, false, 'on the ground it casts as before');
  const eye = [4, 300, -150];
  const g = tvOwnGrow(Math.hypot(0, 300, 159));
  assert.ok(g > 5, `the view's grow at 330 m (${g})`);
  const grow = (f) => tvOwnGrow(Math.hypot(eye[0] - f[0], eye[1] - f[1], eye[2] - f[2]));
  w.sync([peer], toScene, { eye, dt: 0.01, grow }); await settle();   // from the view's side the walker shows another of its eight views - its art loads first
  w.sync([peer], toScene, { eye, dt: 0.01, grow });
  assert.ok(near(b.size.w, own.w * g) && near(b.size.h, own.h * g), `grown ${g} times (${b.size.w.toFixed(2)} x ${b.size.h.toFixed(2)})`);
  assert.ok(near(b.bounds[3], quadHalfDiagonal(b.size), 1e-5), 'its reach grown with it - never culled by its old size');
  assert.equal(b.noShadow, true, 'no giant\'s shadow');
  assert.ok(near(w.heightOf('p1'), ownH * g, 1e-6), 'its name over its grown head');
  assert.equal(w.walkers.get('p1').lantern, null, 'a grown walker hangs no lantern at a waist that is not there');
  w.sync([peer], toScene, { eye, dt: 0.01 });
  assert.ok(near(b.size.w, own.w) && near(b.size.h, own.h) && b.noShadow === false, 'off the view: its own size again');
});

test('OW-PEERS: a doll and a Morrowind body grown too - the doll\'s size, reach and name; the body drawn its grow times and leaned as the traveller\'s own, its head for its name (mutants: either layer\'s grow dropped; the lean)', async () => {
  const renderer = { uploadTexture() {}, releaseTexture() {}, createBillboardBatch: (a, r, size) => ({ size, origin: null, bounds: new Float32Array([0, 0, 0, quadHalfDiagonal(size)]) }), destroyBillboardBatch() {} };
  const figure = () => { const rgba = new Uint8Array(PAPERDOLL_W * PAPERDOLL_H * 4); for (let y = 10; y < 170; y++) for (let x = 30; x < 80; x++) rgba[(y * PAPERDOLL_W + x) * 4 + 3] = 255; return { width: PAPERDOLL_W, height: PAPERDOLL_H, rgba }; };
  const rp = new RemotePlayers({ renderer, deps: {}, compose: async () => figure() });
  const doll = { id: 'd1', name: 'd1', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z: -10, yaw: 0, pitch: 0, mv: 0 } };
  rp.sync([doll], undefined, {}); await settle(); rp.sync([doll], undefined, {});
  const [b] = rp.batches(); const own = { ...b.size }; const ownH = rp._shown[0].height;
  rp.sync([doll], undefined, { grow: () => 9 });
  assert.ok(near(b.size.w, own.w * 9) && near(b.size.h, own.h * 9) && near(b.bounds[3], quadHalfDiagonal(b.size), 1e-5) && b.noShadow === true, 'the doll grown, its reach with it, no shadow');
  assert.ok(near(rp._shown[0].height, ownH * 9), 'and its name over it');
  rp.sync([doll], undefined, {});
  assert.ok(near(b.size.h, own.h) && b.noShadow === false, 'off the view, its own');
  // the body: a rig that records what it is asked to draw (mwbody1's)
  const draws = []; let mode = 'first', stepped = 0;
  const rig = { attach() {}, async build() { return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { mode = m; return true; },
    thirdActive: () => mode === 'third' && stepped > 0, update() { stepped++; }, drawThird(c, p) { draws.push(p); return true; }, unload() {} };
  const pb = new PeerBodies({ renderer: {}, createRig: () => rig, buildOpts: (l) => ({ race: l.race }), now: () => 1000 });
  const body = { id: 'b1', name: 'b1', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z: -10, yaw: 0, pitch: 0, mv: 0 } };
  const toScene = (p) => [p.x, p.y, p.z];
  pb.sync([body], toScene, 0.016, [0, 0, -10]); await settle(); pb.sync([body], toScene, 0.02, [0, 0, -10]);
  const V = { proj: [1], view: [2], eye: [0, 0, 0] };
  assert.equal(pb.draw({}, V), 1);
  assert.equal(draws.at(-1).grow, 1); assert.equal(draws.at(-1).up, null, 'on the ground: its own size, upright');
  assert.ok(near(pb.heightOf('b1'), CAPSULE_HEIGHT));
  const up = [0, 0.9, 0.43];
  pb.draw({}, { ...V, grow: () => 8, up });
  assert.equal(draws.at(-1).grow, 8, 'drawn eight times about its feet'); assert.equal(draws.at(-1).up, up, 'leaned as the traveller\'s own (AUDIT OW3 J6)');
  assert.ok(near(pb.heightOf('b1'), CAPSULE_HEIGHT * 8), 'its head for its name');
  // the host: one law, the traveller's own, at each peer's feet, handed to every layer under the view and to none off it
  const w = rd('src/scenes/world.js');
  assert.match(w, /const peerGrow = \(f\) => \{ const e = travelView\?\.active \? travelView\.eye : null; return e \? tvOwnGrow\(Math\.hypot\(e\[0\] - f\[0\], e\[1\] - f\[1\], e\[2\] - f\[2\]\)\) : 1; \};/);
  assert.match(w, /const tvGrow = travelView\?\.active \? peerGrow : null;/);
  for (const re of [/peerRiders\.sync\(seen, [^\n]*, grow: tvGrow \}\);/, /peerWalkers\.sync\(seen, [^\n]*, grow: tvGrow \}\);/, /remotePlayers\.sync\(visiblePeers, [^\n]*, grow: tvGrow(?:, room: drawable)? \}\);/]) assert.match(w, re);   // PIN MOVED (AUDIT PEER-RANGE + HALO-THIN A L1/L6): the room's whole list handed after the grow
  assert.match(w, /drawPeerBodies\(proj, view, mwv\.eye, tvf \? tvFace : null\);/, 'the bodies take the view\'s face (its lean)');
  assert.match(rd('src/net/peer/peerBodies.js'), /if \(this\._planesOk\) \{\n {8}if \(!this\._sees\(b, 0, g\)\) \{[\s\S]{0,800}?\n {10}continue;\n {8}\}/, 'and are culled by their grown reach');   // PIN MOVED (AUDIT MWNPC16-18 B F2, Morrowind-NPCs.md section 27): the unseen branch casts only a body posed for its actor, and says why   // PIN MOVED (MWNPC16): an NPC lane's body out of the view casts before it is passed over
});
