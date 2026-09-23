// DISC7 (2026-09-23, Mac: "1. fix the known gaps 2. for player interaction and horse interaction, instead of using a
// keybind toggle, let's reuse the loot scroll menu to select options"). Pinned by execution where the seam is a
// function, by source where it is a call in a frame:
//   - ACT-MENU: the World Tooltips plaque lists VERBS as it lists a pile's items - a player's (add friend, invite,
//     trade) and my horse's and wagon's (ride, follow / wait, name, hitch, open) - the wheel lights one and the
//     activate key presses it (systems/worldHover.js 'actions', systems/quickLoot.js, horseCartLaw.js hccActionRows,
//     player/socialPick.js peerActionRows, the hosts' presses).
//   - The peers' clop: the pose carries the rider's half-speed flag (`hs`, world100) and the riding loop swaps on it.
//   - The torch loop follows the light in hand (systems/lightSource.js), not the rig's clock under an open window.
//   - The contact shadow samples the previous frame's depth through its world rect (render/airPass.js holdPrevRect).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHover, frameSignature } from '../src/systems/worldHover.js';
import { foldQuickLoot, quickLootWheel, plaqueActionFor, plaqueActionSelection, quickLootArm, quickLootStats, resetQuickLoot, quickLootRow } from '../src/systems/quickLoot.js';
import { worldHoverFrame } from '../src/ui/worldPlaque.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
import { hccActionRows, HCC_ACTION_TEXT, ACTIVATE_MODE, WAGON_MODE, HORSE_MODE, TRANSPORT, HCC_TEXT } from '../src/systems/horseCartLaw.js';
import { makeWorld } from './hccWorld.mjs';
import { peerActionRows, peerActOf, peerRelationText, PEER_ACT_KINDS } from '../src/player/socialPick.js';
import { socialMenuRows } from '../src/ui/socialMenu.js';
import { WHY_IN_PARTY } from '../src/net/social.js';
import { setLightSource, addLightSourceListener, lightSourceListenerCount } from '../src/systems/lightSource.js';
import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR, CLIPS } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES, useItem } from '../src/systems/useItem.js';
import { holdPrevRect, AIR_CONTACT_GLSL } from '../src/render/airPass.js';
import { validPose, poseChanged, RELAY_VERSION } from '../src/net/wire.js';
import { lerpPose } from '../src/net/online.js';
import { AudioEngine } from '../src/systems/audio.js';
import { RemotePlayers, ridingLoopName } from '../src/net/remotePlayers.js';
import { SOUND } from '../src/systems/soundClips.js';
import { RIDING_VOLUME_SCALE } from '../src/systems/riding.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// ═══ ACT-MENU: the plaque's verbs ═══════════════════════════════════════
const verbs = (key, acts) => resolveHover({ key, distance: 1, reach: 3 }, { name: () => ({ title: 'Ann', subs: ['Friend'], actions: acts }) });

test('ACT-MENU: a namer that answers verbs gets an ACTIONS frame - the same rows the wheel moves through a pile, each carrying what it does; no verbs is the plain name it always was', () => {
  const f = verbs('peer:a', [{ id: 'friend', label: 'Add friend' }, { id: 'trade', label: 'Trade' }]);
  assert.equal(f.kind, 'actions');
  assert.deepEqual(f.rows.map((r) => [r.name, r.id]), [['Add friend', 'friend'], ['Trade', 'trade']]);
  assert.deepEqual(f.subs, ['Friend']);
  assert.equal(verbs('peer:a', []).kind, 'name', 'nothing to offer: the name alone');
  assert.equal(verbs('peer:a', [{ id: null, label: 'x' }, { id: 'a', label: '' }]).kind, 'name', 'a row with no id or no word is no verb');
  assert.notEqual(frameSignature(f), frameSignature(verbs('peer:a', [{ id: 'friend', label: 'Add friend' }])), 'a verb gone repaints');
  // the ids are not painted, so they are not in the signature - the press reads them fresh off every frame's fold
});

