// MWBODY1 (2026-09-12, Mac: "knock out the deferred morrowind model").
// THE OTHERS IN THE MORROWIND BODY EXECUTE: a peer's look mapped onto
// the rig's build options (the same inputs the player's entity maps
// onto - the race id spelling, the female flag, the worn readout, the
// right hand), the stub camera the rig reads once a frame (the yaw,
// `mv` as the forward move); PeerBodies over a fake rig factory - one
// rig per peer, builds one at a time, the view switched to third once
// built, stepped by dt, drawn at the feet with the yaw, released when
// the peer goes or changes look, capped, a failure waited out, the
// gate off releasing everything; the doll pass skipping a peer in a
// body while its name still rides; the host pinned by source (the
// gate, the order, the draw after the player's own body in every
// pass). Mutants: the singleton rig shared by every peer, the doll
// drawn under the body, a failed build rebuilt every frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PeerBodies, peerBuildOpts, peerCamera, BODIES_MAX, BODY_RETRY_MS, PEER_EYE, RUN_SPEED } from '../src/net/peerBodies.js';
import { RemotePlayers, PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { CLOTHING_NAME } from '../src/formats/mwItemMap.js';
import { PAPERDOLL_W, PAPERDOLL_H } from '../src/ui/paperDoll.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const pose = (x, mv = 0, yaw = 0) => ({ x, y: 0, z: -10, yaw, pitch: 0, mv });
const peer = (id, race, x = 0, mv = 0) => ({ id, name: id, look: { race, gender: 'male', faceIndex: 0, items: [] }, shown: pose(x, mv) });

test('MWBODY1: a peer\'s look maps onto the rig\'s build options the way the player\'s entity does - the race id spelling, the female flag, the face, the worn armor and garments, the right hand; the stub camera carries the yaw and mv as the forward move', () => {
  const clothingIndex = Number(Object.keys(CLOTHING_NAME)[0]);
  const look = { race: 'DarkElf', gender: 'female', faceIndex: 3, items: [
    { templateIndex: ARMOR_ENUM.Cuirass, group: 'Armor', material: 2, equipSlot: EQUIP_SLOTS.ChestArmor },
    { templateIndex: clothingIndex, group: 'MensClothing', dye: 5, equipSlot: EQUIP_SLOTS.ChestClothes },
    { templateIndex: 4, group: 'Weapons', material: 1, equipSlot: EQUIP_SLOTS.RightHand },
  ] };
  const o = peerBuildOpts(look);
  assert.equal(o.race, 'dark elf', 'the ESM\'s spelling (mwRaceId)'); assert.equal(o.female, true); assert.equal(o.faceIndex, 3); assert.equal(o.hasAmmo, false);
  assert.deepEqual(o.armor.find((p) => p.kind === 'armor'), { templateIndex: ARMOR_ENUM.Cuirass, material: 2, kind: 'armor' }, 'the worn readout, dfWornEquipment');
  assert.deepEqual(o.armor.find((p) => p.kind === 'clothing'), { kind: 'clothing', templateIndex: clothingIndex, name: CLOTHING_NAME[clothingIndex], dye: 5 });
  assert.equal(o.weapon.templateIndex, 4, 'the right hand'); assert.equal(o.weapon.group, 'Weapons');
  assert.equal(peerBuildOpts({}).race, 'breton'); assert.equal(peerBuildOpts({}).female, false); assert.deepEqual(peerBuildOpts({}).armor, []);
  const walking = peerCamera(pose(1, 1, 0.7), [1, 2, 3], 2);
  assert.deepEqual(walking.pos, [1, 2 + PEER_EYE, 3]); assert.equal(walking.yaw, 0.7); assert.equal(walking.move.forward, 1); assert.equal(walking.move.grounded, true);
  assert.equal(walking.move.speed, 2, 'the measured pace sets the clip\'s rate'); assert.equal(walking.move.running, false);
  assert.equal(peerCamera(pose(1, 1), [0, 0, 0], RUN_SPEED + 1).move.running, true, 'past RUN_SPEED: the run');
  assert.equal(peerCamera(pose(1, 0), [0, 0, 0], 9).move.forward, 0, 'standing: the idle'); assert.equal(peerCamera(pose(1, 0), [0, 0, 0], 9).move.speed, 0);
  assert.equal(walking.sneaking, false); assert.equal(walking.pitch, 0, 'the body stands level');
});

/** A fake rig: what the machine's instance API does, recorded. */
function rigFactory(log, { okFor = () => true, third = true } = {}) {
  return () => {
    const r = { cam: null, mode: 'first', updates: [], draws: [], unloaded: false, opts: null,
      attach(renderer, cam) { r.renderer = renderer; r.cam = cam; },
      async build(opts) { r.opts = opts; log.builds.push(opts.race); await flush(); return okFor(opts) ? { ok: true } : { ok: false, stage: 'data', error: 'no body records' }; },
      canThirdPerson: () => third, raceHeightScale: () => 1.1,
      setViewMode(m) { if (m === 'third' && !third) return false; r.mode = m; return true; },
      update(dt) { r.updates.push({ dt, cam: r.cam() }); },
      drawThird(canvas, p) { r.draws.push(p); return true; },
      unload() { r.unloaded = true; },
    };
    log.rigs.push(r);
    return r;
  };
}
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await flush(); };

