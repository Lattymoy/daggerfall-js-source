// AUDIT CAPE-CARD (2026-10-30, the owner: "Audit this", of CAPE-CARD and CAPE-FLAT; bible/01-Overview/audits/
// Audit-Cape-Card.md). Four cold lanes read a frozen tree of 8c61432b5. The pins of the findings fixed that outlived the
// owner's revert of the straight cut: the pictures turn to the eye that draws them (A1), the swing laid in the frame the
// cloth is drawn in (A2), a sprite rider a card (A3), a seated picture's feet (A4), the gather after every layer (A5), a
// doll's swing behind it (A6, found in the revert) and the face's edges (C4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mobileOrientation, mobilePortrayedYaw } from '../../src/characters/mobile/mobileUnit.js';
import { RemotePlayers, seatedSink } from '../../src/net/remotePlayers.js';
import { createPeerRiders, createEotbArt } from '../../src/net/peer/peerRiders.js';
import { createAuraHost } from '../../src/scenes/auraHost.js';
import {
  AURA_VS, AURA_GROUND_R, ETERNAL_TOP, ETERNAL_POOL_R, CLOAK_REST_POSE, WING_SPRITE_BACK, auraCapeStep, auraSpritePosed, auraMotionStep, auraSwingDrawn,
} from '../../src/render/auraRing.js';
import { glslFunctions } from '../glsl.mjs';

const rd = (/** @type {string} */ p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 5));
const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, class: 'Warrior', items: [] };
const toScene = (/** @type {any} */ p) => [p.x, p.y, p.z];
const QUIET = 13.2;
/** Eternal's vertex half, at rest unless `over` says otherwise. */
const vs = (/** @type {Record<string, any>} */ over = {}) => glslFunctions(AURA_VS, {
  uWingBack: 0, uSeed: 0.37, uRingR: ETERNAL_POOL_R, uGroundR: AURA_GROUND_R, uFlameH: ETERNAL_TOP, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1],
  uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], uLift: 0.05, uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uSide: 1, uTorn: -1, uSwing: [0, 0, 0, 0],
  uCapeS: [...CLOAK_REST_POSE.shoulders], uCapeH: [...CLOAK_REST_POSE.head], uKneeL: [0, 0, 0], uKneeR: [0, 0, 0], uTorsoU: [0, 1, 0], uTorsoF: [0, 0, 1], uKind: 1, uTime: QUIET, uYaw: 0, uCamPos: [0, 1.5, -6],
  ...over,
});
function classicLayer(/** @type {boolean} */ sprites) {
  const textures = new Map();
  const tex = (/** @type {number} */ archive) => ({ archive, getFrameCount: () => 5, getSize: () => ({ w: 60, h: 100 }), getScale: () => ({ x: 0, y: 0 }) });
  const rp = new RemotePlayers({
    renderer: { textures, uploadTexture: (/** @type {any} */ a, /** @type {any} */ r) => textures.set(`${a}_${r}`, {}), releaseTexture: () => {}, createBillboardBatch: (/** @type {any} */ a, /** @type {any} */ r, /** @type {any} */ size) => ({ a, r, size, origin: [0, 0, 0] }), destroyBillboardBatch: () => {} },
    deps: { getTexture: async (/** @type {number} */ a) => tex(a), uploadRecordFrame: () => {}, fetchBytes: async () => null, palette: null, audio: null },
    compose: async () => ({ rgba: new Uint8ClampedArray(4 * 8 * 4).fill(255), width: 4, height: 8 }),
  });
  if (!sprites) rp._mobileFor = () => null;
  return rp;
}
async function drawn(/** @type {any} */ rp, /** @type {any} */ peer, /** @type {any} */ opts, /** @type {string} */ kind) {
  for (let i = 0; i < 8 && rp._batches.get(peer.id)?.kind !== kind; i++) { rp.sync([peer], toScene, { bodyHeight: () => 0, dt: 1 / 60, ...opts }); await settle(); }
  rp.sync([peer], toScene, { bodyHeight: () => 0, dt: 1 / 60, ...opts });
  assert.equal(rp._batches.get(peer.id)?.kind, kind, `drawn as a ${kind}`);
}

test('AUDIT CAPE-CARD A1: every peer\'s picture turns to the eye that DRAWS it - a class sprite to `view`, the frame\'s camera, never the listener\'s place it is also handed; the walkers and the riders to the renderer\'s camera, never the head (mutants: a class sprite turned to the listener; the walkers to the head)', async () => {
  const rp = classicLayer(true), yaw = 0.9, feet = [2, 0, 2], me = [2, 0, 9], cam = [-4, 2, 2];
  assert.notEqual(mobileOrientation(yaw, feet, me), mobileOrientation(yaw, feet, cam), 'the two eyes see different views');
  await drawn(rp, { id: 's', name: 's', look: LOOK, shown: { x: 2, y: 0, z: 2, yaw, pitch: 0, mv: 0 } }, { eye: me, view: cam }, 'mobile');
  assert.equal(rp._batches.get('s').mobileUnit.orientation, mobileOrientation(yaw, feet, cam), 'the view the camera sees');
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes('const peerEye = travelView?.eye ?? (renderer._view ? renderer._camPos : cam.pos), peerRight'), 'the walkers\' and riders\' eye: the camera the frame was drawn from');
  assert.ok(/remotePlayers\.sync\(visiblePeers[^\n]*eye: travelView\?\.eye \?\? player\.pos, view: peerEye,/.test(w), 'the class sprites\' too, the listener kept');
});

