// SPRITE-FACE — AN AURA ON A SPRITE FACES AS ITS PICTURE DOES (2026-10-05).
//
// Mac: "For the wing aura we implemented for developers. The sprite rotation on character input is a little finicky and
// make the aura misallign". An Eye of the Beholder sprite is drawn from one of eight pictures, 45 degrees apart about the
// line from the figure to the eye (eotbBillboard.js orientationFor), and a change of facing reaches the picture only when
// the mod's delayed repaint lands (UpdateBillboardDelayed, DELAYED_FRAMES; UpdateOrientation's ORIENTATION_TIME gate).
// The Seraph Wings (and the Shadow Cloak) were hung on the facing the walk WANTS - `lastMoveDirection`, a peer's pose -
// which turns at once and smoothly: on a key press the wings swung round before the picture did, and at rest they stood
// up to half a picture (22.5 degrees) off it, sliding as the camera went round while the picture held, then the picture
// jumped. They are hung on the facing the PICTURE shows now (portrayedYaw - orientationFor run backwards), mine and a
// peer's, in the saddle too; and their swing reads the body's own turning (`turn`), so a picture changing is no turn.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { portrayedYaw, orientationFor, signedAngleY, ORIENTATIONS, ANGLE_PER_ORIENTATION, DELAYED_FRAMES } from '../src/player/eotbBillboard.js';
import { createEotbBody } from '../src/player/eotbBody.js';
import { createPeerWalkers, createPeerRiders, createEotbArt } from '../src/net/peerRiders.js';
import { auraSpritePosed, auraCapeStep, auraMotionStep, auraSpriteBones, CLOAK_REST_POSE } from '../src/render/auraRing.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dir = (y) => [Math.sin(y), 0, Math.cos(y)];
const bearing = (v) => Math.atan2(v[0], v[2]);
const DEG = Math.PI / 180;

test('SPRITE-FACE the law: the facing a picture portrays is orientationFor run backwards - a figure facing it is drawn in that picture, at the middle of its bucket, from every line of sight; any facing in a bucket portrays that bucket\'s middle, never more than half a picture off; no line of sight, no facing (mutants: the sign turned, the step not the picture\'s, the bearing not the eye\'s)', () => {
  assert.equal(ORIENTATIONS * ANGLE_PER_ORIENTATION, 360);
  for (let o = 0; o < ORIENTATIONS; o++) {
    for (const a of [0, 0.3, 1.7, -2.9, Math.PI, -0.01]) {
      const tc = [Math.sin(a) * 3, 0, Math.cos(a) * 3];
      const y = portrayedYaw(o, tc);
      assert.ok(y > -Math.PI - 1e-12 && y <= Math.PI + 1e-12, `a yaw in (-pi, pi]: ${y}`);
      assert.equal(orientationFor(dir(y), tc), o, `picture ${o} seen along ${a.toFixed(2)}: a figure facing ${y.toFixed(3)} is drawn in it`);
      assert.ok(Math.abs(signedAngleY(tc, dir(y)) + o * ANGLE_PER_ORIENTATION) % 360 < 1e-9 || Math.abs(Math.abs(signedAngleY(tc, dir(y)) + o * ANGLE_PER_ORIENTATION) - 360) < 1e-9, 'at the middle of the bucket');
    }
  }
  // any facing at all portrays its bucket's middle - within half a picture
  for (let i = 0; i < 400; i++) {
    const f = (i * 0.731) % (2 * Math.PI) - Math.PI, a = (i * 1.913) % (2 * Math.PI);
    const tc = [Math.sin(a), 0, Math.cos(a)];
    const p = portrayedYaw(orientationFor(dir(f), tc), tc);
    assert.ok(Math.abs(wrap(p - f)) <= 22.5 * DEG + 1e-9, `facing ${f.toFixed(3)} seen along ${a.toFixed(3)}: portrayed ${p.toFixed(3)}`);
  }
  // the eye's own bearing turned back by the picture's angle
  assert.ok(Math.abs(wrap(portrayedYaw(0, [0, 0, 5]) - 0)) < 1e-12, 'its front to an eye due ahead: facing it');
  assert.ok(Math.abs(wrap(portrayedYaw(4, [0, 0, 5]) - Math.PI)) < 1e-12, 'its back: facing away');
  assert.ok(Math.abs(wrap(portrayedYaw(2, [0, 0, 5]) + Math.PI / 2)) < 1e-12, 'picture 2: turned a quarter, the way orientationFor reads it');
  assert.equal(portrayedYaw(3, [0, 0, 0]), null, 'no line of sight (the first-person billboard on the camera): no facing');
  assert.equal(portrayedYaw(2.5, [0, 0, 1]), null, 'no such picture');
});

