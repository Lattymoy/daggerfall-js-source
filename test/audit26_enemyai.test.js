// AUDIT 26 - THE ENEMY-AI PARITY BATCH (F009-F014, F021), the first
// themed sweep of the audit's parity queue. Every finding here had the
// LAW read on both sides by the audit and confirmed; these pins are on
// the fixes, each mutation-checked by reintroducing its bug.
//
//   F010/F014  the CanAct/UpdateTimers split, un-fused
//   F011       DoRangedAttack ahead of the detour arm
//   F012       searchMult resets on ALL of HandleNoAction's arms
//   F013       the touch cast has no one-shot term, and cuts the swing
//   F009       RangedAttack2 records for hasRangedAttack2 bow shots
//   F021       the townsperson anim resets to frame 0 on state switch
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnemyAI, GIVE_UP_TICKS } from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { EnemyCaster } from '../src/characters/enemyCasting.js';
import { stateAnims, RANGED_ATTACK1_ANIMS, RANGED_ATTACK2_ANIMS, MobileUnit } from '../src/characters/mobileUnit.js';
import { MobilePerson } from '../src/characters/mobilePerson.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

/** A collider stub for direct _classicTick calls (no physics). */
const clearStub = () => ({ raycast: () => Infinity, capsuleCast: () => ({ dist: Infinity, key: null }) });
/** A REAL collider with a floor, for update()-driven tests - _step
 *  moves the body, so it needs the whole surface. */
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const floorCollider = () => {
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), [0, 1, 2, 0, 2, 3], I);
  return c;
};
const mkSpell = (index, rangeType) => ({ index, rangeType, element: 0, effects: [{ type: 4, subType: 0 }] });

// ---------------------------------------------------------------
// F014 - UpdateTimers runs UNCONDITIONALLY (EnemyMotor.cs:170: it sits
// between the CanAct writers and the CanAct gate). The port had the
// GiveUpTimer refill/decrement inside the gated decision, so a
// paralyzed foe froze its 12.5s blind-pursuit window and woke still
// hunting where DFU's had given up.
// ---------------------------------------------------------------
test('audit26 F014: the give-up timer runs down THROUGH paralysis and knockback', () => {
  const ai = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  // pin the senses: these tests target the TIMER law, and the live
  // recompute would re-detect a player standing 5 units away
  ai._classicSenses = () => {}; ai._senses = () => {};
  ai.detected = false;
  ai.giveUpTimer = 10;
  ai.lastKnownTargetPos = [0, 0, 5];
  ai.predictedTargetPos = ai.lastKnownTargetPos;
  // one full second of PARALYZED fixed steps = 16 classic ticks
  // (per-frame calls - a single 1.0s call hits the MAX_FRAME_DT clamp)
  for (let i = 0; i < 60; i++) ai.update(1 / 60, [0, 0, 5], null, true);
  assert.equal(ai.giveUpTimer, 0, 'the blind-pursuit window ran down while paralyzed');

  const knocked = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  knocked._classicSenses = () => {}; knocked._senses = () => {};
  knocked.detected = false;
  knocked.giveUpTimer = 10;
  knocked.lastKnownTargetPos = [0, 0, 5];
  knocked.predictedTargetPos = knocked.lastKnownTargetPos;
  knocked.knockbackSpeed = 1e-6;   // in hit-stun, decay negligible
  knocked.knockbackDir = [0, 0, 1];
  for (let i = 0; i < 60; i++) knocked.update(1 / 60, [0, 0, 5], null, false);
  assert.equal(knocked.giveUpTimer, 0, 'and through knockback');

  // ...and the refill half is just as unconditional (:419-420): a
  // DETECTED foe holds 200 even while paralyzed.
  const seen = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  seen._classicSenses = () => {}; seen._senses = () => {};
  seen.detected = true;
  seen.giveUpTimer = 3;
  seen.lastKnownTargetPos = [0, 0, 5];
  seen.predictedTargetPos = seen.lastKnownTargetPos;
  seen.update(1 / 60, [0, 0, 5], null, true);
  assert.equal(seen.giveUpTimer, GIVE_UP_TICKS, 'detection refills through paralysis too');
});

