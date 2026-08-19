// AUDIT 18, enemies lane. Every pin here is mutation-proven: reverting
// the fix it guards makes it fail. DFU citations are to
// Interkarma/daggerfall-unity master (MIT, Daggerfall Workshop).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_TURN_DEG, turnTowards, wouldBeSpawnedInClassic, EnemyAI,
  CLASSIC_SPAWN_XZ_BY_TYPE, CLASSIC_SPAWN_Y_UPPER_BY_TYPE, CLASSIC_SPAWN_Y_LOWER_BY_TYPE,
  CLASSIC_DESPAWN_XZ_BY_TYPE, CLASSIC_DESPAWN_Y_BY_TYPE, CLASSIC_SPAWN_DESPAWN_EXTERIOR,
} from '../src/characters/enemyMotor.js';
import { EnemyAttack, resetMeleeTimer } from '../src/characters/enemyAttack.js';
import { EnemyCaster } from '../src/characters/enemyCasting.js';
import { MobileUnit } from '../src/characters/mobileUnit.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { Collider } from '../src/player/collider.js';
import { srand } from '../src/formats/dfRandom.js';
import { BlocksFile, RDB_RESOURCE_TYPES } from '../src/formats/blocksFile.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);
const floorCollider = () => {
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
  return c;
};
// P17 fixed stepping: four 1/60 steps accumulate 0.0667 >= 0.0625, so
// each call lands EXACTLY one classic tick (safe for ~14 calls).
const tick = (ai, playerFeet, senses) => { for (let i = 0; i < 4; i++) ai.update(1 / 60, playerFeet, senses, true); };
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const mkSpell = (index, rangeType, effects = [{ type: 4, subType: 0 }]) => ({ index, rangeType, element: 0, effects });

