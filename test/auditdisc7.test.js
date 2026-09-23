// AUDIT DISC7 (2026-09-23, Mac: "Do an audit before we merge"): four lenses over DISC6 + DISC7, every verified finding
// paid and pinned here BY EXECUTION where the seam is a function (the by-source pins ride test/disc6.test.js and
// test/disc7.test.js). The record is bible/01-Overview/Field-Bugs-2026-09-23.md, section AUDIT DISC7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { mintQuestFoeWave, bindQuestFoeHost } from '../src/scenes/questFoeHost.js';
import { isAlreadyInjected } from '../src/systems/quest/sceneMount.js';
import { setLightSource, lightSourceListenerCount } from '../src/systems/lightSource.js';
import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR, CLIPS } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { nearestRank } from '../src/render/shadowPass.js';
import { createActivateGate, activateFrame } from '../src/systems/activateGate.js';
import { resolveHover, nextSelection } from '../src/systems/worldHover.js';
import { foldQuickLoot, quickLootWheel, plaqueActionSelection, plaqueLightFirst, resetQuickLoot } from '../src/systems/quickLoot.js';
import { socialPlaqueRows } from '../src/ui/socialMenu.js';
import { hccActionRows, HCC_ACTION_TEXT, WAGON_MODE, HORSE_MODE } from '../src/systems/horseCartLaw.js';
import { AmbientEffects, AMBIENT_RAIN_LOOP, INDOOR_RAIN_GAIN } from '../src/systems/ambientEffects.js';
import { AudioEngine } from '../src/systems/audio.js';
import { RemotePlayers, ridingLoopName, PEER_RIDE_STALE_MS } from '../src/net/remotePlayers.js';
import { SOUND } from '../src/systems/soundClips.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// ═══ C1: the torch listener outlives a toggle ═══════════════════════════
test('AUDIT DISC7 C1: the mod switched off and on again - the same component re-subscribes on its update, so a torch doused from an open inventory still falls silent at once (mutant: subscribed once, at birth)', () => {
  const defaults = Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const loops = [];
  const audio = { playOneShot() {}, play3d() {}, loop: (c, v) => { const l = { clip: c, volume: v, stopped: false, stop() { this.stopped = true; } }; loops.push(l); return l; } };
  const entity = { items: [], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const ht = createHandheldTorches({ settings: () => readTorchSettings(() => defaults), audio, say() {}, rolls: () => 0.5,
    torches: () => ({ spawnLightSource() {}, spawnLightSourceProjectile() {}, setOnPickedUp() {} }), handedness: () => false, loadSprite: async () => null });
  const ctx = { renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons() {} };
  const before = lightSourceListenerCount();
  const torch = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50, name: 'Torch' };
  entity.items = [torch];
  try {
    setLightSource(entity, torch);
    ht.update(0.016, ctx);
    ht.dispose();   // weaponRig: "the switch off is a teardown"
    assert.equal(lightSourceListenerCount(), before);
    ht.update(0.016, ctx);   // the switch back on runs the same component
    const burning = () => loops.filter((l) => !l.stopped && l.clip === CLIPS.burning).length;
    assert.equal(burning(), 1);
    setLightSource(entity, null);   // doused from the window, no rig tick
    assert.equal(burning(), 0, 'silent on the change, after a toggle too');
  } finally { ht.dispose(); }
  assert.equal(lightSourceListenerCount(), before, 'and nothing left listening');
});

// ═══ C2 / C3 / D7: the shared-quest resync ══════════════════════════════
const V = join(ROOT, 'vendor/dfu-quests/Tables');
const tables = {};
for (const f of readdirSync(V)) if (f.endsWith('.txt')) tables[f.replace('.txt', '')] = readFileSync(join(V, f), 'utf8').replace(/^﻿/, '');
loadQuestTables(tables);
const QUEST = ['Quest: __ATEST', 'QRC:', 'Message:  1020', ' Done.', '', 'QBN:', 'Foe _rats_ is 2 Giant_rat', '',
  '_mondead_ task:', ' killed 2 _rats_', ' say 1020', '', 'log 1010 step 0'];
function standUp() {
  const m = new QuestMachine({ nowSeconds: () => 0, showPopup() {} });
  const q = m.scheduleQuest(QUEST, 0, { rolls: () => 0 });
  m.tick();
  const foe = q.resources.get('rats');
  const pool = { removeFoe() {}, zeroFoeHealth(f) { f.entity.health = 0; }, foeSinks: () => ({}) };
  const behaviours = mintQuestFoeWave(m, foe, 1).map((h) => {
    const f = { entity: { health: 10, maxHealth: 10 }, ai: {}, dead: false };
    bindQuestFoeHost(f, h.behaviour, pool); return h.behaviour;
  });
  m.markQuestShared('__ATEST');
  return { m, q, foe, behaviours };
}

