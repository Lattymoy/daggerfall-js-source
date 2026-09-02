// ROAD TO 1:1, group a5 - THE SEDUCER TRANSFORM PAIR, flagged in
// src/characters/mobileUnit.js since C16 and now ported.
//
// The law, verbatim across four files:
//   EnemyBasics.cs:167-212       the four special tables (records
//                                23/22/21/20), player-facing only.
//   DaggerfallMobileUnit.cs      ApplyEnemyState's two transform arms
//     :268-288                   (behaviour switch + the frame seed),
//     :594-610                   NextStateAfterCurrentOneShot's chain,
//     :787-858                   GetStateAnims' winged branches.
//   Base/MobileUnit.cs           IsPlayingOneShot (:153-168),
//     :174-184                   OneShotPauseActionsWhilePlaying,
//     :208-224                   SetSpecialTransformationCompleted.
//   DaedraSeducerMobileBehaviour the eight-second/first-wound trigger.
//
// ART-DEPENDENT: everything here runs on a stubbed frameCount, which
// is what the unit already takes - the records the tables name are
// asserted as NUMBERS, and the ARENA2 archive 284 they index is not
// needed to prove the law. The one data-gated check (that archive 284
// really carries records 20-23) sits at the tail behind ARENA2_PATH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MobileUnit, stateAnims, SeducerTransformBehaviour, SECONDS_TO_TRANSFORM,
  SEDUCER_TRANSFORM1_ANIMS, SEDUCER_TRANSFORM2_ANIMS,
  SEDUCER_IDLE_MOVE_ANIMS, SEDUCER_ATTACK_ANIMS,
  MOBILE_DAEDRA_SEDUCER, MOVE_ANIM_SPEED,
  MOVE_ANIMS, PRIMARY_ATTACK_ANIMS, HURT_ANIMS, IDLE_ANIMS, RANGED_ATTACK1_ANIMS,
} from '../src/characters/mobileUnit.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';        // ROAD-U: the ACTOR half of the pause
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { Collider } from '../src/player/collider.js';
import { srand, getSeed } from '../src/formats/dfRandom.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SEDUCER = ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER];
/** Every record in archive 284 has plenty of frames; the transform
 *  sequences are nine long, so ten keeps the plain run honest. */
const seducerUnit = () => new MobileUnit(MOBILE_DAEDRA_SEDUCER, SEDUCER, () => 10, () => 0.5, 'female');
/** A real collider with a flat floor - the motor moves the body. */
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const floorCollider = () => {
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-60, 0, -60, 60, 0, -60, 60, 0, 60, -60, 0, 60]), [0, 1, 2, 0, 2, 3], I4);
  return c;
};
/** Step the anim clock exactly one frame at MoveAnimSpeed. */
const stepFrames = (m, n, intent = {}) => {
  for (let i = 0; i < n; i++) m.update(1 / MOVE_ANIM_SPEED, intent, 0, [0, 0, 0], [0, 0, 5]);
};

