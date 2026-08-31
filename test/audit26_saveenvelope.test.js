// AUDIT 26 - THE SAVE-ENVELOPE PARITY BATCH (F216/F217/F220, F219,
// F222/F223/F101, F185/F187, F102), the third themed sweep of the
// audit's parity queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotPlayer, restorePlayer, copyEffectEntry } from '../src/systems/save.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { Collider } from '../src/player/collider.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

const mkEntity = (over = {}) => ({
  name: 'T', level: 3, health: 20, maxHealth: 30, fatigue: 100, magicka: 10, maxMagicka: 40,
  stats: { strength: 50 }, skills: new Array(35).fill(20), items: [], spells: [],
  ...over,
});

// ---------------------------------------------------------------
// F219/F100 - DFU persists DaedraSummonDay and DaedraSummonIndex one
// for one (SerializablePlayer.cs:164-165, restored :332-333).
// daedraForSummoner mutates both onto the entity and nothing saved
// them: reload from a fresh boot and the coven re-rolled - a
// save-scum until the prince you want answers.
// ---------------------------------------------------------------
test('audit26 F219: the coven day and index ride the envelope', () => {
  const e = mkEntity({ daedraSummonDay: 211, daedraSummonIndex: 7 });
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(e, {})));
  const restored = mkEntity({ daedraSummonDay: 3, daedraSummonIndex: 1 });
  restorePlayer(restored, snap, null);
  assert.equal(restored.daedraSummonDay, 211, 'the day round-trips');
  assert.equal(restored.daedraSummonIndex, 7, 'and the rolled prince with it');
});

// ---------------------------------------------------------------
// F222/F223/F101 - SerializablePlayer saves weaponDrawn (:175,
// restored Sheathed = !weaponDrawn :420-421) and PlayerPositionData_v1
// carries yaw, pitch and isCrouching (:212-214). The port saved none,
// so every load came back sheathed, facing the motor default and
// standing up - including a save made crouched in a 0.9 crawlspace.
// ---------------------------------------------------------------
test('audit26 F222: the pose bag rides the envelope and comes back', () => {
  const pose = { yaw: 1.25, pitch: -0.2, crouching: true, weaponDrawn: true };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(mkEntity(), { pose })));
  const extras = restorePlayer(mkEntity(), snap, null);
  assert.deepEqual(extras.pose, pose, 'yaw, pitch, crouch and the drawn weapon all round-trip');
  // additive: an old envelope answers null and the hosts leave the
  // live pose standing (every consumer is presence-gated).
  const old = JSON.parse(JSON.stringify(snapshotPlayer(mkEntity(), {})));
  assert.equal(restorePlayer(mkEntity(), old, null).pose, null, 'a pre-pose save carries none');
});

test('audit26 F222: both hosts write the pose and land it on load', () => {
  const w = rd('src/scenes/world.js');
  // MW-D30 widened the pose with the Morrowind camera's persisted pair.
  assert.match(w, /pose: \{ yaw: cam\.yaw, pitch: cam\.pitch, crouching: !!player\.crouching, weaponDrawn: !weaponRig\.playerWeapon\.sheathed, camera: mwCamera\.state\(\) \}/);
  // SAV3 moved the landing into the ONE pose-apply (quickload + the
  // classic import share it) - the inversion law lives there now.
  assert.match(w, /if \(pose\.weaponDrawn != null\) weaponRig\.playerWeapon\.sheathed = !pose\.weaponDrawn;/,
    'Sheathed = !weaponDrawn, the :420-421 inversion');
  assert.match(w, /applyPose\(extras\.pose\);/, 'the quickload lands through it');
  assert.match(w, /applyPose\(bundle\.snap\.pose\);/, 'and the classic import too');
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /pose: \{ \.\.\.\(opts\.pose\?\.read\?\.\(\) \?\? \{\}\), weaponDrawn: !playerWeapon\.sheathed \}/,
    'the dungeon context folds its own weapon in and takes yaw/pitch/crouch from the host seam');
  assert.match(d, /opts\.pose\?\.apply\?\.\(extras\.pose\);/);
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /read: \(\) => \(\{ yaw: cam\.yaw, pitch: cam\.pitch, crouching: !!player\.crouching \}\)/,
    'the mode host supplies the modal camera half');
});

// ---------------------------------------------------------------
// F185/F187 - ActionObjectData_v1 persists loadID, position, rotation,
// state and tween percentage ONLY (SerializableActionObject.cs:55-88);
// activationCount appears in none of the three serializers and the
// scene rebuilds on load, so every counter restarts at 0 in DFU.
// SerializableActionDoor DOES round-trip FailedSkillLevel (:77,
// :99-101), which the port omitted - a failed pick could be retried
// across a save.
// ---------------------------------------------------------------
test('audit26 F185/F187: the action record drops the counter and keeps the pick latch', () => {
  const c = new Collider();
  const a = new ActionSystem(c, {});
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const CUBE = {
    subMeshes: [],
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]),
    indices: new Uint16Array([0, 1, 2]),
  };
  const o = a.addDoor(CUBE, I, { ns: 0, positionKey: 1, startingLockValue: 12, action: null });
  o.activationCount = 5;
  o.failedSkillLevel = 31;
  const snap = a.collectSaveData();
  const rec = snap.find((r) => r.key === o.key);
  assert.equal('activationCount' in rec, false, 'F185: the counter is not a record field');
  assert.equal(rec.failedSkillLevel, 31, 'F187: the pick latch is');
  // restore: the counter starts the rebuilt scene at 0 even when an
  // OLD envelope still carries the field
  o.activationCount = 0; o.failedSkillLevel = 0;
  a.restoreSaveData([{ key: o.key, state: o.state, t: 0, activationCount: 9, failedSkillLevel: 31 }]);
  assert.equal(o.activationCount, 0, 'an old envelope\'s counter is ignored - DFU rebuilds at 0');
  assert.equal(o.failedSkillLevel, 31, 'the latch restores');
});

