// FIELD BUGS 2026-10-04b (Mac, from play): "Companion pathing is really rough. They're also walking towards to the wall,
// next to the exit that leads to outside" (COMPANION-TRAIL); "Reduce companion noises, they are way too persistant"
// (QUIET-COMPANIONS); "Reduce Lysandus VENGENANCE audio" (QUIET-VENGEANCE). `01-Overview/bugs/Field-Bugs-2026-10-04.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EnemyAI, FOLLOW_YAW_GATE_DEG, FOLLOW_RUN_M, FOLLOW_RUN_PACE, FOLLOW_SIGHT_S, FOLLOW_CRUMB_REACH, enemyMoveSpeed,
} from '../../src/characters/enemy/enemyMotor.js';
import { EnhancedEnemyAI, makeNavWorld } from '../../src/ai/enhancedMotor.js';
import { bakeNavFromCollider } from '../../src/ai/nav/navBake.js';
import { Collider } from '../../src/player/collider.js';
import { runTargetMachine } from '../../src/characters/enemy/enemyTargets.js';
import { createCompanions } from '../../src/systems/naval/crewCompanions.js';
import { createCrewAshore, TRAIL_STEP_M, TRAIL_MAX, TRAIL_JUMP_M } from '../../src/scenes/crewAshore.js';
import { EnemySoundSource, COMPANION_ATTRACT_SCALE, MIN_ATTRACT_DELAY, FOE_ATTRACT_SCALE } from '../../src/characters/enemy/enemySounds.js';
import { tickEnemySound } from '../../src/scenes/hostCombat.js';
import { createPortalSet, PORTAL_SOUND, PORTAL_SOUND_GAP_MS } from '../../src/scenes/portalFx.js';
import { QuestAudioSource, QUIET_QUEST_SOUNDS } from '../../src/systems/audio.js';
import { PlaySound } from '../../src/systems/quest/actions.js';
import { loadQuestTables } from '../../src/systems/quest/tables.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const settle = () => new Promise((r) => setImmediate(r));
const mkSenses = (extra = {}) => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5, ...extra });

// ── COMPANION-TRAIL ───────────────────────────────────────────────────────────────────────────────────────────────

/** Two rooms and the wall between them, a 1.2 m doorway at its south end (z 1.0-2.2) - a building's shop and its back
 *  room, the companion stood in the first at the far end from the door. */
function doorRoom() {
  const QUAD = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const Id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const c = new Collider(() => -1000);
  const quad = (key, ...v) => c.addMesh(key, new Float32Array(v.flat()), QUAD, Id);
  quad('floor', [0, 0, 0], [12, 0, 0], [12, 0, 12], [0, 0, 12]);
  quad('n', [0, 0, 0], [12, 0, 0], [12, 3, 0], [0, 3, 0]);
  quad('s', [12, 0, 12], [0, 0, 12], [0, 3, 12], [12, 3, 12]);
  quad('w', [0, 0, 12], [0, 0, 0], [0, 3, 0], [0, 3, 12]);
  quad('e', [12, 0, 0], [12, 0, 12], [12, 3, 12], [12, 3, 0]);
  for (const [z0, z1] of [[0, 1.0], [2.2, 12]]) {
    quad(`dw${z0}`, [5.9, 0, z1], [5.9, 0, z0], [5.9, 3, z0], [5.9, 3, z1]);
    quad(`de${z0}`, [6.1, 0, z0], [6.1, 0, z1], [6.1, 3, z1], [6.1, 3, z0]);
  }
  return c;
}
/** The player's walk at 3 m/s, one point a 60 Hz frame: down the first room to the doorway, through it, and up the far
 *  room to its corner - where the straight line back to the companion meets the dividing wall. */
function playerWalk() {
  const walk = [];
  const seg = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.05); for (let i = 1; i <= n; i++) walk.push([a[0] + (b[0] - a[0]) * i / n, 0, a[2] + (b[2] - a[2]) * i / n]); };
  seg([3, 0, 10], [4.5, 0, 1.6]); seg([4.5, 0, 1.6], [7.5, 0, 1.6]); seg([7.5, 0, 1.6], [10, 0, 10]);
  return walk;
}
/** The real layer standing one companion in the door room as a real motor (the place's `spawn` - a pool's shape), the
 *  player walking `walk`; each frame the layer's frame, then the motor's step. `strip` takes the trail off the handle the
 *  layer hands the motor - the motor as it walked before. Answers the gap at the walk's end, a second later, the
 *  furthest east the companion got, and the motor. */
