// DW-E4 (2026-09-25) - ILIAC PUDDLE NO MORE 1.2.2's FOES OF THE DEEP (jet082), PINNED: the depth table
// and its weights against UnderwaterEnemySpawner.DepthAquaticTable; the rare and boss rosters; the column
// and the place; the floor-bound drop; the attempts off the frequency; the treasure guards' count, ring and
// view test (DeepWaterWorld); the spawner and the pulse's two lanes through fakes; a foe stood by the real
// exterior pool where the mod sets its transform, on its team, saved by nothing, swimming under the level
// the swim driver leaves; the world's wiring.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEPTH_AQUATIC_TABLE, RARE_TYPES, BOSS_TYPES, TREASURE_GUARD_TEAM, enemyRoster, depthBandWeight, pickAquaticForDepth,
  pickEnemyForDepth, mustSpawnOnFloor, resolveSpawnColumn, pickEnemyPosition, alignFloorEnemyY, scaledEnemyAttemptsPerPixel,
  rollCount, rollTreasureGuardCount, pickRingDistance, isBehindPlayerHeading, isOutsideImmediateView, spawnRevealDistance,
} from '../src/world/underwaterEnemies.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { createEnemySpawner, createEncounterPulse, trySpawnTreasureGuards, ENEMY_ATTEMPTS_PER_PIXEL_PER_TICK } from '../src/scenes/deepWatersEncounters.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { enemyControllerHeight, idleSpriteHeight } from '../src/characters/enemyAnchor.js';

