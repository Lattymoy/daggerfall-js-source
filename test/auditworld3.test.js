// AUDIT WORLD3 (Mac, 2026-09-13) - six opus lenses over WORLD3 (the relay
// and the wire; the action graph's change seam; the peers as targets; the
// puppet's blows at its own player; the roster rebuild; the hit, the pins
// and the record), every finding refuted by its own finder and then by two
// or three adversaries. THE FIXES EXECUTE: the relay (the act fan's byte
// budget - A1); the action graph (a record off the wire projected and
// clamped so a "t" of "x" can no longer brick a door for the room - A2;
// the picker's retry latch kept home in both directions - B1; an instant
// mover heard by the peers - B3); the motor and the targets (the local
// player told from ANY player - C1 the capsule, C2 the concealment, C3 the
// alert and the rest gate, C4 the encounter edge, C5 the stealth roll);
// and the dungeon host, the world host and the record by source (D1 the
// peers only on a streamed foe's list, D2 the host's word un-blinds the
// puppet, D3 the seat's off direction, E1-E4 the roster, F1 the striker on
// every kind, F2 the bounded numbers, A3 the refused act's heal).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACT_ROOM_BYTES_PER_S, ACT_ROOM_HZ_MAX, MAX_FRAME_BYTES, PIXEL_UNITS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';
import { ActionSystem, validActionRecord, sharedRecord, ACTION_STATES, ACTION_LOCK_MAX } from '../src/world/actionSystem.js';
import { ACTION_FLAGS, TRIGGER_FLAGS } from '../src/world/rdbLayout.js';
import { getTargets, runTargetMachine, isLocalPlayerTarget, isPeerTarget, isPlayerTarget, PLAYER_TARGET } from '../src/characters/enemyTargets.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { areEnemiesNearby, RESTING_DISTANCE } from '../src/systems/encounters.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = { positions: new Float32Array(24), indices: new Uint32Array([0, 1, 2]) };
const stub = () => { const b = new Set(); return { buckets: b, addMesh: (k) => b.add(k), removeBucket: (k) => b.delete(k), raycast: () => Infinity }; };
/** A bare graph: a door, a lever that cascades to an INSTANT flat (duration 0 - the family B3 found silent). */
const graph = () => {
  const c = stub(); const a = new ActionSystem(c);
  const door = a.addDoor(CUBE, I, { ns: 0, positionKey: 3 });
  const lever = a.addAction(0, 5, CUBE, I, { actionFlag: ACTION_FLAGS.Rotation, triggerFlag: TRIGGER_FLAGS.Direct, nextObject: 7, index: 4, duration: 20, translation: [0, 0, 0], rotation: [0, 90, 0] });
  const flat = a.addAction(0, 7, CUBE, I, { actionFlag: ACTION_FLAGS.Translation, triggerFlag: TRIGGER_FLAGS.None, nextObject: -1, index: 6, duration: 0, translation: [0, 2, 0], rotation: [0, 0, 0] });
  return { c, a, door, lever, flat };
};
const collider = { raycast: () => Infinity, capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) };
const peerAt = (id, feet, height = 1.8) => ({ isPlayer: true, isPeer: true, id, feet, height, health: 1 });
/** A motor stepped past a classic tick with `targeting` naming one candidate. */
const stepAt = (ai, target, playerFeet, extra = {}) => {
  for (let i = 0; i < 12; i++) ai.update(1 / 60, playerFeet, { targeting: (m) => { m.target = target; }, playerHeight: 1.8, ...extra });
  return ai;
};

