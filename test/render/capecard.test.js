// CAPE-CARD (2026-10-30, the owner, with a shot of the Eternal cape on a peer's front: "Did we learn nothing from the
// angel wings aura?"; bible/01-Overview/bugs/Field-Bugs-2026-10-30.md). A paperdoll or class sprite peer had no face, so
// its cape hung on the pose's yaw - over a doll's chest whenever its peer faced away. Now the layer says how its picture
// faces (faceOf) and that it is a card, and the cape hangs behind the card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mobileOrientation, mobilePortrayedYaw } from '../../src/characters/mobile/mobileUnit.js';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { createAuraHost, spriteAnswer } from '../../src/scenes/auraHost.js';
import {
  AURA_VS, AURA_GROUND_R, ETERNAL_TOP, ETERNAL_POOL_R, ETERNAL_CARDS,
  CLOAK_REST_POSE, CLOAK_CARD_POSE, CLOAK_SHOULDER_Y, WING_SPRITE_BACK, auraCapeStep, auraSpritePosed, auraSpriteBones, EOTB_FIGURE,
} from '../../src/render/auraRing.js';
import { glslFunctions } from '../glsl.mjs';

const rd = (/** @type {string} */ p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const wrap = (/** @type {number} */ a) => Math.atan2(Math.sin(a), Math.cos(a));
const settle = () => new Promise((r) => setTimeout(r, 5));
const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, class: 'Warrior', items: [] };
const toScene = (/** @type {any} */ p) => [p.x, p.y, p.z];
const memStorage = () => { const m = new Map(); return { getItem: (/** @type {string} */ k) => m.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => m.set(k, String(v)), removeItem: (/** @type {string} */ k) => m.delete(k) }; };

/** A RemotePlayers that draws its peers as paperdolls (the 'Other players' card off): the real doll path, a composed
 *  picture of opaque pixels. */
function dollLayer() {
  const rp = new RemotePlayers({
    renderer: { uploadTexture: () => {}, releaseTexture: () => {}, createBillboardBatch: (/** @type {any} */ a, /** @type {any} */ r, /** @type {any} */ size) => ({ a, r, size, origin: [0, 0, 0] }), destroyBillboardBatch: () => {} },
    deps: { fetchBytes: async () => null, palette: null, audio: null },
    compose: async () => ({ rgba: new Uint8ClampedArray(4 * 8 * 4).fill(255), width: 4, height: 8 }),
  });
  rp._mobileFor = () => null;
  return rp;
}
/** A RemotePlayers that draws its peers as class sprites: the real mobile path over a stand-in archive. */
function spriteLayer() {
  const textures = new Map();
  const tex = (/** @type {number} */ archive) => ({ archive, getFrameCount: () => 5, getSize: () => ({ w: 60, h: 100 }), getScale: () => ({ x: 0, y: 0 }) });
  return new RemotePlayers({
    renderer: { textures, uploadTexture: (/** @type {any} */ a, /** @type {any} */ r) => textures.set(`${a}_${r}`, {}), createBillboardBatch: (/** @type {any} */ a, /** @type {any} */ r, /** @type {any} */ size) => ({ a, r, size, origin: [0, 0, 0] }), destroyBillboardBatch: () => {} },
    deps: { getTexture: async (/** @type {number} */ a) => tex(a), uploadRecordFrame: () => {}, audio: null }, compose: async () => null,
  });
}
async function drawn(/** @type {any} */ rp, /** @type {any} */ peer, /** @type {number[]} */ eye, /** @type {string} */ kind) {
  for (let i = 0; i < 8 && rp._batches.get(peer.id)?.kind !== kind; i++) { rp.sync([peer], toScene, { bodyHeight: () => 0, dt: 1 / 60, eye }); await settle(); }
  rp.sync([peer], toScene, { bodyHeight: () => 0, dt: 1 / 60, eye });
  assert.equal(rp._batches.get(peer.id)?.kind, kind, `drawn as a ${kind}`);
}

