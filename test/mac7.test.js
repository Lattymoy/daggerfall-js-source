// MAC7 (Mac, 2026-09-12: "Bug. 1. Morrowind doesnt show the player
// holding their weapon/attacking. It shows the full sprite and
// animations but no weapons"). #1: THE PEER'S WEAPON AND SWING. A
// peer's Morrowind body (MWBODY1) was built with the weapon the look
// carries, but the rig's weapon is sheathed until someone calls
// setSheathed(false) and swings only on attack(strike) - the doors
// weaponRig opens for the player's own rig - and nothing of either
// travelled: the wire's pose was position, look angles and a move bit.
// THE ARM EXECUTES: the pose carries the drawn flag (wd), the swing
// count (an) and the swing's WeaponStates index (as, POSE_STRIKES) at
// both ends, clamped, and a pose from before them reads sheathed and
// unswung; a draw or a swing is a change the session sends at once;
// the eased pose carries them whole; the rig counts every strike it
// starts before its own Morrowind gate and the host reads it into the
// pose; a peer's body draws while the sender's is drawn, swings once
// per count and never the count it was born with, and releases every
// frame as the player's own rig does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validPose, parseClient, POSE_STRIKES } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { poseChanged, lerpPose } from '../src/net/online.js';
import { STATE_INDEX } from '../src/combat/fpsWeapon.js';
import { PeerBodies } from '../src/net/peerBodies.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('MAC7 #1: the wire - POSE_STRIKES is DFU\'s WeaponStates order (fpsWeapon\'s own index), one home at both ends; the pose carries wd, an and as clamped, a pose from before them reads sheathed and unswung; a draw or a swing is a change; the eased pose carries them whole', () => {
  for (const [name, i] of Object.entries(STATE_INDEX)) assert.equal(POSE_STRIKES[i], name, `${name} at ${i}: the WeaponStates order`);
  assert.equal(POSE_STRIKES.length, Object.keys(STATE_INDEX).length);
  assert.equal(relay.POSE_STRIKES, POSE_STRIKES, 'the same object at both ends');
  const base = { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0.1 };
  assert.deepEqual(validPose({ ...base, mv: 1 }), { ...base, mv: 1, wd: 0, an: 0, as: 0 }, 'a pose from before the arm: sheathed, unswung');
  assert.deepEqual(validPose({ ...base, mv: 2, wd: 1, an: 17, as: 3 }), { ...base, mv: 2, wd: 1, an: 17, as: 3 });
  assert.equal(validPose({ ...base, wd: 'yes' }).wd, 1, 'a truthy wd is drawn'); assert.equal(validPose({ ...base, wd: 0 }).wd, 0);
  assert.equal(validPose({ ...base, an: 70000 }).an, 65535, 'the count clamped to the wire\'s width'); assert.equal(validPose({ ...base, an: -3 }).an, 0);
  assert.equal(validPose({ ...base, an: 4.7 }).an, 4, 'whole'); assert.equal(validPose({ ...base, an: 'x' }).an, 0);
  assert.equal(validPose({ ...base, as: 99 }).as, POSE_STRIKES.length - 1, 'the kind clamped to the list'); assert.equal(validPose({ ...base, as: NaN }).as, 0);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'pose', p: { ...base, mv: 0, wd: 1, an: 2, as: 6 } }), { hasHello: true }), { t: 'pose', p: { ...base, mv: 0, wd: 1, an: 2, as: 6 } }, 'through the frame');
  const a = { ...base, mv: 1, wd: 0, an: 0, as: 0 };
  assert.equal(poseChanged(a, { ...a }), false);
  assert.equal(poseChanged(a, { ...a, wd: 1 }), true, 'a draw goes out at once');
  assert.equal(poseChanged(a, { ...a, an: 1 }), true, 'a swing goes out at once');
  assert.equal(poseChanged(a, { ...a, as: 3 }), false, 'the kind alone is no swing - the count is');
  const eased = lerpPose({ ...a, x: 0 }, { ...a, x: 10, wd: 1, an: 5, as: 2 }, 0.5);
  assert.equal(eased.x, 5, 'the position eases');
  assert.equal(eased.wd, 1); assert.equal(eased.an, 5); assert.equal(eased.as, 2, 'the arm\'s three ride whole');
  assert.deepEqual([lerpPose(null, { ...a, wd: 1, an: 3, as: 1 }, 0.2).wd, lerpPose(null, { ...a, wd: 1, an: 3, as: 1 }, 0.2).an], [1, 3]);
  const old = lerpPose({ ...base, mv: 0 }, { ...base, mv: 1 }, 1);
  assert.deepEqual([old.wd, old.an, old.as], [0, 0, 0], 'a peer from before the arm: sheathed and unswung, never undefined');
});

/** MWBODY1's fake rig with the arm's three doors recorded. */
function rigFactory(log, { attackThrows = false } = {}) {
  return () => {
    const r = { cam: null, mode: 'first', updates: [], sheathed: [], attacks: [], releases: 0, unloaded: false,
      attach(renderer, cam) { r.cam = cam; },
      async build(opts) { r.opts = opts; log.builds++; return { ok: true }; },
      canThirdPerson: () => true,
      setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.updates.length > 0,
      update(dt) { r.updates.push(dt); },
      drawThird() { return r.thirdActive(); },
      unload() { r.unloaded = true; },
      raceHeightScale: () => 1,
      setSheathed(v) { if (r.sheathed.at(-1) === v) return false; r.sheathed.push(v); return true; },
      attack(strike) { if (attackThrows) throw new Error('no such clip'); r.attacks.push(strike); return 'chop'; },
      release() { r.releases++; return false; },
    };
    log.rigs.push(r);
    return r;
  };
}
const shown = (x, { mv = 0, wd = 0, an = 0, as = 0 } = {}) => ({ x, y: 0, z: -10, yaw: 0, pitch: 0, mv, wd, an, as });
const peer = (id, s) => ({ id, name: id, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, shown: s });
const toScene = (p) => [p.x, p.y, p.z];
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