const f32 = Math.fround;
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const near = (a, b, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('DW-E4: the depth table is DepthAquaticTable row for row; the rare and the boss rosters; the guards are the Undead; GetEnemyRoster in its order (mutants: any row)', () => {
  assert.deepEqual(DEPTH_AQUATIC_TABLE.map((e) => [e.type, e.weight, e.minDepthFraction, e.maxDepthFraction]), [
    [11, 60, 0, f32(0.7)], [42, 18, 0, f32(0.45)], [10, 10, 0, f32(0.55)], [41, 25, f32(0.15), 1], [17, 6, f32(0.4), 1], [15, 7, f32(0.45), 1],
    [18, 7, f32(0.5), 1], [23, 5, f32(0.6), 1], [38, 4, f32(0.7), 1], [28, 3, f32(0.75), 1], [32, 2, f32(0.85), 1],
  ]);
  assert.deepEqual(RARE_TYPES, [18, 15, 23, 17, 38, 28, 32]);
  assert.deepEqual(BOSS_TYPES, [33, 30]);
  assert.equal(TREASURE_GUARD_TEAM, 'Undead', 'MobileTeams 13');
  assert.deepEqual(enemyRoster(), [11, 42, 10, 41, 17, 15, 18, 23, 38, 28, 32, 33, 30]);
});

test('DW-E4: a type weighs its weight in its band and falls off over 0.18 past it; the table walked by weight at the depth; the Slaughterfish when nothing weighs (mutants: the softness, the walk)', () => {
  const zombie = DEPTH_AQUATIC_TABLE[4];   // 0.4 .. 1
  assert.equal(depthBandWeight(zombie, 0.5), 6);
  near(depthBandWeight(zombie, 0.31), f32(6 * f32(1 - f32(f32(f32(0.4) - 0.31) / f32(0.18)))), 1e-6);
  assert.equal(depthBandWeight(zombie, 0.2), 0);
  // at the surface: slaughterfish 60, lamia 18, nymph 10, and the dreugh's 25 x (1 - 0.15/0.18)
  const dreugh0 = depthBandWeight(DEPTH_AQUATIC_TABLE[3], 0);
  near(dreugh0, 25 * (1 - 0.15 / 0.18), 1e-5);
  const total = f32(f32(f32(60 + 18) + 10) + dreugh0);
  assert.equal(pickAquaticForDepth(0, () => 0), M.Slaughterfish);
  assert.equal(pickAquaticForDepth(0, () => f32(60.5 / total)), M.Lamia);
  assert.equal(pickAquaticForDepth(0, () => f32(78.5 / total)), M.Nymph);
  assert.equal(pickAquaticForDepth(0, () => f32(88.5 / total)), M.Dreugh);
  assert.equal(pickAquaticForDepth(1, () => 0.9999), M.Lich, 'the deep\'s last row');
});

test('DW-E4: past 0.6 of the depth a boss one time in a hundred - its draw made only there; the floor-bound types (mutants: the chance, the depth, the floor set)', () => {
  let draws = 0;
  const r = () => { draws++; return 0.005; };
  assert.ok(BOSS_TYPES.includes(pickEnemyForDepth(0.6, r)), 'a boss');
  draws = 0;
  pickEnemyForDepth(0.59, r);
  assert.equal(draws, 1, 'shallower: no boss draw, the table\'s alone');
  assert.ok(!BOSS_TYPES.includes(pickEnemyForDepth(0.9, seq([0.011, 0.5]))));
  assert.equal(pickEnemyForDepth(0.9, seq([0.005, 0.5])), M.VampireAncient, 'Range(0, 2) at 0.5: the second');
  for (const t of [17, 15, 38, 10, 32, 33, 28, 30]) assert.ok(mustSpawnOnFloor(t), `${t} on the floor`);
  for (const t of [11, 42, 41, 18, 23]) assert.ok(!mustSpawnOnFloor(t), `${t} swims`);
});

test('DW-E4: the column is the floor + 2.5 to the surface - 3, at least 4 m apart; a floor foe half a metre over the floor; a swimmer anywhere, leaning into the lowest 0.35 past 0.55 of the depth; the floor drop to 0.52 of the controller (mutants: the clearances, the lean)', () => {
  const col = { oceanY: 34, seafloorY: 4, depth: 30, entry: {} };
  const f = { column: () => col, renderedSeafloorY: (c) => c.seafloorY };
  const c = resolveSpawnColumn(f, 0, 0, 200);
  assert.deepEqual([c.floorY, c.surfaceY], [6.5, 31]); near(c.depthFraction, 0.15, 1e-12); assert.equal(c.column, col);
  assert.equal(resolveSpawnColumn({ ...f, column: () => ({ ...col, seafloorY: 24.6 }) }, 0, 0, 200), null, '27.1 to 31: under 4 m');
  assert.ok(resolveSpawnColumn({ ...f, column: () => ({ ...col, seafloorY: 24.5 }) }, 0, 0, 200), '4 m exactly');
  assert.equal(resolveSpawnColumn({ ...f, column: () => null }, 0, 0, 200), null);
  assert.deepEqual(pickEnemyPosition(1, 2, 6.5, 31, M.Zombie, 0.15, () => 0.5), [1, 4.5, 2]);
  assert.deepEqual(pickEnemyPosition(1, 2, 6.5, 31, M.Slaughterfish, 0.15, () => 0.5), [1, 6.5 + 24.5 * 0.5, 2]);
  const deep = pickEnemyPosition(1, 2, 6.5, 31, M.Slaughterfish, 1, seq([0.9, 0.5]));
  near(deep[1], 6.5 + 24.5 * f32(0.35 * 0.5), 1e-5, 'the full lean: Lerp(t, Range(0, 0.35), 1)');
  const half = pickEnemyPosition(1, 2, 6.5, 31, M.Slaughterfish, 0.775, seq([0.9, 0.5]));
  near(half[1], 6.5 + 24.5 * (0.9 + (f32(0.35 * 0.5) - 0.9) * 0.5), 1e-5, 'half the lean at 0.775');
  near(alignFloorEnemyY(4.5, 2), 4 + 1.04, 1e-12);
});

test('DW-E4: 96 attempts x the frequency / 0.5; RollCount; five guards at 0.6 and up; the ring uniform over its area (mutants: the rounding, the fraction, the clamp, the sqrt)', () => {
  assert.equal(scaledEnemyAttemptsPerPixel(0.5), 96); assert.equal(scaledEnemyAttemptsPerPixel(0), 0);
  assert.equal(scaledEnemyAttemptsPerPixel(f32(0.3)), Math.round(96 * f32(f32(0.3) / 0.5)));
  assert.equal(rollCount(2.25, () => 0.2), 3); assert.equal(rollCount(2.25, () => 0.3), 2); assert.equal(rollCount(-1, () => 0), 0);
  assert.equal(rollCount(2.25, () => 0.25), 2, 'Random.value < the fraction, strictly');
  assert.equal(rollTreasureGuardCount(1, () => 0.99), 5); assert.equal(rollTreasureGuardCount(0.3, () => 0.4), 3);
  assert.equal(rollTreasureGuardCount(0.3, () => 0.6), 2, '2.5 - the half its chance');
  near(pickRingDistance(8, 30, () => 0), 8, 1e-12); near(pickRingDistance(8, 30, () => 1), 30, 1e-12);
  near(pickRingDistance(8, 30, () => 0.5), Math.sqrt((64 + 900) / 2), 1e-6);
});

test('DW-E4: IsOutsideImmediateView - behind the heading past 12 m, never; behind the camera, yes; on screen, only past the reveal distance; off screen, past the sight or off the sides and the bottom (mutants: each branch)', () => {
  const player = [0, 0, 0];
  // a camera looking down +z; the viewport: x across [-10, 10] at z = 10, y likewise, z the depth
  const view = { forward: [0, 0, 1], viewport: (p) => [(p[0] / Math.max(p[2], 1e-6) + 1) / 2, (p[1] / Math.max(p[2], 1e-6) + 1) / 2, p[2]], revealDistance: 70 };
  assert.equal(isBehindPlayerHeading([0, 0, -20], player, view.forward), true);
  assert.equal(isBehindPlayerHeading([0, 0, -11], player, view.forward), false, 'within 12 m: not behind');
  assert.equal(isOutsideImmediateView([0, 0, -20], player, 70, 0.08, view), false, 'behind the heading: in view (the mod\'s own answer)');
  assert.equal(isOutsideImmediateView([0, 0, -5], player, 70, 0.08, view), true, 'behind the camera within 12 m: out of view');
  assert.equal(isOutsideImmediateView([0, 0, 50], player, 70, 0.08, view), false, 'on screen inside the reveal distance');
  assert.equal(isOutsideImmediateView([0, 0, 80], player, 70, 0.08, view), true, 'on screen past it');
  assert.equal(isOutsideImmediateView([300, 0, 30], player, 70, 0.08, view), true, 'off screen past the sight');
  assert.equal(isOutsideImmediateView([60, 0, 30], player, 70, 0.08, view), true, 'off the side');
  assert.equal(isOutsideImmediateView([0, -60, 30], player, 70, 0.08, view), true, 'off the bottom');
  assert.equal(isOutsideImmediateView([0, 60, 30], player, 70, 0.08, view), true, 'off the top, past the margin');
  assert.equal(isOutsideImmediateView([0, 0, 50], player, 70, 0.08, null), true, 'no camera: out of view');
  near(spawnRevealDistance(70, [3, 5, 4]), 80, 1e-12, 'the vision + twice the flat speed');
});

/** A 60 m sea on every pixel. */
const deepSea = (roll) => ({ time: 0, dt: 0.1, frame: 0, roll, playerPos: [0, 0, 0], column: () => ({ oceanY: 34, seafloorY: -26, depth: 60, entry: {} }), renderedSeafloorY: (c) => c.seafloorY, visibleDistance: 70, raycast: () => null });

test('DW-E4: the spawner - 96 x the frequency / 0.5 attempts a pixel, four a tick; one foe a frame; the cap; a failed stand gives its count back once; a departed group\'s queue dropped and its count given back (mutants: the one a frame, the cap, the release, the give-back)', () => {
  const settings = { on: true, frequency: 0.5, maxLive: 128, waterDepth: 200 };
  const stood = [];
  let failNext = false;
  const spawner = createEnemySpawner({
    settings: () => settings,
    pixelOrigin: () => [0, 0, 0],
    spawnEnemy: (req, failed) => {
      if (failNext) { failNext = false; return null; }
      const o = { ...req, gone: false, failed, destroyed: () => o.gone, position: () => req.pos, destroy: () => { o.gone = true; }, hide: () => {} };
      stood.push(o);
      return o;
    },
  });
  assert.equal(spawner.canPopulate(), true);
  spawner.tickPopulate(deepSea(() => 0.5), {}, 'p', { n: ENEMY_ATTEMPTS_PER_PIXEL_PER_TICK });
  assert.equal(ENEMY_ATTEMPTS_PER_PIXEL_PER_TICK, 4);
  assert.equal(spawner.groupOf('p').attemptsRemaining, 92, 'four spent of 96');
  assert.equal(spawner.pendingCount, 4); assert.equal(spawner.liveCount, 4);
  spawner.pumpPendingSpawns();
  assert.equal(stood.length, 1, 'one a frame');
  failNext = true;
  spawner.pumpPendingSpawns();
  assert.equal(spawner.liveCount, 3, 'a refused spawn un-counted');
  spawner.pumpPendingSpawns();
  stood[1].failed(); stood[1].failed();
  assert.equal(spawner.liveCount, 2, 'a stand that failed later gives back once');
  // the cap
  settings.maxLive = 3;
  spawner.tickPopulate(deepSea(() => 0.5), {}, 'q', { n: 4 });
  assert.equal(spawner.liveCount, 3, 'one more to the cap');
  assert.equal(spawner.groupOf('q').attemptsRemaining, 0, 'the cap reached: the pixel\'s attempts end');
  // released: the foes to the destroy queue, the group's count back, its queue dropped
  const released = [];
  spawner.tickDespawn(new Set(['q']), (o) => released.push(o));
  assert.equal(released.length, 2, 'the two that stood in p');
  assert.equal(spawner.liveCount, 1, 'q\'s one left');
  stood[0].failed();
  assert.equal(spawner.liveCount, 1, 'a late failure in a released group gives nothing back twice');
  const before = stood.length;
  spawner.pumpPendingSpawns();   // p's last queued spawn: its group left
  assert.equal(stood.length, before + 0, 'dropped');
  settings.on = false;
  assert.equal(spawner.canPopulate(), false);
  settings.on = true; settings.frequency = 0;
  assert.equal(spawner.canPopulate(), false, 'a frequency of nothing');
  spawner.clearAll();
  assert.equal(spawner.liveCount, 0); assert.equal(spawner.pendingCount, 0);
});

test('DW-E4: the pulse runs both lanes in the mod\'s order - the fish\'s spawns then the foes\', each lane\'s despawn, then per pixel two fish attempts and four foe attempts; a lane off two seconds is cleared alone (mutants: the order, the budgets)', () => {
  const calls = [];
  const lane = (name) => ({
    pumpPendingSpawns: () => calls.push(`${name} pump`),
    tickDespawn: () => calls.push(`${name} despawn`),
    tickPopulate: (f, e, key, budget) => calls.push(`${name} ${key} ${budget.n}`),
    clearAll: () => calls.push(`${name} clear`),
  });
  let foesOn = true;
  const pulse = createEncounterPulse({
    canRunHeavy: () => true, exteriorWaterContext: () => true, playerPosition: () => [0, 0, 0],
    loadedPixels: () => [{ key: 'a', o: [-100, 0, -100] }, { key: 'b', o: [-100, 0, 150] }], isWaterPixel: () => true,
    pixelOrigin: (e) => e.o, keyOf: (e) => e.key,
    fish: { spawner: lane('fish'), canPopulate: () => true, attempts: 2 },
    enemies: { spawner: lane('foes'), canPopulate: () => foesOn, attempts: 4 },
  });
  pulse.pump({ time: 0 });
  assert.deepEqual(calls, ['fish pump', 'foes pump', 'fish despawn', 'foes despawn', 'fish a 2', 'foes a 4', 'fish b 2', 'foes b 4']);
  calls.length = 0;
  foesOn = false;
  pulse.pump({ time: 0.1 }); pulse.pump({ time: 1.2 }); pulse.pump({ time: 2.2 });
  assert.ok(calls.includes('foes clear') && !calls.includes('fish clear'), 'the foes\' lane cleared, the fish kept');
  assert.ok(!calls.some((c) => /^foes [ab] /.test(c)), 'and not populated while off');
});

test('DW-E4: the treasure guards - their count off the frequency, a boss first two times in a hundred, on the 8 - 30 m ring outside the view, 8 tries a guard and 15 more, at the centre when none stood; the Undead\'s team (mutants: the boss chance, the ring, the tries, the fallback)', () => {
  const settings = { on: true, frequency: 0.3, waterDepth: 200 };
  const view = null;   // no camera: everything is outside the view
  const stood = [];
  const spawnGuard = (o) => { stood.push(o); return {}; };
  // roll: boss 0.5 (no), count RollCount(2.5): 0.4 -> 3; then per try: angle, ring, [boss-free] rare pick, position roll
  const f = deepSea(() => 0.4);
  const n = trySpawnTreasureGuards({ f, centre: [100, 0, 100], settings, canRunHeavy: true, playerPos: [0, 0, 0], vision: 70, view, spawnGuard });
  assert.equal(n, 3); assert.equal(stood.length, 3);
  for (const s of stood) {
    assert.equal(s.team, 'Undead');
    assert.ok(RARE_TYPES.includes(s.type));
    const d = Math.hypot(s.pos[0] - 100, s.pos[2] - 100);
    assert.ok(d >= 8 - 1e-6 && d <= 30 + 1e-6, `on the ring: ${d}`);
  }
  // a boss: the first guard is one, the rest rare
  stood.length = 0;
  trySpawnTreasureGuards({ f: deepSea(seq([0.01, 0.4, 0.4, 0.4, 0.4, 0.4])), centre: [100, 0, 100], settings, canRunHeavy: true, playerPos: [0, 0, 0], vision: 70, view, spawnGuard });
  assert.ok(BOSS_TYPES.includes(stood[0].type), 'the boss first');
  assert.ok(stood.slice(1).every((s) => RARE_TYPES.includes(s.type)));
  stood.length = 0;
  trySpawnTreasureGuards({ f: deepSea(seq([0.03, 0.4, 0.4, 0.4, 0.4, 0.4])), centre: [100, 0, 100], settings, canRunHeavy: true, playerPos: [0, 0, 0], vision: 70, view, spawnGuard });
  assert.ok(stood.length > 0 && stood.every((s) => RARE_TYPES.includes(s.type)), 'three in a hundred: no boss (two in a hundred)');
  // a boss with no count still stands one
  stood.length = 0;
  assert.equal(trySpawnTreasureGuards({ f: deepSea(seq([0.01, 0.99])), centre: [0, 0, 0], settings: { ...settings, frequency: 0 }, canRunHeavy: true, playerPos: [0, 0, 0], vision: 70, view, spawnGuard }), 1);
  // the ring all dry, the centre wet: one at the centre after 8n + 15 tries
  stood.length = 0;
  let asked = 0;
  const ringDry = { ...deepSea(() => 0.4), column: (x, z) => { asked++; return x === 100 && z === 100 ? { oceanY: 34, seafloorY: -26, depth: 60, entry: {} } : null; } };
  assert.equal(trySpawnTreasureGuards({ f: ringDry, centre: [100, 0, 100], settings, canRunHeavy: true, playerPos: [0, 0, 0], vision: 70, view, spawnGuard }), 1);
  assert.equal(asked, 8 * 3 + 15 + 1, 'every try, then the centre');
  assert.deepEqual([stood[0].pos[0], stood[0].pos[2]], [100, 100]);
  // gates
  assert.equal(trySpawnTreasureGuards({ f, centre: [0, 0, 0], settings: { ...settings, on: false }, canRunHeavy: true, playerPos: [0, 0, 0], vision: 70, view, spawnGuard }), 0);
  assert.equal(trySpawnTreasureGuards({ f, centre: [0, 0, 0], settings, canRunHeavy: false, playerPos: [0, 0, 0], vision: 70, view, spawnGuard }), 0);
  assert.equal(trySpawnTreasureGuards({ f, centre: [0, 0, 0], settings, canRunHeavy: true, playerPos: null, vision: 70, view, spawnGuard }), 0);
});

// ── the real exterior pool ───────────────────────────────────────
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
function craftMonsterBsa(names) {
  const NAME_FIELD = 14, ENTRY = 18, body = craftCfg();
  const out = new Uint8Array(4 + body.length * names.length + ENTRY * names.length); const v = new DataView(out.buffer);
  v.setInt16(0, names.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (let i = 0; i < names.length; i++) { out.set(body, pos); pos += body.length; }
  for (const name of names) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, body.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa(['ENEMY011.CFG', 'ENEMY017.CFG']);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };

test('DW-E4: the exterior pool stands a deep foe where the mod sets its transform (a floor-bound one dropped to 0.52 of its capsule), on the team it is given, saved by nothing, and swimming under the one water level the swim driver leaves (mutants: the transform, the team, the save, the level)', async () => {
  let level = null;
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '1,1',
    playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
    audio: null, onPlayerHurt: () => {}, rolls: () => 0.5,
    waterLevelY: () => level,
  });
  const idleH = idleSpriteHeight(stubTex);
  const fish = await pool.spawnFoe(M.Slaughterfish, [10, 20, 10], { yaw: 0, loose: true, transient: true, team: 'Undead', transformY: () => 20 });
  near(fish.ai.feet[1], 20 - idleH / 2, 1e-9, 'the transform is the sprite\'s centre');
  assert.equal(fish.entity.team, 'Undead', 'SetEnemyTeam');
  assert.equal(fish.entity.mobileTeam, 'Aquatic', 'the MobileEnemy copy kept');
  const zombie = await pool.spawnFoe(M.Zombie, [12, 4.5, 12], { yaw: 0, loose: true, transient: true, transformY: (h) => alignFloorEnemyY(4.5, h) });
  const h = enemyControllerHeight(idleH, 'General');
  near(zombie.ai.feet[1], 4 + h * 0.52 - idleH / 2, 1e-9, 'AlignFloorEnemyController');
  assert.equal(zombie.entity.team, 'Undead', 'its own team when none is given');
  const kept = await pool.spawnFoe(M.Zombie, [14, 0, 14], { feetGiven: true });
  assert.deepEqual(pool.snapshotWorld((p) => ({ x: p[0], z: p[2] })).map((s) => s.nativeX), [14], 'only the foe with a LoadID is saved');
  assert.equal(fish.ai.waterSurfaceY(0, 0), null, 'no level: no water');
  level = 34.75;
  assert.equal(fish.ai.waterSurfaceY(0, 0), 34.75, 'the forged level, the same for every foe');
  assert.equal(kept.ai.waterSurfaceY(5, 5), 34.75);
  // the port's own relevance cull (the encounter pool's allocation guard) passes a MANAGED foe by: the mod's spawner
  // releases its foes itself, and they stand until it does, as DFU's loose enemies do
  const far = await pool.spawnFoe(M.Slaughterfish, [500, 20, 500], { yaw: 0, loose: true, transient: true, managed: true, transformY: () => 20 });
  const stray = await pool.spawnFoe(M.Slaughterfish, [-500, 20, 500], { yaw: 0, loose: true, transformY: () => 20 });
  pool.update(0.016, [0, 0, 0], [0, 1.7, 0], {});
  assert.equal(far.dead, false, '700 m off, kept: its spawner\'s to release');
  assert.equal(stray.dead, true, 'an encounter foe that far is culled, as ever');
});

