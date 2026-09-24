// AUDIT 66 - HANDHELD TORCHES (HT1) RE-READ AGAINST ITS OWN IL, 2026-09-14.
//
// HT1 shipped the mod 1:1 with 19 pins and a green gate. This audit read
// the four MonoBehaviours' IL again method by method against the two
// modules and the five hosts, and the pins again against the laws they
// claim to hold. TWELVE findings, all paid; each one has a pin here that
// FAILS on the code as HT1 shipped it, because a fix nobody can break
// again is the only kind worth making. The twelfth was found by a pin in
// this file, written to certify a fix for another - pins pay twice.
//
// The twelve, in the order the record tells them
// (bible/01-Overview/Audit-66.md):
//
//   F1  the dropped light sat half a torch too low
//   F2  a world-clock JUMP burned the torches - and a load is a jump
//   F3  the thrown torch's sprite flew half a torch above its own arc
//   F4  the interior entry destroyed the torches its own restore had
//       just put back
//   F5  the dungeon teardown walked past the pool
//   F6  the quest-teleport / load exit left the interior pool live
//   F7  a torch 76 units off ate the click a shop door was owed
//   F8  nothing ever called the component's dispose()
//   F9  the throw arc was integrated every frame and nothing could draw it
//   F10 a range multiplied by a brightness, through a dep no host passed
//   F11 the transition sweep sat below the modal return, so the street's
//       torches burned in the player's ear all through a shop visit
//   F12 a floating-origin recenter moved a burning foe's flame and left
//       its quad where the world used to be
//
// ...and, beside them, the pins HT1 wrote that a mutation would have
// survived: the masked bow arm, the burning loop's kind gate, the
// throw's yaw scatter, the doused record's load, a projectile's own
// light and batch, the flame's housekeeping, the two ignite/drop
// ladders, and the clamp constants that were compared to themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createHandheldTorches, readTorchSettings, throwArcPoints, rotateAboutAxis,
  HANDHELD_TORCHES_VENDOR, FREE_HAND, CLIPS, MESSAGES, ON_PICK, TORCH_LIGHT_AT,
  THROW_HAND_OFFSET, THROW_STRENGTH_MIN, THROW_STRENGTH_MAX, SECONDS_PER_CONDITION,
  TRAJECTORY_STEPS, TRAJECTORY_FIXED_DT, TRAJECTORY_SPEED, TRAJECTORY_GRAVITY,
} from '../src/systems/handheldTorches.js';
import {
  createDroppedTorches, LIGHT_ABOVE_BILLBOARD, PROJECTILE, PROJECTILE_FIXED_DT, PUFF, ENEMY_FIRE_KIND, ENEMY_LIGHT_LOCAL,
} from '../src/scenes/droppedTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { DEFAULT_BINDINGS } from '../src/systems/inputActions.js';   // KB1: the three keys are the registry's actions
import { raceActivation } from '../src/player/activationRace.js';   // HARD2: F7's law, where it lives now
import { TEMPLATES } from '../src/systems/useItem.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { setWorldMinutes, worldMinutes } from '../src/systems/worldTick.js';
import { GLOBAL_SCALE } from '../src/player/activate.js';
import { playerTorchOffsetOverride, setPlayerTorchOffsetOverride } from '../src/systems/playerTorch.js';

