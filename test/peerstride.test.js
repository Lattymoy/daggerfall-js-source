// PEER-BUZZ (2026-09-22, Discord through Mac: "footstep sounds are broken",
// with a 52-second recording of a continuous buzz): a peer's stride
// machine was fed the WIRE's coordinates (AUDIT DROPS E5), and in the
// overworld the wire's frame is world coordinates - 32768 per map pixel
// against the scene's 819.2, forty scene units to one. Every 2.5 wire
// units was a step: forty-eight a second for a walker. The stride is
// measured in scene units now, and the floating-origin recentre rebases
// every peer machine, as EV1 rebases the local one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { PIXEL_UNITS } from '../src/net/wire.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SCENE_PER_PIXEL = 819.2;                       // world/streamingWorld.js: one map pixel of terrain in scene units
const WIRE_PER_SCENE = PIXEL_UNITS / SCENE_PER_PIXEL;   // 40: the overworld pose is in world coordinates
const rig = () => {
  const played = [];
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: { playOneShot: (clip, vol) => played.push({ clip, vol }) } }, compose: async () => null });
  return { rp, played };
};
const peer = (x, mv = 1) => ({ id: 'bob-0001', name: 'bob', shown: { x, y: 0, z: 0, yaw: 0, pitch: 0, mv, wd: 0, an: 0, fk: 0 }, look: null });
const toScene = (p) => [p.x / WIRE_PER_SCENE, p.y, p.z / WIRE_PER_SCENE];   // world.js onlineToScene's overworld arm, as a scale

test('PEER-BUZZ, driven: a peer walking at 3 scene units a second in the OVERWORLD makes a walker\'s cadence of steps - about one every 0.8 s - not forty-eight a second', () => {
  assert.equal(WIRE_PER_SCENE, 40, 'the overworld wire frame is forty scene units to one');
  const { rp, played } = rig();
  const opts = { bodyHeight: () => 2, eye: [0, 1.7, 0] };
  let wireX = 0; const FPS = 60, SECONDS = 5, SPEED = 3;
  for (let i = 0; i < FPS * SECONDS; i++) { wireX += SPEED * WIRE_PER_SCENE / FPS; rp.sync([peer(wireX)], toScene, opts); }
  const expected = SPEED * SECONDS / 2.5;   // WALK_STEP_INTERVAL
  assert.ok(played.length >= expected - 1 && played.length <= expected + 1, `${played.length} steps in ${SECONDS} s at ${SPEED} u/s - a walk is ~${expected} (the buzz was ${expected * WIRE_PER_SCENE})`);
  // and standing still is silent, whatever the frame
  const n = played.length;
  for (let i = 0; i < 60; i++) rp.sync([peer(wireX, 0)], toScene, opts);
  assert.equal(played.length, n, 'a standing peer takes no step');
});

test('PEER-BUZZ, driven: the floating-origin recentre is not a stride - world.js rebases every peer machine in the block that rebases its own, and the next frame re-seeds; without the rebase the 819.2-unit jump fires a step', () => {
  const { rp, played } = rig();
  const opts = { bodyHeight: () => 2, eye: [0, 1.7, 0] };
  let wireX = 0;
  for (let i = 0; i < 60 && !played.length; i++) { wireX += 2; rp.sync([peer(wireX)], toScene, opts); }
  assert.ok(played.length >= 1, 'walking makes a step');
  const before = played.length;
  const shiftedScene = (p) => { const s = toScene(p); return [s[0] + 819.2, s[1], s[2]]; };
  const shifted = { bodyHeight: () => 2, eye: [wireX / WIRE_PER_SCENE + 819.2, 1.7, 0] };
  rp.rebaseFootsteps();
  rp.sync([peer(wireX)], shiftedScene, shifted);
  rp.sync([peer(wireX)], shiftedScene, shifted);
  assert.equal(played.length, before, 'rebased: no step for the recentre');
  // the negative control, so the rebase is seen to matter: the same jump with no rebase is a stride
  rp.sync([peer(wireX)], toScene, opts);   // back to the unshifted frame WITHOUT a rebase - the anchor holds the shifted point
  assert.equal(played.length, before + 1, 'unrebased, the jump counts as walked distance and fires - which is what the rebase exists to stop');
  // by source: the seam and the call
  assert.match(rd('src/net/remotePlayers.js'), /const step = fm\.update\(f, \{ grounded: true, swimming: false, levitating: false, onFoot: true, standingStill: !shown\.mv, halfSpeed: false \}, set\);/, 'the SCENE point');
  assert.match(rd('src/net/remotePlayers.js'), /rebaseFootsteps\(\) \{\s*for \(const fm of this\._footsteps\.values\(\)\) fm\.rebase\(\);\s*\}/);
  assert.match(rd('src/scenes/world.js'), /footsteps\.rebase\(\);\s*\n\s*betterAmbience\.rebase\(\);[^\n]*\n\s*remotePlayers\?\.rebaseFootsteps\?\.\(\);/, 'called in the recentre block, beside the local machine\'s rebase');
});