// ---------------------------------------------------------------
// F012 - HandleNoAction (:357-366) zeroes searchMult on ALL THREE arms,
// every FixedUpdate, CanAct-independent. The port reset it on the
// never-seen arm alone, so a foe that ramped its search to 10 and gave
// up resumed a later pursuit aiming 10 units past the last-known spot.
// ---------------------------------------------------------------
test('audit26 F012: a foe that GIVES UP resets its search ramp - even paralyzed, even pacified', () => {
  const ai = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  ai._classicSenses = () => {}; ai._senses = () => {};
  ai.detected = false;
  ai.giveUpTimer = 0;              // gave up
  ai.searchMult = 10;
  ai.lastKnownTargetPos = [0, 0, 5];
  ai.predictedTargetPos = ai.lastKnownTargetPos;
  ai.update(1 / 60, [0, 0, 5], null, true);   // PARALYZED - the reset still runs
  assert.equal(ai.searchMult, 0, 'the gave-up arm resets through paralysis');

  const pacified = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  pacified._classicSenses = () => {}; pacified._senses = () => {};
  pacified.isHostile = false;      // senses hold no Target in DFU
  pacified.giveUpTimer = 200;
  pacified.searchMult = 7;
  pacified.lastKnownTargetPos = [0, 0, 5];
  pacified.predictedTargetPos = pacified.lastKnownTargetPos;
  pacified.update(1 / 60, [0, 0, 5], null, false);
  assert.equal(pacified.searchMult, 0, 'the no-target arm resets a pacified foe');
});

// ---------------------------------------------------------------
// F011 - TakeAction calls DoRangedAttack (:469) BEFORE the
// avoidObstaclesTimer branch (:481-484): a shooter in band with the
// target in sight stands off while the detour timer merely decays.
// The port took the detour first - the archer shot on the move.
// ---------------------------------------------------------------
test('audit26 F011: an archer in band STANDS OFF even while a detour timer is running', () => {
  const ai = new EnemyAI(clearStub(), [0, 0, 0], 0, { liveSpeed: 50, hasBowAttack: true });
  ai.detected = true;
  ai.giveUpTimer = 200;
  ai.inSight = true;
  ai.lastKnownTargetPos = [0, 0, 20];
  ai.predictedTargetPos = ai.lastKnownTargetPos;
  ai.destination = ai.lastKnownTargetPos;
  ai._dist = 20;                        // inside the 6..51.2 band
  ai.avoidObstaclesTimer = 0.75;        // a live detour
  ai.detourDestination = [5, 0, 5];
  ai.moving = true;
  ai._classicTick([0, 0, 20]);
  assert.equal(ai.moving, false, 'the stand-off wins: DoRangedAttack returns before the detour arm runs');

  // control: the same foe WITHOUT a bow walks its detour
  const walker = new EnemyAI(clearStub(), [0, 0, 0], 0, { liveSpeed: 50 });
  walker.detected = true;
  walker.giveUpTimer = 200;
  walker.inSight = true;
  walker.lastKnownTargetPos = [0, 0, 20];
  walker.predictedTargetPos = walker.lastKnownTargetPos;
  walker._dist = 20;
  walker.avoidObstaclesTimer = 0.75;
  walker.detourDestination = [0, 0, 5];
  walker._classicTick([0, 0, 20]);
  assert.equal(walker.moving, true, 'a melee foe still walks the detour');
});