test('DW-E4: the world host - the foes\' lane on the pulse, four attempts; a foe stood through the exterior pool with its transform set, hostile to the player, not saved, the tracker\'s entry at once; every exterior foe reads the level the swim driver leaves; the settings (pins)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /enemies: dwEnemies \? \{ spawner: dwEnemies, canPopulate: dwEnemies\.canPopulate, attempts: ENEMY_ATTEMPTS_PER_PIXEL_PER_TICK \} : null,/);
  assert.match(w, /exteriorFoes\.spawnFoe\(type, pos, \{ yaw: 0, loose: true, transient: true, managed: true, team, transformY: \(h\) => \(floor \? alignFloorEnemyY\(pos\[1\], h\) : pos\[1\]\) \}\)/);
  assert.match(w, /f\.ai\.makeEnemyHostileToAttacker\?\.\(PLAYER_TARGET, walkMode \? \[\.\.\.player\.pos\] : null\);/, 'ConfigureSpawnedEnemy: MakeEnemyHostileToAttacker(the player)');
  assert.match(w, /if \(o\.gone\) \{ exteriorFoes\.removeFoe\(f\); return; \}/, 'released while it stood: removed as it lands');
  assert.match(w, /waterLevelY: \(\) => dwPlayer\?\.waterLevelY \?\? null,/);
  const h = rd('src/scenes/deepWatersHost.js');
  assert.match(h, /on: get\('General\.SpawnUnderwaterEnemies'\) === true,\n\s+frequency: scaledSliderValue\(get\('General\.EnemyFrequency'\), 0\.5\),\n\s+maxLive: Math\.max\(0, Math\.trunc\(Number\(get\('General\.MaxLiveEnemies'\)\)\)\),/);
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /waterSurfaceY: waterLevelY \? \(\) => waterLevelY\(\) : null,/);
});
