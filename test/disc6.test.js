// DISC6 (2026-09-23, Discord through Mac): five reports and one ask, each fixed at its root and pinned BY EXECUTION
// where the seam is a function and by source where it is a call in a frame.
//   - "Theres no quest notification when you killed all monsters and no quest update in the log" - a party's shared-
//     quest resync rebuilt the quest's Foe resources under the standing foes, whose deaths went on counting into the
//     orphans (quest/resourceBehaviour.js, quest/machine.js updateSharedQuest).
//   - "the rain sound in Taverns is louder than outside" and Mac: "ensure cricket noises can be heard in interiors" -
//     the street's ambience was frozen at the door and Better Ambience's indoor rain played on top of it
//     (systems/ambientEffects.js, the hosts' modal branch).
//   - "even when putting it away it still makes the torch sound" - each mode's weapon rig owns its own burning loop,
//     and the rig left behind at a door kept its loop (handheldTorches.js silence, the hosts' mode edge).
//   - "in shops and taverns the point lights in ceilings make everything flash/flickering" - the nearest-N shadow
//     casters swapped on every tie, the loser lighting through walls for a frame (render/shadowPass.js).
// (The 3D audio and the peers' hooves are pinned in test/audio3d.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { mintQuestFoeWave, bindQuestFoeHost } from '../src/scenes/questFoeHost.js';
import { AmbientEffects, AMBIENT_RAIN_LOOP, AMBIENT_CRICKETS_LOOP, INDOOR_RAIN_GAIN, INDOOR_CRICKETS_GAIN, CRICKET_CHORUS } from '../src/systems/ambientEffects.js';
import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR, CLIPS } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { pickShadowCasters, holdCasters, CASTER_KEEP_RATIO } from '../src/render/shadowPass.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// ═══ the quest ═══════════════════════════════════════════════════════════
const V = join(ROOT, 'vendor/dfu-quests/Tables');
const tables = {};
for (const f of readdirSync(V)) if (f.endsWith('.txt')) tables[f.replace('.txt', '')] = readFileSync(join(V, f), 'utf8').replace(/^﻿/, '');
loadQuestTables(tables);
const KILL_ALL = ['Quest: __KTEST', 'QRC:', 'Message:  1020', ' You killed them all.', '', 'QBN:', 'Foe _rats_ is 2 Giant_rat', '',
  '_mondead_ task:', ' killed 2 _rats_', ' say 1020', ' log 1011 step 1', '', 'log 1010 step 0'];
function killAll({ resync, killFirst = 0 }) {
  const popups = [];
  const m = new QuestMachine({ nowSeconds: () => 0, showPopup: (q, tk) => popups.push(tk.map((t) => t.text ?? '').join('').trim()) });
  const q = m.scheduleQuest(KILL_ALL, 0, { rolls: () => 0 });
  m.tick();
  const foeRes = q.resources.get('rats');
  const pool = { removeFoe() {}, zeroFoeHealth(f) { f.entity.health = 0; }, foeSinks: () => ({}) };
  const standing = mintQuestFoeWave(m, foeRes, foeRes.spawnCount).map((h) => {
    const f = { entity: { health: 10, maxHealth: 10 }, ai: {}, dead: false };
    bindQuestFoeHost(f, h.behaviour, pool); return f;
  });
  const kill = (f) => { f.entity.health = 0; f.dead = true; };
  const settle = () => { for (let i = 0; i < 3; i++) { for (const f of standing) f.questBehaviour.update(); m.tick(); } };
  for (const f of standing.slice(0, killFirst)) kill(f);
  settle();
  if (resync) { m.markQuestShared('__KTEST'); m.updateSharedQuest('__KTEST', resync(q)); }
  for (const f of standing) kill(f);
  settle();
  return { popups, live: q.resources.get('rats'), orphan: foeRes, log: q.getLogMessages().map((l) => l.stepID) };
}

test('DISC6 quest: a party\'s shared-quest resync under standing foes - the kills land on the Foe the quest holds NOW, and the last one fires the task: the popup and the log (mutant: the behaviour keeps its first target)', () => {
  const plain = killAll({ resync: null });
  assert.deepEqual(plain.popups, ['You killed them all.']); assert.deepEqual(plain.log, [0, 1]);
  const synced = killAll({ resync: (q) => q.getSaveData() });   // the partner's copy - here, identical
  assert.notEqual(synced.live, synced.orphan, 'the resync rebuilt the resource');
  assert.equal(synced.live.killCount, 2, 'every kill counted on the live Foe');
  assert.deepEqual(synced.popups, ['You killed them all.'], 'the notification');
  assert.deepEqual(synced.log, [0, 1], 'and the log\'s step');
});