async function followThroughDoor({ strip = false, Cls = EnemyAI, nav = null } = {}) {
  const c = doorRoom();
  const walk = playerWalk();
  const party = createCompanions();
  party.take(7, { name: 'Aldric', role: 'Bosun', mobile: 144, gender: 'male' }, 0);
  const leader = { feet: [3, 0, 10], yaw: Math.PI / 2, grounded: true };
  let mate = null;
  const place = {
    key: 'shop',
    spawn: () => {
      const ai = new Cls(c, [2, 0, 10], 0, { liveSpeed: 50, rolls: () => 0.5, nav: () => nav, navWorld: makeNavWorld(), navSeed: 7 });
      mate = { ai, entity: { team: 'PlayerAlly', mobileTeam: 'PlayerAlly', health: 20, maxHealth: 20, basics: { team: 'PlayerAlly' } } };
      return Promise.resolve(mate);
    },
    remove: () => {},
    has: () => true,
    spot: () => [2, 0, 10],
  };
  const layer = createCrewAshore({ party: () => party, place: () => place, leader: () => leader, now: () => 0 });
  layer.frame(); await settle();
  assert.ok(mate?.ai?.follow, 'stood, and handed the follow');
  const targeting = (ai, pf, dt) => runTargetMachine(mate, [mate], pf, dt, { infighting: true, playerEntity: { health: 100 } });
  const gapNow = () => Math.hypot(mate.ai.feet[0] - leader.feet[0], mate.ai.feet[2] - leader.feet[2]);
  let atEnd = null, after = null, east = 0;
  for (let n = 0; n < walk.length + 60; n++) {
    if (n < walk.length) leader.feet = walk[n];
    layer.frame();
    if (strip) mate.ai.follow = { feet: mate.ai.follow.feet, stop: mate.ai.follow.stop };
    mate.ai.update(1 / 60, leader.feet, mkSenses({ targeting }), false);
    east = Math.max(east, mate.ai.feet[0]);
    if (n === walk.length - 1) atEnd = gapNow();
  }
  after = gapNow();
  return { atEnd, after, east, ai: mate.ai, layer };
}

test('COMPANION-TRAIL the doorway: through the layer\'s own trail a companion follows the player through the door and is at heel as the player stops; on the straight line it is still behind the wall beside the door (mutants: no trail handed; the trail never looked at)', async () => {
  const trail = await followThroughDoor();
  assert.ok(trail.east > 6.5, `through the doorway (${trail.east.toFixed(2)})`);
  assert.ok(trail.atEnd <= 4.5, `at heel as the player stops (${trail.atEnd.toFixed(2)} m)`);
  assert.ok(trail.after <= 2.5 + 0.5, `and standing there (${trail.after.toFixed(2)} m)`);
  assert.ok(trail.layer.trail().length > 20, 'the layer dropped the walk as crumbs');
  const straight = await followThroughDoor({ strip: true });
  assert.ok(straight.east < 5.9, `the straight line: never through the doorway - pressed to the wall beside it (x ${straight.east.toFixed(2)}, the wall at 5.9)`);
});

test('COMPANION-TRAIL the line: clear to a point in the open, and to one hard against a wall; blocked by a wall between, and by a drop of more than FOLLOW_SIGHT_DY (mutants: the line blind; a wall behind the point counted in the way)', () => {
  const ai = new EnemyAI(doorRoom(), [3, 0, 5], 0, { liveSpeed: 50, rolls: () => 0.5 });
  assert.equal(ai._clearLine([5, 0, 8]), true, 'the open room');
  assert.equal(ai._clearLine([5.75, 0, 5]), true, 'a point hard against the wall: the cast stops 0.15 m short of it, inside FOLLOW_CRUMB_REACH - as good as there');
  assert.equal(ai._clearLine([9, 0, 5]), false, 'the dividing wall between');
  assert.equal(ai._clearLine([5, 2, 8]), false, 'a ledge 2 m up');
  assert.equal(ai._clearLine([3.5, 0, 5.2]), true, 'within reach');
});