// ---------------------------------------------------------------
// 1. EnemyBasics.cs:1066 - the Orc Warlord's `4 -1`
// ---------------------------------------------------------------
test('audit18 enemies: Orc Warlord PrimaryAttackAnimFrames3 - DFU\'s `4 -1` is the expression 3, not a null', () => {
  // EnemyBasics.cs:1066 (ID 24):
  //   PrimaryAttackAnimFrames3 = new int[] { 0, 1, -1, 2, 3, 4 -1, 5, 0, 4, -1, 5, 0 },
  // The missing comma makes element 5 the binary expression 4 - 1.
  assert.deepEqual(ENEMY_BASICS['24'].primaryAttackAnimFrames3, [0, 1, -1, 2, 3, 3, 5, 0, 4, -1, 5, 0]);
  // The class pin: no anim-frame element in the whole 62-mobile table
  // may be a non-integer (Number('4 -1') is NaN -> JSON null, which is
  // how the defect got in and how a re-extraction could reintroduce it).
  const bad = [];
  for (const [id, e] of Object.entries(ENEMY_BASICS)) {
    for (const [k, v] of Object.entries(e)) {
      if (!/AnimFrames[2-5]?$/.test(k)) continue;
      v.forEach((f, i) => { if (!Number.isInteger(f)) bad.push(`${id}.${k}[${i}]=${f}`); });
    }
  }
  assert.deepEqual(bad, []);
  // ...and the observable consequence: mobileUnit's `Math.min(f, n-1)`
  // turns a null into frame 0. Roll 41 walks the chance ladder
  // (33/33) to Frames3; the 6th step must HOLD frame 3.
  const m = new MobileUnit(24, ENEMY_BASICS['24'], () => 6, () => 0.4);
  m.update(1 / 60, { striking: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(m.state, 'attack');
  assert.equal(m.frame, 0);
  const seen = [];
  for (let i = 0; i < 14 && m.state === 'attack'; i++) {
    m.update(1 / 10, {}, 0, [0, 0, 0], [0, 0, 5]);
    if (m.state === 'attack') seen.push(m.frame);
  }
  assert.deepEqual(seen, [1, 2, 3, 3, 5, 0, 4, 5, 0]);   // the null showed 0 at index 3
  assert.equal(m.state, 'idle');
});

test('audit18 enemies: ParrySounds is back in the MobileEnemy table (28 of 62 rows)', () => {
  // DaggerfallUnityStructs.cs:208 "Plays parry sounds when attacks
  // against this enemy miss" - the gate WeaponManager.cs:609-615 and
  // EnemyAttack.cs:371-373 read on a zero-damage hit. The E3a
  // extraction dropped the column entirely.
  const withParry = Object.keys(ENEMY_BASICS).filter((k) => ENEMY_BASICS[k].parrySounds).map(Number);
  assert.deepEqual(withParry, [7, 8, 12, 15, 21, 24, 25, 26, 27, 31, 36, 38,
    129, 130, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146]);
  assert.equal(ENEMY_BASICS['0'].parrySounds, undefined);    // Rat: ParrySounds = false
  assert.equal(ENEMY_BASICS['128'].parrySounds, undefined);  // Mage: ParrySounds = false
});

// ---------------------------------------------------------------
// 2. EnemyMotor.cs:1348 TurnToTarget - the compiled constant is 20
// ---------------------------------------------------------------
test('audit18 enemies: TurnToTarget turns 20 deg per classic update, not classic\'s 11.25', () => {
  // `const float turnSpeed = 20f;` with 11.25 surviving only in the
  // next line's comment ("too slow for Daggerfall Unity's agile
  // player movement"). The port had lifted the comment, not the code.
  assert.equal(CLASSIC_TURN_DEG, 20);
  assert.ok(Math.abs(turnTowards(0, 1, 0) - 20 * Math.PI / 180) < 1e-9);
  // Behaviour, so a future edit to turnTowards cannot regress it: a
  // foe facing 180 deg away needs 9 turns to come inside the 5.625
  // move gate, so pursuit starts on the 10th classic update (at
  // 11.25 it would take 16 turns / the 17th update).
  const ai = new EnemyAI(floorCollider(), [0, 0, 0], Math.PI, { liveSpeed: 50 });
  const player = [0, 0, 12];
  for (let i = 0; i < 9; i++) {
    for (let k = 0; k < 4; k++) ai.update(1 / 60, player);
    assert.equal(ai.moving, false, `moving already at classic tick ${i + 1}`);
  }
  for (let k = 0; k < 4; k++) ai.update(1 / 60, player);
  assert.equal(ai.moving, true);
});

// ---------------------------------------------------------------
// 3. EnemySenses.cs:225-306 - the five band ARRAYS, the
//    ClassicSpawnDistanceType row, and the exterior branch
// ---------------------------------------------------------------
test('audit18 enemies: the classic spawn bands are 7-row tables indexed by ClassicSpawnDistanceType', () => {
  const S = GLOBAL_SCALE;
  assert.deepEqual([...CLASSIC_SPAWN_XZ_BY_TYPE], [1024, 384, 640, 768, 768, 768, 768].map((v) => v * S));
  assert.deepEqual([...CLASSIC_SPAWN_Y_UPPER_BY_TYPE], [128, 128, 128, 384, 768, 128, 256].map((v) => v * S));
  assert.deepEqual([...CLASSIC_SPAWN_Y_LOWER_BY_TYPE], [0, 0, 0, 0, -128, -768, 0].map((v) => v * S));
  assert.deepEqual([...CLASSIC_DESPAWN_XZ_BY_TYPE], [1024, 1024, 1024, 1024, 768, 768, 768].map((v) => v * S));
  assert.deepEqual([...CLASSIC_DESPAWN_Y_BY_TYPE], [384, 384, 384, 384, 768, 768, 768].map((v) => v * S));
  assert.equal(CLASSIC_SPAWN_DESPAWN_EXTERIOR, 4096 * S);
  // Row 1's spawn XZ is 9.6 where row 0's is 25.6.
  assert.equal(wouldBeSpawnedInClassic(15, 0, false, 1), false);
  assert.equal(wouldBeSpawnedInClassic(15, 0, false, 0), true);
  // Row 4's signed lower band (-128) and 19.2 upper accept a foe 10 m
  // ABOVE the player that row 0's flat 3.2 band rejects.
  assert.equal(wouldBeSpawnedInClassic(12, 10, false, 4), true);
  assert.equal(wouldBeSpawnedInClassic(12, 10, false, 0), false);
  // Row 5 is the mirror: -19.2 lower, 3.2 upper.
  assert.equal(wouldBeSpawnedInClassic(12, -10, false, 5), true);
  assert.equal(wouldBeSpawnedInClassic(12, -10, false, 0), false);
  // The DESPAWN row matters too (hysteresis arm): row 4 despawns at
  // 19.2 XZ where row 0 holds to 25.6.
  assert.equal(wouldBeSpawnedInClassic(22, 0, true, 4), false);
  assert.equal(wouldBeSpawnedInClassic(22, 0, true, 0), true);
  // Out of range is REPRODUCED, not clamped: the corpus carries a
  // fixed marker with SoundIndex 35 ("garbage data in the 8 MSBs",
  // RDBLayout.cs:1478). DFU's short[7] lookup throws inside
  // EnemySenses.Start, leaving all five bands at 0f.
  assert.equal(wouldBeSpawnedInClassic(5, 0, false, 35), false);
  assert.equal(wouldBeSpawnedInClassic(5, 0, false, 0), true);
});

test('audit18 enemies: outdoors there is no vertical band and the XZ cap is classicSpawnDespawnExterior', () => {
  // EnemySenses.cs:277-306: the whole Y test sits inside
  // `if (playerInside)`; outdoors upperXZ is the flat 4096 * scale.
  assert.equal(wouldBeSpawnedInClassic(10, 5, false, 0, false), true);
  assert.equal(wouldBeSpawnedInClassic(10, 5, false, 0, true), false);
  assert.equal(wouldBeSpawnedInClassic(26, 0, false, 0, false), true);
  assert.equal(wouldBeSpawnedInClassic(26, 0, false, 0, true), false);
  // The 1094-unit outer gate still runs first, so the exterior cap is
  // never actually reachable - do not let a fix widen range to 102.4.
  assert.equal(wouldBeSpawnedInClassic(30, 0, false, 0, false), false);
});

test('audit18 enemies: the real corpus proves ClassicSpawnDistanceType is not always row 0', { skip: skipReal }, () => {
  // RDBLayout.cs:1353/:1413/:1485 read the type off the enemy marker's
  // FlatResource.SoundIndex. Over the 187 RDB blocks of the shipped
  // BLOCKS.BSA only 19% of random-enemy markers are row 0, so baking
  // row 0 in was wrong for four foes in five.
  const b = new BlocksFile();
  b.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const hist = { random: {}, fixed: {} };
  let rdbBlocks = 0;
  for (let i = 0; i < b.count; i++) {
    if (!/\.RDB$/.test(b.getBlockName(i))) continue;
    rdbBlocks++;
    for (const root of b.getBlock(i).rdbBlock?.objectRootList ?? []) {
      for (const o of root.rdbObjects ?? []) {
        if (!o || o.type !== RDB_RESOURCE_TYPES.Flat) continue;
        const f = o.resources.flatResource;
        if (f.textureArchive !== 199) continue;
        const h = f.textureRecord === 15 ? hist.random : f.textureRecord === 16 ? hist.fixed : null;
        if (h) h[f.soundIndex] = (h[f.soundIndex] ?? 0) + 1;
      }
    }
  }
  assert.equal(rdbBlocks, 187);
  assert.deepEqual(hist.random, { 0: 421, 1: 387, 2: 567, 3: 201, 4: 50, 5: 139, 6: 430 });
  // The out-of-range marker DFU's own comment predicts ("fixed markers
  // have garbage data in the 8 MSBs", RDBLayout.cs:1478).
  assert.deepEqual(hist.fixed, { 0: 73, 1: 29, 2: 98, 3: 67, 4: 20, 5: 44, 6: 37, 35: 1 });
});

test('audit18 enemies: EnemyAI threads spawnDistanceType and playerInside into the recompute', () => {
  // A constants-only pin passes both ways - drive the senses recompute.
  const senses = { rolls: () => 0.99, playerStealth: 0, gameMinutes: 0 };
  const player = [0, -10, 6.6332];   // dist 12, foe 10 m ABOVE the player
  const row0 = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  const row4 = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50, spawnDistanceType: 4 });
  const outside = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50, playerInside: false });
  tick(row0, player, senses);
  tick(row4, player, senses);
  tick(outside, player, senses);
  assert.equal(row0.wouldBeSpawned, false);
  assert.equal(row4.wouldBeSpawned, true);
  assert.equal(outside.wouldBeSpawned, true);
});