test('AUDIT CAPE-CARD A2: the swing in the frame the cloth is drawn in - a doll faces the eye whichever way its peer walks, and walking across the view the hem trails behind the walk, not into the screen (mutants: the swing laid in the turning\'s frame)', () => {
  const w = /** @type {any} */ ({ at: [0, 0, 0], yaw: 0, aura: 'eternal' });
  auraCapeStep(w, auraSpritePosed(w, null, { yaw: 0, turn: Math.PI / 2 }));   // the doll's front to the eye on +z, the peer walking +x
  for (let i = 0; i <= 60; i++) { w.at[0] = 4 * i / 60; auraMotionStep(w, 10 + i / 60); }
  const sw = auraSwingDrawn(w, [0, 0, 0, 0]);
  const still = vs().eternalPoint([0.5, 0.15], QUIET), moving = vs({ uSwing: sw }).eternalPoint([0.5, 0.15], QUIET);
  const dx = moving[0] - still[0], dz = moving[2] - still[2];
  assert.ok(dx < -0.1 && Math.abs(dz) < Math.abs(dx) / 3, `behind the walk (dx ${dx.toFixed(3)}, dz ${dz.toFixed(3)})`);
  const same = /** @type {any} */ ({ yaw: 0.4, turnYaw: 0.4, swing: { x: 0.1, z: -0.2, lift: 0.05, twist: 0.3 } });
  assert.deepEqual(auraSwingDrawn(same, [0, 0, 0, 0]), [0.1, -0.2, 0.05, 0.3], 'a body drawn as it turns: as it was');
});

test('AUDIT CAPE-CARD A3: a sprite rider is a card - its face says so, and in the saddle what hangs on its back stands WING_SPRITE_BACK behind it, as on a walker; and my own sprite says so to the draw (mutants: a rider\'s face no card)', async () => {
  const renderer = { uploadTexture() {}, createBillboardBatch: (/** @type {any} */ archive, /** @type {any} */ record, /** @type {any} */ size) => ({ archive, record, size, origin: null }), destroyBillboardBatch() {} };
  const art = createEotbArt({ renderer, urlFor: (/** @type {string} */ k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }) });
  const riders = createPeerRiders({ art });
  const peers = [{ id: 'h', look: { eo: 0 }, shown: { x: 4, y: 0, z: 9, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, rd: 1 } }];
  for (let i = 0; i < 2; i++) { riders.sync(peers, toScene, { eye: [4, 1, 20], dt: 0.01 }); await settle(); }
  const face = riders.faceOf('h');
  assert.ok(face && face.card === true && riders.figureOf('h') === null, 'a rider: faced, a card, no figure');
  const w = /** @type {any} */ ({ at: [4, 0, 9], yaw: 0, aura: 'seraphwings', mounted: true });
  auraCapeStep(w, auraSpritePosed(w, null, face));
  assert.equal(w.cape.wingBack, WING_SPRITE_BACK);
  assert.ok(rd('src/scenes/auraHost.js').includes('auraSpriteBones(mwViewSpriteFigure()), card: !!faced }'), 'mine: my sprite\'s picture a card');
});

test('AUDIT CAPE-CARD A4: a seated doll sinks by the seat\'s drop, and what it wears sinks with it - its face hands the picture\'s feet and the gather stands the wearer on them (mutants: the gather on the pose\'s feet)', async () => {
  const rp = classicLayer(false), peer = { id: 'p', name: 'p', look: LOOK, shown: { x: 5, y: 0, z: 5, yaw: 0, pitch: 0, mv: 0, st: 1 } };
  const sink = seatedSink(peer.shown), eye = [5, 1.7, 9];
  assert.ok(sink > 0.3, `a seat's drop (${sink})`);
  await drawn(rp, peer, { eye }, 'doll');
  assert.ok(Math.abs(/** @type {any} */ (rp.faceOf('p', eye)).at[1] + sink) < 1e-9, 'the picture\'s feet, sunk');
  const was = globalThis.localStorage;
  const m = new Map();
  globalThis.localStorage = /** @type {any} */ ({ getItem: (/** @type {string} */ k) => m.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => m.set(k, String(v)), removeItem: (/** @type {string} */ k) => m.delete(k) });
  try {
    const online = { rehello: () => true, auraOf: () => null, armoryOf: () => '000b0', lookOf: () => ({ items: [] }) };
    const host = createAuraHost({
      renderer: { gl: null, _camPos: eye, _view: null }, online: () => online, travelActive: () => false, quiet: () => false, camYaw: () => 0,
      player: () => ({ feetAt: () => [0, 0, 0], bodyFeetAt: () => [0, 0, 0], bodyYawFor: () => 0, height: 1.8, riding: false }),
      spawned: () => false, beast: () => false, veiled: () => false, toScene, sprites: () => [null, null, rp], bodies: () => null,
    });
    host.frame([peer]);
    const [w] = host.armoryWearersNow();
    assert.ok(w && Math.abs(w.at[1] + sink) < 1e-9, `the wearer on the sunk feet (${w?.at[1]})`);
  } finally {
    if (was === undefined) delete /** @type {any} */ (globalThis).localStorage; else globalThis.localStorage = was;
  }
});

