// WORLD3 (Mac, 2026-09-12: "Begin") - SLICE 3: THE LIVE WORLD AS EVENTS.
// A dungeon's doors, levers and platforms are everyone's: whoever moves
// one sends what changed ({t:'act', data} - the action records an
// outermost entry changed, diffed on the save record) and the room fans
// it to everyone but its author, who lands it on their own graph with
// the sounds. The host's foes SEE EVERY PLAYER: the peers ride the
// target machine as candidates off the pose stream, the stream's record
// says whom each foe hunts (g) and what it cast (c, s), and a PUPPET
// resolves the host's foe's blows against ME - the melee frame, the
// arrow, the spell - with my own reach and my own stats. The roster is
// the room's: a species the stream or the memory disagrees with is
// rebuilt at that index. The hit carries the striker's feet and the
// blow's direction, so the aggro turns on the striker and the shove
// goes the way the blow went. THE ARM EXECUTES: the wire, the Room over
// the one fake, the session; the action graph's change seam and remote
// apply on bare graphs; the target machine with a peer; the hosts by
// source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseClient, actGate, ACT_HZ_MAX, ACT_ROOM_HZ_MAX, MAX_FRAME_BYTES, DROP_STRIKES_MAX, POSE_HZ_MAX, PIXEL_UNITS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { ACTION_FLAGS, TRIGGER_FLAGS } from '../src/world/rdbLayout.js';
import { getTargets, runTargetMachine, targetAimPoint, isPeerTarget, isPlayerTarget, PLAYER_TARGET } from '../src/characters/enemyTargets.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