test('ACT-MENU: the wheel lights a verb whatever the loot switch says, the press reads it by key, the loot keys never arm on it, and a plaque that stands down forgets it (mutants: the switch gates the verbs; the stale highlight pressed)', () => {
  const was = getPref('quickLoot');
  try {
    setPref('quickLoot', false);
    resetQuickLoot();
    const f = verbs('hccHorse', [{ id: 'grab', label: 'Ride' }, { id: 'dialogue', label: 'Follow me' }, { id: 'info', label: 'Name' }]);
    foldQuickLoot(f);
    assert.equal(plaqueActionFor('hccHorse'), 'grab', 'a new key lights the top row');
    assert.equal(quickLootWheel(120), true, 'the wheel is the verbs\' with quick loot off');
    foldQuickLoot(f);
    assert.equal(plaqueActionFor('hccHorse'), 'dialogue');
    assert.equal(quickLootRow(f), 1, 'and the draw lights that row');
    assert.deepEqual(plaqueActionSelection(), { key: 'hccHorse', id: 'dialogue' });
    assert.equal(plaqueActionFor('hccWagon'), null, 'a press on another key reads nothing');
    quickLootWheel(120); quickLootWheel(120); foldQuickLoot(f);
    assert.equal(plaqueActionFor('hccHorse'), 'info', 'clamped at the last row');
    setPref('quickLoot', true);
    assert.equal(quickLootArm('QuickLootAll'), false, 'P takes from a pile, never from a list of verbs');
    assert.deepEqual(quickLootStats(f), [], 'a verb has no stats');
    // the items frame keeps its own law
    setPref('quickLoot', false);
    foldQuickLoot({ key: 'loot:1', kind: 'items', rows: [{ name: 'a' }], subs: [], title: 'x' });
    assert.equal(plaqueActionSelection(), null, 'a pile is not a list of verbs, and with quick loot off nothing is lit');
    foldQuickLoot(f);
    assert.ok(plaqueActionSelection());
    worldHoverFrame({});   // the plaque stands down (no enhanced skin in node) - and folds nothing
    assert.equal(plaqueActionSelection(), null, 'no highlight survives a plaque that is not showing');
  } finally { setPref('quickLoot', was); resetQuickLoot(); }
});

