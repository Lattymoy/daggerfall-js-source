// PEER-CADENCE (2026-09-22, Mac: "look for ways to improve online
// performance"): A PEER'S BODY IS RE-POSED ON A CADENCE THE EYE CAN
// SEE. Every standing peer body was skinned, re-uploaded and
// particle-stepped every frame (PERF-RIG1: ~0.3 ms a body at 3,000
// vertices, eight bodies at once) against a pose that arrives at
// POSE_HZ and a sprite quantised to MW_ARM_PIXEL blocks. The rig's
// update takes `pose: false` now - the clocks advance, the skin waits -
// and PeerBodies decides which frames by distance, staggered by body,
// the first frame of a standing body always posed, the skipped frames'
// dt banked for the particle step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PeerBodies, POSE_CADENCE, poseCadenceFor, BODY_RANGE } from '../src/net/peerBodies.js';
import { createFpArm } from '../src/combat/fpArm.js';
import { fixtureBodyDeps, countingRenderer } from './fixtures/mw/bodyRig.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await flush(); };
const toScene = (p) => [p.x, p.y, p.z];
const peer = (id, z) => ({ id, name: id, told: true, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0 } });

/** a rig that records what each step asked of it */
function recordingRig() {
  return () => {
    const r = { mode: 'first', steps: [],
      attach(renderer, cam) { r.cam = cam; },
      async build() { await flush(); return { ok: true }; },
      canThirdPerson: () => true, raceHeightScale: () => 1,
      setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.steps.length > 0,
      update(dt, opts) { r.steps.push({ dt, ...(opts ?? {}) }); },
      drawThird() { return r.thirdActive(); },
      unload() {},
    };
    rigs.push(r);
    return r;
  };
}
let rigs = [];
async function stand(peers) {
  rigs = [];
  const pb = new PeerBodies({ renderer: {}, createRig: recordingRig(), buildOpts: () => ({}), now: () => 1000 });
  for (let i = 0; i < 20 && !peers.every((p) => pb.has(p.id)); i++) { pb.sync(peers, toScene, 1 / 60, [0, 0, 0]); await settle(); }
  for (const p of peers) assert.equal(pb.has(p.id), true, `${p.id} stands`);
  return pb;
}
const poses = (r) => r.steps.map((s) => (s.pose === false ? '.' : 'P')).join('');

test('PEER-CADENCE: the cadence by distance - every frame within 10 m, every second frame to 25 m, every third beyond, the edge inclusive', () => {
  assert.deepEqual(POSE_CADENCE, [[10, 1], [25, 2], [Infinity, 3]]);
  assert.equal(poseCadenceFor(0), 1); assert.equal(poseCadenceFor(10 * 10), 1, 'ten metres exactly is the near band');
  assert.equal(poseCadenceFor(10.01 * 10.01), 2); assert.equal(poseCadenceFor(25 * 25), 2);
  assert.equal(poseCadenceFor(25.01 * 25.01), 3); assert.equal(poseCadenceFor(BODY_RANGE * BODY_RANGE), 3, 'to the range\'s edge');
  assert.equal(poseCadenceFor(1e12), 3, 'and past it (the rig sleeps there anyway)');
  // the far band is still twice the wire's rate at 60 fps, and under the sprite's block
  assert.ok(60 / POSE_CADENCE.at(-1)[1] >= 20);
});

test('PEER-CADENCE: PeerBodies steps the rig EVERY frame and poses it on the cadence - near every frame, far one in three, the first step of a standing body a pose, the yaw and the arm still fed on the skipped frames', async () => {
  const near = peer('near', -5), far = peer('far', -40);
  const pb = await stand([near, far]);
  const [rn, rf] = rigs;
  rn.steps.length = 0; rf.steps.length = 0;
  for (let i = 0; i < 12; i++) pb.sync([near, far], toScene, 1 / 60, [0, 0, 0]);
  assert.equal(rn.steps.length, 12, 'the near rig stepped every frame'); assert.equal(rf.steps.length, 12, 'and the far one - the clocks run');
  assert.equal(poses(rn), 'PPPPPPPPPPPP', 'within 10 m: the skin every frame');
  assert.equal((poses(rf).match(/P/g) ?? []).length, 4, 'beyond 25 m: one frame in three');
  assert.match(poses(rf), /^(P\.\.|\.P\.|\.\.P){4}$/, 'evenly, not bunched');
  for (const s of rf.steps) assert.equal(s.dt, 1 / 60, 'the clip dt is the frame\'s on every step, posed or not');
  // the FIRST step of a body that has just stood poses, whatever its phase: thirdActive waits on the first upload
  rigs = [];
  const pb2 = new PeerBodies({ renderer: {}, createRig: recordingRig(), buildOpts: () => ({}), now: () => 1000 });
  const trio = [peer('a', -40), peer('b', -40), peer('c', -40)];
  pb2.sync(trio, toScene, 1 / 60, [0, 0, 0]);
  await settle(20);   // all three built (one at a time)
  pb2.sync(trio, toScene, 1 / 60, [0, 0, 0]);
  for (const r of rigs) assert.equal(r.steps.at(-1).pose, true, 'the first step of a standing body is a pose, phase or no phase');
});