test('AUDIT CAPE-CARD A5: the gather after every layer has drawn its peers - the classic one\'s sync last - so a face it reads is this frame\'s (read as code; mutants: the gather back before the classic layer)', () => {
  const w = rd('src/scenes/world.js');
  const sync = w.indexOf('    remotePlayers.sync(visiblePeers'), gather = w.indexOf('    auraHost.frame(seen);');
  assert.ok(sync > 0 && gather > sync && w.indexOf('    auraHost.frame(seen);', gather + 1) < 0, 'once, after the classic layer');
});

test('AUDIT CAPE-CARD A6: a doll whose peer runs away from the eye - the owner\'s shot, at a run - trails its hem behind its picture, never through it; walking across it still trails behind the walk; any other body keeps its swing forward (mutants: a doll no front; the front unpassed; unkept; the fold dropped; every swing folded)', async () => {
  const rp = classicLayer(false), eye = [0, 1.7, 3], peer = { id: 'p', name: 'p', look: LOOK, shown: { x: 0, y: 0, z: 0, yaw: Math.PI, pitch: 0, mv: 0 } };   // faces -z, away from the eye
  await drawn(rp, peer, { eye }, 'doll');
  const front = (/** @type {any} */ face, /** @type {number[]} */ step) => {
    const w = /** @type {any} */ ({ at: [0, 0, 0], yaw: 0, aura: 'eternal' });
    auraCapeStep(w, auraSpritePosed(w, null, face));
    for (let i = 0; i <= 90; i++) { w.at[0] = step[0] * i / 60; w.at[2] = step[1] * i / 60; auraMotionStep(w, 10 + i / 60); }
    const F = vs({ uWingBack: w.cape.wingBack, uSwing: auraSwingDrawn(w, [0, 0, 0, 0]), uCapeS: [...w.cape.shoulders], uCapeH: [...w.cape.head], uYaw: w.yaw, uCamPos: eye });
    const z = [], x = [];
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) { const p = F.eternalPoint([i / 12, j / 12], QUIET); z.push(p[2]); x.push(p[0]); }
    return { z: Math.max(...z), x: x.reduce((a, b) => a + b, 0) / x.length };
  };
  const face = /** @type {any} */ (rp.faceOf('p', eye));
  assert.ok(face?.front === true && face.card === true, 'a doll: a card that shows every eye its front');
  const run = front(face, [0, -8]);
  assert.ok(run.z < -0.1, `running away (8 m/s): behind the doll (${run.z.toFixed(3)})`);
  assert.ok(front({ ...face, front: false }, [0, -8]).z > 0.1, 'swung as it trails in the world, it came through the doll\'s front');
  assert.ok(front({ ...face, turn: Math.PI / 2 }, [8, 0]).x < front({ ...face, turn: Math.PI / 2 }, [0, 0]).x - 0.1, 'across the view: behind the walk');
  const sprite = /** @type {any} */ ({ yaw: 0.4, turnYaw: 0.4, front: false, swing: { x: 0, z: 0.2, lift: 0, twist: 0 } });
  assert.equal(auraSwingDrawn(sprite, [0, 0, 0, 0])[1], 0.2, 'a picture with views, or a body: its swing forward as it is (a stop\'s overshoot)');
});

test('AUDIT CAPE-CARD C4: the face\'s edges - a pose with no facing turns as its picture does; an eye over a doll\'s feet sees no facing; a view that is no whole view reads none, and every facing is wrapped (mutants: the turn\'s fallback dropped; no facing kept; the eye over the feet faced; the guard dropped; unwrapped)', async () => {
  const rp = classicLayer(false), peer = { id: 'p', name: 'p', look: LOOK, shown: { x: 1, y: 0, z: 1, pitch: 0, mv: 0 } };
  await drawn(rp, peer, { eye: [1, 1, 6] }, 'doll');
  const f = rp.faceOf('p', [1, 1.6, 6]);
  assert.ok(f && f.turn === f.yaw, 'no pose facing: the picture\'s');
  assert.equal(rp.faceOf('p', [1, 9, 1]), null, 'an eye over its feet: none');
  assert.equal(mobilePortrayedYaw(1.5, [0, 0, 0], [0, 1, 5]), null, 'no whole view');
  for (let o = 0; o < 8; o++) { const y = /** @type {number} */ (mobilePortrayedYaw(o, [0, 0, 0], [0.01, 1, -5])); assert.ok(y > -Math.PI && y <= Math.PI, `view ${o}: wrapped (${y})`); }
});