test('ACT-MENU: the plaque draws the verbs as the loot list\'s rows, the lit one marked; the hosts press them - the horse and wagon with the lit mode, a player through the F-menu\'s own door, F where the plaque stands', () => {
  const plaque = rd('src/ui/worldPlaque.js');
  assert.match(plaque, /if \(f\.kind === 'actions'\) \{[\s\S]*?row\.className = 'wplaque-row wplaque-act';\s*\n\s*if \(i === sel\) row\.classList\.add\('sel'\);/);
  assert.match(plaque, /if \(!worldPlaqueOn\(\)\) \{ foldQuickLoot\(null\); hideWorldPlaque\(\); return null; \}/);
  assert.match(plaque, /if \(cursorActive \|\| !eye \|\| !dir \|\| !collider\) \{ foldQuickLoot\(null\); showWorldPlaque\(null\); return null; \}/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(rd(host), /hcc\.activate\(_hccPick\.key, _hccPick\.distance, \(l\) => townTalk\.say\(l\), \(\) => setMidScreenText\(TOO_FAR_AWAY_TEXT\), plaqueActionFor\(_hccPick\.key\)\);/, host);
  }
  const w = rd('src/scenes/world.js');
  assert.match(w, /else if \(_tapLockOnly\) \{[^\n]*\}\s*\n\s*else if \(plaquePeerAct\(\)\) \{/, 'the street: a player the plaque lit takes the press ahead of the ladder');
  assert.match(rd('src/scenes/worldModes.js'), /if \(\(_act\.activate \|\| useEdge\) && !overlayHeld && !host\.plaquePeerAct\?\.\(\)\) \(mode === 'dungeon' \? tryExitDungeon : tryExit\)\(\);/, 'the building and the dungeon');
  assert.match(w, /plaquePeerAct: \(\) => plaquePeerAct\(\),/);
  assert.match(w, /if \(worldPlaqueOn\(\)\) \{ if \(plaquePeerAct\(\)\) return true; \}/, 'F presses the lit verb where the plaque stands');
  assert.match(w, /if \(worldPlaqueOn\(\)\) return true;   \/\/ ACT-MENU/, 'and opens no card over the world there');
  assert.match(w, /const act = peerActionRows\(acts\)\.some\(\(r\) => r\.id === sel\.id\) \? peerActOf\(sel\.id, id\) : null;\s*\n\s*if \(act\) peerAct\?\.\(act\);/, 'the verb re-read from the bag at the press');
  assert.match(w, /onAct: \(act\) => peerAct\(act\),/, 'the card and the plaque leave by one door');
  assert.match(w, /subs: \[cast, peerRelationText\(acts\)\]\.filter\(Boolean\), actions: peerActionRows\(acts\) \}/);
});

test('ACT-MENU: a player\'s verbs are the F-menu\'s enabled acts, in its order and words, each pressing the act the card\'s row would; the relation stands under the name (mutants: a refused act listed; the seat after the friendship)', () => {
  const all = { canFriend: true, canInvite: true, canTrade: true, tradeLabel: null };
  assert.deepEqual(peerActionRows(all), [{ id: 'friend', label: 'Add friend' }, { id: 'invite', label: 'Invite to party' }, { id: 'trade', label: 'Trade' }]);
  assert.deepEqual(peerActionRows({ ...all, canFriend: false }).map((r) => r.id), ['invite', 'trade'], 'a refused act is no row');
  assert.equal(peerActionRows({ canTrade: true, tradeLabel: 'Accept trade' })[0].label, 'Accept trade');
  assert.deepEqual(peerActionRows(null), []);
  const card = socialMenuRows({ peerId: 'p1', ...all }).filter((r) => r.act);
  for (const r of card) assert.deepEqual(peerActOf(r.key, 'p1'), r.act, `${r.key}: the plaque's press is the card's act`);
  assert.deepEqual(peerRelationText({ whyNotInvite: WHY_IN_PARTY, relation: 'friend' }), 'In your party');
  assert.equal(peerRelationText({ relation: 'friend' }), 'Friend');
  assert.equal(peerRelationText({ relation: 'none' }), null);
  assert.equal(peerActOf('cancel', 'p1'), null); assert.equal(peerActOf('friend', ''), null);
  assert.deepEqual(Object.keys(PEER_ACT_KINDS), ['friend', 'invite', 'trade']);
});

test('ACT-MENU: my horse\'s and wagon\'s verbs are the mod\'s decision - the ride or the drive, the command the horse can take now (follow / wait, with or without the wagon), the name; the wagon\'s hitch or drive and its pack (mutants: a command the horse cannot take listed; the drive called a ride)', () => {
  const loose = hccActionRows('horse', { wagonMode: WAGON_MODE.Deployed, horseMode: HORSE_MODE.LooseStationary, ownsCart: true });
  assert.deepEqual(loose, [{ id: ACTIVATE_MODE.Grab, label: HCC_ACTION_TEXT.ride }, { id: ACTIVATE_MODE.Talk, label: HCC_ACTION_TEXT.follow }, { id: ACTIVATE_MODE.Info, label: HCC_ACTION_TEXT.name }]);
  assert.equal(hccActionRows('horse', { wagonMode: WAGON_MODE.Deployed, horseMode: HORSE_MODE.FollowingPlayer, ownsCart: true })[1].label, HCC_ACTION_TEXT.wait);
  const hitched = hccActionRows('horse', { wagonMode: WAGON_MODE.Deployed, horseMode: HORSE_MODE.HitchedToWagon, ownsCart: true });
  assert.deepEqual(hitched.map((r) => r.label), [HCC_ACTION_TEXT.drive, HCC_ACTION_TEXT.followTeam, HCC_ACTION_TEXT.name], 'a hitched team: the drive and the team\'s follow');
  assert.deepEqual(hccActionRows('horse', { wagonMode: WAGON_MODE.WithPlayer, horseMode: HORSE_MODE.WithPlayer, ownsCart: false }).map((r) => r.id), [ACTIVATE_MODE.Grab, ACTIVATE_MODE.Info], 'no command the horse cannot take here');
  assert.deepEqual(hccActionRows('deployedWagon', {}).map((r) => [r.id, r.label]), [[ACTIVATE_MODE.Grab, HCC_ACTION_TEXT.hitch], [ACTIVATE_MODE.Steal, HCC_ACTION_TEXT.openWagon]]);
  assert.deepEqual(hccActionRows('followingWagon', {}).map((r) => r.label), [HCC_ACTION_TEXT.drive, HCC_ACTION_TEXT.openWagon]);
  assert.deepEqual(hccActionRows('peer', {}), []);
});

test('ACT-MENU: the runtime presses the lit verb in its own handlers whatever the interaction mode - Follow me, Wait here and Name with the mode left at Grab, and the wagon\'s pack; with no verb the mode decides as the mod does (mutant: the override ignored)', () => {
  const { rt, w, step, walk, state } = makeWorld();
  step();
  assert.equal(rt.tryUseTransport(TRANSPORT.Horse).succeeded, true);
  step(); walk(30); w.mode = TRANSPORT.Foot; step(2);
  assert.equal(state().HorseMode, HORSE_MODE.LooseStationary);
  w.activateMode = 'grab';
  assert.deepEqual(rt.actionRows('horse').map((r) => r.id), ['grab', 'dialogue', 'info']);
  assert.equal(rt.handleStationaryHorseActivation(2, 'dialogue'), true);
  assert.equal(state().HorseMode, HORSE_MODE.FollowingPlayer, 'the verb, not the mode'); assert.equal(w.said.at(-1), 'Your horse follows you.');
  assert.equal(rt.actionRows('horse')[1].label, HCC_ACTION_TEXT.wait, 'the row follows the state');
  assert.equal(rt.handleStationaryHorseActivation(2, 'dialogue'), true);
  assert.equal(state().HorseMode, HORSE_MODE.LooseStationary); assert.equal(w.said.at(-1), 'Your horse waits here.');
  assert.equal(rt.handleStationaryHorseActivation(2, 'info'), true);
  assert.equal(w.prompt.label, HCC_TEXT.nameYourHorse);
  w.prompt.open = false;
  assert.equal(rt.handleStationaryHorseActivation(2), true, 'no verb: the mode (Grab) rides');
  assert.equal(w.mode, TRANSPORT.Horse);
  // the wagon's pack under Grab
  const b = makeWorld();
  b.step(); b.rt.tryUseTransport(TRANSPORT.Cart); b.step(); b.walk(10); b.w.mode = TRANSPORT.Foot; b.step(3);
  b.w.activateMode = 'grab';
  assert.equal(b.rt.handleDeployedWagonActivation(2, 'steal'), true);
  assert.equal(b.w.openedInv, 1, 'Open the wagon, with the mode at Grab');
  assert.equal(b.w.mode, TRANSPORT.Foot, 'and nothing hitched');
});

test('ACT-MENU by source: the pool hands the runtime\'s rows to the plaque with my three and passes the lit mode to the handlers; the runtime reads the verb before the mode', () => {
  const pool = rd('src/scenes/horseCartPool.js');
  assert.match(pool, /if \(key === KEY_WAGON\) return withActions\(\{ title: WAGON_HOVER_TEXT \}, 'deployedWagon'\);/);
  assert.match(pool, /if \(key === KEY_HORSE\) return withActions\(\{ title: runtime \? runtime\.horseTargetLabel : horseTargetLabel\(''\) \}, 'horse'\);/);
  assert.match(pool, /if \(key === KEY_WAGON\) return runtime\.handleDeployedWagonActivation\(distance, mode\);/);
  assert.match(pool, /if \(key === KEY_HORSE\) return runtime\.handleStationaryHorseActivation\(distance, mode\);/);
  const rt = rd('src/systems/horseCart.js');
  assert.equal((rt.match(/if \(\(mode \?\? deps\.activateMode\(\)\) === ACTIVATE_MODE\.Steal\)/g) ?? []).length, 2, 'both wagons');
  assert.match(rt, /const mode = modeOverride \?\? deps\.activateMode\(\);/);
});

// ═══ the peers' clop ════════════════════════════════════════════════════
test('DISC7 wire: the rider\'s half-speed bit rides the pose mounted and moving slow only, omitted at 0 so every other pose keeps its bytes; its edge goes out at once and the eased pose carries it (world100)', () => {
  const base = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1, rd: 1, rv: 0 };
  assert.equal(validPose({ ...base, hs: 1 }).hs, 1);
  assert.equal('hs' in validPose({ ...base, hs: 0 }), false, 'omitted at 0');
  assert.equal('hs' in validPose({ ...base, rd: 0, hs: 1 }), false, 'on foot there is no ride to be slow on');
  assert.equal(poseChanged(validPose({ ...base, hs: 1 }), validPose(base)), true);
  assert.equal(lerpPose(validPose(base), validPose({ ...base, hs: 1 }), 0.5).hs, 1);
  assert.equal('hs' in lerpPose(validPose(base), validPose(base), 0.5), false);
  assert.equal(RELAY_VERSION, 'world100');
  assert.match(rd('src/scenes/world.js'), /hs: riding && moved && player\.movingLessThanHalfSpeed \? 1 : 0,/);
});