// ---------------------------------------------------------------
// 4. targetRateOfApproach is EnhancedCombatAI-only (EnemySenses.cs:354-363)
// ---------------------------------------------------------------
test('audit18 enemies: melee reach is a FLAT MeleeDistance - no rate-of-approach widening', () => {
  // EnemyAttack.cs:163 reads `distance + senses.TargetRateOfApproach`,
  // but the only non-zero assignment is inside
  // `if (DaggerfallUnity.Settings.EnhancedCombatAI)`, so on the
  // classic path the term is identically 0 and the gate is 2.25.
  // The pin MUST step the distance across calls: `approach` is 0 on a
  // first call, so a static-distance pin passes both ways.
  const run = (far, near) => {
    srand(12345);
    const atk = new EnemyAttack({ liveSpeed: 50 });
    const ai = { _dist: far, inSight: true, yaw: 0, feet: [0, 0, 0] };
    for (let i = 0; i < 100; i++) {
      ai._dist = far;
      atk.update(0.0625, ai, [0, 0, far]);
      ai._dist = near;
      atk.update(0.0625, ai, [0, 0, near]);
      if (atk.machine.state !== 'Idle') return true;
    }
    return false;
  };
  // 2.35 with a 0.25 closing delta: DFU-classic refuses (2.35 > 2.25);
  // the bug widened the gate to 2.60 and swung.
  assert.equal(run(2.60, 2.35), false);
  // Control - the rolls DO fire when the target is genuinely in reach.
  assert.equal(run(2.40, 2.20), true);
});