test('PEER-CADENCE: bodies on the same cadence pose on DIFFERENT frames (the phase), and a body walking in from the far band tightens its cadence live', async () => {
  const trio = [peer('a', -40), peer('b', -40), peer('c', -40)];
  const pb = await stand(trio);
  for (const r of rigs) r.steps.length = 0;
  for (let i = 0; i < 9; i++) pb.sync(trio, toScene, 1 / 60, [0, 0, 0]);
  const frames = rigs.map((r) => r.steps.findIndex((s) => s.pose !== false));
  assert.equal(new Set(frames).size, 3, `three bodies at 40 m skin on three different frames (${frames})`);
  // now b walks to 5 m: every frame
  trio[1].shown = { ...trio[1].shown, z: -5 };
  rigs[1].steps.length = 0;
  for (let i = 0; i < 6; i++) pb.sync(trio, toScene, 1 / 60, [0, 0, 0]);
  assert.equal(poses(rigs[1]), 'PPPPPP', 'within 10 m: every frame again');
});

test('PEER-CADENCE: the skipped frames\' dt is BANKED for the particle step - the posing frame hands the rig the sum, then starts over', async () => {
  const far = peer('far', -40);
  const pb = await stand([far]);
  const r = rigs[0];
  r.steps.length = 0;
  const dts = [0.016, 0.02, 0.018, 0.016, 0.017, 0.016, 0.02, 0.016, 0.019];
  for (const dt of dts) pb.sync([far], toScene, dt, [0, 0, 0]);
  const posed = r.steps.map((s, i) => ({ ...s, i })).filter((s) => s.pose !== false);
  assert.ok(posed.length >= 2);
  let from = 0;
  for (const s of posed) {
    const bank = dts.slice(from, s.i + 1).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(s.effectsDt - bank) < 1e-12, `frame ${s.i}: effectsDt ${s.effectsDt} is the dt since the last pose (${bank})`);
    from = s.i + 1;
  }
});

test('PEER-CADENCE: the REAL rig - `pose: false` advances the clocks and uploads NOTHING (no skin, no mesh, the frame count still), a pose-false step before the first pose does not throw, and the next posing step lands', async () => {
  const renderer = countingRenderer();
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } }));
  const res = await arm.build({ race: 'fprace', deps: fixtureBodyDeps() });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  assert.equal(arm.setViewMode('third'), true);
  assert.equal(arm.thirdActive(), false, 'no mesh until the first upload');
  arm.update(1 / 60, { pose: false });
  assert.equal(renderer.c.meshes + renderer.c.uploads, 0, 'a clocks-only step before any pose mints and uploads nothing');
  assert.equal(arm.frames, 0); assert.equal(arm.thirdActive(), false);
  arm.update(1 / 60);
  assert.equal(renderer.c.meshes, 1, 'the first pose mints the third-person mesh'); assert.equal(arm.frames, 1); assert.equal(arm.thirdActive(), true);
  const uploads = renderer.c.uploads;
  for (let i = 0; i < 5; i++) arm.update(1 / 60, { pose: false });
  assert.equal(renderer.c.uploads, uploads, 'five clocks-only steps: no upload');
  assert.equal(arm.frames, 1, 'and no posed frame counted');
  assert.equal(arm.thirdActive(), true, 'the body still stands on last frame\'s skin');
  assert.equal(arm.drawThird({ clientWidth: 100, clientHeight: 100 }, { proj: new Float64Array(16), view: new Float64Array(16), eye: [0, 0, 0], feet: [0, 0, -5], yaw: 0 }), true, 'and draws');
  arm.update(1 / 60, { pose: true, effectsDt: 6 / 60 });
  assert.equal(renderer.c.uploads, uploads + 1, 'the posing step uploads once'); assert.equal(arm.frames, 2);
  arm.update(1 / 60);
  assert.equal(renderer.c.uploads, uploads + 2, 'the default is a pose - every caller that never heard of the flag is as it was');
  arm.unload();
});