// ---------------------------------------------------------------
// F010 - the bow roll and both cast branches live behind
// `if (CanAct) TakeAction` (:171-172). The port's components fired
// them through knockback hit-stun. (The MELEE decision is
// CanAct-independent in DFU and stays ungated.)
// ---------------------------------------------------------------
test('audit26 F010: the motor exposes CanAct, and hit-stun clears it', () => {
  const ai = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  ai._classicSenses = () => {}; ai._senses = () => {};
  ai.detected = true;
  ai.lastKnownTargetPos = [0, 0, 5];
  ai.predictedTargetPos = ai.lastKnownTargetPos;
  ai.update(1 / 60, [0, 0, 5], null, false);
  assert.equal(ai.canAct, true, 'a free foe can act');
  ai.knockbackSpeed = 5;
  ai.knockbackDir = [0, 0, 1];
  ai.update(1 / 60, [0, 0, 5], null, false);
  assert.equal(ai.canAct, false, 'knockback clears it (KnockbackMovement :317)');
  const para = new EnemyAI(floorCollider(), [0, 0, 0], 0, { liveSpeed: 50 });
  para._classicSenses = () => {}; para._senses = () => {};
  para.detected = true;
  para.lastKnownTargetPos = [0, 0, 5];
  para.predictedTargetPos = para.lastKnownTargetPos;
  para.update(1 / 60, [0, 0, 5], null, true);
  assert.equal(para.canAct, false, 'paralysis clears it (HandleParalysis :255)');
});

test('audit26 F010: a foe in hit-stun holds its bow', () => {
  const mkAi = (canAct) => ({
    canAct, inSight: true, detected: true, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0], _dist: 20,
  });
  // rolls: melee byte draw passes nothing, bow roll 0 always passes
  const attack = new EnemyAttack({ liveSpeed: 50, playerLevel: 10, reflexes: 2, rolls: () => 0 });
  attack.rangedAttack = true;
  attack.update(0.0625, mkAi(false), [0, 0, 20], 20);
  assert.equal(attack.machine.state, 'Idle', 'knocked back: no bow strike started');
  attack.update(0.0625, mkAi(true), [0, 0, 20], 20);
  assert.notEqual(attack.machine.state, 'Idle', 'free: the same tick shoots');
});

test('audit26 F010: a foe in hit-stun casts nothing, touch or ranged', () => {
  const ent = { level: 5, magicka: 100, spells: [mkSpell(1, 1), mkSpell(3, 2)] };
  const player = { activeEffects: [] };
  const mkAttack = () => ({ machine: { state: 'Idle' }, meleeTimer: 0, playerLevel: 10, reflexes: 2, rangedAttack: false });
  const stunned = { canAct: false, inSight: true, detected: true, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0] };
  const touch = new EnemyCaster(ent, () => 0);
  assert.equal(touch.update(0.016, { ...stunned, _dist: 2.0 }, mkAttack(), [0, 0, 2], player), null, 'no touch cast in hit-stun');
  const ranged = new EnemyCaster(ent, () => 0);
  assert.equal(ranged.update(0.0625, { ...stunned, _dist: 20 }, mkAttack(), [0, 0, 20], player), null, 'no ranged cast in hit-stun');
  // control: the same tick with CanAct back answers a decision
  const free = new EnemyCaster(ent, () => 0);
  assert.ok(free.update(0.016, { ...stunned, canAct: true, _dist: 2.0 }, mkAttack(), [0, 0, 2], player), 'free, it casts');
});

// ---------------------------------------------------------------
// F013 - DoTouchSpell (:621-628) has NO one-shot term: a foe whose
// melee timer floors to 0 mid-swing casts anyway, and
// ChangeEnemyState(Spell) CUTS the swing so the interrupted blow
// never lands. The port waited for the swing to end.
// ---------------------------------------------------------------
test('audit26 F013: a touch cast fires MID-SWING and cuts the swing', () => {
  const ent = { level: 5, magicka: 100, spells: [mkSpell(1, 1)] };
  const player = { activeEffects: [] };
  const attack = { machine: { state: 'Strike3', acc: 0.11 }, meleeTimer: 0, playerLevel: 10, reflexes: 2, rangedAttack: false };
  const c = new EnemyCaster(ent, () => 0);
  const d = c.update(0.016, { canAct: true, inSight: true, detected: true, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0], _dist: 2.0 }, attack, [0, 0, 2], player);
  assert.ok(d?.touch, 'the cast does not wait for the swing');
  assert.equal(attack.machine.state, 'Idle', 'ChangeEnemyState(Spell) cuts the swing - the interrupted blow cannot land');
  assert.equal(attack.machine.acc, 0, 'and the machine clock resets with it');
  assert.ok(attack.meleeTimer > 0, 'ResetMeleeTimer ran inside the body, verbatim');
});