test('DISC7 riding sound: a peer riding below half speed swaps to the slow clop at half the volume, and back to the fast one on the edge - the rider\'s own TransportManager law (mutant: the bit ignored)', () => {
  const param = () => ({ value: 0 });
  const ctx = {
    state: 'running', destination: { connect(n) { return n; } },
    listener: { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() },
    createGain: () => { const g = { gain: param(), connect(n) { return n; }, disconnect() {} }; return g; },
    createPanner: () => ({ positionX: param(), positionY: param(), positionZ: param(), connect(n) { return n; }, disconnect() {} }),
    createBufferSource: () => ({ buffer: null, playbackRate: param(), loop: false, connect(n) { return n; }, start() {}, stop() {}, disconnect() {} }),
  };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true; e._ensureCtx = () => {};
  for (const k of [SOUND.HorseClop2, SOUND.HorseClop, SOUND.AnimalHorse]) e.buffers.set(k, { duration: 0.5 });
  const volumes = [];
  const setLoop3d = e.setLoop3d.bind(e);
  e.setLoop3d = (name, clip, pos, opts) => { if (opts) volumes.push(opts.volume); return setLoop3d(name, clip, pos, opts); };
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: e }, compose: async () => null });
  const peer = (hs) => ({ id: 'bob-0001', name: 'bob', shown: { x: 1, y: 0, z: 4, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, fk: 0, rd: 1, rv: 0, ...(hs ? { hs: 1 } : {}) }, look: null });
  const sync = (p) => rp.sync([p], (s) => [s.x, s.y, s.z], { bodyHeight: () => 2, eye: [0, 1.7, 0], dt: 1 / 30 });
  sync(peer(false));
  const ch = e._loops3d.get(ridingLoopName('bob-0001'));
  assert.equal(ch.want, SOUND.HorseClop2);
  assert.equal(volumes.at(-1), RIDING_VOLUME_SCALE, 'full speed: the fast clop, full volume');
  sync(peer(true));
  assert.equal(ch.want, SOUND.HorseClop, 'below half speed: the slow clop');
  assert.equal(volumes.at(-1), RIDING_VOLUME_SCALE * 0.5, 'at half the volume');
  sync(peer(false));
  assert.equal(ch.want, SOUND.HorseClop2, 'and back on the edge');
});