test('DISC6 quest: a resync keeps THIS world\'s count - a kill made before it is not wiped back to the partner\'s number (mutant: the partner\'s copy overwrites the count)', () => {
  const r = killAll({ killFirst: 1, resync: (q) => { const d = q.getSaveData(); return JSON.parse(JSON.stringify(d).replace(/"killCount":1/g, '"killCount":0')); } });
  assert.equal(r.live.killCount, 2, 'one before the resync, one after');
  assert.deepEqual(r.popups, ['You killed them all.']);
});

// ═══ the ambience ════════════════════════════════════════════════════════
const stub = () => {
  const loops = [];
  return { loops, engine: { play3d: () => 2, playOneShot: () => { loops.oneShots = (loops.oneShots ?? 0) + 1; return 2; },
    loop(index, volume) { const h = { index, volumes: [volume], stopped: false, stop() { this.stopped = true; }, setVolume(v) { this.volumes.push(v); } }; loops.push(h); return h; } } };
};
const live = (loops, index) => loops.filter((h) => !h.stopped && h.index === index);

test('DISC6 ambience: in a BUILDING the street\'s rain is heard through the walls - INDOOR_RAIN_GAIN of the street\'s, or silent while Better Ambience\'s indoor rain is the rain you hear (never two copies, never louder than the street); underground DFU\'s loop stands (mutants: the indoor gain skipped; the BA source ignored)', () => {
  const { engine, loops } = stub();
  const a = new AmbientEffects({ minWait: 5, maxWait: 25 }, engine, () => 0);
  a.setPreset('rain');
  a.update(0.1, { inside: false });
  const rain = live(loops, AMBIENT_RAIN_LOOP)[0];
  assert.equal(rain.volumes.at(-1), 1, 'the street: full');
  a.update(0.1, { inside: true });
  assert.equal(rain.volumes.at(-1), INDOOR_RAIN_GAIN, 'a building: through the walls');
  assert.ok(INDOOR_RAIN_GAIN < 1);
  a.update(0.1, { inside: true, indoorRainSource: true });
  assert.equal(rain.volumes.at(-1), 0, 'Better Ambience\'s indoor rain playing: the street\'s stands down');
  a.update(0.1, { inside: true, underground: true });
  assert.equal(rain.volumes.at(-1), 1, 'underground: DFU\'s verbatim loop');
});

test('DISC6 ambience: the night\'s crickets are heard in a building - the chorus runs on at INDOOR_CRICKETS_GAIN - and stop underground (CRICKET-DUNGEON); the birds and the thunder stay outdoor things (mutants: crickets frozen indoors; the one-shots played inside)', () => {
  const { engine, loops } = stub();
  const a = new AmbientEffects({ minWait: 5, maxWait: 25 }, engine, () => 0);
  a.setPreset('clearNight');
  for (let t = 0; t < CRICKET_CHORUS.fade * 1.5; t += 0.1) a.update(0.1, { inside: true });
  const cr = live(loops, AMBIENT_CRICKETS_LOOP)[0];
  assert.ok(cr, 'a chorus sounds indoors');
  assert.ok(Math.abs(cr.volumes.at(-1) - CRICKET_CHORUS.volume * INDOOR_CRICKETS_GAIN) < 1e-9, `through the walls: ${cr.volumes.at(-1)}`);
  a.update(0.1, { inside: true, underground: true });
  assert.equal(live(loops, AMBIENT_CRICKETS_LOOP).length, 0, 'underground: no crickets');
  const b = stub();
  const day = new AmbientEffects({ minWait: 5, maxWait: 25 }, b.engine, () => 0);
  day.setPreset('sunnyDay');
  const played = [];
  day.onPlayEffect = (clip) => played.push(clip);
  for (let t = 0; t < 30; t += 0.5) day.update(0.5, { inside: true, playerPos: [0, 0, 0] });
  assert.equal(played.length, 0, 'no birds in the tavern');
  for (let t = 0; t < 30; t += 0.5) day.update(0.5, { inside: false, playerPos: [0, 0, 0] });
  assert.ok(played.length > 0, 'and in the street, as ever');
});

test('DISC6 ambience by source: both hosts tick the street\'s ambience in the modal frame - the hour, inside, underground, Better Ambience\'s indoor rain; AUDIT DISC7 B1: the word and the rain\'s gain stay the street\'s last (mutant: the gain forced to 1 indoors)', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(f);
    assert.match(s, /windAudio\.stop\(\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*ambience\.setPreset\(presetForExterior\(ambientWord, isNight\(minuteNow\(\)\)\)\);\n\s*ambience\.update\(dt, \{ inside: true, underground: modes\.mode === 'dungeon', indoorRainSource: betterAmbience\.indoorRainPlaying\(\) \}\);/, f);
    const modal = s.slice(s.indexOf('windAudio.stop();'), s.indexOf("indoorRainSource: betterAmbience.indoorRainPlaying() });"));
    assert.doesNotMatch(modal, /ambience\.rainGain = |ambientWord = /, `${f}: the street's word and gain are not replaced indoors`);
  }
});