test('WORLD3: the wire and the Room - an act is an object from a hello\'d socket under the small cap, one home at both ends; in a world room it is fanned to everyone hello\'d but its author (the host too, the author never), on its own bucket (the poses\' untouched, a stream of them struck out as "too many acts"), under the room\'s budget (over it dropped, nobody struck); a town relays none', async () => {
  for (const k of ['ACT_HZ_MAX', 'ACT_ROOM_HZ_MAX', 'actGate']) assert.equal(relay[k], { ACT_HZ_MAX, ACT_ROOM_HZ_MAX, actGate }[k], `${k} at both ends`);
  assert.equal(ACT_HZ_MAX, 5); assert.equal(ACT_ROOM_HZ_MAX, 30);
  assert.deepEqual(parseClient('{"t":"act","data":{"k":"dungeon:1","a":[]}}', { hasHello: true }), { t: 'act', data: { k: 'dungeon:1', a: [] } });
  assert.deepEqual(parseClient('{"t":"act","data":{}}'), { error: 'act before hello' });
  assert.deepEqual(parseClient('{"t":"act","data":[1]}', { hasHello: true }), { error: 'bad act' });
  assert.deepEqual(parseClient('{"t":"act"}', { hasHello: true }), { error: 'bad act' });
  assert.deepEqual(parseClient('{"t":"act","data":{"pad":"' + 'x'.repeat(MAX_FRAME_BYTES) + '"}}', { hasHello: true }), { error: 'frame too large' }, 'the small cap, no prefix admits it');
  let g = actGate(null, 1000); for (let i = 0; i < ACT_HZ_MAX - 1; i++) g = actGate(g.bucket, 1000); assert.equal(g.pass, true); assert.equal(actGate(g.bucket, 1000).pass, false, 'ACT_HZ_MAX a second');
  // the Room: a joiner's act reaches the host and the other joiner, never the author
  const r = fakeRoom('dungeon:m187');
  const h = r.connect(), j1 = r.connect(), j2 = r.connect(), cold = r.connect();
  await r.hello(h, 'host-0001', at(1, 1)); await r.hello(j1, 'join-0002', at(1, 1)); await r.hello(j2, 'join-0003', at(1, 1));
  const act = { k: 'dungeon:1', a: [{ key: 'door:0', state: 'forward', t: 0, lock: 0, failedSkillLevel: 0, moveState: 'start', moveT: 0 }] };
  await r.raw(j1, JSON.stringify({ t: 'act', data: act }));
  assert.deepEqual(ofType(h, 'act'), [{ t: 'act', id: 'join-0002', data: act }], 'the host hears the joiner\'s door');
  assert.deepEqual(ofType(j2, 'act'), [{ t: 'act', id: 'join-0002', data: act }], 'and so does the other joiner');
  assert.equal(ofType(j1, 'act').length, 0, 'never the author'); assert.equal(ofType(cold, 'act').length, 0, 'never a socket that has not said hello');
  await r.raw(h, JSON.stringify({ t: 'act', data: act }));
  assert.equal(ofType(j1, 'act').length, 1, 'the host\'s door reaches the joiners too'); assert.equal(ofType(h, 'act').length, 1);
  await r.raw(cold, JSON.stringify({ t: 'act', data: act }));
  assert.deepEqual(cold.sent.at(-1), { t: 'error', m: 'act before hello' });
  // its own bucket: the poses' untouched, a stream of acts struck out
  const pose0 = JSON.stringify(j2.att.bucket);
  let n = 0; while (!j2.closed && n++ < DROP_STRIKES_MAX + ACT_HZ_MAX + 20) await r.raw(j2, JSON.stringify({ t: 'act', data: act }));
  assert.ok(j2.closed && j2.sent.at(-1)?.m === 'too many acts', `struck out after ${n} (${j2.sent.at(-1)?.m})`);
  assert.equal(JSON.stringify(j2.att.bucket), pose0, 'the pose bucket untouched by a door');
  assert.ok(ACT_HZ_MAX <= POSE_HZ_MAX);
  // the room's budget: over it dropped, nobody struck
  r.room._roomActs = { tokens: 0, at: Date.now() };
  const before = ofType(h, 'act').length;
  await r.raw(j1, JSON.stringify({ t: 'act', data: act }));
  assert.equal(ofType(h, 'act').length, before, 'over the budget: dropped'); assert.equal(j1.closed, null, 'and no strike');
  r.room._roomActs = { tokens: 0, at: Date.now() - 1000 };
  await r.raw(j1, JSON.stringify({ t: 'act', data: act }));
  assert.equal(ofType(h, 'act').length, before + 1, 'refilled: fanned');
  // a town relays none
  const town = fakeRoom('town:m9');
  const t1 = town.connect(), t2 = town.connect();
  await town.hello(t1, 'town-0001', at(1, 1)); await town.hello(t2, 'town-0002', at(1, 1));
  await town.raw(t1, JSON.stringify({ t: 'act', data: act }));
  assert.equal(ofType(t2, 'act').length, 0, 'a town has no shared doors'); assert.equal(t1.closed, null);
  // the heads
  assert.match(rd('server/src/index.js'), /WORLD3 \(2026-09-12\): THE LIVE DOORS\./); assert.match(rd('src/net/wire.js'), /THE LIVE DOORS \(WORLD3, 2026-09-12\)\./);
  assert.match(rd('src/net/wire.js'), /\{t:'act', data\}/); assert.match(rd('src/net/wire.js'), /\{t:'act', id, data\}/);
});