test('AUDIT WORLD3 A: the relay - the act fan spends a BYTE budget (the frame times its listeners), one home at both ends, over it the frame dropped and nobody struck (A1); the frame budget still stands beside it', async () => {
  assert.equal(relay.ACT_ROOM_BYTES_PER_S, ACT_ROOM_BYTES_PER_S, 'one home');
  assert.equal(ACT_ROOM_BYTES_PER_S, 1024 * 1024);
  // the hole A1 measured: a frame count is no bound on the bytes a fan costs
  assert.ok(ACT_ROOM_HZ_MAX * MAX_FRAME_BYTES * 255 > 100 * 1024 * 1024, 'counting frames alone admits >100 MiB/s out of one object');
  assert.ok(ACT_ROOM_BYTES_PER_S < relay.FOES_ROOM_BYTES_PER_S, 'and a door is quieter than the foes stream');
  const r = fakeRoom('dungeon:m187');
  const h = r.connect(), j1 = r.connect(), j2 = r.connect();
  await r.hello(h, 'host-0001', at(1, 1)); await r.hello(j1, 'join-0002', at(1, 1)); await r.hello(j2, 'join-0003', at(1, 1));
  const act = { k: 'dungeon:1', a: [{ key: 'door:0', state: 'forward', t: 0, lock: 0, moveState: 'start', moveT: 0 }] };
  const frame = JSON.stringify({ t: 'act', data: act });
  await r.raw(j1, frame);
  assert.equal(ofType(h, 'act').length, 1); assert.equal(ofType(j2, 'act').length, 1);
  const out = JSON.stringify({ t: 'act', id: 'join-0002', data: act });
  const spent = ACT_ROOM_BYTES_PER_S - r.room._roomActBytes.bytes;
  assert.equal(spent, out.length * 2, `A1: the fan cost the budget the frame times its TWO listeners (${spent} for ${out.length} x 2)`);
  r.room._roomActBytes = { bytes: 10, at: Date.now() };   // the budget spent
  await r.raw(j1, frame);
  assert.equal(ofType(h, 'act').length, 1, 'A1: over the byte budget - dropped'); assert.equal(j1.closed, null, 'and no strike');
  r.room._roomActBytes = { bytes: 10, at: Date.now() - 1000 };   // a second on: refilled
  await r.raw(j1, frame);
  assert.equal(ofType(h, 'act').length, 2, 'refilled: fanned');
  // the frame budget is still there beside it
  r.room._roomActs = { tokens: 0, at: Date.now() };
  await r.raw(j1, frame);
  assert.equal(ofType(h, 'act').length, 2, 'and the frame budget still bites'); assert.equal(j1.closed, null);
  assert.match(rd('server/src/index.js'), /AUDIT WORLD3 A1: the fan is the frame times its listeners, and a frame count is no bound on it/);
});

