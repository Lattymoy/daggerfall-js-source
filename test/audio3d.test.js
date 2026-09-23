// 3D-AUDIO + RIDE-SOUND (2026-09-23, Discord through Mac: "we need 3d audio right now it doesnt matter where enemies
// are it always sounds like the opposite or directly in front of you while the mob is behind"; and the known limit,
// "other players' horses make no hoof sounds yet"). BY EXECUTION over a WebAudio graph that records what the engine
// set: the scene is DFU's LEFT-handed frame and WebAudio is right-handed, so the audio door turns it once (a source
// on the player's right plays on the right); every positional source is HRTF (a foe behind is heard behind); a peer
// in the saddle is heard at them - the riding loop, its stop and its neigh - and their steps and swings too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AudioEngine, audioFrame, PANNING_MODEL } from '../src/systems/audio.js';
import { RemotePlayers, PEER_SOUND_PROFILE, ridingLoopName, peerInEarshot } from '../src/net/remotePlayers.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
import { SOUND } from '../src/systems/soundClips.js';
import { lookAt, perspective, mirrorProjectionX, multiply } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** A WebAudio graph that records the listener and every panner the engine makes. */
function riggedEngine() {
  const param = () => ({ value: 0 });
  const panners = [];
  const listener = { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() };
  const ctx = {
    state: 'running', destination: { connect(n) { return n; } }, listener,
    createGain: () => ({ gain: param(), connect(n) { return n; }, disconnect() {} }),
    createPanner: () => { const p = { positionX: param(), positionY: param(), positionZ: param(), connect(n) { return n; }, disconnect() { p.gone = true; } }; panners.push(p); return p; },
    createBufferSource: () => ({ buffer: null, playbackRate: param(), loop: false, connect(n) { return n; }, start() {}, stop() {}, disconnect() {} }),
  };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true; e._ensureCtx = () => {};
  for (const k of [42, SOUND.HorseClop2, SOUND.HorseAndCart, SOUND.HorseClop, SOUND.AnimalHorse]) e.buffers.set(k, { duration: 0.5 });
  return { e, panners, listener };
}
/** WebAudio's own azimuth sign (the spec's PannerNode algorithm): the source's projection on the listener's
 *  right, which is forward x up. Positive: the right ear. */
function webAudioSide(listener, pan) {
  const f = [listener.forwardX.value, listener.forwardY.value, listener.forwardZ.value], u = [listener.upX.value, listener.upY.value, listener.upZ.value];
  const right = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
  const d = [pan.positionX.value - listener.positionX.value, pan.positionY.value - listener.positionY.value, pan.positionZ.value - listener.positionZ.value];
  return d[0] * right[0] + d[1] * right[1] + d[2] * right[2];
}
/** Which side of the SCREEN a scene point draws on, through the renderer's own view and handedness mirror. */
function screenSide(eye, target, p) {
  const m = multiply(mirrorProjectionX(perspective(1, 1, 0.1, 100)), lookAt(eye, target, [0, 1, 0]));
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return x / w;
}

test('3D-AUDIO: a sound plays on the side of the screen it is drawn on - facing north (+Z) and facing east (+X), right is right and left is left (mutant: the handedness left unturned)', () => {
  // ahead and to one side, so the renderer's own projection can say which side of the screen it draws on
  for (const [yaw, rightOf, left] of [[0, [1, 0, 5], [-1, 0, 5]], [Math.PI / 2, [5, 0, -1], [5, 0, 1]]]) {
    const { e, panners, listener } = riggedEngine();
    const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
    e.setListener([0, 0, 0], fwd);
    e.play3d(42, rightOf, 1); e.play3d(42, left, 1);
    assert.ok(screenSide([0, 0, 0], fwd, rightOf) > 0 && screenSide([0, 0, 0], fwd, left) < 0, 'the renderer draws them right and left');
    assert.ok(webAudioSide(listener, panners[0]) > 0, `yaw ${yaw}: the right-hand foe is heard in the right ear`);
    assert.ok(webAudioSide(listener, panners[1]) < 0, `yaw ${yaw}: the left-hand foe in the left`);
  }
  assert.deepEqual(audioFrame([1, 2, 3]), [1, 2, -3], 'one reflection, at the door');
});

test('3D-AUDIO: every positional source is HRTF - a foe behind is not a foe ahead (equal-power folded every azimuth past 90 degrees onto the front); the loops and their moves go through the same door', () => {
  assert.equal(PANNING_MODEL, 'HRTF');
  const { e, panners, listener } = riggedEngine();
  e.setListener([0, 0, 0], [0, 0, 1]);
  e.play3d(42, [0, 0, -5], 1);
  const loop = e.loop3d(42, [2, 0, 0], 1);
  assert.ok(panners.every((p) => p.panningModel === 'HRTF'));
  assert.equal(panners[0].positionZ.value, 5, 'behind the player in the scene is behind the listener in the audio frame');
  assert.equal(listener.forwardZ.value, -1);
  loop.move([0, 0, 7]);
  assert.equal(panners[1].positionZ.value, -7, 'a moved loop turns at the same door');
  assert.doesNotMatch(rd('src/systems/audio.js'), /panningModel = 'equalpower'/);
});

