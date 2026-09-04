// PH1 - THE HORSE IN THE WORLD and THE RIDER: the pool's records, idle
// law, activation targets, origin shift and save shape, over a stub
// renderer and the crafted fixture; the host glue's mount gates,
// saddle, motor bag, sounds, messages, record follow and dismount over
// stub player/audio; and the world host's text pins. bible/13-Pegas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeLooseArchive } from '../src/scenes/dataSource.js';
import { horseMeshPath, horseKfPath } from '../src/systems/pegasHorse.js';
import { createPegasHorses, rollIdle, defaultStats, hasGroup, IDLE_ROLL_SECONDS, HORSE_ACTIVATION_DISTANCE } from '../src/systems/pegasHorses.js';
import { createPegasRider, PEGAS_VOLUME } from '../src/systems/pegasRider.js';
import { mintSaddle, hasSaddle, MSG, CLIP, PEGAS_SCRIPT_HZ, unitsToMetres, FRONTBACK_POSITION } from '../src/systems/pegasRide.js';
import { EYE_HEIGHT } from '../src/player/motor.js';

const ANIMATED = new Uint8Array(readFileSync(new URL('./fixtures/mw/animated.nif', import.meta.url)));
const archive = () => makeLooseArchive(new Map([[horseMeshPath(1), ANIMATED], [horseKfPath(1), ANIMATED]]));
function stubRenderer(log = []) {
  return {
    gl: { deleteVertexArray() {}, deleteBuffer() {}, deleteTexture() {} },
    createCharacterMesh: (packed) => ({ vao: {}, buffers: [{}], floats: packed.length }),
    createCharacterTexture: () => ({}),
    updateCharacterMesh() {},
    drawCharacter: (mesh, m) => log.push([mesh, [...m]]),
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
async function pool(opts = {}) {
  const log = [];
  const p = createPegasHorses({ renderer: stubRenderer(log), archives: async () => [archive()], rolls: opts.rolls ?? (() => 0.5) });
  return { p, log };
}

test('PH1: the idle law - AiWander 60/20/10: Idle2, Idle3, Idle4 by chance, Idle the rest', () => {
  assert.equal(rollIdle(0), 'idle2'); assert.equal(rollIdle(59.9), 'idle2');
  assert.equal(rollIdle(60), 'idle3'); assert.equal(rollIdle(79.9), 'idle3');
  assert.equal(rollIdle(80), 'idle4'); assert.equal(rollIdle(89.9), 'idle4');
  assert.equal(rollIdle(90), 'idle'); assert.equal(rollIdle(99), 'idle');
  const s = defaultStats(3);
  assert.equal(s.breed, 3); assert.equal(s.maxHealth, 3 * s.strength + s.endurance, 'health = 3 str + end (hr_horse_stat_01:30)');
});

test('PH1: a spawned horse is a record with art on the way, a target under the ray, and stands with its clip', async () => {
  const { p, log } = await pool();
  const h = p.spawn({ pos: [10, 2, 20], yawDeg: 90 });
  assert.equal(h.assembly, null, 'the art is async');
  await tick(); await tick();
  assert.ok(h.assembly, 'the assembly landed'); assert.equal(h.loadFailed, false);
  assert.equal(h.stamina, h.stats.endurance);
  const [t] = p.targets();
  assert.equal(t.key, `pegas:${h.id}`); assert.equal(t.distance, HORSE_ACTIVATION_DISTANCE);
  assert.deepEqual(t.aabb[0].map((v) => +v.toFixed(2)), [8.8, 2, 18.8]); assert.deepEqual(t.aabb[1].map((v) => +v.toFixed(2)), [11.2, 4.7, 21.2]);
  assert.equal(p.byKey(t.key), h);
  p.draw(0.016);
  assert.equal(log.length, 1, 'drawn once, at its feet');
  h.ridden = true;
  assert.deepEqual(p.targets(), [], 'a ridden horse is not a target');
  p.draw(0.016);
  assert.equal(log.length, 1, 'nor drawn by the pool');
});

test('PH1: standing horses regain endurance 0.05 a script frame and re-roll an idle on the clock', async () => {
  const rolls = [0.1, 0.99, 0.65];
  const { p } = await pool({ rolls: () => rolls.shift() ?? 0.5 });
  const h = p.spawn({ pos: [0, 0, 0] });
  await tick(); await tick();
  h.stamina = 0;
  p.update(1 / PEGAS_SCRIPT_HZ);
  assert.ok(Math.abs(h.stamina - 0.05) < 1e-9);
  h.idleTimer = 0.001;
  p.update(0.01);   // the roll: 0.99 * 100 = 99 -> 'idle'
  assert.equal(h.idleRoll, 'idle'); assert.equal(h.clip, 'idle');
  assert.equal(h.idleTimer, IDLE_ROLL_SECONDS, 'the clock re-arms');
  h.idleTimer = 0;
  p.update(0.01);   // 0.65 * 100 = 65 -> 'idle3'
  assert.equal(h.idleRoll, 'idle3', 'the roll is the script\'s');
  assert.equal(h.clip, 'idle', 'the fixture .kf has no Idle3, so the horse stands as it was (Morrowind plays nothing)');
  assert.equal(hasGroup(h.assembly, 'IDLE'), true, 'the group lookup is case-blind, as the .kf names are');
  assert.equal(hasGroup(h.assembly, 'idle3'), false);
});

test('PH1: the origin shift moves every horse; the save shape rides natives and comes back whole', async () => {
  const { p } = await pool();
  const h = p.spawn({ pos: [1, 2, 3], yawDeg: 30 });
  h.stamina = 12.5;
  p.offsetAll([100, 0, -100]);
  assert.deepEqual(h.pos, [101, 2, -97]);
  const toNative = (pos) => ({ x: pos[0] * 10, z: pos[2] * 10 });
  const saved = p.snapshotWorld(toNative);
  assert.deepEqual(saved, [{ id: h.id, breed: 1, nativeX: 1010, nativeZ: -970, y: 2, yawDeg: 30, stats: { ...h.stats }, stamina: 12.5 }]);
  const { p: q } = await pool();
  q.restoreWorld(saved, (nx, nz) => [nx / 10, nz / 10], 5);
  assert.equal(q.horses.length, 1);
  assert.deepEqual(q.horses[0].pos, [101, 7, -97]); assert.equal(q.horses[0].stamina, 12.5); assert.equal(q.horses[0].id, h.id);
  q.destroy();
  assert.equal(q.horses.length, 0);
});

function stubHost({ items = [], race = 'Nord', fatigue = 100 } = {}) {
  const player = { pos: [5, 1, 5], grounded: true, pegas: null, waterSurfaceY: null, spawn(x, y, z) { this.pos = [x, y, z]; } };
  const playerEntity = { race, items, fatigue };
  const said = []; const played = []; const loops = [];
  const audio = { playOneShot: (k, v) => played.push([k, v]), setLoop: (name, k) => loops.push(k) };
  return { player, playerEntity, said, played, loops, audio };
}

test('PH1: the rider - no saddle refuses with the script\'s line; with one the rider takes the horse\'s place and the motor gets the bag', async () => {
  const { p } = await pool();
  const h = p.spawn({ pos: [10, 2, 20], yawDeg: 45 });
  await tick(); await tick();
  const host = stubHost();
  const rider = createPegasRider({ ...host, horses: p, renderer: stubRenderer(), sounds: () => new Set(['pegas:idle', 'pegas:trot', 'pegas:gallop']) , say: (l) => host.said.push(l) });
  assert.deepEqual(rider.mount(h), { message: MSG.noSaddle });
  assert.deepEqual(host.said, [MSG.noSaddle]);
  assert.equal(rider.riding, false);
  host.playerEntity.items.push(mintSaddle());
  assert.equal(rider.mount(h), null);
  assert.equal(rider.riding, true); assert.equal(h.ridden, true);
  assert.equal(hasSaddle(host.playerEntity.items), false, 'the saddle is worn now');
  assert.deepEqual(host.player.pos, [10, 2, 20], 'the motor is the horse');
  assert.ok(host.player.pegas && host.player.pegas.forward === 0);
  assert.ok(Math.abs(host.player.pegas.eyeHeight - (unitsToMetres(65 + 80) + EYE_HEIGHT)) < 1e-9, 'the seat: pheight + the mount lift + the rider\'s own eye');
  assert.equal(host.player.pegas.fallDamage, false);
  assert.deepEqual(host.played, [['pegas:idle', PEGAS_VOLUME]]);
});

test('PH1: the rider\'s frame - the RUN tap moves the horse, the record follows the rider, the loop plays, the dismount gives the saddle back', async () => {
  const { p } = await pool();
  const h = p.spawn({ pos: [0, 0, 0], yawDeg: 0 });
  await tick(); await tick();
  const host = stubHost({ items: [mintSaddle()] });
  const rider = createPegasRider({ ...host, horses: p, renderer: stubRenderer(), sounds: () => new Set(['pegas:idle', 'pegas:trot', 'pegas:gallop']), say: (l) => host.said.push(l) });
  rider.mount(h);
  const f = { dt: 1 / 30, run: false, sneak: false, firstPerson: true, yawDeg: 0 };
  rider.tick({ ...f, run: true });
  let o = rider.tick({ ...f, run: false });
  assert.equal(o.moving, true);
  assert.equal(host.player.pegas.forward, 1);
  assert.ok(Math.abs(host.player.pegas.speed - unitsToMetres(10 * 30)) < 1e-9, 'the trot in m/s');
  assert.equal(host.loops[host.loops.length - 1], 'pegas:trot');
  // the record follows: the horse stands frontback units behind the rider along its facing
  host.player.pos = [0, 0, 10];
  o = rider.tick({ ...f });
  assert.ok(Math.abs(h.pos[2] - (10 - unitsToMetres(FRONTBACK_POSITION))) < 1e-9); assert.equal(h.pos[0], 0);
  assert.equal(h.yawDeg, 0);
  assert.equal(o.clip, CLIP.trot, 'the clip follows the gait');
  assert.equal(h.assembly.group, CLIP.idle, 'the fixture .kf has no Walkforward: the rider falls the clip back to Idle rather than freezing the rig');
  // ACTIVATE dismounts through the ladder's arm
  assert.equal(rider.tryActivate([0, 1.7, 10], [0, 0, 1], { raycast: () => Infinity }), true, 'riding: the ride consumes ACTIVATE');
  o = rider.tick({ ...f });
  assert.equal(rider.riding, false); assert.equal(h.ridden, false);
  assert.ok(host.said.includes(MSG.dismount));
  assert.equal(hasSaddle(host.playerEntity.items), true, 'the saddle is back in the pack');
  assert.equal(host.player.pegas, null, 'the motor is the rider again');
  assert.equal(host.loops[host.loops.length - 1], null, 'the loop is off');
  assert.equal(h.assembly.group, CLIP.idle);
});

test('PH1: the host - the ladder\'s arm, the frame\'s tick ahead of the motor, the draw, the origin shift, the save, the travel carry, the ride-out door - all enhanced-only', () => {
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(w, /const pegasTook = isEnhanced\(\) && pegasRider\.tryActivate\(cam\.pos, useFwd, collider, \{ sneaking: held\(keys, 'Sneak'\) \}\);\s*\n\s*if \(!pegasTook && !townTalk\.tryActivate\(cam\.pos, useFwd, _livePersons\)\) \{/, 'the horse is picked before the townsfolk, and the ride owns ACTIVATE');
  const tickAt = w.indexOf('pegasRider.tick({ dt, run: held(keys, \'Run\'), sneak: held(keys, \'Sneak\')');
  const motorAt = w.indexOf("if (!_overlayHeld && !_seasonHeld) player.update(dt, paralyzed ?");
  assert.ok(tickAt > 0 && motorAt > tickAt && motorAt - tickAt < 400, 'the machine ticks ahead of the motor it drives');
  assert.match(w, /if \(isEnhanced\(\)\) \{\s*\n\s*pegasHorses\.update\(gamePaused\(\) \? 0 : dt\);\s*\n\s*pegasHorses\.draw\(dt, \{ paused: gamePaused\(\) \}\);\s*\n\s*pegasRider\.drawRidden\(dt, \{ paused: gamePaused\(\) \}\);/);
  assert.match(w, /pegasHorses\.offsetAll\(r\.offset\);/);
  assert.match(w, /pegasHorses: pegasHorses\.snapshotWorld\(\(pos\) => state\.worldCoords\(pos\)\)/);
  assert.match(w, /pegasHorses\.restoreWorld\(w\.pegasHorses, \(nx, nz\) => state\.localFromWorld\(nx, nz\), state\.compensation\[1\]\);/);
  assert.match(w, /const _pegasCarry = pegasCarryOut\(\);/); assert.match(w, /pegasCarryIn\(_pegasCarry\);/);
  assert.match(w, /function pegasCarryOut\(\) \{\s*\n\s*if \(pegasRider\.riding\) pegasRider\.dismount\('activate'\);\s*\n\s*const carry = pegasHorses\.snapshotWorld\(\(pos\) => state\.worldCoords\(pos\)\)/, 'the carry reads the OLD frame after a ride ends');
  assert.match(w, /if \(isEnhanced\(\)\) pegasRideOut\(\);\s*\n\s*else setTransportModeHere\(TRANSPORT_MODES\.Horse\);/, 'the classic skin keeps Daggerfall\'s mount');
  // the motor's four arms, and the landing
  const m = readFileSync('src/player/motor.js', 'utf8');
  assert.match(m, /this\.landedFallDistance = \(this\.pegas && this\.pegas\.fallDamage === false\) \? 0 : this\.fallStart - this\.pos\[1\];/,
    'no fall damage in the mod\'s saddle: hr_ridingspell\'s Slow Fall is on the rider, so a landing reports no distance and the host\'s law stays as it was');
  assert.match(m, /if \(this\.pegas\) return this\.pegas\.eyeHeight;/);
  assert.match(m, /if \(this\.pegas\) input = \{ forward: this\.pegas\.forward, strafe: 0, run: false/);
  assert.match(m, /if \(this\.pegas\) speed = this\.pegas\.speed;/);
  assert.match(m, /this\.velY -= GRAVITY \* dt \* \(this\.pegas \? this\.pegas\.gravityScale : 1\);/);
  assert.match(m, /if \(this\.pegas && this\.pegas\.verticalVelocity != null\) \{/);
});