test('MAC7 #1: a peer\'s body draws while the sender\'s weapon is drawn and sheathes when it is not, swings ONCE per count with the wire\'s strike, never the count it was born with and never sheathed, and releases every frame; a rig whose attack throws stands down like any other throw', async () => {
  const log = { builds: 0, rigs: [] };
  const warned = [];
  const pb = new PeerBodies({ renderer: {}, createRig: rigFactory(log), now: () => 1000, warn: (m) => warned.push(m) });
  const near = [0, 0, 0];
  const p = peer('p1', shown(3, { wd: 0, an: 5, as: 1 }));   // born mid-count: a late joiner sees an old count
  pb.sync([p], toScene, 0.016, near); await settle();
  pb.sync([p], toScene, 0.016, near);
  const r = log.rigs[0];
  assert.equal(r.mode, 'third'); assert.equal(r.updates.length, 1);
  assert.deepEqual(r.sheathed, [true], 'the sender\'s weapon is sheathed: so is the body\'s');
  assert.deepEqual(r.attacks, [], 'the count the body was born with is no swing');
  assert.equal(r.releases, 1, 'release every frame, as weaponRig gives its own rig');
  p.shown = shown(3, { wd: 1, an: 5, as: 1 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.sheathed, [true, false], 'drawn: the body draws'); assert.deepEqual(r.attacks, [], 'and does not swing for it');
  p.shown = shown(3, { wd: 1, an: 6, as: 3 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeLeft'], 'the count moved: one swing, the wire\'s kind');
  pb.sync([p], toScene, 0.016, near); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeLeft'], 'the same count again: no second swing');
  p.shown = shown(3, { wd: 1, an: 7, as: 99 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeLeft', 'StrikeDown'], 'a kind past the list falls to StrikeDown (the wire clamps first; the body never throws on it)');
  p.shown = shown(3, { wd: 0, an: 8, as: 1 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.sheathed, [true, false, true], 'sheathed again');
  assert.deepEqual(r.attacks, ['StrikeLeft', 'StrikeDown'], 'a count that moved while sheathed is no swing');
  assert.equal(r.releases, 7);
  p.shown = shown(3, { wd: 1, an: 8, as: 1 }); pb.sync([p], toScene, 0.016, near);
  assert.deepEqual(r.attacks, ['StrikeLeft', 'StrikeDown'], 'and drawing again does not replay it');
  // the throw law (AUDIT MWBODY A1): the arm's doors are inside the same guard as update
  const log2 = { builds: 0, rigs: [] };
  const pb2 = new PeerBodies({ renderer: {}, createRig: rigFactory(log2, { attackThrows: true }), now: () => 1000, warn: (m) => warned.push(m) });
  const q = peer('q1', shown(3, { wd: 1, an: 1 }));
  pb2.sync([q], toScene, 0.016, near); await settle(); pb2.sync([q], toScene, 0.016, near);
  assert.equal(pb2.has('q1'), true);
  q.shown = shown(3, { wd: 1, an: 2 }); pb2.sync([q], toScene, 0.016, near);
  assert.equal(pb2.has('q1'), false, 'a rig whose attack threw stands down');
  assert.ok(warned.some((m) => /update threw: no such clip/.test(m)), 'and says why once');
});

test('MAC7 #1: the hosts by source - weaponRig counts every strike it starts before the Morrowind arm\'s gate and exposes it; world.js reads the drawn flag and the swing into every pose it sends; peerBodies drives the rig\'s three doors inside the update guard', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /const swing = \{ n: 0, strike: 'StrikeDown' \};\s*function fpAttack\(strike\) \{\s*swing\.n = \(swing\.n \+ 1\) & 0xffff; swing\.strike = strike;\s*if \(!fpArm\.ready\(\)\) return;/, 'counted before the arm\'s own gate: a classic-skin player swings too');
  assert.match(rig, /\n    swing,   \/\/ MAC7 #1/, 'exposed');
  assert.equal((rig.match(/fpAttack\(strike\)/g) ?? []).length, 3, 'the one counter sits under both strike doors (the click and the gesture)');
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ POSE_STRIKES \} from '\.\.\/net\/wire\.js';/);
  assert.match(w, /const arm = \{ mv, wd: weaponRig\.playerWeapon\.sheathed \? 0 : 1, an: weaponRig\.swing\.n, as: Math\.max\(0, POSE_STRIKES\.indexOf\(weaponRig\.swing\.strike\)\) \};/, 'the drawn flag and the swing off the rig');
  assert.equal((w.match(/\{ \.\.\.pose, \.\.\.arm \}/g) ?? []).length, 2, 'into the hello and every pose');
  assert.doesNotMatch(w, /\{ \.\.\.pose, mv \}/);
  const pb = rd('src/net/peerBodies.js');
  assert.match(pb, /try \{\s*this\._arm\(b, peer\.shown\);\s*b\.rig\.update\(dt\);\s*\} catch \(e\) \{ this\._fail\(b, `update threw: \$\{e\?\.message \?\? e\}`\); \}/, 'the arm inside the update guard (AUDIT MWBODY A1)');
  assert.match(pb, /b\.rig\.setSheathed\?\.\(!drawn\);/);
  assert.match(pb, /else if \(an !== b\.swing\) \{ b\.swing = an; if \(drawn\) b\.rig\.attack\?\.\(POSE_STRIKES\[shown\.as \| 0\] \?\? 'StrikeDown'\); \}/);
  assert.match(pb, /b\.rig\.release\?\.\(\);/);
});