// ── MY OWN BODY ─────────────────────────────────────────────────────

const fakeRenderer = () => ({ batches: [], uploadTexture() {}, createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; }, destroyBillboardBatch() {}, drawBillboards() {} });
async function standingBody() {
  const b = createEotbBody({ count: () => 3035, urlFor: (k) => `/art/${k}.png`, decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }) });
  b.attach(fakeRenderer(), () => ({}));
  await new Promise((res) => setTimeout(res, 5));
  b.toggle(true, false);
  return b;
}
const FEET = [0, 2, 0];
/** One frame: the body ticked and drawn for the eye at `cam` about the feet, the view's yaw `yaw`, moving `motion`. */
const frame = (b, { cam, yaw, motion = { forward: 0, strafe: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, riding = false }) => {
  b.tick(1 / 60, { motion: { ...motion, riding }, riding, feet: FEET, yaw, cameraPos: cam });
  b.draw(null, { eye: cam, feet: FEET, yaw });
  return b;
};
const camAt = (bear, r = 2.5) => [FEET[0] + Math.sin(bear) * r, FEET[1] + 1.5, FEET[2] + Math.cos(bear) * r];
/** The facing the picture shown portrays to this eye - what the wings must face. */
const pictureYaw = (b, cam) => portrayedYaw(b.state().shown.orientation, [cam[0] - FEET[0], 0, cam[2] - FEET[2]]);

test('SPRITE-FACE my body: every frame drawn, facing().yaw is the picture SHOWN - the repaint that has landed - and facing().turn the walk\'s; a key that turns the walk turns `turn` at once and `yaw` only when the picture changes, never before (the mod\'s delayed repaint); stood still, the eye going round turns the picture a bucket at a time and the facing with it, the walk\'s facing still; in the saddle a facing and no figure; in first person neither (mutants: the walk\'s facing hung, the facing read before the repaint, the eye of another frame, the saddle\'s facing dropped)', async () => {
  const b = await standingBody();
  // FACING NOWHERE YET (no walk, no placing): its front to the eye - and the body turns as that picture faces, the swing's
  // frame the picture's (WINGS-FIT's law, held by the picture's own facing)
  const front = camAt(2.2);
  for (let i = 0; i < 12; i++) frame(b, { cam: front, yaw: 2.2 + Math.PI });
  await new Promise((res) => setTimeout(res, 2));
  frame(b, { cam: front, yaw: 2.2 + Math.PI });
  assert.equal(b.state().shown.orientation, 0, 'facing nowhere: its front to the eye');
  assert.ok(Math.abs(wrap(b.facing().yaw - 2.2)) < 1e-9 && Math.abs(wrap(b.facing().turn - b.facing().yaw)) < 1e-12, `facing nowhere: facing the eye, and turning as its picture faces (${b.facing().yaw}, ${b.facing().turn})`);
  // walking forward away from a camera behind: its back to the eye
  const yaw = 0.2, behind = camAt(yaw + Math.PI);
  for (let i = 0; i < 30; i++) frame(b, { cam: behind, yaw, motion: { forward: 1, strafe: 0, standing: false, speed: 3, grounded: true, height: 1.8 } });
  await new Promise((res) => setTimeout(res, 2));
  frame(b, { cam: behind, yaw, motion: { forward: 1, strafe: 0, standing: false, speed: 3, grounded: true, height: 1.8 } });
  assert.equal(b.state().shown.orientation, 4, 'walking away: its back');
  assert.ok(Math.abs(wrap(b.facing().yaw - yaw)) < 1e-9 && Math.abs(wrap(b.facing().turn - yaw)) < 1e-9, 'the picture and the walk agree: the camera straight behind');
  // A KEY: strafe right - the walk turns a quarter at the next orientation pass; the picture DELAYED_FRAMES later
  const strafe = { forward: 0, strafe: 1, standing: false, speed: 3, grounded: true, height: 1.8 };
  let lagged = 0, frames = 0, turnedFirst = false;
  for (let i = 0; i < 40; i++) {
    frame(b, { cam: behind, yaw, motion: strafe });
    const f = b.facing(), want = pictureYaw(b, behind), walk = bearing(b.state().lastMoveDirection);
    assert.ok(Math.abs(wrap(f.yaw - want)) < 1e-9, `frame ${i}: the wings face the picture shown (${f.yaw.toFixed(3)}, the picture ${want.toFixed(3)})`);
    assert.ok(Math.abs(wrap(f.turn - walk)) < 1e-9, `frame ${i}: the swing turns by the walk`);
    if (Math.abs(wrap(f.turn - f.yaw)) > 1e-6) { lagged++; if (Math.abs(wrap(f.yaw - yaw)) < 1e-9) turnedFirst = true; }
    frames++;
  }
  assert.ok(turnedFirst && lagged >= DELAYED_FRAMES - 1, `the walk turned first and the picture after it - frames the wings waited for the picture (${lagged} of ${frames})`);
  assert.ok(Math.abs(wrap(b.facing().yaw - (yaw + Math.PI / 2))) < 1e-9, 'and then side on, picture and walk together');
  // STOOD STILL, THE EYE GOES ROUND: the walk's facing holds, the picture turns a bucket at a time - the facing with it
  const walk = b.facing().turn;
  let changes = 0, prev = null;
  for (let k = 0; k <= 36; k++) {
    const cam = camAt(yaw + Math.PI + k * 5 * DEG);
    // every frame the picture's facing - while the picture still lags the eye (the gate and the delayed repaint) too, which
    // is when the walk's facing and the picture part furthest
    for (let i = 0; i < 20; i++) {
      frame(b, { cam, yaw: yaw + k * 5 * DEG });
      assert.ok(Math.abs(wrap(b.facing().yaw - pictureYaw(b, cam))) < 1e-9, `the eye ${k * 5} degrees round, frame ${i}: the picture's facing`);
    }
    const f = b.facing();
    assert.ok(Math.abs(wrap(f.turn - walk)) < 1e-9, 'the walk\'s facing still');
    assert.ok(Math.abs(wrap(f.yaw - walk)) <= 22.5 * DEG + 1e-9, 'the repaint landed: never more than half a picture off the walk');
    if (prev !== null && b.state().shown.orientation !== prev) changes++;
    prev = b.state().shown.orientation;
  }
  assert.ok(changes >= 3, `the picture changed as the eye went round (${changes} times) - and the wings with it, no slide`);
  // IN THE SADDLE: the horse's picture faces as the rider's does - a facing, no figure (no shoulders on it)
  for (let i = 0; i < 30; i++) frame(b, { cam: behind, yaw, riding: true, motion: { forward: 1, strafe: 0, standing: false, speed: 6, grounded: true, height: 1.8 } });
  await new Promise((res) => setTimeout(res, 2));
  frame(b, { cam: behind, yaw, riding: true, motion: { forward: 1, strafe: 0, standing: false, speed: 6, grounded: true, height: 1.8 } });
  assert.equal(b.figure(), null, 'in the saddle: no figure');
  assert.ok(b.facing() && Math.abs(wrap(b.facing().yaw - pictureYaw(b, behind))) < 1e-9, 'but a facing - the picture\'s');
  // FIRST PERSON: the billboard on the camera faces no bearing
  b.toggle(true, true);
  for (let i = 0; i < 12; i++) frame(b, { cam: behind, yaw });
  assert.equal(b.facing(), null, 'first person: no facing');
  b.toggle(false, false);
  assert.equal(b.draw(null, { eye: behind, feet: FEET, yaw }), false);
  assert.equal(b.facing(), null, 'nothing drawn: none kept from the last frame');
});

// ── A PEER'S ────────────────────────────────────────────────────────

test('SPRITE-FACE a peer\'s: a walker, a beast and a rider each report the facing their picture is drawn in about my eye - the eight-way view, not the pose\'s smooth facing, which is `turn`; in the saddle a facing and no figure; none undrawn or with no eye (mutants: the pose\'s facing hung, the view of another eye)', async () => {
  const renderer = { uploadTexture() {}, createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: null }), destroyBillboardBatch() {} };
  const art = createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }) });
  const toScene = (q) => [q.x, q.y, q.z];
  const facing = 0.31;   // 17.8 degrees off the eye's line: inside a bucket, off its middle
  const pose = (o = {}) => ({ x: 4, y: 0, z: 9, yaw: facing, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });
  const eye = [4, 1, 20];
  const walkers = createPeerWalkers({ art }), riders = createPeerRiders({ art });
  const peers = [{ id: 'w', look: { eo: 0 }, shown: pose() }, { id: 'b', look: { eo: 0 }, shown: pose({ wb: 1 }) }, { id: 'h', look: { eo: 0 }, shown: pose({ rd: 1 }) }];
  assert.equal(walkers.faceOf('w'), null, 'nothing drawn yet: no facing');
  for (let i = 0; i < 2; i++) { walkers.sync(peers, toScene, { eye, dt: 0.01 }); riders.sync(peers, toScene, { eye, dt: 0.01 }); await new Promise((res) => setTimeout(res, 5)); }
  const tc = [eye[0] - 4, 0, eye[2] - 9];
  const picture = portrayedYaw(orientationFor(dir(facing), tc), tc);
  assert.ok(Math.abs(wrap(picture - facing)) > 5 * DEG, 'the case: the pose off its picture\'s middle');
  for (const [who, layer] of [['w', walkers], ['b', riders], ['h', riders]]) {
    const f = layer.faceOf(who);
    assert.ok(f && Math.abs(wrap(f.yaw - picture)) < 1e-9, `${who}: facing as its picture is drawn (${f?.yaw?.toFixed(3)}, the picture ${picture.toFixed(3)})`);
    assert.ok(Math.abs(wrap(f.turn - facing)) < 1e-12, `${who}: turning by the pose`);
  }
  assert.ok(walkers.figureOf('w') && riders.figureOf('b'), 'a walker and a beast: figures too');
  assert.equal(riders.figureOf('h'), null, 'a rider: no figure (the horse\'s frame) - but a facing, above');
  assert.equal(walkers.faceOf('nobody'), null); assert.equal(riders.faceOf('nobody'), null);
  // my eye goes round: their picture changes view, and the facing with it
  const eye2 = [4 + 11 * Math.sin(1.2), 1, 9 + 11 * Math.cos(1.2)];
  walkers.sync(peers, toScene, { eye: eye2, dt: 0.01 });
  const tc2 = [eye2[0] - 4, 0, eye2[2] - 9];
  assert.ok(Math.abs(wrap(walkers.faceOf('w').yaw - portrayedYaw(orientationFor(dir(facing), tc2), tc2))) < 1e-9, 'seen from elsewhere: that view\'s facing');
  // no eye: no line of sight to portray along
  walkers.sync(peers, toScene, { eye: null, dt: 0.01 });
  assert.equal(walkers.faceOf('w'), null, 'no eye: no facing');
});