// ═══ the torch ═══════════════════════════════════════════════════════════
test('DISC6 torch: two rigs, one lit torch (the street\'s and the building\'s) - the rig left at the door falls silent, the one that ticks sounds once, and the stow indoors leaves nothing burning (mutant: the silence a no-op)', () => {
  const defaults = Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const loops = [];
  const audio = { playOneShot() {}, play3d() {}, loop: (c, v) => { const l = { clip: c, volume: v, stopped: false, stop() { this.stopped = true; } }; loops.push(l); return l; } };
  const entity = { items: [], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const mk = () => createHandheldTorches({ settings: () => readTorchSettings(() => defaults), audio, say() {}, rolls: () => 0.5,
    torches: () => ({ spawnLightSource() {}, spawnLightSourceProjectile() {}, setOnPickedUp() {} }), handedness: () => false, loadSprite: async () => null });
  const ctx = { renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons() {} };
  const street = mk(), building = mk();
  const t = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50 };
  entity.items = [t]; entity.lightSource = t;
  street.update(0.016, ctx);
  const burning = () => loops.filter((l) => !l.stopped && l.clip === CLIPS.burning).length;
  assert.equal(burning(), 1, 'lit in the street');
  street.silence();   // the host's mode edge: the street's rig leaves the frame
  building.update(0.016, ctx);
  assert.equal(burning(), 1, 'one loop through the door, never two');
  entity.lightSource = null;   // stowed indoors
  building.update(0.016, ctx);
  assert.equal(burning(), 0, 'put away: silent');
  entity.lightSource = t;   // lit again, and back out through the door: the street's rig, silenced before, starts its own
  building.update(0.016, ctx);
  building.silence();
  street.update(0.016, ctx);
  assert.equal(burning(), 1, 'the rig that retakes the frame sounds again - its silenced handle was let go');
  street.dispose(); building.dispose();   // AUDIT DISC7 D11: nothing left listening on the light-source door
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(f), /if \(_mode\(\) !== _torchesMode\) \{ droppedTorches\.destroyAll\(\); weaponRig\.silenceTorch\(\);/, f);
  assert.match(rd('src/scenes/worldModes.js'), /const setMode = \(next\) => \{ dropDoorCache\(\); if \(next !== mode\) interiorWeapon\.silenceTorch\(\);/);
});

// ═══ the lights ══════════════════════════════════════════════════════════
test('DISC6 lights: a caster keeps its map on a tie - two lamps a hair apart do not swap on every step or bob of the head, and a lamp clearly nearer still takes the slot (mutants: no keep margin; the margin never released)', () => {
  // two lamps either side of the eye, the eye wobbling across the midpoint by a head-bob's few centimetres
  const lights = [5, 3, 0, 15, -5, 3, 0, 15];
  const held = new Float64Array(8);
  let heldN = 0, swaps = 0, last = -1;
  for (let i = 0; i < 60; i++) {
    const eye = [(i % 2 ? 0.03 : -0.03), 1.7, 0];
    const picked = pickShadowCasters(lights, eye, 1, null, held, heldN);
    if (last >= 0 && picked[0] !== last) swaps++;
    last = picked[0];
    heldN = holdCasters(held, lights, picked);   // the pass's own memory, as render() keeps it
  }
  assert.equal(swaps, 0, 'the map stays with its lamp');
  assert.equal(last, 1, 'the first pick (no memory, eye at -0.03) was the west lamp, and it kept its map');
  // a step toward the east lamp, inside the margin: the west lamp keeps its map (4.68 m against 5.65 x 0.8 = 4.52)
  assert.equal(pickShadowCasters(lights, [0.5, 1.7, 0], 1, null, held, heldN)[0], 1, 'inside the margin: kept');
  assert.equal(pickShadowCasters(lights, [0.5, 1.7, 0], 1)[0], 0, 'where the bare pick would already have swapped');
  // walk well toward the east lamp: past the margin it takes the slot
  assert.equal(pickShadowCasters(lights, [3, 1.7, 0], 1, null, held, heldN)[0], 0, 'clearly nearer: the other lamp casts');
  assert.ok(CASTER_KEEP_RATIO > 0 && CASTER_KEEP_RATIO < 1);
  assert.deepEqual(pickShadowCasters(lights, [0.03, 1.7, 0], 1), [0], 'no memory: the bare nearest, as before');
  assert.match(rd('src/render/shadowPass.js'), /this\._heldCasterN = holdCasters\(this\._heldCasters, f\.pointLights, casters\);/, 'render() keeps the frame\'s casters for the next');
});
