// ROAD TO 1:1, group a5 - the AI residue: effect sources whose
// consumers were already ported and whose producers were not.
//
//  1. ENEMY LEVITATION. Levitate.SetEnemyMotor (Levitate.cs:140-154),
//     the enemy half of StartLevitating/StopLevitating (:92-126),
//     writes EnemyMotor.IsLevitating. Nothing in the port wrote it, so
//     `EnemyAI.levitating` was a hard false and every arm reading it
//     (FallCheck :1206, FindDetour :1009, the face aim :543, the
//     destination drop :558, ApplyGravity :328/:335/:347 and Move's
//     3D branch :1006) was dead.
//  2. FOE-SIDE CONCEALMENT. BlockedByIllusionEffect (EnemySenses.cs:
//     658-683) reads the TARGET's IsInvisible/IsBlending/IsAShade
//     whatever the target is; ConcealmentEffect writes the flag
//     entity-blind (:63). The port's gate has read a foe candidate's
//     concealment() closure since MT-i and no host built one, and
//     EntityConcealmentBehaviour (:36-62) - the renderer disable for
//     "entities other than player" - was never ported at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyEnemyMotorEffectFlags, concealmentFlags, isMagicallyConcealed,
  applySpell, tickActiveEffects,
} from '../src/systems/effects.js';
import { EnemyAI, blockedByIllusionEffect, MOBILE_SLAUGHTERFISH_ID } from '../src/characters/enemyMotor.js';
import { GRAVITY } from '../src/player/motor.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const eff = (kind) => ({ kind, roundsRemaining: 5 });

/** A collider whose floor sits at y = 0: move() integrates the delta
 *  and clamps at the floor, reporting grounded there. Enough for the
 *  gravity question, which is all these tests ask. */
function floorCollider() {
  return {
    raycast: () => Infinity,
    heightAt: () => 0,
    capsuleCast: () => ({ dist: Infinity, key: null }),
    move(feet, dx, dy, dz) {
      feet[0] += dx; feet[1] += dy; feet[2] += dz;
      if (feet[1] <= 0) { feet[1] = 0; return { grounded: true }; }
      return { grounded: false };
    },
  };
}

test('a5: Levitate writes the enemy motor flag (SetEnemyMotor, Levitate.cs:140-154)', () => {
  const ai = new EnemyAI(floorCollider(), [0, 4, 0], 0, { liveSpeed: 50 });
  assert.equal(ai.levitating, false, 'a foe carrying nothing does not levitate');

  const entity = { activeEffects: [] };
  assert.equal(applyEnemyMotorEffectFlags(ai, entity), false);

  // StartLevitating -> SetEnemyMotor(true)
  entity.activeEffects.push(eff('levitate'));
  assert.equal(applyEnemyMotorEffectFlags(ai, entity), true);
  assert.equal(ai.levitating, true);

  // StopLevitating -> SetEnemyMotor(false). The port folds Start/End
  // into the effect's presence, so the End is the entry leaving.
  entity.activeEffects.length = 0;
  assert.equal(applyEnemyMotorEffectFlags(ai, entity), false);
  assert.equal(ai.levitating, false);

  // A null motor is DFU's `if (enemyMotor)` miss - a no-op, not a throw.
  assert.equal(applyEnemyMotorEffectFlags(null, entity), false);
});

test('a5: the classic 14,255 cast on a FOE reaches the motor flag', () => {
  // The whole chain: SPELLS.STD's byte-cast key -> BUFF_KINDS row ->
  // the entity's active list -> SetEnemyMotor. Levitate is CasterOnly
  // (properties.AllowedTargets, :33), so this is a foe self-cast.
  const foe = { stats: { willpower: 50 }, career: {}, health: 30, maxHealth: 40, activeEffects: [] };
  applySpell(
    { element: 4, rangeType: 0, effects: [{ type: 14, subType: -1, durationBase: 3, durationMod: 1, durationPerLevel: 1 }] },
    2, foe, {}, seq(0));
  const ai = new EnemyAI(floorCollider(), [0, 4, 0], 0, { liveSpeed: 50 });
  assert.equal(applyEnemyMotorEffectFlags(ai, foe), true, 'subType -1 is the sbyte spelling of 255');

  // ...and the expiry clears it again (Levitate.End -> StopLevitating).
  for (let i = 0; i < 6; i++) tickActiveEffects(foe, {});
  assert.equal(applyEnemyMotorEffectFlags(ai, foe), false);
});