test('WORLD3: the session - sendAct anyone\'s in a world room alone, under its gate and the small cap with t first; onAct from another in my world room alone, never my own back, never in a town', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const acts = []; s.onAct = (id, data) => acts.push([id, data]);
  assert.equal(s.sendAct({ k: 'dungeon:1', a: [] }), false, 'no socket: nothing');
  s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'bob-0002', world: null });
  const act = { k: 'dungeon:1', a: [{ key: 'door:0', state: 'forward', t: 0 }] };
  assert.equal(s.sendAct(act), true, 'a joiner sends a door'); assert.equal(ws.sent.at(-1), '{"t":"act","data":' + JSON.stringify(act) + '}', 't first');
  assert.equal(s.stats.acts, 1);
  assert.equal(s.sendAct([1]), false); assert.equal(s.sendAct({ pad: 'x'.repeat(MAX_FRAME_BYTES) }), false, 'the small cap');
  let passed = 1; for (let i = 0; i < ACT_HZ_MAX + 3; i++) if (s.sendAct(act)) passed++;
  assert.equal(passed, ACT_HZ_MAX, 'ACT_HZ_MAX a second, refused to the caller past it');
  now += 1000; assert.equal(s.sendAct(act), true, 'a second on: refilled');
  ws.receive({ t: 'host', id: 'mac-0001' });
  assert.equal(s.sendAct(act), true, 'the host sends its doors too - a door is whoever touched it');
  ws.receive({ t: 'act', id: 'bob-0002', data: act });
  assert.deepEqual(acts, [['bob-0002', act]], 'another\'s door in');
  ws.receive({ t: 'act', id: 'mac-0001', data: act });
  ws.receive({ t: 'act', id: 'bob-0002', data: [1] }); ws.receive({ t: 'act', id: 7, data: act });
  assert.equal(acts.length, 1, 'never my own back, never a bad one');
  // a town: neither out nor in
  const s2 = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0002', secret: 'secret-of-mac-0002', WebSocketImpl: FakeWS, now: () => now });
  const acts2 = []; s2.onAct = (id, data) => acts2.push([id, data]);
  s2.join('town:m9', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 }); const w2 = sockets.at(-1); w2.open();
  w2.receive({ t: 'welcome', id: 'mac-0002', peers: [], host: 'mac-0002', world: null });
  assert.equal(s2.sendAct(act), false, 'a town sends no door'); w2.receive({ t: 'act', id: 'bob-0002', data: act }); assert.equal(acts2.length, 0, 'and takes none');
  assert.match(rd('src/net/online.js'), /this\.onAct = null;/); assert.match(rd('src/net/online.js'), /sendAct\(data\) \{/);
});

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const CUBE = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
const stubCollider = () => { const b = new Set(); return { buckets: b, addMesh: (k) => b.add(k), removeBucket: (k) => b.delete(k), raycast: () => Infinity }; };
const graph = () => {
  const c = stubCollider(); const a = new ActionSystem(c);
  const door = a.addDoor(CUBE, I, { ns: 0, positionKey: 3 });
  const lever = a.addAction(0, 5, CUBE, I, { actionFlag: ACTION_FLAGS.Rotation, triggerFlag: TRIGGER_FLAGS.Direct, nextObject: 7, index: 4, duration: 20, translation: [0, 0, 0], rotation: [0, 90, 0] });
  const platform = a.addAction(0, 7, CUBE, I, { actionFlag: ACTION_FLAGS.Translation, triggerFlag: TRIGGER_FLAGS.None, nextObject: -1, index: 3, duration: 40, translation: [0, 2, 0], rotation: [0, 0, 0] });
  return { c, a, door, lever, platform };
};