test('AUDIT WORLD3 B: the action graph - a record off the wire is projected and clamped, so no "t" can brick a door for the room (A2); the picker\'s retry latch travels in NEITHER direction and a failed pick emits no act at all (B1); an INSTANT mover is heard by the peers, not only a tween (B3)', () => {
  // A2: the projection, executed on its own
  assert.deepEqual(ACTION_STATES, ['start', 'forward', 'end', 'reverse']);
  assert.equal(validActionRecord({ key: 'door:0', state: 'forward', t: 'x' }), null, 'a non-numeric tween is not a record');
  assert.equal(validActionRecord({ key: 'door:0', state: 'evil', t: 0 }), null, 'nor a state the graph never mints');
  assert.equal(validActionRecord({ key: 'door:0', state: 'start', t: 2 }), null, 'nor a tween outside its own range');
  assert.equal(validActionRecord({ key: 'door:0', state: 'start', t: NaN }), null);
  assert.equal(validActionRecord({ key: 'door:0', state: 'start', t: 0, lock: ACTION_LOCK_MAX + 1 }), null, 'nor a lock past every DFU value');
  assert.equal(validActionRecord({ key: 'door:0', state: 'start', t: 0, moveState: 'evil' }), null);
  assert.equal(validActionRecord([{ key: 'x' }]), null); assert.equal(validActionRecord(null), null); assert.equal(validActionRecord({ state: 'start', t: 0 }), null);
  assert.deepEqual(validActionRecord({ key: 'door:0', state: 'forward', t: 0.5, lock: 3, moveState: 'start', moveT: 0, failedSkillLevel: 40 }),
    { key: 'door:0', state: 'forward', t: 0.5, lock: 3, moveState: 'start', moveT: 0 }, 'a good record survives - without the latch (B1)');
  // A2 end to end: the brick that a stranger's 146 bytes used to be
  const A = graph();
  assert.equal(A.a.applyRemote([{ key: A.door.key, state: 'forward', t: 'x' }]), 0, 'refused, not landed');
  for (let i = 0; i < 200; i++) A.a.update(0.05);
  assert.equal(A.door.state, 'start'); assert.equal(A.door.t, 0); assert.ok(A.c.buckets.has(A.door.key), 'the door still stands, solid and shut');
  assert.equal(A.a.applyRemote([{ key: A.door.key, state: 'forward', t: 0 }]), 1, 'and an honest one still lands');
  // B1: the latch. A failed pick changes ONLY the latch, so the seam must emit nothing at all.
  const B = graph(); B.door.currentLockValue = 5;
  const sets = []; B.a.onChanged = (r) => sets.push(r);
  B.a._lockpickSkill = () => 40; B.a._playerLevel = () => 1; B.a._rolls = () => 0.99;
  assert.equal(B.a.attemptLockpicking(B.door), false, 'the pick fails');
  assert.equal(B.door.failedSkillLevel, 40, 'and latches at home');
  assert.equal(sets.length, 0, 'B1: a latch-only difference is not a change the room may hear');
  assert.equal(sharedRecord({ key: 'k', state: 'start', t: 0, lock: 1, failedSkillLevel: 40 }).failedSkillLevel, undefined);
  assert.deepEqual(Object.keys(sharedRecord({ key: 'k', state: 'start', t: 0, lock: 1, failedSkillLevel: 40 })), ['key', 'state', 't', 'lock']);
  const C = graph();
  C.a.applyRemote([{ key: C.door.key, state: 'start', t: 0, lock: 0, failedSkillLevel: 40, moveState: 'start', moveT: 0 }]);
  assert.equal(C.door.failedSkillLevel, 0, 'B1: and a sender that sends one anyway is not believed');
  // ...and the pick a peer's failure used to silence still runs
  C.door.currentLockValue = 5;
  const lines = []; C.a.onLockpickResult = (o, ok) => lines.push(ok); C.a.onLockpickTally = () => lines.push('tally');
  C.a._lockpickSkill = () => 40; C.a._playerLevel = () => 1; C.a._rolls = () => 0.99;
  C.a.attemptLockpicking(C.door);
  assert.deepEqual(lines, ['tally', false], 'B1: the second player picks, tallies and hears the line');
  // B3: an instant mover is heard
  const D = graph(), E = graph();
  const outs = []; D.a.onChanged = (r) => outs.push(r);
  const heard = []; E.a.onActionSound = (o) => heard.push([o.key, o.index]);
  D.a.activate(D.lever.key);
  assert.equal(D.flat.state, 'end', 'the flat flipped on the spot (duration 0)');
  E.a.applyRemote(outs[0]);
  assert.deepEqual(heard.map((x) => x[1]).sort(), [4, 6], 'B3: the lever AND the instant flat rang for the peer');
  assert.equal(E.flat.state, 'end', 'and it moved');
  const again = heard.length;
  E.a.applyRemote(outs[0]);
  assert.equal(heard.length, again, 'a record that moves nothing is still silent');
});