test('MWBODY1: PeerBodies - one rig per peer built from its look one at a time, the camera fed from the pose, the view third once built, stepped by dt, drawn at the feet with the yaw, released when the peer goes or changes look (mutants: the singleton rig, the doll under the body)', async () => {
  const log = { builds: [], rigs: [] };
  let now = 1000;
  const pb = new PeerBodies({ renderer: { id: 'r' }, createRig: rigFactory(log), buildOpts: (look) => ({ race: look.race }), now: () => now });
  const toScene = (p) => [p.x, p.y, p.z];
  const a = peer('aaaa', 'Nord', 1, 1), b = peer('bbbb', 'Redguard', 2, 0);
  pb.sync([a, b], toScene, 0.016);
  assert.equal(log.rigs.length, 2, 'a rig each'); assert.notEqual(log.rigs[0], log.rigs[1]);
  assert.equal(pb.has('aaaa'), false, 'building'); assert.equal(pb.draw({}, { proj: [], view: [], eye: [0, 0, 0] }), 0);
  await settle();
  assert.deepEqual(log.builds, ['Nord', 'Redguard'], 'built one after the other, from the look');
  assert.equal(pb.has('aaaa'), true); assert.equal(log.rigs[0].mode, 'third'); assert.equal(log.rigs[0].renderer.id, 'r');
  assert.ok(Math.abs(pb.heightOf('aaaa') - PEER_HEIGHT * 1.1) < 1e-12, 'the body\'s head: the capsule by the race\'s own scale'); assert.equal(pb.heightOf('nobody'), 0);
  pb.sync([a, b], toScene, 0.02);
  assert.equal(log.rigs[0].updates.length, 1); assert.equal(log.rigs[0].updates[0].dt, 0.02);
  assert.equal(log.rigs[0].updates[0].cam.move.forward, 1, 'aaaa walks'); assert.equal(log.rigs[1].updates[0].cam.move.forward, 0, 'bbbb stands');
  a.shown = pose(1.06, 1); pb.sync([a, b], toScene, 0.02);
  assert.ok(log.rigs[0].updates[1].cam.move.speed > 0 && log.rigs[0].updates[1].cam.move.speed < 3, 'the pace measured off the pose (0.06 in 0.02 s, eased)');
  assert.equal(pb.draw({}, { proj: [1], view: [2], eye: [0, 0, 0] }), 2);
  assert.deepEqual(log.rigs[1].draws[0].feet, [2, 0, -10]); assert.equal(log.rigs[1].draws[0].yaw, 0);
  a.shown = pose(5, 0, 1.5); pb.sync([a, b], toScene, 0.02); pb.draw({}, { proj: [1], view: [2], eye: [0, 0, 0] });
  assert.deepEqual(log.rigs[0].draws.at(-1).feet, [5, 0, -10]); assert.equal(log.rigs[0].draws.at(-1).yaw, 1.5, 'the pose moves the body');
  // gone: released; a new look: a new rig
  pb.sync([a], toScene, 0.02); assert.equal(log.rigs[1].unloaded, true); assert.equal(pb.has('bbbb'), false);
  a.look = { ...a.look, race: 'Khajiit' }; pb.sync([a], toScene, 0.02);
  assert.equal(log.rigs[0].unloaded, true); assert.equal(log.rigs.length, 3); await settle(); assert.equal(log.builds.at(-1), 'Khajiit');
  pb.destroy(); assert.equal(log.rigs[2].unloaded, true); assert.equal(pb.draw({}, { proj: [], view: [], eye: [0, 0, 0] }), 0);
});

test('MWBODY1: the cap, the failure and the gate - past BODIES_MAX the rest keep the doll, a body that will not build is released and not tried again before BODY_RETRY_MS, the gate off releases every body and builds none (mutant: a failed build rebuilt every frame)', async () => {
  const log = { builds: [], rigs: [] };
  let now = 1000; let on = true;
  const pb = new PeerBodies({ renderer: {}, enabled: () => on, createRig: rigFactory(log, { okFor: (o) => o.race !== 'Nobody' }), buildOpts: (look) => ({ race: look.race }), now: () => now });
  const toScene = (p) => [p.x, p.y, p.z];
  const crowd = Array.from({ length: BODIES_MAX + 3 }, (_, i) => peer('p' + i, 'Nord', i));
  pb.sync(crowd, toScene, 0.016); await settle(BODIES_MAX * 2 + 4);
  assert.equal(log.rigs.length, BODIES_MAX, 'the cap'); assert.equal(pb.has('p0'), true); assert.equal(pb.has('p' + (BODIES_MAX + 1)), false, 'past the cap: the doll');
  pb.destroy();
  const nob = peer('nob', 'Nobody', 0);
  pb.sync([nob], toScene, 0.016); await settle(); const tries = log.builds.filter((r) => r === 'Nobody').length;
  assert.equal(tries, 1); assert.equal(pb.has('nob'), false); assert.equal(log.rigs.at(-1).unloaded, true, 'a failed body is released');
  pb.sync([nob], toScene, 0.016); pb.sync([nob], toScene, 0.016); await settle();
  assert.equal(log.builds.filter((r) => r === 'Nobody').length, tries, 'no retry before BODY_RETRY_MS');
  now += BODY_RETRY_MS + 1; pb.sync([nob], toScene, 0.016); await settle();
  assert.equal(log.builds.filter((r) => r === 'Nobody').length, tries + 1, 'one retry after it');
  const a = peer('aaaa', 'Nord'); pb.sync([a], toScene, 0.016); await settle(); assert.equal(pb.has('aaaa'), true);
  on = false; pb.sync([a], toScene, 0.016);
  assert.equal(pb.has('aaaa'), false); assert.equal(log.rigs.at(-1).unloaded, true, 'the gate off: released');
  const before = log.rigs.length; pb.sync([a], toScene, 0.016); assert.equal(log.rigs.length, before, '...and none built');
});