test('audit18 enemies: ResetMeleeTimer rolls whole milliseconds (Random.Range(int,int))', () => {
  // EnemyAttack.cs:118 `MeleeTimer = Random.Range(1500, 3000 + 1);`
  // returns an INT - one of 1501 discrete values.
  assert.equal(resetMeleeTimer(10, 2, 0.5), 2250 / 980);
  assert.equal(resetMeleeTimer(10, 2, 0.9999), 3000 / 980);
  assert.equal(resetMeleeTimer(10, 2, 0), 1500 / 980);
});

// ---------------------------------------------------------------
// 5. Both cast branches gate on DetectedTarget + CanAct
//    (EnemyMotor.cs:573, :620-622, :359-365)
// ---------------------------------------------------------------
test('audit18 enemies: a concealed target stops enemy casting (DetectedTarget + GiveUpTimer)', () => {
  const touchSpell = mkSpell(1, 1), rangedSpell = mkSpell(3, 2);
  const ent = { level: 5, magicka: 100, spells: [touchSpell, rangedSpell] };
  const player = { activeEffects: [] };
  const mkAttack = () => ({ machine: { state: 'Idle' }, meleeTimer: 0, playerLevel: 10, reflexes: 2, rangedAttack: false });
  const seen = { inSight: true, detected: true, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0] };
  const blind = { inSight: true, detected: false, giveUpTimer: 0, yaw: 0, feet: [0, 0, 0] };
  // TOUCH (DoTouchSpell): sight alone is not enough.
  {
    const c = new EnemyCaster(ent, seq(0, 0.5));
    assert.equal(c.update(0.016, { ...blind, _dist: 2.0 }, mkAttack(), [0, 0, 2], player), null);
    const c2 = new EnemyCaster(ent, seq(0, 0.5));
    assert.equal(c2.update(0.016, { ...seen, _dist: 2.0 }, mkAttack(), [0, 0, 2], player)?.spell, touchSpell);
  }
  // RANGED (DoRangedAttack's spell branch): 200 classic updates with
  // every roll forced to pass must still produce nothing.
  {
    const c = new EnemyCaster(ent, () => 0);
    for (let i = 0; i < 200; i++) {
      assert.equal(c.update(0.0625, { ...blind, _dist: 20 }, mkAttack(), [0, 0, 20], player), null);
    }
    const c2 = new EnemyCaster(ent, () => 0);
    assert.equal(c2.update(0.0625, { ...seen, _dist: 20 }, mkAttack(), [0, 0, 20], player)?.spell, rangedSpell);
  }
  // The window that separates the two gates: UpdateTimers
  // (EnemyMotor.cs:420-424) refills GiveUpTimer to 200 on detection
  // and only then counts it down, so for 200 classic ticks after the
  // player vanishes CanAct is still true while DetectedTarget is
  // false - DFU casts nothing during that blind pursuit.
  {
    const chasing = { inSight: true, detected: false, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0] };
    const c = new EnemyCaster(ent, () => 0);
    for (let i = 0; i < 200; i++) {
      assert.equal(c.update(0.0625, { ...chasing, _dist: 20 }, mkAttack(), [0, 0, 20], player), null);
    }
    const c2 = new EnemyCaster(ent, seq(0, 0.5));
    assert.equal(c2.update(0.016, { ...chasing, _dist: 2.0 }, mkAttack(), [0, 0, 2], player), null);
  }
  // The give-up half on its own: a detected target the foe has given
  // up on (GiveUpTimer 0 -> CanAct false) casts nothing either.
  {
    const c = new EnemyCaster(ent, () => 0);
    const gone = { inSight: true, detected: true, giveUpTimer: 0, yaw: 0, feet: [0, 0, 0] };
    assert.equal(c.update(0.0625, { ...gone, _dist: 20 }, mkAttack(), [0, 0, 20], player), null);
    const c2 = new EnemyCaster(ent, seq(0, 0.5));
    assert.equal(c2.update(0.016, { ...gone, _dist: 2.0 }, mkAttack(), [0, 0, 2], player), null);
  }
});