test('AUDIT DISC7 C2: the resync relinks the behaviours standing on the old resources AT ONCE - their symbol too - so the next Place mount sees them mounted and stands nothing twice (mutant: the symbol left stale)', () => {
  const { m, q, foe, behaviours } = standUp();
  const partner = q.getSaveData();
  m.updateSharedQuest('__ATEST', partner);   // no update() runs between this and a mount
  const live = q.resources.get('rats');
  assert.notEqual(live, foe, 'the resync rebuilt the Foe');
  const b = behaviours[0];
  assert.equal(b.targetResource, live, 'relinked by the resync itself');
  assert.equal(b.targetSymbol, live.symbol, 'and to the symbol the live resource carries');
  assert.equal(isAlreadyInjected(behaviours, live), true, 'so the mount guard sees it standing');
});

test('AUDIT DISC7 C3 + D7: the resync keeps this world\'s foe queues (the longer one) and the flags its own events set (injured, a pending kill) - not a restraint, which is the quest\'s word on both sides (mutants: the queue replaced; the restraint ORed back)', () => {
  const { m, q, foe } = standUp();
  const partner = q.getSaveData();   // taken before this world's changes
  foe.spellQueue = [{ id: 'a' }, { id: 'b' }];
  foe.itemQueue = [{ name: 'x' }, { name: 'y' }];
  foe.injuredTrigger = true;
  foe.deathTrigger = true;
  foe.isRestrained = true;
  m.updateSharedQuest('__ATEST', partner);
  const live = q.resources.get('rats');
  assert.equal(live.spellQueue.length, 2, 'this world\'s queued spells stand - a shorter one under a cursor re-cast them');
  assert.equal(live.itemQueue.length, 2, 'and its queued items - a shorter one re-added the whole queue');
  assert.equal(live.injuredTrigger, true, 'an injury here stays');
  assert.equal(live.deathTrigger, true, 'a kill pending here stays (no save state carries it)');
  assert.equal(live.isRestrained, false, 'the partner\'s word on a restraint stands');
});

// ═══ C6: the redraw goes to the truly nearest ═══════════════════════════
test('AUDIT DISC7 C6: the every-frame redraw is for the casters truly nearest the eye, not the keep margin\'s order (mutant: the margin\'s rank)', () => {
  const lights = [10, 0, 0, 15, 2, 0, 0, 15, 5, 0, 0, 15];
  const casters = [0, 1, 2];   // the pick kept light 0 first on the margin
  assert.equal(nearestRank(casters, lights, [0, 0, 0], 0), 2, 'the held lamp at 10 m is third nearest');
  assert.equal(nearestRank(casters, lights, [0, 0, 0], 1), 0);
  assert.equal(nearestRank(casters, lights, [0, 0, 0], 2), 1);
  assert.equal(nearestRank([0, 1], [3, 0, 0, 1, 3, 0, 0, 1], [0, 0, 0], 1), 1, 'a tie goes to the earlier rank');
  assert.match(rd('src/render/shadowPass.js'), /const due = nearestRank\(casters, L, f\.eye, rank\) < SHADOW_NEAR_CASTERS/);
  assert.match(rd('src/render/airPass.js'), /if \(!\(w > 0 && h > 0\)\) \{ this\.f = null; this\.prevValid = false; return; \}/, 'C7: a bailed frame leaves no previous one');
});

// ═══ A1: a press that cast ══════════════════════════════════════════════
test('AUDIT DISC7 A1: the gate says a release ended a press that CAST - a touch spell\'s release activates as DFU lets it, and the plaque\'s player arm does not also fire on it (mutant: the flag never set)', () => {
  const g = createActivateGate();
  activateFrame(g, { down: true, hasReadySpell: true, touchSpell: true });
  assert.deepEqual(activateFrame(g, { down: false, hasReadySpell: true, touchSpell: true }), { cast: false, activate: true, pressCast: true });
  activateFrame(g, { down: true });
  assert.equal(activateFrame(g, { down: false }).pressCast, false, 'a plain press after it is not a cast');
});

// ═══ A2 / A3 / A4 / A7: the plaque's player rows ════════════════════════
const peerFrame = (acts) => resolveHover({ key: 'peer:p', distance: 1, reach: 3 }, { name: () => ({ title: 'Ann', actions: socialPlaqueRows('p', acts), actionsUnlit: true }) });