test('WORLD3: the action graph\'s change seam and remote apply, executed on bare graphs - one change set per OUTERMOST entry (a lever and the platform it cascades to in one set; a nested receive diffs nothing of its own), diffed on the save record; a refused entry (mid-play) and a tick emit nothing; applyRemote lands the set on another graph (the states, the tweens, the settle) and is HEARD (a door beginning to open, a mover beginning to play - by its own index), never re-emitted; a pick\'s lock rides', () => {
  const A = graph(), B = graph();
  const out = []; A.a.onChanged = (recs) => out.push(recs);
  A.a.activate(A.lever.key);
  assert.equal(out.length, 1, 'one set for the click'); assert.deepEqual(out[0].map((r) => r.key).sort(), [A.lever.key, A.platform.key].sort(), 'the lever and the platform it cascaded to, in ONE set');
  assert.equal(A.lever.state, 'forward'); assert.equal(A.platform.state, 'forward');
  for (let i = 0; i < 5; i++) A.a.update(0.1);
  assert.equal(out.length, 1, 'a tick emits nothing');
  A.a.receive(A.platform, 'ActionObject');
  assert.equal(out.length, 1, 'a refused entry (mid-play) emits nothing');
  // the door: one set, the record's lock and swing
  A.a.activate(A.door.key);
  assert.equal(out.length, 2); assert.equal(out[1].length, 1); assert.equal(out[1][0].key, A.door.key); assert.equal(out[1][0].state, 'forward'); assert.equal(out[1][0].lock, 0);
  // B lands A's sets, and hears them; nothing goes back out
  const heard = [], bOut = [];
  B.a.onDoorState = (o, opening) => heard.push(['door', o.key, opening]); B.a.onActionSound = (o) => heard.push(['sound', o.key, o.index]); B.a.onChanged = (r) => bOut.push(r);
  assert.equal(B.a.applyRemote(out[0]), 2); assert.equal(B.a.applyRemote(out[1]), 1);
  assert.equal(B.lever.state, 'forward'); assert.equal(B.platform.state, 'forward'); assert.equal(B.door.state, 'forward');
  assert.equal(B.c.buckets.has(B.door.key), false, 'the opening door is passable (the settle)');
  assert.deepEqual(heard, [['sound', A.lever.key, 4], ['sound', A.platform.key, 3], ['door', A.door.key, true]], 'heard: the lever and the platform by their index, the door opening');
  assert.equal(bOut.length, 0, 'what came in is not sent back');
  // the same set again, and the tick's own settle: no second sound; a swing's end and a mover's end are the tick's
  assert.equal(B.a.applyRemote(out[1]), 1); assert.equal(heard.length, 3, 'a record that changes no state is silent');
  for (let i = 0; i < 100; i++) { A.a.update(0.05); B.a.update(0.05); }
  assert.equal(A.door.state, 'end'); assert.equal(B.door.state, 'end'); assert.equal(B.platform.state, 'end');
  assert.equal(out.length, 2, 'the tick emits nothing on the author either');
  // a lock: a bash that bursts it carries the lock's fall
  const C = graph(), D = graph(); C.door.currentLockValue = 5; D.door.currentLockValue = 5;
  const cOut = []; C.a.onChanged = (r) => cOut.push(r);
  C.a.attemptBash(C.door, 0.01);
  assert.equal(C.door.currentLockValue, 0); assert.equal(cOut.length, 1); assert.equal(cOut[0][0].lock, 0);
  D.a.applyRemote(cOut[0]); assert.equal(D.door.currentLockValue, 0, 'the lock rides'); assert.equal(D.door.state, 'forward');
  // no listener: no diff (the seam costs nothing offline)
  const E = graph(); E.a.activate(E.lever.key); assert.equal(E.lever.state, 'forward');
  assert.equal(E.a._depth, 0, 'the depth unwinds'); assert.equal(A.a._depth, 0);
  assert.equal(B.a.applyRemote(null), 0); assert.equal(B.a.applyRemote([{ key: 'nope', state: 'end' }]), 0, 'a record for no object is skipped');
  const src = rd('src/world/actionSystem.js');
  assert.match(src, /for \(const name of \['activate', 'attemptBash', 'toggleDoor', 'receive', 'attemptLockpicking'\]\) \{\s*const body = ActionSystem\.prototype\[name\];\s*ActionSystem\.prototype\[name\] = function \(\.\.\.args\) \{ return this\._changed\(\(\) => body\.apply\(this, args\)\); \};\s*\}/, 'the five entries ride the seam, their signatures kept');
});

