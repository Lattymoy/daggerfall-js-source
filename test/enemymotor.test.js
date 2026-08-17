// C8 E2: the classic enemy AI core, verbatim constants + behavior on
// synthetic geometry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGHT_RADIUS, HEARING_RADIUS, FIELD_OF_VIEW, MELEE_DISTANCE,
  CLASSIC_MELEE_DISTANCE_VS_AI, CLASSIC_TURN_DEG, CLASSIC_UPDATE_INTERVAL,
  SYSTEM_TIMER_UPDATES_DIVISOR, MOVE_YAW_GATE_DEG, DF_WALK_BASE,
  enemyMoveSpeed, turnTowards, withinYaw, canSeeTarget, EnemyAI,
} from '../src/characters/enemyMotor.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { Collider } from '../src/player/collider.js';

const approx = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const seqRolls = (v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
// P17 fixed stepping: update() consumes whole 1/60 steps, so a bare
// update(CLASSIC_UPDATE_INTERVAL) no longer lands a senses tick. Four
// 1/60 steps accumulate 0.0667 >= 0.0625 - EXACTLY one classic tick
// (and one roll-sequence consumption) per call, for up to ~14 calls
// before the remainders stack a second tick (tests stay well under).
const tick = (ai, playerFeet, senses) => { for (let i = 0; i < 4; i++) ai.update(1 / 60, playerFeet, senses); };
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);

test('enemyMotor: verbatim classic constants', () => {
  approx(SIGHT_RADIUS, 4096 * GLOBAL_SCALE);       // EnemySenses.cs:30
  assert.equal(HEARING_RADIUS, 25);                // EnemySenses.cs:31
  assert.equal(FIELD_OF_VIEW, 180);                // EnemySenses.cs:32
  assert.equal(MELEE_DISTANCE, 2.25);              // EnemyAttack.cs:30
  assert.equal(CLASSIC_MELEE_DISTANCE_VS_AI, 1.5); // EnemyAttack.cs:31
  assert.equal(CLASSIC_TURN_DEG, 11.25);           // EnemyMotor.cs TurnToTarget classic comment
  assert.equal(CLASSIC_UPDATE_INTERVAL, 0.0625);   // GameManager.cs:42
  approx(SYSTEM_TIMER_UPDATES_DIVISOR, 0.0549254); // EnemySenses.cs:75
  assert.equal(MOVE_YAW_GATE_DEG, 5.625);          // EnemyMotor.cs AttemptMove
  assert.equal(DF_WALK_BASE, 150);                 // PlayerSpeedChanger
  approx(enemyMoveSpeed(50), (50 + 150) * GLOBAL_SCALE);   // "same formula as when the player walks"
});

test('enemyMotor: classic turn clamps at 11.25deg per update', () => {
  const y1 = turnTowards(0, 1, 0);                  // target due +x = yaw PI/2
  approx(y1, 11.25 * Math.PI / 180);
  const y2 = turnTowards(0, Math.sin(0.05), Math.cos(0.05));   // 2.9deg away: full turn
  approx(y2, 0.05);
  assert.ok(withinYaw(y2, Math.sin(0.05), Math.cos(0.05), MOVE_YAW_GATE_DEG));
});

test('enemyMotor: LOS blocked by a wall, seen without; FOV gates the back', () => {
  const open = new Collider(() => 0);
  assert.ok(canSeeTarget(open, [0, 0, 0], 0, 1.8, [0, 0, 10]));          // facing +z, target ahead
  assert.ok(!canSeeTarget(open, [0, 0, 0], Math.PI, 1.8, [0, 0, 10]));   // facing -z: outside FOV 180
  const walled = new Collider(() => 0);
  walled.addMesh('wall', new Float32Array([-5, 0, 5, 5, 0, 5, 5, 4, 5, -5, 4, 5]), quadIdx, I);
  assert.ok(!canSeeTarget(walled, [0, 0, 0], 0, 1.8, [0, 0, 10]));       // wall at z=5 blocks
});