// ---------------------------------------------------------------
// F102 - DFU restores the notebook only when the save carries one
// (SaveLoadManager.cs:1451-1456). The empty-block substitute wiped
// every note and filed quest of the session on an old envelope.
// ---------------------------------------------------------------
test('audit26 F102: a quest envelope without a notebook leaves the live notes standing', () => {
  const s = rd('src/scenes/questBridge.js');
  assert.match(s, /if \(data\.notebook\) notebook\.restoreSaveData\(data\.notebook\);/);
  assert.doesNotMatch(s, /data\.notebook \?\? \{ notebookEntries: \[\], finishedQuestEntries: \[\] \}/,
    'the empty-block substitute is gone');
});

// ---------------------------------------------------------------
// F216/F217 - DFU's SaveData_v1 carries enemyData for every registered
// live enemy wherever the player stands (:865, restored :1006). The
// exterior envelope carried pixel/coords/piles alone, so a quickload
// during a wilderness ambush or a guard pursuit - with the spawn
// catch-up suppressed across the load - despawned every attacker.
// F220 - SerializableEnemy round-trips startingHealth (:109),
// currentFatigue (:111) and the instanced bundles (:120/:222).
// ---------------------------------------------------------------
test('audit26 F216/F217: both exterior pools snapshot in natives and restore through their own mint', () => {
  const ef = rd('src/scenes/exteriorFoes.js');
  assert.match(ef, /function snapshotWorld\(toNative\)/);
  assert.match(ef, /foes\.filter\(\(f\) => !f\.dead\)/, 'dead foes stay out - DFU disables, never re-mints');
  for (const field of ['mobileType', 'gender', 'nativeX', 'nativeZ', 'yaw', 'health', 'maxHealth', 'magicka', 'fatigue', 'activeEffects', 'hostile', 'encountered']) {
    assert.ok(ef.includes(`${field}:`), `the foe record carries ${field}`);
  }
  assert.match(ef, /function restoreWorld\(saved, fromNative, yOffset = 0\)/);
  assert.match(ef, /spawnFoe\(sf\.mobileType, \[lx, sf\.y \+ yOffset, lz\], \{ gender: sf\.gender \}\)/,
    'the restore re-mints through the pool\'s ONE spawn chain, then overlays the saved truth');
  const cg = rd('src/scenes/cityGuards.js');
  assert.match(cg, /function snapshotWorld\(toNative\)/);
  assert.match(cg, /guards\.filter\(\(g\) => !g\.dead\)/);
  assert.match(cg, /return g;\s+\/\/ AUDIT 26 F217/, 'spawnGuardAt answers its record - guards[length-1] under interleaved spawns is a race');
  assert.match(cg, /if \(sg\.hostile === false\) g\.ai\.isHostile = false;/,
    'a restored peaceful guard stands down (spawnGuardAt seeds pursuit)');
});

test('audit26 F220: the dungeon foe record gains maxHealth, fatigue and the live effects', () => {
  const d = rd('src/scenes/dungeonContext.js');
  const collect = d.slice(d.indexOf('function collectWorld()'), d.indexOf('function applyWorld'));
  assert.ok(collect.includes('maxHealth: f.entity.maxHealth'), 'startingHealth (:109)');
  assert.ok(collect.includes('fatigue: f.entity.fatigue ?? 0'), 'currentFatigue (:111)');
  assert.ok(collect.includes('activeEffects: (f.entity.activeEffects ?? []).map(copyEffectEntry)'), 'the instanced bundles (:120)');
  const apply = d.slice(d.indexOf('function applyWorld'), d.indexOf('function applyWorld') + 3600);
  assert.ok(apply.includes('if (sf.maxHealth != null) { f.entity.maxHealth = sf.maxHealth; f.entity.health = Math.min(f.entity.health, sf.maxHealth); }'),
    'the saved max replaces the re-roll and re-clamps health under it');
  assert.ok(apply.includes('if (sf.activeEffects) f.entity.activeEffects = sf.activeEffects'),
    'a paralyzed boss stays paralyzed across the load');
});

test('audit26 F216: copyEffectEntry strips the live caster reference on every pool record', () => {
  // The caster is a live scene reference, not state - DFU re-resolves
  // it on load. Serializing it would drag the whole entity (and,
  // through the foes, the scene) into the envelope.
  const entry = { kind: 'continuousDamage', roundsRemaining: 3, caster: { name: 'LIVE REF' }, effect: { type: 1 } };
  const copy = copyEffectEntry(entry);
  assert.equal('caster' in copy, false, 'the caster is dropped');
  assert.notEqual(copy.effect, entry.effect, 'and the nested record detaches');
  const ef = rd('src/scenes/exteriorFoes.js');
  assert.match(ef, /\.map\(copyEffectEntry\)/, 'the exterior pool uses the ONE copier');
  const cg = rd('src/scenes/cityGuards.js');
  assert.match(cg, /\.map\(copyEffectEntry\)/, 'the watch too');
});