test('a5: a levitating foe takes NO gravity - ApplyGravity refuses it on every arm', () => {
  const mk = () => new EnemyAI(floorCollider(), [0, 4, 0], 0, { liveSpeed: 50, isHostile: false });
  // The control: a plain walker off the ground falls (ApplyGravity's
  // :335 arm - !flies && !swims && !IsLevitating && !isGrounded).
  const walker = mk();
  walker.update(0.1, [0, 0, 20]);
  assert.ok(walker.feet[1] < 4, 'a grounded-behaviour foe in the air falls');
  assert.ok(walker.velY < 0 && walker.velY >= -GRAVITY * 0.2);

  // The law: IsLevitating excludes the foe from all three ApplyGravity
  // arms (:328 slow-fall, :335 walker, :347 flyerFalls), so it hangs.
  const lev = mk();
  lev.levitating = true;
  lev.update(0.1, [0, 0, 20]);
  assert.equal(lev.feet[1], 4, 'a levitator holds its altitude');
  assert.equal(lev.velY, 0);

  // ...and keeps hanging while PARALYSED, where a flyer is dropped:
  // HandleParalysis raises flyerFalls, and the arm that spends it is
  // `flyerFalls && flies && !IsLevitating` (:347).
  const paralysed = mk();
  paralysed.levitating = true;
  for (let i = 0; i < 10; i++) paralysed.update(0.1, [0, 0, 20], null, true);
  assert.equal(paralysed.feet[1], 4, 'paralysis drops a flyer, never a levitator');

  const flyer = new EnemyAI(floorCollider(), [0, 4, 0], 0, { liveSpeed: 50, isHostile: false, behaviour: 'Flying' });
  flyer.update(0.1, [0, 0, 20], null, true);
  assert.ok(flyer.feet[1] < 4, 'the control: a paralysed flyer DOES fall');
});

test('a5: the levitating arms of the senses/pursuit path are live, not dead', () => {
  const ai = new EnemyAI(floorCollider(), [0, 4, 0], 0, { liveSpeed: 50 });
  ai.levitating = true;
  // FallCheck (:1206) returns early for a levitator: no phantom cliff.
  ai.obstacleDetected = false; ai.foundUpwardSlope = false; ai.foundDoor = false;
  ai._fallCheck([0, 0, 1]);
  assert.equal(ai.fallDetected, false, 'FallCheck :1206 - flies || IsLevitating || swims');
  // FindDetour (:1009) tries the vertical dodge FIRST for a levitator.
  const before = ai.detourDestination;
  ai._findDetour([0, 0, 1], () => 0.1);
  assert.notEqual(ai.detourDestination, before);
  assert.notEqual(ai.detourDestination?.[1] ?? 0, ai.feet[1], 'the +/-0.3 vertical dodge, not a flat sweep');
});

// ROAD-Ar R4. GetDestination (EnemyMotor.cs:542-544):
//   if (flies || IsLevitating || (swims && ID == Slaughterfish))
//       destination.y += targetController.height * 0.5f;
// DFU's destination is the target's CENTRE, so the add lands it at the
// target's TOP - measured from THIS foe's transform. The port works in
// feet-space (REVIEW 2026-09-05, PR #55 review): the destination is
// DFU's, less this foe's centreOffset (0.9 for a foe naming no sprite),
// so a face-aimer lands at H - off and a plain swimmer at H/2 - off.
// `levitating` is a live effect flag and the foe
// pools rewrite `ai.flies` for a transformed Seducer, so the split has
// to be decided per call - a birth-time constant aimed a levitating
// walker at the target's waist.
test('a5: the face aim reads the LIVE levitating/flies flags, not a birth constant', () => {
  const at = (ai) => { ai._getDestination([0, 0, 10]); return ai.destination[1]; };
  const H = 1.8;   // CAPSULE_HEIGHT - the unarmed target height
  const off = 0.9;   // this foe's transform above its feet (centreOffset, default height/2)

  const walker = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  assert.equal(at(walker), 0, 'a ground foe takes the arm not at all');

  const flyer = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50, behaviour: 'Flying' });
  assert.equal(at(flyer), H - off, 'a flyer aims at the target TOP (centre + h/2), from its own transform');

  // The defect: same foe, levitate lands on it mid-flight.
  const lev = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  applyEnemyMotorEffectFlags(lev, { activeEffects: [eff('levitate')] });
  assert.equal(lev.levitating, true);
  assert.equal(at(lev), H - off, 'IsLevitating aims at the FACE exactly like flies');
  // ...and the effect expiring puts the aim back on the ground arm.
  applyEnemyMotorEffectFlags(lev, { activeEffects: [] });
  assert.equal(at(lev), 0, 'the flag is live in both directions');

  // The swimmer split: only the slaughterfish joins the face-aimers;
  // any other swimmer gets DFU's no-add case, which in feet-space is
  // the target's centre.
  const fish = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50, behaviour: 'Aquatic', mobileId: MOBILE_SLAUGHTERFISH_ID });
  assert.equal(at(fish), H - off, 'swims && Slaughterfish - the face');
  const otherFish = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50, behaviour: 'Aquatic', mobileId: MOBILE_SLAUGHTERFISH_ID + 1 });
  assert.equal(at(otherFish), H / 2 - off, 'any other swimmer stays at the centre');
  // A transformed Seducer (the pools rewrite ai.flies per frame) must
  // follow its new shape too, not the one it was constructed with.
  otherFish.flies = true;
  assert.equal(at(otherFish), H - off, 'a rewritten `flies` moves the aim with it');
});