/** KB1: action -> its default code, so the fixture's key taps (KeyO/KeyG/KeyX) reach the registry's torch actions. */
const DEFAULT_CODE = Object.fromEntries(DEFAULT_BINDINGS.map(([code, action]) => [action, code]));
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
/** AUDIT 68 S18-torch-batch-churn: where a batch's quads draw - its centres plus the per-frame origin the moving ones ride. */
const drawnAt = (b) => { const o = b.origin ?? [0, 0, 0]; return b.centers.map((c) => [c[0] + o[0], c[1] + o[1], c[2] + o[2]]); };
const near = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ~ ${b}`);
const settle = () => new Promise((r) => setTimeout(r, 5));
const T = TEMPLATES;
const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default]));
const torch = (cond = 50) => ({ group: 'UselessItems2', templateIndex: T.Torch, currentCondition: cond, maxCondition: 50 });
const candle = () => ({ group: 'UselessItems2', templateIndex: T.Candle, currentCondition: 16, maxCondition: 16 });
const holy = () => ({ group: 'ReligiousItems', templateIndex: T.Holy_candle, currentCondition: 20, maxCondition: 20 });
const lantern = () => ({ group: 'UselessItems2', templateIndex: T.Lantern, currentCondition: 100, maxCondition: 100 });
const weapon = (t) => ({ group: 'Weapons', templateIndex: t });
const shield = () => ({ group: 'Armor', templateIndex: 109 });

/** The mod's own texture shapes, so a pin can tell a height from a constant. */
const SHAPES = { 0: [4, 31, 34], 1: [5, 9, 19], 2: [5, 15, 21], 10: [1, 31, 34], 11: [1, 9, 19], 12: [1, 15, 21] };
const loadTexture = async (record, frame) => {
  const s = SHAPES[record];
  return !s || frame >= s[0] ? null : { width: s[1], height: s[2], data: null };
};

function pool(over = {}, deps = {}) {
  const store = { ...defaults(), ...over };
  const alive = new Set(), uploads = [], loops = [], shots = [];
  const renderer = {
    uploadTexture: (a, k) => uploads.push(`${a}:${k}`), uploadEmissionTexture: () => {},
    createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size: { ...size }, centers: centers.map((c) => [...c]), frame: 0 }; alive.add(b); return b; },
    destroyBillboardBatch: (b) => alive.delete(b),
  };
  const audio = {
    loop3d: (clip, pos, vol) => { const l = { clip, pos: [...pos], vol, moves: [], stopped: false, move(p) { this.moves.push([...p]); }, stop() { this.stopped = true; } }; loops.push(l); return l; },
    play3d: (clip, pos) => shots.push([clip, [...pos]]),
  };
  const entity = deps.entity ?? { level: 5, lightSource: null, stats: { strength: 100, agility: 50, luck: 50, speed: 50 }, skills: {}, activeEffects: [], armorValues: [] };
  const p = createDroppedTorches({
    renderer, audio, getTexture: deps.getTexture ?? null, uploadRecordFrame: deps.uploadRecordFrame ?? (() => {}),
    collider: () => deps.collider ?? null, foes: () => deps.foes ?? [], entity,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    inside: () => deps.inside ?? true, waterLevel: () => deps.waterLevel ?? null,
    settings: () => readTorchSettings(() => store), rolls: () => deps.roll ?? 0.5, say: () => {}, loadTexture,
  });
  return { p, store, alive, uploads, loops, shots, entity, renderer };
}

function rig(over = {}, deps = {}) {
  const store = { ...defaults(), ...over };
  const said = [], shots = [], loops = [];
  const audio = {
    playOneShot: (c, v, pi) => shots.push([c, v, pi]),
    loop: (c, v) => { const l = { clip: c, volume: v, stopped: false, stop() { this.stopped = true; } }; loops.push(l); return l; },
    play3d: (c, pos) => shots.push([c, 'at', pos]),
  };
  const entity = { items: [], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const spawned = [];
  const h = createHandheldTorches({
    settings: () => readTorchSettings(() => store), audio, say: (l) => said.push(l), rolls: () => 0.5,
    torches: () => ({ spawnLightSource: (...a) => spawned.push(a), spawnLightSourceProjectile: () => {}, setOnPickedUp() {} }),
    handedness: deps.handedness ?? (() => false), loadSprite: async () => null,
  });
  const keys = new Set();
  const ctx = {
    renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => deps.collider ?? null, actionDown: (a) => keys.has(DEFAULT_CODE[a]),   // KB1: the registry's three actions, on their default keys (O, G, X)
    sheathWeapons: () => { ctx.sheathed = true; },
  };
  const frame = (dt = 0.016) => { h.update(dt, ctx); h.lateUpdate(dt, ctx); };
  const twice = (dt = 0.016) => { frame(dt); frame(dt); };
  const tap = (code) => { keys.add(code); frame(); keys.delete(code); frame(); };
  return { h, store, said, shots, loops, entity, keys, ctx, frame, twice, tap, spawned };
}

// ═══ the eleven ═════════════════════════════════════════════════════════

test('AUDIT 66 F1: the dropped light hangs over the billboard\'s HEAD - half the texture\'s own height, then half a unit - and a shorter light sits lower; the thrown one hangs over its quad\'s centre', async () => {
  setWorldMinutes(30000);
  const q = pool();
  q.p.tick(0);
  q.p.spawnLightSource(T.Torch, [1, 0, 2], 1000);
  q.p.spawnLightSource(T.Candle, [4, 0, 5], 100);
  q.p.spawnLightSource(T.Holy_candle, [7, 0, 8], 100);
  await settle();
  const [t, c, h] = q.p.lights();
  // the mod: light = billboard.position + up*0.5, and billboard.position = the drop point + up*(texHeight*0.0125) (IL 0x37f4, 0x38b0-0x38cf)
  near(t.y, 34 * GLOBAL_SCALE / 2 + LIGHT_ABOVE_BILLBOARD, 1e-9, 'the torch, 34 px tall');
  near(c.y, 19 * GLOBAL_SCALE / 2 + LIGHT_ABOVE_BILLBOARD, 1e-9, 'the candle, 19 px - the raise is the TEXTURE\'s, not a constant');
  near(h.y, 21 * GLOBAL_SCALE / 2 + LIGHT_ABOVE_BILLBOARD, 1e-9, 'the holy candle, 21 px');
  assert.equal(LIGHT_ABOVE_BILLBOARD, 0.5);
  assert.deepEqual([t.x, t.z, c.x, c.z], [1, 2, 4, 5], 'and nothing moved sideways');
  // the thrown torch's billboard is NOT raised (0x3a9b), so its light is half a unit over the quad's own centre
  const pr = q.p.spawnLightSourceProjectile(T.Torch, 1000, [0, 5, 0], [0, 0, 1], 1);
  await settle();
  const fly = q.p.lights().find((l) => l.y > 4);
  near(fly.y, pr.pos[1] + LIGHT_ABOVE_BILLBOARD, 1e-9, 'over the flight point itself');
});

test('AUDIT 66 F2: the burn is the world clock\'s, so a JUMP in it must not burn - a load of a save three days ahead leaves every torch standing, and a REST still ages them', async () => {
  setWorldMinutes(10000);
  const q = pool();
  q.p.tick(0.016);                                   // the host latches the clock
  const saved = [{ position: [0, 0, 0], time: 1000, itemTemplateIndex: T.Torch }];
  setWorldMinutes(10000 + 60 * 24 * 3);              // the save's own time, three days on
  q.p.restore(saved);
  q.p.tick(0.016);
  assert.equal(q.p.dropped.length, 1, 'the restored torch survives its own load');
  near(q.p.dropped[0].time, 1000, 1e-9, 'with all its seconds');
  // ...and the transition sweep re-latches too, so a torch dropped after one is not burned by the gap
  setWorldMinutes(20000);
  q.p.destroyAll();
  setWorldMinutes(20000 + 600);
  const d = q.p.spawnLightSource(T.Torch, [0, 0, 0], 1000);
  q.p.tick(0.016);
  near(d.time, 1000, 1e-9, 'the clock moved while the pool was empty - not this torch\'s to pay');
  // the REST the mod DOES answer (OnRestWindowClose: elapsed world seconds / 12) still lands
  setWorldMinutes(worldMinutes() + 60);
  q.p.tick(0.016);
  near(d.time, 1000 - 60 * 60 / 12, 1e-9, 'an hour rested is 300 seconds of torch');
});

test('AUDIT 66 F3: the thrown torch\'s quad is CENTRED on the flight point (the mod gives it no half-height raise), through the throw, every step, and a floating-origin recenter', async () => {
  setWorldMinutes(31000);
  const q = pool({ 'Throwing.ThrowDispersion': 0, 'Throwing.ThrowAngleOffset': 0 });
  q.p.tick(0);
  const p = q.p.spawnLightSourceProjectile(T.Torch, 1000, [0, 5, 0], [0, 0, 1], 1);
  await settle();
  const half = 34 * GLOBAL_SCALE / 2;
  near(drawnAt(p.batch)[0][1], p.pos[1] - half, 1e-9, 'at the throw');
  q.p.tick(PROJECTILE_FIXED_DT);
  near(drawnAt(p.batch)[0][1], p.pos[1] - half, 1e-9, 'and after a step, the sprite follows the flight');
  near(drawnAt(p.batch)[0][2], p.pos[2], 1e-9);
  q.p.offsetAll([10, 0, 0]);
  near(drawnAt(p.batch)[0][0], p.pos[0], 1e-9, 'a recenter moves the flight\'s quad');
  near(drawnAt(p.batch)[0][1], p.pos[1] - half, 1e-9);
  assert.deepEqual(q.loops[0].moves.at(-1), p.pos, 'and its 3D loop');
});

test('AUDIT 66 F4/F6/F5/F11: the four host lifetimes - the interior sweep runs with the transition and above its own restore, the quest-teleport exit sweeps too, the dungeon teardown frees the pool and the rig, and the exterior sweep sits above the modal return', () => {
  const wm = rd('src/scenes/worldModes.js');
  const enter = wm.indexOf('interiorTorches.destroyAll();');
  const restore = wm.indexOf('restoreInteriorScene();');
  assert.ok(enter > 0 && restore > 0 && enter < restore, 'F4: the sweep is BEFORE the scene cache puts the room\'s torches back, not after it');
  assert.match(wm, /dismountPlayer\('ToBuildingInterior'\);\s*transitioning = true;\s*try \{\s*(?:\/\/[^\n]*\n\s*)*interiorTorches\.destroyAll\(\);/, 'F4: it runs where the transition does - the first thing the entry does, not the last');
  assert.equal((wm.match(/interiorTorches\.destroyAll\(\);/g) ?? []).length, 3, 'F6: the way in, the way out, and the quest-teleport / load exit');
  assert.match(wm, /interiorDropped\.restorePiles\(null\);[^\n]*\n\s*interiorTorches\.destroyAll\(\);/, 'F6: in the teardown list beside its sibling pool');
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /droppedTorches\.destroyAll\(\);\s*weaponRig\.dispose\?\.\(\);/, 'F5/F8: the dropped pool and the rig\'s component leave with the dungeon');
  assert.ok(dc.indexOf('for (const t of torches) { t.handle?.stop()') < dc.indexOf('droppedTorches.destroyAll();'), 'F5: in the teardown, beside the wall torches\' own loops');
  assert.ok(dc.indexOf('droppedTorches.destroyAll();') < dc.indexOf('sceneAmbience.dispose();'), 'F5: inside destroy(), not somewhere later');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = rd(host);
    assert.match(src, /if \(_mode\(\) !== _torchesMode\) \{ droppedTorches\.destroyAll\(\); weaponRig\.silenceTorch\(\);[^\n]*? _torchesMode = _mode\(\); \}[^\n]*\n\s*if \(modes\.frame\(dt, now\)\) \{/, `F11 ${host}: the sweep is a transition EVENT, above the modal return - not a chore at the foot of a frame that indoor modes never reach`);
    assert.ok(src.indexOf('_torchesMode = _mode(); }') < src.indexOf('droppedTorches.tick(dt)'), `F11 ${host}: and it stands above the tick it used to share a line with`);
  }
});

test('AUDIT 66 F7: a dropped torch loses the click to a door, a board and a static NPC as it loses it to a pile - the ray\'s nearest hit takes it, in both exterior hosts', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = rd(host);
    // HARD2: the fix moved from two hand-written copies into one law.
    // The host now feeds the door's distance to the race and reads the
    // answer; the LAW itself is tested below, against the module.
    assert.match(src, /doorDistance: modes\.exteriorActivationDistance\(cam\.pos, useFwd\),/, `${host}: the door's distance goes into the race`);
    assert.match(src, /const _torchNearest = _race\.torchWins;/, `${host}: and the torch arm reads the race's answer`);
    assert.equal((src.match(/modes\.exteriorActivationDistance\(cam\.pos, useFwd\)/g) ?? []).length, 1, `${host}: exactly one call a frame`);
  }
  // F7 itself, against the law: a torch far down the crosshair must not
  // take the click a door at arm's length is owed.
  const far = { key: 'droppedTorch:1', distance: 60, reach: 3.2 };
  assert.equal(raceActivation({ torch: far, doorDistance: 2 }).torchWins, false, 'a door at 2 beats a torch at 60');
  assert.equal(raceActivation({ torch: far, doorDistance: Infinity }).torchWins, true, 'with no door, the torch is the hit');
  assert.equal(raceActivation({ torch: { ...far, distance: 1 }, doorDistance: 2 }).torchWins, true, 'and a torch nearer than the door takes it back');
});