test('enemyMotor: pursues on the classic cadence and stops at MeleeDistance', () => {
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  const player = [0, 0, 12];
  for (let i = 0; i < 60 * 8; i++) ai.update(1 / 60, player);
  const dist = Math.hypot(player[0] - ai.feet[0], player[2] - ai.feet[2]);
  assert.ok(dist <= MELEE_DISTANCE + 0.1, `closed to ${dist}`);
  assert.ok(dist > 1.0, `orbit guard: ${dist}`);
  assert.equal(ai.moving, false);
  // never detected: never moves
  const ai2 = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  const far = [0, 0, SIGHT_RADIUS + 50];
  for (let i = 0; i < 60; i++) ai2.update(1 / 60, far);
  approx(ai2.feet[0], 0); approx(ai2.feet[2], 0);
});

test('P17: fixed stepping - a 10fps foe pursues to the SAME spot as a 60fps foe', () => {
  // The P16 law, foe-side: raw render-dt integration made pursuit
  // speed/gravity frame-rate dependent (the phone failure class).
  // Both drives decompose into identical 1/60 steps (0.1 = 6 exact
  // steps), so the trajectories must be bit-identical.
  const mkC = () => {
    const c = new Collider(() => -100);
    c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
    return c;
  };
  const player = [0, 0, 12];
  const ai60 = new EnemyAI(mkC(), [0, 0, 0], 0, { liveSpeed: 50 });
  const ai10 = new EnemyAI(mkC(), [0, 0, 0], 0, { liveSpeed: 50 });
  for (let i = 0; i < 60 * 4; i++) ai60.update(1 / 60, player);
  for (let i = 0; i < 10 * 4; i++) ai10.update(1 / 10, player);
  assert.equal(ai10.feet[0], ai60.feet[0]);
  assert.equal(ai10.feet[2], ai60.feet[2]);
  assert.equal(ai10.yaw, ai60.yaw);
  // The jank clamp: one 10-second hitch integrates at most 0.25s
  const hitch = new EnemyAI(mkC(), [0, 0, 0], 0, { liveSpeed: 50 });
  hitch.update(10, player);
  const ref = new EnemyAI(mkC(), [0, 0, 0], 0, { liveSpeed: 50 });
  for (let i = 0; i < 15; i++) ref.update(1 / 60, player);   // 0.25 = 15 steps
  assert.equal(hitch.feet[2], ref.feet[2]);
});

test('C12 flying: 3D pursuit at the face, hover with NO gravity when idle', () => {
  const mkC = () => {
    const c = new Collider(() => -100);
    c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
    return c;
  };
  // Undetected (far + behind): a flyer HOVERS exactly in place while
  // a grounded twin falls to the floor from the same spawn.
  const hover = new EnemyAI(mkC(), [0, 4, 0], 0, { liveSpeed: 50, behaviour: 'Flying' });
  const walker = new EnemyAI(mkC(), [0, 4, 0], 0, { liveSpeed: 50 });
  const far = [0, 0, -30];
  for (let i = 0; i < 60; i++) { hover.update(1 / 60, far); walker.update(1 / 60, far); }
  assert.equal(hover.feet[1], 4, 'flyers do not fall');
  assert.ok(walker.feet[1] < 0.1, 'walkers land');
  // Detected: pursue in 3D toward the target FACE (feet + 1.8) and
  // stop at MeleeDistance - the flyer DESCENDS from altitude to
  // striking height instead of walking beneath the player.
  const fly = new EnemyAI(mkC(), [0, 4, 0], 0, { liveSpeed: 50, behaviour: 'Flying' });
  const player = [0, 0, 10];
  for (let i = 0; i < 60 * 8; i++) fly.update(1 / 60, player);
  const d3 = Math.hypot(player[0] - fly.feet[0], player[1] - fly.feet[1], player[2] - fly.feet[2]);
  assert.ok(d3 <= MELEE_DISTANCE + 0.1, `closed to ${d3}`);
  assert.ok(fly.feet[1] < 4 && fly.feet[1] > 0.5, `at striking height, airborne: ${fly.feet[1]}`);
  assert.equal(fly.moving, false);
});