// ── THE AURA'S SIDE ─────────────────────────────────────────────────

test('SPRITE-FACE the aura\'s side: a sprite wearer is posed on its picture\'s facing and keeps its body\'s turning beside it - with a figure its shoulders, without one (a rider) the rest pose, faced all the same; a body drawn as it turns keeps none; the swing reads the turning, so a picture changing a whole view is no turn - the swing the same as with no change - where the facing it is drawn on would have read one (mutants: the turning not kept, the swing reading the picture)', () => {
  const fig = { base: 0, mpp: 0.019, beast: false };
  const w = { at: [1, 0, 2], yaw: 0.31 };
  const posed = auraSpritePosed(w, fig, { yaw: Math.PI / 4, turn: 0.31 });
  assert.deepEqual([posed.yaw, posed.turn, posed.feet], [Math.PI / 4, 0.31, w.at], 'hung on the picture, turning by the pose, at its feet');
  assert.deepEqual(posed.bones, auraSpriteBones(fig), 'its shoulders off the figure');
  const rider = auraSpritePosed(w, null, { yaw: 1.2, turn: 1.1 });
  assert.deepEqual([rider.yaw, rider.turn, rider.bones], [1.2, 1.1, null], 'a rider: faced, no bones');
  assert.equal(auraSpritePosed(w, null, null), null, 'neither: none');
  assert.deepEqual([auraSpritePosed(w, fig).yaw, auraSpritePosed(w, fig).turn], [0.31, null], 'a figure with no facing: the wearer\'s own, as before');
  const ww = { at: [0, 0, 0] };
  auraCapeStep(ww, rider, 1);
  assert.deepEqual([ww.yaw, ww.turnYaw, ww.cape === CLOAK_REST_POSE], [1.2, 1.1, true], 'stepped: faced as drawn, the turning kept, the rest pose');
  auraCapeStep(ww, { feet: [0, 0, 0], yaw: 0.5, bones: null }, 1);
  assert.equal(ww.turnYaw, null, 'a body drawn as it turns keeps no turning of its own');
  // the swing: walking steadily, the picture snapping a view (45 degrees) back and forth, the turning steady
  const run = (snaps, withTurn) => {
    const v = { at: [0, 0, 0], yaw: 0, turnYaw: withTurn ? 0 : null };
    for (let i = 0; i <= 90; i++) {
      v.at[2] = i * 0.05;   // 3 m/s along +z
      v.yaw = snaps && (i % 20) >= 10 ? Math.PI / 4 : 0;
      auraMotionStep(v, i / 60);
    }
    return v.swing;
  };
  const steady = run(false, true), snapped = run(true, true);
  for (const k of ['x', 'z', 'lift', 'twist']) assert.ok(Math.abs(steady[k] - snapped[k]) < 1e-12, `${k}: the picture changing is no turn (${steady[k]} vs ${snapped[k]})`);
  const unkept = run(true, false);
  assert.ok(Math.abs(unkept.twist - steady.twist) > 0.05 || Math.abs(unkept.x - steady.x) > 0.02, `read off the picture it would have twisted or slid (${JSON.stringify(unkept)})`);
});