test('AUDIT 66 F8: the component\'s teardown has owners - the switch\'s falling edge and the rig\'s own dispose - and it stops the burning loop and gives PlayerTorch its offset back', () => {
  const rigSrc = rd('src/combat/weaponRig.js');
  assert.match(rigSrc, /if \(!_torchesOn && _handheldWasOn\) handheld\.dispose\(\);/, 'the switch off is a teardown: update() runs only while the mod is ON, so the loop could not stop itself');
  assert.match(rigSrc, /dispose\(\) \{ handheld\.dispose\(\); _handheldWasOn = false; \}/, 'and the host has a door');
  // and what dispose actually frees
  setPlayerTorchOffsetOverride(null);
  const r = rig({ 'Presentation.Ambidexterity': true });
  const t = torch(); r.entity.items = [t]; r.entity.lightSource = t;
  r.ctx.usingRightHand = false; r.twice();
  r.entity.equip.slots[EQUIP_SLOTS.LeftHand] = shield(); r.twice();
  assert.ok(r.loops.length >= 1 && !r.loops.at(-1).stopped, 'a lit torch is burning');
  assert.ok(playerTorchOffsetOverride(), 'and the flip moved the player\'s light');
  r.h.dispose();
  assert.equal(r.loops.at(-1).stopped, true, 'the loop stops');
  assert.equal(playerTorchOffsetOverride(), null, 'and the process-global override is handed back');
});