test('C12 aquatic: WaterMove gates - the surface margin cap and the beached freeze', () => {
  const mkC = () => {
    const c = new Collider(() => -100);
    c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
    return c;
  };
  // Surface at y=6: the fish rises toward a target face above the
  // water but its rise CAPS at center + 2.5 = surface (feet 2.6).
  const fish = new EnemyAI(mkC(), [0, 0, 2], 0, { liveSpeed: 50, behaviour: 'Aquatic', mobileId: 11, waterSurfaceY: () => 6 });
  const player = [0, 4, 12];   // face aim = y 5.8, above the cap
  for (let i = 0; i < 60 * 8; i++) fish.update(1 / 60, player);
  assert.ok(fish.feet[1] > 1, `rose in the water: ${fish.feet[1]}`);
  assert.ok(fish.feet[1] <= 6 - 0.9 - 2.5 + 0.05, `capped under the surface: ${fish.feet[1]}`);
  assert.ok(fish.feet[2] > 4, `still closed horizontally: ${fish.feet[2]}`);
  // Beached (center above the surface): FROZEN verbatim - no
  // pursuit, and no gravity either (WaterMove owns all movement).
  const beached = new EnemyAI(mkC(), [0, 7, 2], 0, { liveSpeed: 50, behaviour: 'Aquatic', mobileId: 11, waterSurfaceY: () => 6 });
  for (let i = 0; i < 60; i++) beached.update(1 / 60, [0, 7, 8]);
  assert.deepEqual(beached.feet, [0, 7, 2]);
  // A waterless block freezes the same way
  const dry = new EnemyAI(mkC(), [0, 3, 2], 0, { liveSpeed: 50, behaviour: 'Aquatic', mobileId: 11, waterSurfaceY: () => null });
  for (let i = 0; i < 60; i++) dry.update(1 / 60, [0, 3, 8]);
  assert.deepEqual(dry.feet, [0, 3, 2]);
});

test('C12 paralysis: flyers FALL out of the air, swimmers freeze, walkers stop', () => {
  const mkC = () => {
    const c = new Collider(() => -100);
    c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
    return c;
  };
  const player = [0, 0, 10];
  // "Intentional side-effect: paralyzed flying enemies fall out of
  // the air" (EnemyMotor comment) - flyerFalls.
  const fly = new EnemyAI(mkC(), [0, 4, 0], 0, { liveSpeed: 50, behaviour: 'Flying' });
  for (let i = 0; i < 60 * 2; i++) fly.update(1 / 60, player, null, true);
  assert.ok(fly.feet[1] < 0.1, `fell: ${fly.feet[1]}`);
  // "Paralyzed swimming enemies will just freeze in place"
  const fish = new EnemyAI(mkC(), [0, 1, 0], 0, { liveSpeed: 50, behaviour: 'Aquatic', mobileId: 11, waterSurfaceY: () => 6 });
  for (let i = 0; i < 60; i++) fish.update(1 / 60, player, null, true);
  assert.deepEqual(fish.feet, [0, 1, 0]);
  // Walkers: decisions stop (no pursuit) but gravity still runs
  const walk = new EnemyAI(mkC(), [0, 2, 0], 0, { liveSpeed: 50 });
  for (let i = 0; i < 60 * 2; i++) walk.update(1 / 60, player, null, true);
  assert.ok(walk.feet[1] < 0.1, 'landed');
  assert.ok(Math.abs(walk.feet[2]) < 1e-6, 'no pursuit while paralyzed');
});