test('AUDIT WORLD3 C: the motor and the targets - a PEER is any player, never MY player. The capsule the ray aims at is the peer\'s own (C1); the concealment is the target\'s, so the host\'s invisibility no longer blinds a foe hunting the joiner (C2); the alert, the rest gate and the exhaustion collapse answer for MY player alone (C3); the encounter edge and the stealth roll are not spent on a peer (C4/C5)', () => {
  assert.equal(isLocalPlayerTarget(PLAYER_TARGET), true);
  assert.equal(isLocalPlayerTarget(peerAt('p', [0, 0, 0])), false, 'a peer is a player but not MINE');
  assert.equal(isPlayerTarget(peerAt('p', [0, 0, 0])), true, 'and still a player to every gate of GetTargets');
  assert.equal(isPeerTarget(PLAYER_TARGET), false);
  assert.equal(isLocalPlayerTarget({ ai: {}, entity: {} }), false, 'a foe is neither');
  // C1: the ray's capsule is the peer's own, and it agrees with the distance beside it
  const tall = peerAt('tall', [0, 0, 3], 2.6);
  const ai1 = stepAt(Object.assign(new EnemyAI(collider, [0, 0, 0], 0, {}), { isHostile: true }), tall, [0, 0, 60], { playerHeight: 0.9 });
  assert.equal(ai1._targetHeight(), 2.6, 'C1: the peer\'s own capsule, not the local player\'s live 0.9');
  assert.equal(ai1._targetCentreOffset(), 1.3);
  assert.ok(Math.abs(ai1._dist - Math.hypot(3, 1.3 - 0.9)) < 1e-9, 'and the distance uses the same capsule');
  // C2: the concealment is the TARGET's - the host going invisible must not blind a foe hunting the joiner
  const ai2 = stepAt(Object.assign(new EnemyAI(collider, [0, 0, 0], 0, {}), { isHostile: true }), peerAt('p2', [0, 0, 3]), [0, 0, 60], { playerInvisible: true });
  assert.equal(ai2._blocked, false, 'C2: a peer carries no concealment of the host\'s');
  assert.equal(ai2.detected, true, 'so the foe still senses the player it is actually hunting');
  const ai2b = stepAt(Object.assign(new EnemyAI(collider, [0, 0, 0], 0, {}), { isHostile: true }), PLAYER_TARGET, [0, 0, 3], { playerInvisible: true });
  assert.equal(ai2b._blocked, true, 'and MY invisibility still blinds a foe hunting ME');
  // C3: the two latches, and the rest gate over them
  const ai3 = stepAt(Object.assign(new EnemyAI(collider, [0, 0, 0], 0, {}), { isHostile: true }), peerAt('p3', [0, 0, 3]), [0, 0, 60]);
  assert.equal(ai3.targetIsLocalPlayer, false); assert.equal(ai3.inSight, true, 'it does see - just not me');
  assert.ok(Math.abs(ai3._dist - 3) < 0.5, 'the target distance is the peer\'s'); assert.ok(ai3._distLocal > 55, 'and MY distance is my own');
  const foe3 = { dead: false, ai: ai3 };
  assert.equal(areEnemiesNearby([foe3], { resting: true }), false, 'C3: a foe across the dungeon fighting the joiner does not refuse MY rest');
  assert.equal(areEnemiesNearby([foe3]), false, 'nor arm the exhaustion collapse that killed the host in an empty room');
  const ai3b = stepAt(Object.assign(new EnemyAI(collider, [0, 0, 0], 0, {}), { isHostile: true }), PLAYER_TARGET, [0, 0, 3]);
  assert.equal(ai3b.targetIsLocalPlayer, true);
  assert.equal(areEnemiesNearby([{ dead: false, ai: ai3b }], { resting: true }), true, 'and a foe fighting ME still does both');
  assert.ok(RESTING_DISTANCE > 0);
  const bare = { dead: false, ai: { detected: true, inSight: true, isHostile: true, _dist: 1 } };
  assert.equal(areEnemiesNearby([bare], { resting: true }), true, 'a bare ai stub - the unarmed player-only shape - reads as before');
  // C4: the encounter edge is MY first meeting
  const ai4 = stepAt(Object.assign(new EnemyAI(collider, [0, 0, 0], 0, {}), { isHostile: true }), peerAt('p4', [0, 0, 3]), [0, 0, 60]);
  assert.equal(ai4.justEncountered, false, 'C4: a peer does not spend the host\'s language check');
  assert.equal(ai4.hasEncounteredPlayer, false);
  const ai4b = stepAt(Object.assign(new EnemyAI(collider, [0, 0, 0], 0, {}), { isHostile: true }), PLAYER_TARGET, [0, 0, 3]);
  assert.equal(ai4b.justEncountered, true, 'and my own first meeting still fires');
  // C5: the stealth roll and its tally are MY player's
  // the stealth check is the UNSEEN arm, so the target stands BEHIND the foe (yaw 0 faces +z) and just out of
  // earshot (HEARING_RADIUS 25) while still inside STEALTH_MAX_DISTANCE (25.6)
  const BEHIND = [0, 0, -25.2];
  let tallies = 0;
  const sens = () => ({ tallyStealth: () => { tallies++; }, sharedStealth: { minute: -1 }, playerStealth: 100, rolls: () => 0.99, gameMinutes: 5 });
  const ai5 = Object.assign(new EnemyAI(collider, [0, 0, 0], 0, {}), { isHostile: true });
  for (let i = 0; i < 12; i++) ai5.update(1 / 60, [0, 0, 60], { targeting: (m) => { m.target = peerAt('p5', BEHIND); }, playerHeight: 1.8, ...sens() });
  assert.equal(ai5.inSight, false, 'the peer is unseen, so the stealth arm is the one that runs');
  assert.equal(tallies, 0, 'C5: a foe hunting the joiner does not advance MY Stealth');
  const ai5b = Object.assign(new EnemyAI(collider, [0, 0, 0], 0, {}), { isHostile: true });
  for (let i = 0; i < 12; i++) ai5b.update(1 / 60, BEHIND, { targeting: (m) => { m.target = PLAYER_TARGET; }, playerHeight: 1.8, ...sens() });
  assert.equal(ai5b.inSight, false);
  assert.ok(tallies > 0, 'and a foe hunting ME still does');
  // the machine itself still measures a peer at its own feet and capsule
  const self = { ai: { feet: [0, 0, 0], yaw: 0, height: 1.8, centreOffset: 0.9, collider, isHostile: true, target: null, secondaryTarget: null, targetSenses: null, wouldBeSpawned: true, classicTargetUpdateTimer: 100, sawSecondaryTarget: false }, entity: { team: 'Vermin', mobileTeam: 'Vermin', health: 10 } };
  const got = getTargets(self, [peerAt('p6', [2, 0, 0], 2.6)], [20, 0, 0], { infighting: true, playerHeight: 0.9 });
  assert.ok(Math.abs(got.distanceToTarget - Math.hypot(2, 1.3 - 0.9)) < 1e-9, 'the peer\'s own capsule, not the local player\'s');
  assert.deepEqual(runTargetMachine(self, [peerAt('p7', [2, 0, 0])], [20, 0, 0], 1 / 60, { infighting: true }), [2, 0, 0]);
});