test('audit18 enemies: the touch-spell reach is flat MeleeDistance too', () => {
  const touchSpell = mkSpell(1, 1);
  const ent = { level: 5, magicka: 100, spells: [touchSpell] };
  const player = { activeEffects: [] };
  const mkAttack = () => ({ machine: { state: 'Idle' }, meleeTimer: 0, playerLevel: 10, reflexes: 2, rangedAttack: false });
  const run = (far, near) => {
    const c = new EnemyCaster(ent, seq(0, 0.5));
    const ai = { inSight: true, detected: true, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0], _dist: far };
    if (c.update(0.016, ai, mkAttack(), [0, 0, far], player)) return true;
    ai._dist = near;
    return !!c.update(0.016, ai, mkAttack(), [0, 0, near], player);
  };
  assert.equal(run(2.60, 2.35), false);   // 0.25 closing delta must NOT widen the reach
  assert.equal(run(2.40, 2.20), true);
});

// ---------------------------------------------------------------
// 6. The Spell state is not a doingAttackAnimation
//    (DaggerfallMobileUnit.cs:536-548)
// ---------------------------------------------------------------
test('audit18 enemies: the Spell one-shot is a plain frame run from SpellAnimFrames[0]', () => {
  // ApplyEnemyState seeds currentFrame = SpellAnimFrames[0] and
  // frameIterator = 1, but AnimateEnemy's doingAttackAnimation is
  // PrimaryAttack/RangedAttack1/RangedAttack2 ONLY - so the iterator
  // is never consumed for Spell: it steps +1 to the record's frame
  // count and IsPlayingOneShot() sends it to Idle.
  const collect = (basics, frames, mobileType = 25) => {
    const m = new MobileUnit(mobileType, basics, () => frames, () => 0.99);
    m.update(1 / 60, { casting: true }, 0, [0, 0, 0], [0, 0, 5]);
    assert.equal(m.state, 'spell');
    const seen = [m.frame];
    for (let i = 0; i < 12 && m.state === 'spell'; i++) {
      m.update(1 / 10, {}, 0, [0, 0, 0], [0, 0, 5]);
      if (m.state === 'spell') seen.push(m.frame);
    }
    assert.equal(m.state, 'idle');
    return seen;
  };
  // Frost Daedra (25): SpellAnimFrames [1,1,3,3] - the iterator would
  // have played exactly 1,1,3,3.
  assert.deepEqual(ENEMY_BASICS['25'].spellAnimFrames, [1, 1, 3, 3]);
  assert.deepEqual(collect({ hasIdle: true, spellAnimFrames: [1, 1, 3, 3], primaryAttackAnimFrames: [0] }, 6),
    [1, 2, 3, 4, 5]);
  // Ghost (18): [0,0,0,0,0,0] over a 4-frame record - the exit is the
  // FRAME COUNT, not the array length.
  assert.deepEqual(ENEMY_BASICS['18'].spellAnimFrames, [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(collect({ hasIdle: true, spellAnimFrames: [0, 0, 0, 0, 0, 0], primaryAttackAnimFrames: [0] }, 4, 18),
    [0, 1, 2, 3]);
});