test('seducer: the four special tables are eight copies of one record (EnemyBasics.cs:167-212)', () => {
  for (const [table, record] of [
    [SEDUCER_TRANSFORM1_ANIMS, 23], [SEDUCER_TRANSFORM2_ANIMS, 22],
    [SEDUCER_IDLE_MOVE_ANIMS, 21], [SEDUCER_ATTACK_ANIMS, 20],
  ]) {
    assert.equal(table.length, 8);
    assert.deepEqual(table.map((a) => a.record), new Array(8).fill(record), `record ${record}`);
    assert.ok(table.every((a) => a.flip === false), 'player-facing only: never flipped');
    assert.ok(table.every((a) => a.fps === MOVE_ANIM_SPEED), 'all four run at MoveAnimSpeed');
  }
  // The row itself carries both flags and both nine-frame sequences.
  assert.equal(SEDUCER.hasSeducerTransform1, true);
  assert.equal(SEDUCER.hasSeducerTransform2, true);
  assert.deepEqual(SEDUCER.seducerTransform1Frames, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(SEDUCER.seducerTransform2Frames, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

test('seducer: GetStateAnims routes the winged form in five states, at the source order', () => {
  const untransformed = (state) => stateAnims(state, MOBILE_DAEDRA_SEDUCER, true, false, false, false, false, false, true, true);
  const winged = (state) => stateAnims(state, MOBILE_DAEDRA_SEDUCER, false, true, false, false, false, true, true, true);
  // Before the transform the seducer is an ordinary monster.
  assert.equal(untransformed('move'), MOVE_ANIMS);
  assert.equal(untransformed('attack'), PRIMARY_ATTACK_ANIMS);
  assert.equal(untransformed('hurt'), HURT_ANIMS);
  assert.equal(untransformed('idle'), IDLE_ANIMS);
  assert.equal(untransformed('spell'), PRIMARY_ATTACK_ANIMS, 'no spell animation on the unwinged row');
  // After it, five states swap - and Spell takes the winged attack
  // table AHEAD of the HasSpellAnimation ternary (:843-848), which the
  // completed transform has just turned on.
  assert.equal(winged('move'), SEDUCER_IDLE_MOVE_ANIMS);
  assert.equal(winged('attack'), SEDUCER_ATTACK_ANIMS);
  assert.equal(winged('hurt'), SEDUCER_IDLE_MOVE_ANIMS);
  assert.equal(winged('idle'), SEDUCER_IDLE_MOVE_ANIMS);
  assert.equal(winged('spell'), SEDUCER_ATTACK_ANIMS);
  assert.notEqual(winged('spell'), RANGED_ATTACK1_ANIMS, 'the winged branch wins the ternary');
  // The transform tables answer null without the flags - DFU's
  // LogMobileError path, which defaults the caller to Idle.
  assert.equal(stateAnims('transform1', MOBILE_DAEDRA_SEDUCER, true), null);
  assert.equal(stateAnims('transform2', MOBILE_DAEDRA_SEDUCER, true), null);
  assert.equal(stateAnims('transform1', MOBILE_DAEDRA_SEDUCER, true, false, false, false, false, false, true, true), SEDUCER_TRANSFORM1_ANIMS);
  // The winged branch is the SEDUCER's alone.
  assert.equal(stateAnims('idle', 4, true, false, false, false, false, true, false, false), IDLE_ANIMS);
});

test('seducer: transform1 chains into transform2 and completes (NextStateAfterCurrentOneShot :594-610)', () => {
  const m = seducerUnit();
  assert.equal(m.specialTransformationCompleted, false);
  assert.equal(m.basics.behaviour, 'General');

  m.startTransformation();
  assert.equal(m.state, 'transform1');
  assert.equal(m.basics.behaviour, 'Flying', ':270 - flying sprite alignment while crouched');
  assert.equal(m.frame, 0, 'seeded from SeducerTransform1Frames[0]');
  assert.notEqual(m.basics, SEDUCER, 'the struct copy: the shared row is never written');
  assert.equal(ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER].behaviour, 'General');

  // Ten steps of a nine-frame table (frameCount 10) walks the run out.
  stepFrames(m, 10);
  assert.equal(m.state, 'transform2', 'transform1 -> transform2');
  assert.equal(m.basics.behaviour, 'General', ':281 - grounded alignment while standing');
  assert.equal(m.specialTransformationCompleted, false, 'not yet - the SECOND state completes it');

  stepFrames(m, 10);
  assert.equal(m.state, 'idle');
  assert.equal(m.specialTransformationCompleted, true);
  // SetSpecialTransformationCompleted's five writes (:212-219)
  assert.equal(m.basics.behaviour, 'Flying');
  assert.deepEqual(m.basics.corpseTexture, { archive: 400, record: 5 }, 'the WINGED corpse, not 400/6');
  assert.equal(m.basics.hasIdle, false);
  assert.equal(m.basics.hasSpellAnimation, true);
  assert.deepEqual(m.basics.spellAnimFrames, [0, 1, 2, 3]);
  // ...and the winged tables are what it draws from now.
  const out = m.update(0, {}, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(out.record, 21, 'the winged idle/move record');
  assert.equal(out.flip, false);
});

test('seducer: the transform pauses actions - no strike, no cast, no stunlock', () => {
  const m = seducerUnit();
  m.startTransformation();
  assert.equal(m.isPlayingOneShot(), true);
  assert.equal(m.oneShotPauseActionsWhilePlaying(), true);
  // EnemyMotor.TakeAction :465-466, EnemyAttack.FixedUpdate :60-61 and
  // KnockbackMovement :267-269 all refuse to change state here.
  stepFrames(m, 1, { striking: true, casting: true, hurting: true, moving: true });
  assert.equal(m.state, 'transform1', 'the sequence holds against every intent');
  assert.equal(m.doMeleeDamage, false);
  // ...and the clock keeps stepping it, so it still finishes.
  stepFrames(m, 20, { striking: true, hurting: true });
  assert.equal(m.specialTransformationCompleted, true);
  // Once completed the gate opens again: an ordinary swing lands.
  assert.equal(m.oneShotPauseActionsWhilePlaying(), false);
  stepFrames(m, 1, { striking: true });
  assert.equal(m.state, 'attack');
  assert.equal(m.isAttacking(), true);
});

test('seducer (ROAD-U): the pause stops the ACTOR - no pursuit, no melee timer, no rand(), no shove', () => {
  // The pin above covers the ANIM half. DFU spends
  // OneShotPauseActionsWhilePlaying at three sites, and two of them
  // are components this port keeps outside the mobile: TakeAction
  // returns at EnemyMotor.cs:464-466, above DoRangedAttack,
  // DoTouchSpell, EvaluateMoveInForAttack and every AttemptMove;
  // EnemyAttack.FixedUpdate returns at :59-61, above the melee
  // countdown and the `DFRandom.rand() % speed` draw; and
  // KnockbackMovement returns at :267-269 ("Prevent stunlocking
  // transforming Seducers"). Until ROAD-U the whole predicate was
  // spent on the anim intent alone, so a transforming Seducer - whose
  // transform1 arm sets Behaviour = Flying - FLEW at the player,
  // burned the one shared DFRandom stream every classic tick, and
  // could be shoved out of its own transformation.
  const m = seducerUnit();
  m.startTransformation();
  const paused = m.isPlayingOneShot() && m.oneShotPauseActionsWhilePlaying();
  assert.equal(paused, true);
  assert.equal(m.basics.behaviour, 'Flying', 'transform1 switched the alignment - an ungated motor would fly');

  // 1. THE MOTOR. Three seconds of pursuit, the pools' own per-frame
  // CanFly fold applied, at a target twenty units away.
  const mkAi = () => {
    const ai = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
    ai._classicSenses = () => {}; ai._senses = () => {};
    ai.detected = true; ai.inSight = true; ai.giveUpTimer = 200;
    ai.lastKnownTargetPos = [0, 0, 20];
    ai.predictedTargetPos = ai.lastKnownTargetPos;
    ai.destination = ai.lastKnownTargetPos;
    ai._dist = 20;
    return ai;
  };
  const run = (ai, isPaused) => {
    for (let i = 0; i < 180; i++) {
      ai.flies = m.basics.behaviour === 'Flying';
      ai.update(1 / 60, [0, 0, 20], null, false, isPaused);
    }
  };
  const held = mkAi();
  run(held, true);
  assert.deepEqual(held.feet, [0, 0, 0], 'it has not moved a millimetre');
  assert.equal(held.moving, false);
  // ...and the same foe, free, closes the distance
  const free = mkAi();
  run(free, false);
  assert.ok(free.feet[2] > 5, `the ungated motor pursues (z=${free.feet[2]})`);
  // TakeAction's return is ABOVE the whole ladder, so not even the
  // turn-to-face happens: a Seducer that starts transforming with its
  // back to you keeps its back to you until the sequence ends.
  const turned = mkAi();
  turned.yaw = Math.PI;
  run(turned, true);
  assert.equal(turned.yaw, Math.PI, 'the pause returns before TakeAction turns (:464-466)');
  const turnsFree = mkAi();
  turnsFree.yaw = Math.PI;
  run(turnsFree, false);
  assert.notEqual(turnsFree.yaw, Math.PI, 'the free foe turns to face');

  // 2. THE ATTACK COMPONENT: the timer and the shared stream both hold.
  const mkAttack = () => new EnemyAttack({ liveSpeed: 50, playerLevel: 10, reflexes: 2, rolls: () => 0.5 });
  const aiStub = { canAct: true, inSight: true, detected: true, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0], _dist: 20 };
  srand(12345);
  const pausedAttack = mkAttack();
  pausedAttack.meleeTimer = 1.5;
  for (let i = 0; i < 32; i++) pausedAttack.update(1 / 16, aiStub, [0, 0, 20], true);
  assert.equal(pausedAttack.meleeTimer, 1.5, 'the countdown never runs (EnemyAttack.cs:64)');
  assert.equal(getSeed(), 12345, 'and not one byte of the shared DFRandom stream is spent (:81)');
  // the same ticks, unpaused, do both
  const freeAttack = mkAttack();
  freeAttack.meleeTimer = 1.5;
  for (let i = 0; i < 32; i++) freeAttack.update(1 / 16, aiStub, [0, 0, 20], false);
  assert.ok(freeAttack.meleeTimer < 1.5, 'the free component counts down');
  assert.notEqual(getSeed(), 12345, 'and draws');

  // 3. KNOCKBACK: a hit neither shoves the transforming Seducer nor
  // decays the stored speed (:267-269 returns above the whole block).
  const hit = mkAi();
  hit.knockbackSpeed = 20;
  hit.knockbackDir = [0, 0, -1];
  for (let i = 0; i < 30; i++) hit.update(1 / 60, [0, 0, 20], null, false, true);
  assert.ok(Math.abs(hit.feet[2]) < 1e-6 && Math.abs(hit.feet[0]) < 1e-6,
    `no stunlock: the transform holds its ground (${hit.feet.join()})`);
  assert.equal(hit.knockbackSpeed, 20, 'and the stored speed is not spent either');
  assert.equal(hit.hurtKnock, false);
  const shoved = mkAi();
  shoved.knockbackSpeed = 20;
  shoved.knockbackDir = [0, 0, -1];
  for (let i = 0; i < 30; i++) shoved.update(1 / 60, [0, 0, 20], null, false, false);
  assert.ok(shoved.feet[2] < -0.5, `an ordinary foe IS shoved (z=${shoved.feet[2]})`);
});

test('seducer: a mobile without the flags falls back to Idle (ApplyEnemyState :290-298)', () => {
  const rat = new MobileUnit(0, ENEMY_BASICS[0], () => 4, () => 0.5, 'male');
  rat.startTransformation();
  assert.equal(rat.state, 'idle', 'no SeducerTransform1Anims -> default to Idle');
  assert.equal(rat.specialTransformationCompleted, false);
});

test('seducer: the trigger - eight seconds targeting the player, or the first wound', () => {
  assert.equal(SECONDS_TO_TRANSFORM, 8.0);
  // Not targeting the player: the countdown never spends.
  const m1 = seducerUnit();
  const b1 = new SeducerTransformBehaviour(m1, { health: 100, maxHealth: 100 });
  for (let i = 0; i < 20; i++) b1.update(1, false);
  assert.equal(b1.transformCountdown, SECONDS_TO_TRANSFORM);
  assert.equal(m1.state, 'idle');

  // Targeting the player, unhurt: eight seconds exactly.
  const m2 = seducerUnit();
  const b2 = new SeducerTransformBehaviour(m2, { health: 100, maxHealth: 100 });
  for (let i = 0; i < 7; i++) b2.update(1, true);
  assert.equal(m2.state, 'idle', 'seven seconds is not eight');
  b2.update(1, true);
  assert.equal(m2.state, 'transform1');
  assert.equal(b2.transformStarted, true);
  assert.equal(b2.transformCountdown, 0);

  // Hurt at all: immediately, whatever the clock says.
  const m3 = seducerUnit();
  const e3 = { health: 100, maxHealth: 100 };
  const b3 = new SeducerTransformBehaviour(m3, e3);
  b3.update(1, true);
  assert.equal(m3.state, 'idle');
  e3.health = 99;
  b3.update(1, true);
  assert.equal(m3.state, 'transform1', 'CurrentHealth < MaxHealth is the whole test');
});

test('seducer: the trigger re-raises the state and suppresses infighting when done', () => {
  const m = seducerUnit();
  const entity = { health: 50, maxHealth: 100 };
  const b = new SeducerTransformBehaviour(m, entity);
  b.update(0.1, true);
  assert.equal(m.state, 'transform1');
  // Something knocks it out of the state: the behaviour puts it back
  // ("This prevents some other state (e.g. hurt) breaking switch to
  // transformation", :59-67).
  m._change('hurt');
  b.update(0.1, true);
  assert.equal(m.state, 'transform1');
  assert.equal(entity.suppressInfighting, undefined, 'not yet - only the COMPLETED form is excluded');

  // Ride it out; the completed arm then raises SuppressInfighting on
  // every frame (which is how a restored save gets it back).
  stepFrames(m, 40);
  assert.equal(m.specialTransformationCompleted, true);
  b.update(0.1, true);
  assert.equal(entity.suppressInfighting, true);
  // ...and it is the ONLY thing that arm does.
  const state = m.state;
  b.update(0.1, true);
  assert.equal(m.state, state);
});

test('seducer pins: the hosts stand the behaviour, fold CanFly, and bill the winged corpse', () => {
  for (const [file, f] of [['src/scenes/dungeonContext.js', 'f'], ['src/scenes/exteriorFoes.js', 'f']]) {
    const src = rd(file);
    assert.ok(src.includes('SeducerTransformBehaviour('), `${file}: SetupDemoEnemy.cs:191-195 - the component is added at setup`);
    assert.ok(src.includes(`${f}.seducer?.update(dt,`), `${file}: the trigger runs each frame`);
    // EnemyMotor.CanFly (:837-845) is a LIVE read of Enemy.Behaviour.
    assert.ok(src.includes(`if (${f}.seducer) ${f}.ai.flies = ${f}.mobile.basics.behaviour === 'Flying' || ${f}.mobile.basics.behaviour === 'Spectral';`),
      `${file}: CanFly re-reads the behaviour the transform rewrites`);
    // EnemyDeath.cs:86-92 reads the mobile's own CorpseTexture.
    assert.ok(src.includes('f.mobile?.basics?.corpseTexture ?? ENEMY_BASICS[f.mobileType]?.corpseTexture'),
      `${file}: the corpse comes off the mobile's copy`);
    // ROAD-U: and the pause reaches the two components DFU gates -
    // without this wiring the motor and the attack machine take the
    // permissive default and the actor goes on acting.
    assert.ok(src.includes(`const _fPaused = !!(${f}.mobile?.isPlayingOneShot() && ${f}.mobile.oneShotPauseActionsWhilePlaying());`),
      `${file}: the host reads OneShotPauseActionsWhilePlaying`);
    assert.ok(src.includes('_fParalyzed, _fPaused)'), `${file}: the motor is told (EnemyMotor.cs:464-466)`);
    assert.ok(src.includes('_tgt, _fPaused)'), `${file}: and the attack component (EnemyAttack.cs:59-61)`);
    assert.ok(src.includes('!_fParalyzed && !_fPaused && f.ai.isHostile'),
      `${file}: and the caster, which sits below the same return`);
  }
});

test('seducer: archive 284 carries the transform records [needs ARENA2_PATH]', { skip: !process.env.ARENA2_PATH }, async () => {
  const { readFile } = await import('node:fs/promises');
  const { TextureFile } = await import('../src/formats/textureFile.js');
  const t = new TextureFile();
  t.load(new Uint8Array(await readFile(`${process.env.ARENA2_PATH}/TEXTURE.284`)));
  // The winged tables index records 20-23; the unwinged row uses 0-19.
  for (const record of [20, 21, 22, 23]) {
    assert.ok(record < t.recordCount, `TEXTURE.284 record ${record}`);
    assert.ok(t.getFrameCount(record) > 0, `record ${record} has frames`);
  }
  // The transform sequences run to frame 8, so both records must hold
  // at least nine frames or the plain run would clamp early.
  assert.ok(t.getFrameCount(23) >= 9, 'SeducerTransform1Frames reaches frame 8');
  assert.ok(t.getFrameCount(22) >= 9, 'SeducerTransform2Frames reaches frame 8');
});