test('AUDIT DISC7 A2/A3/A4/A7: a player\'s list starts UNLIT (a plain click sends nothing), F or the wheel lights it, the lit verb follows its own row when the list changes, a refused verb is listed with its reason, and a single lit verb leaves the wheel to the camera', () => {
  resetQuickLoot();
  try {
    const all = { canFriend: true, canInvite: true, canTrade: true };
    let f = peerFrame(all);
    assert.equal(f.startUnlit, true);
    foldQuickLoot(f);
    assert.deepEqual(plaqueActionSelection(), { key: 'peer:p', id: null }, 'nothing lit');
    assert.equal(plaqueLightFirst('peer:p'), true, 'F lights the first row');
    assert.deepEqual(plaqueActionSelection(), { key: 'peer:p', id: 'friend' });
    assert.equal(plaqueLightFirst('peer:p'), false, 'and only an unlit list');
    quickLootWheel(120); foldQuickLoot(f);
    assert.equal(plaqueActionSelection().id, 'invite');
    // the friend request lands: its row is refused now, and the lit INVITE stays lit (it did not slide onto trade)
    f = peerFrame({ ...all, canFriend: false, whyNotFriend: 'request sent' });
    foldQuickLoot(f);
    assert.equal(plaqueActionSelection().id, 'invite', 'the highlight follows its verb');
    assert.equal(f.rows[0].name, 'Add friend (request sent)', 'the refusal is on the row, in the card\'s words');
    assert.equal(f.rows[0].disabled, true);
    quickLootWheel(-120); quickLootWheel(-120); foldQuickLoot(f);
    assert.equal(plaqueActionSelection().id, null, 'the wheel steps back off the top to unlit');
    // a list that drops a row keeps the lit one by id
    const sel = nextSelection({ key: 'k', row: 1, id: 'b' }, { key: 'k', rows: [{ id: 'b' }, { id: 'c' }] }, 0);
    assert.deepEqual(sel, { key: 'k', row: 0, id: 'b' });
    // one lit verb: the wheel is the camera's
    const one = resolveHover({ key: 'hccHorse', distance: 1, reach: 3 }, { name: () => ({ title: 'Horse', actions: [{ id: 'grab', label: 'Ride' }] }) });
    foldQuickLoot(one);
    assert.equal(quickLootWheel(120), false);
  } finally { resetQuickLoot(); }
});

// ═══ A10: the wagon over a hitched team ═════════════════════════════════
test('AUDIT DISC7 A10: the parked wagon over a team left hitched reads "Drive the wagon", as the horse\'s own row does for the same hitch', () => {
  assert.equal(hccActionRows('deployedWagon', { wagonMode: WAGON_MODE.Deployed, horseMode: HORSE_MODE.HitchedToWagon })[0].label, HCC_ACTION_TEXT.drive);
  assert.equal(hccActionRows('deployedWagon', { wagonMode: WAGON_MODE.Deployed, horseMode: HORSE_MODE.FollowingPlayer })[0].label, HCC_ACTION_TEXT.hitch);
});

// ═══ B1: the rain through the walls ═════════════════════════════════════
test('AUDIT DISC7 B1: a building hears the street\'s own rain through the walls - never louder than the street, whatever the front\'s intensity - and underground the street\'s gain carries on (mutant: gain 1 indoors)', () => {
  for (const street of [0.15, 0.35, 0.6, 1]) {
    const loops = [];
    const engine = { play3d: () => 2, playOneShot: () => 2, loop(index, volume) { const h = { index, volumes: [volume], stopped: false, stop() { this.stopped = true; }, setVolume(v) { this.volumes.push(v); } }; loops.push(h); return h; } };
    const a = new AmbientEffects({ minWait: 5, maxWait: 25 }, engine, () => 0);
    a.setPreset('rain');
    a.rainGain = street;   // the front's intensity, set by the street's frame
    a.update(0.1, { inside: false });
    const rain = loops.find((h) => h.index === AMBIENT_RAIN_LOOP);
    const out = rain.volumes.at(-1);
    a.update(0.1, { inside: true });   // the host no longer touches rainGain indoors
    assert.ok(rain.volumes.at(-1) <= out, `street ${street}: the tavern ${rain.volumes.at(-1)} is not louder`);
    assert.ok(Math.abs(rain.volumes.at(-1) - street * INDOOR_RAIN_GAIN) < 1e-9);
    a.update(0.1, { inside: true, underground: true });
    assert.ok(Math.abs(rain.volumes.at(-1) - street) < 1e-9, 'underground: the street\'s own gain');
  }
});