// ---------------------------------------------------------------
// F009 - RangedAttack1 only when `HasRangedAttack1 && !HasRangedAttack2`,
// else RangedAttack2 (EnemyMotor.cs:594-597); RangedAttack2 maps to
// records 25-29 (EnemyBasics.cs:103-113). Battlemage (130) and
// Nightblade (133) carry both flags AND hasSpellAnimation, so their
// records 20-24 are the SPELL frames - the one-table state drew a
// Battlemage's spell-casting sprite for its bow shots.
// ---------------------------------------------------------------
test('audit26 F009: hasRangedAttack2 bow shots draw records 25-29, not the spell frames', () => {
  assert.deepEqual(RANGED_ATTACK2_ANIMS.map((a) => a.record), [25, 26, 27, 28, 29, 28, 27, 26],
    'EnemyBasics.RangedAttack2Anims verbatim');
  assert.ok(RANGED_ATTACK2_ANIMS.every((a) => a.fps === 10), 'RangedAttack2AnimSpeed 10');
  // the state pick, both ways
  assert.equal(stateAnims('ranged', 131, false, false, false, true, false), RANGED_ATTACK1_ANIMS,
    'r1-only archers keep records 20-24');
  assert.equal(stateAnims('ranged', 130, false, true, false, true, true), RANGED_ATTACK2_ANIMS,
    'both flags -> RangedAttack2 (the else-if wins)');
  // per-foe, off the real table: only Battlemage and Nightblade
  const r2 = Object.keys(ENEMY_BASICS).filter((k) => ENEMY_BASICS[k].hasRangedAttack2);
  assert.deepEqual(r2.map(Number), [130, 133], 'Battlemage and Nightblade alone carry the flag');
  for (const id of [130, 133]) {
    assert.equal(ENEMY_BASICS[id].hasSpellAnimation, true,
      'both carry hasSpellAnimation - which is exactly why 20-24 is wrong for their bows');
  }
  // ...and a live MobileUnit routes its states apart: spell on 20-24,
  // ranged on 25-29, for the same foe.
  const u = new MobileUnit(130, ENEMY_BASICS[130], 'male');
  u.state = 'spell';
  assert.equal(u._anims(), RANGED_ATTACK1_ANIMS, 'the spell state draws 20-24 (hasSpellAnimation)');
  u.state = 'ranged';
  assert.equal(u._anims(), RANGED_ATTACK2_ANIMS, 'the bow state draws 25-29');
});

// ---------------------------------------------------------------
// F021 - MobilePersonBillboard.SetIdle (:292-313) resets currentFrame
// to 0 and animTimer to 1 on EVERY idle/move transition. The port
// carried one monotonic frame across states, so a walker stopping to
// face the player entered the idle cycle at an arbitrary phase.
// ---------------------------------------------------------------
test('audit26 F021: the townsperson anim starts each state at frame 0', () => {
  const p = new MobilePerson(null, { archive: 182, frameCount: () => 6 });
  p.state = 'move';
  p.pos = [0, 0, 0];
  p.target = [0, 0, 100];   // far - stays in move
  // walk long enough to sit mid-cycle
  let out = null;
  for (let i = 0; i < 7; i++) out = p.update(0.2, [10, 0, 0], false);
  assert.ok(p.frame > 0, 'mid-cycle while walking');
  // the politeness stop: the idle cycle starts at ITS first frame
  out = p.update(0.016, [10, 0, 0], true);
  assert.equal(out.frame, 0, 'SetIdle: currentFrame = 0 on the transition');
  // and walking again restarts the move cycle at frame 0 too
  for (let i = 0; i < 12; i++) out = p.update(0.3, [10, 0, 0], true);
  assert.ok(p.frame > 0, 'mid-cycle while idling');
  out = p.update(0.016, [10, 0, 0], false);
  assert.equal(out.frame, 0, 'and the move arm resets the same way');
});