test('CAPE-CARD a class sprite\'s facing: mobileOrientation run backwards - every view it can show is read back as the middle of its bucket, so the yaw a picture is seen to face chooses that picture again and lies within half a view of the yaw that chose it; none with no line of sight (mutants: the view turned the wrong way)', () => {
  const T = Math.PI / 4;
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((o) => Math.round(wrap(mobilePortrayedYaw(o, [0, 0, 0], [0, 1, 5]) ?? NaN) / T)), [0, 1, 2, 3, 4, -3, -2, -1], 'the eye on +z: view o faces o eighths of a turn round from it');
  for (let i = 0; i < 64; i++) {
    const yaw = -Math.PI + (i + 0.37) * (Math.PI / 32), feet = [3, 0, -2], eye = [3 + 6 * Math.sin(i * 0.7), 1.5, -2 + 6 * Math.cos(i * 0.7)];
    const o = mobileOrientation(yaw, feet, eye), seen = /** @type {number} */ (mobilePortrayedYaw(o, feet, eye));
    assert.equal(mobileOrientation(seen, feet, eye), o, `yaw ${yaw.toFixed(2)}: the same view`);
    assert.ok(Math.abs(wrap(seen - yaw)) <= T / 2 + 1e-9, `yaw ${yaw.toFixed(2)}: within half a view (${wrap(seen - yaw).toFixed(3)})`);
  }
  assert.equal(mobilePortrayedYaw(2, [1, 0, 1], [1, 4, 1]), null, 'the eye over the feet: no line of sight');
});

test('CAPE-CARD the classic layer says how its picture faces, built by its own producers: a doll shows the eye its front whichever way its peer turns, a class sprite the view it was drawn in as the camera sees it; both say they are cards, and a doll that it shows every eye its front (AUDIT CAPE-CARD A6); each hands the pose\'s own facing for the swing and its picture\'s feet; nothing for a peer it does not draw (mutants: a doll faced on the pose; the card unsaid; a doll no front)', async () => {
  const dolls = dollLayer();
  const away = { id: 'd', name: 'd', look: LOOK, shown: { x: 1, y: 0, z: 3, yaw: 0, pitch: 0, mv: 0 } };   // faces +z
  await drawn(dolls, away, [1, 1, -5], 'doll');
  for (const eye of [[1, 1.6, -5], [6, 1.6, 3], [1, 1.6, 9]]) {
    const f = dolls.faceOf('d', eye);
    assert.ok(f && Math.abs(wrap(f.yaw - Math.atan2(eye[0] - 1, eye[2] - 3))) < 1e-9, `eye ${eye}: the doll's front to it (${f?.yaw})`);
    assert.equal(f?.turn, 0, 'its peer\'s own facing, for the swing');
    assert.equal(f?.card, true, 'a flat card with no figure');
    assert.equal(f?.front, true, 'AUDIT CAPE-CARD A6: its front to every eye');
    assert.deepEqual([...(f?.at ?? [])], [1, 0, 3], 'its picture\'s feet');
  }
  assert.equal(dolls.faceOf('nobody', [0, 1, 0]), null);
  assert.equal(dolls.faceOf('d', null), null, 'no eye, no facing');
  const sprites = spriteLayer();
  const yaw = 0.9, peer = { id: 's', name: 's', look: LOOK, shown: { x: 2, y: 0, z: 2, yaw, pitch: 0, mv: 0 } };
  const me = [2, 0, 9];   // the sync's eye: the local player's own place (world.js remotePlayers.sync)
  await drawn(sprites, peer, me, 'mobile');
  const o = sprites._batches.get('s').mobileUnit.orientation;
  assert.equal(o, mobileOrientation(yaw, [2, 0, 2], me), 'the view drawn for the sync\'s eye');
  const mine = sprites.faceOf('s', me);
  assert.ok(mine && Math.abs(wrap(mine.yaw - yaw)) <= Math.PI / 8 + 1e-9 && mine.card === true && mine.front === false && mine.turn === yaw, 'from that eye: within half a view of the pose, a card with views');
  const cam = [-4, 2, 2];   // a camera elsewhere sees the same picture, facing as it is drawn to that eye
  assert.ok(Math.abs(wrap(/** @type {any} */ (sprites.faceOf('s', cam)).yaw - /** @type {number} */ (mobilePortrayedYaw(o, [2, 0, 2], cam)))) < 1e-9, 'from the camera: the picture\'s own facing');
});