// ═══ B3 / B4 / B6 / B7: the riders' sound ═══════════════════════════════
function rig() {
  const param = () => ({ value: 0 });
  const panners = [];
  const ctx = {
    state: 'running', destination: { connect(n) { return n; } },
    listener: { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() },
    createGain: () => ({ gain: param(), connect(n) { return n; }, disconnect() {} }),
    createPanner: () => { const p = { positionX: param(), positionY: param(), positionZ: param(), connect(n) { return n; }, disconnect() {} }; panners.push(p); return p; },
    createBufferSource: () => ({ buffer: null, playbackRate: param(), loop: false, connect(n) { return n; }, start() {}, stop() {}, disconnect() {} }),
  };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true; e._ensureCtx = () => {};
  for (const k of [SOUND.HorseClop2, SOUND.HorseClop, SOUND.HorseAndCart, SOUND.AnimalHorse]) e.buffers.set(k, { duration: 0.5 });
  return { e, panners };
}
const rider = (x, extra = {}) => ({ id: 'bob-0001', name: 'bob', shown: { x, y: 0, z: 4, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, fk: 0, rd: 1, rv: 0, ...extra }, look: null });
const toScene = (p) => [p.x, p.y, p.z];

test('AUDIT DISC7 B3/B4: a rider whose poses stopped stands (no frozen gallop), nothing is made past earshot, and a rider first seen already mounted does not neigh a mount (mutants: the pose age ignored; the loop past earshot)', () => {
  const { e } = rig();
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: e }, compose: async () => null });
  let age = 0;
  const sync = (p, eye = [0, 1.7, 0], dt = 1 / 30) => rp.sync([p], toScene, { bodyHeight: () => 2, eye, dt, poseAgeMs: () => age });
  sync(rider(1));
  assert.ok(e._loops3d.has(ridingLoopName('bob-0001')), 'riding and heard');
  const r = rp._riding.get('bob-0001');
  assert.ok(r.anim.neighTime - r.anim.now >= 2, 'first seen in the saddle: the ordinary neigh cadence, not the mount\'s 1-4 s');
  age = PEER_RIDE_STALE_MS + 1;
  sync(rider(1), undefined, 0.1); sync(rider(1), undefined, 0.3);   // the stop arms, then DFU's 0.2 s runs out
  assert.equal(e._loops3d.has(ridingLoopName('bob-0001')), false, 'a stale pose stands the horse (after DFU\'s 0.2 s stop)');
  age = 0;
  sync(rider(1));
  assert.ok(e._loops3d.has(ridingLoopName('bob-0001')));
  sync(rider(100), [0, 1.7, 0]);
  assert.equal(e._loops3d.has(ridingLoopName('bob-0001')), false, 'past earshot: no panner, no source');
  sync(rider(1));
  assert.ok(e._loops3d.has(ridingLoopName('bob-0001')), 'and back in range, back in step');
  // seen on foot, then mounted: that IS a mount
  const rp2 = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: rig().e }, compose: async () => null });
  rp2.sync([rider(1, { rd: 0 })], toScene, { eye: [0, 1.7, 0], dt: 1 / 30 });
  rp2.sync([rider(1)], toScene, { eye: [0, 1.7, 0], dt: 1 / 30 });
  const r2 = rp2._riding.get('bob-0001');
  assert.ok(r2.anim.neighTime - r2.anim.now <= 4, 'a real mount neighs soon (UpdateMode)');
});

test('AUDIT DISC7 B6/B7: the riders\' loops move with the floating origin in the frame it moves, and a loop whose clip could not play comes back when it can (mutants: no rebase; the dead channel)', () => {
  const { e, panners } = rig();
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: e }, compose: async () => null });
  rp.sync([rider(1)], toScene, { eye: [0, 1.7, 0], dt: 1 / 30 });
  rp.rebaseSounds([-819.2, 0, 0]);
  assert.ok(Math.abs(panners.at(-1).positionX.value - (1 - 819.2)) < 1e-9, 'moved with the origin');
  // B7: a clip with no buffer builds nothing; a dead channel re-arms on the next set
  const { e: e2, panners: p2 } = rig();
  e2.buffers.delete(SOUND.HorseClop2);
  e2.buffers.set(SOUND.HorseClop2, null);
  assert.equal(e2.setLoop3d('x', SOUND.HorseClop2, [0, 0, 0]), null);
  assert.equal(p2.length, 0, 'no panner for a clip that cannot play');
  const ch = e2.setLoop3d('y', SOUND.HorseClop, [0, 0, 0]);
  ch.want = SOUND.HorseClop2; ch.playing = null;   // the swapped-to clip failed at the seam
  e2.buffers.set(SOUND.HorseClop2, { duration: 0.5 });
  e2.setLoop3d('y', SOUND.HorseClop2, [0, 0, 0]);
  assert.ok(ch.playing, 'the next set re-arms it');
});