test('MWBODY1: the doll pass skips a peer in a body and its name still rides, at the capsule\'s head (mutant: the doll drawn under the body)', async () => {
  const uploads = [];
  const renderer = { uploadTexture: (a, r, c) => uploads.push(r), releaseTexture() {}, createBillboardBatch: (a, r, size) => ({ size, origin: null }), destroyBillboardBatch() {} };
  const figure = () => { const rgba = new Uint8Array(PAPERDOLL_W * PAPERDOLL_H * 4); for (let y = 10; y < 170; y++) for (let x = 30; x < 80; x++) rgba[(y * PAPERDOLL_W + x) * 4 + 3] = 255; return { width: PAPERDOLL_W, height: PAPERDOLL_H, rgba }; };
  const rp = new RemotePlayers({ renderer, deps: {}, compose: async () => figure() });
  const a = peer('aaaa', 'Nord', 0), b = peer('bbbb', 'Nord', 3);
  const bodyHeight = (id) => (id === 'aaaa' ? PEER_HEIGHT * 1.1 : 0);
  rp.sync([a, b], undefined, { bodyHeight }); await flush(); await flush(); rp.sync([a, b], undefined, { bodyHeight });
  assert.equal(rp.batches().length, 1, 'one doll: the peer in a body has none');
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)); const view = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
  const names = rp.namePoints(proj, view, 1600, 900, [0, 1.7, 0]);
  assert.deepEqual(names.map((n) => n.name).sort(), ['aaaa', 'bbbb'], 'both names');
  const shown = rp._shown; assert.ok(Math.abs(shown.find((e) => e.peer.id === 'aaaa').height - PEER_HEIGHT * 1.1) < 1e-12, 'the body\'s head is the body\'s own');
  assert.ok(shown.find((e) => e.peer.id === 'bbbb').height <= PEER_HEIGHT);
});

test('MWBODY1: the host - the gate is the enhanced skin with Morrowind data, the bodies sync before the dolls and hand the dolls their skip, the bodies draw right after the player\'s own in the exterior pass and in both modal passes', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /peerBodies = new PeerBodies\(\{ renderer, enabled: \(\) => isEnhanced\(\) && !!getPref\('mwArms'\) && morrowindDataCount\(\) > 0 \}\);/, 'the enhanced skin, the arms switch, the data');
  assert.match(w, /const drawable = online\.drawable\(\);\s*\n\s*peerBodies\.sync\(drawable, onlineToScene, dt\);\s*\n\s*remotePlayers\.sync\(drawable, onlineToScene, \{ bodyHeight: \(id\) => peerBodies\.heightOf\(id\) \}\);/);
  assert.match(w, /mwViewDrawBody\(canvas, \{ proj, view, eye: mwv\.eye, feet: player\.feetAt\(\), yaw: cam\.yaw \}\);\s*\n\s*drawPeerBodies\(proj, view, mwv\.eye\);/, 'after the player\'s own body, the same pass');
  assert.match(w, /onlineFrame\(now, dt\)/, 'the frame\'s dt steps the bodies');
  const m = rd('src/scenes/worldModes.js');
  assert.equal((m.match(/mwViewDrawBody\(canvas, \{ proj, view, eye: mwv\.eye, feet: player\.feetAt\(\), yaw: cam\.yaw \}\);   \/\/ MW-D24\n\s*host\.drawPeerBodies\?\.\(\{ proj, view, eye: mwv\.eye \}\);/g) || []).length, 2, 'the dungeon\'s and the interior\'s passes');
  const pbSrc = rd('src/net/peerBodies.js');
  assert.match(pbSrc, /import \{ createFpArm \} from '\.\.\/combat\/fpArm\.js';/, 'the factory, never the exported instance');
  assert.doesNotMatch(pbSrc, /\bfpArm\.(?!js)|import \{[^}]*\bfpArm\b/, 'the singleton is not touched (the module path is not a use)');
});