// ═══ the torch loop follows the light ═══════════════════════════════════
test('DISC7 torch: the light in hand has one door and it says when it changes - a torch doused from an open inventory (the rig\'s frame held) stops its loop on the change, and a disposed component stops listening (mutant: the listener never stops the loop)', () => {
  const defaults = Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const loops = [];
  const audio = { playOneShot() {}, play3d() {}, loop: (c, v) => { const l = { clip: c, volume: v, stopped: false, stop() { this.stopped = true; } }; loops.push(l); return l; } };
  const entity = { items: [], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const before = lightSourceListenerCount();
  const ht = createHandheldTorches({ settings: () => readTorchSettings(() => defaults), audio, say() {}, rolls: () => 0.5,
    torches: () => ({ spawnLightSource() {}, spawnLightSourceProjectile() {}, setOnPickedUp() {} }), handedness: () => false, loadSprite: async () => null });
  assert.equal(lightSourceListenerCount(), before + 1);
  const ctx = { renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons() {} };
  const torch = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50, name: 'Torch' };
  entity.items = [torch];
  setLightSource(entity, torch);
  ht.update(0.016, ctx);
  const burning = () => loops.filter((l) => !l.stopped && l.clip === CLIPS.burning).length;
  assert.equal(burning(), 1, 'lit: the loop');
  useItem(torch, entity.items, { entity });   // the inventory's Use: douse - and the rig does NOT tick (the window holds its frame)
  assert.equal(entity.lightSource, null);
  assert.equal(burning(), 0, 'doused: silent at once, with no update');
  ht.dispose();
  assert.equal(lightSourceListenerCount(), before, 'the torn-down component stops listening');
  // the door itself: only a real change is said, and a throwing listener does not stop the write
  const heard = [];
  const off = addLightSourceListener((e2, now, was) => heard.push([now, was]));
  const offBad = addLightSourceListener(() => { throw new Error('x'); });
  const e2 = { lightSource: null };
  setLightSource(e2, torch); setLightSource(e2, torch); setLightSource(e2, null);
  assert.deepEqual(heard, [[torch, null], [null, torch]]);
  off(); offBad();
  for (const [f, re] of [['src/systems/useItem.js', /setLightSource\(entity, null\);/], ['src/systems/useItem.js', /setLightSource\(entity, item\);/],
    ['src/systems/itemTransfer.js', /setLightSource\(entity, null\);/], ['src/systems/playerTorch.js', /setLightSource\(entity, null\);/],
    ['src/systems/save.js', /setLightSource\(entity, li >= 0/], ['src/systems/handheldTorches.js', /setLightSource\(ctx\.entity, it\)/]]) assert.match(rd(f), re, f);
  const writers = ['src/systems/useItem.js', 'src/systems/itemTransfer.js', 'src/systems/playerTorch.js', 'src/systems/save.js', 'src/systems/handheldTorches.js'];
  for (const f of writers) assert.doesNotMatch(rd(f).replace(/\/\/[^\n]*/g, ''), /\.lightSource = /, `${f}: no bare write past the door`);
});

// ═══ the contact shadow's rect ══════════════════════════════════════════
test('DISC7 contact: the previous frame\'s depth is sampled through the world rect it was written under - a docked large HUD\'s strip is not the view (mutant: the rect ignored)', () => {
  const out = new Float32Array(4);
  holdPrevRect(out, [0, 100, 800, 500], [800, 600]);
  assert.deepEqual([...out].map((v) => +v.toFixed(4)), [0, 0.1667, 1, 0.8333]);
  // a world-rect UV of (0.5, 0) - the bottom of the VIEW - reads the canvas row just above the bar, not the bar
  assert.ok(Math.abs((out[1] + 0 * out[3]) * 600 - 100) < 1e-3);
  holdPrevRect(out, [0, 0, 800, 600], [800, 600]);
  assert.deepEqual([...out], [0, 0, 1, 1], 'undocked: the identity');
  holdPrevRect(out, [0, 0, 10, 10], [0, 0]);
  assert.ok([...out].every(Number.isFinite), 'a hidden canvas divides by nothing');
  // the mapping itself, evaluated as the shader spells it: rect.xy + wuv * rect.zw
  const body = /vec2 prevDepthUV\(vec2 wuv\) \{ return ([^;]+); \}/.exec(AIR_CONTACT_GLSL)?.[1];
  assert.equal(body, 'uPrevRect.xy + wuv * uPrevRect.zw', 'the world-rect UV mapped into the canvas the depth was written in');
  assert.equal((AIR_CONTACT_GLSL.match(/texture\(uPrevDepth, prevDepthUV\(uv0?\)\)/g) ?? []).length, 2, 'both samples go through the rect');
  assert.doesNotMatch(AIR_CONTACT_GLSL, /texture\(uPrevDepth, uv0?\)/);
  const air = rd('src/render/airPass.js');
  assert.match(air, /this\.prevValid = !!this\.frame; holdPrevRect\(this\.prevRect, this\.rect, this\.canvas\); \}/, 'held with the view-projection, from the rect before this frame\'s');
  assert.match(air, /gl\.uniform4fv\(loc\.prevRect, this\.prevRect\);/);
  assert.match(rd('src/render/renderer.js'), /prevRect: gl\.getUniformLocation\(p, 'uPrevRect'\)/);
});