test('COMPANION-TRAIL the pathing motor asks the trail first: the walked way through the door with no route asked for while a crumb is in sight; with no trail, the route as before (mutants: the route first)', async () => {
  const c = doorRoom();
  const bake = bakeNavFromCollider(c, { anchor: [2, 0, 10] });
  const routed = await followThroughDoor({ Cls: EnhancedEnemyAI, nav: bake.chf });
  assert.ok(routed.atEnd <= 4.5, `at heel as the player stops (${routed.atEnd.toFixed(2)} m)`);
  assert.equal(routed.ai.navStats.repaths, 0, 'every look found the leader or a crumb - no route asked for');
  const bare = await followThroughDoor({ Cls: EnhancedEnemyAI, nav: bake.chf, strip: true });
  assert.ok(bare.ai.navStats.repaths > 0, 'no trail: the navmesh route');
});

test('COMPANION-TRAIL the trail: a crumb each TRAIL_STEP_M walked on a floor, none in the air, the newest TRAIL_MAX kept, begun again by a jump of TRAIL_JUMP_M and by a new place (mutants: crumbs in the air; no cap; no reset)', async () => {
  assert.deepEqual([TRAIL_STEP_M, TRAIL_MAX, TRAIL_JUMP_M], [0.75, 64, 8]);
  const party = createCompanions();
  party.take(7, { name: 'Aldric', role: 'Bosun', mobile: 144, gender: 'male' }, 0);
  const L = { feet: [0, 0, 0], yaw: 0, grounded: true };
  const place = { key: 'a', spawn: () => Promise.resolve(null), remove: () => {} };
  const layer = createCrewAshore({ party: () => party, place: () => place, leader: () => L, now: () => 0 });
  const stepTo = (x, z = 0) => { L.feet = [x, 0, z]; layer.frame(); };
  stepTo(0);
  for (let x = 0.1; x <= 3.001; x += 0.1) stepTo(x);
  assert.deepEqual(layer.trail().map((p) => +p[0].toFixed(1)), [0, 0.8, 1.6, 2.4], 'one each 0.75 m walked (the first past it)');
  L.grounded = false;
  for (let x = 3.1; x <= 6; x += 0.1) stepTo(x);
  assert.equal(layer.trail().length, 4, 'a jump\'s arc leaves none');
  L.grounded = true;
  for (let x = 6; x <= 60; x += 0.25) stepTo(x);
  assert.equal(layer.trail().length, TRAIL_MAX, 'the newest TRAIL_MAX');
  assert.ok(layer.trail()[TRAIL_MAX - 1][0] > 59, 'newest last');
  stepTo(60 + TRAIL_JUMP_M + 1);
  assert.equal(layer.trail().length, 1, 'a jump begins it again (a teleport, the origin recentred)');
  stepTo(70); stepTo(71);
  place.key = 'b';
  stepTo(72);
  assert.equal(layer.trail().length, 1, 'a new place, a new trail');
});