test('C15 knockback: the WeaponManager formula + the motor shove/decay/hurt laws', async () => {
  const { weaponKnockbackSpeed, enemyWeightClassicUnits, KB_UNIT } = await import('../src/combat/formulas.js');
  const { KNOCKBACK_MOTION_CAP, KNOCKBACK_HURT_THRESHOLD } = await import('../src/characters/enemyMotor.js');
  // The formula, verbatim: 15-classic floor for weak hits; the exact
  // curve above it. damage 20 vs weight 100 (a rat-weight target):
  // kb = ((200-100)*256)/(100+200)*40 = 3413.33; ks = 2*(40-13.333)
  // = 53.333 classic -> /3.95.
  assert.equal(weaponKnockbackSpeed(1, 350), 15 / KB_UNIT);   // floored
  // damage 20 vs weight 100: kb = 3413.33, ks = 2*(40 - 13.333) =
  // 53.333 classic units through the ratio - exact.
  assert.ok(Math.abs(weaponKnockbackSpeed(20, 100) - (2 * (40 - ((100 * 256) / 300 * 40) / 256)) / KB_UNIT) < 1e-9);
  // Weight: monsters use the table weight, classes 240/350
  assert.equal(enemyWeightClassicUnits(false, 'male', 40), 40);
  assert.equal(enemyWeightClassicUnits(true, 'female', 40), 240);
  assert.equal(enemyWeightClassicUnits(true, 'male', 40), 350);
  // The motor: a knocked foe shoves along the ray INSTEAD of
  // pursuing, hurtKnock rides the threshold, and the 5-per-classic
  // decay ends it.
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  ai.detected = true;
  ai.knockbackSpeed = 20 / KB_UNIT;   // above the store cap? 20 < 40: kept
  ai.knockbackDir = [0, 0.5, -1];     // AWAY from the player at +z; grounded drops the y
  const player = [0, 0, 10];
  for (let i = 0; i < 8; i++) ai.update(1 / 60, player);
  assert.ok(ai.feet[2] < -0.1, `shoved away from the player: ${ai.feet[2]}`);
  assert.ok(ai.feet[1] < 0.2, 'grounded knockback DROPS the ray y (SimpleMove)');
  assert.equal(ai.hurtKnock, true);
  // Decay: 20 classic at 5/classic tick = 4 ticks = 0.25s
  for (let i = 0; i < 30; i++) ai.update(1 / 60, player);
  assert.equal(ai.knockbackSpeed, 0);
  assert.equal(ai.hurtKnock, false);
  // ...and pursuit resumes toward the player afterward
  const zAfterKnock = ai.feet[2];
  for (let i = 0; i < 60; i++) ai.update(1 / 60, player);
  assert.ok(ai.feet[2] > zAfterKnock, 'pursuit resumes after the knockback ends');
  // A knocked FLYER takes the full 3D ray AND falls (flyerFalls)
  const fly = new EnemyAI(c, [0, 4, 0], 0, { liveSpeed: 50, behaviour: 'Flying' });
  fly.knockbackSpeed = 20 / KB_UNIT;
  fly.knockbackDir = [0, 0, -1];
  const y0 = fly.feet[1];
  for (let i = 0; i < 12; i++) fly.update(1 / 60, [0, 0, -30]);   // undetected: would have hovered
  assert.ok(fly.feet[1] < y0, `a hit knocks the flyer out of the air: ${fly.feet[1]}`);
  assert.ok(fly.feet[2] < -0.1, 'and shoves it along the ray');
  assert.ok(KNOCKBACK_MOTION_CAP === 25 && KNOCKBACK_HURT_THRESHOLD === 5);
});

