// MWBODY1 (2026-09-12, Mac: "knock out the deferred morrowind model"),
// re-pinned by AUDIT MWBODY. THE OTHERS IN THE MORROWIND BODY EXECUTE:
// a peer's look mapped onto the rig's build options (the same inputs
// the player's entity maps onto - the race id spelling, the female
// flag, the worn readout, the right hand), the stub camera the rig
// reads once a frame (the yaw, `mv` as the forward move and the run
// bit, the measured pace, no pitch); PeerBodies over a fake rig
// factory shaped like the instance API - one rig per peer, builds one
// at a time, the view switched to third once built, stepped by dt,
// drawn at the feet with the yaw only after a step, released when the
// peer changes look or lingers past BODY_LINGER_MS gone, a released
// body's build skipped or unloaded, the nearest first within the cap
// and a far body yielding its slot, the rig asleep past BODY_RANGE, a
// jump not read as a sprint, a failure (refused or thrown) waited out
// with its reason kept, the feet following the origin, the gate off
// releasing everything; the doll pass skipping a peer in a body while
// its name still rides; the host pinned by source. Mutants: the
// singleton rig shared by every peer, the doll drawn under the body, a
// failed build rebuilt every frame, a flicker rebuilding the body, the
// released body's build run anyway, builds in parallel, the constants
// moved, the host's draw hook emptied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PeerBodies, peerBuildOpts, peerCamera, BODIES_MAX, BODY_RETRY_MS, BODY_LINGER_MS, BODY_RANGE, JUMP_UNITS, SWAP_MARGIN, BODY_REBUILD_MS, YAW_EASE } from '../src/net/peerBodies.js';
import { RemotePlayers, PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { CLOTHING_NAME } from '../src/formats/mwItemMap.js';
import { PAPERDOLL_W, PAPERDOLL_H } from '../src/ui/paperDoll.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const pose = (x, mv = 0, yaw = 0) => ({ x, y: 0, z: -10, yaw, pitch: 0, mv });
const peer = (id, race, x = 0, mv = 0) => ({ id, name: id, look: { race, gender: 'male', faceIndex: 0, items: [] }, shown: pose(x, mv) });
const toScene = (p) => [p.x, p.y, p.z];
const V = { proj: [1], view: [2], eye: [0, 0, 0] };

test('MWBODY1: the constants, once and literally (mutant: a constant moved with its pin moving along)', () => {
  assert.equal(BODIES_MAX, 8); assert.equal(BODY_RETRY_MS, 30000); assert.equal(BODY_LINGER_MS, 15000);
  assert.equal(BODY_RANGE, 120); assert.equal(JUMP_UNITS, 5); assert.equal(SWAP_MARGIN, 1.25); assert.equal(BODY_REBUILD_MS, 10000); assert.equal(YAW_EASE, 12);
});

test('MWBODY1: a peer\'s look maps onto the rig\'s build options the way the player\'s entity does - the race id spelling, the female flag, the face, the worn armor and garments, the right hand; the stub camera carries the yaw, mv as the forward move and the run bit, the measured pace, and no pitch', () => {
  const clothingIndex = Number(Object.keys(CLOTHING_NAME)[0]);
  const look = { race: 'DarkElf', gender: 'female', faceIndex: 3, items: [
    { templateIndex: ARMOR_ENUM.Cuirass, group: 'Armor', material: 2, equipSlot: EQUIP_SLOTS.ChestArmor },
    { templateIndex: clothingIndex, group: 'MensClothing', dye: 5, equipSlot: EQUIP_SLOTS.ChestClothes },
    { templateIndex: 4, group: 'Weapons', material: 1, equipSlot: EQUIP_SLOTS.RightHand },
  ] };
  const o = peerBuildOpts(look);
  assert.equal(o.race, 'dark elf', 'the ESM\'s spelling (mwRaceId)'); assert.equal(o.female, true); assert.equal(o.faceIndex, 3); assert.equal(o.hasAmmo, false, 'the look carries the equip table alone: no arrows on the wire');
  assert.deepEqual(o.armor.find((p) => p.kind === 'armor'), { templateIndex: ARMOR_ENUM.Cuirass, material: 2, kind: 'armor' }, 'the worn readout, dfWornEquipment');
  assert.deepEqual(o.armor.find((p) => p.kind === 'clothing'), { kind: 'clothing', templateIndex: clothingIndex, name: CLOTHING_NAME[clothingIndex], dye: 5 });
  assert.equal(o.weapon.templateIndex, 4, 'the right hand'); assert.equal(o.weapon.group, 'Weapons');
  assert.equal(peerBuildOpts({}).race, 'breton'); assert.equal(peerBuildOpts({}).female, false); assert.deepEqual(peerBuildOpts({}).armor, []);
  const walking = peerCamera(pose(1, 1, 0.7), [1, 2, 3], 2);
  assert.deepEqual(walking.pos, [1, 2, 3], 'the feet: the third-person branch reads no eye'); assert.equal(walking.yaw, 0.7); assert.equal(walking.move.forward, 1); assert.equal(walking.move.grounded, true);
  assert.equal(walking.move.speed, 2, 'the measured pace sets the clip\'s rate'); assert.equal(walking.move.running, false);
  assert.equal(peerCamera(pose(1, 2), [0, 0, 0], 1).move.running, true, 'mv 2: the run, the wire\'s own bit'); assert.equal(peerCamera(pose(1, 2), [0, 0, 0], 1).move.forward, 1);
  assert.equal(peerCamera(pose(1, 0), [0, 0, 0], 9).move.forward, 0, 'standing: the idle'); assert.equal(peerCamera(pose(1, 0), [0, 0, 0], 9).move.speed, 0);
  assert.equal(peerCamera({ ...pose(1, 1), pitch: 0.8 }, [0, 0, 0], 0).pitch, 0, 'a looking peer still stands level (vanilla\'s law)'); assert.equal(walking.sneaking, false);
  const reused = peerCamera(pose(2, 1, 0.1), [4, 5, 6], 1, walking); assert.equal(reused, walking, 'one camera object per body, written in place'); assert.deepEqual(walking.pos, [4, 5, 6]);
});

/** A fake rig shaped like the instance API: attach, build -> {ok} or a throw, canThirdPerson, setViewMode -> boolean, update, drawThird -> false until stepped in third, unload, raceHeightScale, thirdActive. */
function rigFactory(log, { okFor = () => true, throwFor = () => false, third = true } = {}) {
  return () => {
    const r = { cam: null, mode: 'first', updates: [], draws: [], unloaded: false, opts: null,
      attach(renderer, cam) { r.renderer = renderer; r.cam = cam; },
      async build(opts) {
        r.opts = opts; log.builds.push(opts.race); log.inFlight++; log.peak = Math.max(log.peak, log.inFlight);
        await flush(); log.inFlight--;
        if (throwFor(opts)) throw new Error('mesh parse');
        return okFor(opts) ? { ok: true } : { ok: false, stage: 'data', error: 'no body records' };
      },
      canThirdPerson: () => third, raceHeightScale: () => 1.1,
      setViewMode(m) { if (m === 'third' && !third) return false; r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.updates.length > 0,
      update(dt) { r.updates.push({ dt, cam: r.cam() }); },
      drawThird(canvas, p) { if (!r.thirdActive()) return false; r.draws.push(p); return true; },
      unload() { r.unloaded = true; },
    };
    log.rigs.push(r);
    return r;
  };
}
const newLog = () => ({ builds: [], rigs: [], inFlight: 0, peak: 0 });
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await flush(); };

test('MWBODY1: PeerBodies - one rig per peer built from its look ONE AT A TIME, the camera fed from the pose, the view third once built, stepped by dt, drawn at the feet with the yaw only once stepped, released when the look changes, the feet following the origin (mutants: the singleton rig, builds in parallel, the doll under the body)', async () => {
  const log = newLog();
  let now = 1000;
  const pb = new PeerBodies({ renderer: { id: 'r' }, createRig: rigFactory(log), buildOpts: (look) => ({ race: look.race }), now: () => now });
  const a = peer('aaaa', 'Nord', 1, 1), b = peer('bbbb', 'Redguard', 2, 0);
  pb.sync([a, b], toScene, 0.016, [0, 0, -10]);
  assert.equal(log.rigs.length, 2, 'a rig each'); assert.notEqual(log.rigs[0], log.rigs[1]);
  assert.equal(pb.has('aaaa'), false, 'building'); assert.equal(pb.heightOf('aaaa'), 0); assert.equal(pb.draw({}, V), 0);
  await settle();
  assert.deepEqual(log.builds, ['Nord', 'Redguard'], 'built from the look'); assert.equal(log.peak, 1, 'one build at a time');
  assert.equal(log.rigs[0].mode, 'third'); assert.equal(log.rigs[0].renderer.id, 'r');
  assert.equal(pb.has('aaaa'), false, 'built but not yet stepped: the rig is not active, the doll still stands'); assert.equal(pb.draw({}, V), 0, 'nothing drawn before a step');
  pb.sync([a, b], toScene, 0.02, [0, 0, -10]);
  assert.equal(pb.has('aaaa'), true); assert.ok(Math.abs(pb.heightOf('aaaa') - CAPSULE_HEIGHT * 1.1) < 1e-12, 'the body\'s head: the capsule by the race\'s own scale'); assert.equal(pb.heightOf('nobody'), 0);
  assert.equal(log.rigs[0].updates.length, 1); assert.equal(log.rigs[0].updates[0].dt, 0.02);
  assert.equal(log.rigs[0].updates[0].cam.move.forward, 1, 'aaaa walks'); assert.equal(log.rigs[1].updates[0].cam.move.forward, 0, 'bbbb stands');
  a.shown = pose(1.06, 1); pb.sync([a, b], toScene, 0.02, [0, 0, -10]);
  assert.ok(log.rigs[0].updates[1].cam.move.speed > 0 && log.rigs[0].updates[1].cam.move.speed < 3, 'the pace measured off the pose (0.06 in 0.02 s, eased)');
  assert.equal(pb.draw({}, V), 2);
  assert.deepEqual(log.rigs[1].draws[0].feet, [2, 0, -10]); assert.equal(log.rigs[1].draws[0].yaw, 0);
  a.shown = pose(1.1, 0, 1.5); pb.sync([a, b], toScene, 0.02, [0, 0, -10]); pb.draw({}, V);
  assert.deepEqual(log.rigs[0].draws.at(-1).feet, [1.1, 0, -10]);
  const first = log.rigs[0].draws.at(-1).yaw; assert.ok(first > 0 && first < 1.5, 'the yaw EASES toward the pose\'s (the rig reads turning off its change frame to frame)');
  assert.ok(Math.abs(log.rigs[0].updates.at(-1).cam.yaw - first) < 1e-12, 'the camera reads the same eased yaw the body is drawn at');
  for (let i = 0; i < 40; i++) pb.sync([a, b], toScene, 0.05, [0, 0, -10]); pb.draw({}, V);
  assert.ok(Math.abs(log.rigs[0].draws.at(-1).yaw - 1.5) < 1e-3, '...and lands on it');
  a.shown = pose(1.1, 0, 1.5 + 2 * Math.PI - 0.2); for (let i = 0; i < 40; i++) pb.sync([a, b], toScene, 0.05, [0, 0, -10]); pb.draw({}, V);
  assert.ok(Math.abs(log.rigs[0].draws.at(-1).yaw - 1.3) < 1e-3 || Math.abs(log.rigs[0].draws.at(-1).yaw - (1.3 + 2 * Math.PI)) < 1e-3, 'by the short arc');
  // the floating origin moved under the scene
  pb.offsetAll([-819.2, 0, 0]); pb.draw({}, V);
  assert.ok(Math.abs(log.rigs[0].draws.at(-1).feet[0] - (1.1 - 819.2)) < 1e-9, 'the feet follow the origin (D5)'); assert.ok(Math.abs(log.rigs[0].cam().pos[0] - (1.1 - 819.2)) < 1e-9);
  // a new look: a new rig, the old one unloaded - once BODY_REBUILD_MS has passed since the build (a rejoin with new gear every second is not a rebuild every second)
  a.look = { ...a.look, race: 'Khajiit' }; pb.sync([a, b], toScene, 0.02, [0, 0, -10]);
  assert.equal(log.rigs.length, 2, 'within BODY_REBUILD_MS: the old body stands'); assert.equal(log.rigs[0].unloaded, false);
  now += BODY_REBUILD_MS + 1; pb.sync([a, b], toScene, 0.02, [0, 0, -10]);
  assert.equal(log.rigs[0].unloaded, true); assert.equal(log.rigs.length, 3); await settle(); assert.equal(log.builds.at(-1), 'Khajiit');
  pb.destroy(); assert.equal(log.rigs[2].unloaded, true); assert.equal(pb.draw({}, V), 0);
});

test('MWBODY1: the linger, the jump and the range - a peer gone keeps its body BODY_LINGER_MS (no rebuild on a flicker) and is released after; a released body\'s build is skipped, and one in flight is unloaded when it lands; a jump resets the pace; past BODY_RANGE the rig sleeps and the doll stands (mutants: a flicker rebuilding the body, the released build run anyway, a snap read as a sprint)', async () => {
  const log = newLog();
  let now = 1000;
  const pb = new PeerBodies({ renderer: {}, createRig: rigFactory(log), buildOpts: (look) => ({ race: look.race }), now: () => now });
  const a = peer('aaaa', 'Nord', 1, 1);
  pb.sync([a], toScene, 0.016, [0, 0, -10]); await settle(); pb.sync([a], toScene, 0.016, [0, 0, -10]);
  assert.equal(pb.has('aaaa'), true);
  // flicker: gone for a frame, back the next - no release, no rebuild
  pb.sync([], toScene, 0.016, [0, 0, -10]); assert.equal(pb.has('aaaa'), false, 'gone: not standing'); assert.equal(pb.draw({}, V), 0);
  now += 1000; pb.sync([a], toScene, 0.016, [0, 0, -10]);
  assert.equal(pb.has('aaaa'), true, 'back: standing again'); assert.equal(log.rigs.length, 1, 'the same rig, not a rebuild'); assert.equal(log.rigs[0].unloaded, false);
  for (let i = 0; i < 10; i++) { pb.sync([], toScene, 0.016, [0, 0, -10]); now += 500; pb.sync([a], toScene, 0.016, [0, 0, -10]); }
  assert.equal(log.builds.length, 1, 'ten flickers: one build');
  // gone past the linger: released
  pb.sync([], toScene, 0.016, [0, 0, -10]); now += BODY_LINGER_MS + 1; pb.sync([], toScene, 0.016, [0, 0, -10]);
  assert.equal(log.rigs[0].unloaded, true); assert.equal(pb.has('aaaa'), false);
  // a body released before its build ran: no parse; one released mid-build: unloaded when it lands, and the NEW body of that id untouched
  const c = peer('cccc', 'Nord', 1, 0), d = peer('dddd', 'Redguard', 2, 0);
  pb.sync([c, d], toScene, 0.016, [0, 0, -10]);   // c builds first, d queued behind it
  const before = log.builds.length;
  pb.sync([c], toScene, 0.016, [0, 0, -10]); now += BODY_LINGER_MS + 1; pb.sync([c], toScene, 0.016, [0, 0, -10]);   // d gone past the linger while queued
  await settle();
  assert.equal(log.builds.length, before + 1, 'd\'s build never ran'); assert.equal(log.rigs.at(-1).unloaded, true);
  pb.sync([c, d], toScene, 0.016, [0, 0, -10]); const rigs = log.rigs.length;   // d again: a new rig, building
  now += BODY_REBUILD_MS + 1; c.look = { ...c.look, race: 'Khajiit' }; pb.sync([c, d], toScene, 0.016, [0, 0, -10]);   // c's look changes while its first rig stands: a new rig for c
  await settle();
  assert.equal(log.rigs.length, rigs + 1); assert.equal(pb.has('cccc'), false, 'the new body is not yet stepped'); pb.sync([c, d], toScene, 0.016, [0, 0, -10]);
  assert.equal(pb.has('cccc'), true, 'the new body stands'); assert.equal(pb.has('dddd'), true);
  // a jump: the pace resets instead of easing across it
  c.shown = pose(1 + JUMP_UNITS + 1, 1); pb.sync([c, d], toScene, 0.016, [0, 0, -10]);
  const rig = log.rigs.find((r) => r.opts?.race === 'Khajiit'); assert.equal(rig.updates.at(-1).cam.move.speed, 0, 'a jump is not a sprint');
  // the range: the rig sleeps, the doll stands
  c.shown = pose(BODY_RANGE + 50, 1); const steps = rig.updates.length; pb.sync([c, d], toScene, 0.016, [0, 0, -10]);
  assert.equal(rig.updates.length, steps, 'not stepped'); assert.equal(pb.has('cccc'), false, 'past BODY_RANGE: the doll'); assert.equal(pb.draw({}, V), 1, 'd alone');
  c.shown = pose(3, 1); pb.sync([c, d], toScene, 0.016, [0, 0, -10]); assert.equal(pb.has('cccc'), true, 'back in range: the body, the same rig'); assert.equal(log.rigs.length, rigs + 1);
});

test('MWBODY1: the cap and the failure - the nearest peers first, a far body yielding its slot to a nearer peer, a body that will not build (refused, or thrown) released with its reason kept and not tried again before BODY_RETRY_MS, a rig with no third-person body refused, the gate off releasing every body and building none (mutants: a failed build rebuilt every frame, the first eight forever)', async () => {
  const log = newLog();
  let now = 1000; let on = true;
  const pb = new PeerBodies({ renderer: {}, enabled: () => on, createRig: rigFactory(log, { okFor: (o) => o.race !== 'Nobody', throwFor: (o) => o.race === 'Throws' }), buildOpts: (look) => ({ race: look.race }), now: () => now });
  const crowd = Array.from({ length: BODIES_MAX + 3 }, (_, i) => peer('p' + i, 'Nord', 50 - i * 4));   // p10 nearest, p0 farthest
  pb.sync(crowd, toScene, 0.016, [0, 0, -10]); await settle(BODIES_MAX * 2 + 4); pb.sync(crowd, toScene, 0.016, [0, 0, -10]);
  assert.equal(log.rigs.length, BODIES_MAX, 'the cap'); assert.equal(pb.has('p10'), true, 'the nearest has a body'); assert.equal(pb.has('p0'), false, 'the farthest stands as a doll');
  assert.equal(pb.has('p2'), false); assert.equal(pb.has('p3'), true);
  // a bodiless peer comes near: the farthest body yields
  crowd[0].shown = pose(1); pb.sync(crowd, toScene, 0.016, [0, 0, -10]);
  assert.equal(log.rigs.length, BODIES_MAX + 1, 'one released, one built'); await settle(); pb.sync(crowd, toScene, 0.016, [0, 0, -10]);
  assert.equal(pb.has('p0'), true, 'the newcomer stands'); assert.equal(pb.has('p3'), false, 'the farthest body gave its slot');
  pb.destroy();
  const nob = peer('nob', 'Nobody', 0);
  pb.sync([nob], toScene, 0.016, [0, 0, -10]); await settle(); const tries = log.builds.filter((r) => r === 'Nobody').length;
  assert.equal(tries, 1); assert.equal(pb.has('nob'), false); assert.equal(log.rigs.at(-1).unloaded, true, 'a failed body is released');
  assert.equal(pb.failureOf(nob.look), 'data: no body records', 'the reason kept');
  pb.sync([nob], toScene, 0.016, [0, 0, -10]); pb.sync([nob], toScene, 0.016, [0, 0, -10]); await settle();
  assert.equal(log.builds.filter((r) => r === 'Nobody').length, tries, 'no retry before BODY_RETRY_MS');
  now += BODY_RETRY_MS + 1; pb.sync([nob], toScene, 0.016, [0, 0, -10]); await settle();
  assert.equal(log.builds.filter((r) => r === 'Nobody').length, tries + 1, 'one retry after it');
  const thr = peer('thr', 'Throws', 0); pb.sync([thr], toScene, 0.016, [0, 0, -10]); await settle();
  assert.equal(pb.has('thr'), false); assert.match(pb.failureOf(thr.look), /^threw: mesh parse/, 'a build that threw: released, the reason kept');
  const log2 = newLog(); const pb2 = new PeerBodies({ renderer: {}, createRig: rigFactory(log2, { third: false }), buildOpts: (l) => ({ race: l.race }), now: () => now });
  pb2.sync([peer('t', 'Nord')], toScene, 0.016, [0, 0, -10]); await settle(); pb2.sync([peer('t', 'Nord')], toScene, 0.016, [0, 0, -10]);
  assert.equal(pb2.has('t'), false, 'a build with no third-person body keeps the doll'); assert.equal(pb2.failureOf({ race: 'Nord', gender: 'male', faceIndex: 0, items: [] }), 'no third-person body');
  const a = peer('aaaa', 'Nord'); pb.sync([a], toScene, 0.016, [0, 0, -10]); await settle(); pb.sync([a], toScene, 0.016, [0, 0, -10]); assert.equal(pb.has('aaaa'), true);
  on = false; pb.sync([a], toScene, 0.016, [0, 0, -10]);
  assert.equal(pb.has('aaaa'), false); assert.equal(log.rigs.at(-1).unloaded, true, 'the gate off: released');
  const before = log.rigs.length; pb.sync([a], toScene, 0.016, [0, 0, -10]); assert.equal(log.rigs.length, before, '...and none built');
});

test('MWBODY1: the doll pass skips a peer in a body and its name still rides, at the body\'s own head; without the option every peer is a doll (mutant: the doll drawn under the body)', async () => {
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
  rp.sync([a, b], undefined); assert.equal(rp.batches().length, 2, 'no bodyHeight: every peer is a doll');
});

test('MWBODY1: the host - the gate is the enhanced skin (read once), the arms switch and Morrowind data; the bodies sync before the dolls, nearest first, and hand the dolls their height; the draw hook calls the bodies and the mode machine gets it; the bodies draw right after the player\'s own in the exterior pass and in both modal passes; the run bit rides the pose; the feet follow the origin; the dead stand no body', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const enhanced = isEnhanced\(\);[^\n]*\n\s*peerBodies = new PeerBodies\(\{ renderer, enabled: \(\) => enhanced && !!getPref\('mwArms'\) && morrowindDataCount\(\) > 0, generation: morrowindDataGeneration \}\);/, 'the enhanced skin, the arms switch, the data, and its generation');
  assert.match(w, /const drawable = online\.drawable\(\);\s*\n\s*peerBodies\.sync\(drawable, onlineToScene, dt, player\.pos\);[^\n]*\n\s*remotePlayers\.sync\(drawable, onlineToScene, \{ bodyHeight: \(id\) => peerBodies\.heightOf\(id\) \}\);/);
  assert.match(w, /const drawPeerBodies = \(proj, view, eye\) => \{ if \(peerBodies\) peerBodies\.draw\(canvas, \{ proj, view, eye \}\); \};/, 'the hook draws the bodies');
  assert.match(w, /drawPeerBodies: \(\{ proj, view, eye \}\) => drawPeerBodies\(proj, view, eye\),/, 'the mode machine gets the hook');
  assert.match(w, /mwViewDrawBody\(canvas, \{ proj, view, eye: mwv\.eye, feet: player\.feetAt\(\), yaw: cam\.yaw \}\);\s*\n\s*drawPeerBodies\(proj, view, mwv\.eye\);/, 'after the player\'s own body, the same pass');
  assert.match(w, /onlineFrame\(now, dt\)/, 'the frame\'s dt steps the bodies');
  assert.match(w, /const mv = moved \? \(player\.isRunning \? 2 : 1\) : 0;/, 'the run bit'); assert.match(w, /online\.sendPose\(\{ \.\.\.pose, mv \}\)/);
  assert.match(w, /online\.look = composeLook\(playerEntity\); online\.join\(key, \{ \.\.\.pose, mv \}\);/, 'the next room\'s hello carries the gear worn now');
  assert.match(w, /if \(peerBodies\) peerBodies\.offsetAll\(r\.offset\);/, 'the recenter shifts the bodies (D5)');
  assert.match(w, /instanceof DeathScreen\) \{ if \(online\.room\) online\.leave\(\); peerBodies\.destroy\(\); remotePlayers\.sync\(\[\], onlineToScene\); return; \}/, 'the dead stand no body and no doll');
  assert.match(w, /'pagehide', \(\) => \{ online\?\.leave\(\); for \(const link of chatLinks\?\.values\(\) \?\? \[\]\) link\.leave\(\); peerBodies\?\.destroy\(\); remotePlayers\?\.destroy\(\); \}/, 'the page\'s hide releases the rigs (and, CHAT1, leaves every channel in the same goodbye - the panel stays for a restore, AUDIT CHAT B4)');
  const m = rd('src/scenes/worldModes.js');
  assert.equal((m.match(/mwViewDrawBody\(canvas, \{ proj, view, eye: mwv\.eye, feet: player\.feetAt\(\), yaw: cam\.yaw \}\);   \/\/ MW-D24\n\s*host\.drawPeerBodies\?\.\(\{ proj, view, eye: mwv\.eye \}\);/g) || []).length, 2, 'the dungeon\'s and the interior\'s passes');
  const pbSrc = rd('src/net/peerBodies.js');
  assert.match(pbSrc, /import \{ createFpArm \} from '\.\.\/combat\/fpArm\.js';/, 'the factory, never the exported instance');
  assert.doesNotMatch(pbSrc, /\bfpArm\.(?!js)|import \{[^}]*\bfpArm\b/, 'the singleton is not touched (the module path is not a use)');
  assert.match(rd('src/scenes/dataSource.js'), /if \(_mwArchivesInflight && _mwArchivesInflight\.gen === _mwGeneration\) return _mwArchivesInflight\.promise;/, 'AUDIT MWBODY B10: two builds at once open the archives once');
});