test('PEER-CADENCE: the REAL rig - the CLOCKS ADVANCE on a skipped frame: a pose after six clocks-only steps is bit-identical to a pose after six posing steps, and neither is the first', async () => {
  const drive = async (skip) => {
    const snaps = [];
    const renderer = countingRenderer();
    renderer.updateCharacterMesh = (mesh, packed) => { renderer.c.uploads++; snaps.push(Float32Array.from(packed)); };
    const arm = createFpArm();
    arm.attach(renderer, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } }));
    const res = await arm.build({ race: 'fprace', deps: fixtureBodyDeps() });
    assert.equal(res.ok, true);
    arm.setViewMode('third');
    arm.update(0.05); arm.update(0.05);   // the mesh minted, then a first upload to compare against
    for (let i = 0; i < 6; i++) arm.update(0.05, { pose: !skip });
    arm.update(0.05);
    arm.unload();
    return snaps;
  };
  const skipped = await drive(true), posed = await drive(false);
  assert.equal(skipped.length, 2, 'the first upload and the last: six skipped frames uploaded nothing');
  assert.equal(posed.length, 8, 'every posing frame uploaded');
  assert.deepEqual(skipped.at(-1), posed.at(-1), 'the same clock, the same skin - the skipped frames advanced the clips');
  assert.notDeepEqual(skipped.at(-1), skipped[0], 'and the clock moved (the fixture idle animates)');
});

test('PEER-CADENCE: by source - the clips advance ABOVE the pose gate, the particle step takes the banked dt, the hidden loop runs on a skipped frame too, and the first-person branch takes no flag', () => {
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /update\(dt, \{ pose = true, effectsDt = dt \} = \{\}\) \{/, 'the flag and the bank, defaulted to the old behaviour');
  const upd = src.slice(src.indexOf('update(dt, { pose = true, effectsDt = dt } = {}) {'));
  const third = upd.indexOf("if (viewMode === 'third') {");
  const gate = upd.indexOf('if (pose) {');
  assert.ok(gate > third && third > 0, 'the pose gate is inside the third-person branch');
  for (const clip of ['advanceClip(actionState', 'advanceClip(movementState', 'advanceClip(jumpState', 'advanceClip(idleState', 'advanceClip(torchState']) {
    const at = upd.indexOf(clip); assert.ok(at > 0 && at < third, `${clip} advances before the branch, so before the gate`);
  }
  assert.match(upd, /if \(pose\) \{\s*poseAssembly\(t\.arm, \{[\s\S]*?\}\);\s*uploadThirdMesh\(t\);[\s\S]*?stepRigEffects\(t\.arm, \{ dt: effectsDt,[\s\S]*?frames\+\+;[^\n]*\n\s*\}\s*if \(!thirdMesh\) return;[^\n]*\n[\s\S]*?for \(const r of thirdMesh\.ranges\) \{/, 'skin, upload, particles on the banked dt and the frame count inside the gate; the hidden loop outside it, guarded for a mesh that was never minted');
  const fp = upd.slice(upd.indexOf('const fBase = poseSource'), upd.indexOf('frames++', upd.indexOf('const fBase = poseSource')));
  assert.doesNotMatch(fp, /if \(pose\)|if \(!pose\)|\bpose \?|effectsDt/, 'the first-person branch never reads the flag or the bank');
  const pb = rd('src/net/peerBodies.js');
  assert.match(pb, /export const POSE_CADENCE = \[\[10, 1\], \[25, 2\], \[Infinity, 3\]\];/);
  assert.match(pb, /const pose = !b\.posed \|\| \(b\.tick \+ b\.phase\) % poseCadenceFor\(b\.d2\) === 0;\s*b\.tick\+\+;/, 'the first step poses; then the phase-staggered cadence at this frame\'s distance');
  assert.match(pb, /phase: this\._phase\+\+, bank: 0 \}/, 'a new body takes the next phase');
});