test('stealth: the chance formula + the spawn bands + the illusion gate (pure pins)', async () => {
  const { stealthChance, STEALTH_MAX_DISTANCE, wouldBeSpawnedInClassic, blockedByIllusionEffect,
    CLASSIC_SPAWN_XZ, CLASSIC_SPAWN_Y_UPPER, CLASSIC_DESPAWN_Y } = await import('../src/characters/enemyMotor.js');
  // 2 * ((classicDist * stealth) >> 10): 512 units x 50 -> 2*25 = 50;
  // 1024 units x 30 -> 60; the >>10 truncates like C#
  assert.equal(stealthChance(512 * GLOBAL_SCALE, 50), 50);
  assert.equal(stealthChance(1024 * GLOBAL_SCALE, 30), 60);
  assert.equal(stealthChance(100 * GLOBAL_SCALE, 7), 0);   // 700 >> 10 = 0
  approx(STEALTH_MAX_DISTANCE, 25.6);
  // The spawn band (not yet spawned): xz within 1024 units AND |y|
  // within 128 units; the despawn band widens y to 384 (hysteresis)
  approx(CLASSIC_SPAWN_XZ, 25.6); approx(CLASSIC_SPAWN_Y_UPPER, 3.2); approx(CLASSIC_DESPAWN_Y, 9.6);
  assert.ok(wouldBeSpawnedInClassic(20, 0, false));
  assert.ok(!wouldBeSpawnedInClassic(26, 0, false));        // xz outside the spawn band
  assert.ok(!wouldBeSpawnedInClassic(10, 5, false));        // y outside 3.2 when not yet spawned
  assert.ok(wouldBeSpawnedInClassic(10, 5, true));          // ...but INSIDE the 9.6 despawn band once spawned
  assert.ok(!wouldBeSpawnedInClassic(1094 * GLOBAL_SCALE + 1, 0, true));   // the hard 1094 cap
  // Illusion gate: sees-through exempts; invisible always blocks;
  // blending sees through under 8% (roll 7 passes, 8 fails); shade 4%
  assert.ok(!blockedByIllusionEffect(true, { invisible: true }));
  assert.ok(blockedByIllusionEffect(false, { invisible: true }));
  assert.ok(!blockedByIllusionEffect(false, {}));
  assert.ok(!blockedByIllusionEffect(false, { blending: true }, () => 0.07));
  assert.ok(blockedByIllusionEffect(false, { blending: true }, () => 0.08));
  assert.ok(blockedByIllusionEffect(false, { shade: true }, () => 0.04));
});

test('stealth: hearing gates on PRIOR detection - a quiet player behind a foe stays hidden', async () => {
  const { EnemyAI } = await import('../src/characters/enemyMotor.js');
  const c = new Collider(() => -100);
  // Foe at origin facing +z; the player 10 behind it (outside the 90
  // half-FOV). Pre-P13 the 25-unit proximity "hearing" auto-detected.
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  const senses = {
    gameMinutes: 2, playerStealth: 100, movingLessThanHalfSpeed: true,
    sharedStealth: { minute: -1 }, rolls: () => 0.5,   // illusion roll unused (no blending); stealth roll 50 < 78 SUCCEEDS
  };
  tick(ai, [0, 0, -10], senses);
  assert.ok(!ai.inSight);
  assert.ok(!ai.detected, 'proximity must not auto-detect an unseen, unheard player');
  // The stealth roll FAILS on a fresh minute -> detected (chance
  // 2*((400*100)>>10) = 78; roll 99 >= 78)
  const ai2 = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  tick(ai2, [0, 0, -10], { ...senses, sharedStealth: { minute: -1 }, rolls: () => 0.99 });
  assert.ok(ai2.detected);
  assert.ok(ai2.hasEncounteredPlayer);
  // Once detected, hearing (dist < 25, LOS clear) HOLDS detection on
  // the cached minute even though the stealth check just returns the
  // standing value
  tick(ai2, [0, 0, -10], { ...senses, sharedStealth: { minute: -1 }, rolls: () => 0.0 });
  assert.ok(ai2.detected, 'earshot holds the detection');
});