test('COMPANION-TRAIL the walk: a follower walks on while it turns inside FOLLOW_YAW_GATE_DEG, and past FOLLOW_RUN_M of its leader it hurries at FOLLOW_RUN_PACE (mutants: the pursuit\'s 5.625 gate; no pace)', () => {
  assert.deepEqual([FOLLOW_YAW_GATE_DEG, FOLLOW_RUN_M, FOLLOW_RUN_PACE, FOLLOW_SIGHT_S, FOLLOW_CRUMB_REACH], [30, 8, 1.6, 0.25, 0.8]);
  const flat = () => ({
    raycast: (o, d) => (d[1] < -0.5 ? Math.max(0, o[1]) + 0.5 : Infinity),
    capsuleCast: () => ({ dist: Infinity, key: null }),
    move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true }; },
  });
  const body = (feet, yaw) => {
    const ai = new EnemyAI(flat(), feet, yaw, { liveSpeed: 50, rolls: () => 0.5 });
    const m = { ai, entity: { team: 'PlayerAlly', mobileTeam: 'PlayerAlly', health: 20, basics: { team: 'PlayerAlly' } }, companion: 'k' };
    const targeting = (a, pf, dt) => runTargetMachine(m, [m], pf, dt, { infighting: true, playerEntity: { health: 100 } });
    return { ai, step: (leader, dt = 1 / 60) => ai.update(dt, leader, mkSenses({ targeting }), false) };
  };
  // 20 degrees off its way: it walks the first step (the pursuit's gate stood it to turn)
  const yaw20 = Math.atan2(10, 0) - 20 * Math.PI / 180;
  const a = body([0, 0, 0], yaw20);
  a.ai.follow = { feet: () => [5, 0, 0], stop: 2.5 };
  a.step([5, 0, 0]); a.step([5, 0, 0]);   // two frames: no classic tick yet, so no turn - the gate alone decides
  assert.equal(a.ai.moving, true, 'walking while it turns');
  assert.ok(Math.abs(a.ai.yaw - yaw20) < 1e-9, 'not yet turned');
  // far behind: the hurried walk; near: its own
  const far = body([0, 0, 0], Math.PI / 2);
  far.ai.follow = { feet: () => [40, 0, 0], stop: 2.5 };
  for (let i = 0; i < 30; i++) far.step([40, 0, 0]);
  const x0 = far.ai.feet[0];
  for (let i = 0; i < 60; i++) far.step([40, 0, 0]);
  const v = enemyMoveSpeed(50);
  assert.ok(Math.abs((far.ai.feet[0] - x0) - v * FOLLOW_RUN_PACE) < 0.2, `hurrying at ${(far.ai.feet[0] - x0).toFixed(2)} m/s (${(v * FOLLOW_RUN_PACE).toFixed(2)})`);
  const near = body([0, 0, 0], Math.PI / 2);
  near.ai.follow = { feet: () => [7.5, 0, 0], stop: 2.5 };
  for (let i = 0; i < 6; i++) near.step([7.5, 0, 0]);
  const n0 = near.ai.feet[0];
  for (let i = 0; i < 30; i++) near.step([7.5, 0, 0]);
  assert.ok(Math.abs((near.ai.feet[0] - n0) - v * 0.5) < 0.1, 'inside FOLLOW_RUN_M its own walk');
});

// ── QUIET-COMPANIONS ──────────────────────────────────────────────────────────────────────────────────────────────

test('QUIET-COMPANIONS the bark: a companion waits COMPANION_ATTRACT_SCALE times its roll where a foe waits the roll, through the one seam; every pool passes its body\'s companion (mutants: the scale dropped; the flag unpassed)', () => {
  assert.equal(COMPANION_ATTRACT_SCALE, 6);
  const barks = (companion) => {
    const src = new EnemySoundSource(0, () => 0);   // a rat (not muted), its roll the shortest: 3 s
    const played = [];
    const audio = { play3d: (clip) => played.push(clip) };
    const at = [];
    for (let i = 1; i <= 600; i++) { if (tickEnemySound(src, [0, 0, 0], [2, 0, 0], 0.1, { audio, companion })) at.push(i / 10); }
    return { at, played };
  };
  const foe = barks(false), mate = barks(true);
  const near = (t, w) => t > w - 1e-9 && t <= w + 0.1 + 1e-9;   // the first tick past the wait (0.1 s ticks)
  // MONSTER-QUIET (2026-10-20, Dudey: "decrease the monster scream frequenzy by 60%"): a monster foe at 2.5 times its roll
  // (the seam's attractStep), eight in a minute where it was twenty; the companion's own six times stays as it was
  assert.ok(near(foe.at[0], MIN_ATTRACT_DELAY * FOE_ATTRACT_SCALE), `a foe at 2.5 times its roll (${foe.at[0]})`);
  assert.equal(foe.at.length, 8, 'eight in a minute');
  assert.ok(near(mate.at[0], MIN_ATTRACT_DELAY * COMPANION_ATTRACT_SCALE), `a companion at six times it (${mate.at[0]})`);
  assert.equal(mate.at.length, 3, 'three in a minute');
  assert.ok(mate.played.length === 3, 'and played');
  for (const p of ['src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    const s = rd(p);
    const calls = s.match(/tickEnemySound\(f\.sounds,[^\n]*\);/g) ?? [];
    assert.equal(calls.length, 2, `${p}: its two bark sites`);
    for (const c of calls) assert.match(c, /companion: f\.companion != null \}/, `${p}: passes the companion`);
  }
  assert.match(rd('src/scenes/hostCombat.js'), /source\.tick\(attractStep\(source, dt, companion\), dist, \(\) => enemySoundOccluded\(collider, feet, playerFeet\), \{ companion \}\)/, 'the seam hands it on');
});