test('CAPE-CARD the pose: a face that says it is a card hangs from the rest pose WING_SPRITE_BACK behind it, faced as the picture and swung by the pose; a rider\'s face (no card) from the rest pose at the body; a figure\'s bones win over the word; a card in the saddle is lifted and still behind; the shared poses are never written (mutants: the card ignored; a shared pose written)', () => {
  const rest = [...CLOAK_REST_POSE.shoulders];
  const w = /** @type {any} */ ({ at: [4, 0, 4], yaw: 0, aura: 'eternal' });
  auraCapeStep(w, auraSpritePosed(w, null, { yaw: 2.5, turn: 0.4, card: true }));
  assert.equal(w.cape, CLOAK_CARD_POSE); assert.equal(w.cape.wingBack, WING_SPRITE_BACK); assert.equal(w.yaw, 2.5); assert.equal(w.turnYaw, 0.4);
  const r = /** @type {any} */ ({ at: [4, 0, 4], yaw: 0, aura: 'eternal' });
  auraCapeStep(r, auraSpritePosed(r, null, { yaw: 1, turn: 1 }));
  assert.equal(r.cape, CLOAK_REST_POSE, 'a face with no card: at the body, as before');
  auraCapeStep(w, auraSpritePosed(w, { base: 0, mpp: EOTB_FIGURE.mpp }, { yaw: 1, turn: 1, card: true }));
  assert.notEqual(w.cape, CLOAK_CARD_POSE, 'a figure read: its own bones');
  assert.ok(Math.abs(w.cape.shoulders[1] - /** @type {any} */ (auraSpriteBones({ base: 0, mpp: EOTB_FIGURE.mpp }))['bip01 l upperarm'][1]) < 1e-6);
  const m = /** @type {any} */ ({ at: [4, 0, 4], yaw: 0, aura: 'seraphwings', mounted: true, cape: CLOAK_CARD_POSE });
  auraCapeStep(m, auraSpritePosed(m, null, { yaw: 0, turn: 0, card: true }));
  assert.ok(m.cape !== CLOAK_CARD_POSE && m.cape.wingBack === WING_SPRITE_BACK && m.cape.shoulders[1] > CLOAK_SHOULDER_Y, 'in the saddle: lifted, behind the card');
  const s = /** @type {any} */ ({ at: [4, 0, 4], yaw: 0, aura: 'eternal', cape: CLOAK_CARD_POSE });
  auraCapeStep(s, { feet: s.at, yaw: 0, turn: 0, bones: auraSpriteBones({ base: 0.3, mpp: EOTB_FIGURE.mpp }) });
  assert.deepEqual([...CLOAK_CARD_POSE.shoulders], rest, 'the card\'s pose untouched by a wearer that moved on to bones');
  assert.deepEqual([...CLOAK_REST_POSE.shoulders], rest, 'and the rest pose');
});

/** Eternal's vertex half, its pose and its facing as `w` holds them. */
const vsOf = (/** @type {any} */ w) => glslFunctions(AURA_VS, {
  uWingBack: w.cape.wingBack ?? 0, uSeed: 0.37, uRingR: ETERNAL_POOL_R, uGroundR: AURA_GROUND_R, uFlameH: ETERNAL_TOP, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1],
  uAt: [...w.at], uFocus: [0, 0, 0, 0], uLift: 0.05, uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uSide: 1, uTorn: -1, uSwing: [0, 0, 0, 0],
  uCapeS: [...w.cape.shoulders], uCapeH: [...w.cape.head], uKneeL: [0, 0, 0], uKneeR: [0, 0, 0], uTorsoU: [0, 1, 0], uTorsoF: [0, 0, 1], uKind: 1, uTime: 13.2, uYaw: w.yaw, uCamPos: [0, 1.5, -6],
});
const QUIET = 13.2;