test('stealth: minute cache, odd-minute sneak skip, fast-move auto-detect, the shared tally', async () => {
  const { EnemyAI } = await import('../src/characters/enemyMotor.js');
  const c = new Collider(() => -100);
  const behind = [0, 0, -10];
  let tallies = 0;
  const shared = { minute: -1 };
  const base = { playerStealth: 100, sharedStealth: shared, tallyStealth: () => tallies++ };
  // Odd minute + sneaking: NO roll happens (a throwing roll proves it)
  const ai = new EnemyAI(c, [0, 0, 0], 0, {});
  tick(ai, behind, { ...base, gameMinutes: 1, movingLessThanHalfSpeed: true, rolls: () => { throw new Error('rolled on an odd sneak minute'); } });
  assert.ok(!ai.detected);
  assert.equal(tallies, 0);
  // Even minute: the roll runs and the tally fires ONCE across foes
  const r = seqRolls([0.5, 0.5, 0.5, 0.5]);
  tick(ai, behind, { ...base, gameMinutes: 2, movingLessThanHalfSpeed: true, rolls: r });
  const ai2 = new EnemyAI(c, [0, 0, 0], 0, {});
  tick(ai2, behind, { ...base, gameMinutes: 2, movingLessThanHalfSpeed: true, rolls: r });
  assert.equal(tallies, 1, 'one Stealth tally per classic minute across ALL foes');
  // The same minute again on the same foe: cached (no further rolls)
  tick(ai, behind, { ...base, gameMinutes: 2, movingLessThanHalfSpeed: true, rolls: () => { throw new Error('re-rolled a cached minute'); } });
  // Fast movement after an encounter: detected outright, no roll
  const ai3 = new EnemyAI(c, [0, 0, 0], 0, {});
  ai3.hasEncounteredPlayer = true;
  tick(ai3, behind, { ...base, gameMinutes: 4, movingLessThanHalfSpeed: false, rolls: () => { throw new Error('rolled on a fast-move auto-detect'); } });
  assert.ok(ai3.detected);
});

test('stealth: the chameleon illusion gate blocks SIGHT (the dead S8 half-sight interim retires)', async () => {
  const { EnemyAI } = await import('../src/characters/enemyMotor.js');
  const c = new Collider(() => -100);
  const inFront = [0, 0, 10];   // inside the FOV, LOS clear
  // Blending player, see-through roll fails (>= 8%): blocked - not
  // detected even standing in plain sight (stealth also held: high
  // stealth + a succeeding roll)
  const ai = new EnemyAI(c, [0, 0, 0], 0, {});
  tick(ai, inFront, {
    gameMinutes: 2, playerStealth: 100, movingLessThanHalfSpeed: true,
    playerBlending: true, sharedStealth: { minute: -1 },
    rolls: seqRolls([0.5, 0.5]),   // illusion 50 >= 8 -> blocked; stealth 50 < 78 -> hidden
  });
  assert.ok(ai.inSight, 'the chameleon player IS in sight range');
  assert.ok(!ai.detected, 'the illusion gate blocks the sighting');
  // See-through roll under 8%: the foe pierces the chameleon
  tick(ai, inFront, {
    gameMinutes: 2, playerBlending: true, sharedStealth: { minute: -1 },
    playerStealth: 100, movingLessThanHalfSpeed: true,
    rolls: seqRolls([0.07, 0.5]),
  });
  assert.ok(ai.detected);
  // A sees-through foe ignores blending entirely
  const ai2 = new EnemyAI(c, [0, 0, 0], 0, { seesThroughInvisibility: true });
  tick(ai2, inFront, {
    gameMinutes: 2, playerBlending: true, playerInvisible: true, sharedStealth: { minute: -1 },
    playerStealth: 100, movingLessThanHalfSpeed: true, rolls: seqRolls([0.5, 0.5]),
  });
  assert.ok(ai2.detected);
});