test('QUIET-COMPANIONS the portals: one sound in PORTAL_SOUND_GAP_MS a set - the party arriving at a door rings once, every portal still opening (mutants: no gap)', () => {
  assert.equal(PORTAL_SOUND_GAP_MS, 1500);
  let now = 10_000;
  const played = [];
  const renderer = { createBillboardBatch: () => ({ conceal: undefined }), destroyBillboardBatch: () => {}, uploadTexture: () => {}, uploadEmissionTexture: () => {} };
  const set = createPortalSet({ renderer, audio: { play3dId: (id) => played.push(id) }, now: () => now });
  set.open([0, 0, 0]); set.open([1, 0, 0]); set.open([2, 0, 0]);
  assert.equal(set.count, 3, 'three portals');
  assert.deepEqual(played, [PORTAL_SOUND], 'one sound');
  now += PORTAL_SOUND_GAP_MS - 1; set.open([0, 0, 0]);
  assert.equal(played.length, 1);
  now += 1; set.open([0, 0, 0]);
  assert.equal(played.length, 2, 'the gap out, the next rings');
  now += 5000; set.open([0, 0, 0], { quiet: true });
  assert.equal(played.length, 2, 'a quiet one never');
});

// ── QUIET-VENGEANCE ───────────────────────────────────────────────────────────────────────────────────────────────

test('QUIET-VENGEANCE the source: `vengence` (386) at 0.4 and no sooner than a minute after its last; every other quest sound as DFU plays it; busy still skips (mutants: the volume whole; no gap; the gap on every sound)', () => {
  assert.deepEqual(QUIET_QUEST_SOUNDS[386], { volume: 0.4, gapS: 60 });
  let t = 0;
  const played = [];
  const src = new QuestAudioSource({ playOneShotId: (id, v) => { played.push([id, v]); return 2; } }, () => t);
  assert.equal(src.playQuestSound(386), true);
  assert.deepEqual(played, [[386, 0.4]]);
  assert.equal(src.playQuestSound(386), false, 'busy: skipped');
  t = 30;
  assert.equal(src.playQuestSound(386), false, 'idle, inside its minute: refused as a busy source is');
  assert.equal(src.playQuestSound(361), true, 'another sound is not held');
  assert.deepEqual(played[1], [361, 1], 'at full volume');
  t = 31;
  assert.equal(src.playQuestSound(361), false, 'its clip still ringing: the busy skip, DFU\'s');
  t = 33;
  assert.equal(src.playQuestSound(361), true, 'and no gap of its own');
  t = 60;
  assert.equal(src.playQuestSound(386), true, 'the minute out');
  assert.equal(played.length, 4);
});

test('QUIET-VENGEANCE end to end: S0000977\'s own line over the real action and source - once a minute at 0.4 where DFU rang every five game minutes (25 real seconds at the classic scale); both quest hosts call the one body', () => {
  let real = 0;
  const played = [];
  const src = new QuestAudioSource({ playOneShotId: (id, v) => { played.push([real, id, v]); return 1.5; } }, () => real);
  let game = 1000;
  const quest = { nowSeconds: () => game, hooks: { playSound: (id) => src.playQuestSound(id) } };
  loadQuestTables({ 'Quests-Sounds': rd('vendor/dfu-quests/Tables/Quests-Sounds.txt') });
  const line = rd('vendor/dfu-quests/Quests/S0000977.txt').split('\n').find((l) => /play sound vengence/.test(l)).trim();
  assert.equal(line, 'play sound vengence 5 0', 'the ghost\'s line, from the corpus');
  const action = new PlaySound(null).createNew(line, quest);
  assert.ok(action, 'the corpus line parses');
  assert.equal(action.interval, 300, 'five game minutes');
  // ten real minutes at the classic 12x: a game second each 1/12 real second
  for (let i = 0; i < 12 * 600; i++) { real = i / 12; game = 1000 + i; action.update(null); }
  assert.ok(played.every(([, id, v]) => id === 386 && v === 0.4), 'the ghost, softer');
  assert.ok(played.length >= 9 && played.length <= 10, `about once a minute (${played.length} in ten)`);
  for (let k = 1; k < played.length; k++) assert.ok(played[k][0] - played[k - 1][0] >= 60, 'never inside its minute');
  assert.match(rd('src/scenes/world.js'), /playSound: \(id\) => questAudioSource\.playQuestSound\(id\),/);
  assert.match(rd('src/scenes/exterior.js'), /playSound: \(id\) => _questAudioSource\.playQuestSound\(id\),/);
});