test('RIDE-SOUND: a peer in the saddle is heard AT them - the fast clop (or the cart), moved with them, stopped 0.2 s after they stand, gone when they dismount or leave; their steps and swings play at them too (mutants: the loop never started; left running after the dismount)', () => {
  const { e, panners } = riggedEngine();
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: e }, compose: async () => null });
  const loops = () => e._loops3d ?? new Map();
  const peer = (x, mv, rd) => ({ id: 'bob-0001', name: 'bob', shown: { x, y: 0, z: 4, yaw: 0, pitch: 0, mv, wd: 0, an: 0, fk: 0, ...(rd ? { rd, rv: 0 } : {}) }, look: null });
  const toScene = (p) => [p.x, p.y, p.z];
  const opts = (dt = 1 / 30) => ({ bodyHeight: () => 2, eye: [0, 1.7, 0], dt });
  rp.sync([peer(1, 1, 1)], toScene, opts());
  const ch = loops().get(ridingLoopName('bob-0001'));
  assert.ok(ch, 'riding: the loop plays');
  assert.equal(ch.want, SOUND.HorseClop2, 'the horse starts on the fast clop (UpdateMode)');
  const pan = panners.at(-1);
  assert.equal(pan.positionX.value, 1); assert.equal(pan.positionZ.value, -4, 'at the rider');
  assert.deepEqual([pan.refDistance, pan.maxDistance, pan.distanceModel], [6, 30, 'linear'], 'with the peers\' falloff');
  rp.sync([peer(3, 1, 1)], toScene, opts());
  assert.equal(pan.positionX.value, 3, 'and moves with them');
  // standing: the loop stops after DFU's 0.2 s, not at once
  rp.sync([peer(3, 0, 1)], toScene, opts(0.1));
  assert.ok(loops().has(ridingLoopName('bob-0001')), 'a step-pause does not chop the clop');
  rp.sync([peer(3, 0, 1)], toScene, opts(0.3));
  assert.equal(loops().has(ridingLoopName('bob-0001')), false, 'stopped after the delay');
  // a cart is the cart's own loop
  rp.sync([peer(3, 1, 2)], toScene, opts());
  assert.equal(loops().get(ridingLoopName('bob-0001')).want, SOUND.HorseAndCart);
  // the dismount and the departure take it
  rp.sync([peer(3, 1, 0)], toScene, opts());
  assert.equal(loops().has(ridingLoopName('bob-0001')), false, 'dismounted: silent');
  rp.sync([peer(3, 1, 1)], toScene, opts());
  rp.sync([], toScene, opts());
  assert.equal(loops().has(ridingLoopName('bob-0001')), false, 'gone (and the dead\'s empty sync): silent');
  assert.deepEqual(PEER_SOUND_PROFILE, { refDistance: 6, maxDistance: 30, distanceModel: 'linear' }, 'PEER-FS1\'s own falloff, now the panner\'s');
  const src = rd('src/net/remotePlayers.js');
  assert.doesNotMatch(src, /playOneShot\(step\.clip, step\.volume \* falloff\)/, 'a peer\'s step plays at them, not flat');
});

test('RIDE-SOUND: the named positional loop SWAPS its clip at the seam (DFU\'s ridingAudioSource), and the hooves ride the peers\' footsteps switch; a peer\'s step plays at them with the peers\' falloff, and nothing is made past earshot (mutants: the swap lost; the switch ignored; the step flat; the earshot unbounded)', () => {
  const { e } = riggedEngine();
  const a = e.setLoop3d('x', SOUND.HorseClop2, [0, 0, 0]);
  assert.equal(e.setLoop3d('x', SOUND.HorseClop, [1, 0, 0]), a, 'one channel');
  assert.equal(a.want, SOUND.HorseClop, 'the next arm plays the new clip');
  // the switch
  const r = riggedEngine();
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: r.e }, compose: async () => null });
  const rider = { id: 'bob-0001', name: 'bob', shown: { x: 1, y: 0, z: 4, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, fk: 0, rd: 1, rv: 0 }, look: null };
  const was = getPref('peerFootsteps');
  try {
    setPref('peerFootsteps', false);
    rp.sync([rider], (p) => [p.x, p.y, p.z], { bodyHeight: () => 2, eye: [0, 1.7, 0], dt: 1 / 30 });
    assert.equal((r.e._loops3d ?? new Map()).size, 0, 'the peers\' footsteps off: no hooves either');
  } finally { setPref('peerFootsteps', was); }
  // a walking peer's steps
  const calls = [];
  const walker = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null,
    audio: { playOneShot() { calls.push('flat'); }, play3d(clip, at, volume, opts) { calls.push({ at, opts }); } } }, compose: async () => null });
  for (let i = 0; i < 200; i++) {
    walker.sync([{ id: 'amy-0002', name: 'amy', shown: { x: i * 0.1, y: 0, z: 4, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, fk: 0 }, look: null }], (p) => [p.x, p.y, p.z], { bodyHeight: () => 2, eye: [0, 1.7, 0], dt: 1 / 30 });
  }
  assert.ok(calls.length > 0, 'she is heard walking');
  assert.ok(calls.every((c) => c !== 'flat' && c.opts === PEER_SOUND_PROFILE), 'every step at her, with the peers\' falloff');
  assert.ok(calls.every((c) => c.at[1] === 0 && c.at[2] === 4 && c.at[0] >= 0 && c.at[0] < 20), 'where she stands');
  assert.equal(peerInEarshot([0, 0, 29], [0, 0, 0]), true);
  assert.equal(peerInEarshot([0, 0, 31], [0, 0, 0]), false, 'past the far edge nothing is made');
});