test('AUDIT 66 F9: DrawTrajectory is a law, not a frame - the arc integrates from the free hand at the tilted look, breaks on a wall, and runs 300 steps; and the component no longer spends a frame on points nothing can draw', () => {
  const src = rd('src/systems/handheldTorches.js');
  assert.ok(!/drawTrajectory\(\)/.test(src), 'no per-frame integration left in Update');
  assert.match(src, /export function throwArcPoints\(/, 'the mod\'s own arithmetic, kept whole for the host that can draw it');
  assert.deepEqual([TRAJECTORY_STEPS, TRAJECTORY_FIXED_DT, TRAJECTORY_SPEED, TRAJECTORY_GRAVITY], [300, 0.02, 25, 9.8]);
  const open = throwArcPoints({ origin: [0, 1, 0], forward: [0, 0, 1], right: [1, 0, 0], freeHand: FREE_HAND.Right, strength: 1, throwAngle: 0, throwGravity: 1, throwStrength: 1, bodyStrength: 100 });
  assert.equal(open.length, TRAJECTORY_STEPS + 1, 'no wall: the first point plus 300 steps');
  assert.deepEqual(open[0], [THROW_HAND_OFFSET, 1, 0], 'the first point is the hand, off the camera\'s right');
  const left = throwArcPoints({ origin: [0, 1, 0], freeHand: FREE_HAND.Left, bodyStrength: 100 });
  assert.deepEqual(left[0], [-THROW_HAND_OFFSET, 1, 0], 'the other hand, the other side');
  near(open[1][2] - open[0][2], TRAJECTORY_SPEED * TRAJECTORY_FIXED_DT, 1e-9, 'the first step is the speed over the fixed step');
  assert.ok(open[1][1] < open[0][1], 'and gravity is already pulling');
  // the tilt is the mod's AngleAxis about the RIGHT, up by the angle
  const tilted = throwArcPoints({ origin: [0, 1, 0], throwAngle: 15, throwGravity: 0, bodyStrength: 100 });
  const step = [tilted[1][0] - tilted[1 - 1][0], tilted[1][1] - tilted[0][1], tilted[1][2] - tilted[0][2]];
  const want = rotateAboutAxis([0, 0, 1], [1, 0, 0], -15).map((v) => v * TRAJECTORY_SPEED * TRAJECTORY_FIXED_DT);
  for (let i = 0; i < 3; i++) near(step[i], want[i], 1e-9, 'the arc leaves along the tilted look');
  // a wall ends it at the hit point
  const wall = throwArcPoints({ origin: [0, 1, 0], bodyStrength: 100, collider: { raycast: () => 0.25 } });
  assert.equal(wall.length, 2, 'the first step meets it');
  near(Math.hypot(wall[1][0] - wall[0][0], wall[1][1] - wall[0][1], wall[1][2] - wall[0][2]), 0.25, 1e-9, 'and the arc stops AT the hit, not past it');
  // the switch says what it does, beside the other one the port cannot draw
  const def = MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys['Throwing.ShowTrajectory'];
  assert.match(def.description, /no world-space line|DFU only/i, 'the pane says the arc is not drawn here');
});

test('AUDIT 66 F10: the dropped light\'s range carries no PlayerTorchLightScale - the port holds that setting inert for a radius, in one place - and the dep no host could feed is gone', () => {
  const src = rd('src/scenes/droppedTorches.js');
  assert.ok(!/torchLightScale/.test(src), 'the dep is gone');
  assert.ok(!/DROPPED_LIGHT_INTENSITY/.test(src), 'and the constant nothing read');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.ok(!/torchLightScale/.test(rd(host)), `${host}: never passed one`);
  }
  assert.match(rd('src/systems/playerTorch.js'), /PlayerTorchLightScale\`?\s*\n?\/\/?\s*stays inert|stays inert/, 'the one decision, in the lane that made it');
});

// ═══ the pins HT1 wrote that a mutation would have survived ═════════════

test('AUDIT 66 pins: the bow in the LEFT hand takes the right hand too - with a weapon in the right slot, so the bare-hand arm cannot stand in for it', () => {
  const r = rig();
  const slots = r.entity.equip.slots;
  slots[EQUIP_SLOTS.RightHand] = weapon(WEAPONS.Dagger);
  r.ctx.usingRightHand = false;
  r.twice();
  assert.deepEqual([r.h._w.handLeft, r.h._w.handRight], [false, false], '3ARMS: a dagger in the right, and the LEFT is the punching hand while the right is not in use (HandheldTorches.cs:1315) - the arm the port had missed');
  slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow);
  r.twice();
  assert.deepEqual([r.h._w.handLeft, r.h._w.handRight], [false, false], 'the bow takes the left AND reaches across for the right (IL 0x2cf0)');
  slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Dagger);
  r.twice();
  assert.deepEqual([r.h._w.handLeft, r.h._w.handRight], [false, false], 'a dagger in the left takes only the left - the right was already held');
  delete slots[EQUIP_SLOTS.RightHand];
  r.twice();
  assert.deepEqual([r.h._w.handLeft, r.h._w.handRight], [false, true], 'and with the right slot empty and idle, the right frees');
});

test('AUDIT 66 pins: the burning loop is the TORCH\'s alone - a candle and a holy candle burn silently, as the lantern does', () => {
  const r = rig();
  r.entity.items = [candle()]; r.entity.lightSource = r.entity.items[0];
  r.frame();
  assert.equal(r.loops.length, 0, 'a candle does not roar (IL 0x13dd: TemplateIndex == 247)');
  r.entity.items = [holy()]; r.entity.lightSource = r.entity.items[0];
  r.frame();
  assert.equal(r.loops.length, 0, 'nor a holy candle');
  r.entity.items = [torch()]; r.entity.lightSource = r.entity.items[0];
  r.frame();
  assert.equal(r.loops.length, 1, 'the torch does');
});

test('AUDIT 66 pins: the ignite ladder and the drop ladder are ORDERED - lantern, torch, candle, holy candle to light; torch, candle, holy candle to drop, a lantern never', () => {
  const ig = rig();
  ig.entity.items = [holy(), candle()];
  ig.tap('KeyO');   // SOC5: the ignite key is O - the mod ships F, which the port now spends on SocialInteract
  assert.equal(ig.entity.lightSource?.templateIndex, T.Candle, 'the candle before the holy candle');
  ig.entity.lightSource = null; ig.store['Handling.RememberLastLightSource'] = false;
  ig.entity.items = [holy()];
  ig.tap('KeyO');
  assert.equal(ig.entity.lightSource?.templateIndex, T.Holy_candle, 'and the holy candle last');
  const dr = rig();
  dr.entity.items = [holy(), candle(), torch(), lantern()];
  dr.tap('KeyG');   // HT4: the drop key is G - Tab is the port's pixel dial
  dr.tap('KeyG');   // HT4: the drop key is G - Tab is the port's pixel dial
  dr.tap('KeyG');   // HT4: the drop key is G - Tab is the port's pixel dial
  assert.deepEqual(dr.spawned.map((a) => a[0]), [T.Torch, T.Candle, T.Holy_candle], 'the drop ladder in its own order, and the lantern still in the pack');
  assert.deepEqual(dr.entity.items.map((i) => i.templateIndex), [T.Lantern]);
});

test('AUDIT 66 pins: the throw is scattered about BOTH axes - the dispersion yaws the flight as well as pitching it', async () => {
  const q = pool({ 'Throwing.ThrowDispersion': 3, 'Throwing.ThrowAngleOffset': 0 }, { roll: 1 });
  const p = q.p.spawnLightSourceProjectile(T.Torch, 100, [0, 1, 0], [0, 0, 1], 1);
  const deg = 3 * Math.PI / 180;
  near(p.dirStart[1], -Math.sin(deg), 1e-6, 'the pitch scatter, about the right');
  near(p.dirStart[0], Math.sin(deg) * Math.cos(deg), 1e-6, 'and the YAW scatter, about the up - the second rotation the old pin could not see');
});

test('AUDIT 66 pins: a doused record really loads its own texture and stands as a billboard - the emptiness the old pin read is not proof', async () => {
  const wl = -10 / GLOBAL_SCALE;
  const q = pool({}, { waterLevel: wl });
  const d = q.p.spawnLightSource(T.Torch, [0, 5, 0], 100);
  await settle();
  assert.equal(d.record, 10, 'the doused torch');
  assert.ok(d.batch, 'with a billboard of its own');
  assert.equal(q.uploads.filter((u) => u.startsWith('112358:10#')).length, 1, 'one frame uploaded - the doused records have no animation');
  near(Math.abs(d.batch.size.h), 34 * GLOBAL_SCALE, 1e-9, 'at the doused texture\'s size');
  assert.equal(q.loops.length, 0, 'and no loop, because it is out');
  assert.equal(q.p.lights().length, 0, 'and no light');
});

test('AUDIT 66 pins: a torch in FLIGHT carries its light and its batch into the host\'s frame, not only after it lands', async () => {
  const q = pool({ 'Throwing.ThrowDispersion': 0, 'Throwing.ThrowAngleOffset': 0 });
  q.p.tick(0);
  const p = q.p.spawnLightSourceProjectile(T.Torch, 1000, [0, 5, 0], [0, 0, 1], 1);
  await settle();
  const lights = q.p.lights();
  assert.equal(lights.length, 1, 'the flight lights the room');
  near(lights[0].range, 14, 1e-9, 'at the template\'s flat range (0x3b41)');
  assert.ok(q.p.batches().includes(p.batch), 'and its sprite is in the draw list');
  q.p.tick(PROJECTILE_FIXED_DT);
  near(q.p.lights()[0].z, p.pos[2], 1e-9, 'both follow the flight');
});

test('AUDIT 66 F12 + pins: the burning foe\'s flame follows a floating-origin recenter - its QUAD, not only its position - is swept when the foe leaves the pool, and its ignite clip lands at the IMPACT point', async () => {
  const foe = { entity: { level: 1, health: 30, maxHealth: 30, activeEffects: [], armorValues: [], stats: { agility: 50, luck: 50 }, skills: {} }, ai: { feet: [0.35, 0, 1], height: 1.8, yaw: 0, isHostile: true }, dead: false };
  const live = [foe];
  const q = pool({ 'Throwing.ThrowDispersion': 0, 'Throwing.ThrowAngleOffset': 0 }, {
    foes: live, roll: 0, getTexture: async () => ({ getFrameCount: () => 6, getSize: () => ({ width: 32, height: 64 }) }),
  });
  q.p.tick(0);
  const p = q.p.spawnLightSourceProjectile(T.Torch, 1000, [0, 1, 0], [0, 0, 1], 1);
  await settle();
  q.p.tick(PROJECTILE_FIXED_DT); q.p.tick(PROJECTILE_FIXED_DT);
  assert.equal(p.dead, true, 'the torch is spent on the foe');
  const [clip, at] = q.shots.at(-1);
  assert.equal(clip, CLIPS.ignite);
  assert.ok(at[2] > 0.5, `the clip rings at the impact, not back at the throw (z=${at[2]})`);
  await settle(); q.p.tick(0.016);
  assert.ok(q.p.batches().some((b) => b.archive === PUFF.archive), 'the flame stands');
  q.p.offsetAll([100, 0, 0]);
  const moved = q.p.batches().find((b) => b.archive === PUFF.archive);
  near(drawnAt(moved)[0][0], 100.35, 1e-9, 'and a floating-origin recenter carries it');
  live.length = 0;                       // the foe leaves the pool (a cell eviction, a teardown)
  q.p.tick(0.016);
  assert.equal(q.p.batches().some((b) => b.archive === PUFF.archive), false, 'the flame goes with it - no orphan batch');
  assert.equal(q.p.lights().length, 0);
  assert.deepEqual([ENEMY_LIGHT_LOCAL.back, ENEMY_LIGHT_LOCAL.up], [0.4, 0.6]);
  assert.equal(foe.entity.activeEffects.some((a) => a.kind === ENEMY_FIRE_KIND), true, 'the entry itself is the foe\'s, and outlives the pool that drew it');
});

test('AUDIT 66 pins: the wind-up clamp is 0.25..2 by the IL\'s own literals, and the pickup\'s stow-to-take-up is the FIRST light only', () => {
  assert.deepEqual([THROW_STRENGTH_MIN, THROW_STRENGTH_MAX], [0.25, 2]);
  const r = rig({ 'Handling.OnPick': ON_PICK.Equip });
  r.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow);
  r.twice();
  const first = torch(); const second = candle();
  r.h.receivePickedUp(first);
  assert.equal(r.h.lastLightSource, first, 'the first stowed light is the one to take up');
  r.h.receivePickedUp(second);
  assert.equal(r.h.lastLightSource, first, 'and a second pickup does not displace it (IL 0x3f6a: only when the field is empty)');
  assert.deepEqual(r.entity.items.map((i) => i.templateIndex), [T.Torch, T.Candle], 'both landed at the BACK of the pack, in order');
  // the sheathed guard is the SHEATHE's, not the climb's
  const q = rig();
  const ln = lantern(); q.entity.items = [ln]; q.entity.lightSource = ln;
  q.ctx.climbing = true; q.twice();
  assert.equal(q.entity.lightSource, null, 'a climb stows it');
  assert.deepEqual(q.said, [MESSAGES.noFreeHand], 'and an UNSHEATHED player is told, climbing or not');
  assert.equal(SECONDS_PER_CONDITION, 20);
  assert.deepEqual([TORCH_LIGHT_AT.torch.up, TORCH_LIGHT_AT.lantern.up], [0.9, 0]);
  assert.deepEqual([PROJECTILE.restFraction, PROJECTILE.spinRate], [0.2, 20]);
});