test('SPRITE-FACE the wiring: the view keeps the sprite\'s facing beside its figure; the host hangs mine and each peer\'s on it, in the gather and the draw, and swings it by the turning; the layers hand it; the body hands it (read as code)', () => {
  const mv = rd('src/player/mwView.js');
  assert.match(mv, /spriteFigure = drawn \? eotbFigure\(\) : null; spriteFacing = drawn \? eotbFacing\(\) : null; return drawn;/);
  assert.match(mv, /export function mwViewSpriteFacing\(\) \{ return eotbLane\(\) \? spriteFacing : null; \}/);
  const eb = rd('src/player/eotbBody.js');
  assert.match(eb, /const seen = FP \? null : portrayedYaw\(shown\.orientation, \[cam\.pos\[0\] - cam\.feet\[0\], 0, cam\.pos\[2\] - cam\.feet\[2\]\]\);\n\s+facingDrawn = seen === null \? null : \{ yaw: seen, turn: turnYaw\(\) \?\? seen \};/, 'the picture shown, about the eye of the frame it was drawn in');
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes('_auraSelf.yaw = mwViewSpriteFacing()?.yaw ?? player.bodyYawFor(cam.yaw);'), 'the gather: mine as my picture faces');
  assert.ok(w.includes('yaw: mwViewSpriteFacing()?.yaw ?? player.bodyYawFor(cam.yaw), turn: mwViewSpriteFacing()?.turn,'), 'the draw: mine, and my turning');
  assert.ok(w.includes('auraSpritePosed(w, peerWalkers?.figureOf(w.id) ?? peerRiders?.figureOf?.(w.id), peerWalkers?.faceOf?.(w.id) ?? peerRiders?.faceOf?.(w.id))'), 'a peer\'s: their picture\'s');
  assert.ok(w.includes('w.yaw = (peerWalkers?.faceOf?.(d.id) ?? peerRiders?.faceOf?.(d.id))?.yaw ?? peerBodyYaw(d.shown) ?? 0;'), 'and gathered so - the wings\' light stands where the wings do');
  const pr = rd('src/net/peerRiders.js');
  assert.equal((pr.match(/faceDrawn\(r, view, yaw, feet, eye\);/g) ?? []).length, 2, 'both layers record it as they draw');
});