test('CAPE-CARD the owner\'s shot: a doll whose peer faces away from the eye - the cape hung as the doll faces lies wholly behind its card, cloth, wisps and embers, where hung on the pose it stood between the eye and the doll (mutants: a doll faced on the pose; the card unsaid)', async () => {
  const dolls = dollLayer();
  const peer = { id: 'p', name: 'p', look: LOOK, shown: { x: 0, y: 0, z: 0, yaw: Math.PI, pitch: 0, mv: 0 } };   // faces -z, away from the eye
  const eye = [0, 1.7, 3];
  await drawn(dolls, peer, eye, 'doll');
  const depths = (/** @type {any} */ w) => {
    const F = vsOf(w), out = [];
    for (let i = 0; i <= 12; i++) for (let j = 2; j <= 12; j++) out.push(F.eternalPoint([i / 12, j / 12], QUIET));
    for (let k = 0; k < ETERNAL_CARDS; k++) out.push(F.eternalFlight(k, QUIET).slice(0, 3));
    return out.map((p) => p[2]);   // the eye on +z: nearer it than the card through the feet is z > 0
  };
  const w = /** @type {any} */ ({ at: [0, 0, 0], yaw: Math.PI, aura: 'eternal' });
  auraCapeStep(w, auraSpritePosed(w, spriteAnswer([null, null], 'figureOf', 'p'), spriteAnswer([null, dolls], 'faceOf', 'p', eye)));
  assert.equal(w.cape, CLOAK_CARD_POSE, 'the rest pose behind the card: the wrapped cut\'s sides and collar reach the card\'s plane at the body (WINGS-FIT)');
  const now = depths(w);
  assert.ok(now.every((z) => z < -0.1), `all of it behind the doll (${Math.max(...now).toFixed(3)})`);
  const was = /** @type {any} */ ({ at: [0, 0, 0], yaw: Math.PI, aura: 'eternal' });
  auraCapeStep(was, null);   // the old wiring: no face for a doll - the pose's yaw, at rest
  assert.ok(depths(was).filter((z) => z > 0).length > 100, 'hung on the pose, it stood in front of the doll');
});

test('CAPE-CARD the host: every layer that draws a peer as a picture is one list, the paperdolls and class sprites with the Eye of the Beholder sets - the gather faces a doll\'s pieces as the doll faces, and the draw hangs a cape off any of them; world.js hands the three over (mutants: the classic layer left out)', async () => {
  const dolls = dollLayer();
  const peer = { id: 'p', name: 'p', look: LOOK, shown: { x: 5, y: 0, z: 5, yaw: Math.PI, pitch: 0, mv: 0 } };
  const eye = [5, 1.7, 9];
  await drawn(dolls, peer, eye, 'doll');
  const was = globalThis.localStorage;
  globalThis.localStorage = /** @type {any} */ (memStorage());
  try {
    const online = { rehello: () => true, auraOf: () => null, armoryOf: () => '000b0', lookOf: () => ({ items: [] }) };
    const host = createAuraHost({
      renderer: { gl: null, _camPos: eye, _view: null }, online: () => online, travelActive: () => false, quiet: () => false, camYaw: () => 0,
      player: () => ({ feetAt: () => [0, 0, 0], bodyFeetAt: () => [0, 0, 0], bodyYawFor: () => 0, height: 1.8, riding: false }),
      spawned: () => false, beast: () => false, veiled: () => false, toScene: (/** @type {any} */ s) => [s.x, s.y, s.z],
      sprites: () => [null, null, dolls], bodies: () => null,
    });
    host.frame([peer]);
    const [w] = host.armoryWearersNow();
    assert.ok(w && Math.abs(wrap(w.yaw - Math.atan2(0, 4))) < 1e-9, `the doll's front to the eye, not its peer's back (${w?.yaw})`);
  } finally {
    if (was === undefined) delete /** @type {any} */ (globalThis).localStorage; else globalThis.localStorage = was;
  }
  assert.match(rd('src/scenes/world.js'), /\n    sprites: \(\) => \[peerWalkers, peerRiders, remotePlayers\], bodies: \(\) => peerBodies,/);
  assert.ok(rd('src/scenes/auraHost.js').includes(': deps.bodies()?.bonesOf(w.id, CLOAK_BONES) ?? auraSpritePosed(w, spriteAnswer(layers, \'figureOf\', w.id), spriteAnswer(layers, \'faceOf\', w.id, eye)), w === self'), 'the draw: a cape off any layer\'s picture');
  assert.equal(spriteAnswer([{ faceOf: () => null }, null, { faceOf: (/** @type {string} */ id, /** @type {any} */ e) => ({ id, e }) }], 'faceOf', 'x', eye)?.e, eye, 'the first layer that draws the peer answers, for the eye');
});