test('WORLD3: the target machine with a PEER, executed - a peer is a player to every gate and wins on distance; measured at its own feet and capsule; a peer in sight arms GetTargets when the host is out of the band and unseen; the machine hands the peer\'s own feet back; a peer gone (health 0) is dropped; the aim point is the peer\'s transform; the motor aims its senses at the peer\'s feet and reads its capsule - and the hosts by source', () => {
  const collider = { raycast: () => Infinity, capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) };
  const mk = (feet) => ({ ai: { feet, yaw: 0, height: 1.8, centreOffset: 0.9, collider, isHostile: true, target: null, secondaryTarget: null, targetSenses: null, wouldBeSpawned: true, classicTargetUpdateTimer: 100, sawSecondaryTarget: false }, entity: { team: 'Vermin', mobileTeam: 'Vermin', health: 10 } });
  const self = mk([0, 0, 0]);
  const peer = { isPlayer: true, isPeer: true, id: 'bob-0002', feet: [2, 0, 0], height: 1.8, health: 1 };
  assert.equal(isPeerTarget(peer), true); assert.equal(isPlayerTarget(peer), true, 'a player to every gate'); assert.equal(isPeerTarget(PLAYER_TARGET), false);
  const playerFeet = [20, 0, 0];
  let got = getTargets(self, [peer], playerFeet, { infighting: true });
  assert.equal(got.target, peer, 'the nearer peer wins over the player'); assert.ok(Math.abs(got.distanceToTarget - 2) < 1e-9, 'measured at the peer\'s own feet');
  got = getTargets(self, [{ ...peer, feet: [40, 0, 0] }], playerFeet, { infighting: true });
  assert.equal(got.target, PLAYER_TARGET, 'the nearer player wins over a far peer');
  got = getTargets(self, [peer], playerFeet, { infighting: false });
  assert.equal(got.target, peer, 'infighting off: a peer is still a player, never an "ally" to skip');
  // the machine: a peer in sight arms GetTargets when the host is out of the band and unseen
  const far = mk([0, 0, 0]); far.ai.wouldBeSpawned = false;
  const blind = { ...collider, raycast: (o, d) => (d[0] > 0 ? Infinity : 0.1) };   // toward +x (the peer) clear, toward -x (the host) a wall
  far.ai.collider = blind;
  const feet = runTargetMachine(far, [peer], [-20, 0, 0], 1 / 60, { infighting: true, playerHeight: 1.8 });
  assert.equal(far.ai.target, peer, 'a foe beside a joiner, far from the host, takes the joiner'); assert.deepEqual(feet, [2, 0, 0], 'the machine hands the peer\'s own feet back');
  peer.health = 0;
  runTargetMachine(far, [peer], [-20, 0, 0], 1 / 60, { infighting: true, playerHeight: 1.8 });
  assert.equal(far.ai.target, null, 'a peer gone is dropped (its health the host\'s word)');
  peer.health = 1;
  assert.deepEqual(targetAimPoint(peer, playerFeet, 0.9), [2, 0.9, 0], 'the aim point is the peer\'s transform, its own capsule\'s half');
  assert.deepEqual(targetAimPoint(PLAYER_TARGET, playerFeet, 0.9), [20, 0.45, 0], 'the player\'s stays the player\'s');
  // the motor: a targeting closure that names the peer - the senses aim at its feet, the capsule read is its own
  const ai = new EnemyAI(collider, [0, 0, 0], 0, {});
  ai.isHostile = true;
  const tall = { isPlayer: true, isPeer: true, id: 'tall-0003', feet: [0, 0, 3], height: 2.6, health: 1 };   // ahead (yaw 0 faces +z), in sight
  for (let i = 0; i < 12; i++) ai.update(1 / 60, [0, 0, 50], { targeting: (m) => { m.target = tall; }, playerHeight: 0.9 });   // past a classic tick
  assert.equal(ai.target, tall);
  assert.deepEqual(ai.lastKnownTargetPos, [0, 0, 3], 'the senses looked at the peer\'s feet, not the player\'s');
  assert.equal(ai._targetHeight(), 2.6, 'the peer\'s capsule'); assert.equal(ai._targetCentreOffset(), 1.3);
  // the hosts by source
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /const _peerCands = new Map\(\);/); assert.match(d, /function peerCandidates\(\) \{\s*if \(_peerRead === _peerFrame\) return \[\.\.\._peerCands\.values\(\)\];/, 'the peers read once a frame');
  assert.match(d, /c = \{ isPlayer: true, isPeer: true, id: q\.id, feet: \[0, 0, 0\], height: CAPSULE_HEIGHT, health: 1 \}; _peerCands\.set\(q\.id, c\);/, 'one identity per id');
  assert.match(d, /for \(const \[id, c\] of _peerCands\) if \(!seen\.has\(id\)\) \{ c\.health = 0; _peerCands\.delete\(id\); \}/, 'a peer gone is dead to the machine');
  assert.match(d, /candidates: foeDeps \? \(\) => \[\.\.\.foes\.filter\(\(f\) => !f\.dead && f\.ai\), \.\.\.\(_authority \? peerCandidates\(\) : \[\]\)\] : null,/, 'the peers ride the candidate list while I step the foes');
  assert.match(d, /return foeDeps\?\.isPlayerTarget\?\.\(t\) \? \(t\.feet \?\? _pf\) : t\.ai\.feet;/, 'the selected target\'s feet: a peer\'s own');
  assert.match(d, /function resolveFoeMelee\(f, playerFeet, \{ vsPlayer = false \} = \{\}\) \{\s*if \(!vsPlayer && resolveFoeMeleeVsFoe\(f\)\) return;[^\n]*\n\s*(?:\/\/[^\n]*\n\s*)*if \(!vsPlayer && f\.ai\.target\?\.isPeer\) \{ foeAttackVoice\(f\); return; \}/, 'a peer target: the blow is the peer\'s to resolve, the voice alone here');
  assert.match(d, /if \(\(_tgt \|\| f\._pupMine\) && !_fParalyzed && f\.mobile\.doMeleeDamage\) \{ f\.mobile\.doMeleeDamage = false; resolveFoeMelee\(f, _pf, \{ vsPlayer: !!f\._pupMine \}\); \}/, 'a puppet\'s blow at ME lands with my own reach');
  assert.match(d, /else if \(\(_tgt \|\| f\._pupTarget != null\) && !_fParalyzed && f\.mobile\.shootArrow\) \{/, 'a puppet\'s shaft flies');
  assert.match(d, /const _at = f\._pupTarget != null \? \(f\._pupMine \? foeDeps\.PLAYER_TARGET : peerCandidate\(f\._pupTarget\)\) : \(f\.ai\.target \?\? foeDeps\.PLAYER_TARGET\);\s*if \(!_at\) \{[^\n]*\}\s*else \{\s*const _atPlayer = foeDeps\.isPlayerTarget\(_at\) && !_at\.isPeer;/, 'at me a real one, at a peer\'s body one that pays nothing (aimFoe a peer: no arm at impact)');
  assert.match(d, /if \(dec\) \{ f\._castN = \(\(f\._castN \| 0\) \+ 1\) & 0xffff; f\._castIdx = dec\.spell\.index \| 0; castEnemySpell\(f, dec\.spell\); \}/, 'the cast rides the stream');
  assert.match(d, /m\.aimFoe = \(foeDeps && ct && \(!foeDeps\.isPlayerTarget\(ct\) \|\| ct\.isPeer\)\) \? ct : null;/, 'a spell missile at a peer aims at the peer');
  assert.match(d, /if \(!m\.aimFoe\?\.isPeer && missileHitsCapsule\(m\.pos, playerFeet, playerHeight, PLAYER_BODY_RADIUS\)\) \{/, 'and pays nothing on me');
  assert.match(d, /const _pt = f\.ai\?\.target\?\.isPeer \? f\.ai\.target : null;[^\n]*\n\s*foeDeps\.castEnemySpell\(f, spell, \{\s*noSpellPointCost, playerEntity, playerFeet: _pt\?\.feet \?\? lastPlayerFeet, playerHeight: _pt\?\.height \?\? lastPlayerHeight,/, 'a cast at a peer leaves toward the peer');
  const s = rd('src/characters/enemyTargets.js');
  assert.match(s, /export const isPeerTarget = \(c\) => c\?\.isPeer === true;/); assert.match(s, /const tFeet = isPlayer \? \(c\.feet \?\? playerFeet\) : targetAi\.feet;/); assert.match(s, /const tHeight = isPlayer \? \(c\.height \?\? playerHeight\) : targetAi\.height;/);
  assert.match(s, /\(isPlayerTarget\(c\) \? \(c\.health \?\? playerEntity\?\.health \?\? 1\) : \(c\.entity\?\.health \?\? 0\)\)/, 'targetHealth: a peer\'s own');
  assert.match(s, /if \(!playerInSight\) for \(const c of candidates \?\? \[\]\) \{\s*if \(!isPeerTarget\(c\) \|\| !c\.feet\) continue;/, 'a peer in sight is a player in sight');
  const m = rd('src/characters/enemyMotor.js');
  assert.match(m, /: \(this\.target\.isPlayer \? \(this\.target\.feet \?\? playerFeet\) : this\.target\.ai\.feet\);/); assert.match(m, /\|\| \(t\?\.isPeer && t\.height\) \|\| this\._playerHeight;/); assert.match(m, /return \(\(t\?\.isPeer && t\.height\) \|\| this\._playerHeight\) \/ 2;/);
});

test('WORLD3: the hosts by source - the dungeon host (the state, the doors\' seam out and in by key, the roster rebuilt in place through the one build chain with the source record kept, the memory rebuilding a mismatch and landing on the rebuilt foe, the record\'s target, cast and gender with the key, the frame in latching them and rebuilding a mismatch, the puppet step reading whose blow it is and casting at me, the hit out with the striker\'s feet, the blow\'s direction and the shaft, the hit in reading them and naming the striker, the aggro on the peer, the handover\'s clears, the API); the mode machine\'s forwards; the world host\'s routes and the peers at their scene feet', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /let _foesFrom = null;[^\n]*\n\s*\/\/ WORLD3 \(Mac: "Begin"\): THE LIVE WORLD AS EVENTS\./, 'the state, under WORLD2\'s');
  assert.match(d, /if \(opts\.onActions\) actions\.onChanged = \(recs\) => opts\.onActions\(\{ k: _locationKey, a: recs \}\);/, 'the doors out, keyed by this dungeon');
  assert.match(d, /function applyActions\(id, data\) \{\s*if \(!data \|\| typeof data !== 'object' \|\| data\.k !== _locationKey \|\| !Array\.isArray\(data\.a\)\) return false;\s*return actions\.applyRemote\(data\.a\) > 0;\s*\}/, 'the doors in, this dungeon\'s alone');
  assert.match(d, /async function retypeFoe\(i, mobileType, gender = null\) \{\s*const f = foes\[i\];\s*if \(!f \|\| i >= _layoutFoes \|\| f\.dead \|\| !f\.src \|\| _retyping\.has\(i\) \|\| !ENEMY_BASICS\[mobileType\]\) return false;/, 'the rebuild: the layout\'s run, a live foe, once at a time');
  assert.match(d, /const rec = await buildFoeAt\(\{ \.\.\.f\.src, mobileType, gender: gender === 'female' \|\| gender === 'male' \? gender : undefined \}, true, \{ at: i \}\);/, 'through the one build chain, in place');
  assert.match(d, /async function buildFoeAt\(e, fallbackFlat = true, \{ at = -1 \} = \{\}\) \{/); assert.match(d, /const stand = \(rec\) => \{\s*const old = at >= 0 \? foes\[at\] : null;\s*if \(!old\) \{ foes\.push\(rec\); return; \}\s*if \(old\.batch\) \{ renderer\.destroyBillboardBatch\(old\.batch\); old\.batch = null; \}\s*old\.dead = true;\s*dropCandidate\(old\);\s*foes\[at\] = rec;\s*\};/, 'the old freed, dead to everything, the new at its index');
  assert.equal((d.match(/marker: \[e\.x, e\.y, e\.z\], src: e \}\)/g) ?? []).length, 2, 'the source record on both branches\' records'); assert.equal((d.match(/\n\s*stand\(rec\);\n/g) ?? []).length, 2);
  assert.match(d, /if \(!truncate\) retypeFoe\(i, sf\.mobileType, sf\.gender \?\? null\)\.then\(\(ok\) => \{ if \(ok && foes\[i\] && !foes\[i\]\.dead\) patchFoe\(foes\[i\], sf\); \}\);/, 'the memory rebuilds a mismatch and lands on the rebuilt foe; a save\'s is left alone');
  assert.match(d, /function patchFoe\(f, sf\) \{/); assert.match(d, /gender: f\.gender,   \/\/ WORLD3/);
  assert.match(d, /const _t = f\.ai\.target, g = _t\?\.isPeer \? _t\.id : \(_t == null \? \(f\.ai\._armedTargeting \? '' : '\.'\) : \(_t\.isPlayer \? '\.' : ''\)\);/, 'g: the host, a peer, none');
  assert.match(d, /m: f\.ai\.moving \? 1 : 0, g, c: f\._castN \| 0, s: f\._castIdx \| 0, \.\.\.\(f\.gender === 'female' \? \{ x: 1 \} : \{\}\) \};/); assert.match(d, /\$\{r\.m\},\$\{r\.g\},\$\{r\.c\},\$\{r\.s\}`;/, 'on the key');
  assert.match(d, /if \(typeof r\.g === 'string'\) p\.target = r\.g;/); assert.match(d, /if \(r\.c != null\) \{ const c = r\.c \| 0; if \(p\.c != null && c !== p\.c\) p\.cast = r\.s \| 0; p\.c = c; \}/, 'a cast once per count, never the count a joiner arrived with');
  assert.match(d, /f\._pupMismatch = true; retypeFoe\(i, r\.t, GENDER_BIT\[r\.x === 1 \? 1 : 0\]\); continue;/, 'the stream rebuilds a mismatch'); assert.match(d, /const GENDER_BIT = \['male', 'female'\];/);
  assert.match(d, /f\._pupTarget = p\.target === '\.' \? _foesFrom : \(p\.target \|\| null\);\s*const me = opts\.selfId\?\.\(\) \?\? null;\s*f\._pupMine = f\._pupTarget != null && me != null && f\._pupTarget === me;/, 'whose blow a puppet\'s is');
  assert.match(d, /if \(p\.cast != null\) \{\s*const sp = f\._pupMine \? \(spellsByIndex\?\.get\(p\.cast\) \?\? null\) : null;\s*if \(sp\) castEnemySpell\(f, sp, true\); else f\._castPending = true;\s*p\.cast = null;\s*\}/, 'a cast at me is the spell; at another its one-shot');
  assert.match(d, /if \(!f\._pupMine\) f\.mobile\.doMeleeDamage = false;[^\n]*\n\s*if \(f\._pupTarget == null\) f\.mobile\.shootArrow = false;/, 'the latches kept for a blow at me and a shaft at anyone');
  assert.match(d, /opts\.onFoeHit\?\.\(\{ i: pi, dmg: damage, kind,\s*\.\.\.\(playerFeet \? \{ p: \[q2\(playerFeet\[0\]\), q2\(playerFeet\[1\]\), q2\(playerFeet\[2\]\)\] \} : \{\}\),\s*\.\.\.\(knockDir \? \{ d: \[q3\(knockDir\[0\]\), q3\(knockDir\[1\]\), q3\(knockDir\[2\]\)\] \} : \{\}\),\s*\.\.\.\(kind === 'arrow' \? \{ ar: 1 \} : \{\}\) \}\);/, 'the hit out: the feet, the direction, the shaft');
  assert.match(d, /const at = v3\(data\.p\), dir = kind === 'spell' \? null : v3\(data\.d\);/, 'the hit in: a spell knocks nothing'); assert.match(d, /damageFoe\(f, dmg, at, dir, \{ fromPlayer: true, peer: true, kind, peerId: id \}\);/);
  assert.match(d, /if \(data\.ar === 1 && kind === 'arrow'\) addItem\(f\.entity\.items \?\?= \[\], \{ group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 \}\);/, 'the shaft where BowDamage puts it');
  assert.match(d, /foe\.ai\.makeEnemyHostileToAttacker\?\.\(\(peer && peerCandidate\(peerId\)\) \|\| foeDeps\.PLAYER_TARGET, playerFeet \?\? lastPlayerFeet\);/, 'the aggro on the peer, at its feet');
  assert.match(d, /f\._pupTarget = null; f\._pupMine = false;   \/\/ WORLD3/, 'the handover clears them');
  assert.match(d, /isAuthority: \(\) => _authority,\s*(?:\/\/[^\n]*\n\s*)*applyActions,\s*retypeFoe,\s*peerCandidates,/, 'the API');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /onActions: \(data\) => host\.onActions\?\.\(data\), peers: \(\) => host\.peers\?\.\(\) \?\? null, selfId: \(\) => host\.selfId\?\.\(\) \?\? null,/, 'into the build');
  assert.match(m, /applyDungeonActions\(id, data\) \{ return mode === 'dungeon' && dungeonCtx \? !!dungeonCtx\.applyActions\?\.\(id, data\) : false; \},/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /online\.onAct = \(id, data\) => \{ modes\?\.applyDungeonActions\?\.\(id, data\); \};/, 'the doors routed');
  assert.match(w, /onActions: \(data\) => online\?\.sendAct\(data\) \?\? false,/);
  assert.match(w, /peers: \(\) => \{\s*if \(!online \|\| !online\.room \|\| online\.status !== 'open'\) return null;\s*const now = performance\.now\(\), out = \[\];\s*for \(const p of online\.peers\.values\(\)\) if \(online\.visible\(p, now\)\) out\.push\(\{ id: p\.id, feet: onlineToScene\(p\.shown\), height: peerBodies\?\.heightOf\(p\.id\) \|\| undefined \}\);\s*return out;\s*\},/, 'the peers at their scene feet, the drawn pose');
  assert.match(w, /selfId: \(\) => online\?\.id \?\? null,/);
});