test('AUDIT WORLD3 D/E/F: the hosts and the record by source - the peers ride only a STREAMED foe\'s candidate list (D1); the host\'s word un-blinds a puppet so its blows land (D2); the seat\'s off direction forgets the machine\'s target (D3); the roster\'s rebuild takes the save path, re-lands the record that triggered it, admits only a species the chain can stand and frees what it mints after a teardown (E1-E4); the striker rides every kind and both its numbers are bounded (F1/F2); the refused act heals (A3); the record is true (F3/F4)', () => {
  const d = rd('src/scenes/dungeonContext.js');
  // D1
  assert.match(d, /candidates: foeDeps \? \(streamed = false\) => \[\.\.\.foes\.filter\(\(f\) => !f\.dead && f\.ai\), \.\.\.\(_authority && streamed \? peerCandidates\(\) : \[\]\)\] : null,/, 'D1: the peers only for a foe the stream carries');
  assert.match(d, /const _armed = \(rec, sn, streamed = false\) => \(sn\?\.candidates && foeDeps \? \{[\s\S]*?sn\.candidates\(streamed\)/, 'D1: through the armed closure');
  assert.match(d, /_armed\(f, _senses, _fi < _layoutFoes\)/, 'D1: and the layout\'s run is what "streamed" means');
  // D2
  assert.match(d, /if \(f\._pupTarget != null && f\.ai\.isHostile === false\) f\.ai\.isHostile = true;/, 'D2: a streamed target is the host\'s word that this foe is fighting');
  // D3
  assert.match(d, /if \(!on\) \{ f\.ai\.target = null; f\.ai\.secondaryTarget = null; f\.ai\.targetSenses = null; \}/, 'D3: losing the seat forgets the machine\'s target');
  // E1/E2/E3/E4
  assert.match(d, /retypeFoe\(i, sf\.mobileType, sf\.gender \?\? null\)\.then\(\(ok\) => \{ if \(ok && foes\[i\]\) patchFoe\(foes\[i\], sf\); \}\);/, 'E1: the save\'s mismatch rebuilds too');
  assert.doesNotMatch(d, /if \(!truncate\) retypeFoe/, 'E1: and never silently discards the slot');
  assert.match(d, /retypeFoe\(i, r\.t, GENDER_BIT\[r\.x === 1 \? 1 : 0\]\)\.then\(\(ok\) => \{ if \(ok && !_authority && foes\[i\]\) applyFoeRecord\(foes\[i\], r\); \}\);/, 'E2: the record that triggered the rebuild lands on it');
  assert.match(d, /function applyFoeRecord\(f, r\) \{/, 'E2: one body, both callers');
  assert.match(d, /const canStandFoe = \(mobileType\) => !!ENEMY_BASICS\[mobileType\]\?\.maleTexture;/, 'E3: the build chain\'s own guard, one home');
  assert.match(d, /_retyping\.has\(i\) \|\| !canStandFoe\(mobileType\)\) return false;/, 'E3: on the rebuild');
  assert.match(d, /if \(at >= 0 && !canStandFoe\(e\.mobileType\)\) return;/, 'E3: and the flat fallback never runs for one');
  assert.match(d, /if \(_ctxDead\) \{ if \(rec\.batch\) \{ renderer\.destroyBillboardBatch\(rec\.batch\); rec\.batch = null; \} rec\.dead = true; return; \}/, 'E4: a rebuild that lands after the teardown frees what it minted');
  // F1/F2
  assert.match(d, /const _pAt = playerFeet \?\? lastPlayerFeet;/, 'F1: the striker\'s feet ride every kind');
  assert.match(d, /const unit = \(v\) => \{ const u = v3\(v\); if \(!u\) return null; const L = Math\.hypot\(u\[0\], u\[1\], u\[2\]\); return L > 1e-6 && L < 1e6 \? \[u\[0\] \/ L, u\[1\] \/ L, u\[2\] \/ L\] : null; \};/, 'F2: a direction is a UNIT vector or nothing');
  assert.match(d, /const inReach = \(v\) => \{ const q = v3\(v\); return q && q\.every\(\(c\) => Math\.abs\(c\) <= HIT_POS_MAX\) \? q : null; \};/, 'F2: and a position within the dungeon\'s reach or nothing');
  assert.match(d, /const HIT_POS_MAX = 1e6;/);
  // A3's two other halves
  assert.match(d, /actionRecords\(keys\) \{\s*if \(!Array\.isArray\(keys\) \|\| !keys\.length\) return null;[\s\S]*?\.map\(sharedRecord\);/, 'A3: the CURRENT records, the shared half of each');
  assert.match(rd('src/scenes/worldModes.js'), /dungeonActionRecords\(keys\) \{ return mode === 'dungeon' && dungeonCtx \? \(dungeonCtx\.actionRecords\?\.\(keys\) \?\? null\) : null; \},/);
  // the record - F3 and F4
  const arc = rd('bible/06-Systems/Online-Arc.md');
  assert.doesNotMatch(arc, /until WORLD3 \(below\) took the first four/, 'F3: WORLD3 no longer counts gaps it did not take');
  assert.doesNotMatch(arc, /(?<!~~)The cure - a seeded layout - is slice 3's \(below\)\./, 'F4: AUDIT WORLD\'s promise is struck where it stands, and names what actually shipped'); assert.match(arc, /~~The cure - a seeded layout - is slice 3's \(below\)\.~~/);
  assert.doesNotMatch(arc, /publishes and applies happen under an open window or\na pause, which slice 3 gates explicitly\./, 'F4: and the gate slice 3 did not build is not still promised of it');
  assert.match(arc, /## AUDIT WORLD3 \(2026-09-13\)/, 'the section');
});