test('a5: ConcealmentEffect is entity-blind - concealmentFlags reads a FOE the same way', () => {
  // ConcealmentEffect.StartConcealment (:56-74) ORs the flag onto
  // entityBehaviour.Entity with no player gate; only the HUD line is
  // gated. So a Shadow landing on a rat conceals the rat.
  const rat = { stats: { willpower: 30 }, career: {}, health: 10, maxHealth: 10, activeEffects: [] };
  assert.deepEqual(concealmentFlags(rat), { invisible: false, blending: false, shade: false });
  applySpell(
    { element: 4, rangeType: 0, effects: [{ type: 24, subType: 0, durationBase: 3, durationMod: 1, durationPerLevel: 1 }] },
    2, rat, {}, seq(0));
  assert.deepEqual(concealmentFlags(rat), { invisible: false, blending: false, shade: true });

  // And the gate consumes it: a shade blocks unless the 4% roll wins.
  const never = () => { throw new Error('rolled for an unconcealed target'); };
  assert.equal(blockedByIllusionEffect(false, concealmentFlags(rat), () => 0.9), true);
  assert.equal(blockedByIllusionEffect(false, concealmentFlags(rat), () => 0.01), false);
  assert.equal(blockedByIllusionEffect(true, concealmentFlags(rat), never), false, 'the 13 seers are exempt');
});

test('a5: the senses gate reads a FOE TARGET through the candidate closure', () => {
  const collider = floorCollider();
  const hunter = new EnemyAI(collider, [0, 0, 0], 0, { liveSpeed: 50 });
  hunter._armedTargeting = true;
  const prey = { activeEffects: [] };
  const candidate = { ai: new EnemyAI(collider, [0, 0, 5], 0, {}), entity: prey, concealment: () => concealmentFlags(prey) };
  hunter.target = candidate;

  hunter._classicPostTarget({ rolls: () => { throw new Error('rolled for an unconcealed target'); } });
  assert.equal(hunter._blocked, false, 'an unconcealed foe target does not block');

  prey.activeEffects.push(eff('invisTrue'));
  hunter._classicPostTarget({ rolls: () => { throw new Error('Invisible blocks with NO roll'); } });
  assert.equal(hunter._blocked, true, 'EnemySenses:668-670 - IsInvisible always blocks');

  // The player arm is untouched: its flags still ride the context.
  hunter._armedTargeting = false;
  hunter.target = null;
  hunter._classicPostTarget({ playerInvisible: true, rolls: () => 0.5 });
  assert.equal(hunter._blocked, true);
});

test('a5: IsMagicallyConcealed is the six-bit OR (DaggerfallEntity.cs:204-207)', () => {
  assert.equal(isMagicallyConcealed({ activeEffects: [] }), false);
  for (const k of ['invisNormal', 'invisTrue', 'chameleonNormal', 'chameleonTrue', 'shadeNormal', 'shadeTrue']) {
    assert.equal(isMagicallyConcealed({ activeEffects: [eff(k)] }), true, k);
  }
  // Not every buff is a concealment bit.
  assert.equal(isMagicallyConcealed({ activeEffects: [eff('levitate'), eff('light')] }), false);
});

test('a5 pins: the three foe pools fold the flag, build the closure, and hide the concealed', () => {
  for (const [file, ai, ent] of [
    ['src/scenes/dungeonContext.js', 'f.ai', 'f.entity'],
    ['src/scenes/exteriorFoes.js', 'f.ai', 'f.entity'],
    ['src/scenes/cityGuards.js', 'g.ai', 'g.entity'],
  ]) {
    const src = rd(file);
    // Levitate.SetEnemyMotor, folded before the motor step.
    assert.ok(src.includes(`applyEnemyMotorEffectFlags(${ai}, ${ent});`),
      `${file}: the enemy Levitate arm runs before update()`);
    // The candidate's concealment closure BlockedByIllusionEffect reads.
    assert.ok(/concealment: \{ value: \(\) => concealmentFlags\(|'concealment', \{ value: \(\) => concealmentFlags\(/.test(src),
      `${file}: the foe candidate carries concealment()`);
    // EntityConcealmentBehaviour's renderer disable.
    assert.ok(src.includes(`if (isMagicallyConcealed(${ent})) continue;`),
      `${file}: a concealed non-player entity is not drawn`);
  }
});
